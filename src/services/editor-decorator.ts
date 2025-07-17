import { EditorView } from "@codemirror/view";
import { App, TFile } from "obsidian";
import {
	GrammarProblemWithPosition,
	setGrammarProblems,
	mapProblemsToPositions,
	grammarDecorationsField,
} from "../editor/decorations";
import { GrammarCheckResult } from "./grammar-checker";
import { MarkdownTextProcessor } from "./text-processor";

export class EditorDecoratorService {
	private textProcessor: MarkdownTextProcessor;

	constructor(private app: App) {
		this.textProcessor = new MarkdownTextProcessor();
	}

	/**
	 * Apply grammar checking results to an editor view
	 */
	async applyGrammarResults(view: EditorView, file: TFile, result: GrammarCheckResult): Promise<void> {
		if (!result.hasErrors) {
			// Clear existing decorations
			this.clearDecorations(view);
			return;
		}

		try {
			// Get the original content
			const originalContent = await this.app.vault.cachedRead(file);

			// Extract the processed text (same as what was sent to grammar checker)
			const processedTextResult = this.textProcessor.extractTextForGrammarCheck(originalContent);

			// Map problems to editor positions
			const problemsWithPositions = mapProblemsToPositions(
				result.problems,
				result.processedSentences,
				processedTextResult
			);

			// Filter out problems that couldn't be mapped
			const validProblems = problemsWithPositions.filter(p => p.from >= 0 && p.to <= view.state.doc.length);

			// Apply decorations
			this.setDecorations(view, validProblems);
		} catch (error) {
			console.error("Failed to apply grammar decorations:", error);
		}
	}

	/**
	 * Clear all grammar decorations from an editor view
	 */
	clearDecorations(view: EditorView): void {
		view.dispatch({
			effects: setGrammarProblems.of([]),
		});
	}

	/**
	 * Set grammar decorations on an editor view
	 */
	private setDecorations(view: EditorView, problems: GrammarProblemWithPosition[]): void {
		view.dispatch({
			effects: setGrammarProblems.of(problems),
		});
	}

	/**
	 * Check if a view has grammar decorations
	 */
	hasDecorations(view: EditorView): boolean {
		const state = view.state.field(grammarDecorationsField, false);
		return state ? state.problems.length > 0 : false;
	}

	/**
	 * Get grammar problems from a view
	 */
	getProblems(view: EditorView): GrammarProblemWithPosition[] {
		const state = view.state.field(grammarDecorationsField, false);
		return state ? state.problems : [];
	}
}
