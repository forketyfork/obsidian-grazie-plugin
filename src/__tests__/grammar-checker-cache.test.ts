import { GrammarCheckerService } from "../services/grammar-checker";
import { DEFAULT_SETTINGS, GraziePluginSettings } from "../settings/types";
import { JetBrainsAIClient } from "../jetbrains-ai";
import { AuthenticationService } from "../jetbrains-ai/auth";

const mockCheckGrammar = jest.fn(({ sentences }: { sentences: string[] }) =>
	Promise.resolve(sentences.map(s => ({ sentence: s, language: "ENGLISH", problems: [] })))
);

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

describe("GrammarCheckerService sentence cache", () => {
	let settings: GraziePluginSettings;

	beforeEach(() => {
		settings = { ...DEFAULT_SETTINGS };
		mockCheckGrammar.mockClear();
	});

	it("should reuse cached sentences", async () => {
		const service = new GrammarCheckerService(settings, mockAuthService);
		await service.initialize();

		const text = "First sentence. Second sentence.";
		await service.checkText(text);
		await service.checkText(text);

		expect(mockCheckGrammar).toHaveBeenCalledTimes(1);
	});
});
