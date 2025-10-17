/**
 * Result processor for ranking and deduplicating search results
 * Implements advanced algorithms for relevance scoring and duplicate removal
 */

import { SearchResult, SymbolType, SearchOptions } from './types';

/**
 * Configuration for result processing
 */
export interface ResultProcessorConfig {
    /** Enable deduplication */
    enableDeduplication?: boolean;
    
    /** Scoring weights for different factors */
    scoringWeights?: {
        /** Weight for exact name matches */
        exactMatch?: number;
        
        /** Weight for prefix matches */
        prefixMatch?: number;
        
        /** Weight for substring matches */
        substringMatch?: number;
        
        /** Weight for fuzzy matches */
        fuzzyMatch?: number;
        
        /** Weight for symbol type priority */
        symbolType?: number;
        
        /** Weight for name length (shorter is better) */
        nameLength?: number;
        
        /** Weight for file path relevance */
        filePath?: number;
        
        /** Weight for context relevance */
        context?: number;
    };
    
    /** Symbol type priorities (lower number = higher priority) */
    symbolTypePriorities?: Record<SymbolType, number>;
    
    /** Deduplication strategy */
    deduplicationStrategy?: 'strict' | 'fuzzy' | 'location-based';
    
    /** Minimum score threshold for results */
    minScoreThreshold?: number;
}

/**
 * Represents a duplicate group for deduplication
 */
interface DuplicateGroup {
    /** Representative result (highest scored) */
    representative: SearchResult;
    
    /** All duplicates in this group */
    duplicates: SearchResult[];
    
    /** Confidence that these are actually duplicates */
    confidence: number;
}

/**
 * Result processor that handles ranking and deduplication of search results
 */
export class ResultProcessor {
    private config: Required<ResultProcessorConfig>;

    constructor(config: ResultProcessorConfig = {}) {
        this.config = {
            enableDeduplication: config.enableDeduplication ?? true,
            scoringWeights: {
                exactMatch: 100,
                prefixMatch: 80,
                substringMatch: 60,
                fuzzyMatch: 40,
                symbolType: 20,
                nameLength: 15,
                filePath: 10,
                context: 5,
                ...config.scoringWeights
            },
            symbolTypePriorities: {
                'class': 1,
                'interface': 2,
                'type': 3,
                'enum': 4,
                'function': 5,
                'method': 6,
                'property': 7,
                'variable': 8,
                ...config.symbolTypePriorities
            },
            deduplicationStrategy: config.deduplicationStrategy ?? 'fuzzy',
            minScoreThreshold: config.minScoreThreshold ?? 0.1
        };
    }

    /**
     * Process search results: rank, deduplicate, and filter
     */
    processResults(
        results: SearchResult[],
        query: string,
        options: SearchOptions = {}
    ): SearchResult[] {
        // Phase 1: Enhanced scoring
        const scoredResults = this.enhanceScoring(results, query);

        // Phase 2: Deduplication
        let processedResults = scoredResults;
        if (this.config.enableDeduplication) {
            processedResults = this.deduplicateResults(scoredResults);
        }

        // Phase 3: Final ranking
        const rankedResults = this.rankResults(processedResults, query);

        // Phase 4: Apply filters and thresholds
        return this.applyFilters(rankedResults, options);
    }

    /**
     * Enhance scoring with multiple relevance factors
     */
    private enhanceScoring(results: SearchResult[], query: string): SearchResult[] {
        return results.map(result => {
            const enhancedScore = this.calculateEnhancedScore(result, query);
            return {
                ...result,
                score: enhancedScore
            };
        });
    }

    /**
     * Calculate enhanced relevance score using multiple factors
     */
    private calculateEnhancedScore(result: SearchResult, query: string): number {
        let totalScore = 0;
        const weights = this.config.scoringWeights;

        // Factor 1: Name matching score
        const nameScore = this.calculateNameMatchScore(result.symbolName, query);
        totalScore += nameScore * this.getWeightForMatchType(nameScore);

        // Factor 2: Symbol type priority
        const typePriority = this.config.symbolTypePriorities[result.symbolType] || 10;
        const typeScore = Math.max(0, 10 - typePriority) / 10;
        totalScore += typeScore * (weights.symbolType || 0);

        // Factor 3: Name length bonus (shorter names are more specific)
        const lengthScore = Math.max(0, 1 - (result.symbolName.length / 50));
        totalScore += lengthScore * (weights.nameLength || 0);

        // Factor 4: File path relevance
        const pathScore = this.calculateFilePathScore(result.filePath, query);
        totalScore += pathScore * (weights.filePath || 0);

        // Factor 5: Context relevance
        const contextScore = this.calculateContextScore(result, query);
        totalScore += contextScore * (weights.context || 0);

        // Factor 6: Original score from pattern matching
        totalScore += result.score * 50; // Scale original score

        // Normalize to 0-1 range
        const maxPossibleScore = (weights.exactMatch || 0) + (weights.symbolType || 0) + 
                                (weights.nameLength || 0) + (weights.filePath || 0) + 
                                (weights.context || 0) + 50;
        
        return Math.min(totalScore / maxPossibleScore, 1);
    }

    /**
     * Calculate name matching score with different match types
     */
    private calculateNameMatchScore(symbolName: string, query: string): number {
        const symbolLower = symbolName.toLowerCase();
        const queryLower = query.toLowerCase();

        // Exact match
        if (symbolLower === queryLower) {
            return 1.0;
        }

        // Prefix match
        if (symbolLower.startsWith(queryLower)) {
            return 0.9;
        }

        // Substring match
        if (symbolLower.includes(queryLower)) {
            const position = symbolLower.indexOf(queryLower);
            // Earlier positions get higher scores
            return 0.7 - (position / symbolName.length) * 0.2;
        }

        // Fuzzy match (all characters present in order)
        if (this.isFuzzyMatch(symbolLower, queryLower)) {
            return this.calculateFuzzyScore(symbolLower, queryLower);
        }

        return 0;
    }

    /**
     * Get appropriate weight based on match type score
     */
    private getWeightForMatchType(score: number): number {
        const weights = this.config.scoringWeights;
        
        if (score >= 1.0) return weights.exactMatch || 0;
        if (score >= 0.9) return weights.prefixMatch || 0;
        if (score >= 0.7) return weights.substringMatch || 0;
        return weights.fuzzyMatch || 0;
    }

    /**
     * Check if query fuzzy matches symbol name
     */
    private isFuzzyMatch(symbolName: string, query: string): boolean {
        let queryIndex = 0;
        
        for (let i = 0; i < symbolName.length && queryIndex < query.length; i++) {
            if (symbolName[i] === query[queryIndex]) {
                queryIndex++;
            }
        }
        
        return queryIndex === query.length;
    }

    /**
     * Calculate fuzzy match score based on character density and gaps
     */
    private calculateFuzzyScore(symbolName: string, query: string): number {
        let queryIndex = 0;
        let lastMatchIndex = -1;
        let gapPenalty = 0;
        
        for (let i = 0; i < symbolName.length && queryIndex < query.length; i++) {
            if (symbolName[i] === query[queryIndex]) {
                if (lastMatchIndex >= 0) {
                    const gap = i - lastMatchIndex - 1;
                    gapPenalty += gap * 0.1;
                }
                lastMatchIndex = i;
                queryIndex++;
            }
        }
        
        if (queryIndex < query.length) {
            return 0; // Not a complete match
        }
        
        // Base score for fuzzy match, reduced by gap penalty
        const baseScore = 0.5;
        const densityBonus = query.length / symbolName.length * 0.2;
        
        return Math.max(0.1, baseScore + densityBonus - gapPenalty);
    }

    /**
     * Calculate file path relevance score
     */
    private calculateFilePathScore(filePath: string, query: string): number {
        const fileName = filePath.split('/').pop() || '';
        const fileNameLower = fileName.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Bonus if query appears in file name
        if (fileNameLower.includes(queryLower)) {
            return 0.8;
        }
        
        // Bonus for certain file types
        if (fileName.endsWith('.py')) {
            return 0.6; // Python files get slight bonus
        }
        
        // Penalty for deeply nested files (may be less relevant)
        const depth = filePath.split('/').length;
        return Math.max(0.1, 0.5 - (depth * 0.05));
    }

    /**
     * Calculate context relevance score
     */
    private calculateContextScore(result: SearchResult, query: string): number {
        let score = 0;
        const queryLower = query.toLowerCase();
        
        // Check parent context
        if (result.context?.parent) {
            const parentLower = result.context.parent.toLowerCase();
            if (parentLower.includes(queryLower)) {
                score += 0.5;
            }
        }
        
        // Check signature context
        if (result.context?.signature) {
            const signatureLower = result.context.signature.toLowerCase();
            if (signatureLower.includes(queryLower)) {
                score += 0.3;
            }
        }
        
        // Check decorators
        if (result.context?.decorators) {
            for (const decorator of result.context.decorators) {
                if (decorator.toLowerCase().includes(queryLower)) {
                    score += 0.2;
                    break;
                }
            }
        }
        
        return Math.min(score, 1.0);
    }

    /**
     * Deduplicate results using the configured strategy
     */
    private deduplicateResults(results: SearchResult[]): SearchResult[] {
        switch (this.config.deduplicationStrategy) {
            case 'strict':
                return this.strictDeduplication(results);
            case 'fuzzy':
                return this.fuzzyDeduplication(results);
            case 'location-based':
                return this.locationBasedDeduplication(results);
            default:
                return results;
        }
    }

    /**
     * Strict deduplication: exact name and location match
     */
    private strictDeduplication(results: SearchResult[]): SearchResult[] {
        const seen = new Map<string, SearchResult>();
        
        for (const result of results) {
            const key = `${result.symbolName}:${result.filePath}:${result.lineNumber}`;
            const existing = seen.get(key);
            
            if (!existing || result.score > existing.score) {
                seen.set(key, result);
            }
        }
        
        return Array.from(seen.values());
    }

    /**
     * Fuzzy deduplication: similar names and nearby locations
     */
    private fuzzyDeduplication(results: SearchResult[]): SearchResult[] {
        const groups = this.groupSimilarResults(results);
        return groups.map(group => group.representative);
    }

    /**
     * Location-based deduplication: same file and nearby lines
     */
    private locationBasedDeduplication(results: SearchResult[]): SearchResult[] {
        const groups: SearchResult[][] = [];
        
        for (const result of results) {
            let addedToGroup = false;
            
            for (const group of groups) {
                const representative = group[0];
                
                if (representative.filePath === result.filePath &&
                    Math.abs(representative.lineNumber - result.lineNumber) <= 2) {
                    group.push(result);
                    addedToGroup = true;
                    break;
                }
            }
            
            if (!addedToGroup) {
                groups.push([result]);
            }
        }
        
        // Return the highest scored result from each group
        return groups.map(group => 
            group.reduce((best, current) => 
                current.score > best.score ? current : best
            )
        );
    }

    /**
     * Group similar results for fuzzy deduplication
     */
    private groupSimilarResults(results: SearchResult[]): DuplicateGroup[] {
        const groups: DuplicateGroup[] = [];
        
        for (const result of results) {
            let addedToGroup = false;
            
            for (const group of groups) {
                const similarity = this.calculateSimilarity(result, group.representative);
                
                if (similarity > 0.8) { // High similarity threshold
                    group.duplicates.push(result);
                    
                    // Update representative if this result has higher score
                    if (result.score > group.representative.score) {
                        group.duplicates.push(group.representative);
                        group.representative = result;
                    }
                    
                    addedToGroup = true;
                    break;
                }
            }
            
            if (!addedToGroup) {
                groups.push({
                    representative: result,
                    duplicates: [],
                    confidence: 1.0
                });
            }
        }
        
        return groups;
    }

    /**
     * Calculate similarity between two search results
     */
    private calculateSimilarity(result1: SearchResult, result2: SearchResult): number {
        let similarity = 0;
        
        // Name similarity (most important)
        const nameSim = this.calculateStringSimilarity(result1.symbolName, result2.symbolName);
        similarity += nameSim * 0.5;
        
        // Type similarity
        const typeSim = result1.symbolType === result2.symbolType ? 1 : 0;
        similarity += typeSim * 0.2;
        
        // File similarity
        const fileSim = result1.filePath === result2.filePath ? 1 : 0;
        similarity += fileSim * 0.2;
        
        // Location similarity (if same file)
        if (result1.filePath === result2.filePath) {
            const lineDiff = Math.abs(result1.lineNumber - result2.lineNumber);
            const locationSim = Math.max(0, 1 - (lineDiff / 10));
            similarity += locationSim * 0.1;
        }
        
        return similarity;
    }

    /**
     * Calculate string similarity using Levenshtein distance
     */
    private calculateStringSimilarity(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;
        
        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;
        
        const matrix: number[][] = [];
        
        // Initialize matrix
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
        // Fill matrix
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }
        
        const distance = matrix[len1][len2];
        const maxLen = Math.max(len1, len2);
        
        return 1 - (distance / maxLen);
    }

    /**
     * Rank results using multiple criteria
     */
    private rankResults(results: SearchResult[], query: string): SearchResult[] {
        return results.sort((a, b) => {
            // Primary: score (descending)
            const scoreDiff = b.score - a.score;
            if (Math.abs(scoreDiff) > 0.01) {
                return scoreDiff;
            }
            
            // Secondary: symbol type priority
            const aPriority = this.config.symbolTypePriorities[a.symbolType] || 10;
            const bPriority = this.config.symbolTypePriorities[b.symbolType] || 10;
            const priorityDiff = aPriority - bPriority;
            if (priorityDiff !== 0) {
                return priorityDiff;
            }
            
            // Tertiary: name length (shorter is better)
            const lengthDiff = a.symbolName.length - b.symbolName.length;
            if (lengthDiff !== 0) {
                return lengthDiff;
            }
            
            // Quaternary: alphabetical order
            return a.symbolName.localeCompare(b.symbolName);
        });
    }

    /**
     * Apply final filters and thresholds
     */
    private applyFilters(results: SearchResult[], options: SearchOptions): SearchResult[] {
        let filtered = results;
        
        // Apply minimum score threshold
        filtered = filtered.filter(result => result.score >= this.config.minScoreThreshold);
        
        // Filter by symbol types if specified
        if (options.symbolTypes && options.symbolTypes.length > 0) {
            filtered = filtered.filter(result => 
                options.symbolTypes!.includes(result.symbolType)
            );
        }
        
        // Apply result limit
        if (options.maxResults) {
            filtered = filtered.slice(0, options.maxResults);
        }
        
        return filtered;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ResultProcessorConfig>): void {
        this.config = {
            ...this.config,
            ...newConfig,
            scoringWeights: {
                ...this.config.scoringWeights,
                ...newConfig.scoringWeights
            },
            symbolTypePriorities: {
                ...this.config.symbolTypePriorities,
                ...newConfig.symbolTypePriorities
            }
        };
    }

    /**
     * Get current configuration
     */
    getConfig(): ResultProcessorConfig {
        return { ...this.config };
    }
}