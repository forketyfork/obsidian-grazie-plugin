import { DEFAULT_SETTINGS } from "../settings/types";

describe("Grazie Plugin", () => {
	it("should have default settings", () => {
		expect(DEFAULT_SETTINGS).toBeDefined();
		expect(DEFAULT_SETTINGS.language).toBe("en");
		expect(DEFAULT_SETTINGS.serverUrl).toBe("https://api.jetbrains.ai");
	});
});
