import { App, PluginSettingTab, Setting } from "obsidian";
import GraziePlugin from "../main";
import { SUPPORTED_LANGUAGES, SupportedLanguage } from "./types";
import { ConfigurationUrlResolver } from "../jetbrains-ai/config-resolver";

export class GrazieSettingTab extends PluginSettingTab {
	plugin: GraziePlugin;

	constructor(app: App, plugin: GraziePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName("Authentication").setHeading();

		new Setting(containerEl)
			.setName("JetBrains AI token")
			.setDesc("Authentication token for JetBrains AI Platform") // eslint-disable-line obsidianmd/ui/sentence-case -- proper noun
			.addText(text =>
				text
					.setPlaceholder("Enter your JetBrains AI token")
					.setValue(this.plugin.settings.authToken)
					.onChange(async value => {
						this.plugin.settings.authToken = value;
						await this.plugin.saveSettings();
						// Apply immediately to running services
						await this.plugin.applyAuthToken(value);
					})
					.inputEl.setAttribute("type", "password")
			);

		new Setting(containerEl).setName("Server configuration").setHeading();

		new Setting(containerEl)
			.setName("Configuration URL")
			.setDesc("JetBrains AI platform configuration URL")
			.addText(text =>
				text
					.setPlaceholder("https://www.jetbrains.com/config/JetBrainsAIPlatform.json")
					.setValue(this.plugin.settings.configUrl)
					.onChange(async value => {
						this.plugin.settings.configUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Server URL")
			.setDesc("JetBrains AI platform server URL")
			.addText(text =>
				text
					.setPlaceholder("https://api.jetbrains.ai")
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async value => {
						this.plugin.settings.serverUrl = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton(button => {
				button
					.setButtonText("Auto-resolve")
					.setTooltip("Automatically resolve server URL from configuration")
					.onClick(async () => {
						button.setDisabled(true);
						button.setButtonText("Resolving...");
						try {
							const resolver = new ConfigurationUrlResolver(
								this.plugin.settings.configUrl,
								this.plugin.settings.serverUrl
							);
							const result = await resolver.resolve();

							if (result.isSuccess) {
								this.plugin.settings.serverUrl = result.url;
								await this.plugin.saveSettings();
								this.display(); // Refresh the settings display
							} else {
								// Show warning but still use the fallback URL
								this.plugin.settings.serverUrl = result.url;
								await this.plugin.saveSettings();
								this.display();
								console.error("URL resolution warnings:", result.warnings);
								console.error("URL resolution errors:", result.errors);
							}
						} catch (error) {
							console.error("Failed to resolve URL:", error);
						} finally {
							button.setDisabled(false);
							button.setButtonText("Auto-resolve");
						}
					});
			});

		new Setting(containerEl).setName("Language settings").setHeading();

		new Setting(containerEl)
			.setName("Auto-detect language")
			.setDesc("Automatically detect the language of the text being checked")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.autoDetectLanguage).onChange(async value => {
					this.plugin.settings.autoDetectLanguage = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Default language")
			.setDesc("Default language for grammar checking (used when auto-detection is disabled or fails)")
			.addDropdown(dropdown => {
				Object.entries(SUPPORTED_LANGUAGES).forEach(([code, name]) => {
					dropdown.addOption(code, name);
				});
				dropdown.setValue(this.plugin.settings.language).onChange(async value => {
					this.plugin.settings.language = value as SupportedLanguage;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setName("Service settings").setHeading();

		new Setting(containerEl)
			.setName("Enable MLEC service") // eslint-disable-line obsidianmd/ui/sentence-case -- abbreviation
			.setDesc("Machine learning error correction service")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.enabledServices.mlec).onChange(async value => {
					this.plugin.settings.enabledServices.mlec = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Enable spell service")
			.setDesc("Dictionary-based spell checking service")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.enabledServices.spell).onChange(async value => {
					this.plugin.settings.enabledServices.spell = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Enable rule service")
			.setDesc("Rule-based grammar checking service")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.enabledServices.rule).onChange(async value => {
					this.plugin.settings.enabledServices.rule = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Checking settings").setHeading();

		new Setting(containerEl)
			.setName("Checking delay")
			.setDesc("Delay in milliseconds before checking text (0-10000)")
			.addText(text =>
				text
					.setPlaceholder("500")
					.setValue(String(this.plugin.settings.checkingDelay))
					.onChange(async value => {
						const delay = parseInt(value);
						if (!isNaN(delay) && delay >= 0 && delay <= 10000) {
							this.plugin.settings.checkingDelay = delay;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Minimum confidence level")
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

		new Setting(containerEl).setName("Exclusions").setHeading();

		new Setting(containerEl)
			.setName("Exclude code blocks")
			.setDesc("Skip grammar checking in code blocks")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.excludeCodeBlocks).onChange(async value => {
					this.plugin.settings.excludeCodeBlocks = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Exclude inline code")
			.setDesc("Skip grammar checking in inline code")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.excludeInlineCode).onChange(async value => {
					this.plugin.settings.excludeInlineCode = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Exclude links")
			.setDesc("Skip grammar checking in links")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.excludeLinks).onChange(async value => {
					this.plugin.settings.excludeLinks = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Exclude block quotes")
			.setDesc("Skip grammar checking in block quotes")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.excludeBlockQuotes).onChange(async value => {
					this.plugin.settings.excludeBlockQuotes = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
