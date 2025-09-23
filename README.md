# Obsidian Grazie Plugin

[![Build status](https://github.com/forketyfork/obsidian-grazie-plugin/actions/workflows/build.yml/badge.svg)](https://github.com/forketyfork/obsidian-grazie-plugin/actions/workflows/build.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-blue.svg)](https://typescriptlang.org/)

An Obsidian plugin that integrates JetBrains AI Platform grammar correction functionality into Obsidian, providing intelligent grammar and spell checking capabilities using the same backend that powers JetBrains IDEs.

## Project Status

🚧 **Currently in Development** 🚧

The project is usable but still under active development. Core grammar checking works and the interface is stable, but a few advanced features are still missing.

### Implemented Features ✅

- TypeScript build system with ESBuild
- Testing framework with Jest
- Code quality tools (ESLint, Prettier)
- Plugin manifest and configuration
- CSS build pipeline
- JetBrains AI Platform integration
- Grammar and spell checking engine
- Real-time error highlighting with incremental checks
- Status bar spinner indicates active grammar checking
- Hover tooltips and clickable suggestions
- Automatic grammar check when a file is opened
- Manual check command available from the ribbon
- Language detection and sentence-level results are cached to reduce API usage
- User-facing error notices for auth/network issues (e.g., invalid/expired token)

### Planned Features 🔄

- Personal dictionary for custom words
- File level ignore rules

## What This Plugin Will Become

The Obsidian Grazie Plugin will bring advanced grammar and spell checking to Obsidian by integrating with the JetBrains AI Platform. It will provide:

- **Intelligent Grammar Checking**: Uses the same AI-powered grammar correction service that powers JetBrains IDEs
- **Multi-language Support**: English, German, Russian, and Ukrainian
- **Real-time Error Detection**: Highlights grammar and spelling errors as you type
- **Smart Corrections**: Provides contextually appropriate suggestions
- **Clickable Suggestions**: Selecting highlighted text shows a dropdown with replacement options
- **Markdown Awareness**: Understands Markdown syntax and ignores code blocks
- **Configurable Services**: Choose between MLEC (ML-based), SPELL (dictionary), and RULE (rule-based) checking

## Requirements

- Obsidian v0.15.0 or higher
- JetBrains AI Platform authentication token (set the `JETBRAINS_AI_TOKEN` environment variable or configure it in the plugin settings)
 - JetBrains AI Platform authentication token (set the `JETBRAINS_AI_TOKEN` environment variable or configure it in the plugin settings). Changes to the token in settings are applied immediately, no plugin reload required.

### Error notices

If there is an issue communicating with the backend (for example, an invalid or expired token, lack of permissions, rate limits, or server errors), the plugin shows a temporary notice in the bottom-right corner of Obsidian. Typical messages include:

- "Grazie: Authentication failed. Please check your token."
- "Grazie: Access forbidden. Please check your permissions."
- "Grazie: Rate limit exceeded. Please try again later."

To resolve most authentication issues, ensure `JETBRAINS_AI_TOKEN` is set or configure a token in the plugin settings.

## Development

Run the development build with change watch:

```shell
yarn dev:watch
```

Run the TypeScript type check:

```shell
yarn typecheck
```

Run the linter:

```shell
yarn lint
```

Run the tests:

```shell
yarn test
```

Run the tests in watch mode:

```shell
yarn test:watch
```

Generate a coverage report:

```shell
yarn coverage
```

Run the production build (includes tests, type checking, and formatting):

```shell
yarn build
```

Bump the version in `package.json` and `manifest.json`, push the `main` branch,
and publish a new tag:

```shell
yarn release
```

## License

This plugin is licensed under the MIT License.
