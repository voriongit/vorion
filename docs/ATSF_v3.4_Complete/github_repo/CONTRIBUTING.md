# Contributing to ATSF

Thank you for your interest in contributing to ATSF! This document provides guidelines and information for contributors.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build safer AI systems.

## Getting Started

### Development Setup

```bash
# Clone the repository
git clone https://github.com/agentanchor/atsf.git
cd atsf

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install development dependencies
pip install -e ".[dev]"

# Run tests to verify setup
pytest
```

### Project Structure

```
atsf/
├── src/atsf/              # Main package
│   ├── __init__.py        # Package exports
│   ├── atsf_v33_fixes.py  # Core system
│   ├── atsf_api.py        # FastAPI REST API
│   ├── ai_trism_integration.py  # TRiSM
│   └── ...
├── tests/                 # Test suite
├── docs/                  # Documentation
├── deploy/                # Docker files
└── github-action/         # CI/CD action
```

## How to Contribute

### Reporting Bugs

1. Check existing issues first
2. Use the bug report template
3. Include:
   - Python version
   - ATSF version
   - Minimal reproduction code
   - Expected vs actual behavior

### Suggesting Features

1. Open a discussion first for major features
2. Describe the use case
3. Consider security implications

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `pytest`
6. Run linting: `ruff check src/`
7. Commit with clear messages
8. Push and open a PR

### Commit Messages

Follow conventional commits:

```
feat: add new security layer for XYZ
fix: correct trust calculation edge case
docs: update API reference
test: add tests for drift detection
refactor: simplify velocity cap logic
```

## Development Guidelines

### Code Style

- Follow PEP 8
- Use type hints
- Max line length: 100 characters
- Use `ruff` for linting

```bash
ruff check src/
ruff format src/
```

### Testing

- Write tests for all new features
- Maintain >80% coverage
- Use pytest fixtures for common setup

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=atsf --cov-report=html

# Run specific test file
pytest tests/test_trust_scoring.py

# Run specific test
pytest tests/test_trust_scoring.py::test_velocity_caps
```

### Documentation

- Update docstrings for public APIs
- Update relevant docs/ files
- Include code examples

### Security

Given ATSF's purpose, security is paramount:

- Never log sensitive data
- Validate all inputs
- Consider adversarial inputs
- Review for injection vulnerabilities

## Review Process

1. All PRs require at least one approval
2. CI must pass (tests, linting, security scan)
3. Documentation must be updated
4. Security-sensitive changes need extra review

## Release Process

Releases are automated via GitHub Actions:

1. Update version in `pyproject.toml`
2. Update CHANGELOG.md
3. Create a GitHub release with tag `v3.x.x`
4. CI automatically publishes to PyPI and Docker Hub

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open an Issue
- **Security**: Email security@agentanchor.ai (do not open public issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
