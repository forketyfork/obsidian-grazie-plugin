import { mapProblemsToPositions, GrammarProblemWithPosition, createDecorations } from "../editor/decorations";
import { Problem, ProblemCategory, CorrectionServiceType, ConfidenceLevel } from "../jetbrains-ai";
import { ProblemWithSentence } from "../services/grammar-checker";
import { MarkdownTextProcessor } from "../services/text-processor";

describe("mapProblemsToPositions", () => {
	let textProcessor: MarkdownTextProcessor;

	beforeEach(() => {
		textProcessor = new MarkdownTextProcessor();
	});

	it("should correctly map spell check problems to positions", () => {
		// Test case that reproduces the issue from the image
		const originalText = "This is a test sentence. This is another test sentence with a dirh word.";
		const processedTextResult = textProcessor.extractTextForGrammarCheck(originalText);

		// The sentences as they would be processed by the grammar checker
		const sentences = ["This is a test sentence.", "This is another test sentence with a dirh word."];

		// Mock a problem returned by the API for the word "dirh" in the second sentence
		// The API returns positions relative to the individual sentence, not concatenated text
		const secondSentence = sentences[1];
		const dirhStartInSentence = secondSentence.indexOf("dirh");
		const dirhEndInSentence = dirhStartInSentence + 4;

		const problems: ProblemWithSentence[] = [
			{
				message: "Possible spelling mistake",
				info: {
					id: { id: "spelling-error" },
					category: ProblemCategory.SPELLING,
					service: CorrectionServiceType.SPELL,
					displayName: "Spelling Error",
					confidence: ConfidenceLevel.HIGH,
				},
				highlighting: {
					always: [
						{
							start: dirhStartInSentence,
							endExclusive: dirhEndInSentence,
						},
					],
					onHover: [],
				},
				fixes: [
					{
						parts: [
							{
								type: "Change",
								text: "dirt",
								range: {
									start: dirhStartInSentence,
									endExclusive: dirhEndInSentence,
								},
							},
						],
					},
				],
				sentenceIndex: 1,
			},
		];

		const problemsWithPositions = mapProblemsToPositions(problems, sentences, processedTextResult);

		expect(problemsWithPositions).toHaveLength(1);

		const problem = problemsWithPositions[0];

		// The problem should be mapped to the correct position in the original text
		const expectedStart = originalText.indexOf("dirh");
		const expectedEnd = expectedStart + 4;

		expect(problem.from).toBe(expectedStart);
		expect(problem.to).toBe(expectedEnd);

		// Verify the highlighted text is correct
		const highlightedText = originalText.substring(problem.from, problem.to);
		expect(highlightedText).toBe("dirh");
	});

	it("should handle problems in the first sentence correctly", () => {
		const originalText = "This is a tset sentence. This is another test sentence.";
		const processedTextResult = textProcessor.extractTextForGrammarCheck(originalText);

		const sentences = ["This is a tset sentence.", "This is another test sentence."];

		// Calculate positions relative to the first sentence (sentenceIndex: 0)
		const firstSentence = sentences[0];
		const tsetStartInSentence = firstSentence.indexOf("tset");
		const tsetEndInSentence = tsetStartInSentence + 4;

		const problems: ProblemWithSentence[] = [
			{
				message: "Possible spelling mistake",
				info: {
					id: { id: "spelling-error" },
					category: ProblemCategory.SPELLING,
					service: CorrectionServiceType.SPELL,
					displayName: "Spelling Error",
					confidence: ConfidenceLevel.HIGH,
				},
				highlighting: {
					always: [
						{
							start: tsetStartInSentence,
							endExclusive: tsetEndInSentence,
						},
					],
					onHover: [],
				},
				fixes: [
					{
						parts: [
							{
								type: "Change",
								text: "test",
								range: {
									start: tsetStartInSentence,
									endExclusive: tsetEndInSentence,
								},
							},
						],
					},
				],
				sentenceIndex: 0,
			},
		];

		const problemsWithPositions = mapProblemsToPositions(problems, sentences, processedTextResult);

		expect(problemsWithPositions).toHaveLength(1);

		const problem = problemsWithPositions[0];

		// The problem should be mapped to the correct position in the original text
		const expectedStart = originalText.indexOf("tset");
		const expectedEnd = expectedStart + 4;

		expect(problem.from).toBe(expectedStart);
		expect(problem.to).toBe(expectedEnd);

		// Verify the highlighted text is correct
		const highlightedText = originalText.substring(problem.from, problem.to);
		expect(highlightedText).toBe("tset");
	});

	it("should handle multiple problems in different sentences", () => {
		const originalText = "This is a tset sentence. This is another test sentence with a dirh word.";
		const processedTextResult = textProcessor.extractTextForGrammarCheck(originalText);

		const sentences = ["This is a tset sentence.", "This is another test sentence with a dirh word."];

		// Calculate positions relative to individual sentences
		const firstSentence = sentences[0];
		const secondSentence = sentences[1];
		const tsetStartInSentence = firstSentence.indexOf("tset");
		const dirhStartInSentence = secondSentence.indexOf("dirh");

		const problems: ProblemWithSentence[] = [
			{
				message: "Possible spelling mistake",
				info: {
					id: { id: "spelling-error" },
					category: ProblemCategory.SPELLING,
					service: CorrectionServiceType.SPELL,
					displayName: "Spelling Error",
					confidence: ConfidenceLevel.HIGH,
				},
				highlighting: {
					always: [
						{
							start: tsetStartInSentence,
							endExclusive: tsetStartInSentence + 4,
						},
					],
					onHover: [],
				},
				fixes: [],
				sentenceIndex: 0,
			},
			{
				message: "Possible spelling mistake",
				info: {
					id: { id: "spelling-error" },
					category: ProblemCategory.SPELLING,
					service: CorrectionServiceType.SPELL,
					displayName: "Spelling Error",
					confidence: ConfidenceLevel.HIGH,
				},
				highlighting: {
					always: [
						{
							start: dirhStartInSentence,
							endExclusive: dirhStartInSentence + 4,
						},
					],
					onHover: [],
				},
				fixes: [],
				sentenceIndex: 1,
			},
		];

		const problemsWithPositions = mapProblemsToPositions(problems, sentences, processedTextResult);

		expect(problemsWithPositions).toHaveLength(2);

		// Check first problem (tset)
		const firstProblem = problemsWithPositions.find(p => originalText.substring(p.from, p.to) === "tset");
		expect(firstProblem).toBeDefined();
		expect(firstProblem!.from).toBe(originalText.indexOf("tset"));

		// Check second problem (dirh)
		const secondProblem = problemsWithPositions.find(p => originalText.substring(p.from, p.to) === "dirh");
		expect(secondProblem).toBeDefined();
		expect(secondProblem!.from).toBe(originalText.indexOf("dirh"));
	});

	it("should reproduce the issue with list formatting", () => {
		// Test with markdown that might cause issues with list formatting
		const originalText = "- This is a test sentence.\n- This is another test sentence with a dirh word.";
		const processedTextResult = textProcessor.extractTextForGrammarCheck(originalText);

		// Simulate real sentence splitting as done in GrammarCheckerService
		const cleanedText = textProcessor.cleanMarkdownFormatting(processedTextResult.extractedText.trim());

		const sentences: string[] = [];
		let currentSentence = "";

		for (let i = 0; i < cleanedText.length; i++) {
			const char = cleanedText[i];
			currentSentence += char;

			// Check if we're at a sentence boundary
			if (/[.!?]/.test(char)) {
				// Look ahead for whitespace and capital letter
				const nextChar = cleanedText[i + 1];
				const charAfterSpace = cleanedText[i + 2];

				if (nextChar === " " && charAfterSpace && /[A-Z]/.test(charAfterSpace)) {
					// This is a sentence boundary
					sentences.push(currentSentence.trim());
					currentSentence = "";
					i++; // Skip the space
				} else if (i === cleanedText.length - 1) {
					// This is the end of the text
					sentences.push(currentSentence.trim());
					currentSentence = "";
				}
			}
		}

		// Add any remaining text as a sentence
		if (currentSentence.trim()) {
			sentences.push(currentSentence.trim());
		}

		// Process each sentence
		const processedSentences: string[] = [];

		for (let sentence of sentences) {
			// Remove any remaining markdown formatting
			sentence = sentence
				.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
				.replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
				.replace(/~~([^~]+)~~/g, "$1")
				.trim();

			// Ensure sentence ends with proper punctuation
			if (!/[.!?]$/.test(sentence)) {
				sentence += ".";
			}

			// Only add sentences that have actual content
			if (sentence.length > 3 && /[a-zA-Z]/.test(sentence)) {
				processedSentences.push(sentence);
			}
		}

		// Test the same scenario as above but with real sentence splitting
		// Calculate position relative to the second sentence (sentenceIndex: 1)
		const secondSentence = processedSentences[1];
		const dirhStartInSentence = secondSentence.indexOf("dirh");
		const dirhEndInSentence = dirhStartInSentence + 4;

		const problems: ProblemWithSentence[] = [
			{
				message: "Possible spelling mistake",
				info: {
					id: { id: "spelling-error" },
					category: ProblemCategory.SPELLING,
					service: CorrectionServiceType.SPELL,
					displayName: "Spelling Error",
					confidence: ConfidenceLevel.HIGH,
				},
				highlighting: {
					always: [
						{
							start: dirhStartInSentence,
							endExclusive: dirhEndInSentence,
						},
					],
					onHover: [],
				},
				fixes: [],
				sentenceIndex: 1,
			},
		];

		const problemsWithPositions = mapProblemsToPositions(problems, processedSentences, processedTextResult);

		expect(problemsWithPositions).toHaveLength(1);

		const problem = problemsWithPositions[0];

		// The problem should be mapped to the correct position in the original text
		const expectedStart = originalText.indexOf("dirh");
		const expectedEnd = expectedStart + 4;

		expect(problem.from).toBe(expectedStart);
		expect(problem.to).toBe(expectedEnd);

		// Verify the highlighted text is correct
		const highlightedText = originalText.substring(problem.from, problem.to);
		expect(highlightedText).toBe("dirh");
	});

	it("should handle German text with line breaks", () => {
		const originalText = "Guten Tag, wie geht es dir?\nMir geht es gut, und dirh?";
		const processedTextResult = textProcessor.extractTextForGrammarCheck(originalText);

		// Simulate real sentence splitting as done in GrammarCheckerService
		const cleanedText = textProcessor.cleanMarkdownFormatting(processedTextResult.extractedText.trim());

		const sentences: string[] = [];
		let currentSentence = "";

		for (let i = 0; i < cleanedText.length; i++) {
			const char = cleanedText[i];
			currentSentence += char;

			// Check if we're at a sentence boundary
			if (/[.!?]/.test(char)) {
				// Look ahead for whitespace and capital letter
				const nextChar = cleanedText[i + 1];
				const charAfterSpace = cleanedText[i + 2];

				if (nextChar === " " && charAfterSpace && /[A-Z]/.test(charAfterSpace)) {
					// This is a sentence boundary
					sentences.push(currentSentence.trim());
					currentSentence = "";
					i++; // Skip the space
				} else if (i === cleanedText.length - 1) {
					// This is the end of the text
					sentences.push(currentSentence.trim());
					currentSentence = "";
				}
			}
		}

		// Add any remaining text as a sentence
		if (currentSentence.trim()) {
			sentences.push(currentSentence.trim());
		}

		// Process each sentence
		const processedSentences: string[] = [];

		for (let sentence of sentences) {
			// Remove any remaining markdown formatting
			sentence = sentence
				.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
				.replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
				.replace(/~~([^~]+)~~/g, "$1")
				.trim();

			// Ensure sentence ends with proper punctuation
			if (!/[.!?]$/.test(sentence)) {
				sentence += ".";
			}

			// Only add sentences that have actual content
			if (sentence.length > 3 && /[a-zA-Z]/.test(sentence)) {
				processedSentences.push(sentence);
			}
		}

		// Test the same scenario as above but with real sentence splitting
		// Calculate position relative to the second sentence (sentenceIndex: 1)
		const secondSentence = processedSentences[1];
		const dirhStartInSentence = secondSentence.indexOf("dirh");
		const dirhEndInSentence = dirhStartInSentence + 4;

		const problems: ProblemWithSentence[] = [
			{
				message: "Possible spelling mistake",
				info: {
					id: { id: "spelling-error" },
					category: ProblemCategory.SPELLING,
					service: CorrectionServiceType.SPELL,
					displayName: "Spelling Error",
					confidence: ConfidenceLevel.HIGH,
				},
				highlighting: {
					always: [
						{
							start: dirhStartInSentence,
							endExclusive: dirhEndInSentence,
						},
					],
					onHover: [],
				},
				fixes: [],
				sentenceIndex: 1,
			},
		];

		const problemsWithPositions = mapProblemsToPositions(problems, processedSentences, processedTextResult);

		expect(problemsWithPositions).toHaveLength(1);

		const problem = problemsWithPositions[0];

		// The problem should be mapped to the correct position in the original text
		const expectedStart = originalText.indexOf("dirh");
		const expectedEnd = expectedStart + 4;

		expect(problem.from).toBe(expectedStart);
		expect(problem.to).toBe(expectedEnd);

		// Verify the highlighted text is correct
		const highlightedText = originalText.substring(problem.from, problem.to);
		expect(highlightedText).toBe("dirh");
	});

	it("should handle extra spaces correctly - reproduces highlighting slide bug", () => {
		// Test the exact scenario described by the user
		const originalText = "Hello  my firend?";
		const processedTextResult = textProcessor.extractTextForGrammarCheck(originalText);

		// The extracted text will have normalized whitespace: "Hello my firend?"

		// Simulate the sentence that would be processed (single sentence)
		const sentences = ["Hello my firend?"];

		// The problem should be on "firend" which is at position 9 in the sentence
		const sentenceText = sentences[0];
		const firendStartInSentence = sentenceText.indexOf("firend");
		const firendEndInSentence = firendStartInSentence + 6;

		const problems: ProblemWithSentence[] = [
			{
				message: "Possible spelling mistake",
				info: {
					id: { id: "spelling-error" },
					category: ProblemCategory.SPELLING,
					service: CorrectionServiceType.SPELL,
					displayName: "Spelling Error",
					confidence: ConfidenceLevel.HIGH,
				},
				highlighting: {
					always: [
						{
							start: firendStartInSentence,
							endExclusive: firendEndInSentence,
						},
					],
					onHover: [],
				},
				fixes: [],
				sentenceIndex: 0,
			},
		];

		const problemsWithPositions = mapProblemsToPositions(problems, sentences, processedTextResult);

		expect(problemsWithPositions).toHaveLength(1);

		const problem = problemsWithPositions[0];

		// The problem should be mapped to the correct position in the original text
		// "firend" should be at position 9 in the original text "Hello  my firend?"
		const expectedStart = originalText.indexOf("firend");
		const expectedEnd = expectedStart + 6;

		expect(problem.from).toBe(expectedStart);
		expect(problem.to).toBe(expectedEnd);

		// Verify the highlighted text is correct
		const highlightedText = originalText.substring(problem.from, problem.to);
		expect(highlightedText).toBe("firend");
	});

	it("should handle extra spaces before highlighted word - reproduces highlighting slide bug", () => {
		// Test the scenario with spaces before the highlighted word
		const originalText = "Hello my  firend?";
		const processedTextResult = textProcessor.extractTextForGrammarCheck(originalText);

		// The extracted text will have normalized whitespace: "Hello my firend?"

		// Simulate the sentence that would be processed (single sentence)
		const sentences = ["Hello my firend?"];

		// The problem should be on "firend" which is at position 9 in the sentence
		const sentenceText = sentences[0];
		const firendStartInSentence = sentenceText.indexOf("firend");
		const firendEndInSentence = firendStartInSentence + 6;

		const problems: ProblemWithSentence[] = [
			{
				message: "Possible spelling mistake",
				info: {
					id: { id: "spelling-error" },
					category: ProblemCategory.SPELLING,
					service: CorrectionServiceType.SPELL,
					displayName: "Spelling Error",
					confidence: ConfidenceLevel.HIGH,
				},
				highlighting: {
					always: [
						{
							start: firendStartInSentence,
							endExclusive: firendEndInSentence,
						},
					],
					onHover: [],
				},
				fixes: [],
				sentenceIndex: 0,
			},
		];

		const problemsWithPositions = mapProblemsToPositions(problems, sentences, processedTextResult);

		expect(problemsWithPositions).toHaveLength(1);

		const problem = problemsWithPositions[0];

		// The problem should be mapped to the correct position in the original text
		// "firend" should be at position 10 in the original text "Hello my  firend?"
		const expectedStart = originalText.indexOf("firend");
		const expectedEnd = expectedStart + 6;

		expect(problem.from).toBe(expectedStart);
		expect(problem.to).toBe(expectedEnd);

		// Verify the highlighted text is correct
		const highlightedText = originalText.substring(problem.from, problem.to);
		expect(highlightedText).toBe("firend");
	});

	it("should handle multiple types of extra spaces", () => {
		// Test multiple scenarios with different space patterns
		const testCases = [
			{
				name: "spaces after words",
				originalText: "Hello  my firend?",
				word: "firend",
			},
			{
				name: "spaces before words",
				originalText: "Hello my  firend?",
				word: "firend",
			},
			{
				name: "spaces around words",
				originalText: "Hello  my  firend?",
				word: "firend",
			},
			{
				name: "multiple spaces",
				originalText: "Hello   my   firend?",
				word: "firend",
			},
			{
				name: "leading spaces",
				originalText: "  Hello my firend?",
				word: "firend",
			},
		];

		testCases.forEach(({ originalText, word }) => {
			const processedTextResult = textProcessor.extractTextForGrammarCheck(originalText);
			const sentences = [processedTextResult.extractedText];

			const sentenceText = sentences[0];
			const wordStartInSentence = sentenceText.indexOf(word);
			const wordEndInSentence = wordStartInSentence + word.length;

			const problems: ProblemWithSentence[] = [
				{
					message: "Possible spelling mistake",
					info: {
						id: { id: "spelling-error" },
						category: ProblemCategory.SPELLING,
						service: CorrectionServiceType.SPELL,
						displayName: "Spelling Error",
						confidence: ConfidenceLevel.HIGH,
					},
					highlighting: {
						always: [
							{
								start: wordStartInSentence,
								endExclusive: wordEndInSentence,
							},
						],
						onHover: [],
					},
					fixes: [],
					sentenceIndex: 0,
				},
			];

			const problemsWithPositions = mapProblemsToPositions(problems, sentences, processedTextResult);

			expect(problemsWithPositions).toHaveLength(1);

			const problem = problemsWithPositions[0];

			// The problem should be mapped to the correct position in the original text
			const expectedStart = originalText.indexOf(word);
			const expectedEnd = expectedStart + word.length;

			// Verify the highlighted text is correct
			const highlightedText = originalText.substring(problem.from, problem.to);
			expect(highlightedText).toBe(word);
			expect(problem.from).toBe(expectedStart);
			expect(problem.to).toBe(expectedEnd);
		});
	});
});

describe("createDecorations", () => {
	const mockProblem: Problem = {
		message: "Test error",
		info: {
			id: { id: "test-error" },
			category: ProblemCategory.SPELLING,
			service: CorrectionServiceType.SPELL,
			displayName: "Test Error",
			confidence: ConfidenceLevel.HIGH,
		},
		highlighting: {
			always: [{ start: 0, endExclusive: 5 }],
			onHover: [],
		},
		fixes: [],
	};

	it("should filter out invalid ranges", () => {
		const problems: GrammarProblemWithPosition[] = [
			{
				problem: mockProblem,
				from: 0,
				to: 0, // Empty range
				sentenceIndex: 0,
				sentenceOffset: 0,
			},
			{
				problem: mockProblem,
				from: -1,
				to: 5, // Negative start
				sentenceIndex: 0,
				sentenceOffset: 0,
			},
			{
				problem: mockProblem,
				from: 5,
				to: 3, // Invalid range (to < from)
				sentenceIndex: 0,
				sentenceOffset: 0,
			},
			{
				problem: mockProblem,
				from: 0,
				to: 5, // Valid range
				sentenceIndex: 0,
				sentenceOffset: 0,
			},
		];

		const decorations = createDecorations(problems);
		expect(decorations.size).toBe(1); // Only the valid range should create a decoration
	});

	it("should handle empty problems array", () => {
		const problems: GrammarProblemWithPosition[] = [];
		const decorations = createDecorations(problems);
		expect(decorations.size).toBe(0);
	});

	it("should filter out all invalid ranges", () => {
		const problems: GrammarProblemWithPosition[] = [
			{
				problem: mockProblem,
				from: 0,
				to: 0, // Empty range
				sentenceIndex: 0,
				sentenceOffset: 0,
			},
			{
				problem: mockProblem,
				from: -1,
				to: 5, // Negative start
				sentenceIndex: 0,
				sentenceOffset: 0,
			},
			{
				problem: mockProblem,
				from: 5,
				to: 3, // Invalid range (to < from)
				sentenceIndex: 0,
				sentenceOffset: 0,
			},
		];

		const decorations = createDecorations(problems);
		expect(decorations.size).toBe(0); // No valid ranges should create decorations
	});
});
