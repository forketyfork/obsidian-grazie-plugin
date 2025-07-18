import { LanguageDetectorService } from "../services/language-detector";
import { franc } from "franc-min";

describe("LanguageDetectorService", () => {
	let service: LanguageDetectorService;

	beforeEach(() => {
		service = new LanguageDetectorService();
	});

	describe("detectLanguage", () => {
		it("should detect English text", () => {
			const text = "This is a sample English text that should be detected as English language.";
			const result = service.detectLanguage(text);

			expect(result.detectedLanguage).toBe("en");
			expect(result.isSupported).toBe(true);
		});

		it("should detect German text", () => {
			const text = "Dies ist ein Beispieltext in deutscher Sprache, der als deutsche Sprache erkannt werden sollte.";
			const result = service.detectLanguage(text);

			expect(result.detectedLanguage).toBe("de");
			expect(result.isSupported).toBe(true);
		});

		it("should detect Russian text", () => {
			const text = "Это пример текста на русском языке, который должен быть определен как русский язык.";
			const result = service.detectLanguage(text);

			expect(result.detectedLanguage).toBe("ru");
			expect(result.isSupported).toBe(true);
		});

		it("should detect Ukrainian text", () => {
			const text = "Це приклад тексту українською мовою, який має бути визначений як українська мова.";
			const result = service.detectLanguage(text);

			expect(result.detectedLanguage).toBe("uk");
			expect(result.isSupported).toBe(true);
		});

		it("should return fallback language for very short text", () => {
			const text = "Hi";
			const result = service.detectLanguage(text, "de");

			expect(result.detectedLanguage).toBe("de");
			expect(result.confidence).toBe(0);
			expect(result.isSupported).toBe(true);
		});

		it("should return fallback language for empty text", () => {
			const text = "";
			const result = service.detectLanguage(text, "ru");

			expect(result.detectedLanguage).toBe("ru");
			expect(result.confidence).toBe(0);
			expect(result.isSupported).toBe(true);
		});

		it("should return fallback language for unsupported language", () => {
			const text = "Ceci est un texte en français qui n'est pas supporté par le service.";
			const result = service.detectLanguage(text, "en");

			expect(result.detectedLanguage).toBe("en");
			expect(result.isSupported).toBe(false);
		});

		it("caches repeated detections", () => {
			const text = "This is a sample English text that should be detected as English language.";
			(franc as jest.Mock).mockClear();
			service.detectLanguage(text);
			service.detectLanguage(text);
			expect((franc as jest.Mock).mock.calls.length).toBe(1);
		});
	});

	describe("detectLanguageFromSamples", () => {
		it("should detect language from multiple samples", () => {
			const samples = [
				"This is the first English paragraph.",
				"This is another English paragraph with more content.",
				"Yet another English paragraph to increase confidence.",
			];

			const result = service.detectLanguageFromSamples(samples);

			expect(result.detectedLanguage).toBe("en");
			expect(result.isSupported).toBe(true);
		});

		it("should return fallback for empty samples", () => {
			const samples: string[] = [];
			const result = service.detectLanguageFromSamples(samples, "de");

			expect(result.detectedLanguage).toBe("de");
			expect(result.confidence).toBe(0);
			expect(result.isSupported).toBe(true);
		});

		it("should return fallback for very short samples", () => {
			const samples = ["Hi", "Ok", "Yes"];
			const result = service.detectLanguageFromSamples(samples, "ru");

			expect(result.detectedLanguage).toBe("ru");
			expect(result.confidence).toBe(0);
			expect(result.isSupported).toBe(true);
		});
	});

	describe("extractTextSamples", () => {
		it("should extract samples from text", () => {
			const text = "First paragraph.\n\nSecond paragraph here.\n\nThird paragraph content.\n\nFourth paragraph text.";
			const samples = service.extractTextSamples(text, 3);

			expect(samples).toHaveLength(3);
			expect(samples[0]).toBe("First paragraph.");
			expect(samples[1]).toBe("Second paragraph here.");
			expect(samples[2]).toBe("Third paragraph content.");
		});

		it("should return all paragraphs if fewer than maxSamples", () => {
			const text = "First paragraph.\n\nSecond paragraph.";
			const samples = service.extractTextSamples(text, 5);

			expect(samples).toHaveLength(2);
			expect(samples[0]).toBe("First paragraph.");
			expect(samples[1]).toBe("Second paragraph.");
		});

		it("should return empty array for empty text", () => {
			const text = "";
			const samples = service.extractTextSamples(text);

			expect(samples).toHaveLength(0);
		});
	});
});
