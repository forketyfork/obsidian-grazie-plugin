import { App, PluginSettingTab, Setting } from "obsidian";
import GraziePlugin from "../main";
import { SUPPORTED_LANGUAGES, SupportedLanguage } from "./types";

export class GrazieSettingTab extends PluginSettingTab {
	plugin: GraziePlugin;

	constructor(app: App, plugin: GraziePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Grazie Plugin Settings" });

		containerEl.createEl("h3", { text: "Authentication" });

		new Setting(containerEl)
			.setName("JetBrains AI Token")
			.setDesc("Authentication token for JetBrains AI Platform")
			.addText(text =>
				text
					.setPlaceholder("Enter your JetBrains AI token")
					.setValue(this.plugin.settings.authToken)
					.onChange(async value => {
						this.plugin.settings.authToken = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Server URL")
			.setDesc("JetBrains AI Platform server URL")
			.addText(text =>
				text
					.setPlaceholder("https://api.jetbrains.ai")
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async value => {
						this.plugin.settings.serverUrl = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Language Settings" });

		new Setting(containerEl)
			.setName("Language")
			.setDesc("Language for grammar checking")
			.addDropdown(dropdown => {
				Object.entries(SUPPORTED_LANGUAGES).forEach(([code, name]) => {
					dropdown.addOption(code, name);
				});
				dropdown.setValue(this.plugin.settings.language).onChange(async value => {
					this.plugin.settings.language = value as SupportedLanguage;
					await this.plugin.saveSettings();
				});
			});

		containerEl.createEl("h3", { text: "Service Settings" });

		new Setting(containerEl)
			.setName("Enable MLEC Service")
			.setDesc("Machine Learning Error Correction service")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.enabledServices.mlec).onChange(async value => {
					this.plugin.settings.enabledServices.mlec = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Enable Spell Service")
			.setDesc("Dictionary-based spell checking service")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.enabledServices.spell).onChange(async value => {
					this.plugin.settings.enabledServices.spell = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Enable Rule Service")
			.setDesc("Rule-based grammar checking service")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.enabledServices.rule).onChange(async value => {
					this.plugin.settings.enabledServices.rule = value;
					await this.plugin.saveSettings();
				})
			);

		containerEl.createEl("h3", { text: "Checking Settings" });

		new Setting(containerEl)
			.setName("Checking Delay")
			.setDesc("Delay in milliseconds before checking text")
			.addText(text =>
				text
					.setPlaceholder("500")
					.setValue(String(this.plugin.settings.checkingDelay))
					.onChange(async value => {
						const delay = parseInt(value);
						if (!isNaN(delay) && delay >= 0) {
							this.plugin.settings.checkingDelay = delay;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Minimum Confidence Level")
			.setDesc("Minimum confidence level for showing suggestions (0.0 - 1.0)")
			.addText(text =>
				text
					.setPlaceholder("0.5")
					.setValue(String(this.plugin.settings.minConfidenceLevel))
					.onChange(async value => {
						const confidence = parseFloat(value);
						if (!isNaN(confidence) && confidence >= 0 && confidence <= 1) {
							this.plugin.settings.minConfidenceLevel = confidence;
							await this.plugin.saveSettings();
						}
					})
			);

		containerEl.createEl("h3", { text: "Exclusions" });

		new Setting(containerEl)
			.setName("Exclude Code Blocks")
			.setDesc("Skip grammar checking in code blocks")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.excludeCodeBlocks).onChange(async value => {
					this.plugin.settings.excludeCodeBlocks = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Exclude Inline Code")
			.setDesc("Skip grammar checking in inline code")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.excludeInlineCode).onChange(async value => {
					this.plugin.settings.excludeInlineCode = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Exclude Links")
			.setDesc("Skip grammar checking in links")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.excludeLinks).onChange(async value => {
					this.plugin.settings.excludeLinks = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Exclude Block Quotes")
			.setDesc("Skip grammar checking in block quotes")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.excludeBlockQuotes).onChange(async value => {
					this.plugin.settings.excludeBlockQuotes = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
