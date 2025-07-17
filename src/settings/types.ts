export interface GraziePluginSettings {
	enabled: boolean;
	authToken: string;
	serverUrl: string;
	language: string;
	enabledServices: {
		mlec: boolean;
		spell: boolean;
		rule: boolean;
	};
	checkingDelay: number;
	excludeCodeBlocks: boolean;
	excludeInlineCode: boolean;
	excludeLinks: boolean;
	excludeBlockQuotes: boolean;
	minConfidenceLevel: number;
}

export const DEFAULT_SETTINGS: GraziePluginSettings = {
	enabled: true,
	authToken: "",
	serverUrl: "https://api.jetbrains.ai",
	language: "en",
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
};

export type SupportedLanguage = "en" | "de" | "ru" | "uk";

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, string> = {
	en: "English",
	de: "German",
	ru: "Russian",
	uk: "Ukrainian",
};
