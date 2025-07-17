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

### Phase 2: Editor Integration (High Priority)

- [x] Add button to check currently opened file
- [x] Implement markdown text extraction with exclusions
- [x] Handle code blocks and inline code exclusion
- [x] Add sentence-based text processing
- [x] Implement language detection for multilingual documents
- [x] **Implement decoration system for highlighting errors** (CRITICAL)
  - Create `DecorationSet` using CodeMirror 6's `@codemirror/view` package
  - Use `Decoration.mark()` for inline underline decorations
  - Implement `ViewPlugin.define()` to manage decoration state
  - Map grammar problems to editor positions using `EditorView.state.doc`
  - Create separate decoration types for grammar vs spelling errors
- [ ] Add hover tooltips for error descriptions and confidence levels
  - Implement `hoverTooltip()` extension from `@codemirror/tooltip`
  - Create tooltip content with error description, confidence level, and suggestions
  - Position tooltips above grammar error decorations
  - Include "Apply suggestion" buttons in tooltip UI
- [ ] Create view plugin for real-time checking with debouncing
  - Implement `ViewPlugin.define()` with `eventHandlers` for document changes
  - Add debouncing using `setTimeout` with 500ms delay
  - Trigger grammar check on `EditorView.updateListener`
  - Manage plugin state through `StateField.define()`
- [ ] Add LRU cache for language detection results
  - Implement `Map` with size limit (e.g., 100 entries)
  - Cache key: document content hash, value: detected language
  - Implement cache eviction when size exceeds limit
  - Store in `LanguageDetectorService` class
- [ ] Implement CodeMirror 6 state management for decorations
  - Create `StateField` for storing grammar problems and decorations
  - Implement state transactions for adding/removing decorations
  - Use `StateEffect.define()` for decoration updates
  - Manage decoration lifecycle through editor state changes

### Phase 3: User Interface (Medium Priority)

- [ ] **Create CSS styles for error highlighting** (CRITICAL)
  - Add `.grazie-plugin-grammar-error` class with red wavy underline
  - Add `.grazie-plugin-spelling-error` class with blue wavy underline
  - Create `.grazie-plugin-error-high-confidence` and `.grazie-plugin-error-low-confidence` variants
  - Style tooltip containers with `.grazie-plugin-tooltip` class
  - Ensure styles work with both light and dark Obsidian themes
- [ ] Implement underline decorations for errors with different styles
  - Use `Decoration.mark()` with `class` attribute for CSS styling
  - Map `CorrectionServiceType` to appropriate CSS classes
  - Apply confidence level styling based on `ConfidenceLevel` enum
  - Create decoration specs for grammar, spelling, and mixed errors
- [ ] Add different styles for grammar vs spelling errors
  - Grammar errors: red wavy underline (`text-decoration: underline wavy red`)
  - Spelling errors: blue wavy underline (`text-decoration: underline wavy blue`)
  - Mixed errors: purple wavy underline for combined issues
  - Use CSS custom properties for theme-aware colors
- [ ] **Create interactive correction modal**
  - Implement `Modal` class extending Obsidian's `Modal`
  - Create side-by-side layout with original and corrected text
  - Add radio buttons for suggestion selection
  - Include preview functionality showing changes in real-time
  - Add "Apply All" and "Apply Selected" buttons
- [ ] Add context menu for corrections with batch operations
  - Implement `Menu` class using Obsidian's context menu API
  - Add "Apply suggestion", "Ignore", and "Add to dictionary" options
  - Create batch operations for multiple errors
  - Position menu at cursor location on right-click
- [ ] **Implement three core commands**: Check Text, Clear Suggestions, Toggle Auto-check
  - Add command palette entries using `this.addCommand()`
  - "Check Text": Trigger grammar check on current document
  - "Clear Suggestions": Remove all decorations from editor
  - "Toggle Auto-check": Enable/disable real-time checking
  - Assign default hotkeys (Ctrl+Shift+G for check, Ctrl+Shift+C for clear)
- [ ] **Add status bar integration** with plugin state
  - Create `StatusBarItem` using `this.addStatusBarItem()`
  - Show current language, enabled/disabled state, and error count
  - Add click handler to toggle auto-check mode
  - Update status on language detection and error count changes
- [ ] Implement language selection UI
  - Add dropdown in settings with supported languages (en, de, ru, uk)
  - Create language detection toggle with auto-detect option
  - Show detected language in status bar when auto-detect is enabled
  - Update UI when language changes
- [ ] Add enabled/disabled toggle
  - Add toggle switch in plugin settings
  - Store state in `GraziePluginSettings`
  - Show visual indicator in status bar
  - Disable all grammar checking when toggled off
- [ ] Create authentication token configuration UI
  - Add secure text input field in settings
  - Mask token display with asterisks
  - Add "Test Connection" button to verify token
  - Show connection status and error messages
- [ ] Add service selection (MLEC, SPELL, RULE)
  - Create checkbox group in settings for service types
  - Enable/disable individual services (MLEC, SPELL, RULE)
  - Update API requests based on selected services
  - Show service-specific error counts in status bar
- [ ] Implement exclusion patterns configuration
  - Add text area for regex patterns in settings
  - Support markdown element exclusions (code blocks, links, etc.)
  - Allow custom exclusion patterns for specific use cases
  - Apply exclusions during text processing phase

### Phase 4: Advanced Features (Lower Priority)

- [ ] **Implement debouncing for real-time checking** (CRITICAL for UX)
  - Create `DebouncedFunction` utility class with configurable delay
  - Implement in `ViewPlugin` to delay grammar checks by 500ms after typing stops
  - Cancel pending checks when new input is detected
  - Add user setting for debounce delay (100ms to 2000ms range)
- [ ] Add caching for processed text with efficient invalidation
  - Implement `TextCache` class with content hash keys
  - Cache grammar check results with TTL (time-to-live) of 5 minutes
  - Invalidate cache on document changes using content comparison
  - Store cache in memory with size limit (e.g., 50 documents)
- [ ] Optimize for large documents with pagination/chunking
  - Split documents into chunks of 10,000 characters or 100 sentences
  - Process chunks sequentially to avoid API rate limits
  - Implement `DocumentChunker` class with sentence-boundary awareness
  - Show progress indicator for multi-chunk processing
- [ ] Implement condition analysis for suppressable problems
  - Add `ProblemAnalyzer` class to evaluate problem conditions
  - Support suppression rules based on confidence, service type, and context
  - Allow users to create custom suppression rules
  - Store suppression preferences in plugin settings
- [ ] Create keyboard shortcuts for quick fixes
  - Add `Ctrl+.` for "Apply first suggestion"
  - Add `Ctrl+Shift+.` for "Show all suggestions"
  - Add `Ctrl+Shift+I` for "Ignore this error"
  - Implement shortcut handling in editor view plugin
- [ ] Implement bulk correction suggestions
  - Create `BulkCorrectionModal` for reviewing multiple errors
  - Add "Accept All", "Review Each", and "Ignore All" options
  - Group similar errors for batch processing
  - Show preview of all changes before applying
- [ ] Add problem confidence level indicators
  - Display confidence as visual indicators (high: solid underline, low: dotted)
  - Add confidence percentage in tooltips
  - Allow filtering by confidence level in settings
  - Use different opacity levels for confidence visualization
- [ ] **Add file-level ignore mechanism**
  - Support `<!-- grazie-ignore -->` comments to skip file checking
  - Add frontmatter property `grazie: false` for markdown files
  - Create file exclusion patterns in settings (glob patterns)
  - Implement `FileIgnoreService` class for ignore logic
- [ ] Implement personal dictionary for custom words
  - Create `PersonalDictionary` class with word storage
  - Add "Add to dictionary" context menu option
  - Store dictionary in plugin data with sync support
  - Allow import/export of dictionary files
- [ ] Add document splitting for large files
  - Implement smart splitting at paragraph boundaries
  - Maintain sentence context across splits
  - Process splits in parallel where possible
  - Reassemble results maintaining original positions
- [ ] Create side-by-side correction preview interface
  - Build `CorrectionPreviewModal` with diff view
  - Show original text on left, corrected text on right
  - Highlight changes with different colors
  - Add individual accept/reject buttons for each change

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

## Implementation Priority Framework

Based on user experience analysis, we should prioritize:

1. **Real-time decorations** (most important user-facing feature)
2. **Interactive correction UI** (key differentiator)
3. **Performance optimizations** (debouncing, caching)
4. **Status bar integration** (user awareness)
5. **Advanced features** (keyboard shortcuts, batch operations)

## Key Technical Decisions

1. **Grammar Engine**: Use JetBrains AI Platform GEC service (same as Grazie)
2. **Real-time Processing**: CodeMirror 6 view plugins with debouncing and LRU caching
3. **Language Support**: English, German, Russian, Ukrainian with service-specific capabilities
4. **Authentication**: User tokens for development, application tokens for production
5. **Performance**: Sentence-based processing with caching and condition analysis
6. **UI Pattern**: Three core commands (Check Text, Clear Suggestions, Toggle Auto-check) with interactive corrections
7. **Editor Integration**: CodeMirror 6 decorations with state management and extensions

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
