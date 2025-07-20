import { GrammarCheckerService } from "../services/grammar-checker";
import { DEFAULT_SETTINGS, GraziePluginSettings } from "../settings/types";
import { JetBrainsAIClient } from "../jetbrains-ai";
import { AuthenticationService } from "../jetbrains-ai/auth";

const mockCheckGrammar = jest.fn();

jest.mock("../jetbrains-ai", () => {
	return {
		JetBrainsAIClient: class {
			initialize = jest.fn();
			checkGrammar = mockCheckGrammar;
			constructor(..._args: unknown[]) {}
			static createWithUserToken() {
				return {
					initialize: jest.fn(),
					checkGrammar: mockCheckGrammar,
				} as unknown as JetBrainsAIClient;
			}
		},
		CorrectionServiceType: { MLEC: "MLEC", SPELL: "SPELL", RULE: "RULE" },
		ConfidenceLevel: { HIGH: "HIGH", LOW: "LOW" },
	};
});

const mockAuthService: AuthenticationService = {
	getAuthenticatedToken: () => "token",
} as unknown as AuthenticationService;

describe("Unterminated Sentences Bug Fix - Core Cases", () => {
	let settings: GraziePluginSettings;
	let service: GrammarCheckerService;

	beforeEach(() => {
		settings = { ...DEFAULT_SETTINGS };
		mockCheckGrammar.mockClear();
		service = new GrammarCheckerService(settings, mockAuthService);
	});

	test("should grammar check sentences that end with newlines but no punctuation", async () => {
		// This is the exact scenario described in the bug report
		const text =
			"This sentence has no punctuation whatsoever and ends with a newline character\nThis second sentence has proper punctuation.";

		let receivedSentences: string[] = [];
		mockCheckGrammar.mockImplementation((request: { sentences: string[] }) => {
			receivedSentences = request.sentences;
			return Promise.resolve({
				corrections: request.sentences.map(s => ({ sentence: s, language: "ENGLISH", problems: [] })),
			});
		});

		await service.initialize();
		await service.checkText(text);

		// Both sentences should be grammar checked individually
		expect(receivedSentences).toHaveLength(2);
		expect(receivedSentences).toContain(
			"This sentence has no punctuation whatsoever and ends with a newline character."
		);
		expect(receivedSentences).toContain("This second sentence has proper punctuation.");
	});

	test("should handle paragraph breaks with unterminated sentences", async () => {
		const markdown = `This is the first paragraph without any punctuation

This is the second paragraph that also lacks punctuation

This final paragraph has punctuation.`;

		let receivedSentences: string[] = [];
		mockCheckGrammar.mockImplementation((request: { sentences: string[] }) => {
			receivedSentences = request.sentences;
			return Promise.resolve({
				corrections: request.sentences.map(s => ({ sentence: s, language: "ENGLISH", problems: [] })),
			});
		});

		await service.initialize();
		await service.checkText(markdown);

		// All three paragraphs should be grammar checked
		expect(receivedSentences).toHaveLength(3);
		expect(receivedSentences).toContain("This is the first paragraph without any punctuation.");
		expect(receivedSentences).toContain("This is the second paragraph that also lacks punctuation.");
		expect(receivedSentences).toContain("This final paragraph has punctuation.");
	});

	test("should preserve normal punctuation-based sentence splitting", async () => {
		const text =
			"This sentence ends properly. This one does too! And this one as well? This one lacks punctuation completely\nBut this final one has punctuation.";

		let receivedSentences: string[] = [];
		mockCheckGrammar.mockImplementation((request: { sentences: string[] }) => {
			receivedSentences = request.sentences;
			return Promise.resolve({
				corrections: request.sentences.map(s => ({ sentence: s, language: "ENGLISH", problems: [] })),
			});
		});

		await service.initialize();
		await service.checkText(text);

		// Should detect all sentences correctly
		expect(receivedSentences).toHaveLength(5);
		expect(receivedSentences).toContain("This sentence ends properly.");
		expect(receivedSentences).toContain("This one does too!");
		expect(receivedSentences).toContain("And this one as well?");
		expect(receivedSentences).toContain("This one lacks punctuation completely.");
		expect(receivedSentences).toContain("But this final one has punctuation.");
	});

	test("should not over-split sentences with proper grammar", async () => {
		// Test that we don't create false positives with normal sentences
		const text = "JavaScript and TypeScript are programming languages. Python and Java are also popular.";

		let receivedSentences: string[] = [];
		mockCheckGrammar.mockImplementation((request: { sentences: string[] }) => {
			receivedSentences = request.sentences;
			return Promise.resolve({
				corrections: request.sentences.map(s => ({ sentence: s, language: "ENGLISH", problems: [] })),
			});
		});

		await service.initialize();
		await service.checkText(text);

		// Should not over-split - these are complete sentences
		expect(receivedSentences).toHaveLength(2);
		expect(receivedSentences).toContain("JavaScript and TypeScript are programming languages.");
		expect(receivedSentences).toContain("Python and Java are also popular.");
	});

	test("should handle the exact user reported case", async () => {
		// This is the exact case the user reported not working
		const text =
			"If a sentence doesn't have a full stop at the end, it's not being correctedd\nNow, I think I neeed to fix this bug";

		let receivedSentences: string[] = [];
		mockCheckGrammar.mockImplementation((request: { sentences: string[] }) => {
			receivedSentences = request.sentences;
			console.log("API received sentences:", receivedSentences);
			return Promise.resolve({
				corrections: request.sentences.map(s => ({ sentence: s, language: "ENGLISH", problems: [] })),
			});
		});

		await service.initialize();
		await service.checkText(text);

		// Both sentences should be detected and sent for grammar checking
		expect(receivedSentences).toHaveLength(2);
		expect(receivedSentences).toContain(
			"If a sentence doesn't have a full stop at the end, it's not being correctedd."
		);
		expect(receivedSentences).toContain("Now, I think I neeed to fix this bug.");
	});
});
