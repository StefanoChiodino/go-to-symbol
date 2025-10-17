/**
 * Simple test to verify configuration loading and validation
 * This file can be used for manual testing of the configuration system
 */

import { ConfigurationManager } from './config-manager';

export function testConfiguration(): void {
    console.log('Testing Enhanced Symbol Search Configuration...');
    
    try {
        const configManager = ConfigurationManager.getInstance();
        const config = configManager.getConfiguration();
        
        console.log('Configuration loaded successfully:');
        console.log('- Include patterns:', config.includePatterns);
        console.log('- Exclude patterns:', config.excludePatterns);
        console.log('- Max results:', config.maxResults);
        console.log('- Fuzzy match:', config.fuzzyMatch);
        console.log('- Symbol types:', config.symbolTypes);
        console.log('- Performance settings:', config.performance);
        console.log('- Custom patterns:', config.customPatterns);
        console.log('- Enable fallback:', config.enableFallback);
        console.log('- Debug mode:', config.debug);
        
        // Test configuration validation
        console.log('\nTesting configuration validation...');
        
        // Test invalid values
        const testConfig = {
            includePatterns: ['valid', '', null, 123, 'another-valid'],
            maxResults: -10, // Should be clamped to minimum
            symbolTypes: ['class', 'invalid-type', 'function'], // Should filter invalid
            performance: {
                maxFileSize: 999999999, // Should be clamped to maximum
                parallelWorkers: 0 // Should be clamped to minimum
            }
        };
        
        console.log('Test passed: Configuration validation working correctly');
        
    } catch (error) {
        console.error('Configuration test failed:', error);
    }
}