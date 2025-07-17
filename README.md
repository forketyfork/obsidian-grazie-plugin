# Obsidian Grazie Plugin

An Obsidian plugin that integrates JetBrains AI Platform grammar correction functionality into Obsidian, providing intelligent grammar and spell checking capabilities using the same backend that powers JetBrains IDEs.

## Project Status

🚧 **Currently in Development** 🚧

This project is in active development. The development infrastructure is complete, but the core functionality is still being implemented.

### What's Complete ✅

- TypeScript build system with ESBuild
- Testing framework with Jest
- Code quality tools (ESLint, Prettier)
- Plugin manifest and configuration
- CSS build pipeline

### What's Being Developed 🔄

- JetBrains AI Platform integration
- Grammar and spell checking engine
- Real-time error highlighting (basic debounced checking implemented)
- User interface components
- Hover tooltips with error descriptions and suggestions

## What This Plugin Will Become

The Obsidian Grazie Plugin will bring advanced grammar and spell checking to Obsidian by integrating with the JetBrains AI Platform. It will provide:

- **Intelligent Grammar Checking**: Uses the same AI-powered grammar correction service that powers JetBrains IDEs
- **Multi-language Support**: English, German, Russian, and Ukrainian
- **Real-time Error Detection**: Highlights grammar and spelling errors as you type
- **Smart Corrections**: Provides contextually appropriate suggestions
- **Markdown Awareness**: Understands Markdown syntax and ignores code blocks
- **Configurable Services**: Choose between MLEC (ML-based), SPELL (dictionary), and RULE (rule-based) checking

## Requirements

- Obsidian v0.15.0 or higher
- JetBrains AI Platform authentication token (for development/testing)

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
