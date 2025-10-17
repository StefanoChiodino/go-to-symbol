/**
 * Script to generate a large number of files for performance testing
 */

const fs = require('fs');
const path = require('path');

function generatePythonClass(className, moduleIndex, classIndex) {
    return `"""
Module ${moduleIndex} - Class ${classIndex}
"""
from typing import List, Dict, Optional
import json


class ${className}:
    """${className} class for testing performance"""
    
    def __init__(self, id: str, name: str):
        self.id = id
        self.name = name
        self._data: Dict = {}
    
    def get_data(self) -> Dict:
        """Get internal data"""
        return self._data.copy()
    
    def set_data(self, key: str, value: any) -> None:
        """Set data value"""
        self._data[key] = value
    
    def process_${className.toLowerCase()}(self) -> bool:
        """Process ${className} data"""
        return len(self._data) > 0
    
    @property
    def data_count(self) -> int:
        """Get data count"""
        return len(self._data)


def create_${className.toLowerCase()}_instance(id: str, name: str) -> ${className}:
    """Factory function for ${className}"""
    return ${className}(id, name)


def validate_${className.toLowerCase()}_data(data: Dict) -> bool:
    """Validate ${className} data"""
    required_fields = ['id', 'name']
    return all(field in data for field in required_fields)


# Constants for ${className}
${className.toUpperCase()}_VERSION = "1.0.0"
${className.toUpperCase()}_MAX_SIZE = 1000
DEFAULT_${className.toUpperCase()}_CONFIG = {
    'timeout': 30,
    'retries': 3,
    'batch_size': 100
}
`;
}

function generateTypeScriptClass(className, moduleIndex, classIndex) {
    return `/**
 * Module ${moduleIndex} - Class ${classIndex}
 */

export interface ${className}Config {
    timeout: number;
    retries: number;
    batchSize: number;
}

export interface ${className}Data {
    id: string;
    name: string;
    metadata: Record<string, any>;
}

export class ${className} {
    private readonly config: ${className}Config;
    private data: Map<string, ${className}Data> = new Map();

    constructor(config: ${className}Config) {
        this.config = config;
    }

    public addData(id: string, name: string, metadata: Record<string, any> = {}): void {
        this.data.set(id, { id, name, metadata });
    }

    public getData(id: string): ${className}Data | undefined {
        return this.data.get(id);
    }

    public process${className}(): Promise<boolean> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(this.data.size > 0);
            }, this.config.timeout);
        });
    }

    public get dataCount(): number {
        return this.data.size;
    }

    public static create${className}(config?: Partial<${className}Config>): ${className} {
        const defaultConfig: ${className}Config = {
            timeout: 1000,
            retries: 3,
            batchSize: 50
        };
        return new ${className}({ ...defaultConfig, ...config });
    }
}

export function validate${className}Data(data: ${className}Data): boolean {
    return !!(data.id && data.name);
}

export async function fetch${className}Data(id: string): Promise<${className}Data | null> {
    // Simulate API call
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                id,
                name: className + ' ' + id,
                metadata: { created: new Date().toISOString() }
            });
        }, 100);
    });
}

// Constants
export const ${className.toUpperCase()}_VERSION = "1.0.0";
export const MAX_${className.toUpperCase()}_COUNT = 1000;
export const DEFAULT_${className.toUpperCase()}_TIMEOUT = 5000;
`;
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function generateFiles() {
    const baseDir = __dirname;
    
    // Generate Python files
    const pythonDir = path.join(baseDir, 'python');
    ensureDirectoryExists(pythonDir);
    
    for (let i = 1; i <= 50; i++) {
        const moduleDir = path.join(pythonDir, 'module_' + i);
        ensureDirectoryExists(moduleDir);
        
        for (let j = 1; j <= 10; j++) {
            const className = 'DataProcessor' + i + j;
            const content = generatePythonClass(className, i, j);
            const filePath = path.join(moduleDir, 'processor_' + j + '.py');
            fs.writeFileSync(filePath, content);
        }
    }
    
    // Generate TypeScript files
    const tsDir = path.join(baseDir, 'typescript');
    ensureDirectoryExists(tsDir);
    
    for (let i = 1; i <= 50; i++) {
        const moduleDir = path.join(tsDir, 'module_' + i);
        ensureDirectoryExists(moduleDir);
        
        for (let j = 1; j <= 10; j++) {
            const className = 'ServiceManager' + i + j;
            const content = generateTypeScriptClass(className, i, j);
            const filePath = path.join(moduleDir, 'manager_' + j + '.ts');
            fs.writeFileSync(filePath, content);
        }
    }
    
    console.log('Generated 1000 files (500 Python + 500 TypeScript) for performance testing');
}

if (require.main === module) {
    generateFiles();
}

module.exports = { generateFiles };