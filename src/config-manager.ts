import * as vscode from 'vscode';

export interface SearchConfiguration {
    includePatterns: string[];
    excludePatterns: string[];
    maxResults: number;
    fuzzyMatch: boolean;
    symbolTypes: string[];
    performance: {
        maxFileSize: number;
        maxFiles: number;
        searchTimeout: number;
        cacheSize: number;
        parallelWorkers: number;
    };
    customPatterns: Record<string, {
        class?: string;
        function?: string;
        variable?: string;
    }>;
    enableFallback: boolean;
    debug: boolean;
}

export class ConfigurationManager {
    private static readonly SECTION = 'enhancedSymbolSearch';
    private static instance: ConfigurationManager;
    private currentConfig: SearchConfiguration;
    private configChangeEmitter = new vscode.EventEmitter<SearchConfiguration>();

    public readonly onConfigurationChanged = this.configChangeEmitter.event;

    private constructor() {
        this.currentConfig = this.loadConfiguration();
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(ConfigurationManager.SECTION)) {
                this.currentConfig = this.loadConfiguration();
                this.configChangeEmitter.fire(this.currentConfig);
            }
        });
    }

    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    public getConfiguration(): SearchConfiguration {
        return { ...this.currentConfig };
    }

    private loadConfiguration(): SearchConfiguration {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        
        const rawConfig = {
            includePatterns: config.get<string[]>('includePatterns', []),
            excludePatterns: config.get<string[]>('excludePatterns', []),
            maxResults: config.get<number>('maxResults', 100),
            fuzzyMatch: config.get<boolean>('fuzzyMatch', true),
            symbolTypes: config.get<string[]>('symbolTypes', []),
            performance: {
                maxFileSize: config.get<number>('performance.maxFileSize', 1048576),
                maxFiles: config.get<number>('performance.maxFiles', 10000),
                searchTimeout: config.get<number>('performance.searchTimeout', 5000),
                cacheSize: config.get<number>('performance.cacheSize', 1000),
                parallelWorkers: config.get<number>('performance.parallelWorkers', 4),
            },
            customPatterns: config.get<Record<string, any>>('customPatterns', {}),
            enableFallback: config.get<boolean>('enableFallback', true),
            debug: config.get<boolean>('debug', false),
        };

        return this.validateAndNormalizeConfiguration(rawConfig);
    } 
   private validateAndNormalizeConfiguration(config: any): SearchConfiguration {
        const validatedConfig: SearchConfiguration = {
            includePatterns: this.validateStringArray(config.includePatterns, [
                '**/*.py', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx',
                '**/*.java', '**/*.cs', '**/*.cpp', '**/*.c', '**/*.h'
            ]),
            excludePatterns: this.validateStringArray(config.excludePatterns, [
                '**/node_modules/**', '**/venv/**', '**/__pycache__/**',
                '**/dist/**', '**/build/**', '**/out/**', '**/.git/**',
                '**/coverage/**', '**/*.min.js', '**/*.bundle.js'
            ]),
            maxResults: this.validateNumber(config.maxResults, 100, 10, 1000),
            fuzzyMatch: this.validateBoolean(config.fuzzyMatch, true),
            symbolTypes: this.validateSymbolTypes(config.symbolTypes),
            performance: {
                maxFileSize: this.validateNumber(config.performance?.maxFileSize, 1048576, 10240, 10485760),
                maxFiles: this.validateNumber(config.performance?.maxFiles, 10000, 100, 100000),
                searchTimeout: this.validateNumber(config.performance?.searchTimeout, 2000, 1000, 30000),
                cacheSize: this.validateNumber(config.performance?.cacheSize, 1000, 100, 10000),
                parallelWorkers: this.validateNumber(config.performance?.parallelWorkers, 4, 1, 16),
            },
            customPatterns: this.validateCustomPatterns(config.customPatterns),
            enableFallback: this.validateBoolean(config.enableFallback, true),
            debug: this.validateBoolean(config.debug, false),
        };

        if (validatedConfig.debug) {
            console.log('[Enhanced Symbol Search] Loaded configuration:', validatedConfig);
        }

        return validatedConfig;
    }

    private validateStringArray(value: any, defaultValue: string[]): string[] {
        if (!Array.isArray(value)) {
            return defaultValue;
        }
        
        const filtered = value.filter(item => typeof item === 'string' && item.trim().length > 0);
        return filtered.length > 0 ? filtered : defaultValue;
    }

    private validateNumber(value: any, defaultValue: number, min?: number, max?: number): number {
        if (typeof value !== 'number' || isNaN(value)) {
            return defaultValue;
        }
        
        if (min !== undefined && value < min) {
            return min;
        }
        
        if (max !== undefined && value > max) {
            return max;
        }
        
        return value;
    }

    private validateBoolean(value: any, defaultValue: boolean): boolean {
        return typeof value === 'boolean' ? value : defaultValue;
    }

    private validateSymbolTypes(value: any): string[] {
        const validTypes = ['class', 'function', 'method', 'variable', 'interface', 'enum', 'constant', 'property'];
        const defaultTypes = ['class', 'function', 'method', 'variable', 'interface'];
        
        if (!Array.isArray(value)) {
            return defaultTypes;
        }
        
        const filtered = value.filter(type => 
            typeof type === 'string' && validTypes.includes(type)
        );
        
        return filtered.length > 0 ? filtered : defaultTypes;
    }

    private validateCustomPatterns(value: any): Record<string, { class?: string; function?: string; variable?: string; }> {
        if (!value || typeof value !== 'object') {
            return {};
        }
        
        const validated: Record<string, { class?: string; function?: string; variable?: string; }> = {};
        
        for (const [extension, patterns] of Object.entries(value)) {
            if (typeof extension === 'string' && patterns && typeof patterns === 'object') {
                const patternObj: { class?: string; function?: string; variable?: string; } = {};
                const patternsObj = patterns as any;
                
                if (typeof patternsObj.class === 'string') {
                    try {
                        new RegExp(patternsObj.class); // Validate regex
                        patternObj.class = patternsObj.class;
                    } catch (error) {
                        console.warn(`[Enhanced Symbol Search] Invalid class pattern for ${extension}:`, error);
                    }
                }
                
                if (typeof patternsObj.function === 'string') {
                    try {
                        new RegExp(patternsObj.function); // Validate regex
                        patternObj.function = patternsObj.function;
                    } catch (error) {
                        console.warn(`[Enhanced Symbol Search] Invalid function pattern for ${extension}:`, error);
                    }
                }
                
                if (typeof patternsObj.variable === 'string') {
                    try {
                        new RegExp(patternsObj.variable); // Validate regex
                        patternObj.variable = patternsObj.variable;
                    } catch (error) {
                        console.warn(`[Enhanced Symbol Search] Invalid variable pattern for ${extension}:`, error);
                    }
                }
                
                if (Object.keys(patternObj).length > 0) {
                    validated[extension] = patternObj;
                }
            }
        }
        
        return validated;
    }

    public updateConfiguration(section: string, value: any, target?: vscode.ConfigurationTarget): Thenable<void> {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        return config.update(section, value, target);
    }

    public resetToDefaults(): Thenable<void[]> {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.SECTION);
        const promises: Thenable<void>[] = [];
        
        // Reset all configuration values to undefined (which will use defaults)
        const sections = [
            'includePatterns', 'excludePatterns', 'maxResults', 'fuzzyMatch',
            'symbolTypes', 'performance.maxFileSize', 'performance.maxFiles',
            'performance.searchTimeout', 'performance.cacheSize', 'performance.parallelWorkers',
            'customPatterns', 'enableFallback', 'debug'
        ];
        
        sections.forEach(section => {
            promises.push(config.update(section, undefined, vscode.ConfigurationTarget.Workspace));
        });
        
        return Promise.all(promises);
    }

    public dispose(): void {
        this.configChangeEmitter.dispose();
    }
}