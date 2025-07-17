import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect, Extension } from "@codemirror/state";
import { MarkdownView } from "obsidian";
import GraziePlugin from "../main";

interface RealtimeState {
	timer: number | null;
	from: number | null;
	to: number | null;
}

const setTimer = StateEffect.define<number | null>();
const setRange = StateEffect.define<{ from: number; to: number } | null>();

const realtimeStateField = StateField.define<RealtimeState>({
	create() {
		return { timer: null, from: null, to: null };
	},
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setTimer)) {
				if (value.timer !== null) {
					clearTimeout(value.timer);
				}
				value = { ...value, timer: effect.value };
			} else if (effect.is(setRange)) {
				if (effect.value === null) {
					value = { ...value, from: null, to: null };
				} else {
					const { from, to } = effect.value;
					const newFrom = value.from === null ? from : Math.min(value.from, from);
					const newTo = value.to === null ? to : Math.max(value.to, to);
					value = { ...value, from: newFrom, to: newTo };
				}
			}
		}
		return value;
	},
});

function scheduleCheck(view: EditorView, plugin: GraziePlugin): void {
	const state = view.state.field(realtimeStateField);
	if (state.timer !== null) {
		clearTimeout(state.timer);
	}
	const delay = plugin.settings.checkingDelay ?? 500;
	const timer = window.setTimeout(() => {
		const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
		const cm = (activeView?.editor as any)?.cm;
		if (cm === view) {
			const st = view.state.field(realtimeStateField);
			if (st.from !== null && st.to !== null) {
				void plugin.checkRange(view, st.from, st.to);
				view.dispatch({ effects: setRange.of(null) });
			} else {
				void plugin.checkCurrentFile();
			}
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
		if (update.docChanged) {
			let from = Infinity;
			let to = -1;
			update.changes.iterChanges((_, __, fromB, toB) => {
				from = Math.min(from, fromB);
				to = Math.max(to, toB);
			});
			update.view.dispatch({ effects: setRange.of({ from, to }) });
			scheduleCheck(update.view, plugin);
		}
	});
	return [realtimeStateField, createRealtimePlugin(plugin), updateListener];
}
