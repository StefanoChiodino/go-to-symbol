# Design Document

## Overview

The Enhanced Symbol Search extension will be a VSCode extension that provides intelligent symbol searching capabilities for large repositories. The extension will use file system scanning combined with regex pattern matching to find code symbols when traditional language server indexing is insufficient. It will integrate with VSCode's command palette and keyboard shortcuts to provide a seamless user experience.

## Architecture

The extension follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    VSCode Extension Host                     │
├─────────────────────────────────────────────────────────────┤
│  Extension Entry Point (extension.ts)                      │
│  ├── Command Registration                                   │
│  ├── Keybinding Registration                               │
│  └── Configuration Management                              │
├─────────────────────────────────────────────────────────────┤
│  Search Controller                                          │
│  ├── Search Orchestration                                  │
│  ├── Result Ranking                                        │
│  └── UI Integration                                        │
├─────────────────────────────────────────────────────────────┤
│  Symbol Scanner                    │  Pattern Matcher       │
│  ├── File Discovery               │  ├── Language Patterns │
│  ├── Content Reading              │  ├── Fuzzy Matching    │
│  └── Caching                      │  └── Result Scoring    │
├─────────────────────────────────────────────────────────────┤
│  Language Processors                                        │
│  ├── JavaScript/TypeScript        │  ├── Python           │
│  ├── Java                         │  ├── C#               │
│  └── Generic Text Processor                               │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Extension Entry Point
- **Purpose**: Main extension activation and command registration
- **Key Methods**:
  - `activate()`: Register commands and keybindings
  - `deactivate()`: Cleanup resources
- **Dependencies**: VSCode API, Search Controller

### 2. Search Controller
- **Purpose**: Orchestrates the search process and manages UI interactions
- **Key Methods**:
  - `executeSearch(query: string, options: SearchOptions): Promise<SearchResult[]>`
  - `showSearchResults(results: SearchResult[]): void`
  - `handleResultSelection(result: SearchResult): void`
- **Dependencies**: Symbol Scanner, Pattern Matcher, VSCode QuickPick API

### 3. Symbol Scanner
- **Purpose**: Discovers and reads files in the workspace
- **Key Methods**:
  - `scanWorkspace(patterns: string[]): Promise<FileInfo[]>`
  - `readFileContent(filePath: string): Promise<string>`
  - `getCachedResults(cacheKey: string): SearchResult[] | null`
- **Caching Strategy**: LRU cache with file modification time validation

### 4. Pattern Matcher
- **Purpose**: Applies language-specific patterns to find symbols
- **Key Methods**:
  - `matchSymbols(content: string, query: string, language: string): Match[]`
  - `generateFuzzyPattern(query: string): RegExp`
  - `scoreMatch(match: Match, query: string): number`

### 5. Language Processors
- **Purpose**: Language-specific symbol recognition
- **Interface**:
```typescript
interface LanguageProcessor {
  getSymbolPatterns(): SymbolPattern[];
  extractSymbols(content: string): Symbol[];
  matchQuery(symbols: Symbol[], query: string): Match[];
}
```

## Data Models

### SearchResult
```typescript
interface SearchResult {
  symbolName: string;
  symbolType: 'class' | 'function' | 'variable' | 'interface' | 'method';
  filePath: string;
  lineNumber: number;
  columnNumber: number;
  preview: string;
  score: number;
  language: string;
}
```

### SearchOptions
```typescript
interface SearchOptions {
  symbolTypes?: SymbolType[];
  filePatterns?: string[];
  excludePatterns?: string[];
  fuzzyMatch?: boolean;
  maxResults?: number;
}
```

### SymbolPattern
```typescript
interface SymbolPattern {
  type: SymbolType;
  pattern: RegExp;
  captureGroups: {
    name: number;
    type?: number;
  };
}
```

## Error Handling

### File System Errors
- **Strategy**: Graceful degradation with user notification
- **Implementation**: Try-catch blocks with fallback to partial results
- **User Experience**: Show warning toast for inaccessible directories

### Performance Issues
- **Strategy**: Progressive search with cancellation support
- **Implementation**: AbortController for long-running operations
- **User Experience**: Progress indicator and ability to cancel search

### Pattern Matching Errors
- **Strategy**: Fallback to simpler patterns
- **Implementation**: Catch regex errors and use basic text search
- **User Experience**: Log warnings but continue with available results

## Testing Strategy

### Unit Tests
- **Pattern Matcher**: Test regex generation and scoring algorithms
- **Language Processors**: Verify symbol extraction for each supported language
- **Search Controller**: Mock dependencies and test orchestration logic

### Integration Tests
- **File System Integration**: Test with sample project structures
- **VSCode API Integration**: Test command registration and UI interactions
- **End-to-End Scenarios**: Test complete search workflows

### Performance Tests
- **Large Repository Simulation**: Test with 10,000+ files
- **Memory Usage**: Monitor memory consumption during searches
- **Response Time**: Ensure sub-2-second response times

## Implementation Considerations

### Performance Optimization
1. **Incremental Indexing**: Build symbol index on workspace open
2. **Smart Caching**: Cache parsed symbols with file modification tracking
3. **Parallel Processing**: Use worker threads for file processing
4. **Result Streaming**: Show results as they're found

### VSCode Integration
1. **Command Palette**: Register as "Enhanced Symbol Search"
2. **Keybinding Override**: Replace default Cmd+T behavior
3. **Quick Pick UI**: Use VSCode's native QuickPick for consistency
4. **Status Bar**: Show search progress and statistics

### Configuration Management
1. **Workspace Settings**: Allow per-project customization
2. **User Settings**: Global defaults and preferences
3. **Language-Specific**: Custom patterns per language
4. **Performance Tuning**: Configurable limits and timeouts

### Language Support Priority
1. **Phase 1**: Python (primary focus)
2. **Phase 2**: Generic text matching for other languages (optional)
3. **Future**: JavaScript/TypeScript, Java, C# (nice to have)