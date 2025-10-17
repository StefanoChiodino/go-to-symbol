/**
 * Search controller that orchestrates the enhanced symbol search functionality
 * Coordinates between file scanner, pattern matcher, and language processors
 */

import * as vscode from 'vscode';
import { WorkspaceScanner, WorkspaceScannerConfig } from './workspace-scanner';
import { PatternMatcher, PatternMatcherConfig } from './pattern-matcher';
import { LanguageProcessor, GenericTextProcessor } from './language-processor';
import { PythonProcessor } from './python-processor';
import { ResultProcessor, ResultProcessorConfig } from './result-processor';
import { SearchResult, SearchOptions, Symbol, Match, SymbolType } from './types';
import { ProcessingProgress, CancellationToken } from './parallel-processor';
import { ErrorHandler, ErrorCategory, ErrorSeverity, withErrorHandling, handleErrors } from './error-handler';

/**
 * Configuration for the search controller
 */
export interface SearchControllerConfig {
    /** Workspace scanner configuration */
    workspace?: WorkspaceScannerConfig;
    
    /** Pattern matcher configuration */
    patternMatcher?: PatternMatcherConfig;
    
    /** Result processor configuration */
    resultProcessor?: ResultProcessorConfig;
    
    /** Default search options */
    defaultSearchOptions?: Partial<SearchOptions>;
    
    /** Maximum search timeout in milliseconds */
    searchTimeoutMs?: number;
    
    /** Performance configuration */
    performance?: {
        maxFileSize: number;
        maxFiles: number;
        searchTimeout: number;
        cacheSize: number;
        parallelWorkers: number;
    };
    
    /** Custom regex patterns for different languages */
    customPatterns?: Record<string, {
        class?: string;
        function?: string;
        variable?: string;
    }>;
    
    /** Enable fallback to VSCode's default symbol search */
    enableFallback?: boolean;
    
    /** Enable debug logging */
    debug?: boolean;
}

/**
 * Main search controller that orchestrates the enhanced symbol search
 */
export class SearchController {
    private workspaceScanner: WorkspaceScanner;
    private patternMatcher: PatternMatcher;
    private resultProcessor: ResultProcessor;
    private languageProcessors: Map<string, LanguageProcessor>;
    private config: Required<SearchControllerConfig>;
    private workspaceRoot: string;
    private errorHandler: ErrorHandler;

    constructor(workspaceRoot: string, config: SearchControllerConfig = {}) {
        this.workspaceRoot = workspaceRoot;
        this.errorHandler = ErrorHandler.getInstance();
        
        // Set default configuration
        this.config = {
            workspace: config.workspace || {},
            patternMatcher: config.patternMatcher || {},
            resultProcessor: config.resultProcessor || {},
            defaultSearchOptions: {
                maxResults: 100,
                fuzzyMatch: true,
                caseSensitive: false,
                timeoutMs: 5000,
                ...config.defaultSearchOptions
            },
            searchTimeoutMs: config.searchTimeoutMs ?? 2000,
            performance: {
                maxFileSize: 1048576,
                maxFiles: 10000,
                searchTimeout: 5000,
                cacheSize: 1000,
                parallelWorkers: 4,
                ...config.performance
            },
            customPatterns: config.customPatterns || {},
            enableFallback: config.enableFallback ?? true,
            debug: config.debug ?? false
        };

        // Initialize components
        this.workspaceScanner = new WorkspaceScanner(workspaceRoot, this.config.workspace);
        this.patternMatcher = new PatternMatcher(this.config.patternMatcher);
        this.resultProcessor = new ResultProcessor(this.config.resultProcessor);
        
        // Initialize language processors
        this.languageProcessors = new Map();
        this.initializeLanguageProcessors();
    }

    /**
     * Execute a symbol search with the given query and options
     */
    @handleErrors(ErrorCategory.Search, ErrorSeverity.High)
    async executeSearch(
        query: string,
        options: SearchOptions = {},
        progressCallback?: (progress: ProcessingProgress) => void,
        cancellationToken?: CancellationToken
    ): Promise<SearchResult[]> {
        // Validate input
        if (!query || query.trim().length === 0) {
            return [];
        }

        // Merge with default options
        const searchOptions: SearchOptions = {
            ...this.config.defaultSearchOptions,
            ...options
        };

        // Create cancellation token if not provided
        const token = cancellationToken || this.workspaceScanner.createCancellationToken();

        // Set up timeout handling
        const timeoutPromise = new Promise<SearchResult[]>((_, reject) => {
            setTimeout(() => {
                token.cancel();
                reject(new Error(`Search timeout after ${this.config.searchTimeoutMs}ms`));
            }, this.config.searchTimeoutMs);
        });

        try {
            // Execute search with timeout
            const searchPromise = this.performSearch(query, searchOptions, progressCallback, token);
            const results = await Promise.race([searchPromise, timeoutPromise]);
            
            return results;
        } catch (error) {
            if (error instanceof Error && error.message.includes('timeout')) {
                await this.errorHandler.handleTimeoutError(
                    'symbol search',
                    this.config.searchTimeoutMs,
                    { query, options: searchOptions }
                );
            }
            throw error;
        }
    }

    /**
     * Perform the actual search operation
     */
    private async performSearch(
        query: string,
        options: SearchOptions,
        progressCallback?: (progress: ProcessingProgress) => void,
        cancellationToken?: CancellationToken
    ): Promise<SearchResult[]> {
        // Phase 1: Scan workspace and get symbols
        if (progressCallback) {
            progressCallback({
                total: 0,
                processed: 0,
                failed: 0,
                phase: 'scanning',
                message: 'Scanning workspace for symbols...'
            });
        }

        const symbolsMap = await withErrorHandling(
            () => this.workspaceScanner.scanWorkspace(options, progressCallback, cancellationToken),
            {
                category: ErrorCategory.FileSystem,
                severity: ErrorSeverity.High,
                context: { operation: 'workspace_scan', query },
                strategy: {
                    retry: true,
                    maxRetries: 1,
                    retryDelay: 1000
                }
            }
        );

        if (!symbolsMap) {
            return []; // Error occurred during scanning
        }

        if (cancellationToken?.isCancelled) {
            return [];
        }

        // Phase 2: Process symbols with language-specific processors
        if (progressCallback) {
            progressCallback({
                total: symbolsMap.size,
                processed: 0,
                failed: 0,
                phase: 'processing',
                message: 'Processing symbols with language processors...'
            });
        }

        const allMatches: Match[] = [];
        let processedFiles = 0;

        for (const [filePath, symbols] of symbolsMap) {
            if (cancellationToken?.isCancelled) {
                break;
            }

            const matches = await withErrorHandling(
                async () => {
                    // Get appropriate language processor
                    const language = this.detectLanguage(filePath);
                    const processor = this.getLanguageProcessor(language);

                    // Match symbols using the processor
                    return processor.matchQuery(symbols, query, options.fuzzyMatch);
                },
                {
                    category: ErrorCategory.Pattern,
                    severity: ErrorSeverity.Low,
                    context: { filePath, symbolCount: symbols.length }
                }
            );

            if (matches) {
                // Convert matches to search results
                for (const match of matches) {
                    allMatches.push({
                        ...match,
                        symbol: {
                            ...match.symbol,
                            // Ensure we have the file path context
                        }
                    });
                }
            }

            processedFiles++;
            if (progressCallback) {
                progressCallback({
                    total: symbolsMap.size,
                    processed: processedFiles,
                    failed: matches ? 0 : 1,
                    phase: 'processing',
                    message: `Processed ${processedFiles}/${symbolsMap.size} files`
                });
            }
        }

        // Phase 3: Convert matches to search results
        const searchResults = this.convertMatchesToResults(allMatches, symbolsMap);

        // Phase 4: Process results (rank, deduplicate, filter)
        return this.resultProcessor.processResults(searchResults, query, options);
    }

    /**
     * Convert matches to search results with file context
     */
    private convertMatchesToResults(matches: Match[], symbolsMap: Map<string, Symbol[]>): SearchResult[] {
        const results: SearchResult[] = [];

        // Create a reverse lookup map for symbols to file paths
        const symbolToFileMap = new Map<Symbol, string>();
        for (const [filePath, symbols] of symbolsMap) {
            for (const symbol of symbols) {
                symbolToFileMap.set(symbol, filePath);
            }
        }

        for (const match of matches) {
            const filePath = symbolToFileMap.get(match.symbol);
            if (!filePath) {
                continue; // Skip if we can't find the file path
            }

            const result: SearchResult = {
                symbolName: match.symbol.name,
                symbolType: match.symbol.type,
                filePath,
                lineNumber: match.symbol.line,
                columnNumber: match.symbol.column || 0,
                preview: this.generatePreview(match.symbol),
                score: match.score,
                language: this.detectLanguage(filePath),
                context: {
                    parent: match.symbol.parent,
                    signature: match.symbol.signature,
                    decorators: match.symbol.decorators
                }
            };

            results.push(result);
        }

        return results;
    }



    /**
     * Initialize language processors
     */
    private initializeLanguageProcessors(): void {
        // Add Python processor
        const pythonProcessor = new PythonProcessor();
        this.languageProcessors.set('python', pythonProcessor);

        // Add generic text processor as fallback
        const genericProcessor = new GenericTextProcessor();
        this.languageProcessors.set('text', genericProcessor);
    }

    /**
     * Get appropriate language processor for a file
     */
    private getLanguageProcessor(language: string): LanguageProcessor {
        // Try to get specific processor first
        const processor = this.languageProcessors.get(language);
        if (processor) {
            return processor;
        }

        // Fallback to generic text processor
        return this.languageProcessors.get('text')!;
    }

    /**
     * Detect programming language from file path
     */
    private detectLanguage(filePath: string): string {
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
     * Generate preview text for a symbol
     */
    private generatePreview(symbol: Symbol): string {
        if (symbol.signature) {
            return symbol.signature;
        }

        let preview = symbol.name;
        
        switch (symbol.type) {
            case 'function':
            case 'method':
                preview += '()';
                break;
            case 'class':
                preview = `class ${preview}`;
                break;
            case 'interface':
                preview = `interface ${preview}`;
                break;
            case 'type':
                preview = `type ${preview}`;
                break;
            case 'enum':
                preview = `enum ${preview}`;
                break;
        }
        
        if (symbol.parent) {
            preview = `${symbol.parent}.${preview}`;
        }
        
        return preview;
    }

    /**
     * Convert search result back to symbol for pattern matching
     */
    private convertResultToSymbol(result: SearchResult): Symbol {
        return {
            name: result.symbolName,
            type: result.symbolType,
            line: result.lineNumber,
            column: result.columnNumber,
            signature: result.context?.signature,
            parent: result.context?.parent,
            decorators: result.context?.decorators
        };
    }



    /**
     * Clear all caches
     */
    clearCache(): void {
        this.workspaceScanner.clearCache();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.workspaceScanner.getCacheStats();
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<SearchControllerConfig>): void {
        this.config = {
            ...this.config,
            ...newConfig,
            defaultSearchOptions: {
                ...this.config.defaultSearchOptions,
                ...newConfig.defaultSearchOptions
            },
            performance: {
                ...this.config.performance,
                ...newConfig.performance
            }
        };

        if (this.config.debug) {
            console.log('[Enhanced Symbol Search] Configuration updated:', this.config);
        }

        // Update component configs if provided
        if (newConfig.patternMatcher) {
            this.patternMatcher.updateConfig(newConfig.patternMatcher);
        }
        
        if (newConfig.resultProcessor) {
            this.resultProcessor.updateConfig(newConfig.resultProcessor);
        }
        
        // Note: WorkspaceScanner configuration updates would require re-initialization
        // This could be implemented in the future if dynamic config updates are needed
    }

    /**
     * Get current configuration
     */
    getConfig(): SearchControllerConfig {
        return { ...this.config };
    }

    /**
     * Get all symbols from the workspace without filtering
     */
    async getAllSymbols(options: SearchOptions = {}): Promise<Map<string, Symbol[]>> {
        // Merge with default options
        const searchOptions: SearchOptions = {
            ...this.config.defaultSearchOptions,
            ...options
        };

        // Create cancellation token
        const token = this.workspaceScanner.createCancellationToken();

        try {
            // Scan workspace and get all symbols
            const symbolsMap = await this.workspaceScanner.scanWorkspace(searchOptions, undefined, token);
            return symbolsMap || new Map();
        } catch (error) {
            console.error('Error getting all symbols:', error);
            return new Map();
        }
    }

    /**
     * Create a cancellation token for search operations
     */
    createCancellationToken(): CancellationToken {
        return this.workspaceScanner.createCancellationToken();
    }
}