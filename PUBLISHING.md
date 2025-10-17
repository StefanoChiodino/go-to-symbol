# Publishing Guide

This guide covers how to publish the Go to Symbol extension to the VSCode Marketplace.

## Prerequisites

1. **Visual Studio Code Extension Manager (vsce)**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Azure DevOps Personal Access Token**
   - Go to [Azure DevOps](https://dev.azure.com)
   - Create a Personal Access Token with "Marketplace (publish)" scope
   - Keep the token secure

3. **Publisher Account**
   - Create a publisher account on [VSCode Marketplace](https://marketplace.visualstudio.com/manage)
   - Update `publisher` field in `package.json` to match your publisher ID

## Pre-Publishing Checklist

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with new features/fixes
- [ ] Run tests: `npm test`
- [ ] Run linting: `npm run lint`
- [ ] Compile extension: `npm run compile`
- [ ] Test extension manually in VSCode
- [ ] Update documentation if needed

## Publishing Steps

### 1. Login to vsce
```bash
vsce login <your-publisher-name>
```
Enter your Personal Access Token when prompted.

### 2. Package the Extension
```bash
npm run package
```
This creates a `.vsix` file for testing.

### 3. Test the Package
Install the `.vsix` file locally to test:
```bash
code --install-extension go-to-symbol-0.1.0.vsix
```

### 4. Publish to Marketplace
```bash
npm run publish
```
Or manually:
```bash
vsce publish
```

### 5. Verify Publication
- Check the [VSCode Marketplace](https://marketplace.visualstudio.com)
- Search for your extension
- Verify all information is correct

## Version Management

### Semantic Versioning
- **Patch** (0.1.1): Bug fixes, small improvements
- **Minor** (0.2.0): New features, backward compatible
- **Major** (1.0.0): Breaking changes

### Automated Versioning
```bash
# Patch version
vsce publish patch

# Minor version  
vsce publish minor

# Major version
vsce publish major

# Specific version
vsce publish 1.2.3
```

## Post-Publishing

1. **Create Git Tag**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Update Repository**
   - Update README badges with new version
   - Close related GitHub issues
   - Update project documentation

3. **Monitor**
   - Check download statistics
   - Monitor user feedback and issues
   - Plan next release based on feedback

## Troubleshooting

### Common Issues

**Authentication Failed**
- Verify Personal Access Token is valid
- Check token has "Marketplace (publish)" scope
- Re-login with `vsce login`

**Package Too Large**
- Check `.vscodeignore` excludes unnecessary files
- Remove large dependencies or assets
- Optimize compiled JavaScript

**Validation Errors**
- Ensure all required fields in `package.json` are filled
- Verify extension manifest is valid
- Check for TypeScript compilation errors

**Publisher Not Found**
- Verify publisher name matches your account
- Create publisher account if needed
- Update `publisher` field in `package.json`

## Security Notes

- Never commit Personal Access Tokens to version control
- Use environment variables for CI/CD publishing
- Regularly rotate access tokens
- Review extension permissions before publishing

## Marketplace Guidelines

- Follow [VSCode Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- Ensure extension description is clear and accurate
- Provide good documentation and examples
- Respond to user feedback promptly
- Keep extension updated and maintained