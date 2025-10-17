/**
 * Main workspace scanner that orchestrates file discovery, caching, and parallel processing
 */

import * as vscode from 'vscode';
import { FileScanner, ScanConfig } from './file-scanner';
import { FileCache, CacheConfig } from './file-cache';
import { ParallelProcessor, ParallelConfig, ProcessingProgress, CancellationToken } from './parallel-processor';
import { FileInfo, Symbol, SearchOptions, SearchResult } from './types';
import { ErrorHandler, ErrorCategory, ErrorSeverity, withErrorHandling, handleErrors } from './error-handler';

/**
 * Configuration for the workspace scanner
 */
export interface WorkspaceScannerConfig {
    scan?: Partial<ScanConfig>;
    cache?: Partial<CacheConfig>;
    parallel?: Partial<ParallelConfig>;
}

/**
 * Main workspace scanner that combines file discovery, caching, and parallel processing
 */
export class WorkspaceScanner {
    private fileScanner: FileScanner;
    private fileCache: FileCache;
    private parallelProcessor: ParallelProcessor;
    private workspaceRoot: string;
    private errorHandler: ErrorHandler;

    constructor(workspaceRoot: string, config?: WorkspaceScannerConfig) {
        this.workspaceRoot = workspaceRoot;
        this.errorHandler = ErrorHandler.getInstance();
        
        // Initialize components
        this.fileCache = new FileCache(config?.cache);
        this.fileScanner = new FileScanner(workspaceRoot, config?.scan);
        this.parallelProcessor = new ParallelProcessor(this.fileCache, config?.parallel);
    }

    /**
     * Scan workspace and extract symbols with progress tracking
     */
    @handleErrors(ErrorCategory.FileSystem, ErrorSeverity.High)
    async scanWorkspace(
        options?: SearchOptions,
        progressCallback?: (progress: ProcessingProgress) => void,
        cancellationToken?: CancellationToken
    ): Promise<Map<string, Symbol[]>> {
        // Phase 1: File discovery
        if (progressCallback) {
            progressCallback({
                total: 0,
                processed: 0,
                failed: 0,
                phase: 'scanning',
                message: 'Discovering files...'
            });
        }

        const files = await withErrorHandling(
            () => this.fileScanner.scanWorkspace(options),
            {
                category: ErrorCategory.FileSystem,
                severity: ErrorSeverity.High,
                context: { operation: 'file_discovery', workspaceRoot: this.workspaceRoot },
                strategy: {
                    retry: true,
                    maxRetries: 2,
                    retryDelay: 1000
                }
            }
        );

        if (!files || files.length === 0) {
            return new Map();
        }
        
        if (cancellationToken?.isCancelled) {
            return new Map();
        }

        // Phase 2: Parallel processing
        const result = await withErrorHandling(
            () => this.parallelProcessor.processFiles(files, options, progressCallback, cancellationToken),
            {
                category: ErrorCategory.Worker,
                severity: ErrorSeverity.High,
                context: { fileCount: files.length },
                strategy: {
                    retry: false, // Don't retry parallel processing
                    notifyUser: true
                }
            }
        );

        return result?.results || new Map();
    }

    /**
     * Get symbols for a specific file (with caching)
     */
    async getFileSymbols(filePath: string): Promise<Symbol[]> {
        try {
            const fileInfo = await this.fileScanner.getFileInfo(filePath);
            
            // Check cache first
            const cachedSymbols = this.fileCache.getCachedSymbols(fileInfo.path, fileInfo.lastModified);
            if (cachedSymbols) {
                return cachedSymbols;
            }

            // Process single file
            const result = await this.parallelProcessor.processFiles([fileInfo]);
            const symbols = result.results.get(filePath) || [];
            
            return symbols;

        } catch (error) {
            console.error(`Error getting symbols for file ${filePath}:`, error);
            return [];
        }
    }

    /**
     * Search for symbols matching a query
     */
    async searchSymbols(
        query: string,
        options?: SearchOptions,
        progressCallback?: (progress: ProcessingProgress) => void,
        cancellationToken?: CancellationToken
    ): Promise<SearchResult[]> {
        try {
            // Get all symbols from workspace
            const symbolsMap = await this.scanWorkspace(options, progressCallback, cancellationToken);
            
            if (cancellationToken?.isCancelled) {
                return [];
            }

            // Convert to search results and filter by query
            const results: SearchResult[] = [];
            const queryLower = query.toLowerCase();
            
            for (const [filePath, symbols] of symbolsMap) {
                for (const symbol of symbols) {
                    // Simple fuzzy matching
                    if (this.matchesQuery(symbol.name, queryLower)) {
                        const result: SearchResult = {
                            symbolName: symbol.name,
                            symbolType: symbol.type,
                            filePath,
                            lineNumber: symbol.line,
                            columnNumber: symbol.column || 0,
                            preview: this.generatePreview(symbol),
                            score: this.calculateScore(symbol.name, query),
                            language: this.detectLanguage(filePath)
                        };
                        
                        results.push(result);
                    }
                }
            }

            // Sort by score (descending)
            results.sort((a, b) => b.score - a.score);
            
            // Apply result limit
            const maxResults = options?.maxResults || 100;
            return results.slice(0, maxResults);

        } catch (error) {
            console.error('Error searching symbols:', error);
            throw new Error(`Symbol search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Invalidate cache for a specific file
     */
    invalidateFile(filePath: string): void {
        this.fileCache.invalidate(filePath);
    }

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.fileCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.fileCache.getStats();
    }

    /**
     * Create a cancellation token for operations
     */
    createCancellationToken(): CancellationToken {
        return this.parallelProcessor.createCancellationToken();
    }

    /**
     * Check if symbol name matches query using fuzzy matching
     */
    private matchesQuery(symbolName: string, queryLower: string): boolean {
        const symbolLower = symbolName.toLowerCase();
        
        // Exact match
        if (symbolLower.includes(queryLower)) {
            return true;
        }
        
        // Fuzzy match - check if all query characters appear in order
        let queryIndex = 0;
        for (let i = 0; i < symbolLower.length && queryIndex < queryLower.length; i++) {
            if (symbolLower[i] === queryLower[queryIndex]) {
                queryIndex++;
            }
        }
        
        return queryIndex === queryLower.length;
    }

    /**
     * Calculate relevance score for a symbol match
     */
    private calculateScore(symbolName: string, query: string): number {
        const symbolLower = symbolName.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact match gets highest score
        if (symbolLower === queryLower) {
            return 1.0;
        }
        
        // Starts with query gets high score
        if (symbolLower.startsWith(queryLower)) {
            return 0.9;
        }
        
        // Contains query gets medium score
        if (symbolLower.includes(queryLower)) {
            return 0.7;
        }
        
        // Fuzzy match gets lower score based on character ratio
        let matches = 0;
        let queryIndex = 0;
        
        for (let i = 0; i < symbolLower.length && queryIndex < queryLower.length; i++) {
            if (symbolLower[i] === queryLower[queryIndex]) {
                matches++;
                queryIndex++;
            }
        }
        
        if (queryIndex === queryLower.length) {
            return 0.3 + (matches / symbolName.length) * 0.4;
        }
        
        return 0;
    }

    /**
     * Generate preview text for a symbol
     */
    private generatePreview(symbol: Symbol): string {
        let preview = symbol.name;
        
        if (symbol.signature) {
            preview = symbol.signature;
        } else if (symbol.type === 'function' || symbol.type === 'method') {
            preview += '()';
        } else if (symbol.type === 'class') {
            preview = `class ${preview}`;
        }
        
        if (symbol.parent) {
            preview = `${symbol.parent}.${preview}`;
        }
        
        return preview;
    }

    /**
     * Detect programming language from file path
     */
    private detectLanguage(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        
        const languageMap: Record<string, string> = {
            'py': 'python',
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript'
        };
        
        return languageMap[ext || ''] || 'text';
    }
}