import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { grammarDecorationsExtension, setGrammarProblems, GrammarProblemWithPosition } from "../editor/decorations";
import { Problem, ProblemCategory, CorrectionServiceType, ConfidenceLevel } from "../jetbrains-ai";

describe("grammarDecorationsExtension", () => {
	function createView(doc: string): { view: EditorView; parent: HTMLElement } {
		const state = EditorState.create({
			doc,
			extensions: [grammarDecorationsExtension()],
		});
		const parent = document.createElement("div");
		const view = new EditorView({ state, parent });
		return { view, parent };
	}

	function makeProblem(
		from: number,
		to: number,
		category: ProblemCategory,
		service: CorrectionServiceType,
		confidence: ConfidenceLevel
	): GrammarProblemWithPosition {
		const problem: Problem = {
			message: "test",
			info: {
				id: { id: "1" },
				category,
				service,
				displayName: "test",
				confidence,
			},
			highlighting: {
				always: [{ start: from, endExclusive: to }],
				onHover: [],
			},
			fixes: [],
		};
		return { problem, from, to, sentenceIndex: 0, sentenceOffset: from };
	}

	it("adds spelling error classes", () => {
		const { view, parent } = createView("This is tset text.");
		const p = makeProblem(8, 12, ProblemCategory.SPELLING, CorrectionServiceType.SPELL, ConfidenceLevel.HIGH);
		view.dispatch({ effects: setGrammarProblems.of([p]) });

		const span = parent.querySelector<HTMLElement>(".grazie-plugin-spelling-error");
		expect(span).not.toBeNull();
		if (span) {
			expect(span.textContent).toBe("tset");
			expect(span.classList.contains("grazie-plugin-error-high-confidence")).toBe(true);
		}
	});

	it("adds grammar error classes with low confidence", () => {
		const { view, parent } = createView("Sentence with eror.");
		const p = makeProblem(14, 18, ProblemCategory.GRAMMAR, CorrectionServiceType.MLEC, ConfidenceLevel.LOW);
		view.dispatch({ effects: setGrammarProblems.of([p]) });

		const span = parent.querySelector<HTMLElement>(".grazie-plugin-grammar-error");
		expect(span).not.toBeNull();
		if (span) {
			expect(span.textContent).toBe("eror");
			expect(span.classList.contains("grazie-plugin-error-low-confidence")).toBe(true);
		}
	});
});
