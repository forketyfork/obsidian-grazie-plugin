# Obsidian Grazie Plugin

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
- Interactive correction modal with side-by-side preview and bulk apply actions
- Automatic grammar check when a file is opened
- Manual check command from the ribbon opens the review modal for applying suggestions
- Language detection and sentence-level results are cached to reduce API usage

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
