# Contributing to Snaphunt

Thank you for considering contributing to Snaphunt! We welcome contributions from the community.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/snaphunt.git
   cd snaphunt
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running the Application

```bash
# Start backend and MCP server
npm run dev

# In another terminal, start frontend
npm run dev --prefix apps/frontend
```

### Code Style

- Follow existing code patterns and conventions
- Use TypeScript for type safety
- Write descriptive variable and function names
- Add comments for complex logic

### Testing Your Changes

Before submitting:

1. **Test locally**: Ensure the app runs without errors
2. **Check TypeScript**: Run `npm run build` to verify no type errors
3. **Test key flows**:
   - Configuration setup
   - PDF ingestion
   - Search/ranking
   - Deep analysis
   - Authentication (if modified)

## Submitting Changes

1. **Commit your changes** with clear, descriptive messages:
   ```bash
   git commit -m "Add: feature description"
   git commit -m "Fix: bug description"
   git commit -m "Update: improvement description"
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a Pull Request** on GitHub with:
   - Clear title and description
   - Reference any related issues
   - Screenshots/videos if UI changes
   - Test results if applicable

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation if you change functionality
- Ensure your code doesn't introduce TypeScript errors
- Add comments for non-obvious code
- Update README.md if adding new features

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on the code, not the person

## Questions?

- Open an issue for bugs or feature requests
- Use GitHub Discussions for questions
- Tag maintainers if you need help

Thank you for contributing to Snaphunt! 🚀
