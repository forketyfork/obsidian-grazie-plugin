import { Plugin } from "obsidian";
import { GrazieSettingTab } from "./settings";
import { GraziePluginSettings, DEFAULT_SETTINGS } from "./settings/types";

export default class GraziePlugin extends Plugin {
	settings: GraziePluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new GrazieSettingTab(this.app, this));
	}

	onunload() {
		// Plugin cleanup
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<GraziePluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
