import { App, Modal, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { GrammarProblemWithPosition } from "./decorations";

function extractSuggestions(problem: GrammarProblemWithPosition): string[] {
	return problem.problem.fixes
		.map(fix =>
			fix.parts
				.filter(part => part.type === "Change" && part.text)
				.map(part => part.text as string)
				.join("")
		)
		.filter(text => text.trim().length > 0);
}

export class CorrectionModal extends Modal {
	private selected: Map<GrammarProblemWithPosition, string> = new Map();
	private previewEl: HTMLTextAreaElement | null = null;

	constructor(
		app: App,
		private view: EditorView,
		private problems: GrammarProblemWithPosition[]
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("grazie-plugin-correction-modal");

		const panes = contentEl.createDiv("grazie-plugin-correction-panes");
		const originalPane = panes.createDiv("grazie-plugin-original-pane");
		const previewPane = panes.createDiv("grazie-plugin-preview-pane");

		const originalTextArea = originalPane.createEl("textarea", {
			cls: "grazie-plugin-original-text",
		});
		originalTextArea.readOnly = true;
		originalTextArea.value = this.view.state.doc.toString();

		this.previewEl = previewPane.createEl("textarea", {
			cls: "grazie-plugin-preview-text",
		});
		this.previewEl.readOnly = true;
		this.previewEl.value = this.view.state.doc.toString();

		const problemsContainer = contentEl.createDiv("grazie-plugin-problems-container");

		this.problems.forEach((problem, index) => {
			const group = problemsContainer.createDiv("grazie-plugin-problem-group");
			group.createDiv({
				cls: "grazie-plugin-problem-original",
				text: this.view.state.doc.sliceString(problem.from, problem.to),
			});

			const suggestions = extractSuggestions(problem);
			suggestions.forEach((suggestion, i) => {
				const label = group.createEl("label", {
					cls: "grazie-plugin-problem-option",
				});
				const radio = label.createEl("input", {
					type: "radio",
					attr: {
						name: `problem-${index}`,
						value: suggestion,
					},
				});
				label.createSpan({ text: suggestion });
				radio.addEventListener("change", () => {
					this.selected.set(problem, suggestion);
					this.updatePreview();
				});
				if (i === 0) {
					radio.checked = false;
				}
			});
		});

		const buttons = contentEl.createDiv("grazie-plugin-modal-buttons");
		const applyAllBtn = buttons.createEl("button", {
			text: "Apply all",
		});
		applyAllBtn.addEventListener("click", () => {
			this.applyAll();
		});

		const applySelectedBtn = buttons.createEl("button", {
			text: "Apply selected",
		});
		applySelectedBtn.addEventListener("click", () => {
			this.applySelected();
		});
	}

	private updatePreview() {
		if (!this.previewEl) return;
		let text = this.view.state.doc.toString();
		const ordered = [...this.problems].sort((a, b) => b.from - a.from);
		for (const problem of ordered) {
			const suggestion = this.selected.get(problem);
			if (suggestion) {
				text = text.slice(0, problem.from) + suggestion + text.slice(problem.to);
			}
		}
		this.previewEl.value = text;
	}

	private applySelected() {
		const changes = [] as { from: number; to: number; insert: string }[];
		const ordered = [...this.problems].sort((a, b) => a.from - b.from);
		for (const problem of ordered) {
			const suggestion = this.selected.get(problem);
			if (suggestion) {
				changes.push({
					from: problem.from,
					to: problem.to,
					insert: suggestion,
				});
			}
		}
		if (changes.length === 0) {
			new Notice("No suggestions selected");
			return;
		}
		this.view.dispatch({ changes });
		this.close();
	}

	private applyAll() {
		this.problems.forEach(problem => {
			const suggestions = extractSuggestions(problem);
			if (suggestions.length > 0) {
				this.selected.set(problem, suggestions[0]);
			}
		});
		this.updatePreview();
		this.applySelected();
	}
}
