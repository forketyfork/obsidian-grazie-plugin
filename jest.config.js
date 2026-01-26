const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
	testEnvironment: "jsdom",
	transform: {
		...tsJestTransformCfg,
	},
	coverageProvider: "v8",
	coverageDirectory: "coverage",
	collectCoverageFrom: ["**/*.ts", "!**/*.test.ts", "!**/__tests__/**", "!node_modules/**"],
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/__mocks__/obsidian.ts",
		"^franc-min$": "<rootDir>/__mocks__/franc-min.ts",
	},
	transformIgnorePatterns: ["node_modules/(?!(franc-min|trigram-utils|n-gram|collapse-white-space)/)"],
};
