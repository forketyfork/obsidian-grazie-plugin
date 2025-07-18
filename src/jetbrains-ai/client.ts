import { requestUrl } from "obsidian";
import { ConfigurationUrlResolver } from "./config-resolver";

export interface AuthConfig {
	token: string;
	userAuth: boolean; // true for user token, false for application token
}

export interface GecRequest {
	sentences: string[];
	language: string;
	services?: CorrectionServiceType[];
}

export interface GecRequestWithExclusions {
	sentences: SentenceWithExclusions[];
	language: string;
	services?: CorrectionServiceType[];
}

export interface SentenceWithExclusions {
	sentence: string;
	exclusions?: Exclusion[];
}

export interface Exclusion {
	offset: number;
	kind: ExclusionKind;
}

export enum ExclusionKind {
	Markup = "Markup",
}

export enum CorrectionServiceType {
	MLEC = "MLEC",
	SPELL = "SPELL",
	RULE = "RULE",
}

export interface TextRange {
	start: number;
	endExclusive: number;
}

export interface ProblemHighlighting {
	always: TextRange[];
	onHover: TextRange[];
}

export interface ProblemFix {
	parts: FixPart[];
	batchId?: string;
}

export interface FixPart {
	type: "Context" | "Skip" | "Change";
	text?: string;
	range?: TextRange;
}

export interface Problem {
	info: KindInfo;
	message: string;
	highlighting: ProblemHighlighting;
	fixes: ProblemFix[];
	experimental?: unknown;
	condition?: unknown;
	actionSuggestions?: ActionSuggestion[];
}

export interface KindInfo {
	id: ProblemKindID;
	category: ProblemCategory;
	service: CorrectionServiceType;
	displayName: string;
	ruleSettingsId?: string;
	confidence: ConfidenceLevel;
}

export interface ProblemKindID {
	id: string;
}

export enum ProblemCategory {
	SPELLING = "SPELLING",
	PUNCTUATION = "PUNCTUATION",
	TYPOGRAPHY = "TYPOGRAPHY",
	GRAMMAR = "GRAMMAR",
	SEMANTICS = "SEMANTICS",
	STYLE = "STYLE",
	READABILITY = "READABILITY",
	INCLUSIVITY = "INCLUSIVITY",
	TONE = "TONE",
	FORMALITY = "FORMALITY",
	OTHER = "OTHER",
}

export enum ConfidenceLevel {
	LOW = "LOW",
	HIGH = "HIGH",
}

export interface ActionSuggestion {
	type: string;
	parameterId?: string;
	parameterDisplayName?: string;
	suggestedValue?: unknown;
}

export interface SentenceWithProblems {
	sentence: string;
	language: string;
	problems: Problem[];
}

export interface GecResponse {
	sentences: SentenceWithProblems[];
}

export class JetBrainsAIClient {
	private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds
	private static readonly USER_AGENT = "obsidian-grazie-plugin/1.0.0";

	private baseUrl: string | null = null;
	private configResolver: ConfigurationUrlResolver;

	constructor(
		private authConfig: AuthConfig,
		configResolver?: ConfigurationUrlResolver
	) {
		this.configResolver = configResolver ?? ConfigurationUrlResolver.createDefault();
	}

	async initialize(): Promise<void> {
		const resolutionResult = await this.configResolver.resolve();
		this.baseUrl = resolutionResult.url;

		if (!resolutionResult.isSuccess) {
			console.error("Failed to resolve JetBrains AI Platform URL:", resolutionResult.errors);
			if (resolutionResult.warnings.length > 0) {
				console.error("Configuration warnings:", resolutionResult.warnings);
			}
		}
	}

	async checkGrammar(request: GecRequest): Promise<SentenceWithProblems[]> {
		await this.ensureInitialized();
		const endpoint = this.getEndpoint("/v5/gec/correct/v3");

		const response = await this.makeRequest(endpoint, {
			sentences: request.sentences,
			lang: request.language,
		});

		return response as SentenceWithProblems[];
	}

	async checkGrammarWithExclusions(request: GecRequestWithExclusions): Promise<SentenceWithProblems[]> {
		await this.ensureInitialized();
		const endpoint = this.getEndpoint("/v5/gec/correct/v4");

		const response = await this.makeRequest(endpoint, {
			sentences: request.sentences,
			language: request.language,
			services: request.services ?? [
				CorrectionServiceType.MLEC,
				CorrectionServiceType.SPELL,
				CorrectionServiceType.RULE,
			],
		});

		return response as SentenceWithProblems[];
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.baseUrl) {
			await this.initialize();
		}
	}

	private getEndpoint(path: string): string {
		if (!this.baseUrl) {
			throw new Error("Client not initialized. Call initialize() first.");
		}

		const authType = this.authConfig.userAuth ? "user" : "application";
		const baseUrl = this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl;
		return `${baseUrl}/${authType}${path}`;
	}

	private async makeRequest(url: string, body: unknown): Promise<unknown> {
		const requestBody = JSON.stringify(body);
		const requestTimestamp = new Date().toISOString();

		// Log request details
		console.log("=== JetBrains AI API Request ===");
		console.log(`Timestamp: ${requestTimestamp}`);
		console.log(`URL: ${url}`);
		console.log(`Method: POST`);
		console.log("Headers:", {
			"Content-Type": "application/json",
			"User-Agent": JetBrainsAIClient.USER_AGENT,
			"Grazie-Authenticate-JWT": this.authConfig.token ? `${this.authConfig.token.substring(0, 20)}...` : "None",
		});
		console.log("Request Body:", requestBody);
		console.log("Request Body (parsed):", body);

		try {
			const response = await requestUrl({
				url,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"User-Agent": JetBrainsAIClient.USER_AGENT,
					"Grazie-Authenticate-JWT": this.authConfig.token,
				},
				body: requestBody,
				throw: false,
			});

			const responseTimestamp = new Date().toISOString();

			// Log response details
			console.log("=== JetBrains AI API Response ===");
			console.log(`Timestamp: ${responseTimestamp}`);
			console.log(`Status: ${response.status}`);
			console.log("Response Headers:", response.headers);
			console.log("Response Body (raw):", response.text);
			console.log("Response Body (parsed):", response.json);

			if (response.status === 401) {
				console.error("Authentication failed - Status 401");
				throw new Error("Authentication failed. Please check your token.");
			}

			if (response.status === 403) {
				console.error("Access forbidden - Status 403");
				throw new Error("Access forbidden. Please check your permissions.");
			}

			if (response.status === 429) {
				console.error("Rate limit exceeded - Status 429");
				throw new Error("Rate limit exceeded. Please try again later.");
			}

			if (response.status < 200 || response.status >= 300) {
				console.error(`HTTP error - Status ${response.status}`);
				throw new Error(`HTTP ${response.status}: Request failed`);
			}

			// Validate content type
			const contentType = response.headers["content-type"] || "";
			if (!contentType.includes("application/json")) {
				console.error(`Invalid content type: ${contentType}`);
				throw new Error(`Expected JSON response, got ${contentType}`);
			}

			console.log("=== Request/Response Complete ===");
			return response.json as unknown;
		} catch (error) {
			console.error("=== JetBrains AI API Error ===");
			console.error("Error details:", error);
			console.error("Request URL:", url);
			console.error("Request Body:", requestBody);

			if (error instanceof Error) {
				throw new Error(`API request failed: ${error.message}`);
			}
			throw new Error(`API request failed: ${String(error)}`);
		}
	}

	static createWithUserToken(token: string, configResolver?: ConfigurationUrlResolver): JetBrainsAIClient {
		return new JetBrainsAIClient({ token, userAuth: true }, configResolver);
	}

	static createWithApplicationToken(token: string, configResolver?: ConfigurationUrlResolver): JetBrainsAIClient {
		return new JetBrainsAIClient({ token, userAuth: false }, configResolver);
	}
}
