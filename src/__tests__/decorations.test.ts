import { mapProblemsToPositions } from "../editor/decorations";
import { Problem, ProblemCategory, CorrectionServiceType, ConfidenceLevel } from "../jetbrains-ai";
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
		// The API returns positions relative to the concatenated text (sentences.join(" "))
		const concatenatedText = sentences.join(" ");
		const dirhStartInConcatenated = concatenatedText.indexOf("dirh");
		const dirhEndInConcatenated = dirhStartInConcatenated + 4;

		const problems: Problem[] = [
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
							start: dirhStartInConcatenated,
							endExclusive: dirhEndInConcatenated,
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
									start: dirhStartInConcatenated,
									endExclusive: dirhEndInConcatenated,
								},
							},
						],
					},
				],
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

		const concatenatedText = sentences.join(" ");
		const tsetStartInConcatenated = concatenatedText.indexOf("tset");
		const tsetEndInConcatenated = tsetStartInConcatenated + 4;

		const problems: Problem[] = [
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
							start: tsetStartInConcatenated,
							endExclusive: tsetEndInConcatenated,
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
									start: tsetStartInConcatenated,
									endExclusive: tsetEndInConcatenated,
								},
							},
						],
					},
				],
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

		const concatenatedText = sentences.join(" ");

		const problems: Problem[] = [
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
							start: concatenatedText.indexOf("tset"),
							endExclusive: concatenatedText.indexOf("tset") + 4,
						},
					],
					onHover: [],
				},
				fixes: [],
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
							start: concatenatedText.indexOf("dirh"),
							endExclusive: concatenatedText.indexOf("dirh") + 4,
						},
					],
					onHover: [],
				},
				fixes: [],
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
		const concatenatedText = processedSentences.join(" ");
		const dirhStartInConcatenated = concatenatedText.indexOf("dirh");
		const dirhEndInConcatenated = dirhStartInConcatenated + 4;

		const problems: Problem[] = [
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
							start: dirhStartInConcatenated,
							endExclusive: dirhEndInConcatenated,
						},
					],
					onHover: [],
				},
				fixes: [],
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
		const concatenatedText = processedSentences.join(" ");
		const dirhStartInConcatenated = concatenatedText.indexOf("dirh");
		const dirhEndInConcatenated = dirhStartInConcatenated + 4;

		const problems: Problem[] = [
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
							start: dirhStartInConcatenated,
							endExclusive: dirhEndInConcatenated,
						},
					],
					onHover: [],
				},
				fixes: [],
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
});
