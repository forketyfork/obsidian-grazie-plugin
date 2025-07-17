export const requestUrl = jest.fn();

export const Plugin = class MockPlugin {
	app: any;
	settings: any;

	constructor(app: any, manifest: any) {
		this.app = app;
	}

	async onload() {}
	async onunload() {}
	async loadSettings() {}
	async saveSettings() {}
};

export const PluginSettingTab = class MockPluginSettingTab {
	app: any;
	plugin: any;
	containerEl: any;

	constructor(app: any, plugin: any) {
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
	constructor(containerEl: any) {}
	setName(name: string) {
		return this;
	}
	setDesc(desc: string) {
		return this;
	}
	addText(callback: any) {
		return this;
	}
	addDropdown(callback: any) {
		return this;
	}
	addToggle(callback: any) {
		return this;
	}
	addButton(callback: any) {
		return this;
	}
};

export const normalizePath = jest.fn((path: string) => path);
