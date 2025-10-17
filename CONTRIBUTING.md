# Contributing to Go to Symbol

Thank you for your interest in contributing to Go to Symbol! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites
- Node.js 16.x or higher
- VSCode 1.74.0 or higher
- Git

### Getting Started
1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/go-to-symbol.git
   cd go-to-symbol
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Compile the extension:
   ```bash
   npm run compile
   ```

### Development Workflow
1. Make your changes in the `src/` directory
2. Compile and test:
   ```bash
   npm run compile
   npm run lint
   npm test
   ```
3. Test the extension in VSCode:
   - Press `F5` to launch a new Extension Development Host window
   - Test your changes in the new window

### Code Style
- Follow TypeScript best practices
- Use ESLint configuration provided in the project
- Add JSDoc comments for public APIs
- Write unit tests for new functionality

### Submitting Changes
1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes and commit:
   ```bash
   git commit -m "Add: your feature description"
   ```
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Create a Pull Request

### Testing
- Write unit tests for new functionality
- Ensure all existing tests pass
- Test with various file types and repository sizes
- Test performance with large repositories

### Reporting Issues
When reporting issues, please include:
- VSCode version
- Extension version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Sample code or repository (if applicable)

### Feature Requests
- Check existing issues first
- Provide clear use case and rationale
- Consider implementation complexity
- Be open to discussion and alternatives

## Code of Conduct
Please be respectful and constructive in all interactions. We aim to create a welcoming environment for all contributors.

## Questions?
Feel free to open an issue for questions or reach out to the maintainers.