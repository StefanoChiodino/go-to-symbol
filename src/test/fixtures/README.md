# Test Fixtures

This directory contains sample projects and files used for end-to-end testing of the Enhanced Symbol Search extension.

## Structure

### python-project/
A sample Python project containing various symbol types for testing Python-specific search functionality:

- **main.py**: Contains classes (`AccountInvoice`, `UserManager`), functions (`process_account_data`, `fetch_user_data`), and variables
- **utils/helpers.py**: Utility functions and classes (`ConfigurationManager`, validation functions)
- **models/database.py**: Database-related classes with inheritance and abstract methods

### typescript-project/
A sample TypeScript project for testing TypeScript/JavaScript symbol search:

- **src/main.ts**: Main module with interfaces, classes, and functions
- **src/utils/validation.ts**: Validation utilities with classes and functions

### large-project/
Performance testing directory:

- **generate-files.js**: Script to generate a large number of files for performance testing
- **python/**: Generated Python modules (50 modules × 10 files = 500 files)
- **typescript/**: Generated TypeScript modules (50 modules × 10 files = 500 files)

## Test Coverage

The fixtures are designed to test:

1. **Symbol Types**: Classes, functions, methods, variables, interfaces, constants
2. **Language Features**: 
   - Python: decorators, async functions, class inheritance, dataclasses
   - TypeScript: interfaces, type aliases, generics, async functions
3. **Search Patterns**: Fuzzy matching, exact matching, partial names
4. **Performance**: Large codebases, deep directory structures, concurrent searches
5. **Edge Cases**: Malformed files, very large files, non-existent paths

## Usage

The test fixtures are automatically used by the test suites in `src/test/suite/`:

- `extension.e2e.test.ts`: End-to-end functionality tests
- `performance.test.ts`: Performance and scalability tests  
- `vscode-integration.test.ts`: VSCode API integration tests

## Performance Test Data

The large-project fixtures generate:
- 1000 total files (500 Python + 500 TypeScript)
- ~50MB of code content
- Various symbol types and naming patterns
- Deep directory structures (up to 10 levels)

This simulates a medium-to-large codebase for testing the 2-second search requirement specified in the project requirements.