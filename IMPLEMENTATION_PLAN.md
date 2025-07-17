# Obsidian Grazie Plugin Implementation Plan

## Overview

This document outlines the implementation plan for integrating JetBrains AI Platform grammar correction functionality into Obsidian. The plugin will provide intelligent grammar and spell checking capabilities using the same backend that powers JetBrains IDEs.

## Research Findings

### JetBrains AI Platform

- Provides **Grammar Error Correction (GEC)** service with advanced ML capabilities
- Supports **English, German, Russian, Ukrainian** with different service levels
- Uses three backend services: **MLEC** (ML-based), **SPELL** (dictionary-based), **RULE** (rule-based)
- Requires authentication tokens (user or application-based)
- Offers both production and staging environments with regional availability

### Obsidian Plugin Development

- Built with **TypeScript** and **CodeMirror 6** for editor extensions
- Uses **Plugin** base class with `onload`/`onunload` lifecycle methods
- Supports real-time editor decorations through **ViewPlugin** system
- Includes settings management via **PluginSettingTab**
- Build system uses **ESBuild** with TypeScript compilation

## Plugin Architecture Design

### Integration Approach

The plugin will integrate directly with the **JetBrains AI Platform** using HTTP API calls. Since only Java and Python client libraries are available, we'll implement a custom TypeScript client that handles API configuration, authentication, and grammar correction requests.

### Core Components

1. **JetBrains AI Platform Client**

   - Custom TypeScript HTTP client for API communication
   - Configuration management (staging/production, regional URLs)
   - Authentication token handling (user tokens for development)
   - Support for GEC v3 and v4 APIs (with markup exclusions)

2. **Grammar Checking Engine**

   - Integration with JetBrains AI Platform GEC service
   - Support for English, German, Russian, Ukrainian
   - Three-tier checking: MLEC (ML), SPELL (dictionary), RULE (rules)
   - Sentence-based processing with problem detection

3. **Obsidian Integration Layer**

   - Editor extensions for real-time checking
   - CodeMirror 6 view plugins for decorations
   - Settings panel for configuration
   - Markdown-aware text processing with exclusions

4. **UI Components**
   - Inline error highlighting with confidence levels
   - Context menu for corrections with batch operations
   - Status bar integration with language detection
   - Settings interface for authentication and preferences

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Obsidian Grazie Plugin                   │
├─────────────────────────────────────────────────────────────┤
│  UI Layer                                                   │
│  ├─ Editor Decorations (CodeMirror 6)                       │
│  ├─ Context Menu with Batch Operations                      │
│  ├─ Settings Panel (Auth + Preferences)                     │
│  └─ Status Bar with Language Detection                      │
├─────────────────────────────────────────────────────────────┤
│  Core Plugin Layer                                          │
│  ├─ Grammar Checker Service                                 │
│  ├─ Problem Analysis & Condition Handling                   │
│  ├─ Cache Management                                        │
│  └─ Configuration Manager                                   │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                          │
│  ├─ JetBrains AI Platform Client                            │
│  ├─ Markdown Processing with Exclusions                     │
│  ├─ Authentication Handler                                  │
│  └─ Obsidian API Interface                                  │
├─────────────────────────────────────────────────────────────┤
│  External Services                                          │
│  ├─ JetBrains AI Platform (GEC API)                         │
│  ├─ Platform Configuration URLs                             │
│  └─ Authentication Services                                 │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Checklist

### Phase 1: Foundation Setup

- [x] Configure TypeScript build system (ESBuild with watch mode)
- [x] Set up testing framework (Jest with jsdom environment)
- [x] Configure ESLint and Prettier for code quality
- [x] Set up package.json with proper scripts
- [x] Create manifest.json for Obsidian plugin
- [x] Configure CSS build pipeline with CSSO
- [x] Create src directory structure
- [x] Create main plugin class extending Obsidian's Plugin
- [x] Implement settings interface with authentication support
- [x] Add basic configuration options
- [x] Implement configuration URL resolver
- [x] Create HTTP client for JetBrains AI Platform
- [x] Implement authentication token handling
- [x] Test basic GEC API connectivity

### Phase 2: Editor Integration

- [x] Add button to check currently opened file
- [ ] Implement markdown text extraction with exclusions
- [ ] Handle code blocks and inline code exclusion
- [ ] Add sentence-based text processing
- [ ] Implement language detection for multilingual documents
- [ ] Implement decoration system for highlighting errors
- [ ] Add hover tooltips for error descriptions and confidence levels
- [ ] Create view plugin for real-time checking

### Phase 3: User Interface

- [ ] Create CSS styles for error highlighting
- [ ] Implement underline decorations for errors
- [ ] Add different styles for grammar vs spelling errors
- [ ] Create context menu for corrections
- [ ] Add support for batch operations
- [ ] Implement language selection UI
- [ ] Add enabled/disabled toggle
- [ ] Create authentication token configuration UI
- [ ] Add service selection (MLEC, SPELL, RULE)
- [ ] Implement exclusion patterns configuration

### Phase 4: Advanced Features

- [ ] Implement debouncing for real-time checking
- [ ] Add caching for processed text
- [ ] Optimize for large documents
- [ ] Implement condition analysis for suppressable problems
- [ ] Add status bar integration
- [ ] Create keyboard shortcuts for quick fixes
- [ ] Implement bulk correction suggestions
- [ ] Add problem confidence level indicators

### Phase 5: Testing & Polish

- [ ] Create **tests** directory structure
- [ ] Write unit tests for JetBrains AI Platform client
- [ ] Write unit tests for grammar checker service
- [ ] Write unit tests for text processing
- [ ] Write integration tests with Obsidian
- [ ] Add performance testing with large files
- [ ] Test authentication flow
- [ ] Update README.md with usage instructions
- [ ] Create user documentation
- [ ] Prepare plugin for submission

## Key Technical Decisions

1. **Grammar Engine**: Use JetBrains AI Platform GEC service (same as Grazie)
2. **Real-time Processing**: CodeMirror 6 view plugins with debouncing
3. **Language Support**: English, German, Russian, Ukrainian with service-specific capabilities
4. **Authentication**: User tokens for development, application tokens for production
5. **Performance**: Sentence-based processing with caching and condition analysis

## Development Dependencies

### Core Dependencies

- **TypeScript**: Static typing and compilation
- **Obsidian API**: Plugin framework and editor integration
- **ESBuild**: Fast bundling and compilation

### Grammar Processing

- **Custom JetBrains AI Platform client**: HTTP API integration
- **Language detection library**: Auto-detect document language

### UI Components

- **CodeMirror 6 extensions**: Editor decorations and interactions
- **Obsidian UI components**: Settings panels and modals

### Testing & Build

- **Jest**: Unit and integration testing
- **ESLint**: Code linting and style checking
- **Prettier**: Code formatting

## Expected Challenges

1. **Performance**: Real-time checking without lag

   - _Solution_: Implement debouncing and incremental processing

2. **Accuracy**: Handling markdown-specific syntax

   - _Solution_: Use exclusions API to ignore markdown syntax

3. **Authentication**: Managing user tokens securely

   - _Solution_: Secure token storage and refresh handling

4. **User Experience**: Non-intrusive error highlighting
   - _Solution_: Subtle decorations with configurable styles and confidence levels

## Success Metrics

- **Performance**: < 100ms latency for real-time checking
- **Accuracy**: Grammar checking quality comparable to Grazie
- **Usability**: Intuitive settings and error correction workflow
- **Compatibility**: Works with existing Obsidian themes and plugins

## Resources

- JetBrains AI Platform documentation: `.ignore/JetBrains AI Docs.md`
- [Obsidian Plugin Development Documentation](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [JetBrains AI Platform Documentation](https://platform.jetbrains.ai/docs/getting-started)
- [JetBrains AI Platform Grammar Correction API](https://platform.jetbrains.ai/docs/grammar-correction)
- [CodeMirror 6 Documentation](https://codemirror.net/6/)
- [JetBrains Grazie Plugin Source](https://github.com/JetBrains/intellij-community/tree/master/plugins/grazie)
