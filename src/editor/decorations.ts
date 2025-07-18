import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect, Extension, Transaction } from "@codemirror/state";
import { Problem, ProblemCategory, CorrectionServiceType, ConfidenceLevel } from "../jetbrains-ai";
import { MarkdownTextProcessor, ProcessedText } from "../services/text-processor";
import { ProblemWithSentence } from "../services/grammar-checker";

export interface GrammarProblemWithPosition {
	problem: Problem;
	from: number;
	to: number;
	sentenceIndex: number;
	sentenceOffset: number;
}

export interface GrammarDecorationsState {
	problems: GrammarProblemWithPosition[];
	decorations: DecorationSet;
}

// State effect to update grammar problems
export const setGrammarProblems = StateEffect.define<GrammarProblemWithPosition[]>();

// State field to store grammar problems and decorations
export const grammarDecorationsField = StateField.define<GrammarDecorationsState>({
	create(): GrammarDecorationsState {
		return {
			problems: [],
			decorations: Decoration.none,
		};
	},

	update(value: GrammarDecorationsState, transaction: Transaction): GrammarDecorationsState {
		let newProblems = value.problems;
		let needsUpdate = false;

		// Check for grammar problems effect
		for (const effect of transaction.effects) {
			if (effect.is(setGrammarProblems)) {
				newProblems = effect.value;
				needsUpdate = true;
			}
		}

		// If document changed, adjust problem positions
		if (transaction.docChanged && newProblems.length > 0) {
			const docLength = transaction.newDoc.length;
			newProblems = newProblems
				.map(problemWithPos => {
					const mappedFrom = transaction.changes.mapPos(problemWithPos.from);
					const mappedTo = transaction.changes.mapPos(problemWithPos.to);
					return {
						...problemWithPos,
						from: mappedFrom,
						to: mappedTo,
					};
				})
				.filter(problemWithPos => {
					// Filter out problems that are now invalid after position mapping
					const { from, to } = problemWithPos;
					return from >= 0 && to > from && to <= docLength;
				});
			needsUpdate = true;
		}

		// Only create new decorations if needed
		if (needsUpdate) {
			const decorations = createDecorations(newProblems);
			return {
				problems: newProblems,
				decorations,
			};
		}

		return value;
	},

	provide: (f: StateField<GrammarDecorationsState>) =>
		EditorView.decorations.from(f, (state: GrammarDecorationsState) => state.decorations),
});

// Create decorations from grammar problems
export function createDecorations(problems: GrammarProblemWithPosition[]): DecorationSet {
	const decorations = problems
		.filter(problemWithPos => {
			const { from, to } = problemWithPos;
			// Filter out invalid ranges: negative positions, empty ranges, or out-of-bounds positions
			return from >= 0 && to > from && from < to;
		})
		.sort((a, b) => {
			// Sort by from position to ensure decorations are added in order
			if (a.from !== b.from) return a.from - b.from;
			// If from positions are equal, sort by to position
			return a.to - b.to;
		})
		.map(problemWithPos => {
			const { problem, from, to } = problemWithPos;
			const cssClass = getProblemCssClass(problem);
			const title = getProblemTitle(problem);

			return Decoration.mark({
				class: cssClass,
				attributes: {
					title: title,
					"data-grazie-plugin-problem": "true",
					"data-grazie-plugin-category": problem.info.category,
					"data-grazie-plugin-service": problem.info.service,
					"data-grazie-plugin-confidence": problem.info.confidence,
				},
			}).range(from, to);
		});

	return Decoration.set(decorations);
}

// Get CSS class for problem type
function getProblemCssClass(problem: Problem): string {
	const baseClass = "grazie-plugin-error";
	const confidenceClass =
		problem.info.confidence === ConfidenceLevel.HIGH
			? "grazie-plugin-error-high-confidence"
			: "grazie-plugin-error-low-confidence";

	// Determine error type based on category and service
	let typeClass: string;
	if (problem.info.category === ProblemCategory.SPELLING) {
		typeClass = "grazie-plugin-spelling-error";
	} else if (problem.info.service === CorrectionServiceType.SPELL) {
		typeClass = "grazie-plugin-spelling-error";
	} else {
		typeClass = "grazie-plugin-grammar-error";
	}

	return `${baseClass} ${typeClass} ${confidenceClass}`;
}

// Get problem title for tooltip
function getProblemTitle(problem: Problem): string {
	const confidence = problem.info.confidence === ConfidenceLevel.HIGH ? "High" : "Low";
	const service = problem.info.service;
	const category = problem.info.category;

	let title = `${problem.message} (${confidence} confidence, ${service}`;
	if (category) {
		title += `, ${category}`;
	}
	title += ")";

	// Add suggestions if available
	if (problem.fixes.length > 0) {
		const suggestions = problem.fixes
			.map(fix =>
				fix.parts
					.filter(part => part.type === "Change")
					.map(part => part.text)
					.join("")
			)
			.filter(suggestion => suggestion.trim().length > 0)
			.slice(0, 3); // Show max 3 suggestions

		if (suggestions.length > 0) {
			title += `\n\nSuggestions: ${suggestions.join(", ")}`;
		}
	}

	return title;
}

function getProblemSuggestions(problem: Problem): string[] {
	return problem.fixes
		.map(fix =>
			fix.parts
				.filter(part => part.type === "Change")
				.map(part => part.text)
				.join("")
		)
		.filter(suggestion => suggestion.trim().length > 0)
		.slice(0, 3);
}

function formatSuggestionWithDescription(suggestion: string, problem: Problem): string {
	const displayName = problem.info.displayName || "";
	const message = problem.message || "";

	// Format as: "replacement" (DisplayName. Message) - using quotes instead of markdown bold
	let formatted = `"${suggestion}"`;

	if (displayName || message) {
		formatted += " (";
		if (displayName) {
			formatted += displayName;
			if (message && message !== displayName) {
				formatted += ". " + message;
			}
		} else if (message) {
			formatted += message;
		}
		formatted += ")";
	}

	return formatted;
}

function applySuggestion(
	view: EditorView,
	state: GrammarDecorationsState,
	problem: GrammarProblemWithPosition,
	suggestion: string
): void {
	try {
		// Apply the suggestion
		view.dispatch({ changes: { from: problem.from, to: problem.to, insert: suggestion } });

		// Remove only the specific problem that was fixed
		const updatedProblems = state.problems.filter(p => p !== problem);
		view.dispatch({ effects: setGrammarProblems.of(updatedProblems) });
	} catch (error) {
		console.error("Failed to apply suggestion:", error);
	}
}

// View plugin for handling grammar decorations
export const grammarDecorationsPlugin = ViewPlugin.fromClass(
	class {
		private dropdown: HTMLElement | null = null;

		constructor(readonly view: EditorView) {
			this.view.dom.addEventListener("click", this.onClick);
		}

		private onClick = (event: MouseEvent): void => {
			const target = event.target as HTMLElement;
			const problemElement = target.closest("[data-grazie-plugin-problem]");
			if (!problemElement) {
				this.hideDropdown();
				return;
			}

			const pos = this.view.posAtDOM(target);
			const state = this.view.state.field(grammarDecorationsField, false);
			if (!state) {
				return;
			}
			const problem = state.problems.find(p => pos >= p.from && pos <= p.to);
			if (!problem) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			this.showDropdown(problem, state);
		};

		private showDropdown(problem: GrammarProblemWithPosition, state: GrammarDecorationsState): void {
			this.hideDropdown();
			const suggestions = getProblemSuggestions(problem.problem);

			// Create a popup container
			const popup = document.createElement("div");
			popup.classList.add("grazie-plugin-suggestions-popup");

			if (suggestions.length === 0) {
				// Show informative message for problems without fixes
				const messageDiv = document.createElement("div");
				messageDiv.classList.add("grazie-plugin-no-suggestions-message");

				const problemType = problem.problem.info.category === ProblemCategory.SPELLING ? "spelling" : "grammar";
				const title = problem.problem.info.displayName || `${problemType} issue`;
				const message = problem.problem.message || "No suggestions available";

				messageDiv.innerHTML = `
					<div class="grazie-plugin-message-title">${title}</div>
					<div class="grazie-plugin-message-text">${message}</div>
					<div class="grazie-plugin-message-note">No automatic fixes available for this issue.</div>
				`;

				popup.appendChild(messageDiv);
			} else {
				// Create suggestion buttons
				suggestions.forEach((suggestion, _index) => {
					const button = document.createElement("button");
					button.classList.add("grazie-plugin-suggestion-button");
					button.textContent = formatSuggestionWithDescription(suggestion, problem.problem);
					button.title = formatSuggestionWithDescription(suggestion, problem.problem);

					// Apply suggestion on click
					button.addEventListener("click", e => {
						e.preventDefault();
						e.stopPropagation();
						applySuggestion(this.view, state, problem, suggestion);
						this.hideDropdown();
						window.removeEventListener("click", remove);
					});

					// Add keyboard support
					button.addEventListener("keydown", e => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							e.stopPropagation();
							applySuggestion(this.view, state, problem, suggestion);
							this.hideDropdown();
							window.removeEventListener("click", remove);
						} else if (e.key === "Escape") {
							this.hideDropdown();
							window.removeEventListener("click", remove);
						} else if (e.key === "ArrowDown") {
							e.preventDefault();
							const nextButton = button.nextElementSibling as HTMLButtonElement;
							if (nextButton) nextButton.focus();
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							const prevButton = button.previousElementSibling as HTMLButtonElement;
							if (prevButton) prevButton.focus();
						}
					});

					popup.appendChild(button);
				});
			}

			// Position the popup
			const coords = this.view.coordsAtPos(problem.from);
			if (!coords) {
				return;
			}
			popup.style.position = "absolute";
			popup.style.left = `${coords.left}px`;
			popup.style.top = `${coords.bottom + 2}px`;

			document.body.appendChild(popup);
			this.dropdown = popup;

			// Focus the first button
			const firstButton = popup.querySelector("button") as HTMLButtonElement;
			if (firstButton) firstButton.focus();

			// Handle clicks outside the popup
			const remove = (e: MouseEvent) => {
				if (e.target && !popup.contains(e.target as Node)) {
					this.hideDropdown();
					window.removeEventListener("click", remove);
				}
			};

			// Add click handler immediately - the triggering click already has stopPropagation()
			window.addEventListener("click", remove);
		}

		private hideDropdown(): void {
			if (this.dropdown) {
				this.dropdown.remove();
				this.dropdown = null;
			}
		}

		update(_update: ViewUpdate) {
			// Currently just responding to decoration updates
			// Future: Could handle click events, hover events, etc.
		}

		destroy() {
			this.hideDropdown();
			this.view.dom.removeEventListener("click", this.onClick);
		}
	}
);

// Main extension that combines the state field and view plugin
export function grammarDecorationsExtension(): Extension {
	return [grammarDecorationsField, grammarDecorationsPlugin];
}

// Helper function to map grammar problems to editor positions
export function mapProblemsToPositions(
	problems: ProblemWithSentence[],
	sentences: string[],
	processedTextResult: ProcessedText
): GrammarProblemWithPosition[] {
	const result: GrammarProblemWithPosition[] = [];

	// Create a text processor instance to use the proper mapping function
	const textProcessor = new MarkdownTextProcessor();

	const extractedText = processedTextResult.extractedText;

	console.log(`🔍 DEBUG: Extracted text: "${extractedText}"`);
	console.log(
		`🔍 DEBUG: Sentences:`,
		sentences.map((s, i) => `${i}: "${s}"`)
	);

	// Process each problem
	for (const problemWithSentence of problems) {
		const sentenceIndex = problemWithSentence.sentenceIndex;
		const targetSentence = sentences[sentenceIndex];

		console.log(`🔍 DEBUG: Processing problem in sentence ${sentenceIndex}: "${targetSentence}"`);

		// Find the sentence in the extracted text
		const sentenceStartInExtracted = extractedText.indexOf(targetSentence);

		if (sentenceStartInExtracted === -1) {
			console.log(`🔍 DEBUG: Could not find sentence "${targetSentence}" in extracted text`);
			continue;
		}

		console.log(`🔍 DEBUG: Sentence found at position ${sentenceStartInExtracted} in extracted text`);

		for (const range of problemWithSentence.highlighting.always) {
			const sentenceStart = range.start;
			const sentenceEnd = range.endExclusive;

			console.log(`🔍 DEBUG: Problem range in sentence: ${sentenceStart}-${sentenceEnd}`);
			console.log(`🔍 DEBUG: Problem text: "${targetSentence.substring(sentenceStart, sentenceEnd)}"`);

			// Calculate the position in extracted text
			const extractedStart = sentenceStartInExtracted + sentenceStart;
			const extractedEnd = sentenceStartInExtracted + sentenceEnd;

			console.log(`🔍 DEBUG: Extracted range: ${extractedStart}-${extractedEnd}`);

			// Map back to original text positions using the proper mapping
			const originalStart = textProcessor.mapProcessedPositionToOriginal(extractedStart, processedTextResult);
			const originalEnd = textProcessor.mapProcessedPositionToOriginal(extractedEnd, processedTextResult);

			console.log(`🔍 DEBUG: Original range: ${originalStart}-${originalEnd}`);

			if (
				originalStart !== -1 &&
				originalEnd !== -1 &&
				originalStart < originalEnd &&
				originalStart >= 0 &&
				originalEnd >= 0
			) {
				result.push({
					problem: problemWithSentence,
					from: originalStart,
					to: originalEnd,
					sentenceIndex,
					sentenceOffset: sentenceStart,
				});
			}
		}
	}

	return result;
}
