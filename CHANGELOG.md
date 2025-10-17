# Change Log

All notable changes to the "go-to-symbol" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2024-01-15

### Added
- **Core Features**
  - Fuzzy pattern matching for symbol names (e.g., "AccInv" finds "AccountInvoice")
  - Support for multiple symbol types (classes, functions, methods, variables, interfaces)
  - Fast search performance optimized for large repositories
  - Seamless integration with VSCode's Cmd+T/Ctrl+T shortcut

- **Performance Optimizations**
  - LRU cache with file modification tracking
  - Parallel file processing using worker threads
  - Configurable performance limits and timeouts
  - Smart file filtering with include/exclude patterns

- **Language Support**
  - Primary support for Python with decorators, async functions, and class inheritance
  - Generic text-based pattern matching for other languages
  - Extensible language processor architecture

- **Configuration Options**
  - Comprehensive settings for file patterns and search behavior
  - Custom regex patterns for different languages
  - Performance tuning options for large repositories
  - Debug mode for troubleshooting

- **User Experience**
  - VSCode QuickPick integration with keyboard navigation
  - Progress indicators for long-running searches
  - Automatic fallback to VSCode's default symbol search
  - Error handling with user-friendly messages

### Technical Details
- Built with TypeScript for type safety and maintainability
- Modular architecture with clear separation of concerns
- Comprehensive error handling and graceful degradation
- Extensive configuration validation and defaults

### Known Issues
- Large files (>1MB) may cause slower search performance
- Some complex regex patterns in custom configurations may not work as expected

### Coming Soon
- Enhanced JavaScript/TypeScript support
- Additional language processors (Java, C#)
- Symbol preview in search results
- Workspace-specific symbol indexing