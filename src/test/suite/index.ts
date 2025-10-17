import * as path from 'path';
import * as fs from 'fs';

// Import Mocha properly
const Mocha = require('mocha');

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 30000 // 30 seconds timeout for end-to-end tests
	});

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise((c, e) => {
		try {
			// Find test files manually
			const testFiles = findTestFiles(testsRoot);
			
			// Add files to the test suite
			testFiles.forEach(f => mocha.addFile(f));

			// Run the mocha test
			mocha.run((failures: number) => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (err) {
			console.error(err);
			e(err);
		}
	});
}

function findTestFiles(dir: string): string[] {
	const files: string[] = [];
	
	function scanDir(currentDir: string) {
		const items = fs.readdirSync(currentDir);
		
		for (const item of items) {
			const fullPath = path.join(currentDir, item);
			const stat = fs.statSync(fullPath);
			
			if (stat.isDirectory()) {
				scanDir(fullPath);
			} else if (item.endsWith('.test.js')) {
				files.push(fullPath);
			}
		}
	}
	
	scanDir(dir);
	return files;
}