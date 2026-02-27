/* eslint-disable @typescript-eslint/unbound-method */
import { JetBrainsAIClient } from "../jetbrains-ai/client";
import { ConfigurationUrlResolver } from "../jetbrains-ai/config-resolver";
import {
	AuthenticationService,
	AuthTokenManager,
	ObsidianAuthTokenManager,
	PluginWithSettings,
} from "../jetbrains-ai/auth";

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
		jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
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

			const client = JetBrainsAIClient.createWithUserToken("test-token", mockConfigResolver);

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
				headers: { "content-type": "application/json" },
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
					lang: "ENGLISH",
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
				headers: { "content-type": "application/json" },
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
				headers: { "content-type": "application/json" },
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

		it("should handle forbidden error", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: true,
				isFallback: false,
				warnings: [],
				errors: [],
			});

			mockRequestUrl.mockResolvedValue({
				status: 403,
				headers: { "content-type": "application/json" },
				text: "Forbidden",
			});

			const client = new JetBrainsAIClient({ token: "test-token", userAuth: true }, mockConfigResolver);

			await expect(
				client.checkGrammar({
					sentences: ["This is a test sentence."],
					language: "ENGLISH",
				})
			).rejects.toThrow("Access forbidden. Please check your permissions.");
		});

		it("should reject when response is not JSON", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: true,
				isFallback: false,
				warnings: [],
				errors: [],
			});

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: { "content-type": "text/plain" },
				text: "ok",
			});

			const client = new JetBrainsAIClient({ token: "test-token", userAuth: true }, mockConfigResolver);

			await expect(
				client.checkGrammar({
					sentences: ["This is a test sentence."],
					language: "ENGLISH",
				})
			).rejects.toThrow("Expected JSON response, got text/plain");
		});

		it("should update authentication header when token changes", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: true,
				isFallback: false,
				warnings: [],
				errors: [],
			});

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: { "content-type": "application/json" },
				json: [],
			});

			const client = new JetBrainsAIClient({ token: "initial-token", userAuth: true }, mockConfigResolver);
			client.setToken("updated-token");

			await client.checkGrammar({
				sentences: ["This is a test sentence."],
				language: "ENGLISH",
			});

			const [request] = mockRequestUrl.mock.calls[mockRequestUrl.mock.calls.length - 1] as [
				{ headers: Record<string, string> },
			];

			expect(request.headers["Grazie-Authenticate-JWT"]).toBe("updated-token");
		});

		it("should use application endpoint when configured for application authentication", async () => {
			mockConfigResolver.resolve.mockResolvedValue({
				url: "https://api.jetbrains.ai/",
				isSuccess: true,
				isFallback: false,
				warnings: [],
				errors: [],
			});

			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: { "content-type": "application/json" },
				json: [],
			});

			const client = new JetBrainsAIClient({ token: "app-token", userAuth: false }, mockConfigResolver);

			await client.checkGrammar({
				sentences: ["This is a test sentence."],
				language: "ENGLISH",
			});

			const [request] = mockRequestUrl.mock.calls[mockRequestUrl.mock.calls.length - 1] as [{ url: string }];

			expect(request.url).toBe("https://api.jetbrains.ai/application/v5/gec/correct/v3");
		});
	});
});

describe("ObsidianAuthTokenManager", () => {
	let mockPlugin: PluginWithSettings;
	const validJwtToken =
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
	const validNonJwtToken = "abcdefghijklmnopqrstuvwxyz1234567890";

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
			saveSettings: jest.fn().mockResolvedValue(undefined),
		} as unknown as PluginWithSettings;
	});

	afterEach(() => {
		delete process.env.JETBRAINS_AI_TOKEN;
	});

	describe("token validation", () => {
		it("should validate JWT token format", () => {
			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			// Valid JWT format
			expect(tokenManager.validateToken(validJwtToken)).toBe(true);

			// Invalid format
			expect(tokenManager.validateToken("")).toBe(false);
			expect(tokenManager.validateToken("invalid")).toBe(false);
			expect(tokenManager.validateToken("too.few")).toBe(false);
			expect(tokenManager.validateToken("too.many.parts.here")).toBe(false);
		});

		it("should validate non-JWT token format", () => {
			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			// Valid non-JWT format (minimum 20 chars, alphanumeric with - and _)
			expect(tokenManager.validateToken(validNonJwtToken)).toBe(true);

			// Invalid non-JWT format
			expect(tokenManager.validateToken("short")).toBe(false);
			expect(tokenManager.validateToken("invalid@token")).toBe(false);
		});
	});

	describe("token management", () => {
		it("should get token from environment variable first", () => {
			process.env.JETBRAINS_AI_TOKEN = validJwtToken;
			mockPlugin.settings.authToken = validNonJwtToken;

			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			expect(tokenManager.getToken()).toBe(validJwtToken);
		});

		it("should fallback to settings token", () => {
			mockPlugin.settings.authToken = validNonJwtToken;

			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			expect(tokenManager.getToken()).toBe(validNonJwtToken);
		});

		it("should return null if no valid token found", () => {
			mockPlugin.settings.authToken = "";

			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);
			const result = tokenManager.getToken();
			expect(result).toBeNull();
		});

		it("should persist token when setToken is called", async () => {
			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			await tokenManager.setToken(validNonJwtToken);

			expect(mockPlugin.settings.authToken).toBe(validNonJwtToken);
			expect(mockPlugin.saveSettings).toHaveBeenCalledTimes(1);
		});

		it("should throw when attempting to set invalid token", async () => {
			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			await expect(tokenManager.setToken("invalid")).rejects.toThrow("Invalid token format");
			expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
		});

		it("should clear token from settings", async () => {
			mockPlugin.settings.authToken = validNonJwtToken;
			const tokenManager = new ObsidianAuthTokenManager(mockPlugin);

			await tokenManager.clearToken();

			expect(mockPlugin.settings.authToken).toBe("");
			expect(mockPlugin.saveSettings).toHaveBeenCalledTimes(1);
		});
	});
});

describe("AuthenticationService", () => {
	let currentToken: string | null;
	let mockTokenManager: jest.Mocked<AuthTokenManager>;

	beforeEach(() => {
		currentToken = null;
		mockTokenManager = {
			getToken: jest.fn(() => currentToken),
			setToken: jest.fn((token: string) => {
				currentToken = token;
				return Promise.resolve();
			}),
			clearToken: jest.fn(() => {
				currentToken = null;
				return Promise.resolve();
			}),
			validateToken: jest.fn(),
			isTokenConfigured: jest.fn(() => currentToken !== null),
		};
	});

	it("should return the current token when authenticated", () => {
		currentToken = "existing-token";
		const service = new AuthenticationService(mockTokenManager);

		expect(service.getAuthenticatedToken()).toBe("existing-token");
	});

	it("should throw when requesting token without configuration", () => {
		const service = new AuthenticationService(mockTokenManager);

		expect(() => service.getAuthenticatedToken()).toThrow(
			"No authentication token configured. Please set the JETBRAINS_AI_TOKEN environment variable or configure the token in settings."
		);
	});

	it("should emit token updates when token changes", async () => {
		const service = new AuthenticationService(mockTokenManager);
		const emissions: Array<string | null> = [];
		const subscription = service.token$.subscribe(value => emissions.push(value));

		await service.setToken("fresh-token");

		expect(mockTokenManager.setToken).toHaveBeenCalledWith("fresh-token");
		expect(emissions).toEqual([null, "fresh-token"]);

		subscription.unsubscribe();
	});

	it("should emit null after clearing token", async () => {
		currentToken = "existing-token";
		const service = new AuthenticationService(mockTokenManager);
		const emissions: Array<string | null> = [];
		const subscription = service.token$.subscribe(value => emissions.push(value));

		await service.clearToken();

		expect(mockTokenManager.clearToken).toHaveBeenCalledTimes(1);
		expect(emissions).toEqual(["existing-token", null]);

		subscription.unsubscribe();
	});

	it("should proxy authentication status", () => {
		const service = new AuthenticationService(mockTokenManager);

		expect(service.isAuthenticated()).toBe(false);

		currentToken = "new-token";

		expect(service.isAuthenticated()).toBe(true);
	});
});
