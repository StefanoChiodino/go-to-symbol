/**
 * Core data models and interfaces for the Enhanced Symbol Search extension
 */

/**
 * Supported symbol types in the codebase
 */
export type SymbolType = 'class' | 'function' | 'variable' | 'interface' | 'method' | 'property' | 'enum' | 'type';

/**
 * Represents a search result containing symbol information and location
 */
export interface SearchResult {
    /** The name of the symbol found */
    symbolName: string;
    
    /** The type of symbol (class, function, variable, etc.) */
    symbolType: SymbolType;
    
    /** Absolute path to the file containing the symbol */
    filePath: string;
    
    /** Line number where the symbol is defined (0-based) */
    lineNumber: number;
    
    /** Column number where the symbol starts (0-based) */
    columnNumber: number;
    
    /** Preview text showing the symbol definition */
    preview: string;
    
    /** Relevance score for ranking results (higher = more relevant) */
    score: number;
    
    /** Programming language of the file */
    language: string;
    
    /** Optional additional context information */
    context?: {
        /** Parent class or namespace if applicable */
        parent?: string;
        
        /** Function signature or variable type */
        signature?: string;
        
        /** Decorators or annotations */
        decorators?: string[];
    };
}

/**
 * Configuration options for symbol search
 */
export interface SearchOptions {
    /** Filter results to specific symbol types */
    symbolTypes?: SymbolType[];
    
    /** File patterns to include in search (glob patterns) */
    filePatterns?: string[];
    
    /** File patterns to exclude from search (glob patterns) */
    excludePatterns?: string[];
    
    /** Enable fuzzy matching for symbol names */
    fuzzyMatch?: boolean;
    
    /** Maximum number of results to return */
    maxResults?: number;
    
    /** Case sensitive search */
    caseSensitive?: boolean;
    
    /** Search in specific directories only */
    searchPaths?: string[];
    
    /** Timeout for search operation in milliseconds */
    timeoutMs?: number;
}

/**
 * Pattern definition for matching symbols in code
 */
export interface SymbolPattern {
    /** The type of symbol this pattern matches */
    type: SymbolType;
    
    /** Regular expression pattern for matching the symbol */
    pattern: RegExp;
    
    /** Capture group indices for extracting symbol information */
    captureGroups: {
        /** Index of capture group containing the symbol name */
        name: number;
        
        /** Index of capture group containing the symbol type (optional) */
        type?: number;
        
        /** Index of capture group containing the parent/namespace (optional) */
        parent?: number;
        
        /** Index of capture group containing the signature (optional) */
        signature?: number;
    };
    
    /** Priority for this pattern when multiple patterns match */
    priority?: number;
    
    /** Additional flags for pattern matching behavior */
    flags?: {
        /** Whether this pattern should be case sensitive */
        caseSensitive?: boolean;
        
        /** Whether this pattern supports multiline matching */
        multiline?: boolean;
    };
}

/**
 * Information about a file in the workspace
 */
export interface FileInfo {
    /** Absolute path to the file */
    path: string;
    
    /** File size in bytes */
    size: number;
    
    /** Last modified timestamp */
    lastModified: number;
    
    /** Programming language detected from file extension */
    language: string;
    
    /** Whether the file is currently cached */
    isCached?: boolean;
}

/**
 * Represents a symbol found in code
 */
export interface Symbol {
    /** Symbol name */
    name: string;
    
    /** Symbol type */
    type: SymbolType;
    
    /** Line number where symbol is defined */
    line: number;
    
    /** Column number where symbol starts */
    column: number;
    
    /** End line number */
    endLine?: number;
    
    /** End column number */
    endColumn?: number;
    
    /** Parent symbol (for methods in classes, etc.) */
    parent?: string;
    
    /** Full signature or definition */
    signature?: string;
    
    /** Decorators or annotations */
    decorators?: string[];
    
    /** Visibility modifier (public, private, protected) */
    visibility?: 'public' | 'private' | 'protected';
}

/**
 * Result of pattern matching operation
 */
export interface Match {
    /** The matched symbol */
    symbol: Symbol;
    
    /** Match score (0-1, higher is better) */
    score: number;
    
    /** Matched text excerpt */
    matchedText: string;
    
    /** Start position of match in text */
    startIndex: number;
    
    /** End position of match in text */
    endIndex: number;
}

/**
 * Cache entry for storing parsed file results
 */
export interface CacheEntry {
    /** File path */
    filePath: string;
    
    /** Last modified timestamp when cached */
    lastModified: number;
    
    /** Cached symbols from the file */
    symbols: Symbol[];
    
    /** Cache creation timestamp */
    cachedAt: number;
}