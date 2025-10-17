import * as vscode from 'vscode';
import { SearchController } from './search-controller';
import { SearchOptions, SearchResult, SymbolType, Symbol } from './types';
import { ConfigurationManager } from './config-manager';
import { ErrorHandler, ErrorCategory, ErrorSeverity, withErrorHandling } from './error-handler';
import { ProgressManager, ProgressType, FeedbackType } from './progress-manager';

let searchController: SearchController | undefined;
let configManager: ConfigurationManager;
let errorHandler: ErrorHandler;
let progressManager: ProgressManager;

/**
 * This method is called when the extension is activated
 * The extension is activated the very first time the command is executed
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('[Go to Symbol] Extension is now active');
    
    // Debug: Log all registered commands
    vscode.commands.getCommands().then(commands => {
        const ourCommands = commands.filter(cmd => cmd.startsWith('go-to-symbol'));
        console.log('[Go to Symbol] Our registered commands:', ourCommands);
    });

    try {
        // Initialize error handler
        errorHandler = ErrorHandler.getInstance();
        
        // Initialize progress manager
        progressManager = ProgressManager.getInstance();
        
        // Initialize configuration manager
        configManager = ConfigurationManager.getInstance();

        // Configure fallback based on settings
        const config = configManager.getConfiguration();
        errorHandler.setFallbackEnabled(config.enableFallback);

        // Initialize search controller if workspace is available
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            console.log('[Go to Symbol] Initializing search controller for workspace:', workspaceRoot);
            searchController = new SearchController(workspaceRoot, getSearchControllerConfig());
            console.log('[Go to Symbol] Search controller initialized successfully');
        } else {
            console.log('[Go to Symbol] No workspace folder found');
        }
    } catch (error) {
        console.error('Failed to initialize Enhanced Symbol Search:', error);
        vscode.window.showErrorMessage(
            'Enhanced Symbol Search failed to initialize. Some features may not work correctly.',
            'OK'
        );
    }

    // Register the enhanced symbol search command
    console.log('Registering go-to-symbol.search command');
    const searchCommand = vscode.commands.registerCommand('go-to-symbol.search', async () => {
        console.log('go-to-symbol.search command executed');
        await withErrorHandling(
            () => executeEnhancedSymbolSearch(),
            {
                category: ErrorCategory.VSCode,
                severity: ErrorSeverity.High,
                strategy: {
                    useFallback: true,
                    notifyUser: true
                }
            }
        );
    });

    // Register clear cache command
    const clearCacheCommand = vscode.commands.registerCommand('go-to-symbol.clearCache', async () => {
        try {
            if (searchController) {
                await progressManager.withProgress(
                    {
                        type: ProgressType.StatusBar,
                        title: 'Clearing cache',
                        cancellable: false
                    },
                    async (progress) => {
                        progress({ message: 'Clearing symbol cache...' });
                        searchController!.clearCache();
                        progress({ message: 'Cache cleared', increment: 100 });
                    }
                );
                
                await progressManager.showFeedback({
                    type: FeedbackType.Success,
                    message: 'Enhanced Symbol Search cache cleared successfully.'
                });
            } else {
                await progressManager.showFeedback({
                    type: FeedbackType.Warning,
                    message: 'No active search controller to clear cache.'
                });
            }
        } catch (error) {
            await progressManager.showErrorWithRecovery(
                error instanceof Error ? error : new Error('Unknown error'),
                'Failed to clear cache'
            );
        }
    });

    // Register error statistics command (for debugging)
    const showErrorStatsCommand = vscode.commands.registerCommand('go-to-symbol.showErrorStats', async () => {
        try {
            const stats = errorHandler.getErrorStats();
            const message = `Error Statistics:\nTotal: ${stats.totalErrors}\nRecent errors: ${stats.recentErrors.length}`;
            
            const selection = await progressManager.showFeedback({
                type: FeedbackType.Info,
                message,
                actions: ['Clear Log', 'View Details', 'OK']
            });

            if (selection === 'Clear Log') {
                errorHandler.clearErrorLog();
                await progressManager.showFeedback({
                    type: FeedbackType.Success,
                    message: 'Error log cleared.'
                });
            } else if (selection === 'View Details') {
                // Show detailed error information
                const recentErrors = stats.recentErrors.map(err => 
                    `${err.category}: ${err.message}`
                ).join('\n');
                
                await progressManager.showFeedback({
                    type: FeedbackType.Info,
                    message: `Recent Errors:\n${recentErrors || 'No recent errors'}`
                });
            }
        } catch (error) {
            console.error('Failed to show error stats:', error);
        }
    });

    // Register configuration change listener
    const configChangeListener = configManager.onConfigurationChanged((newConfig) => {
        updateSearchControllerConfig();
        if (newConfig.debug) {
            console.log('[Enhanced Symbol Search] Configuration updated:', newConfig);
        }
    });

    // Register workspace change listener
    const workspaceChangeListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        initializeSearchController();
    });

    context.subscriptions.push(
        searchCommand,
        clearCacheCommand,
        showErrorStatsCommand,
        configChangeListener,
        workspaceChangeListener,
        configManager,
        progressManager
    );
}

/**
 * Execute the enhanced symbol search command with real-time search
 */
async function executeEnhancedSymbolSearch(): Promise<void> {
    if (!searchController) {
        // Try to initialize if not already done
        await withErrorHandling(
            () => initializeSearchController(),
            {
                category: ErrorCategory.Configuration,
                context: { operation: 'initialize_search_controller' }
            }
        );
        
        if (!searchController) {
            await errorHandler.triggerFallback();
            return;
        }
    }

    try {
        // Show real-time search QuickPick
        await showRealTimeSearchPicker();
    } catch (error) {
        await errorHandler.handleError(
            error instanceof Error ? error : new Error('Unknown error'),
            {
                useFallback: true,
                notifyUser: true
            }
        );
    }
}

/**
 * Initialize or reinitialize the search controller
 */
async function initializeSearchController(): Promise<void> {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            searchController = new SearchController(workspaceRoot, getSearchControllerConfig());
        } else {
            searchController = undefined;
            throw new Error('No workspace folder found');
        }
    } catch (error) {
        await errorHandler.handleError(
            error instanceof Error ? error : new Error('Failed to initialize search controller'),
            {
                notifyUser: false // Don't notify here, let caller handle it
            }
        );
        throw error;
    }
}

/**
 * Update search controller configuration when settings change
 */
function updateSearchControllerConfig(): void {
    if (searchController) {
        searchController.updateConfig(getSearchControllerConfig());
    }
}

/**
 * Get search controller configuration from configuration manager
 */
function getSearchControllerConfig() {
    const config = configManager.getConfiguration();
    
    return {
        defaultSearchOptions: {
            maxResults: config.maxResults,
            fuzzyMatch: config.fuzzyMatch,
            symbolTypes: config.symbolTypes as SymbolType[],
            filePatterns: config.includePatterns,
            excludePatterns: config.excludePatterns,
            timeoutMs: config.performance.searchTimeout
        },
        searchTimeoutMs: config.performance.searchTimeout,
        performance: config.performance,
        customPatterns: config.customPatterns,
        enableFallback: config.enableFallback,
        debug: config.debug
    };
}

/**
 * Get search options from configuration manager
 */
function getSearchOptionsFromConfig(): SearchOptions {
    const config = configManager.getConfiguration();
    
    return {
        maxResults: config.maxResults,
        fuzzyMatch: config.fuzzyMatch,
        symbolTypes: config.symbolTypes as SymbolType[],
        filePatterns: config.includePatterns,
        excludePatterns: config.excludePatterns,
        timeoutMs: config.performance.searchTimeout
    };
}

/**
 * Show real-time search picker with live filtering
 */
async function showRealTimeSearchPicker(): Promise<void> {
    console.log('[Go to Symbol] Starting simple search picker...');
    
    // Create QuickPick
    const quickPick = vscode.window.createQuickPick<SearchResultQuickPickItem>();
    quickPick.title = 'Go to Symbol';
    quickPick.placeholder = 'Type to search symbols (e.g., class, def, AccTran)...';
    quickPick.matchOnDescription = false;
    quickPick.matchOnDetail = false;
    
    // Simple direct search approach - search as user types
    let searchTimeout: NodeJS.Timeout;
    quickPick.onDidChangeValue((query) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            if (!query.trim()) {
                quickPick.items = [{
                    label: '$(info) Start typing to search symbols',
                    description: 'Enter class names, function names, or any symbol',
                    detail: '',
                    searchResult: null as any
                }];
                return;
            }

            console.log('[Go to Symbol] Searching for:', query);
            quickPick.busy = true;
            
            try {
                // Simple direct file search using VSCode's built-in capabilities
                const results = await simpleSymbolSearch(query);
                console.log('[Go to Symbol] Found', results.length, 'results');
                
                if (results.length === 0) {
                    quickPick.items = [{
                        label: '$(info) No symbols found',
                        description: `No matches for "${query}"`,
                        detail: 'Try a different search term',
                        searchResult: null as any
                    }];
                } else {
                    const quickPickItems: SearchResultQuickPickItem[] = results.map(result => ({
                        label: `$(symbol-${getSymbolIcon(result.symbolType)}) ${result.symbolName}`,
                        description: result.preview,
                        detail: `${result.language} • ${getRelativePath(result.filePath)} • Line ${result.lineNumber + 1}`,
                        searchResult: result
                    }));
                    quickPick.items = quickPickItems;
                }
            } catch (error) {
                console.error('[Go to Symbol] Search error:', error);
                quickPick.items = [{
                    label: '$(error) Search failed',
                    description: 'Check console for details',
                    detail: String(error),
                    searchResult: null as any
                }];
            } finally {
                quickPick.busy = false;
            }
        }, 300); // Reasonable debounce for typing
    });

    // Handle selection
    quickPick.onDidAccept(async () => {
        const selectedItem = quickPick.selectedItems[0];
        if (selectedItem && selectedItem.searchResult) {
            await navigateToSymbol(selectedItem.searchResult);
        }
        quickPick.hide();
    });

    // Handle escape/cancel
    quickPick.onDidHide(() => {
        clearTimeout(searchTimeout);
        quickPick.dispose();
    });

    // Show the QuickPick
    quickPick.show();
}

/**
 * Simple symbol search using VSCode's file search and basic regex patterns
 */
async function simpleSymbolSearch(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    try {
        // Get workspace files using VSCode's built-in search
        const files = await vscode.workspace.findFiles(
            '**/*.{py,js,ts,jsx,tsx,java,cs,cpp,c,h}',
            '**/node_modules/**',
            100 // Limit files for performance
        );
        
        console.log('[Go to Symbol] Found', files.length, 'files to search');
        
        // Search each file for symbols
        for (const file of files.slice(0, 20)) { // Limit to first 20 files for now
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();
                const fileResults = extractSymbolsFromContent(content, file.fsPath, query);
                results.push(...fileResults);
                
                if (results.length >= 50) break; // Limit total results
            } catch (error) {
                console.log('[Go to Symbol] Error reading file:', file.fsPath, error);
            }
        }
        
        // Sort by relevance
        return results.sort((a, b) => b.score - a.score);
        
    } catch (error) {
        console.error('[Go to Symbol] File search error:', error);
        return [];
    }
}

/**
 * Extract symbols from file content using simple regex patterns
 */
function extractSymbolsFromContent(content: string, filePath: string, query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = content.split('\n');
    const queryLower = query.toLowerCase();
    
    // Simple patterns for different symbol types
    const patterns = [
        // Python class
        { regex: /^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)/g, type: 'class' as SymbolType },
        // Python function/method
        { regex: /^(\s*)def\s+([A-Za-z_][A-Za-z0-9_]*)/g, type: 'function' as SymbolType },
        // Python enum
        { regex: /^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*Enum[^)]*\)/g, type: 'enum' as SymbolType },
        // Python variable with type annotation
        { regex: /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z]/g, type: 'variable' as SymbolType },
        // JavaScript/TypeScript class
        { regex: /^(\s*)(?:export\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/g, type: 'class' as SymbolType },
        // JavaScript/TypeScript function
        { regex: /^(\s*)(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/g, type: 'function' as SymbolType },
        // JavaScript/TypeScript interface
        { regex: /^(\s*)(?:export\s+)?interface\s+([A-Za-z_][A-Za-z0-9_]*)/g, type: 'interface' as SymbolType }
    ];
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        for (const pattern of patterns) {
            pattern.regex.lastIndex = 0; // Reset regex
            const match = pattern.regex.exec(line);
            
            if (match && match[2]) {
                const symbolName = match[2];
                const symbolNameLower = symbolName.toLowerCase();
                
                // Check if symbol matches query
                let score = 0;
                if (symbolNameLower.includes(queryLower)) {
                    if (symbolNameLower === queryLower) score = 100;
                    else if (symbolNameLower.startsWith(queryLower)) score = 90;
                    else if (matchesFuzzyPattern(symbolName, query)) score = 80;
                    else score = 70;
                    
                    results.push({
                        symbolName,
                        symbolType: pattern.type,
                        filePath,
                        lineNumber: lineIndex,
                        columnNumber: match.index || 0,
                        preview: line.trim(),
                        score,
                        language: detectLanguageFromPath(filePath),
                        context: {
                            signature: line.trim()
                        }
                    });
                }
            }
        }
    }
    
    return results;
}

/**
 * Filter symbols in real-time with enhanced matching for Python
 */
function filterSymbolsRealTime(symbols: SearchResult[], query: string): SearchResult[] {
    if (!query.trim()) {
        return symbols.slice(0, 100);
    }

    const queryLower = query.toLowerCase();
    const results: Array<SearchResult & { matchScore: number }> = [];

    // Limit search to first 5000 symbols for performance
    const searchSymbols = symbols.slice(0, 5000);

    for (const symbol of searchSymbols) {
        const symbolNameLower = symbol.symbolName.toLowerCase();
        let score = 0;

        // Exact match (highest priority)
        if (symbolNameLower === queryLower) {
            score = 1000;
        }
        // Starts with query
        else if (symbolNameLower.startsWith(queryLower)) {
            score = 900;
        }
        // Contains query as substring
        else if (symbolNameLower.includes(queryLower)) {
            score = 800;
        }
        // Fuzzy match for camelCase/PascalCase (e.g., "AccTran" matches "AccountTransaction")
        else if (matchesFuzzyPattern(symbol.symbolName, query)) {
            score = 700;
        }
        // Word boundary matches (e.g., "Account" matches "AccountTransaction")
        else if (matchesWordBoundary(symbolNameLower, queryLower)) {
            score = 600;
        }

        if (score > 0) {
            // Boost score based on symbol type priority
            const typeBoost = getSymbolTypeBoost(symbol.symbolType);
            score += typeBoost;
            
            // Boost for shorter names (more specific)
            score += Math.max(0, 50 - symbol.symbolName.length);
            
            results.push({ ...symbol, matchScore: score });
        }
    }

    // Sort by score and return top results
    return results
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 50) // Reduced for better performance
        .map(({ matchScore, ...result }) => result);
}

/**
 * Check if symbol matches fuzzy pattern (camelCase/PascalCase matching)
 */
function matchesFuzzyPattern(symbolName: string, query: string): boolean {
    // Convert query to regex pattern for fuzzy matching
    // "AccTran" becomes /A.*c.*c.*T.*r.*a.*n/i
    const pattern = query
        .split('')
        .map(char => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*');
    
    const regex = new RegExp(pattern, 'i');
    return regex.test(symbolName);
}

/**
 * Check if query matches word boundaries in symbol name
 */
function matchesWordBoundary(symbolNameLower: string, queryLower: string): boolean {
    // Split symbol name by common separators and check if any part starts with query
    const parts = symbolNameLower.split(/[_\-\s]/);
    return parts.some(part => part.startsWith(queryLower));
}

/**
 * Get boost score based on symbol type
 */
function getSymbolTypeBoost(symbolType: string): number {
    const boosts: Record<string, number> = {
        'class': 50,
        'function': 40,
        'method': 35,
        'interface': 30,
        'enum': 25,
        'property': 20,
        'variable': 10,
        'type': 15
    };
    return boosts[symbolType] || 0;
}

/**
 * Show search results in QuickPick interface (legacy function, kept for compatibility)
 */
async function showSearchResults(results: SearchResult[], query: string): Promise<void> {
    if (results.length === 0) {
        const selection = await progressManager.showFeedback({
            type: FeedbackType.Info,
            message: `No symbols found for "${query}"`,
            actions: ['Try Different Query', 'Use Default Search', 'OK']
        });

        if (selection === 'Try Different Query') {
            // Re-trigger search command
            vscode.commands.executeCommand('go-to-symbol.search');
        } else if (selection === 'Use Default Search') {
            await errorHandler.triggerFallback(query);
        }
        return;
    }

    // Create QuickPick items from search results
    const quickPickItems: SearchResultQuickPickItem[] = results.map(result => ({
        label: `$(symbol-${getSymbolIcon(result.symbolType)}) ${result.symbolName}`,
        description: result.preview,
        detail: `${result.language} • ${getRelativePath(result.filePath)} • Line ${result.lineNumber + 1}`,
        searchResult: result
    }));

    // Create and configure QuickPick
    const quickPick = vscode.window.createQuickPick<SearchResultQuickPickItem>();
    quickPick.title = `Enhanced Symbol Search: "${query}"`;
    quickPick.placeholder = 'Select a symbol to navigate to';
    quickPick.items = quickPickItems;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;

    // Handle selection
    quickPick.onDidAccept(async () => {
        const selectedItem = quickPick.selectedItems[0];
        if (selectedItem) {
            await navigateToSymbol(selectedItem.searchResult);
        }
        quickPick.hide();
    });

    // Handle escape/cancel
    quickPick.onDidHide(() => {
        quickPick.dispose();
    });

    // Show the QuickPick
    quickPick.show();
}

/**
 * Interface for QuickPick items containing search results
 */
interface SearchResultQuickPickItem extends vscode.QuickPickItem {
    searchResult: SearchResult;
}

/**
 * Get appropriate icon name for symbol type
 */
function getSymbolIcon(symbolType: string): string {
    const iconMap: Record<string, string> = {
        'class': 'class',
        'function': 'method',
        'method': 'method',
        'variable': 'variable',
        'interface': 'interface',
        'property': 'property',
        'enum': 'enum',
        'type': 'type-hierarchy'
    };
    
    return iconMap[symbolType] || 'symbol-misc';
}

/**
 * Get relative path from workspace root
 */
function getRelativePath(absolutePath: string): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot && absolutePath.startsWith(workspaceRoot)) {
        return absolutePath.substring(workspaceRoot.length + 1);
    }
    return absolutePath;
}

/**
 * Detect language from file path
 */
function detectLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
        'py': 'python',
        'pyi': 'python',
        'pyx': 'python',
        'js': 'javascript',
        'ts': 'typescript',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'java': 'java',
        'cs': 'csharp',
        'cpp': 'cpp',
        'c': 'c',
        'h': 'c',
        'hpp': 'cpp'
    };
    
    return languageMap[ext || ''] || 'text';
}

/**
 * Navigate to the selected symbol
 */
async function navigateToSymbol(result: SearchResult): Promise<void> {
    try {
        // Convert file path to URI
        const fileUri = vscode.Uri.file(result.filePath);
        
        // Check if file exists
        try {
            await vscode.workspace.fs.stat(fileUri);
        } catch (error) {
            await errorHandler.handleFileSystemError(
                error instanceof Error ? error : new Error('File not found'),
                result.filePath,
                'access'
            );
            return;
        }

        // Create position for the symbol location
        const position = new vscode.Position(result.lineNumber, result.columnNumber);
        
        // Create range for selection (select the symbol name)
        const symbolNameLength = result.symbolName.length;
        const range = new vscode.Range(
            position,
            new vscode.Position(result.lineNumber, result.columnNumber + symbolNameLength)
        );

        // Open the document
        const document = await vscode.workspace.openTextDocument(fileUri);
        
        // Show the document in editor
        const editor = await vscode.window.showTextDocument(document, {
            selection: range,
            viewColumn: vscode.ViewColumn.Active
        });

        // Reveal the range in the editor (scroll to it if needed)
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

        // Show success feedback
        progressManager.showQuickStatus(
            `✓ Navigated to ${result.symbolType} "${result.symbolName}" in ${getRelativePath(result.filePath)}`,
            3000
        );

    } catch (error) {
        // Try fallback navigation
        try {
            const fileUri = vscode.Uri.file(result.filePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
            
            await progressManager.showFeedback({
                type: FeedbackType.Warning,
                message: `Opened file but could not navigate to exact symbol location`
            });
        } catch (fallbackError) {
            await progressManager.showErrorWithRecovery(
                fallbackError instanceof Error ? fallbackError : new Error('Navigation failed'),
                'Failed to open file'
            );
        }
    }
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {
    console.log('Enhanced Symbol Search extension is now deactivated');
}