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

		if (match && match.index === 0) {
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
				// Remove list markers
				.replace(/^\s*[-*+]\s+/gm, "")
				.replace(/^\s*\d+\.\s+/gm, "")
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
		let currentProcessedPosition = 0;

		for (const segment of processedText.segments) {
			if (segment.isExcluded) continue;

			const segmentLength = segment.text.length;
			if (currentProcessedPosition + segmentLength >= processedPosition) {
				// The position is within this segment
				const offsetInSegment = processedPosition - currentProcessedPosition;
				return segment.originalPosition + offsetInSegment;
			}

			currentProcessedPosition += segmentLength;
		}

		// If we get here, the position is beyond the processed text
		const lastSegment = processedText.segments[processedText.segments.length - 1];
		return lastSegment ? lastSegment.originalPosition + lastSegment.originalLength : 0;
	}
}
