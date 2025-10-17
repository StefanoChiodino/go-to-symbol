/**
 * Python-specific language processor for enhanced symbol search
 * Handles Python classes, functions, methods, variables, and imports
 */

import { BaseLanguageProcessor, LanguageProcessor } from './language-processor';
import { Symbol, SymbolPattern, SymbolType } from './types';

/**
 * Python language processor that understands Python-specific syntax
 * including decorators, async functions, class inheritance, and imports
 */
export class PythonProcessor extends BaseLanguageProcessor {
    constructor() {
        super('python', ['.py', '.pyx', '.pyi']);
    }
    
    /**
     * Get Python-specific symbol patterns
     */
    getSymbolPatterns(): SymbolPattern[] {
        return [
            // Enum definitions (enum.Enum, IntEnum, etc.)
            {
                type: 'enum',
                pattern: /^(\s*)class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*Enum[^)]*\)\s*:/gm,
                captureGroups: { name: 2 },
                priority: 12
            },
            
            // Class definitions with optional inheritance
            {
                type: 'class',
                pattern: /^(\s*)class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\([^)]*\))?\s*:/gm,
                captureGroups: { name: 2 },
                priority: 10
            },
            
            // Function definitions (including async)
            {
                type: 'function',
                pattern: /^(\s*)(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/gm,
                captureGroups: { name: 2 },
                priority: 9
            },
            
            // Method definitions (functions inside classes)
            {
                type: 'method',
                pattern: /^(\s{4,})(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/gm,
                captureGroups: { name: 2 },
                priority: 8
            },
            
            // Type annotations and variable assignments with types
            {
                type: 'variable',
                pattern: /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^=\n]+)(?:\s*=.*)?$/gm,
                captureGroups: { name: 2 },
                priority: 7
            },
            
            // Variable assignments (module level and class attributes)
            {
                type: 'variable',
                pattern: /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)/gm,
                captureGroups: { name: 2 },
                priority: 6
            },
            
            // List/Dict type annotations (e.g., AccountTransaction: List = ...)
            {
                type: 'variable',
                pattern: /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(?:List|Dict|Set|Tuple|Optional|Union)\s*(?:\[[^\]]*\])?\s*=?/gm,
                captureGroups: { name: 2 },
                priority: 7
            },
            
            // Import statements (from X import Y)
            {
                type: 'variable',
                pattern: /^from\s+[\w.]+\s+import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)/gm,
                captureGroups: { name: 1 },
                priority: 3
            },
            
            // Direct imports (import X)
            {
                type: 'variable',
                pattern: /^import\s+([a-zA-Z_][a-zA-Z0-9_.]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_.]*)*)/gm,
                captureGroups: { name: 1 },
                priority: 3
            }
        ];
    }
    
    /**
     * Extract symbols from Python file content
     */
    extractSymbols(content: string, filePath: string): Symbol[] {
        const symbols: Symbol[] = [];
        const lines = content.split('\n');
        
        // Track current class context for method detection
        let currentClass: string | null = null;
        let classIndentLevel = 0;
        
        // Process each line to extract symbols
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const indentLevel = this.getIndentLevel(line);
            
            // Reset class context if we've moved out of the class
            if (currentClass && indentLevel <= classIndentLevel) {
                currentClass = null;
                classIndentLevel = 0;
            }
            
            // Extract symbols from this line
            const lineSymbols = this.extractSymbolsFromLine(line, lineIndex, currentClass);
            symbols.push(...lineSymbols);
            
            // Update class context
            for (const symbol of lineSymbols) {
                if (symbol.type === 'class') {
                    currentClass = symbol.name;
                    classIndentLevel = indentLevel;
                }
            }
        }
        
        // Post-process to identify methods vs functions
        this.identifyMethods(symbols);
        
        // Extract decorators and additional context
        this.extractDecorators(symbols, lines);
        
        return symbols;
    }
    
    /**
     * Extract symbols from a single line
     */
    private extractSymbolsFromLine(line: string, lineIndex: number, currentClass: string | null): Symbol[] {
        const symbols: Symbol[] = [];
        const patterns = this.getSymbolPatterns();
        
        // Sort patterns by priority (higher priority first)
        const sortedPatterns = patterns.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        for (const pattern of sortedPatterns) {
            const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags.replace('g', ''));
            const match = regex.exec(line);
            
            if (match) {
                const symbolName = match[pattern.captureGroups.name];
                if (symbolName && this.isValidSymbolName(symbolName)) {
                    // Handle multiple imports on one line
                    if (pattern.type === 'variable' && (line.includes('import') || line.includes('from'))) {
                        const importedNames = this.extractImportedNames(symbolName);
                        for (const name of importedNames) {
                            symbols.push(this.createPythonSymbol(
                                name.trim(),
                                'variable',
                                lineIndex,
                                line.indexOf(name),
                                line.trim(),
                                currentClass
                            ));
                        }
                    } else {
                        const symbolType = this.determineSymbolType(line, pattern.type, currentClass);
                        const column = line.indexOf(symbolName);
                        
                        // Extract additional context for type annotations
                        let signature = line.trim();
                        if (line.includes(':') && !line.includes('def ') && !line.includes('class ')) {
                            // This is a type annotation, extract the type
                            const typeMatch = line.match(/:\s*([^=\n]+)/);
                            if (typeMatch) {
                                signature = `${symbolName}: ${typeMatch[1].trim()}`;
                            }
                        }
                        
                        symbols.push(this.createPythonSymbol(
                            symbolName,
                            symbolType,
                            lineIndex,
                            column,
                            signature,
                            currentClass
                        ));
                    }
                }
                break; // Only match first pattern per line
            }
        }
        
        return symbols;
    }
    
    /**
     * Create a Python-specific symbol with additional context
     */
    private createPythonSymbol(
        name: string,
        type: SymbolType,
        line: number,
        column: number,
        signature: string,
        parent?: string | null
    ): Symbol {
        const symbol = this.createSymbol(name, type, line, column, signature, parent || undefined);
        
        // Add Python-specific visibility detection
        symbol.visibility = this.determineVisibility(name);
        
        return symbol;
    }
    
    /**
     * Determine symbol visibility based on Python naming conventions
     */
    private determineVisibility(name: string): 'public' | 'private' | 'protected' {
        if (name.startsWith('__') && name.endsWith('__')) {
            return 'public'; // Magic methods are public
        } else if (name.startsWith('__')) {
            return 'private'; // Name mangled private
        } else if (name.startsWith('_')) {
            return 'protected'; // Protected by convention
        }
        return 'public';
    }
    
    /**
     * Determine the actual symbol type based on context
     */
    private determineSymbolType(line: string, patternType: SymbolType, currentClass: string | null): SymbolType {
        // Functions inside classes are methods
        if (patternType === 'function' && currentClass) {
            return 'method';
        }
        
        // Check for property decorators
        if (line.includes('@property') || line.includes('@staticmethod') || line.includes('@classmethod')) {
            return 'property';
        }
        
        return patternType;
    }
    
    /**
     * Get indentation level of a line
     */
    private getIndentLevel(line: string): number {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }
    
    /**
     * Check if a symbol name is valid
     */
    private isValidSymbolName(name: string): boolean {
        // Python identifier rules: start with letter or underscore, followed by letters, digits, or underscores
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name !== '__';
    }
    
    /**
     * Extract imported names from import statements
     */
    private extractImportedNames(importText: string): string[] {
        // Handle comma-separated imports
        return importText.split(',').map(name => {
            // Handle "as" aliases
            const parts = name.trim().split(/\s+as\s+/);
            return parts.length > 1 ? parts[1] : parts[0];
        }).filter(name => this.isValidSymbolName(name));
    }
    
    /**
     * Post-process to correctly identify methods vs functions
     */
    private identifyMethods(symbols: Symbol[]): void {
        const classes = new Set(symbols.filter(s => s.type === 'class').map(s => s.name));
        
        for (const symbol of symbols) {
            if (symbol.type === 'function' && symbol.parent && classes.has(symbol.parent)) {
                symbol.type = 'method';
            }
        }
    }
    
    /**
     * Extract decorators and add them to symbol context
     */
    private extractDecorators(symbols: Symbol[], lines: string[]): void {
        for (const symbol of symbols) {
            const decorators: string[] = [];
            
            // Look for decorators in the lines before the symbol definition
            for (let i = symbol.line - 1; i >= 0; i--) {
                const line = lines[i].trim();
                
                if (line.startsWith('@')) {
                    decorators.unshift(line);
                } else if (line === '' || line.startsWith('#')) {
                    // Skip empty lines and comments
                    continue;
                } else {
                    // Stop at non-decorator, non-empty, non-comment line
                    break;
                }
            }
            
            if (decorators.length > 0) {
                symbol.decorators = decorators;
                
                // Update signature to include decorators
                const decoratorText = decorators.join(' ');
                symbol.signature = `${decoratorText} ${symbol.signature}`;
            }
        }
    }
    
    /**
     * Enhanced canProcess method for Python files
     */
    canProcess(filePath: string, language: string): boolean {
        // Check language identifier
        if (language === 'python' || language === 'py') {
            return true;
        }
        
        // Check file extensions
        const extension = this.getFileExtension(filePath);
        if (this.fileExtensions.includes(extension)) {
            return true;
        }
        
        // Check for Python shebang
        return filePath.includes('python') || filePath.includes('py');
    }
}