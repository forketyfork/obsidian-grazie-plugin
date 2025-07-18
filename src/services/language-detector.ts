import { franc } from "franc-min";
import { createHash } from "crypto";
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
	private static readonly CACHE_LIMIT = 100;

	private cache: Map<string, LanguageDetectionResult> = new Map();

	private getCacheKey(text: string): string {
		return createHash("sha1").update(text).digest("hex");
	}

	private readFromCache(key: string): LanguageDetectionResult | undefined {
		const value = this.cache.get(key);
		if (value) {
			this.cache.delete(key);
			this.cache.set(key, value);
		}
		return value;
	}

	private writeToCache(key: string, value: LanguageDetectionResult): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= LanguageDetectorService.CACHE_LIMIT) {
			const oldestKey = this.cache.keys().next().value as string | undefined;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}
		this.cache.set(key, value);
	}

	/**
	 * Detects the language of the given text.
	 * Returns the detected language if supported, otherwise returns the fallback language.
	 */
	detectLanguage(text: string, fallbackLanguage: SupportedLanguage = "en"): LanguageDetectionResult {
		const cacheKey = this.getCacheKey(text);
		const cached = this.readFromCache(cacheKey);
		if (cached) {
			return cached;
		}
		if (!text || text.trim().length < 10) {
			// For very short texts, use fallback
			const result = {
				detectedLanguage: fallbackLanguage,
				confidence: 0,
				isSupported: true,
			};
			this.writeToCache(cacheKey, result);
			return result;
		}

		try {
			const detectedCode = franc(text);
			const mappedLanguage = LanguageDetectorService.LANGUAGE_MAP[detectedCode];

			if (mappedLanguage) {
				const result = {
					detectedLanguage: mappedLanguage,
					confidence: 1.0, // franc doesn't provide confidence, so we assume high confidence for supported languages
					isSupported: true,
				};
				this.writeToCache(cacheKey, result);
				return result;
			} else {
				// Language detected but not supported
				const result = {
					detectedLanguage: fallbackLanguage,
					confidence: 0.5,
					isSupported: false,
				};
				this.writeToCache(cacheKey, result);
				return result;
			}
		} catch (error) {
			console.error("Language detection failed:", error);
			const result = {
				detectedLanguage: fallbackLanguage,
				confidence: 0,
				isSupported: true,
			};
			this.writeToCache(cacheKey, result);
			return result;
		}
	}

	/**
	 * Detects the language of multiple text samples and returns the most confident result.
	 * This is useful for analyzing different parts of a document.
	 */
	detectLanguageFromSamples(samples: string[], fallbackLanguage: SupportedLanguage = "en"): LanguageDetectionResult {
		const cacheKey = this.getCacheKey(samples.join("|"));
		const cached = this.readFromCache(cacheKey);
		if (cached) {
			return cached;
		}

		if (!samples || samples.length === 0) {
			const emptyResult = {
				detectedLanguage: fallbackLanguage,
				confidence: 0,
				isSupported: true,
			};
			this.writeToCache(cacheKey, emptyResult);
			return emptyResult;
		}

		const results: LanguageDetectionResult[] = [];

		for (const sample of samples) {
			if (sample.trim().length >= 10) {
				results.push(this.detectLanguage(sample, fallbackLanguage));
			}
		}

		if (results.length === 0) {
			const noResult = {
				detectedLanguage: fallbackLanguage,
				confidence: 0,
				isSupported: true,
			};
			this.writeToCache(cacheKey, noResult);
			return noResult;
		}

		// Find the most confident result
		const bestResult = results.reduce((best, current) => (current.confidence > best.confidence ? current : best));

		// If confidence is too low, use fallback
		let finalResult = bestResult;
		if (bestResult.confidence < LanguageDetectorService.CONFIDENCE_THRESHOLD) {
			finalResult = {
				detectedLanguage: fallbackLanguage,
				confidence: bestResult.confidence,
				isSupported: true,
			};
		}

		this.writeToCache(cacheKey, finalResult);
		return finalResult;
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
