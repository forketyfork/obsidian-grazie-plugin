// Wraps the JetBrains AI client and handles text extraction, language detection
// and response processing.
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
import { LRUCache } from "./lru-cache";

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

// High level service that communicates with the JetBrains AI Platform and maps
// results back into the original document.
export class GrammarCheckerService {
	private client: JetBrainsAIClient | null = null;
	private authService: AuthenticationService;
	private textProcessor: MarkdownTextProcessor;
	private languageDetector: LanguageDetectorService;
	private sentenceCache: LRUCache<string, SentenceWithProblems>;

	// Settings and auth service are provided by the main plugin class
	constructor(
		private settings: GraziePluginSettings,
		authService: AuthenticationService
	) {
		this.authService = authService;
		this.textProcessor = new MarkdownTextProcessor();
		this.languageDetector = new LanguageDetectorService();
		this.sentenceCache = new LRUCache<string, SentenceWithProblems>(200);
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

			const sentencesToCheck: string[] = [];
			const indicesToCheck: number[] = [];
			const correctionsArray: Array<SentenceWithProblems | undefined> = new Array<SentenceWithProblems | undefined>(
				sentences.length
			).fill(undefined);

			for (let i = 0; i < sentences.length; i++) {
				const cached = this.sentenceCache.get(sentences[i]);
				if (cached) {
					correctionsArray[i] = cached;
				} else {
					sentencesToCheck.push(sentences[i]);
					indicesToCheck.push(i);
				}
			}

			if (sentencesToCheck.length > 0) {
				const request = {
					sentences: sentencesToCheck,
					language: this.mapLanguageCode(languageToUse),
					services: enabledServices,
				};

				const response = await this.client.checkGrammar(request);

				let apiCorrections: SentenceWithProblems[] = [];
				if (response && typeof response === "object" && "corrections" in response) {
					const responseObj = response as { corrections: unknown };
					if (Array.isArray(responseObj.corrections)) {
						apiCorrections = responseObj.corrections as SentenceWithProblems[];
					}
				} else if (Array.isArray(response)) {
					apiCorrections = response;
				}

				for (let j = 0; j < apiCorrections.length; j++) {
					const idx = indicesToCheck[j];
					const result = apiCorrections[j];
					correctionsArray[idx] = result;
					this.sentenceCache.set(sentences[idx], result);
				}
			}

			const corrections: SentenceWithProblems[] = correctionsArray.filter(
				(c): c is SentenceWithProblems => c !== undefined
			);

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

	// Split text into sentences before sending it to the API. The API
	// expects individual sentences with punctuation preserved.
	private splitIntoSentences(text: string): string[] {
		// Clean up the text and handle markdown formatting
		const cleanedText = this.textProcessor.cleanMarkdownFormatting(text.trim());

		if (!cleanedText) {
			return [];
		}

		// Split on sentence-ending punctuation followed by whitespace and capital letter
		// Also handle sentences that end with newlines but no punctuation
		const sentences: string[] = [];
		let currentSentence = "";

		for (let i = 0; i < cleanedText.length; i++) {
			const char = cleanedText[i];

			// Check if we're at a sentence boundary before adding the character
			if (/[.!?]/.test(char)) {
				currentSentence += char;

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
			} else if (char === " ") {
				// Check if this space might represent a collapsed newline that should be a sentence boundary
				const nextChar = cleanedText[i + 1];

				// Look for patterns that suggest this space was originally a newline:
				// 1. Current sentence doesn't end with punctuation AND next char is uppercase
				// 2. Current sentence has reasonable length (not just a short phrase)
				// 3. Be more conservative to avoid false positives
				const trimmedSentence = currentSentence.trim();
				const endsWithPunctuation = /[.!?]$/.test(trimmedSentence);
				const hasReasonableLength = trimmedSentence.length > 20; // Increased threshold to be more conservative
				const nextIsCapital = nextChar && /\p{Lu}/u.test(nextChar);

				// Additional checks to avoid false positives:
				// - Don't split if the next word looks like it could be part of the same sentence
				// - Look ahead to see if there are common continuation words (but exclude sentence starters)
				const nextFewChars = cleanedText.slice(i + 1, i + 10);
				const isLikelyContinuation = /^(and|or|the|a|an|in|on|at|to|for|of|with)\s/i.test(nextFewChars);

				if (
					trimmedSentence &&
					/\p{L}/u.test(trimmedSentence) &&
					!endsWithPunctuation &&
					hasReasonableLength &&
					nextIsCapital &&
					!isLikelyContinuation
				) {
					// This looks like a sentence boundary that was originally a newline
					sentences.push(trimmedSentence);
					currentSentence = "";
				} else {
					// Regular space, add to current sentence
					currentSentence += char;
				}
			} else {
				// Regular character, add to current sentence
				currentSentence += char;
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

		// Drop low confidence suggestions according to settings
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
