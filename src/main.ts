import { Plugin } from 'obsidian';
import { GrazieSettingTab } from './settings';
import { GraziePluginSettings, DEFAULT_SETTINGS } from './settings/types';

export default class GraziePlugin extends Plugin {
	settings: GraziePluginSettings;

	async onload() {
		await this.loadSettings();
		
		this.addSettingTab(new GrazieSettingTab(this.app, this));

		console.log('Grazie Plugin loaded');
	}

	onunload() {
		console.log('Grazie Plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}