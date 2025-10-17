/**
 * LRU cache implementation for file contents and parsed symbols
 */

import * as fs from 'fs/promises';
import { CacheEntry, Symbol, FileInfo } from './types';
import { ErrorHandler, ErrorCategory, ErrorSeverity, withErrorHandling, handleErrors } from './error-handler';

/**
 * Configuration for the file cache
 */
export interface CacheConfig {
    /** Maximum number of files to cache */
    maxFiles: number;
    
    /** Maximum memory usage in bytes */
    maxMemoryBytes: number;
    
    /** Time-to-live for cache entries in milliseconds */
    ttlMs: number;
    
    /** Enable cache statistics tracking */
    enableStats: boolean;
}

/**
 * Cache statistics for monitoring performance
 */
export interface CacheStats {
    hits: number;
    misses: number;
    evictions: number;
    totalSize: number;
    memoryUsage: number;
}

/**
 * Internal cache entry with metadata
 */
interface InternalCacheEntry extends CacheEntry {
    /** Size of cached content in bytes */
    size: number;
    
    /** Last access timestamp for LRU tracking */
    lastAccessed: number;
    
    /** Raw file content */
    content?: string;
}

/**
 * LRU cache for file contents and parsed symbols with modification time tracking
 */
export class FileCache {
    private cache = new Map<string, InternalCacheEntry>();
    private config: CacheConfig;
    private stats: CacheStats;
    private errorHandler: ErrorHandler;

    constructor(config?: Partial<CacheConfig>) {
        this.errorHandler = ErrorHandler.getInstance();
        this.config = {
            maxFiles: 1000,
            maxMemoryBytes: 100 * 1024 * 1024, // 100MB
            ttlMs: 30 * 60 * 1000, // 30 minutes
            enableStats: true,
            ...config
        };
        
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalSize: 0,
            memoryUsage: 0
        };
    }

    /**
     * Get cached symbols for a file, or null if not cached or invalid
     */
    getCachedSymbols(filePath: string, lastModified: number): Symbol[] | null {
        const entry = this.cache.get(filePath);
        
        if (!entry) {
            this.incrementStat('misses');
            return null;
        }

        // Check if cache entry is still valid
        if (entry.lastModified !== lastModified || this.isExpired(entry)) {
            this.cache.delete(filePath);
            this.updateMemoryUsage();
            this.incrementStat('misses');
            return null;
        }

        // Update access time for LRU
        entry.lastAccessed = Date.now();
        this.incrementStat('hits');
        
        return entry.symbols;
    }

    /**
     * Get cached file content, or null if not cached or invalid
     */
    getCachedContent(filePath: string, lastModified: number): string | null {
        const entry = this.cache.get(filePath);
        
        if (!entry || !entry.content) {
            this.incrementStat('misses');
            return null;
        }

        // Check if cache entry is still valid
        if (entry.lastModified !== lastModified || this.isExpired(entry)) {
            this.cache.delete(filePath);
            this.updateMemoryUsage();
            this.incrementStat('misses');
            return null;
        }

        // Update access time for LRU
        entry.lastAccessed = Date.now();
        this.incrementStat('hits');
        
        return entry.content;
    }

    /**
     * Cache symbols for a file
     */
    cacheSymbols(filePath: string, symbols: Symbol[], lastModified: number): void {
        const now = Date.now();
        const size = this.estimateSymbolsSize(symbols);
        
        const entry: InternalCacheEntry = {
            filePath,
            lastModified,
            symbols,
            cachedAt: now,
            lastAccessed: now,
            size
        };

        this.addEntry(filePath, entry);
    }

    /**
     * Cache file content and symbols together
     */
    cacheFile(filePath: string, content: string, symbols: Symbol[], lastModified: number): void {
        const now = Date.now();
        const contentSize = Buffer.byteLength(content, 'utf8');
        const symbolsSize = this.estimateSymbolsSize(symbols);
        const totalSize = contentSize + symbolsSize;
        
        const entry: InternalCacheEntry = {
            filePath,
            lastModified,
            symbols,
            cachedAt: now,
            lastAccessed: now,
            size: totalSize,
            content
        };

        this.addEntry(filePath, entry);
    }

    /**
     * Read file content with caching
     */
    @handleErrors(ErrorCategory.FileSystem, ErrorSeverity.Medium)
    async readFileContent(fileInfo: FileInfo): Promise<string> {
        // Try to get from cache first
        const cachedContent = this.getCachedContent(fileInfo.path, fileInfo.lastModified);
        if (cachedContent !== null) {
            return cachedContent;
        }

        // Read from file system
        const content = await withErrorHandling(
            () => fs.readFile(fileInfo.path, 'utf8'),
            {
                category: ErrorCategory.FileSystem,
                severity: ErrorSeverity.Medium,
                context: { filePath: fileInfo.path, fileSize: fileInfo.size },
                strategy: {
                    retry: true,
                    maxRetries: 2,
                    retryDelay: 500
                }
            }
        );

        if (!content) {
            throw new Error(`Failed to read file content: ${fileInfo.path}`);
        }
        
        // Cache the content (without symbols for now)
        const now = Date.now();
        const size = Buffer.byteLength(content, 'utf8');
        
        // Check if adding this file would exceed memory limits
        if (this.stats.memoryUsage + size > this.config.maxMemoryBytes) {
            await this.errorHandler.handleResourceError(
                new Error('Cache memory limit would be exceeded'),
                'memory',
                { currentUsage: this.stats.memoryUsage, fileSize: size, limit: this.config.maxMemoryBytes }
            );
            
            // Force eviction to make room
            this.evictIfNecessary();
        }
        
        const entry: InternalCacheEntry = {
            filePath: fileInfo.path,
            lastModified: fileInfo.lastModified,
            symbols: [], // Will be populated later when symbols are parsed
            cachedAt: now,
            lastAccessed: now,
            size,
            content
        };

        this.addEntry(fileInfo.path, entry);
        
        return content;
    }

    /**
     * Invalidate cache entry for a specific file
     */
    invalidate(filePath: string): void {
        if (this.cache.has(filePath)) {
            this.cache.delete(filePath);
            this.updateMemoryUsage();
        }
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.stats.totalSize = 0;
        this.stats.memoryUsage = 0;
    }

    /**
     * Get current cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Get cache hit ratio
     */
    getHitRatio(): number {
        const total = this.stats.hits + this.stats.misses;
        return total > 0 ? this.stats.hits / total : 0;
    }

    /**
     * Add entry to cache with LRU eviction
     */
    private addEntry(filePath: string, entry: InternalCacheEntry): void {
        // Remove existing entry if present
        if (this.cache.has(filePath)) {
            this.cache.delete(filePath);
        }

        // Add new entry
        this.cache.set(filePath, entry);
        this.updateMemoryUsage();

        // Evict entries if necessary
        this.evictIfNecessary();
    }

    /**
     * Evict entries based on LRU policy and size limits
     */
    private evictIfNecessary(): void {
        // Evict by count limit
        while (this.cache.size > this.config.maxFiles) {
            this.evictLeastRecentlyUsed();
        }

        // Evict by memory limit
        while (this.stats.memoryUsage > this.config.maxMemoryBytes) {
            if (!this.evictLeastRecentlyUsed()) {
                break; // No more entries to evict
            }
        }

        // Evict expired entries
        this.evictExpiredEntries();
    }

    /**
     * Evict the least recently used entry
     */
    private evictLeastRecentlyUsed(): boolean {
        let oldestEntry: [string, InternalCacheEntry] | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestEntry = [key, entry];
            }
        }

        if (oldestEntry) {
            this.cache.delete(oldestEntry[0]);
            this.updateMemoryUsage();
            this.incrementStat('evictions');
            return true;
        }

        return false;
    }

    /**
     * Evict all expired entries
     */
    private evictExpiredEntries(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry, now)) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.cache.delete(key);
            this.incrementStat('evictions');
        }

        if (expiredKeys.length > 0) {
            this.updateMemoryUsage();
        }
    }

    /**
     * Check if a cache entry is expired
     */
    private isExpired(entry: InternalCacheEntry, now: number = Date.now()): boolean {
        return (now - entry.cachedAt) > this.config.ttlMs;
    }

    /**
     * Estimate memory usage of symbols array
     */
    private estimateSymbolsSize(symbols: Symbol[]): number {
        // Rough estimate: each symbol takes about 200 bytes on average
        return symbols.length * 200;
    }

    /**
     * Update memory usage statistics
     */
    private updateMemoryUsage(): void {
        let totalSize = 0;
        
        for (const entry of this.cache.values()) {
            totalSize += entry.size;
        }
        
        this.stats.totalSize = this.cache.size;
        this.stats.memoryUsage = totalSize;
    }

    /**
     * Increment a statistic counter
     */
    private incrementStat(stat: keyof CacheStats): void {
        if (this.config.enableStats && typeof this.stats[stat] === 'number') {
            (this.stats[stat] as number)++;
        }
    }
}