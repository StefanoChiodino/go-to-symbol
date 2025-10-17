# Installation Guide

## From VSCode Marketplace (Recommended)

1. Open VSCode
2. Go to Extensions view (`Cmd+Shift+X` or `Ctrl+Shift+X`)
3. Search for "Go to Symbol"
4. Click "Install"

## From VSIX File

If you have the `.vsix` file:

1. Open VSCode
2. Go to Extensions view (`Cmd+Shift+X` or `Ctrl+Shift+X`)
3. Click the "..." menu in the Extensions view
4. Select "Install from VSIX..."
5. Choose the `go-to-symbol-0.1.0.vsix` file

## Command Line Installation

```bash
code --install-extension go-to-symbol-0.1.0.vsix
```

## Verification

After installation:

1. Press `Cmd+T` (Mac) or `Ctrl+T` (Windows/Linux)
2. You should see the Go to Symbol interface
3. Try typing a partial symbol name to test functionality

## Configuration

The extension works out of the box, but you can customize it:

1. Open VSCode Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "Go to Symbol"
3. Adjust settings as needed

## Troubleshooting

### Extension Not Working
- Ensure VSCode version is 1.74.0 or higher
- Check if the extension is enabled in Extensions view
- Reload VSCode window (`Cmd+R` or `Ctrl+R`)

### Performance Issues
- Reduce `maxFiles` setting for large repositories
- Add more patterns to `excludePatterns`
- Decrease `parallelWorkers` on slower machines

### No Search Results
- Check `includePatterns` covers your file types
- Verify files aren't excluded by `excludePatterns`
- Enable debug mode: `"enhancedSymbolSearch.debug": true`

## Uninstallation

1. Go to Extensions view
2. Find "Go to Symbol"
3. Click the gear icon and select "Uninstall"

## Support

For issues or questions:
- Check the [GitHub Issues](https://github.com/example/go-to-symbol/issues)
- Read the [README](README.md) for detailed documentation
- Review the [Contributing Guide](CONTRIBUTING.md) for development setup