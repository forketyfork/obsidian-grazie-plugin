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
		this.authService = AuthenticationService.create(this);
		this.grammarChecker = new GrammarCheckerService(this.settings, this.authService);

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
		const data = (await this.loadData()) as Partial<GraziePluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
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
				new Notice(`Found ${result.totalProblems} grammar issue(s) in ${activeFile.name}`);
				console.error("Grammar check results:", result);
			} else {
				new Notice(`No grammar issues found in ${activeFile.name}`);
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
