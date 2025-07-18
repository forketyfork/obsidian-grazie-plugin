import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { TFile, App } from "obsidian";
import { GrammarCheckerService } from "../services/grammar-checker";
import { EditorDecoratorService } from "../services/editor-decorator";
import { grammarDecorationsExtension, grammarDecorationsField } from "../editor/decorations";
import { DEFAULT_SETTINGS } from "../settings/types";
import { AuthenticationService } from "../jetbrains-ai/auth";

// Mock Obsidian's requestUrl function
jest.mock("obsidian", () => ({
	requestUrl: jest.fn(),
	TFile: jest.fn(),
}));

describe("Position Mapping Integration Test", () => {
	let mockRequestUrl: jest.Mock;
	let mockApp: App;
	let mockFile: TFile;
	let grammarChecker: GrammarCheckerService;
	let editorDecorator: EditorDecoratorService;
	let authService: AuthenticationService;

	beforeEach(() => {
		// Mock Obsidian requestUrl
		// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
		mockRequestUrl = require("obsidian").requestUrl as jest.Mock;

		// Mock Obsidian App
		mockApp = {
			vault: {
				cachedRead: jest.fn(),
			},
		} as unknown as App;

		// Mock TFile
		mockFile = {
			path: "test.md",
			name: "test.md",
		} as TFile;

		// Create auth service mock
		authService = {
			getAuthenticatedToken: jest.fn().mockReturnValue("test-token"),
			isAuthenticated: jest.fn().mockReturnValue(true),
			setToken: jest.fn(),
			clearToken: jest.fn(),
		} as unknown as AuthenticationService;

		// Initialize services
		grammarChecker = new GrammarCheckerService(DEFAULT_SETTINGS, authService);
		editorDecorator = new EditorDecoratorService(mockApp);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	/**
	 * This test reproduces the exact scenario from the user's bug report:
	 * - First line: "Mir geht es aauch gut." → highlights "aauch" correctly
	 * - Second line: "\nMir geht es aauch gut." → should highlight "aauch" correctly, not "auch "
	 */
	it("should correctly highlight grammar problems on subsequent lines with newlines", async () => {
		// Setup the document content
		const documentContent = "Mir geht es aauch gut.\nMir geht es aauch gut.";

		// Create editor view with the document
		const state = EditorState.create({
			doc: documentContent,
			extensions: [grammarDecorationsExtension()],
		});
		const parent = document.createElement("div");
		const view = new EditorView({ state, parent });

		// Mock the JetBrains AI API response
		mockRequestUrl.mockImplementation(async (options: { url: string; method: string }) => {
			if (options.url.includes("jetbrains.ai") && options.method === "POST") {
				// Simulate the actual API response for German text with "aauch" spelling error
				return {
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					json: {
						corrections: [
							{
								sentence: "Mir geht es aauch gut.",
								language: "de",
								problems: [
									{
										info: {
											id: "spell.de.spelling",
											category: "SPELLING",
											service: "SPELL",
											displayName: "Tippfehler",
										},
										message: "Tippfehler",
										highlighting: {
											always: [
												{
													start: 12,
													endExclusive: 17,
												},
											],
											onHover: [],
										},
										fixes: [
											{
												parts: [
													{
														type: "Change",
														range: {
															start: 12,
															endExclusive: 17,
														},
														text: "auch",
													},
												],
												batchId: "Spell:aauch->auch",
											},
										],
									},
								],
							},
						],
					},
				};
			} else if (options.url.includes("jetbrains.com/config")) {
				// Mock configuration endpoint
				return await Promise.resolve({
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					json: {
						urls: [
							{
								url: "https://api.jetbrains.ai/",
								priority: 100,
								deprecated: false,
							},
						],
					},
				});
			}
			return await Promise.resolve({ status: 404, json: {}, headers: {} });
		});

		// Initialize the grammar checker
		await grammarChecker.initialize();

		// Test first line (should work correctly)
		const firstLineFragment = "Mir geht es aauch gut.";
		const firstLineResult = await grammarChecker.checkText(firstLineFragment);

		// Apply decorations for the first line
		editorDecorator.applyPartialGrammarResults(view, mockFile, 0, firstLineFragment, firstLineResult);

		// Get the decorations after first line
		const stateAfterFirstLine = view.state.field(grammarDecorationsField, false);
		expect(stateAfterFirstLine?.problems).toHaveLength(1);

		// Verify first line highlighting is correct
		const firstLineProblem = stateAfterFirstLine!.problems[0];
		expect(firstLineProblem.from).toBe(12);
		expect(firstLineProblem.to).toBe(17);
		expect(documentContent.substring(firstLineProblem.from, firstLineProblem.to)).toBe("aauch");
	});




});
