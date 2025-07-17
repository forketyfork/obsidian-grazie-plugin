import { Plugin } from "obsidian";
import { GraziePluginSettings } from "../settings/types";

export interface AuthTokenManager {
	getToken(): string | null;
	setToken(token: string): Promise<void>;
	clearToken(): Promise<void>;
	validateToken(token: string): boolean;
	isTokenConfigured(): boolean;
}

export interface PluginWithSettings extends Plugin {
	settings: GraziePluginSettings;
	saveSettings(): Promise<void>;
}

export class ObsidianAuthTokenManager implements AuthTokenManager {
	private static readonly TOKEN_ENV_VAR = "JETBRAINS_AI_TOKEN";

	constructor(private plugin: PluginWithSettings) {}

	getToken(): string | null {
		// First check environment variable
		const envToken = process.env[ObsidianAuthTokenManager.TOKEN_ENV_VAR];
		if (envToken && this.validateToken(envToken)) {
			return envToken;
		}

		// Fallback to settings
		const settingsToken = this.plugin.settings.authToken;
		if (settingsToken && this.validateToken(settingsToken)) {
			return settingsToken;
		}

		return null;
	}

	async setToken(token: string): Promise<void> {
		if (!this.validateToken(token)) {
			throw new Error("Invalid token format");
		}

		// Update plugin settings
		this.plugin.settings.authToken = token;
		await this.plugin.saveSettings();
	}

	async clearToken(): Promise<void> {
		this.plugin.settings.authToken = "";
		await this.plugin.saveSettings();
	}

	validateToken(token: string): boolean {
		if (!token || typeof token !== "string") {
			return false;
		}

		// Basic validation: should be a non-empty string
		// JetBrains AI Platform tokens are typically JWT tokens
		const trimmedToken = token.trim();

		// Check for minimum length and basic format
		if (trimmedToken.length < 10) {
			return false;
		}

		// Check if it looks like a JWT token (has dots)
		// JWT tokens have format: header.payload.signature
		const parts = trimmedToken.split(".");
		if (parts.length !== 3) {
			// Not a JWT, but might be a valid token format
			// Allow other token formats but with minimum requirements
			return trimmedToken.length >= 20 && /^[A-Za-z0-9_-]+$/.test(trimmedToken);
		}

		// JWT validation: each part should be base64url encoded
		for (const part of parts) {
			if (!part || !/^[A-Za-z0-9_-]+$/.test(part)) {
				return false;
			}
		}

		return true;
	}

	isTokenConfigured(): boolean {
		return this.getToken() !== null;
	}
}

export class TokenValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TokenValidationError";
	}
}

export class AuthenticationService {
	private tokenManager: AuthTokenManager;

	constructor(tokenManager: AuthTokenManager) {
		this.tokenManager = tokenManager;
	}

	getAuthenticatedToken(): string {
		const token = this.tokenManager.getToken();

		if (!token) {
			throw new TokenValidationError(
				"No authentication token configured. Please set the JETBRAINS_AI_TOKEN environment variable or configure the token in settings."
			);
		}

		return token;
	}

	async setToken(token: string): Promise<void> {
		await this.tokenManager.setToken(token);
	}

	async clearToken(): Promise<void> {
		await this.tokenManager.clearToken();
	}

	isAuthenticated(): boolean {
		return this.tokenManager.isTokenConfigured();
	}

	validateTokenAsync(token: string): boolean {
		// For now, we do basic validation
		// In the future, we could make an API call to validate the token
		return this.tokenManager.validateToken(token);
	}

	static create(plugin: PluginWithSettings): AuthenticationService {
		const tokenManager = new ObsidianAuthTokenManager(plugin);
		return new AuthenticationService(tokenManager);
	}
}
