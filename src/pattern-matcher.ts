/**
 * Pattern matching engine for enhanced symbol search
 * Handles fuzzy pattern generation and symbol matching with scoring
 */

import { Symbol, Match, SymbolType, SearchOptions } from './types';

/**
 * Configuration for pattern matching behavior
 */
export interface PatternMatcherConfig {
    /** Enable case-sensitive matching */
    caseSensitive?: boolean;
    
    /** Maximum number of results to return */
    maxResults?: number;
    
    /** Minimum score threshold for results */
    minScore?: number;
    
    /** Weight factors for different scoring criteria */
    scoreWeights?: {
        exactMatch?: number;
        startsWith?: number;
        contains?: number;
        fuzzyMatch?: number;
        symbolType?: number;
        nameLength?: number;
    };
}

/**
 * Pattern matching engine that provides fuzzy search capabilities
 */
export class PatternMatcher {
    private config: Required<PatternMatcherConfig>;
    
    constructor(config: PatternMatcherConfig = {}) {
        this.config = {
            caseSensitive: config.caseSensitive ?? false,
            maxResults: config.maxResults ?? 100,
            minScore: config.minScore ?? 0.1,
            scoreWeights: {
                exactMatch: config.scoreWeights?.exactMatch ?? 100,
                startsWith: config.scoreWeights?.startsWith ?? 80,
                contains: config.scoreWeights?.contains ?? 60,
                fuzzyMatch: config.scoreWeights?.fuzzyMatch ?? 40,
                symbolType: config.scoreWeights?.symbolType ?? 10,
                nameLength: config.scoreWeights?.nameLength ?? 20,
                ...config.scoreWeights
            }
        };
    }
    
    /**
     * Generate fuzzy regex pattern from user query
     * Converts "AccInv" to "Acc.*Inv.*" pattern for flexible matching
     * 
     * @param query User search query
     * @param symbolType Optional symbol type for type-specific patterns
     * @returns RegExp pattern for fuzzy matching
     */
    generateFuzzyPattern(query: string, symbolType?: SymbolType): RegExp {
        if (!query || query.trim().length === 0) {
            return new RegExp('.*', this.config.caseSensitive ? 'g' : 'gi');
        }
        
        // Clean and escape the query
        const cleanQuery = query.trim();
        
        // Handle different pattern styles based on symbol type
        let pattern = this.createTypeSpecificPattern(cleanQuery, symbolType);
        
        // Create regex flags
        const flags = this.config.caseSensitive ? 'g' : 'gi';
        
        try {
            return new RegExp(pattern, flags);
        } catch (error) {
            // Fallback to simple pattern if regex creation fails
            console.warn('Failed to create regex pattern, using fallback:', error);
            return new RegExp(this.escapeRegex(cleanQuery), flags);
        }
    }
    
    /**
     * Create type-specific patterns for different symbol types
     */
    private createTypeSpecificPattern(query: string, symbolType?: SymbolType): string {
        // Escape special regex characters
        const escaped = this.escapeRegex(query);
        
        switch (symbolType) {
            case 'class':
                // For classes, support PascalCase patterns like "AccInv" -> "Acc.*Inv.*"
                return this.createCamelCasePattern(escaped);
                
            case 'function':
            case 'method':
                // For functions, support both camelCase and snake_case
                return this.createFunctionPattern(escaped);
                
            case 'variable':
            case 'property':
                // For variables, support camelCase, snake_case, and CONSTANT_CASE
                return this.createVariablePattern(escaped);
                
            case 'interface':
            case 'type':
                // Similar to classes but may have different naming conventions
                return this.createCamelCasePattern(escaped);
                
            default:
                // Generic fuzzy pattern for unknown types
                return this.createGenericFuzzyPattern(escaped);
        }
    }
    
    /**
     * Create pattern for PascalCase/camelCase symbols
     */
    private createCamelCasePattern(query: string): string {
        // Split on uppercase letters to handle camelCase/PascalCase
        const parts = query.split(/(?=[A-Z])/).filter(part => part.length > 0);
        
        if (parts.length > 1) {
            // Join parts with .* for fuzzy matching: "AccInv" -> "Acc.*Inv.*"
            return parts.join('.*') + '.*';
        }
        
        // Single part - create character-level fuzzy pattern
        return this.createGenericFuzzyPattern(query);
    }
    
    /**
     * Create pattern for function names (camelCase and snake_case)
     */
    private createFunctionPattern(query: string): string {
        // Handle both camelCase and snake_case
        if (query.includes('_')) {
            // snake_case: split on underscores
            const parts = query.split('_').filter(part => part.length > 0);
            return parts.join('.*') + '.*';
        } else {
            // camelCase: use camelCase pattern
            return this.createCamelCasePattern(query);
        }
    }
    
    /**
     * Create pattern for variable names (multiple naming conventions)
     */
    private createVariablePattern(query: string): string {
        // Support CONSTANT_CASE, snake_case, and camelCase
        if (query.toUpperCase() === query && query.includes('_')) {
            // CONSTANT_CASE
            const parts = query.split('_').filter(part => part.length > 0);
            return parts.join('.*') + '.*';
        } else if (query.includes('_')) {
            // snake_case
            const parts = query.split('_').filter(part => part.length > 0);
            return parts.join('.*') + '.*';
        } else {
            // camelCase
            return this.createCamelCasePattern(query);
        }
    }
    
    /**
     * Create generic character-level fuzzy pattern
     */
    private createGenericFuzzyPattern(query: string): string {
        // Split into characters and join with .* for maximum flexibility
        return query.split('').join('.*') + '.*';
    }
    
    /**
     * Escape special regex characters
     */
    private escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    /**
     * Match symbols against a query with scoring
     * 
     * @param symbols Array of symbols to search
     * @param query Search query
     * @param options Search options
     * @returns Array of matches sorted by relevance score
     */
    matchSymbols(symbols: Symbol[], query: string, options: SearchOptions = {}): Match[] {
        if (!query || query.trim().length === 0) {
            return [];
        }
        
        const matches: Match[] = [];
        const fuzzyMatch = options.fuzzyMatch ?? true;
        
        // Filter symbols by type if specified
        const filteredSymbols = options.symbolTypes 
            ? symbols.filter(symbol => options.symbolTypes!.includes(symbol.type))
            : symbols;
        
        for (const symbol of filteredSymbols) {
            const match = this.matchSingleSymbol(symbol, query, fuzzyMatch);
            if (match && match.score >= this.config.minScore) {
                matches.push(match);
            }
        }
        
        // Sort by score (descending) and limit results
        const sortedMatches = matches
            .sort((a, b) => b.score - a.score)
            .slice(0, options.maxResults ?? this.config.maxResults);
        
        return sortedMatches;
    }
    
    /**
     * Match a single symbol against the query
     */
    private matchSingleSymbol(symbol: Symbol, query: string, fuzzyMatch: boolean): Match | null {
        const symbolName = this.config.caseSensitive ? symbol.name : symbol.name.toLowerCase();
        const queryLower = this.config.caseSensitive ? query : query.toLowerCase();
        
        let matchResult: RegExpExecArray | null = null;
        let matchType: 'exact' | 'startsWith' | 'contains' | 'fuzzy' = 'fuzzy';
        
        // Try different matching strategies in order of preference
        if (symbolName === queryLower) {
            // Exact match
            matchResult = Object.assign([symbolName], { 0: symbolName, index: 0, input: symbolName, groups: undefined });
            matchType = 'exact';
        } else if (symbolName.startsWith(queryLower)) {
            // Starts with match
            matchResult = Object.assign([queryLower], { 0: queryLower, index: 0, input: symbolName, groups: undefined });
            matchType = 'startsWith';
        } else if (symbolName.includes(queryLower)) {
            // Contains match
            const index = symbolName.indexOf(queryLower);
            matchResult = Object.assign([queryLower], { 0: queryLower, index, input: symbolName, groups: undefined });
            matchType = 'contains';
        } else if (fuzzyMatch) {
            // Fuzzy match
            const pattern = this.generateFuzzyPattern(query, symbol.type);
            matchResult = pattern.exec(symbolName);
            matchType = 'fuzzy';
        }
        
        if (!matchResult) {
            return null;
        }
        
        const score = this.calculateMatchScore(symbol, query, matchResult, matchType);
        
        return {
            symbol,
            score,
            matchedText: matchResult[0],
            startIndex: matchResult.index || 0,
            endIndex: (matchResult.index || 0) + matchResult[0].length
        };
    }
    
    /**
     * Calculate relevance score for a match
     */
    private calculateMatchScore(
        symbol: Symbol, 
        query: string, 
        matchResult: RegExpExecArray, 
        matchType: 'exact' | 'startsWith' | 'contains' | 'fuzzy'
    ): number {
        let score = 0;
        const weights = this.config.scoreWeights;
        
        // Base score based on match type
        switch (matchType) {
            case 'exact':
                score += weights.exactMatch!;
                break;
            case 'startsWith':
                score += weights.startsWith!;
                break;
            case 'contains':
                score += weights.contains!;
                break;
            case 'fuzzy':
                score += weights.fuzzyMatch!;
                break;
        }
        
        // Bonus for symbol type priority
        score += this.getSymbolTypeBonus(symbol.type) * weights.symbolType!;
        
        // Bonus for shorter names (more specific matches)
        const lengthBonus = Math.max(0, weights.nameLength! - symbol.name.length);
        score += lengthBonus;
        
        // Bonus for match position (earlier matches are better)
        const positionBonus = Math.max(0, 10 - (matchResult.index || 0));
        score += positionBonus;
        
        // Bonus for match coverage (how much of the symbol name is matched)
        const coverage = matchResult[0].length / symbol.name.length;
        score += coverage * 10;
        
        // Normalize score to 0-1 range
        return Math.min(score / 150, 1);
    }
    
    /**
     * Get bonus points for different symbol types
     */
    private getSymbolTypeBonus(symbolType: SymbolType): number {
        switch (symbolType) {
            case 'class':
                return 10;
            case 'interface':
                return 9;
            case 'function':
                return 8;
            case 'method':
                return 7;
            case 'type':
                return 6;
            case 'enum':
                return 5;
            case 'property':
                return 4;
            case 'variable':
                return 3;
            default:
                return 1;
        }
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<PatternMatcherConfig>): void {
        this.config = {
            ...this.config,
            ...newConfig,
            scoreWeights: {
                ...this.config.scoreWeights,
                ...newConfig.scoreWeights
            }
        };
    }
    
    /**
     * Get current configuration
     */
    getConfig(): PatternMatcherConfig {
        return { ...this.config };
    }
}