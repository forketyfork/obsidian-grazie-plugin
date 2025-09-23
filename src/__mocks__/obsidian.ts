export const requestUrl = jest.fn();

export class Notice {
	constructor(
		public message: string,
		public timeout?: number
	) {}
}

export const Plugin = class MockPlugin {
	app: unknown;
	settings: unknown;

	constructor(app: unknown, _manifest: unknown) {
		this.app = app;
	}

	async onload() {}
	async onunload() {}
	async loadSettings() {}
	async saveSettings() {}
};

export const PluginSettingTab = class MockPluginSettingTab {
	app: unknown;
	plugin: unknown;
	containerEl: unknown;

	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = {
			empty: jest.fn(),
			createEl: jest.fn(),
		};
	}

	display() {}
};

export const Setting = class MockSetting {
	constructor(_containerEl: unknown) {}
	setName(_name: string) {
		return this;
	}
	setDesc(_desc: string) {
		return this;
	}
	addText(_callback: unknown) {
		return this;
	}
	addDropdown(_callback: unknown) {
		return this;
	}
	addToggle(_callback: unknown) {
		return this;
	}
	addButton(_callback: unknown) {
		return this;
	}
};

export const normalizePath = jest.fn((path: string) => path);
