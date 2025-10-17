/**
 * File system scanner for discovering and reading workspace files
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileInfo, SearchOptions } from './types';
import { ErrorHandler, ErrorCategory, ErrorSeverity, withErrorHandling, handleErrors } from './error-handler';

/**
 * Configuration for file scanning operations
 */
export interface ScanConfig {
    /** Include patterns (glob format) */
    includePatterns: string[];
    
    /** Exclude patterns (glob format) */
    excludePatterns: string[];
    
    /** Maximum file size to process (in bytes) */
    maxFileSize?: number;
    
    /** Maximum number of files to scan */
    maxFiles?: number;
    
    /** Follow symbolic links */
    followSymlinks?: boolean;
}

/**
 * Default configuration for file scanning
 */
const DEFAULT_SCAN_CONFIG: ScanConfig = {
    includePatterns: ['**/*.py', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
    excludePatterns: [
        '**/node_modules/**',
        '**/venv/**', 
        '**/__pycache__/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**'
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10000,
    followSymlinks: false
};

/**
 * File scanner for workspace file discovery
 */
export class FileScanner {
    private config: ScanConfig;
    private workspaceRoot: string;
    private errorHandler: ErrorHandler;

    constructor(workspaceRoot: string, config?: Partial<ScanConfig>) {
        this.workspaceRoot = workspaceRoot;
        this.config = { ...DEFAULT_SCAN_CONFIG, ...config };
        this.errorHandler = ErrorHandler.getInstance();
    }

    /**
     * Scan workspace for files matching the configured patterns
     */
    @handleErrors(ErrorCategory.FileSystem, ErrorSeverity.High)
    async scanWorkspace(options?: SearchOptions): Promise<FileInfo[]> {
        const scanConfig = this.mergeWithSearchOptions(options);
        
        // Use VSCode's file search API for efficient pattern matching
        const includePattern = this.createGlobPattern(scanConfig.includePatterns);
        const excludePattern = this.createGlobPattern(scanConfig.excludePatterns);
        
        const files = await withErrorHandling(
            () => Promise.resolve(vscode.workspace.findFiles(includePattern, excludePattern, scanConfig.maxFiles)),
            {
                category: ErrorCategory.VSCode,
                severity: ErrorSeverity.High,
                context: { includePattern, excludePattern, maxFiles: scanConfig.maxFiles },
                strategy: {
                    retry: true,
                    maxRetries: 2,
                    retryDelay: 500
                }
            }
        );

        if (!files) {
            return [];
        }

        const fileInfos: FileInfo[] = [];
        let failedFiles = 0;
        
        for (const file of files) {
            const fileInfo = await withErrorHandling(
                () => this.getFileInfo(file.fsPath),
                {
                    category: ErrorCategory.FileSystem,
                    severity: ErrorSeverity.Low,
                    context: { filePath: file.fsPath }
                }
            );

            if (fileInfo) {
                // Skip files that are too large
                if (scanConfig.maxFileSize && fileInfo.size > scanConfig.maxFileSize) {
                    continue;
                }
                
                fileInfos.push(fileInfo);
            } else {
                failedFiles++;
            }
        }

        // Log warning if many files failed
        if (failedFiles > files.length * 0.1) { // More than 10% failed
            await this.errorHandler.handleError(
                new Error(`Failed to access ${failedFiles} out of ${files.length} files`),
                {
                    notifyUser: true
                }
            );
        }

        return fileInfos.sort((a, b) => a.path.localeCompare(b.path));
    }

    /**
     * Get detailed information about a specific file
     */
    @handleErrors(ErrorCategory.FileSystem, ErrorSeverity.Low)
    async getFileInfo(filePath: string): Promise<FileInfo> {
        const stats = await fs.stat(filePath);
        
        if (!stats.isFile()) {
            throw new Error(`Path is not a file: ${filePath}`);
        }

        return {
            path: filePath,
            size: stats.size,
            lastModified: stats.mtime.getTime(),
            language: this.detectLanguage(filePath)
        };
    }

    /**
     * Check if a file matches the configured patterns
     */
    shouldIncludeFile(filePath: string): boolean {
        const relativePath = path.relative(this.workspaceRoot, filePath);
        
        // Check include patterns
        const includeMatch = this.config.includePatterns.some(pattern => 
            this.matchesGlob(relativePath, pattern)
        );
        
        if (!includeMatch) {
            return false;
        }
        
        // Check exclude patterns
        const excludeMatch = this.config.excludePatterns.some(pattern =>
            this.matchesGlob(relativePath, pattern)
        );
        
        return !excludeMatch;
    }

    /**
     * Detect programming language from file extension
     */
    private detectLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        
        const languageMap: Record<string, string> = {
            '.py': 'python',
            '.pyx': 'python',
            '.pyi': 'python',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.java': 'java',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala'
        };
        
        return languageMap[ext] || 'text';
    }

    /**
     * Create a VSCode glob pattern from an array of patterns
     */
    private createGlobPattern(patterns: string[]): string {
        if (patterns.length === 0) {
            return '**/*';
        }
        
        if (patterns.length === 1) {
            return patterns[0];
        }
        
        return `{${patterns.join(',')}}`;
    }

    /**
     * Merge scan config with search options
     */
    private mergeWithSearchOptions(options?: SearchOptions): ScanConfig {
        if (!options) {
            return this.config;
        }

        return {
            ...this.config,
            includePatterns: options.filePatterns || this.config.includePatterns,
            excludePatterns: options.excludePatterns || this.config.excludePatterns,
            maxFiles: options.maxResults || this.config.maxFiles
        };
    }

    /**
     * Simple glob pattern matching
     */
    private matchesGlob(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')  // ** matches any path
            .replace(/\*/g, '[^/]*') // * matches any filename chars
            .replace(/\?/g, '[^/]')  // ? matches single char
            .replace(/\./g, '\\.');   // Escape dots
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
    }
}