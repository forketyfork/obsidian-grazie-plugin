export const franc = jest.fn((text: string) => {
	if (text.includes("This is") || text.includes("English") || text.includes("sample")) {
		return "eng";
	}
	if (text.includes("Dies ist") || text.includes("deutscher") || text.includes("deutsche")) {
		return "deu";
	}
	if (text.includes("Это") || text.includes("русском") || text.includes("русский")) {
		return "rus";
	}
	if (text.includes("Це") || text.includes("українською") || text.includes("українська")) {
		return "ukr";
	}
	if (text.includes("français") || text.includes("Ceci")) {
		return "fra"; // French - not supported
	}
	return "und"; // undefined/unknown
});
