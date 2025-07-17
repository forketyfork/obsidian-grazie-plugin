import {
	JetBrainsAIClient,
	SentenceWithProblems,
	Problem,
	CorrectionServiceType,
	ConfidenceLevel,
} from "../jetbrains-ai";
import { AuthenticationService } from "../jetbrains-ai/auth";
import { GraziePluginSettings } from "../settings/types";

export interface GrammarCheckResult {
	problems: Problem[];
	processedSentences: string[];
	totalProblems: number;
	hasErrors: boolean;
}

export class GrammarCheckerService {
	private client: JetBrainsAIClient | null = null;
	private authService: AuthenticationService;

	constructor(
		private settings: GraziePluginSettings,
		authService: AuthenticationService
	) {
		this.authService = authService;
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
			// Simple sentence splitting - this will be improved later
			const sentences = this.splitIntoSentences(text);

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
				language: this.mapLanguageCode(this.settings.language),
				services: enabledServices,
			};

			// console.error("Grammar check request:", request);

			const response = await this.client.checkGrammar(request);

			// The API returns {corrections: [...]} format
			const corrections = (response as unknown as { corrections: SentenceWithProblems[] }).corrections ?? [];
			return this.processGrammarResponse(corrections);
		} catch (error) {
			console.error("Grammar check failed:", error);
			throw error;
		}
	}

	private splitIntoSentences(text: string): string[] {
		// Basic sentence splitting - will be improved later with proper markdown handling
		const cleanedText = text.trim();
		if (!cleanedText) {
			return [];
		}

		// Split on sentence-ending punctuation followed by whitespace or end of string
		const sentences = cleanedText
			.split(/[.!?]+\s+/)
			.map(sentence => sentence.trim())
			.filter(sentence => sentence.length > 0);

		// If we have sentences, make sure the last one ends with proper punctuation
		if (sentences.length > 0) {
			const lastSentence = sentences[sentences.length - 1];
			// Check if the original text ended with punctuation
			if (/[.!?]$/.test(cleanedText) && !/[.!?]$/.test(lastSentence)) {
				// Add back the punctuation that was removed by the split
				const lastPunctuation = cleanedText.match(/[.!?]+$/)?.[0] ?? ".";
				sentences[sentences.length - 1] = lastSentence + lastPunctuation;
			} else if (!/[.!?]$/.test(lastSentence)) {
				// If the text doesn't end with punctuation, add a period
				sentences[sentences.length - 1] = lastSentence + ".";
			}
		}

		return sentences;
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
		const allProblems: Problem[] = [];
		const processedSentences: string[] = [];

		for (const sentenceResult of response) {
			processedSentences.push(sentenceResult.sentence);
			allProblems.push(...sentenceResult.problems);
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
