# Go to Symbol

[![Version](https://img.shields.io/vscode-marketplace/v/go-to-symbol.go-to-symbol.svg)](https://marketplace.visualstudio.com/items?itemName=go-to-symbol.go-to-symbol)
[![Downloads](https://img.shields.io/vscode-marketplace/d/go-to-symbol.go-to-symbol.svg)](https://marketplace.visualstudio.com/items?itemName=go-to-symbol.go-to-symbol)

A VSCode extension that provides intelligent symbol search functionality for large repositories where the default language server indexing is insufficient. Perfect for navigating large codebases with fuzzy pattern matching.

## 🚀 Features

- **Fuzzy Pattern Matching**: Type "AccInv" to find "AccountInvoice" class
- **Multi-Symbol Support**: Search for classes, functions, methods, variables, interfaces, and more
- **High Performance**: Optimized for large repositories (100MB+) with sub-2-second response times
- **Smart Caching**: LRU cache with file modification tracking for fast repeated searches
- **Parallel Processing**: Multi-threaded file processing for maximum performance
- **Seamless Integration**: Uses Cmd+Shift+T shortcut for enhanced symbol search
- **Highly Configurable**: Extensive settings for file patterns, symbol types, and performance tuning

## 📖 Usage

### Basic Search
1. Press `Cmd+Shift+T` (Mac) or `Ctrl+Shift+T` (Windows/Linux) to open the symbol search
2. Type a partial symbol name using fuzzy matching patterns:
   - `AccInv` → finds `AccountInvoice`, `AcceptInvoice`, etc.
   - `getUserData` → finds `getUserData`, `getUsrData`, etc.
3. Use arrow keys to navigate results and press Enter to jump to the symbol

### Advanced Patterns
- **CamelCase matching**: `UI` finds `UserInterface`, `UpdateItem`
- **Partial matching**: `get_user` finds `get_user_data`, `get_user_info`
- **Type filtering**: Configure to search only specific symbol types

## ⚙️ Configuration

Configure the extension through VSCode settings (`Cmd/Ctrl + ,`):

### File Patterns
```json
{
  "goToSymbol.includePatterns": [
    "**/*.py", "**/*.js", "**/*.ts", "**/*.java"
  ],
  "goToSymbol.excludePatterns": [
    "**/node_modules/**", "**/venv/**", "**/__pycache__/**"
  ]
}
```

### Search Behavior
```json
{
  "goToSymbol.fuzzyMatch": true,
  "goToSymbol.maxResults": 100,
  "goToSymbol.symbolTypes": [
    "class", "function", "method", "variable", "interface"
  ]
}
```

### Performance Tuning
```json
{
  "goToSymbol.performance.maxFileSize": 1048576,
  "goToSymbol.performance.maxFiles": 10000,
  "goToSymbol.performance.searchTimeout": 5000,
  "goToSymbol.performance.parallelWorkers": 4
}
```

### Custom Language Patterns
```json
{
  "goToSymbol.customPatterns": {
    ".py": {
      "class": "^\\s*class\\s+([A-Za-z_][A-Za-z0-9_]*)",
      "function": "^\\s*def\\s+([A-Za-z_][A-Za-z0-9_]*)"
    }
  }
}
```

## 🔧 Supported Languages

- **Primary**: Python (full support with decorators, async functions, class inheritance)
- **Secondary**: JavaScript, TypeScript, Java, C#, C/C++ (basic pattern matching)
- **Fallback**: Generic text-based matching for all other file types

## 📋 Requirements

- VSCode 1.74.0 or higher
- Node.js (for development)

## 🐛 Troubleshooting

### Performance Issues
- Reduce `maxFiles` and `maxFileSize` settings
- Add more patterns to `excludePatterns`
- Decrease `parallelWorkers` on slower machines

### Missing Results
- Check `includePatterns` covers your file types
- Verify files aren't excluded by `excludePatterns`
- Enable debug mode: `"goToSymbol.debug": true`

### Fallback Behavior
If enhanced search fails, the extension automatically falls back to VSCode's default symbol search (configurable via `enableFallback` setting).

## 🚀 Development

### Building from Source
```bash
git clone https://github.com/example/go-to-symbol.git
cd go-to-symbol
npm install
npm run compile
```

### Running Tests
```bash
npm test
```

### Packaging
```bash
npm run package
```

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our GitHub repository.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- VSCode Extension API documentation
- Community feedback and feature requests
- Open source pattern matching libraries