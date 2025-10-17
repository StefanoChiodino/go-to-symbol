/**
 * Language processor interface and base classes for symbol extraction
 */

import { Symbol, SymbolPattern, Match, SymbolType } from './types';

/**
 * Interface for language-specific symbol processors
 */
export interface LanguageProcessor {
    /**
     * Get the language identifier this processor handles
     */
    getLanguage(): string;
    
    /**
     * Get symbol patterns for this language
     */
    getSymbolPatterns(): SymbolPattern[];
    
    /**
     * Extract symbols from file content
     * @param content File content to parse
     * @param filePath Path to the file being processed
     * @returns Array of symbols found in the content
     */
    extractSymbols(content: string, filePath: string): Symbol[];
    
    /**
     * Match symbols against a search query
     * @param symbols Array of symbols to search through
     * @param query Search query string
     * @param fuzzyMatch Whether to use fuzzy matching
     * @returns Array of matches with scores
     */
    matchQuery(symbols: Symbol[], query: string, fuzzyMatch?: boolean): Match[];
    
    /**
     * Check if this processor can handle the given file
     * @param filePath Path to the file
     * @param language Language identifier
     * @returns True if this processor can handle the file
     */
    canProcess(filePath: string, language: string): boolean;
}

/**
 * Abstract base class for language processors
 */
export abstract class BaseLanguageProcessor implements LanguageProcessor {
    protected readonly language: string;
    protected readonly fileExtensions: string[];
    
    constructor(language: string, fileExtensions: string[]) {
        this.language = language;
        this.fileExtensions = fileExtensions;
    }
    
    getLanguage(): string {
        return this.language;
    }
    
    canProcess(filePath: string, language: string): boolean {
        // Check by language identifier first
        if (language === this.language) {
            return true;
        }
        
        // Fallback to file extension check
        const extension = this.getFileExtension(filePath);
        return this.fileExtensions.includes(extension);
    }
    
    /**
     * Generate fuzzy regex pattern from query
     * Converts "AccInv" to "Acc.*Inv.*" pattern
     */
    protected generateFuzzyPattern(query: string): RegExp {
        // Escape special regex characters except for intentional wildcards
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Split into characters and join with .* for fuzzy matching
        const fuzzyPattern = escaped.split('').join('.*');
        
        return new RegExp(fuzzyPattern, 'i');
    }
    
    /**
     * Calculate match score based on various factors
     */
    protected calculateScore(symbol: Symbol, query: string, matchedText: string): number {
        let score = 0;
        
        const symbolName = symbol.name.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact match gets highest score
        if (symbolName === queryLower) {
            score += 100;
        }
        // Starts with query gets high score
        else if (symbolName.startsWith(queryLower)) {
            score += 80;
        }
        // Contains query gets medium score
        else if (symbolName.includes(queryLower)) {
            score += 60;
        }
        // Fuzzy match gets lower score
        else {
            score += 40;
        }
        
        // Bonus for shorter names (more specific)
        score += Math.max(0, 20 - symbolName.length);
        
        // Bonus for certain symbol types
        switch (symbol.type) {
            case 'class':
                score += 10;
                break;
            case 'function':
                score += 8;
                break;
            case 'method':
                score += 6;
                break;
            case 'interface':
                score += 5;
                break;
            default:
                score += 2;
        }
        
        // Normalize score to 0-1 range
        return Math.min(score / 100, 1);
    }
    
    /**
     * Extract file extension from path
     */
    protected getFileExtension(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot > 0 ? filePath.substring(lastDot) : '';
    }
    
    /**
     * Create a symbol object with common properties
     */
    protected createSymbol(
        name: string,
        type: SymbolType,
        line: number,
        column: number,
        signature?: string,
        parent?: string
    ): Symbol {
        return {
            name,
            type,
            line,
            column,
            signature,
            parent,
            visibility: 'public' // Default visibility
        };
    }
    
    // Abstract methods that must be implemented by subclasses
    abstract getSymbolPatterns(): SymbolPattern[];
    abstract extractSymbols(content: string, filePath: string): Symbol[];
    
    /**
     * Default implementation of matchQuery using fuzzy matching
     */
    matchQuery(symbols: Symbol[], query: string, fuzzyMatch: boolean = true): Match[] {
        const matches: Match[] = [];
        
        const pattern = fuzzyMatch ? this.generateFuzzyPattern(query) : new RegExp(query, 'i');
        
        for (const symbol of symbols) {
            const match = pattern.exec(symbol.name);
            if (match) {
                const score = this.calculateScore(symbol, query, match[0]);
                matches.push({
                    symbol,
                    score,
                    matchedText: match[0],
                    startIndex: match.index || 0,
                    endIndex: (match.index || 0) + match[0].length
                });
            }
        }
        
        // Sort by score descending
        return matches.sort((a, b) => b.score - a.score);
    }
}

/**
 * Generic text processor for unsupported languages
 * Provides basic pattern matching as a fallback
 */
export class GenericTextProcessor extends BaseLanguageProcessor {
    constructor() {
        super('text', ['.txt', '.md', '.log']);
    }
    
    getSymbolPatterns(): SymbolPattern[] {
        return [
            {
                type: 'function',
                pattern: /^[\s]*(?:function|def|fn)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm,
                captureGroups: { name: 1 }
            },
            {
                type: 'class',
                pattern: /^[\s]*(?:class|struct|interface)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm,
                captureGroups: { name: 1 }
            },
            {
                type: 'variable',
                pattern: /^[\s]*(?:var|let|const|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm,
                captureGroups: { name: 1 }
            }
        ];
    }
    
    extractSymbols(content: string, filePath: string): Symbol[] {
        const symbols: Symbol[] = [];
        const patterns = this.getSymbolPatterns();
        
        for (const pattern of patterns) {
            let match;
            const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
            
            while ((match = regex.exec(content)) !== null) {
                const name = match[pattern.captureGroups.name];
                if (name) {
                    const lineNumber = this.getLineNumber(content, match.index || 0);
                    const columnNumber = this.getColumnNumber(content, match.index || 0);
                    
                    symbols.push(this.createSymbol(
                        name,
                        pattern.type,
                        lineNumber,
                        columnNumber,
                        match[0].trim()
                    ));
                }
            }
        }
        
        return symbols;
    }
    
    canProcess(filePath: string, language: string): boolean {
        // Generic processor can handle any file as fallback
        return true;
    }
    
    /**
     * Calculate line number from character index
     */
    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split('\n').length - 1;
    }
    
    /**
     * Calculate column number from character index
     */
    private getColumnNumber(content: string, index: number): number {
        const beforeIndex = content.substring(0, index);
        const lastNewline = beforeIndex.lastIndexOf('\n');
        return lastNewline === -1 ? index : index - lastNewline - 1;
    }
}

// Export Python processor
export { PythonProcessor } from './python-processor';