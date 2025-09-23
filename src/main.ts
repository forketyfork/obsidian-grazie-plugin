// Entry point for the Obsidian Grazie plugin. The class wires together the
// grammar checker, editor decorations and user settings.
import { Plugin, MarkdownView, addIcon, setIcon, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { GrazieSettingTab } from "./settings";
import { GraziePluginSettings, DEFAULT_SETTINGS } from "./settings/types";
import { GrammarCheckerService } from "./services/grammar-checker";
import { AuthenticationService } from "./jetbrains-ai/auth";
import { EditorDecoratorService } from "./services/editor-decorator";
import { grammarDecorationsExtension } from "./editor/decorations";
import { realtimeCheckExtension } from "./editor/realtime-check";
import { GRAZIE_RIBBON_ICON, GRAZIE_STATUS_ICON } from "./icons";

export default class GraziePlugin extends Plugin {
	settings: GraziePluginSettings;
	private grammarChecker: GrammarCheckerService | null = null;
	private authService: AuthenticationService | null = null;
	private editorDecorator: EditorDecoratorService | null = null;
	private statusBarItem: HTMLElement | null = null;
	private statusIcon: HTMLElement | null = null;
	private lastErrorNoticeAt: number | null = null;
	private lastErrorNoticeKey: string | null = null;

	async onload() {
		// Read settings and prepare services before attaching any editor extensions
		await this.loadSettings();

		// Register custom Grazie icon
		addIcon("grazie", GRAZIE_RIBBON_ICON);
		addIcon("grazie-status", GRAZIE_STATUS_ICON);

		// Create grammar checker and helper services
		try {
			this.authService = AuthenticationService.create(this);
			this.grammarChecker = new GrammarCheckerService(this.settings, this.authService);
			this.editorDecorator = new EditorDecoratorService(this.app);
		} catch (error) {
			console.error("Failed to initialize Grazie plugin services:", error);
			return;
		}

		// Add a small spinner icon to indicate when checks are running
		this.statusBarItem = this.addStatusBarItem();
		this.statusIcon = document.createElement("div");
		this.statusIcon.classList.add("grazie-plugin-status-icon");
		this.statusIcon.title = "Grazie Plugin";
		setIcon(this.statusIcon, "grazie-status");
		this.statusBarItem.appendChild(this.statusIcon);

		// Register CodeMirror extensions
		this.registerEditorExtension(grammarDecorationsExtension());
		this.registerEditorExtension(realtimeCheckExtension(this));

		this.addSettingTab(new GrazieSettingTab(this.app, this));

		// Add ribbon icon for grammar checking
		this.addRibbonIcon("grazie", "Check grammar", (_evt: MouseEvent) => {
			void this.checkCurrentFile();
		});

		// Automatically check file when opened
		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				void this.checkCurrentFile();
			})
		);

		// Check already open file on plugin load
		void this.checkCurrentFile();
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

	// Public helper to apply token immediately without requiring plugin reload
	async applyAuthToken(token: string): Promise<void> {
		if (!this.authService) return;
		await this.authService.setToken(token);
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

		// Don't check if plugin is disabled
		if (!this.settings.enabled) {
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
			this.showErrorNotice(error);
		} finally {
			this.statusIcon?.classList.remove("grazie-plugin-spin");
		}
	}

	// Called by the realtime extension to check only the edited portion of the document
	async checkRange(view: EditorView, from: number, to: number) {
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

		// Don't check if plugin is disabled
		if (!this.settings.enabled) {
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
			this.showErrorNotice(error);
		} finally {
			this.statusIcon?.classList.remove("grazie-plugin-spin");
		}
	}

	private showErrorNotice(error: unknown): void {
		let message = "Grazie: An error occurred while checking grammar.";
		const raw = error instanceof Error ? error.message : String(error);

		// Map common backend/auth issues to friendly messages
		if (raw.includes("No authentication token configured")) {
			message = "Grazie: No token configured. Set JETBRAINS_AI_TOKEN or add a token in settings.";
		} else if (raw.includes("Authentication failed") || raw.includes("401")) {
			message = "Grazie: Authentication failed. Please check your token.";
		} else if (raw.includes("Access forbidden") || raw.includes("403")) {
			message = "Grazie: Access forbidden. Please check your permissions.";
		} else if (raw.includes("Rate limit exceeded") || raw.includes("429")) {
			message = "Grazie: Rate limit exceeded. Please try again later.";
		} else if (raw.includes("Expected JSON response")) {
			message = "Grazie: Unexpected server response. Please try again later.";
		} else if (raw.includes("HTTP ")) {
			message = "Grazie: Server error. Please try again later.";
		} else if (raw.includes("API request failed")) {
			// Keep API failure reason but prefix with Grazie
			message = `Grazie: ${raw}`;
		}

		// De-duplicate frequent notices within 10 seconds for the same message
		const now = Date.now();
		const key = message;
		if (this.lastErrorNoticeKey === key && this.lastErrorNoticeAt !== null && now - this.lastErrorNoticeAt < 10000) {
			return;
		}

		this.lastErrorNoticeKey = key;
		this.lastErrorNoticeAt = now;
		new Notice(message, 8000);
	}
}
