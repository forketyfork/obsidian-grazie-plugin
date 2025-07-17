import { MarkdownTextProcessor } from "../services/text-processor";

describe("MarkdownTextProcessor", () => {
	let processor: MarkdownTextProcessor;

	beforeEach(() => {
		processor = new MarkdownTextProcessor();
	});

	describe("extractTextForGrammarCheck", () => {
		it("should extract simple text without exclusions", () => {
			const markdown = "This is a simple sentence. This is another sentence.";
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("This is a simple sentence. This is another sentence.");
			expect(result.exclusions).toHaveLength(0);
			expect(result.segments).toHaveLength(1);
			expect(result.segments[0].isExcluded).toBe(false);
		});

		it("should exclude fenced code blocks", () => {
			const markdown = "Before code.\n```typescript\nconst x = 1;\n```\nAfter code.";
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("Before code. After code.");
			expect(result.exclusions).toHaveLength(1);
			expect(result.exclusions[0].type).toBe("code_block");
			// The regex should match the entire code block
			expect(result.exclusions[0].originalText).toContain("```typescript");
			expect(result.exclusions[0].originalText).toContain("const x = 1;");
		});

		it("should exclude inline code", () => {
			const markdown = "Use the `console.log()` function to debug.";
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("Use the function to debug.");
			expect(result.exclusions).toHaveLength(1);
			expect(result.exclusions[0].type).toBe("inline_code");
			expect(result.exclusions[0].originalText).toBe("`console.log()`");
		});

		it("should exclude markdown links", () => {
			const markdown = "Visit [Google](https://google.com) for search.";
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("Visit for search.");
			expect(result.exclusions).toHaveLength(1);
			expect(result.exclusions[0].type).toBe("link");
			expect(result.exclusions[0].originalText).toBe("[Google](https://google.com)");
		});

		it("should exclude markdown images", () => {
			const markdown = "Here is an image: ![alt text](image.jpg) and more text.";
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("Here is an image: and more text.");
			expect(result.exclusions).toHaveLength(1);
			expect(result.exclusions[0].type).toBe("image");
			expect(result.exclusions[0].originalText).toBe("![alt text](image.jpg)");
		});

		it("should exclude HTML tags", () => {
			const markdown = 'This is <span class="highlight">highlighted</span> text.';
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("This is highlighted text.");
			expect(result.exclusions).toHaveLength(2);
			expect(result.exclusions[0].type).toBe("html_tag");
			expect(result.exclusions[1].type).toBe("html_tag");
		});

		it("should exclude frontmatter", () => {
			const markdown = "---\ntitle: Test\nauthor: John\n---\n\nThis is content.";
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("This is content.");
			expect(result.exclusions).toHaveLength(1);
			expect(result.exclusions[0].type).toBe("frontmatter");
			expect(result.exclusions[0].originalText).toBe("---\ntitle: Test\nauthor: John\n---");
		});

		it("should exclude math blocks", () => {
			const markdown = "The formula is $$E = mc^2$$ and inline math $x + y = z$.";
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("The formula is and inline math .");
			expect(result.exclusions).toHaveLength(2);
			expect(result.exclusions[0].type).toBe("math");
			expect(result.exclusions[1].type).toBe("math");
		});

		it("should handle complex markdown with multiple exclusions", () => {
			const markdown = `# Header

This is a paragraph with \`inline code\` and [a link](https://example.com).

\`\`\`javascript
const code = "block";
\`\`\`

Another paragraph with ![image](img.jpg) and more text.`;

			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("This is a paragraph with and . Another paragraph with and more text.");
			expect(result.exclusions.length).toBeGreaterThan(3);
			// Check that header is excluded
			expect(result.exclusions.some(e => e.type === "header")).toBe(true);
		});

		it("should merge overlapping exclusions", () => {
			const markdown = "Text with `code` and `more code` together.";
			const result = processor.extractTextForGrammarCheck(markdown);

			expect(result.extractedText).toBe("Text with and together.");
			expect(result.exclusions).toHaveLength(2);
		});
	});

	describe("cleanMarkdownFormatting", () => {
		it("should remove headers", () => {
			const text = "# Header 1\n## Header 2\nContent";
			const result = processor.cleanMarkdownFormatting(text);

			expect(result).toBe("Header 1\nHeader 2\nContent");
		});

		it("should remove bold and italic formatting", () => {
			const text = "This is **bold** and *italic* text.";
			const result = processor.cleanMarkdownFormatting(text);

			expect(result).toBe("This is bold and italic text.");
		});

		it("should remove strikethrough", () => {
			const text = "This is ~~strikethrough~~ text.";
			const result = processor.cleanMarkdownFormatting(text);

			expect(result).toBe("This is strikethrough text.");
		});

		it("should remove blockquotes", () => {
			const text = "> This is a quote\n> with multiple lines";
			const result = processor.cleanMarkdownFormatting(text);

			expect(result).toBe("This is a quote\nwith multiple lines");
		});

		it("should remove list markers", () => {
			const text = "- Item 1\n- Item 2\n1. Numbered item";
			const result = processor.cleanMarkdownFormatting(text);

			expect(result).toBe("Item 1\nItem 2\nNumbered item");
		});
	});

	describe("mapProcessedPositionToOriginal", () => {
		it("should map positions correctly in simple text", () => {
			const markdown = "This is a test sentence.";
			const processed = processor.extractTextForGrammarCheck(markdown);

			const originalPos = processor.mapProcessedPositionToOriginal(5, processed);
			expect(originalPos).toBe(5);
		});

		it("should map positions correctly with exclusions", () => {
			const markdown = "Before `code` after.";
			const processed = processor.extractTextForGrammarCheck(markdown);

			// Processed text: "Before after." (14 characters)
			// Original text: "Before `code` after." (20 characters)

			// Position 0 should map to position 0
			const originalPos1 = processor.mapProcessedPositionToOriginal(0, processed);
			expect(originalPos1).toBe(0);

			// Position 6 (end of "Before") should map to position 6 in original
			const originalPos2 = processor.mapProcessedPositionToOriginal(6, processed);
			expect(originalPos2).toBe(6);

			// The function should handle positions beyond the processed text
			const originalPos3 = processor.mapProcessedPositionToOriginal(100, processed);
			expect(originalPos3).toBeGreaterThan(0);
		});
	});
});

// Integration tests for GrammarCheckerService would go here
// but they require API tokens and actual HTTP requests
// For now, we focus on unit tests for the text processor
