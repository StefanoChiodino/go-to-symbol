# Testing the Go to Symbol Extension

## Installation for Testing

1. **Clone and build the extension:**
   ```bash
   git clone git@github.com:StefanoChiodino/go-to-symbol.git
   cd go-to-symbol
   npm install
   npm run compile
   ```

2. **Install in VSCode:**
   - Open VSCode
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Extensions: Install from VSIX"
   - Navigate to the project folder and select the `.vsix` file (if available)
   
   **OR** for development testing:
   - Open the project folder in VSCode
   - Press `F5` to launch a new Extension Development Host window
   - The extension will be active in the new window

## Usage

1. **Open a Python project** in the Extension Development Host window
2. **Use the keyboard shortcut:** `Cmd+Shift+T` (Mac) or `Ctrl+Shift+T` (Windows/Linux)
3. **Start typing** to search for symbols like:
   - `AccTran` → should find `AccountTransaction` symbols
   - `class` → should find class definitions
   - `def` → should find function definitions

## Debugging

If the extension doesn't find symbols:

1. **Check the Developer Console:**
   - Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
   - Look for `[Go to Symbol]` log messages

2. **Common issues:**
   - No workspace folder open
   - No Python files in the workspace
   - File patterns not matching your files

3. **Test with the included test file:**
   - The repository includes `test-python-symbols.py`
   - Try searching for `AccountTransaction` or `AccTran`

## Expected Behavior

- **Real-time search:** Results update as you type
- **Fuzzy matching:** `AccTran` matches `AccountTransaction`
- **Symbol types:** Classes, functions, methods, variables, enums
- **File context:** Shows file path and line number
- **Navigation:** Click or press Enter to jump to symbol

## Troubleshooting

If you see "Error loading symbols":
1. Check that you have Python files in your workspace
2. Check the console for detailed error messages
3. Try typing a query to trigger direct search mode
4. Ensure the workspace folder is properly opened in VSCode