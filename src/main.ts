import { Plugin, MarkdownView } from "obsidian";
import { GrazieSettingTab } from "./settings";
import { GraziePluginSettings, DEFAULT_SETTINGS } from "./settings/types";
import { GrammarCheckerService } from "./services/grammar-checker";
import { AuthenticationService } from "./jetbrains-ai/auth";
import { EditorDecoratorService } from "./services/editor-decorator";
import { grammarDecorationsExtension } from "./editor/decorations";
import { realtimeCheckExtension } from "./editor/realtime-check";

export default class GraziePlugin extends Plugin {
	settings: GraziePluginSettings;
	private grammarChecker: GrammarCheckerService | null = null;
	private authService: AuthenticationService | null = null;
	private editorDecorator: EditorDecoratorService | null = null;
	private statusBarItem: HTMLElement | null = null;
	private statusIcon: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize services
		try {
			this.authService = AuthenticationService.create(this);
			this.grammarChecker = new GrammarCheckerService(this.settings, this.authService);
			this.editorDecorator = new EditorDecoratorService(this.app);
		} catch (error) {
			console.error("Failed to initialize Grazie plugin services:", error);
			return;
		}

		this.statusBarItem = this.addStatusBarItem();
		this.statusIcon = document.createElement("span");
		this.statusIcon.classList.add("grazie-plugin-status-icon");
		this.statusBarItem.appendChild(this.statusIcon);

		// Register CodeMirror extensions
		this.registerEditorExtension(grammarDecorationsExtension());
		this.registerEditorExtension(realtimeCheckExtension(this));

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
			return;
		}

		if (!activeFile.path.endsWith(".md")) {
			return;
		}

		if (!this.grammarChecker || !this.authService || !this.editorDecorator) {
			return;
		}

		try {
			const content = await this.app.vault.cachedRead(activeFile);
			this.statusIcon?.classList.add("grazie-plugin-spin");

			// Initialize grammar checker if needed
			if (!this.grammarChecker.isInitialized()) {
				await this.grammarChecker.initialize();
			}

			// Check the text
			const result = await this.grammarChecker.checkText(content);

			// Apply decorations to the active editor
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView?.editor) {
				// Get the CodeMirror EditorView
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				const editorView = (activeView.editor as any).cm;
				if (editorView) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					await this.editorDecorator.applyGrammarResults(editorView, activeFile, result);
				}
			}

			// Display results (status icon only)
		} catch (error) {
			console.error("Grammar check failed:", error);
		} finally {
			this.statusIcon?.classList.remove("grazie-plugin-spin");
		}
	}
}
