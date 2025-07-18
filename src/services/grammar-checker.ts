import {
	JetBrainsAIClient,
	SentenceWithProblems,
	Problem,
	CorrectionServiceType,
	ConfidenceLevel,
} from "../jetbrains-ai";
import { AuthenticationService } from "../jetbrains-ai/auth";
import { GraziePluginSettings, SupportedLanguage } from "../settings/types";
import { MarkdownTextProcessor } from "./text-processor";
import { LanguageDetectorService, LanguageDetectionResult } from "./language-detector";

export interface ProblemWithSentence extends Problem {
	sentenceIndex: number;
}

export interface GrammarCheckResult {
	problems: ProblemWithSentence[];
	processedSentences: string[];
	totalProblems: number;
	hasErrors: boolean;
	detectedLanguage?: SupportedLanguage;
	languageDetectionResult?: LanguageDetectionResult;
}

export class GrammarCheckerService {
	private client: JetBrainsAIClient | null = null;
	private authService: AuthenticationService;
	private textProcessor: MarkdownTextProcessor;
	private languageDetector: LanguageDetectorService;

	constructor(
		private settings: GraziePluginSettings,
		authService: AuthenticationService
	) {
		this.authService = authService;
		this.textProcessor = new MarkdownTextProcessor();
		this.languageDetector = new LanguageDetectorService();
	}

	async initialize(): Promise<void> {
		try {
			const token = this.authService.getAuthenticatedToken();
			this.client = JetBrainsAIClient.createWithUserToken(token);
			await this.client.initialize();
		} catch (error) {
			console.error("Failed to initialize grammar checker:", error);
			throw error;
		}
	}

	async checkText(text: string): Promise<GrammarCheckResult> {
		if (!this.client) {
			console.error("Grammar checker not initialized");
			throw new Error("Grammar checker not initialized");
		}

		if (!text.trim()) {
			return {
				problems: [],
				processedSentences: [],
				totalProblems: 0,
				hasErrors: false,
			};
		}

		try {
			// Extract text for grammar checking, excluding code blocks, etc.
			const processedText = this.textProcessor.extractTextForGrammarCheck(text);

			if (!processedText.extractedText.trim()) {
				return {
					problems: [],
					processedSentences: [],
					totalProblems: 0,
					hasErrors: false,
				};
			}

			// Detect language from the extracted text if auto-detection is enabled
			let languageDetectionResult: LanguageDetectionResult | undefined;
			let languageToUse: SupportedLanguage = this.settings.language as SupportedLanguage;

			if (this.settings.autoDetectLanguage) {
				try {
					const textSamples = this.languageDetector.extractTextSamples(processedText.extractedText);
					languageDetectionResult = this.languageDetector.detectLanguageFromSamples(
						textSamples,
						this.settings.language as SupportedLanguage
					);
					languageToUse = languageDetectionResult.detectedLanguage;
				} catch (error) {
					console.error("Language detection failed, using default language:", error);
				}
			}

			// Split extracted text into sentences
			const sentences = this.splitIntoSentences(processedText.extractedText);

			// Check for reasonable limits
			if (sentences.length > 100) {
				console.error(`Document too large: ${sentences.length} sentences`);
				throw new Error("Document too large for grammar checking (> 100 sentences)");
			}

			const totalLength = sentences.join(" ").length;
			if (totalLength > 50000) {
				console.error(`Document too large: ${totalLength} characters`);
				throw new Error("Document too large for grammar checking (> 50,000 characters)");
			}

			const enabledServices: CorrectionServiceType[] = [];
			if (this.settings.enabledServices.mlec) enabledServices.push(CorrectionServiceType.MLEC);
			if (this.settings.enabledServices.spell) enabledServices.push(CorrectionServiceType.SPELL);
			if (this.settings.enabledServices.rule) enabledServices.push(CorrectionServiceType.RULE);

			// Ensure we have at least one service enabled
			if (enabledServices.length === 0) {
				enabledServices.push(CorrectionServiceType.SPELL);
			}

			const request = {
				sentences,
				language: this.mapLanguageCode(languageToUse),
				services: enabledServices,
			};

			const response = await this.client.checkGrammar(request);

			// Validate and process API response
			let corrections: SentenceWithProblems[] = [];
			if (response && typeof response === "object" && "corrections" in response) {
				const responseObj = response as { corrections: unknown };
				if (Array.isArray(responseObj.corrections)) {
					corrections = responseObj.corrections as SentenceWithProblems[];
				}
			} else if (Array.isArray(response)) {
				// Some API versions return array directly
				corrections = response;
			}

			const result = this.processGrammarResponse(corrections);

			// Add language detection information to the result
			result.detectedLanguage = languageToUse;
			result.languageDetectionResult = languageDetectionResult;

			return result;
		} catch (error) {
			console.error("Grammar check failed:", error);
			throw error;
		}
	}

	private splitIntoSentences(text: string): string[] {
		// Clean up the text and handle markdown formatting
		const cleanedText = this.textProcessor.cleanMarkdownFormatting(text.trim());

		if (!cleanedText) {
			return [];
		}

		// Split on sentence-ending punctuation followed by whitespace and capital letter
		// This preserves the punctuation
		const sentences: string[] = [];
		let currentSentence = "";

		for (let i = 0; i < cleanedText.length; i++) {
			const char = cleanedText[i];
			currentSentence += char;

			// Check if we're at a sentence boundary
			if (/[.!?]/.test(char)) {
				// Look ahead for whitespace and capital letter
				const nextChar = cleanedText[i + 1];
				const charAfterSpace = cleanedText[i + 2];

				if ((nextChar === " " || nextChar === "\n") && charAfterSpace && /\p{Lu}/u.test(charAfterSpace)) {
					// This is a sentence boundary
					sentences.push(currentSentence.trim());
					currentSentence = "";
					i++; // Skip the space
				} else if (i === cleanedText.length - 1) {
					// This is the end of the text
					sentences.push(currentSentence.trim());
					currentSentence = "";
				}
			}
		}

		// Add any remaining text as a sentence
		if (currentSentence.trim()) {
			sentences.push(currentSentence.trim());
		}

		// Process each sentence
		const processedSentences: string[] = [];

		for (let sentence of sentences) {
			// Remove any remaining markdown formatting
			sentence = sentence
				.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
				.replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
				.replace(/~~([^~]+)~~/g, "$1")
				.trim();

			// Ensure sentence ends with proper punctuation
			if (!/[.!?]$/.test(sentence)) {
				sentence += ".";
			}

			// Only add sentences that have actual content
			if (sentence.length > 3 && /\p{L}/u.test(sentence)) {
				processedSentences.push(sentence);
			}
		}

		return processedSentences;
	}

	private mapLanguageCode(language: string): string {
		const languageMap: Record<string, string> = {
			en: "ENGLISH",
			de: "GERMAN",
			ru: "RUSSIAN",
			uk: "UKRAINIAN",
		};
		return languageMap[language] || "ENGLISH";
	}

	private processGrammarResponse(response: SentenceWithProblems[]): GrammarCheckResult {
		const allProblems: ProblemWithSentence[] = [];
		const processedSentences: string[] = [];

		for (let sentenceIndex = 0; sentenceIndex < response.length; sentenceIndex++) {
			const sentenceResult = response[sentenceIndex];
			processedSentences.push(sentenceResult.sentence);

			// Add sentence index to each problem
			for (const problem of sentenceResult.problems) {
				allProblems.push({
					...problem,
					sentenceIndex,
				});
			}
		}

		// Filter problems based on confidence level
		const filteredProblems = allProblems.filter(problem => {
			const confidence = problem.info.confidence === ConfidenceLevel.HIGH ? 1.0 : 0.5;
			return confidence >= this.settings.minConfidenceLevel;
		});

		return {
			problems: filteredProblems,
			processedSentences,
			totalProblems: filteredProblems.length,
			hasErrors: filteredProblems.length > 0,
		};
	}

	isInitialized(): boolean {
		return this.client !== null;
	}

	dispose(): void {
		this.client = null;
	}
}
