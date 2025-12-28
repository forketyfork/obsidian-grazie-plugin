// Utility types and helper for extracting grammar-checkable text from a
// markdown document and mapping positions back to the original source.
export interface TextSegment {
	text: string;
	originalPosition: number;
	originalLength: number;
	isExcluded: boolean;
}

export interface ProcessedText {
	segments: TextSegment[];
	extractedText: string;
	exclusions: TextExclusion[];
}

export interface TextExclusion {
	start: number;
	end: number;
	type: "code_block" | "inline_code" | "link" | "image" | "html_tag" | "frontmatter" | "math" | "header";
	originalText: string;
}

export class MarkdownTextProcessor {
	/**
	 * Process markdown text and extract only the text that should be grammar checked,
	 * excluding code blocks, inline code, links, images, etc.
	 */
	extractTextForGrammarCheck(markdown: string): ProcessedText {
		const exclusions: TextExclusion[] = [];

		// Find all exclusions in the markdown
		// Order matters: find images before links to avoid conflicts
		this.findCodeBlocks(markdown, exclusions);
		this.findInlineCode(markdown, exclusions);
		this.findFrontmatter(markdown, exclusions);
		this.findMathBlocks(markdown, exclusions);
		this.findImages(markdown, exclusions);
		this.findLinks(markdown, exclusions);
		this.findHtmlTags(markdown, exclusions);
		this.findHeaders(markdown, exclusions);

		// Sort exclusions by start position
		exclusions.sort((a, b) => a.start - b.start);

		// Merge overlapping exclusions
		const mergedExclusions = this.mergeOverlappingExclusions(exclusions);

		// Create segments and extract text
		const segments = this.createSegments(markdown, mergedExclusions);
		const extractedText = segments
			.filter(segment => !segment.isExcluded)
			.map(segment => segment.text)
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();

		return {
			segments,
			extractedText,
			exclusions: mergedExclusions,
		};
	}

	private findCodeBlocks(text: string, exclusions: TextExclusion[]): void {
		// Find fenced code blocks (``` or ~~~)
		const fencedCodeRegex = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
		let match: RegExpExecArray | null;

		while ((match = fencedCodeRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "code_block",
				originalText: match[0],
			});
		}

		// Find indented code blocks (4+ spaces or 1+ tabs at start of line)
		const indentedCodeRegex = /^([ ]{4}|\t).*$/gm;
		while ((match = indentedCodeRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "code_block",
				originalText: match[0],
			});
		}
	}

	private findInlineCode(text: string, exclusions: TextExclusion[]): void {
		// Find inline code (`code` or ``code``)
		const inlineCodeRegex = /`{1,2}[^`\n]*`{1,2}/g;
		let match: RegExpExecArray | null;

		while ((match = inlineCodeRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "inline_code",
				originalText: match[0],
			});
		}
	}

	private findLinks(text: string, exclusions: TextExclusion[]): void {
		// Find markdown links [text](url) and reference links [text][ref]
		// But NOT images that start with !
		const linkRegex = /(?<!!)\[([^\]]*)\]\(([^)]*)\)|\[([^\]]*)\]\[([^\]]*)\]/g;
		let match: RegExpExecArray | null;

		while ((match = linkRegex.exec(text)) !== null) {
			// Check if this overlaps with an existing exclusion (like an image)
			const overlaps = exclusions.some(
				exclusion => match!.index < exclusion.end && match!.index + match![0].length > exclusion.start
			);

			if (!overlaps) {
				exclusions.push({
					start: match.index,
					end: match.index + match[0].length,
					type: "link",
					originalText: match[0],
				});
			}
		}

		// Find autolinks <url>
		const autolinkRegex = /<https?:\/\/[^>]+>/g;
		while ((match = autolinkRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "link",
				originalText: match[0],
			});
		}
	}

	private findImages(text: string, exclusions: TextExclusion[]): void {
		// Find markdown images ![alt](url)
		const imageRegex = /!\[([^\]]*)\]\(([^)]*)\)/g;
		let match: RegExpExecArray | null;

		while ((match = imageRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "image",
				originalText: match[0],
			});
		}
	}

	private findHtmlTags(text: string, exclusions: TextExclusion[]): void {
		// Find HTML tags <tag>...</tag> and self-closing tags <tag/>
		const htmlTagRegex = /<[^>]+>/g;
		let match: RegExpExecArray | null;

		while ((match = htmlTagRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "html_tag",
				originalText: match[0],
			});
		}
	}

	private findFrontmatter(text: string, exclusions: TextExclusion[]): void {
		// Find YAML frontmatter at the beginning of the document
		const frontmatterRegex = /^---[\s\S]*?^---/m;
		const match = frontmatterRegex.exec(text);

		// eslint-disable-next-line @typescript-eslint/prefer-optional-chain
		if (match != null && match.index === 0) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "frontmatter",
				originalText: match[0],
			});
		}
	}

	private findMathBlocks(text: string, exclusions: TextExclusion[]): void {
		// Find LaTeX math blocks $$...$$
		const mathBlockRegex = /\$\$[\s\S]*?\$\$/g;
		let match: RegExpExecArray | null;

		while ((match = mathBlockRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "math",
				originalText: match[0],
			});
		}

		// Find inline math $...$
		const inlineMathRegex = /\$[^$\n]*\$/g;
		while ((match = inlineMathRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "math",
				originalText: match[0],
			});
		}
	}

	private findHeaders(text: string, exclusions: TextExclusion[]): void {
		// Find markdown headers (# Header)
		const headerRegex = /^#{1,6}\s+.*$/gm;
		let match: RegExpExecArray | null;

		while ((match = headerRegex.exec(text)) !== null) {
			exclusions.push({
				start: match.index,
				end: match.index + match[0].length,
				type: "header",
				originalText: match[0],
			});
		}
	}

	private mergeOverlappingExclusions(exclusions: TextExclusion[]): TextExclusion[] {
		if (exclusions.length === 0) return [];

		const merged: TextExclusion[] = [];
		let current = exclusions[0];

		for (let i = 1; i < exclusions.length; i++) {
			const next = exclusions[i];

			if (current.end >= next.start) {
				// Overlapping or adjacent exclusions - merge them
				current = {
					start: current.start,
					end: Math.max(current.end, next.end),
					type: current.type, // Keep the type of the first exclusion
					originalText: current.originalText + next.originalText,
				};
			} else {
				// Non-overlapping exclusion - add current to merged and continue with next
				merged.push(current);
				current = next;
			}
		}

		merged.push(current);
		return merged;
	}

	private createSegments(text: string, exclusions: TextExclusion[]): TextSegment[] {
		const segments: TextSegment[] = [];
		let currentPosition = 0;

		for (const exclusion of exclusions) {
			// Add text before the exclusion
			if (currentPosition < exclusion.start) {
				const segmentText = text.substring(currentPosition, exclusion.start);
				segments.push({
					text: segmentText,
					originalPosition: currentPosition,
					originalLength: segmentText.length,
					isExcluded: false,
				});
			}

			// Add the excluded segment
			segments.push({
				text: exclusion.originalText,
				originalPosition: exclusion.start,
				originalLength: exclusion.end - exclusion.start,
				isExcluded: true,
			});

			currentPosition = exclusion.end;
		}

		// Add remaining text after the last exclusion
		if (currentPosition < text.length) {
			const segmentText = text.substring(currentPosition);
			segments.push({
				text: segmentText,
				originalPosition: currentPosition,
				originalLength: segmentText.length,
				isExcluded: false,
			});
		}

		return segments;
	}

	/**
	 * Clean up markdown formatting from text while preserving meaning
	 */
	cleanMarkdownFormatting(text: string): string {
		return (
			text
				// Remove markdown headers
				.replace(/^#{1,6}\s+/gm, "")
				// Remove bold and italic formatting
				.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
				.replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
				// Remove strikethrough
				.replace(/~~([^~]+)~~/g, "$1")
				// Remove blockquotes
				.replace(/^>\s*/gm, "")
				// Remove list markers at the beginning of lines
				.replace(/^\s*[-*+]\s+/gm, "")
				.replace(/^\s*\d+\.\s+/gm, "")
				// Remove list markers that appear after spaces (originally newlines)
				.replace(/\s+[-*+]\s+/g, " ")
				.replace(/\s+\d+\.\s+/g, " ")
				// Remove horizontal rules
				.replace(/^---+$/gm, "")
				// Clean up whitespace but preserve newlines
				.replace(/\n\s*\n/g, "\n")
				.trim()
		);
	}

	/**
	 * Map positions in processed text back to original text positions
	 */
	mapProcessedPositionToOriginal(processedPosition: number, processedText: ProcessedText): number {
		// Simple case: if there's only one segment and it's not excluded, we can map directly
		// but we need to account for whitespace normalization differences
		if (processedText.segments.length === 1 && !processedText.segments[0].isExcluded) {
			const segment = processedText.segments[0];
			const originalText = segment.text;
			const extractedText = processedText.extractedText;

			// If the extracted text is shorter than the original, it means whitespace was normalized
			// We need to map the position accounting for the normalization
			if (originalText.length !== extractedText.length) {
				return this.mapThroughWhitespaceNormalization(processedPosition, originalText, extractedText);
			}

			// If lengths are equal, direct mapping works
			return Math.min(processedPosition, originalText.length - 1);
		}

		// Complex case: multiple segments, we need to account for whitespace normalization
		// Build the extracted text manually to track position mappings accurately
		const extractedParts: string[] = [];
		let rawExtractedText = "";

		for (const segment of processedText.segments) {
			if (!segment.isExcluded) {
				rawExtractedText += segment.text;
				extractedParts.push(segment.text);
			}
		}

		// The actual extracted text has normalization applied: join with " ", apply regex replacement, and trim
		const normalizedExtractedText = rawExtractedText.replace(/\s+/g, " ").trim();

		// If the processed position is beyond the normalized text, return the end position
		if (processedPosition >= normalizedExtractedText.length) {
			const lastSegment = processedText.segments[processedText.segments.length - 1];
			return lastSegment ? lastSegment.originalPosition + lastSegment.originalLength : 0;
		}

		// Map the position through whitespace normalization first
		const rawPosition = this.mapThroughWhitespaceNormalization(
			processedPosition,
			rawExtractedText,
			normalizedExtractedText
		);

		// Now map the raw position back to original segments
		let currentRawPosition = 0;

		for (const segment of processedText.segments) {
			if (segment.isExcluded) continue;

			const segmentLength = segment.text.length;
			if (currentRawPosition + segmentLength > rawPosition) {
				// The position is within this segment
				const offsetInSegment = rawPosition - currentRawPosition;
				return segment.originalPosition + offsetInSegment;
			}

			currentRawPosition += segmentLength;
		}

		// If we get here, the position is beyond the processed text
		const lastSegment = processedText.segments[processedText.segments.length - 1];
		return lastSegment ? lastSegment.originalPosition + lastSegment.originalLength : 0;
	}

	/**
	 * Map a position in normalized text back to the same location in the
	 * original string. This accounts for trimming and collapsing whitespace
	 * which happens before sending text to the grammar service.
	 */
	private mapThroughWhitespaceNormalization(
		processedPos: number,
		originalText: string,
		normalizedText: string
	): number {
		// If the texts are the same length, no whitespace normalization occurred
		if (originalText.length === normalizedText.length) {
			return processedPos;
		}

		// Build a mapping from normalized positions to original positions
		const positionMap: number[] = [];
		let originalPos = 0;
		let normalizedPos = 0;

		// Skip leading whitespace in original text
		while (originalPos < originalText.length && /\s/.test(originalText[originalPos])) {
			originalPos++;
		}

		while (normalizedPos < normalizedText.length && originalPos < originalText.length) {
			const originalChar = originalText[originalPos];
			const normalizedChar = normalizedText[normalizedPos];

			if (originalChar === normalizedChar) {
				// Direct character match
				positionMap[normalizedPos] = originalPos;
				originalPos++;
				normalizedPos++;
			} else if (/\s/.test(normalizedChar)) {
				// Normalized has a space, original might have multiple spaces
				positionMap[normalizedPos] = originalPos;

				// Skip all consecutive whitespace in original
				while (originalPos < originalText.length && /\s/.test(originalText[originalPos])) {
					originalPos++;
				}
				normalizedPos++;
			} else if (/\s/.test(originalChar)) {
				// Original has whitespace but normalized doesn't at this position
				// This shouldn't happen with proper normalization, but handle it
				while (originalPos < originalText.length && /\s/.test(originalText[originalPos])) {
					originalPos++;
				}
			} else {
				// Characters don't match - this shouldn't happen
				positionMap[normalizedPos] = originalPos;
				originalPos++;
				normalizedPos++;
			}
		}

		// Handle position mapping
		if (processedPos < positionMap.length) {
			return positionMap[processedPos];
		} else if (processedPos === normalizedText.length) {
			// End of text - map to end of original
			return originalText.length;
		} else {
			// Position beyond normalized text - extrapolate
			const lastMappedPos = positionMap.length > 0 ? positionMap[positionMap.length - 1] : 0;
			const extraChars = processedPos - positionMap.length;
			return Math.min(lastMappedPos + extraChars, originalText.length);
		}
	}
}
