# Troubleshooting Go to Symbol Extension

## Extension Not Finding Any Symbols

If the extension shows "Error loading symbols" or finds no results, follow these steps:

### 1. Check Extension Activation
- Open Developer Console: `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
- Look for `[Go to Symbol]` messages in the console
- You should see: `[Go to Symbol] Extension is now active`

### 2. Verify Workspace Setup
- Ensure you have a workspace folder open in VSCode
- The extension needs a workspace root to scan files
- Check console for: `[Go to Symbol] Initializing search controller for workspace: /path/to/workspace`

### 3. Check File Patterns
The extension looks for these file types by default:
- Python: `**/*.py`, `**/*.pyi`, `**/*.pyx`
- JavaScript/TypeScript: `**/*.js`, `**/*.ts`, `**/*.jsx`, `**/*.tsx`
- Java: `**/*.java`
- C/C++: `**/*.c`, `**/*.cpp`, `**/*.h`

**To check if files are found:**
1. Open VSCode settings (`Cmd+,`)
2. Search for "goToSymbol.includePatterns"
3. Verify your file types are included

### 4. Test Basic Functionality
1. Create a simple Python file in your workspace:
   ```python
   class TestClass:
       def test_method(self):
           pass
   
   def test_function():
       pass
   ```

2. Use `Cmd+Shift+T` and type "test"
3. Check console for debug messages

### 5. Enable Debug Mode
1. Open VSCode settings
2. Search for "goToSymbol.debug"
3. Set to `true`
4. Reload VSCode window
5. Try the search again and check console for detailed logs

### 6. Common Issues

**No workspace folder:**
- Error: `[Go to Symbol] No workspace folder found`
- Solution: Open a folder in VSCode (`File > Open Folder`)

**Files excluded by patterns:**
- Check `goToSymbol.excludePatterns` setting
- Default excludes: `node_modules`, `venv`, `__pycache__`, `dist`, `build`, `.git`

**Large files skipped:**
- Default max file size: 1MB
- Adjust `goToSymbol.performance.maxFileSize` if needed

**Too many files:**
- Default max files: 10,000
- Adjust `goToSymbol.performance.maxFiles` if needed

### 7. Manual Testing

Try these console commands in the Developer Console:

```javascript
// Check if extension is loaded
vscode.extensions.getExtension('go-to-symbol.go-to-symbol')

// Test command registration
vscode.commands.getCommands().then(cmds => 
  console.log(cmds.filter(c => c.includes('go-to-symbol')))
)
```

### 8. Reset Extension
If nothing works:
1. Disable the extension
2. Reload VSCode
3. Re-enable the extension
4. Try again

### 9. Report Issues
If the extension still doesn't work, please report with:
- VSCode version
- Operating system
- Workspace structure (file types and count)
- Console error messages
- Extension debug logs (with debug mode enabled)

## Performance Issues

If the extension is slow:

1. **Reduce file scope:**
   - Add more exclude patterns
   - Reduce `maxFiles` setting
   - Reduce `maxFileSize` setting

2. **Adjust timeout:**
   - Increase `goToSymbol.performance.searchTimeout`

3. **Clear cache:**
   - Use Command Palette: "Go to Symbol: Clear Cache"

## Keyboard Shortcut Conflicts

If `Cmd+Shift+T` doesn't work:
1. Check VSCode keyboard shortcuts (`Cmd+K Cmd+S`)
2. Search for conflicts with `cmd+shift+t`
3. Manually assign the shortcut to `go-to-symbol.search` command