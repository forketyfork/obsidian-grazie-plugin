import { franc } from "franc-min";
import { SupportedLanguage } from "../settings/types";

export interface LanguageDetectionResult {
	detectedLanguage: SupportedLanguage;
	confidence: number;
	isSupported: boolean;
}

export class LanguageDetectorService {
	private static readonly LANGUAGE_MAP: Record<string, SupportedLanguage> = {
		eng: "en", // English
		deu: "de", // German
		rus: "ru", // Russian
		ukr: "uk", // Ukrainian
	};

	private static readonly CONFIDENCE_THRESHOLD = 0.7;

	/**
	 * Detects the language of the given text.
	 * Returns the detected language if supported, otherwise returns the fallback language.
	 */
	detectLanguage(text: string, fallbackLanguage: SupportedLanguage = "en"): LanguageDetectionResult {
		if (!text || text.trim().length < 10) {
			// For very short texts, use fallback
			return {
				detectedLanguage: fallbackLanguage,
				confidence: 0,
				isSupported: true,
			};
		}

		try {
			const detectedCode = franc(text);
			const mappedLanguage = LanguageDetectorService.LANGUAGE_MAP[detectedCode];

			if (mappedLanguage) {
				return {
					detectedLanguage: mappedLanguage,
					confidence: 1.0, // franc doesn't provide confidence, so we assume high confidence for supported languages
					isSupported: true,
				};
			} else {
				// Language detected but not supported
				return {
					detectedLanguage: fallbackLanguage,
					confidence: 0.5,
					isSupported: false,
				};
			}
		} catch (error) {
			console.error("Language detection failed:", error);
			return {
				detectedLanguage: fallbackLanguage,
				confidence: 0,
				isSupported: true,
			};
		}
	}

	/**
	 * Detects the language of multiple text samples and returns the most confident result.
	 * This is useful for analyzing different parts of a document.
	 */
	detectLanguageFromSamples(samples: string[], fallbackLanguage: SupportedLanguage = "en"): LanguageDetectionResult {
		if (!samples || samples.length === 0) {
			return {
				detectedLanguage: fallbackLanguage,
				confidence: 0,
				isSupported: true,
			};
		}

		const results: LanguageDetectionResult[] = [];

		for (const sample of samples) {
			if (sample.trim().length >= 10) {
				results.push(this.detectLanguage(sample, fallbackLanguage));
			}
		}

		if (results.length === 0) {
			return {
				detectedLanguage: fallbackLanguage,
				confidence: 0,
				isSupported: true,
			};
		}

		// Find the most confident result
		const bestResult = results.reduce((best, current) => (current.confidence > best.confidence ? current : best));

		// If confidence is too low, use fallback
		if (bestResult.confidence < LanguageDetectorService.CONFIDENCE_THRESHOLD) {
			return {
				detectedLanguage: fallbackLanguage,
				confidence: bestResult.confidence,
				isSupported: true,
			};
		}

		return bestResult;
	}

	/**
	 * Extracts text samples from different parts of the document for language detection.
	 * This helps with mixed-language documents by analyzing different sections.
	 */
	extractTextSamples(text: string, maxSamples: number = 5): string[] {
		if (!text || text.trim().length === 0) {
			return [];
		}

		// Split text into paragraphs
		const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

		if (paragraphs.length <= maxSamples) {
			return paragraphs;
		}

		// Select evenly distributed samples
		const samples: string[] = [];
		const step = Math.floor(paragraphs.length / maxSamples);

		for (let i = 0; i < maxSamples; i++) {
			const index = Math.min(i * step, paragraphs.length - 1);
			samples.push(paragraphs[index]);
		}

		return samples;
	}
}
