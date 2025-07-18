import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { realtimeCheckExtension } from "../editor/realtime-check";
import GraziePlugin from "../main";

describe("realtimeCheckExtension", () => {
	jest.useFakeTimers();

	function setupView() {
		const state = EditorState.create({ doc: "text" });
		const parent = document.createElement("div");
		const view = new EditorView({ state, parent });
		return view;
	}

	it("schedules grammar check on document change", () => {
		const view = setupView();
		const plugin = {
			app: {
				workspace: {
					getActiveViewOfType: jest.fn().mockReturnValue({ editor: { cm: view } }),
				},
			},
			settings: { checkingDelay: 500, enabled: true },
			checkRange: jest.fn().mockResolvedValue(undefined),
		} as unknown as GraziePlugin;

		const state = EditorState.create({
			doc: "text",
			extensions: [realtimeCheckExtension(plugin)],
		});
		view.setState(state);

		view.dispatch({ changes: { from: 0, to: 0, insert: "a" } });
		jest.advanceTimersByTime(500);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(plugin.checkRange).toHaveBeenCalledTimes(1);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(plugin.checkRange).toHaveBeenCalledWith(view, 0, 5);
	});

	it("debounces rapid changes", () => {
		const view = setupView();
		const plugin = {
			app: {
				workspace: {
					getActiveViewOfType: jest.fn().mockReturnValue({ editor: { cm: view } }),
				},
			},
			settings: { checkingDelay: 500, enabled: true },
			checkRange: jest.fn().mockResolvedValue(undefined),
		} as unknown as GraziePlugin;

		const state = EditorState.create({
			doc: "text",
			extensions: [realtimeCheckExtension(plugin)],
		});
		view.setState(state);

		view.dispatch({ changes: { from: 0, to: 0, insert: "a" } });
		jest.advanceTimersByTime(300);
		view.dispatch({ changes: { from: 1, to: 1, insert: "b" } });
		jest.advanceTimersByTime(499);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(plugin.checkRange).toHaveBeenCalledTimes(0);
		jest.advanceTimersByTime(1);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(plugin.checkRange).toHaveBeenCalledTimes(1);
	});

	it("does not schedule grammar check when plugin is disabled", () => {
		const view = setupView();
		const plugin = {
			app: {
				workspace: {
					getActiveViewOfType: jest.fn().mockReturnValue({ editor: { cm: view } }),
				},
			},
			settings: { checkingDelay: 500, enabled: false },
			checkRange: jest.fn().mockResolvedValue(undefined),
		} as unknown as GraziePlugin;

		const state = EditorState.create({
			doc: "text",
			extensions: [realtimeCheckExtension(plugin)],
		});
		view.setState(state);

		view.dispatch({ changes: { from: 0, to: 0, insert: "a" } });
		jest.advanceTimersByTime(500);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(plugin.checkRange).toHaveBeenCalledTimes(0);
	});
});
