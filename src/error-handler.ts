/**
 * Comprehensive error handling utilities for the Enhanced Symbol Search extension
 */

import * as vscode from 'vscode';

/**
 * Error categories for different types of failures
 */
export enum ErrorCategory {
    FileSystem = 'filesystem',
    Search = 'search',
    Pattern = 'pattern',
    Worker = 'worker',
    Cache = 'cache',
    VSCode = 'vscode',
    Network = 'network',
    Timeout = 'timeout',
    Memory = 'memory',
    Configuration = 'configuration'
}

/**
 * Severity levels for errors
 */
export enum ErrorSeverity {
    Low = 'low',
    Medium = 'medium',
    High = 'high',
    Critical = 'critical'
}

/**
 * Enhanced error class with categorization and context
 */
export class EnhancedError extends Error {
    public readonly category: ErrorCategory;
    public readonly severity: ErrorSeverity;
    public readonly context?: Record<string, any>;
    public readonly originalError?: Error;
    public readonly timestamp: number;

    constructor(
        message: string,
        category: ErrorCategory,
        severity: ErrorSeverity = ErrorSeverity.Medium,
        context?: Record<string, any>,
        originalError?: Error
    ) {
        super(message);
        this.name = 'EnhancedError';
        this.category = category;
        this.severity = severity;
        this.context = context;
        this.originalError = originalError;
        this.timestamp = Date.now();
    }

    /**
     * Get a user-friendly error message
     */
    getUserMessage(): string {
        switch (this.category) {
            case ErrorCategory.FileSystem:
                return `File system error: ${this.message}`;
            case ErrorCategory.Search:
                return `Search failed: ${this.message}`;
            case ErrorCategory.Pattern:
                return `Pattern matching error: ${this.message}`;
            case ErrorCategory.Worker:
                return `Processing error: ${this.message}`;
            case ErrorCategory.Cache:
                return `Cache error: ${this.message}`;
            case ErrorCategory.VSCode:
                return `VSCode integration error: ${this.message}`;
            case ErrorCategory.Timeout:
                return `Operation timed out: ${this.message}`;
            case ErrorCategory.Memory:
                return `Memory limit exceeded: ${this.message}`;
            case ErrorCategory.Configuration:
                return `Configuration error: ${this.message}`;
            default:
                return this.message;
        }
    }

    /**
     * Get detailed error information for logging
     */
    getDetailedInfo(): string {
        const details = [
            `Error: ${this.message}`,
            `Category: ${this.category}`,
            `Severity: ${this.severity}`,
            `Timestamp: ${new Date(this.timestamp).toISOString()}`
        ];

        if (this.context) {
            details.push(`Context: ${JSON.stringify(this.context, null, 2)}`);
        }

        if (this.originalError) {
            details.push(`Original Error: ${this.originalError.message}`);
            if (this.originalError.stack) {
                details.push(`Stack: ${this.originalError.stack}`);
            }
        }

        return details.join('\n');
    }
}

/**
 * Error recovery strategies
 */
export interface RecoveryStrategy {
    /** Whether to retry the operation */
    retry?: boolean;
    
    /** Number of retry attempts */
    maxRetries?: number;
    
    /** Delay between retries in milliseconds */
    retryDelay?: number;
    
    /** Whether to use fallback mechanism */
    useFallback?: boolean;
    
    /** Whether to show user notification */
    notifyUser?: boolean;
    
    /** Custom recovery action */
    customAction?: () => Promise<void>;
}

/**
 * Main error handler class
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorLog: EnhancedError[] = [];
    private maxLogSize = 1000;
    private fallbackEnabled = true;

    private constructor() {}

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle an error with appropriate recovery strategy
     */
    async handleError(
        error: Error | EnhancedError,
        strategy: RecoveryStrategy = {}
    ): Promise<void> {
        const enhancedError = error instanceof EnhancedError 
            ? error 
            : this.enhanceError(error);

        // Log the error
        this.logError(enhancedError);

        // Apply recovery strategy
        await this.applyRecoveryStrategy(enhancedError, strategy);
    }

    /**
     * Handle file system errors with appropriate fallbacks
     */
    async handleFileSystemError(
        error: Error,
        filePath: string,
        operation: string
    ): Promise<void> {
        const enhancedError = new EnhancedError(
            `Failed to ${operation} file: ${error.message}`,
            ErrorCategory.FileSystem,
            ErrorSeverity.Medium,
            { filePath, operation },
            error
        );

        const strategy: RecoveryStrategy = {
            retry: operation === 'read', // Retry read operations
            maxRetries: 2,
            retryDelay: 1000,
            notifyUser: true
        };

        await this.handleError(enhancedError, strategy);
    }

    /**
     * Handle search operation errors
     */
    async handleSearchError(
        error: Error,
        query: string,
        context?: Record<string, any>
    ): Promise<void> {
        const enhancedError = new EnhancedError(
            `Search operation failed: ${error.message}`,
            ErrorCategory.Search,
            ErrorSeverity.High,
            { query, ...context },
            error
        );

        const strategy: RecoveryStrategy = {
            useFallback: this.fallbackEnabled,
            notifyUser: true
        };

        await this.handleError(enhancedError, strategy);
    }

    /**
     * Handle worker thread errors
     */
    async handleWorkerError(
        error: Error,
        workerId?: string,
        context?: Record<string, any>
    ): Promise<void> {
        const enhancedError = new EnhancedError(
            `Worker thread error: ${error.message}`,
            ErrorCategory.Worker,
            ErrorSeverity.Medium,
            { workerId, ...context },
            error
        );

        const strategy: RecoveryStrategy = {
            retry: true,
            maxRetries: 1,
            notifyUser: false // Don't notify for worker errors unless critical
        };

        await this.handleError(enhancedError, strategy);
    }

    /**
     * Handle timeout errors
     */
    async handleTimeoutError(
        operation: string,
        timeoutMs: number,
        context?: Record<string, any>
    ): Promise<void> {
        const enhancedError = new EnhancedError(
            `Operation '${operation}' timed out after ${timeoutMs}ms`,
            ErrorCategory.Timeout,
            ErrorSeverity.Medium,
            { operation, timeoutMs, ...context }
        );

        const strategy: RecoveryStrategy = {
            useFallback: this.fallbackEnabled,
            notifyUser: true
        };

        await this.handleError(enhancedError, strategy);
    }

    /**
     * Handle memory/resource exhaustion errors
     */
    async handleResourceError(
        error: Error,
        resourceType: string,
        context?: Record<string, any>
    ): Promise<void> {
        const enhancedError = new EnhancedError(
            `Resource exhaustion (${resourceType}): ${error.message}`,
            ErrorCategory.Memory,
            ErrorSeverity.High,
            { resourceType, ...context },
            error
        );

        const strategy: RecoveryStrategy = {
            useFallback: true,
            notifyUser: true,
            customAction: async () => {
                // Clear caches to free memory
                vscode.commands.executeCommand('enhanced-symbol-search.clearCache');
            }
        };

        await this.handleError(enhancedError, strategy);
    }

    /**
     * Trigger fallback to VSCode's default symbol search
     */
    async triggerFallback(query?: string): Promise<void> {
        try {
            if (query) {
                // Try to use VSCode's built-in symbol search
                await vscode.commands.executeCommand('workbench.action.gotoSymbol');
            } else {
                await vscode.commands.executeCommand('workbench.action.showAllSymbols');
            }
            
            vscode.window.showInformationMessage(
                'Enhanced Symbol Search encountered an issue. Using VSCode\'s default symbol search.',
                'OK'
            );
        } catch (fallbackError) {
            vscode.window.showErrorMessage(
                'Both enhanced and default symbol search failed. Please check your workspace.',
                'OK'
            );
        }
    }

    /**
     * Enable or disable fallback mechanism
     */
    setFallbackEnabled(enabled: boolean): void {
        this.fallbackEnabled = enabled;
    }

    /**
     * Get error statistics
     */
    getErrorStats(): {
        totalErrors: number;
        errorsByCategory: Record<ErrorCategory, number>;
        errorsBySeverity: Record<ErrorSeverity, number>;
        recentErrors: EnhancedError[];
    } {
        const errorsByCategory = {} as Record<ErrorCategory, number>;
        const errorsBySeverity = {} as Record<ErrorSeverity, number>;

        // Initialize counters
        Object.values(ErrorCategory).forEach(category => {
            errorsByCategory[category] = 0;
        });
        Object.values(ErrorSeverity).forEach(severity => {
            errorsBySeverity[severity] = 0;
        });

        // Count errors
        this.errorLog.forEach(error => {
            errorsByCategory[error.category]++;
            errorsBySeverity[error.severity]++;
        });

        return {
            totalErrors: this.errorLog.length,
            errorsByCategory,
            errorsBySeverity,
            recentErrors: this.errorLog.slice(-10) // Last 10 errors
        };
    }

    /**
     * Clear error log
     */
    clearErrorLog(): void {
        this.errorLog = [];
    }

    /**
     * Enhance a regular error with categorization
     */
    private enhanceError(error: Error): EnhancedError {
        let category = ErrorCategory.Search;
        let severity = ErrorSeverity.Medium;

        // Categorize based on error message patterns
        const message = error.message.toLowerCase();
        
        if (message.includes('enoent') || message.includes('file not found') || 
            message.includes('permission denied') || message.includes('eacces')) {
            category = ErrorCategory.FileSystem;
        } else if (message.includes('timeout') || message.includes('timed out')) {
            category = ErrorCategory.Timeout;
        } else if (message.includes('memory') || message.includes('heap')) {
            category = ErrorCategory.Memory;
            severity = ErrorSeverity.High;
        } else if (message.includes('worker') || message.includes('thread')) {
            category = ErrorCategory.Worker;
        } else if (message.includes('pattern') || message.includes('regex')) {
            category = ErrorCategory.Pattern;
        } else if (message.includes('cache')) {
            category = ErrorCategory.Cache;
        }

        return new EnhancedError(
            error.message,
            category,
            severity,
            undefined,
            error
        );
    }

    /**
     * Log an error to the internal log
     */
    private logError(error: EnhancedError): void {
        this.errorLog.push(error);
        
        // Trim log if it gets too large
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize / 2);
        }

        // Log to console for debugging
        console.error('[Enhanced Symbol Search]', error.getDetailedInfo());
    }

    /**
     * Apply recovery strategy for an error
     */
    private async applyRecoveryStrategy(
        error: EnhancedError,
        strategy: RecoveryStrategy
    ): Promise<void> {
        // Execute custom action if provided
        if (strategy.customAction) {
            try {
                await strategy.customAction();
            } catch (actionError) {
                console.error('Recovery action failed:', actionError);
            }
        }

        // Trigger fallback if requested
        if (strategy.useFallback && this.fallbackEnabled) {
            await this.triggerFallback();
        }

        // Show user notification if requested
        if (strategy.notifyUser) {
            await this.showUserNotification(error);
        }
    }

    /**
     * Show appropriate user notification based on error severity
     */
    private async showUserNotification(error: EnhancedError): Promise<void> {
        const message = error.getUserMessage();
        
        switch (error.severity) {
            case ErrorSeverity.Critical:
                await vscode.window.showErrorMessage(message, 'Report Issue', 'OK');
                break;
            case ErrorSeverity.High:
                await vscode.window.showErrorMessage(message, 'OK');
                break;
            case ErrorSeverity.Medium:
                await vscode.window.showWarningMessage(message, 'OK');
                break;
            case ErrorSeverity.Low:
                // Only show in status bar for low severity
                vscode.window.setStatusBarMessage(message, 5000);
                break;
        }
    }
}

/**
 * Utility function to wrap async operations with error handling
 */
export async function withErrorHandling<T>(
    operation: () => Promise<T>,
    errorContext: {
        category: ErrorCategory;
        severity?: ErrorSeverity;
        context?: Record<string, any>;
        strategy?: RecoveryStrategy;
    }
): Promise<T | null> {
    try {
        return await operation();
    } catch (error) {
        const enhancedError = new EnhancedError(
            error instanceof Error ? error.message : 'Unknown error',
            errorContext.category,
            errorContext.severity || ErrorSeverity.Medium,
            errorContext.context,
            error instanceof Error ? error : undefined
        );

        await ErrorHandler.getInstance().handleError(enhancedError, errorContext.strategy);
        return null;
    }
}

/**
 * Decorator for automatic error handling in class methods
 */
export function handleErrors(
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.Medium
) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                return await originalMethod.apply(this, args);
            } catch (error) {
                const enhancedError = new EnhancedError(
                    error instanceof Error ? error.message : 'Unknown error',
                    category,
                    severity,
                    { method: propertyKey, args: args.length },
                    error instanceof Error ? error : undefined
                );

                await ErrorHandler.getInstance().handleError(enhancedError);
                throw enhancedError;
            }
        };

        return descriptor;
    };
}