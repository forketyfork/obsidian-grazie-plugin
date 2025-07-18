// CodeMirror extension that triggers grammar checks as the user types.
// It collects the changed range, expands it to sentence boundaries and
// schedules a check after a short delay.
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect, Extension } from "@codemirror/state";
import { MarkdownView } from "obsidian";
import GraziePlugin from "../main";

// Expand the changed range so that language detection and grammar checking
// receive enough context around the edit.
function expandRangeToWordBoundaries(view: EditorView, from: number, to: number): { from: number; to: number } {
	const doc = view.state.doc;
	const text = doc.toString();

	// Expand backwards to find the start of the word/sentence
	let expandedFrom = from;
	while (expandedFrom > 0) {
		const char = text[expandedFrom - 1];
		// Stop at sentence boundaries, whitespace, or start of document
		if (/[.!?]/.test(char) || /\s/.test(char)) {
			break;
		}
		expandedFrom--;
	}

	// Expand forwards to find the end of the word/sentence
	let expandedTo = to;
	while (expandedTo < text.length) {
		const char = text[expandedTo];
		// Stop at sentence boundaries, whitespace, or end of document
		if (/[.!?]/.test(char)) {
			// Include the punctuation mark
			expandedTo++;
			break;
		}
		if (/\s/.test(char)) {
			break;
		}
		expandedTo++;
	}

	// Further expand to include complete sentences if we're at word boundaries
	// This helps with context for language detection
	let sentenceFrom = expandedFrom;
	while (sentenceFrom > 0) {
		const char = text[sentenceFrom - 1];
		if (/[.!?]/.test(char)) {
			break;
		}
		sentenceFrom--;
	}

	let sentenceTo = expandedTo;
	while (sentenceTo < text.length) {
		const char = text[sentenceTo];
		if (/[.!?]/.test(char)) {
			sentenceTo++;
			break;
		}
		sentenceTo++;
	}

	// Use sentence boundaries if they don't expand too much (max 200 characters)
	const sentenceRange = sentenceTo - sentenceFrom;
	if (sentenceRange <= 200) {
		return { from: sentenceFrom, to: sentenceTo };
	}

	// Otherwise use word boundaries
	return { from: expandedFrom, to: expandedTo };
}

interface RealtimeState {
	timer: number | null;
	from: number | null;
	to: number | null;
}

const setTimer = StateEffect.define<number | null>();
const setRange = StateEffect.define<{ from: number; to: number } | null>();

// Keep track of the range that needs checking and the debounce timer.
const realtimeStateField = StateField.define<RealtimeState>({
	create() {
		return { timer: null, from: null, to: null };
	},
	update(value, tr) {
		let newValue = value;
		let hasChanges = false;

		for (const effect of tr.effects) {
			if (effect.is(setTimer)) {
				if (value.timer !== null) {
					clearTimeout(value.timer);
				}
				newValue = { ...newValue, timer: effect.value };
				hasChanges = true;
			} else if (effect.is(setRange)) {
				if (effect.value === null) {
					newValue = { ...newValue, from: null, to: null };
					hasChanges = true;
				} else {
					const { from, to } = effect.value;
					const newFrom = newValue.from === null ? from : Math.min(newValue.from, from);
					const newTo = newValue.to === null ? to : Math.max(newValue.to, to);
					newValue = { ...newValue, from: newFrom, to: newTo };
					hasChanges = true;
				}
			}
		}

		return hasChanges ? newValue : value;
	},
});

function scheduleCheck(view: EditorView, plugin: GraziePlugin): void {
	const state = view.state.field(realtimeStateField);
	if (state.timer !== null) {
		clearTimeout(state.timer);
	}

	// Don't schedule check if plugin is not enabled
	if (!plugin.settings.enabled) {
		return;
	}

	const delay = plugin.settings.checkingDelay ?? 500;
	const timer = window.setTimeout(() => {
		try {
			const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
			const cm = (activeView?.editor as any)?.cm;
			if (cm === view) {
				const st = view.state.field(realtimeStateField, false);
				if (st && st.from !== null && st.to !== null) {
					void plugin.checkRange(view, st.from, st.to);
					view.dispatch({ effects: setRange.of(null) });
				} else {
					void plugin.checkCurrentFile();
				}
			}
		} catch (error) {
			console.error("Error in scheduled grammar check:", error);
		}
	}, delay);
	view.dispatch({ effects: setTimer.of(timer) });
}

function createRealtimePlugin(plugin: GraziePlugin) {
	return ViewPlugin.define(
		view => ({
			destroy() {
				const state = view.state.field(realtimeStateField, false);
				if (state && state.timer !== null) {
					clearTimeout(state.timer);
				}
			},
			schedule() {
				scheduleCheck(view, plugin);
			},
		}),
		{}
	);
}

export function realtimeCheckExtension(plugin: GraziePlugin): Extension {
	const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
		if (update.docChanged && plugin.settings.enabled) {
			let from = Infinity;
			let to = -1;
			let hasChanges = false;

			update.changes.iterChanges((_, __, fromB, toB) => {
				from = Math.min(from, fromB);
				to = Math.max(to, toB);
				hasChanges = true;
			});

			if (hasChanges) {
				// Expand the range to include complete words/sentences
				const expandedRange = expandRangeToWordBoundaries(update.view, from, to);
				update.view.dispatch({ effects: setRange.of(expandedRange) });
				scheduleCheck(update.view, plugin);
			}
		}
	});
	return [realtimeStateField, createRealtimePlugin(plugin), updateListener];
}
