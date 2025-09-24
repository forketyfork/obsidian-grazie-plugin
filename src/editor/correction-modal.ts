import { App, Modal, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { GrammarProblemWithPosition, grammarDecorationsField, setGrammarProblems } from "./decorations";

interface SuggestionSelection {
	problem: GrammarProblemWithPosition;
	suggestion: string;
}

export function problemHasSuggestions(problem: GrammarProblemWithPosition): boolean {
	return extractSuggestions(problem).length > 0;
}

function extractSuggestions(problem: GrammarProblemWithPosition): string[] {
	const suggestions: string[] = [];

	for (const fix of problem.problem.fixes) {
		const replacement = fix.parts
			.filter(part => part.type === "Change" && typeof part.text === "string")
			.map(part => part.text ?? "")
			.join("");

		if (replacement.trim().length > 0) {
			suggestions.push(replacement);
		}
	}

	return suggestions;
}

function formatProblemLabel(problem: GrammarProblemWithPosition, index: number): string {
	const displayName = problem.problem.info.displayName?.trim();
	const message = problem.problem.message?.trim();

	if (displayName && message && displayName !== message) {
		return `${index + 1}. ${displayName} – ${message}`;
	}

	if (displayName) {
		return `${index + 1}. ${displayName}`;
	}

	if (message) {
		return `${index + 1}. ${message}`;
	}

	return `${index + 1}. Suggested correction`;
}

export class CorrectionModal extends Modal {
	private readonly selected = new Map<GrammarProblemWithPosition, string>();
	private previewEl: HTMLTextAreaElement | null = null;
	private readonly originalText: string;

	constructor(
		app: App,
		private readonly view: EditorView,
		private readonly problems: GrammarProblemWithPosition[]
	) {
		super(app);
		this.originalText = this.view.state.doc.toString();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("grazie-plugin-correction-modal");

		const header = contentEl.createDiv({ cls: "grazie-plugin-correction-header" });
		header.createEl("h2", { text: "Review suggestions" });
		header.createSpan({
			cls: "grazie-plugin-correction-summary",
			text: `${this.problems.length} suggestion${this.problems.length === 1 ? "" : "s"} available`,
		});

		const panes = contentEl.createDiv("grazie-plugin-correction-panes");
		const originalPane = panes.createDiv("grazie-plugin-original-pane");
		const previewPane = panes.createDiv("grazie-plugin-preview-pane");

		const originalTextArea = originalPane.createEl("textarea", {
			cls: "grazie-plugin-original-text",
		});
		originalTextArea.readOnly = true;
		originalTextArea.value = this.originalText;

		this.previewEl = previewPane.createEl("textarea", {
			cls: "grazie-plugin-preview-text",
		});
		this.previewEl.readOnly = true;
		this.previewEl.value = this.originalText;

		const problemsContainer = contentEl.createDiv("grazie-plugin-problems-container");

		let hasAnySuggestions = false;

		this.problems.forEach((problem, index) => {
			const suggestions = extractSuggestions(problem);
			if (suggestions.length === 0) {
				return;
			}

			hasAnySuggestions = true;

			const group = problemsContainer.createDiv("grazie-plugin-problem-group");
			group.createDiv({
				cls: "grazie-plugin-problem-heading",
				text: formatProblemLabel(problem, index),
			});

			const context = group.createDiv("grazie-plugin-problem-context");
			const originalSnippet = this.originalText.slice(problem.from, problem.to).trim();
			context.setText(originalSnippet.length > 0 ? originalSnippet : "(No text highlighted)");

			const options = group.createDiv("grazie-plugin-problem-options");

			suggestions.forEach((suggestion, suggestionIndex) => {
				const label = options.createEl("label", {
					cls: "grazie-plugin-problem-option",
				});
				const radio = label.createEl("input", {
					type: "radio",
					attr: {
						name: `grazie-problem-${index}`,
						value: suggestion,
					},
				});
				label.createSpan({
					cls: "grazie-plugin-problem-option-text",
					text: suggestion,
				});

				radio.addEventListener("change", () => {
					this.selected.set(problem, suggestion);
					this.updatePreview();
				});

				if (suggestionIndex === 0) {
					radio.checked = true;
					this.selected.set(problem, suggestion);
				}
			});

			const keepOriginalLabel = options.createEl("label", {
				cls: "grazie-plugin-problem-option",
			});
			const keepOriginalRadio = keepOriginalLabel.createEl("input", {
				type: "radio",
				attr: {
					name: `grazie-problem-${index}`,
					value: "grazie-keep-original",
				},
			});
			keepOriginalLabel.createSpan({
				cls: "grazie-plugin-problem-option-text",
				text: "Keep original text",
			});

			keepOriginalRadio.addEventListener("change", () => {
				this.selected.delete(problem);
				this.updatePreview();
			});
		});

		if (!hasAnySuggestions) {
			const emptyState = contentEl.createDiv("grazie-plugin-correction-empty");
			emptyState.setText("No automatic suggestions are available right now.");
		}

		const buttons = contentEl.createDiv("grazie-plugin-modal-buttons");
		const applyAllBtn = buttons.createEl("button", {
			cls: "grazie-plugin-primary-button",
			text: "Apply all",
		});
		applyAllBtn.disabled = !hasAnySuggestions;
		applyAllBtn.addEventListener("click", () => {
			this.applyAll();
		});

		const applySelectedBtn = buttons.createEl("button", {
			text: "Apply selected",
		});
		applySelectedBtn.addEventListener("click", () => {
			this.applySelected();
		});

		const cancelBtn = buttons.createEl("button", {
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		this.updatePreview();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private updatePreview(): void {
		if (!this.previewEl) {
			return;
		}

		let preview = this.originalText;
		const ordered = [...this.problems].filter(problem => this.selected.has(problem)).sort((a, b) => b.from - a.from);

		for (const problem of ordered) {
			const suggestion = this.selected.get(problem);
			if (!suggestion) {
				continue;
			}

			preview = `${preview.slice(0, problem.from)}${suggestion}${preview.slice(problem.to)}`;
		}

		this.previewEl.value = preview;
	}

	private applySelected(): void {
		const selections: SuggestionSelection[] = [];

		for (const problem of this.problems) {
			const suggestion = this.selected.get(problem);
			if (suggestion) {
				selections.push({ problem, suggestion });
			}
		}

		if (selections.length === 0) {
			new Notice("Select at least one suggestion to apply.");
			return;
		}

		const state = this.view.state.field(grammarDecorationsField, false);
		const problemsToRemove = new Set(selections.map(selection => selection.problem));
		const changes = selections
			.sort((a, b) => a.problem.from - b.problem.from)
			.map(selection => ({
				from: selection.problem.from,
				to: selection.problem.to,
				insert: selection.suggestion,
			}));

		const effects = state
			? [setGrammarProblems.of(state.problems.filter(problem => !problemsToRemove.has(problem)))]
			: [];

		this.view.dispatch({
			changes,
			effects,
		});

		this.close();
	}

	private applyAll(): void {
		let hasSuggestion = false;

		for (const problem of this.problems) {
			const suggestions = extractSuggestions(problem);
			if (suggestions.length > 0) {
				this.selected.set(problem, suggestions[0]);
				hasSuggestion = true;
			}
		}

		if (!hasSuggestion) {
			new Notice("No suggestions available to apply.");
			return;
		}

		this.updatePreview();
		this.applySelected();
	}
}
