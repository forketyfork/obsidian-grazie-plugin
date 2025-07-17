import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect, Extension, Transaction } from "@codemirror/state";
import { Problem, ProblemCategory, CorrectionServiceType, ConfidenceLevel } from "../jetbrains-ai";
import { MarkdownTextProcessor, ProcessedText } from "../services/text-processor";

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
			newProblems = newProblems.map(problemWithPos => ({
				...problemWithPos,
				from: transaction.changes.mapPos(problemWithPos.from),
				to: transaction.changes.mapPos(problemWithPos.to),
			}));
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
function createDecorations(problems: GrammarProblemWithPosition[]): DecorationSet {
	const decorations = problems.map(problemWithPos => {
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

// View plugin for handling grammar decorations
export const grammarDecorationsPlugin = ViewPlugin.fromClass(
	class {
		constructor(readonly view: EditorView) {}

		update(_update: ViewUpdate) {
			// Currently just responding to decoration updates
			// Future: Could handle click events, hover events, etc.
		}

		destroy() {
			// Cleanup if needed
		}
	}
);

// Main extension that combines the state field and view plugin
export function grammarDecorationsExtension(): Extension {
	return [grammarDecorationsField, grammarDecorationsPlugin];
}

// Helper function to map grammar problems to editor positions
export function mapProblemsToPositions(
	problems: Problem[],
	sentences: string[],
	processedTextResult: ProcessedText
): GrammarProblemWithPosition[] {
	const result: GrammarProblemWithPosition[] = [];

	// Create a text processor instance to use the proper mapping function
	const textProcessor = new MarkdownTextProcessor();

	// The API returns problems with positions relative to the concatenated text (sentences.join(" "))

	// Now we need to map positions in the concatenated text back to positions in the extracted text
	// The API returns problems with positions relative to the concatenated text
	for (const problem of problems) {
		for (const range of problem.highlighting.always) {
			const concatenatedStart = range.start;
			const concatenatedEnd = range.endExclusive;

			// Find which sentence this problem belongs to
			let sentenceIndex = -1;
			let sentenceOffset = 0;
			let currentOffset = 0;

			for (let i = 0; i < sentences.length; i++) {
				const sentence = sentences[i];
				if (concatenatedStart >= currentOffset && concatenatedStart < currentOffset + sentence.length) {
					sentenceIndex = i;
					sentenceOffset = concatenatedStart - currentOffset;
					break;
				}
				currentOffset += sentence.length + 1; // +1 for space separator
			}

			if (sentenceIndex === -1) {
				continue; // Skip problematic mapping
			}

			// Now map the sentence-relative positions back to the original extracted text
			// We need to account for the fact that sentences were created by cleaning the extracted text
			const extractedText = processedTextResult.extractedText;
			const cleanedExtractedText = textProcessor.cleanMarkdownFormatting(extractedText);

			// Find the sentence in the cleaned extracted text
			let cleanedSentenceStart = -1;
			let searchStart = 0;

			// Try to find the sentence in the cleaned extracted text
			for (let i = 0; i <= sentenceIndex; i++) {
				const currentSentence = sentences[i];
				const foundIndex = cleanedExtractedText.indexOf(currentSentence, searchStart);
				if (foundIndex !== -1) {
					if (i === sentenceIndex) {
						cleanedSentenceStart = foundIndex;
						break;
					}
					searchStart = foundIndex + currentSentence.length;
				}
			}

			if (cleanedSentenceStart === -1) {
				continue; // Skip if sentence not found in cleaned extracted text
			}

			// Calculate positions in the cleaned extracted text
			const cleanedStart = cleanedSentenceStart + sentenceOffset;
			const cleanedEnd = cleanedStart + (concatenatedEnd - concatenatedStart);

			// Map from cleaned positions back to original extracted text positions
			const extractedStart = mapCleanedPositionToOriginal(cleanedStart, extractedText, cleanedExtractedText);
			const extractedEnd = mapCleanedPositionToOriginal(cleanedEnd, extractedText, cleanedExtractedText);

			// Map back to original text positions using the proper mapping
			const originalStart = textProcessor.mapProcessedPositionToOriginal(extractedStart, processedTextResult);
			const originalEnd = textProcessor.mapProcessedPositionToOriginal(extractedEnd, processedTextResult);

			if (originalStart !== -1 && originalEnd !== -1 && originalStart < originalEnd) {
				result.push({
					problem,
					from: originalStart,
					to: originalEnd,
					sentenceIndex,
					sentenceOffset,
				});
			}
		}
	}

	return result;
}

// Helper function to map positions from cleaned text back to original text
function mapCleanedPositionToOriginal(cleanedPos: number, originalText: string, _cleanedText: string): number {
	// For this specific issue, we need to handle the fact that cleanMarkdownFormatting
	// removes list markers that appear both at the beginning and after spaces

	// Count the number of removed characters before the target position
	let removedChars = 0;

	// Find list markers at the beginning
	const beginningMatch = originalText.match(/^(\s*)([-*+]|\d+\.)\s+/);
	if (beginningMatch) {
		removedChars += beginningMatch[0].length;
	}

	// Find list markers after spaces
	const spaceMarkerRegex = /\s+([-*+]|\d+\.)\s+/g;
	let match;
	while ((match = spaceMarkerRegex.exec(originalText)) !== null) {
		// Check if this marker appears before our target position
		if (match.index <= cleanedPos + removedChars) {
			// We found a list marker that was removed, account for it
			removedChars += match[0].length - 1; // -1 because we keep the first space
		}
	}

	return cleanedPos + removedChars;
}
