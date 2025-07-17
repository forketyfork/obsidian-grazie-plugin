import { Plugin, Notice } from "obsidian";
import { GrazieSettingTab } from "./settings";
import { GraziePluginSettings, DEFAULT_SETTINGS } from "./settings/types";
import { GrammarCheckerService } from "./services/grammar-checker";
import { AuthenticationService } from "./jetbrains-ai/auth";

export default class GraziePlugin extends Plugin {
	settings: GraziePluginSettings;
	private grammarChecker: GrammarCheckerService | null = null;
	private authService: AuthenticationService | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize services
		try {
			this.authService = AuthenticationService.create(this);
			this.grammarChecker = new GrammarCheckerService(this.settings, this.authService);
		} catch (error) {
			console.error("Failed to initialize Grazie plugin services:", error);
			new Notice("Failed to initialize Grazie plugin. Check console for details.");
			return;
		}

		this.addSettingTab(new GrazieSettingTab(this.app, this));

		// Add ribbon icon for grammar checking
		this.addRibbonIcon("spell-check", "Check grammar", (_evt: MouseEvent) => {
			void this.checkCurrentFile();
		});
	}

	onunload() {
		// Plugin cleanup
		if (this.grammarChecker) {
			this.grammarChecker.dispose();
		}
	}

	async loadSettings() {
		try {
			const data: unknown = await this.loadData();
			if (data && typeof data === "object") {
				const validatedData = data as Record<string, unknown>;
				this.settings = Object.assign({}, DEFAULT_SETTINGS, validatedData);
			} else {
				this.settings = Object.assign({}, DEFAULT_SETTINGS);
			}
		} catch (error) {
			console.error("Failed to load settings:", error);
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async checkCurrentFile() {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice("No active file to check");
			return;
		}

		if (!activeFile.path.endsWith(".md")) {
			new Notice("Only markdown files are supported");
			return;
		}

		if (!this.grammarChecker || !this.authService) {
			new Notice("Grammar checker not initialized");
			return;
		}

		try {
			const content = await this.app.vault.cachedRead(activeFile);
			new Notice(`Grammar check started for ${activeFile.name}`);

			// Initialize grammar checker if needed
			if (!this.grammarChecker.isInitialized()) {
				await this.grammarChecker.initialize();
			}

			// Check the text
			const result = await this.grammarChecker.checkText(content);

			// Display results
			if (result.hasErrors) {
				const languageInfo = result.detectedLanguage ? ` (${result.detectedLanguage})` : "";
				new Notice(`Found ${result.totalProblems} grammar issue(s) in ${activeFile.name}${languageInfo}`);
				console.error("Grammar check results:", result);
			} else {
				const languageInfo = result.detectedLanguage ? ` (${result.detectedLanguage})` : "";
				new Notice(`No grammar issues found in ${activeFile.name}${languageInfo}`);
			}
		} catch (error) {
			console.error("Grammar check failed:", error);
			if (error instanceof Error) {
				new Notice(`Grammar check failed: ${error.message}`);
			} else {
				new Notice("Grammar check failed");
			}
		}
	}
}
