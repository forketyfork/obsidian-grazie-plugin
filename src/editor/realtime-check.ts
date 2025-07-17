import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect, Extension } from "@codemirror/state";
import { MarkdownView } from "obsidian";
import GraziePlugin from "../main";

interface RealtimeState {
	timer: number | null;
}

const setTimer = StateEffect.define<number | null>();

const realtimeStateField = StateField.define<RealtimeState>({
	create() {
		return { timer: null };
	},
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setTimer)) {
				if (value.timer !== null) {
					clearTimeout(value.timer);
				}
				return { timer: effect.value };
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
			void plugin.checkCurrentFile();
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
			scheduleCheck(update.view, plugin);
		}
	});
	return [realtimeStateField, createRealtimePlugin(plugin), updateListener];
}
