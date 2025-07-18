import { LanguageDetectorService } from "../services/language-detector";
import { franc } from "franc-min";

jest.mock("franc-min", () => ({ franc: jest.fn(() => "eng") }));

const mockedFranc = franc as jest.Mock;

describe("LanguageDetectorService caching", () => {
	it("should cache detection results", () => {
		const service = new LanguageDetectorService(10);
		const text = "This is an example sentence that should be detected.";
		const first = service.detectLanguage(text);
		const second = service.detectLanguage(text);

		expect(first).toEqual(second);
		expect(mockedFranc).toHaveBeenCalledTimes(1);
		expect(service.getCacheSize()).toBe(1);
	});
});
