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

			const response = await this.client.checkGrammar({
				sentences,
				language: this.mapLanguageCode(this.settings.language),
				services: enabledServices,
			});

			return this.processGrammarResponse(response);
		} catch (error) {
			console.error("Grammar check failed:", error);
			throw error;
		}
	}

	private splitIntoSentences(text: string): string[] {
		// Basic sentence splitting - will be improved later with proper markdown handling
		return text
			.split(/[.!?]+/)
			.map(sentence => sentence.trim())
			.filter(sentence => sentence.length > 0)
			.map(sentence => sentence + ".");
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
