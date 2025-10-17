/**
 * Parallel file processing with worker threads for performance optimization
 */

import * as vscode from 'vscode';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';
import { FileInfo, Symbol, SearchOptions } from './types';
import { FileCache } from './file-cache';
import { ErrorHandler, ErrorCategory, ErrorSeverity, withErrorHandling } from './error-handler';

/**
 * Configuration for parallel processing
 */
export interface ParallelConfig {
    /** Maximum number of worker threads */
    maxWorkers: number;
    
    /** Batch size for processing files */
    batchSize: number;
    
    /** Timeout for individual file processing in milliseconds */
    fileTimeoutMs: number;
    
    /** Enable progress reporting */
    enableProgress: boolean;
}

/**
 * Progress information for long-running operations
 */
export interface ProcessingProgress {
    /** Total number of files to process */
    total: number;
    
    /** Number of files processed so far */
    processed: number;
    
    /** Number of files that failed processing */
    failed: number;
    
    /** Current processing phase */
    phase: 'scanning' | 'processing' | 'complete';
    
    /** Optional message */
    message?: string;
}

/**
 * Result of parallel file processing
 */
export interface ProcessingResult {
    /** Successfully processed files with their symbols */
    results: Map<string, Symbol[]>;
    
    /** Files that failed processing */
    errors: Map<string, string>;
    
    /** Processing statistics */
    stats: {
        totalFiles: number;
        successfulFiles: number;
        failedFiles: number;
        processingTimeMs: number;
    };
}

/**
 * Cancellation token for aborting operations
 */
export class CancellationToken {
    private _isCancelled = false;
    private _onCancelled: (() => void)[] = [];

    get isCancelled(): boolean {
        return this._isCancelled;
    }

    cancel(): void {
        if (!this._isCancelled) {
            this._isCancelled = true;
            this._onCancelled.forEach(callback => callback());
        }
    }

    onCancelled(callback: () => void): void {
        if (this._isCancelled) {
            callback();
        } else {
            this._onCancelled.push(callback);
        }
    }
}

/**
 * Parallel file processor with worker threads and progress tracking
 */
export class ParallelProcessor {
    private config: ParallelConfig;
    private cache: FileCache;
    private activeWorkers: Set<Worker> = new Set();
    private errorHandler: ErrorHandler;

    constructor(cache: FileCache, config?: Partial<ParallelConfig>) {
        this.cache = cache;
        this.errorHandler = ErrorHandler.getInstance();
        this.config = {
            maxWorkers: Math.min(4, require('os').cpus().length),
            batchSize: 50,
            fileTimeoutMs: 5000,
            enableProgress: true,
            ...config
        };
    }

    /**
     * Process files in parallel with progress tracking and cancellation support
     */
    async processFiles(
        files: FileInfo[],
        options: SearchOptions = {},
        progressCallback?: (progress: ProcessingProgress) => void,
        cancellationToken?: CancellationToken
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        const results = new Map<string, Symbol[]>();
        const errors = new Map<string, string>();

        if (files.length === 0) {
            return {
                results,
                errors,
                stats: {
                    totalFiles: 0,
                    successfulFiles: 0,
                    failedFiles: 0,
                    processingTimeMs: 0
                }
            };
        }

        // Report initial progress
        if (progressCallback && this.config.enableProgress) {
            progressCallback({
                total: files.length,
                processed: 0,
                failed: 0,
                phase: 'processing'
            });
        }

        try {
            // Check for cached results first
            const { cachedFiles, uncachedFiles } = await this.separateCachedFiles(files);
            
            // Add cached results
            for (const [filePath, symbols] of cachedFiles) {
                results.set(filePath, symbols);
            }

            if (uncachedFiles.length === 0) {
                // All files were cached
                if (progressCallback && this.config.enableProgress) {
                    progressCallback({
                        total: files.length,
                        processed: files.length,
                        failed: 0,
                        phase: 'complete'
                    });
                }

                return {
                    results,
                    errors,
                    stats: {
                        totalFiles: files.length,
                        successfulFiles: files.length,
                        failedFiles: 0,
                        processingTimeMs: Date.now() - startTime
                    }
                };
            }

            // Process uncached files in parallel
            const batches = this.createBatches(uncachedFiles, this.config.batchSize);
            const workerPromises: Promise<void>[] = [];
            let processedCount = cachedFiles.size;

            for (let i = 0; i < Math.min(batches.length, this.config.maxWorkers); i++) {
                const workerPromise = this.processWithWorker(
                    batches,
                    results,
                    errors,
                    (processed, failed) => {
                        processedCount += processed;
                        if (progressCallback && this.config.enableProgress) {
                            progressCallback({
                                total: files.length,
                                processed: processedCount,
                                failed: failed + errors.size,
                                phase: 'processing'
                            });
                        }
                    },
                    cancellationToken
                );
                workerPromises.push(workerPromise);
            }

            // Wait for all workers to complete
            await Promise.all(workerPromises);

            // Final progress update
            if (progressCallback && this.config.enableProgress) {
                progressCallback({
                    total: files.length,
                    processed: results.size,
                    failed: errors.size,
                    phase: 'complete'
                });
            }

        } catch (error) {
            // Clean up workers on error
            await this.terminateAllWorkers();
            throw error;
        }

        return {
            results,
            errors,
            stats: {
                totalFiles: files.length,
                successfulFiles: results.size,
                failedFiles: errors.size,
                processingTimeMs: Date.now() - startTime
            }
        };
    }

    /**
     * Separate files into cached and uncached
     */
    private async separateCachedFiles(files: FileInfo[]): Promise<{
        cachedFiles: Map<string, Symbol[]>;
        uncachedFiles: FileInfo[];
    }> {
        const cachedFiles = new Map<string, Symbol[]>();
        const uncachedFiles: FileInfo[] = [];

        for (const file of files) {
            const cachedSymbols = this.cache.getCachedSymbols(file.path, file.lastModified);
            if (cachedSymbols) {
                cachedFiles.set(file.path, cachedSymbols);
            } else {
                uncachedFiles.push(file);
            }
        }

        return { cachedFiles, uncachedFiles };
    }

    /**
     * Create batches of files for parallel processing
     */
    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Process files using a worker thread
     */
    private async processWithWorker(
        batches: FileInfo[][],
        results: Map<string, Symbol[]>,
        errors: Map<string, string>,
        progressCallback: (processed: number, failed: number) => void,
        cancellationToken?: CancellationToken
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let batchIndex = 0;
            let processedInWorker = 0;
            let failedInWorker = 0;

            const processNextBatch = () => {
                if (batchIndex >= batches.length || cancellationToken?.isCancelled) {
                    resolve();
                    return;
                }

                const batch = batches[batchIndex++];
                const worker = new Worker(__filename, {
                    workerData: { batch, config: this.config }
                });

                this.activeWorkers.add(worker);

                const timeout = setTimeout(() => {
                    worker.terminate();
                    this.activeWorkers.delete(worker);
                    
                    // Mark all files in batch as failed
                    for (const file of batch) {
                        errors.set(file.path, 'Processing timeout');
                        failedInWorker++;
                    }
                    
                    progressCallback(processedInWorker, failedInWorker);
                    processNextBatch();
                }, this.config.fileTimeoutMs * batch.length);

                worker.on('message', (message: { type: string; data: any }) => {
                    if (message.type === 'result') {
                        const { filePath, symbols, error } = message.data;
                        
                        if (error) {
                            errors.set(filePath, error);
                            failedInWorker++;
                        } else {
                            results.set(filePath, symbols);
                            // Cache the results
                            this.cache.cacheSymbols(filePath, symbols, Date.now());
                            processedInWorker++;
                        }
                    } else if (message.type === 'batchComplete') {
                        clearTimeout(timeout);
                        worker.terminate();
                        this.activeWorkers.delete(worker);
                        progressCallback(processedInWorker, failedInWorker);
                        processNextBatch();
                    }
                });

                worker.on('error', async (error) => {
                    clearTimeout(timeout);
                    this.activeWorkers.delete(worker);
                    
                    // Handle worker error
                    await this.errorHandler.handleWorkerError(
                        error,
                        `worker-${batchIndex}`,
                        { batchSize: batch.length, batchIndex }
                    );
                    
                    // Mark all files in batch as failed
                    for (const file of batch) {
                        errors.set(file.path, error.message);
                        failedInWorker++;
                    }
                    
                    progressCallback(processedInWorker, failedInWorker);
                    processNextBatch();
                });

                // Handle cancellation
                cancellationToken?.onCancelled(() => {
                    clearTimeout(timeout);
                    worker.terminate();
                    this.activeWorkers.delete(worker);
                    resolve();
                });
            };

            processNextBatch();
        });
    }

    /**
     * Terminate all active workers
     */
    private async terminateAllWorkers(): Promise<void> {
        const terminationPromises = Array.from(this.activeWorkers).map(worker => 
            worker.terminate()
        );
        
        await Promise.all(terminationPromises);
        this.activeWorkers.clear();
    }

    /**
     * Create a cancellation token
     */
    createCancellationToken(): CancellationToken {
        return new CancellationToken();
    }
}

// Worker thread code
if (!isMainThread && parentPort) {
    const { batch, config } = workerData as { batch: FileInfo[]; config: ParallelConfig };
    
    // Import required modules in worker context
    const fs = require('fs/promises');
    
    // Simple symbol extraction for worker (basic implementation)
    const extractSymbols = async (filePath: string): Promise<Symbol[]> => {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const symbols: Symbol[] = [];
            
            // Basic Python symbol extraction
            if (filePath.endsWith('.py')) {
                const lines = content.split('\n');
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    // Class definitions
                    const classMatch = line.match(/^class\s+(\w+)/);
                    if (classMatch) {
                        symbols.push({
                            name: classMatch[1],
                            type: 'class',
                            line: i,
                            column: line.indexOf('class')
                        });
                    }
                    
                    // Function definitions
                    const funcMatch = line.match(/^def\s+(\w+)/);
                    if (funcMatch) {
                        symbols.push({
                            name: funcMatch[1],
                            type: 'function',
                            line: i,
                            column: line.indexOf('def')
                        });
                    }
                }
            }
            
            return symbols;
        } catch (error) {
            throw new Error(`Failed to extract symbols: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    
    // Process each file in the batch
    const processBatch = async () => {
        for (const file of batch) {
            try {
                const symbols = await extractSymbols(file.path);
                parentPort!.postMessage({
                    type: 'result',
                    data: { filePath: file.path, symbols }
                });
            } catch (error) {
                parentPort!.postMessage({
                    type: 'result',
                    data: { 
                        filePath: file.path, 
                        error: error instanceof Error ? error.message : 'Unknown error' 
                    }
                });
            }
        }
        
        parentPort!.postMessage({ type: 'batchComplete' });
    };
    
    processBatch().catch(error => {
        parentPort!.postMessage({
            type: 'result',
            data: { error: error.message }
        });
    });
}