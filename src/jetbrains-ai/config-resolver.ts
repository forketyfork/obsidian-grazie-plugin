// Fetch and parse JetBrains AI platform configuration to find the best API URL.
import { requestUrl } from "obsidian";

export interface PlatformConfig {
	urls: PlatformUrl[];
}

export interface PlatformUrl {
	url: string;
	priority: number;
	deprecated: boolean;
}

export interface ResolutionResult {
	url: string;
	isSuccess: boolean;
	isFallback: boolean;
	warnings: string[];
	errors: string[];
}

export class ConfigurationUrlResolver {
	private static readonly DEFAULT_CONFIG_URL = "https://www.jetbrains.com/config/JetBrainsAIPlatform.json";
	private static readonly DEFAULT_FALLBACK_URL = "https://api.jetbrains.ai/";
	private static readonly REQUEST_TIMEOUT = 10000; // 10 seconds

	constructor(
		private configUrl: string = ConfigurationUrlResolver.DEFAULT_CONFIG_URL,
		private fallbackUrl: string = ConfigurationUrlResolver.DEFAULT_FALLBACK_URL
	) {}

	async resolve(): Promise<ResolutionResult> {
		try {
			const config = await this.fetchConfig(this.configUrl);
			const selectedUrl = this.selectBestUrl(config);

			if (selectedUrl) {
				return {
					url: selectedUrl,
					isSuccess: true,
					isFallback: false,
					warnings: [],
					errors: [],
				};
			} else {
				return {
					url: this.fallbackUrl,
					isSuccess: false,
					isFallback: true,
					warnings: [`No valid URLs found in configuration from ${this.configUrl}, using fallback`],
					errors: [],
				};
			}
		} catch (error) {
			console.error("Failed to resolve configuration URL:", error);
			return {
				url: this.fallbackUrl,
				isSuccess: false,
				isFallback: true,
				warnings: [],
				errors: [`Failed to fetch configuration from ${this.configUrl}: ${(error as Error).message}`],
			};
		}
	}

	private async fetchConfig(configUrl: string): Promise<PlatformConfig> {
		try {
			const response = await requestUrl({
				url: configUrl,
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				throw: false,
			});

			if (response.status !== 200) {
				throw new Error(`HTTP ${response.status}: ${response.text}`);
			}

			const config = response.json as PlatformConfig;
			this.validateConfig(config);
			return config;
		} catch (error) {
			throw new Error(`Failed to fetch or parse configuration: ${(error as Error).message}`);
		}
	}

	private validateConfig(config: unknown): void {
		if (!config || typeof config !== "object") {
			throw new Error("Invalid configuration format: not an object");
		}

		const configObj = config as Record<string, unknown>;

		if (!Array.isArray(configObj.urls)) {
			throw new Error("Invalid configuration format: urls must be an array");
		}

		for (const [index, urlEntry] of configObj.urls.entries()) {
			if (!urlEntry || typeof urlEntry !== "object") {
				throw new Error(`Invalid URL entry at index ${index}: not an object`);
			}

			const entry = urlEntry as Record<string, unknown>;

			if (typeof entry.url !== "string" || !entry.url.trim()) {
				throw new Error(`Invalid URL entry at index ${index}: url must be a non-empty string`);
			}

			if (typeof entry.priority !== "number" || entry.priority < 0) {
				throw new Error(`Invalid URL entry at index ${index}: priority must be a non-negative number`);
			}

			if (typeof entry.deprecated !== "boolean") {
				throw new Error(`Invalid URL entry at index ${index}: deprecated must be a boolean`);
			}
		}
	}

	private selectBestUrl(config: PlatformConfig): string | null {
		// Filter out deprecated URLs
		const activeUrls = config.urls.filter(urlEntry => !urlEntry.deprecated);

		if (activeUrls.length === 0) {
			return null;
		}

		// Sort by priority (lower number = higher priority)
		const sortedUrls = activeUrls.sort((a, b) => a.priority - b.priority);

		// Return the URL with the highest priority (lowest number)
		return sortedUrls[0].url;
	}

	static createDefault(): ConfigurationUrlResolver {
		return new ConfigurationUrlResolver();
	}
}
