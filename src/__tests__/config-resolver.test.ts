import { requestUrl } from "obsidian";
import { ConfigurationUrlResolver, PlatformConfig } from "../jetbrains-ai/config-resolver";

const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;

describe("ConfigurationUrlResolver", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Clear console.error mock
		jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("resolve", () => {
		it("should return success result with highest priority URL", async () => {
			const mockConfig: PlatformConfig = {
				urls: [
					{
						url: "https://api.jetbrains.ai/",
						priority: 1,
						deprecated: false,
					},
					{
						url: "https://api.app.prod.grazie.aws.intellij.net/",
						priority: 2,
						deprecated: false,
					},
				],
			};

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: mockConfig,
				text: JSON.stringify(mockConfig),
			} as never);

			const resolver = new ConfigurationUrlResolver();
			const result = await resolver.resolve();

			expect(result.isSuccess).toBe(true);
			expect(result.isFallback).toBe(false);
			expect(result.url).toBe("https://api.jetbrains.ai/");
			expect(result.warnings).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});

		it("should filter out deprecated URLs", async () => {
			const mockConfig: PlatformConfig = {
				urls: [
					{
						url: "https://api.jetbrains.ai/",
						priority: 1,
						deprecated: false,
					},
					{
						url: "https://api.app.prod.grazie.aws.intellij.net/",
						priority: 2,
						deprecated: true,
					},
				],
			};

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: mockConfig,
				text: JSON.stringify(mockConfig),
			} as never);

			const resolver = new ConfigurationUrlResolver();
			const result = await resolver.resolve();

			expect(result.isSuccess).toBe(true);
			expect(result.url).toBe("https://api.jetbrains.ai/");
		});

		it("should return fallback URL when no active URLs are available", async () => {
			const mockConfig: PlatformConfig = {
				urls: [
					{
						url: "https://api.app.prod.grazie.aws.intellij.net/",
						priority: 1,
						deprecated: true,
					},
				],
			};

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: mockConfig,
				text: JSON.stringify(mockConfig),
			} as never);

			const resolver = new ConfigurationUrlResolver();
			const result = await resolver.resolve();

			expect(result.isSuccess).toBe(false);
			expect(result.isFallback).toBe(true);
			expect(result.url).toBe("https://api.jetbrains.ai/");
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("No valid URLs found in configuration");
		});

		it("should return fallback URL when config fetch fails", async () => {
			mockRequestUrl.mockRejectedValue(new Error("Network error"));

			const resolver = new ConfigurationUrlResolver();
			const result = await resolver.resolve();

			expect(result.isSuccess).toBe(false);
			expect(result.isFallback).toBe(true);
			expect(result.url).toBe("https://api.jetbrains.ai/");
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("Failed to fetch configuration");
		});

		it("should return fallback URL when HTTP status is not 200", async () => {
			mockRequestUrl.mockResolvedValue({
				status: 404,
				text: "Not Found",
			} as never);

			const resolver = new ConfigurationUrlResolver();
			const result = await resolver.resolve();

			expect(result.isSuccess).toBe(false);
			expect(result.isFallback).toBe(true);
			expect(result.url).toBe("https://api.jetbrains.ai/");
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("HTTP 404");
		});

		it("should validate configuration format", async () => {
			const invalidConfig = {
				urls: [
					{
						url: "",
						priority: "invalid",
						deprecated: "not-boolean",
					},
				],
			};

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: invalidConfig,
				text: JSON.stringify(invalidConfig),
			} as never);

			const resolver = new ConfigurationUrlResolver();
			const result = await resolver.resolve();

			expect(result.isSuccess).toBe(false);
			expect(result.isFallback).toBe(true);
			expect(result.url).toBe("https://api.jetbrains.ai/");
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("url must be a non-empty string");
		});
	});

	describe("factory methods", () => {
		it("should create default resolver", () => {
			const resolver = ConfigurationUrlResolver.createDefault();
			expect(resolver).toBeInstanceOf(ConfigurationUrlResolver);
		});

		it("should create resolver with custom config", () => {
			const resolver = new ConfigurationUrlResolver(
				"https://custom-config.example.com/config.json",
				"https://custom-api.example.com/"
			);
			expect(resolver).toBeInstanceOf(ConfigurationUrlResolver);
		});
	});

	describe("custom configuration", () => {
		it("should use default config URL", async () => {
			const mockConfig: PlatformConfig = {
				urls: [
					{
						url: "https://api.jetbrains.ai/",
						priority: 1,
						deprecated: false,
					},
				],
			};

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: mockConfig,
				text: JSON.stringify(mockConfig),
			} as never);

			const resolver = new ConfigurationUrlResolver();
			await resolver.resolve();

			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: "https://www.jetbrains.com/config/JetBrainsAIPlatform.json",
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				throw: false,
			});
		});

		it("should use custom config URL", async () => {
			const mockConfig: PlatformConfig = {
				urls: [
					{
						url: "https://custom-api.example.com/",
						priority: 1,
						deprecated: false,
					},
				],
			};

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: mockConfig,
				text: JSON.stringify(mockConfig),
			} as never);

			const resolver = new ConfigurationUrlResolver("https://custom-config.example.com/config.json");
			await resolver.resolve();

			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: "https://custom-config.example.com/config.json",
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				throw: false,
			});
		});
	});
});
