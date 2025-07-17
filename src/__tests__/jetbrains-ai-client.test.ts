/* eslint-disable @typescript-eslint/unbound-method */
import { JetBrainsAIClient, CorrectionServiceType } from "../jetbrains-ai/client";
import { ConfigurationUrlResolver } from "../jetbrains-ai/config-resolver";
import { ObsidianAuthTokenManager, PluginWithSettings } from "../jetbrains-ai/auth";

// Mock Obsidian's requestUrl function
jest.mock("obsidian", () => ({
	requestUrl: jest.fn(),
}));

describe("JetBrainsAIClient", () => {
	let mockRequestUrl: jest.Mock;
	let mockConfigResolver: jest.Mocked<ConfigurationUrlResolver>;

	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
		mockRequestUrl = require("obsidian").requestUrl as jest.Mock;
		mockConfigResolver = {
			resolve: jest.fn(),
		} as unknown as jest.Mocked<ConfigurationUrlResolver>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("initialization", () => {
		it("should initialize with valid configuration", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: true,
				isFallback: false,
				warnings: [],
				errors: [],
			});

			const client = new JetBrainsAIClient({ token: "test-token", userAuth: true }, mockConfigResolver);

			await client.initialize();

			expect(mockConfigResolver.resolve).toHaveBeenCalledTimes(1);
		});

		it("should handle configuration failure gracefully", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: false,
				isFallback: true,
				warnings: ["Configuration warning"],
				errors: ["Configuration error"],
			});

			const client = new JetBrainsAIClient({ token: "test-token", userAuth: true }, mockConfigResolver);

			// Should not throw
			await client.initialize();

			expect(mockConfigResolver.resolve).toHaveBeenCalledTimes(1);
		});
	});

	describe("grammar checking", () => {
		it("should make successful grammar check request", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: true,
				isFallback: false,
				warnings: [],
				errors: [],
			});

			const mockResponse = [
				{
					sentence: "This is a test sentence.",
					language: "ENGLISH",
					problems: [],
				},
			];

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: mockResponse,
			});

			const client = new JetBrainsAIClient({ token: "test-token", userAuth: true }, mockConfigResolver);

			const result = await client.checkGrammar({
				sentences: ["This is a test sentence."],
				language: "ENGLISH",
			});

			expect(result).toEqual(mockResponse);
			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: "https://api.jetbrains.ai/user/v5/gec/correct/v3",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "obsidian-grazie-plugin/1.0.0",
					"Grazie-Authenticate-JWT": "test-token",
				},
				body: JSON.stringify({
					sentences: ["This is a test sentence."],
					language: "ENGLISH",
					services: [CorrectionServiceType.MLEC, CorrectionServiceType.SPELL, CorrectionServiceType.RULE],
				}),
				throw: false,
			});
		});

		it("should handle authentication error", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: true,
				isFallback: false,
				warnings: [],
				errors: [],
			});

			mockRequestUrl.mockResolvedValue({
				status: 401,
				text: "Unauthorized",
			});

			const client = new JetBrainsAIClient({ token: "invalid-token", userAuth: true }, mockConfigResolver);

			await expect(
				client.checkGrammar({
					sentences: ["This is a test sentence."],
					language: "ENGLISH",
				})
			).rejects.toThrow("Authentication failed. Please check your token.");
		});

		it("should handle rate limiting", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: true,
				isFallback: false,
				warnings: [],
				errors: [],
			});

			mockRequestUrl.mockResolvedValue({
				status: 429,
				text: "Rate limit exceeded",
			});

			const client = new JetBrainsAIClient({ token: "test-token", userAuth: true }, mockConfigResolver);

			await expect(
				client.checkGrammar({
					sentences: ["This is a test sentence."],
					language: "ENGLISH",
				})
			).rejects.toThrow("Rate limit exceeded. Please try again later.");
		});
	});

	describe("static factory methods", () => {
		it("should create client with user token", () => {
			const client = JetBrainsAIClient.createWithUserToken("user-token");
			expect(client).toBeInstanceOf(JetBrainsAIClient);
		});

		it("should create client with application token", () => {
			const client = JetBrainsAIClient.createWithApplicationToken("app-token");
			expect(client).toBeInstanceOf(JetBrainsAIClient);
		});
	});
});

describe("AuthenticationService", () => {
	let mockPlugin: PluginWithSettings;

	beforeEach(() => {
		mockPlugin = {
			settings: {
				authToken: "",
				serverUrl: "https://api.jetbrains.ai",
				language: "en",
				configUrl: "https://www.jetbrains.com/config/JetBrainsAIPlatform.json",
				enabledServices: {
					mlec: true,
					spell: true,
					rule: true,
				},
				checkingDelay: 500,
				excludeCodeBlocks: true,
				excludeInlineCode: true,
				excludeLinks: true,
				excludeBlockQuotes: false,
				minConfidenceLevel: 0.5,
			},
			saveSettings: jest.fn(),
		} as unknown as PluginWithSettings;
	});

	describe("token validation", () => {
		it("should validate JWT token format", () => {
			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			// Valid JWT format
			const validJWT =
				"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
			expect(tokenManager.validateToken(validJWT)).toBe(true);

			// Invalid format
			expect(tokenManager.validateToken("")).toBe(false);
			expect(tokenManager.validateToken("invalid")).toBe(false);
			expect(tokenManager.validateToken("too.few")).toBe(false);
			expect(tokenManager.validateToken("too.many.parts.here")).toBe(false);
		});

		it("should validate non-JWT token format", () => {
			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			// Valid non-JWT format (minimum 20 chars, alphanumeric with - and _)
			const validToken = "abcdefghijklmnopqrstuvwxyz123456";
			expect(tokenManager.validateToken(validToken)).toBe(true);

			// Invalid non-JWT format
			expect(tokenManager.validateToken("short")).toBe(false);
			expect(tokenManager.validateToken("invalid@token")).toBe(false);
		});
	});

	describe("token management", () => {
		it("should get token from environment variable first", () => {
			process.env.JETBRAINS_AI_TOKEN = "env-token";
			mockPlugin.settings.authToken = "settings-token";

			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);
			const validateTokenSpy = jest.spyOn(tokenManager, "validateToken");
			validateTokenSpy.mockReturnValue(true);

			const result = tokenManager.getToken();
			expect(result).toBe("env-token");

			delete process.env.JETBRAINS_AI_TOKEN;
		});

		it("should fallback to settings token", () => {
			delete process.env.JETBRAINS_AI_TOKEN;
			mockPlugin.settings.authToken = "settings-token";

			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);
			const validateTokenSpy = jest.spyOn(tokenManager, "validateToken");
			validateTokenSpy.mockReturnValue(true);

			const result = tokenManager.getToken();
			expect(result).toBe("settings-token");
		});

		it("should return null if no valid token found", () => {
			delete process.env.JETBRAINS_AI_TOKEN;
			mockPlugin.settings.authToken = "";

			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);
			const result = tokenManager.getToken();
			expect(result).toBeNull();
		});
	});
});
