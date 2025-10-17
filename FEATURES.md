# Go to Symbol - Real-Time Search Features

## ✨ **Real-Time Search Experience**

The extension now provides a **true real-time search experience** that updates as you type, just like VSCode's native symbol search but with enhanced capabilities.

### 🚀 **How It Works**

1. **Press `Cmd+Shift+T`** (Mac) or `Ctrl+Shift+T` (Windows/Linux)
2. **Start typing immediately** - results appear instantly
3. **No waiting** - 50ms debounce for ultra-responsive typing
4. **Smart caching** - symbols are pre-loaded for instant filtering

### 🎯 **Search Modes**

#### **Instant Mode** (Preferred)
- Pre-loads all workspace symbols in background
- Filters results in real-time as you type
- **Ultra-fast response** - no network/disk delays
- Shows up to 100 symbols initially, filtered to top 50 matches

#### **Direct Search Mode** (Fallback)
- Used when symbols aren't pre-loaded yet
- Searches directly through files as you type
- Still responsive with 2-second timeout
- Caches results for future instant filtering

### 🔍 **Enhanced Python Support**

Perfect for your specific use cases:

#### **Fuzzy Matching Examples:**
- Type `AccTran` → finds `AccountTransaction` (class, enum, variable)
- Type `AccInv` → finds `AccountInvoice`, `AcceptInvoice`
- Type `getUserData` → finds `getUserData`, `getUsrData`

#### **Python Symbol Types:**
1. **`enum AccountTransaction:`** - Detected as enum type
2. **`class AccountTransaction(`** - Detected as class type  
3. **`AccountTransaction: List =`** - Detected as typed variable
4. **`AccountTransaction =`** - Detected as variable assignment

### 📊 **Smart Scoring System**

Results are ranked by relevance:

1. **Exact match** (1000 points) - `AccountTransaction` = `AccountTransaction`
2. **Starts with** (900 points) - `Account` matches `AccountTransaction`
3. **Contains** (800 points) - `Transaction` matches `AccountTransaction`
4. **Fuzzy match** (700 points) - `AccTran` matches `AccountTransaction`
5. **Word boundary** (600 points) - `Account` matches `Account_Transaction`

**Plus bonuses for:**
- Symbol type priority (class > function > method > variable)
- Shorter names (more specific matches)
- Recent usage patterns

### ⚡ **Performance Optimizations**

- **50ms debounce** - Responsive typing without lag
- **5000 symbol limit** - Searches large codebases efficiently  
- **Top 50 results** - Focused, relevant matches
- **Background loading** - Symbols load while you work
- **Smart caching** - Results cached for instant re-filtering

### 🎨 **Visual Features**

- **Symbol icons** - Visual distinction between classes, functions, etc.
- **File context** - Shows file path and line number
- **Preview text** - Function signatures and type annotations
- **Loading indicators** - Clear feedback during symbol loading
- **Error handling** - Graceful fallbacks and helpful error messages

### 🛠️ **Configuration**

Customize the experience in VSCode settings:

```json
{
  "goToSymbol.fuzzyMatch": true,
  "goToSymbol.maxResults": 100,
  "goToSymbol.symbolTypes": ["class", "function", "method", "variable", "enum"],
  "goToSymbol.performance.searchTimeout": 2000,
  "goToSymbol.debug": false
}
```

### 🐛 **Troubleshooting**

If search isn't working:

1. **Check console** - `Cmd+Option+I` for `[Go to Symbol]` logs
2. **Enable debug mode** - Set `goToSymbol.debug: true`
3. **Verify workspace** - Ensure folder is open in VSCode
4. **Check file patterns** - Verify your files match `includePatterns`

### 🎯 **Perfect For**

- **Large Python codebases** with complex class hierarchies
- **Multi-language projects** with mixed file types
- **Fast navigation** when language servers are slow
- **Fuzzy searching** when you remember partial names
- **Type-ahead workflows** for rapid development

The extension now delivers the **instant, responsive symbol search experience** you expect, with enhanced Python support for all your specific use cases!