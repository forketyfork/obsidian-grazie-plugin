import { Plugin, MarkdownView } from "obsidian";
import { EditorView } from "@codemirror/view";
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
	private statusIcon: HTMLImageElement | null = null;

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
		this.statusIcon = document.createElement("img");
		this.statusIcon.classList.add("grazie-plugin-status-icon");
		this.statusIcon.src = "images/grazie_logo.png";
		this.statusIcon.alt = "Grazie";
		this.statusIcon.title = "Grazie Plugin";
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
		console.log("=== checkCurrentFile called ===");
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			console.log("No active file");
			return;
		}

		console.log(`Active file: ${activeFile.path}`);
		if (!activeFile.path.endsWith(".md")) {
			console.log("File is not a markdown file");
			return;
		}

		if (!this.grammarChecker || !this.authService || !this.editorDecorator) {
			console.log("Services not initialized");
			return;
		}

		// Don't check if plugin is disabled
		if (!this.settings.enabled) {
			console.log("Plugin is disabled");
			return;
		}

		try {
			const content = await this.app.vault.cachedRead(activeFile);

			// Skip empty files
			if (content.trim().length === 0) {
				return;
			}

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

	async checkRange(view: EditorView, from: number, to: number) {
		console.log(`=== checkRange called ===`);
		console.log(`Range: ${from} to ${to}`);
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			console.log("No active file");
			return;
		}

		console.log(`Active file: ${activeFile.path}`);
		if (!activeFile.path.endsWith(".md")) {
			console.log("File is not a markdown file");
			return;
		}

		if (!this.grammarChecker || !this.authService || !this.editorDecorator) {
			console.log("Services not initialized");
			return;
		}

		// Don't check if plugin is disabled
		if (!this.settings.enabled) {
			console.log("Plugin is disabled");
			return;
		}

		try {
			const text = view.state.doc.sliceString(from, to);

			// Skip empty or very short text
			if (text.trim().length < 3) {
				return;
			}

			this.statusIcon?.classList.add("grazie-plugin-spin");

			if (!this.grammarChecker.isInitialized()) {
				await this.grammarChecker.initialize();
			}

			const result = await this.grammarChecker.checkText(text);

			this.editorDecorator.applyPartialGrammarResults(view, activeFile, from, text, result);
		} catch (error) {
			console.error("Grammar check failed:", error);
		} finally {
			this.statusIcon?.classList.remove("grazie-plugin-spin");
		}
	}
}
