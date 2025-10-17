/**
 * Progress management and user feedback system for Enhanced Symbol Search
 */

import * as vscode from 'vscode';
import { ProcessingProgress } from './parallel-processor';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './error-handler';

/**
 * Types of progress indicators available
 */
export enum ProgressType {
    Notification = 'notification',
    StatusBar = 'statusbar',
    Window = 'window',
    Silent = 'silent'
}

/**
 * Progress configuration options
 */
export interface ProgressConfig {
    /** Type of progress indicator to use */
    type: ProgressType;
    
    /** Title for the progress indicator */
    title: string;
    
    /** Whether the operation can be cancelled */
    cancellable: boolean;
    
    /** Location for notification progress */
    location?: vscode.ProgressLocation;
    
    /** Minimum duration before showing progress (ms) */
    minDuration?: number;
    
    /** Update interval for progress reporting (ms) */
    updateInterval?: number;
}

/**
 * Progress state information
 */
export interface ProgressState {
    /** Current progress percentage (0-100) */
    percentage: number;
    
    /** Current status message */
    message: string;
    
    /** Whether the operation is complete */
    isComplete: boolean;
    
    /** Whether the operation was cancelled */
    isCancelled: boolean;
    
    /** Start time of the operation */
    startTime: number;
    
    /** Estimated completion time */
    estimatedCompletion?: number;
}

/**
 * Feedback message types
 */
export enum FeedbackType {
    Info = 'info',
    Warning = 'warning',
    Error = 'error',
    Success = 'success'
}

/**
 * User feedback configuration
 */
export interface FeedbackConfig {
    /** Type of feedback message */
    type: FeedbackType;
    
    /** Message to display */
    message: string;
    
    /** Optional actions for the user */
    actions?: string[];
    
    /** Duration to show the message (ms) */
    duration?: number;
    
    /** Whether to show in status bar instead of notification */
    useStatusBar?: boolean;
}

/**
 * Main progress manager class
 */
export class ProgressManager {
    private static instance: ProgressManager;
    private activeProgress = new Map<string, ProgressState>();
    private statusBarItem: vscode.StatusBarItem;
    private errorHandler: ErrorHandler;

    private constructor() {
        this.errorHandler = ErrorHandler.getInstance();
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
    }

    static getInstance(): ProgressManager {
        if (!ProgressManager.instance) {
            ProgressManager.instance = new ProgressManager();
        }
        return ProgressManager.instance;
    }

    /**
     * Start a progress indicator for a long-running operation
     */
    async withProgress<T>(
        config: ProgressConfig,
        operation: (
            progress: (update: { message?: string; increment?: number }) => void,
            token: vscode.CancellationToken
        ) => Promise<T>
    ): Promise<T> {
        const operationId = this.generateOperationId();
        
        try {
            // Initialize progress state
            const state: ProgressState = {
                percentage: 0,
                message: config.title,
                isComplete: false,
                isCancelled: false,
                startTime: Date.now()
            };
            
            this.activeProgress.set(operationId, state);

            // Choose appropriate progress implementation
            switch (config.type) {
                case ProgressType.Notification:
                    return await this.withNotificationProgress(config, operation, operationId);
                
                case ProgressType.StatusBar:
                    return await this.withStatusBarProgress(config, operation, operationId);
                
                case ProgressType.Window:
                    return await this.withWindowProgress(config, operation, operationId);
                
                case ProgressType.Silent:
                    return await this.withSilentProgress(config, operation, operationId);
                
                default:
                    return await this.withNotificationProgress(config, operation, operationId);
            }
        } finally {
            this.activeProgress.delete(operationId);
        }
    }

    /**
     * Show user feedback message
     */
    async showFeedback(config: FeedbackConfig): Promise<string | undefined> {
        if (config.useStatusBar) {
            return this.showStatusBarFeedback(config);
        }

        switch (config.type) {
            case FeedbackType.Info:
                return await vscode.window.showInformationMessage(
                    config.message,
                    ...(config.actions || [])
                );
            
            case FeedbackType.Warning:
                return await vscode.window.showWarningMessage(
                    config.message,
                    ...(config.actions || [])
                );
            
            case FeedbackType.Error:
                return await vscode.window.showErrorMessage(
                    config.message,
                    ...(config.actions || [])
                );
            
            case FeedbackType.Success:
                return await vscode.window.showInformationMessage(
                    `✓ ${config.message}`,
                    ...(config.actions || [])
                );
            
            default:
                return await vscode.window.showInformationMessage(
                    config.message,
                    ...(config.actions || [])
                );
        }
    }

    /**
     * Show search progress with detailed information
     */
    async showSearchProgress<T>(
        operation: (
            progressCallback: (progress: ProcessingProgress) => void,
            cancellationToken: vscode.CancellationToken
        ) => Promise<T>,
        title: string = 'Enhanced Symbol Search'
    ): Promise<T> {
        return await this.withProgress(
            {
                type: ProgressType.Notification,
                title,
                cancellable: true,
                location: vscode.ProgressLocation.Notification
            },
            async (progress, token) => {
                let lastUpdate = 0;
                const updateInterval = 100; // Update every 100ms max
                const startTime = Date.now();

                const progressCallback = (processingProgress: ProcessingProgress) => {
                    const now = Date.now();
                    if (now - lastUpdate < updateInterval) {
                        return; // Throttle updates
                    }
                    lastUpdate = now;

                    const percentage = processingProgress.total > 0 
                        ? (processingProgress.processed / processingProgress.total) * 100 
                        : 0;

                    const elapsedTime = now - startTime;
                    const message = this.formatProgressMessage(processingProgress, elapsedTime);
                    
                    progress({
                        message,
                        increment: percentage - (this.getProgressState()?.percentage || 0)
                    });
                };

                return await operation(progressCallback, token);
            }
        );
    }

    /**
     * Show quick status message
     */
    showQuickStatus(message: string, duration: number = 3000): void {
        vscode.window.setStatusBarMessage(message, duration);
    }

    /**
     * Show persistent status in status bar
     */
    showPersistentStatus(message: string, command?: string): void {
        this.statusBarItem.text = message;
        this.statusBarItem.command = command;
        this.statusBarItem.show();
    }

    /**
     * Show search statistics during processing
     */
    showSearchStatistics(
        filesProcessed: number,
        totalFiles: number,
        symbolsFound: number,
        elapsedTime: number
    ): void {
        const rate = filesProcessed > 0 ? Math.round(filesProcessed / (elapsedTime / 1000)) : 0;
        const message = `$(search) ${symbolsFound} symbols • ${filesProcessed}/${totalFiles} files • ${rate} files/s`;
        this.showPersistentStatus(message, 'enhanced-symbol-search.cancel');
    }

    /**
     * Hide persistent status
     */
    hidePersistentStatus(): void {
        this.statusBarItem.hide();
    }

    /**
     * Show error with recovery options
     */
    async showErrorWithRecovery(
        error: Error,
        context?: string
    ): Promise<void> {
        const actions = ['Retry', 'Use Default Search', 'Report Issue', 'Dismiss'];
        
        const message = context 
            ? `${context}: ${error.message}`
            : error.message;

        const selection = await this.showFeedback({
            type: FeedbackType.Error,
            message,
            actions
        });

        switch (selection) {
            case 'Retry':
                // Emit retry event (handled by caller)
                break;
            
            case 'Use Default Search':
                await this.errorHandler.triggerFallback();
                break;
            
            case 'Report Issue':
                await this.showReportIssueDialog(error, context);
                break;
            
            default:
                // Dismiss - do nothing
                break;
        }
    }

    /**
     * Show performance optimization suggestions
     */
    async showPerformanceOptimization(): Promise<void> {
        const message = 'Search performance can be improved by adjusting these settings:';
        const actions = ['Open Settings', 'Learn More', 'Dismiss'];
        
        const selection = await this.showFeedback({
            type: FeedbackType.Info,
            message,
            actions
        });

        switch (selection) {
            case 'Open Settings':
                await vscode.commands.executeCommand('workbench.action.openSettings', 'enhancedSymbolSearch');
                break;
            
            case 'Learn More':
                await this.showFeedback({
                    type: FeedbackType.Info,
                    message: 'Performance tips:\n• Reduce file patterns scope\n• Exclude large directories\n• Lower max file size limit\n• Reduce parallel workers on slower machines',
                    actions: ['Open Settings', 'OK']
                });
                break;
            
            default:
                // Dismiss - do nothing
                break;
        }
    }

    /**
     * Show success message with statistics
     */
    async showSearchSuccess(
        resultCount: number,
        searchTime: number,
        query: string
    ): Promise<string | undefined> {
        const message = `Found ${resultCount} symbols for "${query}" in ${searchTime}ms`;
        
        // Show performance warning if search took longer than expected
        if (searchTime > 2000) {
            const selection = await this.showFeedback({
                type: FeedbackType.Warning,
                message: `${message} (slower than expected - consider adjusting search scope)`,
                actions: ['Optimize Settings', 'OK'],
                useStatusBar: false
            });
            
            // Also show in output channel for debugging
            this.logToOutput(`Search completed: ${message} - Performance warning shown`);
            
            return selection;
        } else {
            this.showQuickStatus(`✓ ${message}`, 5000);
            
            // Also show in output channel for debugging
            this.logToOutput(`Search completed: ${message}`);
            
            return undefined;
        }
    }

    /**
     * Get current progress state
     */
    private getProgressState(): ProgressState | undefined {
        // Return the most recent progress state
        const states = Array.from(this.activeProgress.values());
        return states[states.length - 1];
    }

    /**
     * Progress with notification
     */
    private async withNotificationProgress<T>(
        config: ProgressConfig,
        operation: (
            progress: (update: { message?: string; increment?: number }) => void,
            token: vscode.CancellationToken
        ) => Promise<T>,
        operationId: string
    ): Promise<T> {
        return await vscode.window.withProgress(
            {
                location: config.location || vscode.ProgressLocation.Notification,
                title: config.title,
                cancellable: config.cancellable
            },
            async (progress, token) => {
                const wrappedProgress = (update: { message?: string; increment?: number }) => {
                    const state = this.activeProgress.get(operationId);
                    if (state) {
                        if (update.increment !== undefined) {
                            state.percentage = Math.min(100, state.percentage + update.increment);
                        }
                        if (update.message) {
                            state.message = update.message;
                        }
                    }
                    progress.report(update);
                };

                return await operation(wrappedProgress, token);
            }
        );
    }

    /**
     * Progress with status bar
     */
    private async withStatusBarProgress<T>(
        config: ProgressConfig,
        operation: (
            progress: (update: { message?: string; increment?: number }) => void,
            token: vscode.CancellationToken
        ) => Promise<T>,
        operationId: string
    ): Promise<T> {
        const cancellationTokenSource = new vscode.CancellationTokenSource();
        
        try {
            this.showPersistentStatus(`$(sync~spin) ${config.title}`, 'enhanced-symbol-search.cancel');
            
            const wrappedProgress = (update: { message?: string; increment?: number }) => {
                const state = this.activeProgress.get(operationId);
                if (state && update.message) {
                    this.showPersistentStatus(`$(sync~spin) ${update.message}`);
                }
            };

            return await operation(wrappedProgress, cancellationTokenSource.token);
        } finally {
            this.hidePersistentStatus();
            cancellationTokenSource.dispose();
        }
    }

    /**
     * Progress with window status
     */
    private async withWindowProgress<T>(
        config: ProgressConfig,
        operation: (
            progress: (update: { message?: string; increment?: number }) => void,
            token: vscode.CancellationToken
        ) => Promise<T>,
        operationId: string
    ): Promise<T> {
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: config.title
            },
            async (progress, token) => {
                return await operation(progress.report.bind(progress), token);
            }
        );
    }

    /**
     * Silent progress (no UI)
     */
    private async withSilentProgress<T>(
        config: ProgressConfig,
        operation: (
            progress: (update: { message?: string; increment?: number }) => void,
            token: vscode.CancellationToken
        ) => Promise<T>,
        operationId: string
    ): Promise<T> {
        const cancellationTokenSource = new vscode.CancellationTokenSource();
        
        try {
            const silentProgress = (update: { message?: string; increment?: number }) => {
                // Update internal state but don't show UI
                const state = this.activeProgress.get(operationId);
                if (state) {
                    if (update.increment !== undefined) {
                        state.percentage = Math.min(100, state.percentage + update.increment);
                    }
                    if (update.message) {
                        state.message = update.message;
                    }
                }
            };

            return await operation(silentProgress, cancellationTokenSource.token);
        } finally {
            cancellationTokenSource.dispose();
        }
    }

    /**
     * Show status bar feedback
     */
    private showStatusBarFeedback(config: FeedbackConfig): string | undefined {
        const icon = this.getFeedbackIcon(config.type);
        const message = `${icon} ${config.message}`;
        
        vscode.window.setStatusBarMessage(message, config.duration || 5000);
        return undefined;
    }

    /**
     * Format processing progress message
     */
    private formatProgressMessage(progress: ProcessingProgress, elapsedTime?: number): string {
        const { total, processed, failed, phase, message } = progress;
        
        if (message) {
            return message;
        }

        const timeText = elapsedTime ? ` (${Math.round(elapsedTime / 1000)}s)` : '';

        switch (phase) {
            case 'scanning':
                return `Scanning workspace for files...${timeText}`;
            
            case 'processing':
                if (total > 0) {
                    const percentage = Math.round((processed / total) * 100);
                    const failedText = failed > 0 ? ` (${failed} failed)` : '';
                    const estimatedTotal = elapsedTime && processed > 0 
                        ? Math.round((elapsedTime * total) / processed / 1000)
                        : null;
                    const etaText = estimatedTotal && elapsedTime && estimatedTotal > elapsedTime / 1000 
                        ? ` • ETA: ${Math.round(estimatedTotal - elapsedTime / 1000)}s`
                        : '';
                    return `Processing files: ${processed}/${total} (${percentage}%)${failedText}${timeText}${etaText}`;
                } else {
                    return `Processing files: ${processed}${timeText}`;
                }
            
            case 'complete':
                const failedText = failed > 0 ? ` (${failed} failed)` : '';
                return `Completed: ${processed} files processed${failedText}${timeText}`;
            
            default:
                return `Processing: ${processed}/${total}${timeText}`;
        }
    }

    /**
     * Get icon for feedback type
     */
    private getFeedbackIcon(type: FeedbackType): string {
        switch (type) {
            case FeedbackType.Info:
                return '$(info)';
            case FeedbackType.Warning:
                return '$(warning)';
            case FeedbackType.Error:
                return '$(error)';
            case FeedbackType.Success:
                return '$(check)';
            default:
                return '$(info)';
        }
    }

    /**
     * Generate unique operation ID
     */
    private generateOperationId(): string {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Show report issue dialog
     */
    private async showReportIssueDialog(error: Error, context?: string): Promise<void> {
        const errorInfo = [
            `Error: ${error.message}`,
            `Context: ${context || 'Unknown'}`,
            `Stack: ${error.stack || 'Not available'}`,
            `Timestamp: ${new Date().toISOString()}`
        ].join('\n');

        const selection = await vscode.window.showInformationMessage(
            'Would you like to copy error details to clipboard for reporting?',
            'Copy to Clipboard',
            'Cancel'
        );

        if (selection === 'Copy to Clipboard') {
            await vscode.env.clipboard.writeText(errorInfo);
            vscode.window.showInformationMessage('Error details copied to clipboard');
        }
    }

    /**
     * Log message to output channel
     */
    private logToOutput(message: string): void {
        // This would be connected to an output channel in a real implementation
        console.log(`[Enhanced Symbol Search] ${message}`);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.statusBarItem.dispose();
    }
}

/**
 * Utility function to wrap operations with progress
 */
export async function withProgress<T>(
    config: ProgressConfig,
    operation: (
        progress: (update: { message?: string; increment?: number }) => void,
        token: vscode.CancellationToken
    ) => Promise<T>
): Promise<T> {
    const progressManager = ProgressManager.getInstance();
    return await progressManager.withProgress(config, operation);
}

/**
 * Utility function to show feedback
 */
export async function showFeedback(config: FeedbackConfig): Promise<string | undefined> {
    const progressManager = ProgressManager.getInstance();
    return await progressManager.showFeedback(config);
}