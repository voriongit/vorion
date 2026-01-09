# Contributing to Vorion

Thank you for your interest in contributing to Vorion! This document provides guidelines and information for partners and contributors.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Pull Request Process](#pull-request-process)
6. [Component Guidelines](#component-guidelines)
7. [Testing Requirements](#testing-requirements)
8. [Documentation](#documentation)
9. [Security](#security)
10. [Partner Program](#partner-program)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment. All contributors are expected to:

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the project
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Public or private harassment
- Publishing others' private information

Report violations to: conduct@vorion.io

---

## Getting Started

### Prerequisites

```bash
# Required
- Git 2.40+
- Node.js 20+ (LTS recommended)
- Python 3.11+ (for Python components)
- Docker 24+
- Docker Compose 2.20+

# Recommended
- VS Code with recommended extensions
- GitHub CLI (gh)
```

### Initial Setup

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/vorion.git
cd vorion

# 3. Add upstream remote
git remote add upstream https://github.com/vorion/vorion.git

# 4. Install dependencies
npm install

# 5. Copy environment config
cp configs/environments/.env.example .env

# 6. Verify setup
npm run verify-setup
```

### Environment Configuration

```bash
# .env file
VORION_ENV=development
VORION_LOG_LEVEL=debug
VORION_DB_HOST=localhost
VORION_DB_PORT=5432
VORION_REDIS_HOST=localhost
VORION_REDIS_PORT=6379
```

---

## Development Workflow

### Branch Strategy

```
main
  │
  ├── develop          # Integration branch
  │     │
  │     ├── feature/*  # New features
  │     ├── bugfix/*   # Bug fixes
  │     ├── hotfix/*   # Critical fixes
  │     └── release/*  # Release preparation
  │
  └── docs/*           # Documentation only
```

### Branch Naming

```bash
# Features
feature/BASIS-123-add-constraint-evaluation

# Bug fixes
bugfix/PROOF-456-fix-hash-calculation

# Hotfixes
hotfix/SEC-789-patch-vulnerability

# Documentation
docs/update-api-reference
```

### Workflow Steps

```bash
# 1. Sync with upstream
git checkout develop
git pull upstream develop

# 2. Create feature branch
git checkout -b feature/BASIS-123-new-feature

# 3. Make changes
# ... code ...

# 4. Run tests
npm test

# 5. Commit changes
git add .
git commit -m "feat(basis): add constraint evaluation

- Implement constraint parser
- Add evaluation engine
- Include unit tests

Refs: BASIS-123"

# 6. Push to your fork
git push origin feature/BASIS-123-new-feature

# 7. Create Pull Request
gh pr create --base develop
```

---

## Coding Standards

### General Principles

- **Clarity over cleverness** - Write readable code
- **Single responsibility** - One function, one purpose
- **Defensive programming** - Validate inputs, handle errors
- **Security first** - Consider security implications

### TypeScript/JavaScript

```typescript
// File: src/basis/evaluator.ts

/**
 * Evaluates a constraint against an intent context.
 *
 * @param constraint - The constraint to evaluate
 * @param context - The intent context
 * @returns Evaluation result with details
 * @throws ConstraintError if constraint is malformed
 */
export async function evaluateConstraint(
  constraint: Constraint,
  context: IntentContext
): Promise<EvaluationResult> {
  // Validate inputs
  if (!constraint?.id) {
    throw new ConstraintError('Constraint must have an ID');
  }

  // Implementation
  const result = await performEvaluation(constraint, context);

  // Log for audit
  logger.info('Constraint evaluated', {
    constraintId: constraint.id,
    result: result.passed,
    duration: result.durationMs
  });

  return result;
}
```

### Python

```python
# File: src/trust_engine/scorer.py

from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class TrustScore:
    """Represents an entity's trust score."""

    entity_id: str
    score: int  # 0-1000
    level: int  # L0-L4
    components: dict[str, float]
    updated_at: datetime


def calculate_trust_score(
    entity_id: str,
    signals: list[TrustSignal]
) -> TrustScore:
    """
    Calculate trust score from behavioral signals.

    Args:
        entity_id: The entity to score
        signals: List of trust signals

    Returns:
        Calculated TrustScore

    Raises:
        ValueError: If entity_id is invalid
    """
    if not entity_id:
        raise ValueError("entity_id is required")

    # Calculate component scores
    behavioral = _calculate_behavioral(signals)
    compliance = _calculate_compliance(signals)
    identity = _calculate_identity(signals)
    context = _calculate_context(signals)

    # Weighted combination
    score = int(
        behavioral * 0.40 +
        compliance * 0.25 +
        identity * 0.20 +
        context * 0.15
    )

    logger.info(
        "Trust score calculated",
        extra={"entity_id": entity_id, "score": score}
    )

    return TrustScore(
        entity_id=entity_id,
        score=score,
        level=_score_to_level(score),
        components={
            "behavioral": behavioral,
            "compliance": compliance,
            "identity": identity,
            "context": context
        },
        updated_at=datetime.utcnow()
    )
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `constraint-evaluator.ts` |
| Classes | PascalCase | `ConstraintEvaluator` |
| Functions | camelCase | `evaluateConstraint()` |
| Constants | UPPER_SNAKE | `MAX_TRUST_SCORE` |
| Interfaces | PascalCase + I prefix | `IConstraint` |
| Types | PascalCase | `EvaluationResult` |

### File Structure

```typescript
// 1. Imports (external, then internal)
import { Logger } from 'winston';
import { Constraint } from '../types';
import { validateConstraint } from './validator';

// 2. Constants
const MAX_EVALUATION_TIME_MS = 100;

// 3. Types/Interfaces
interface EvaluationOptions {
  timeout?: number;
  strict?: boolean;
}

// 4. Main exports
export class ConstraintEvaluator {
  // ...
}

// 5. Helper functions (private)
function normalizeConstraint(c: Constraint): Constraint {
  // ...
}
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
- [ ] Commit messages follow convention

### PR Template

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Related Issues
Closes #123

## Changes Made
- Change 1
- Change 2

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)

## Checklist
- [ ] Self-reviewed code
- [ ] Added necessary documentation
- [ ] No new warnings
- [ ] Security implications considered
```

### Review Process

1. **Automated Checks** - CI runs tests, linting, security scan
2. **Code Review** - At least 1 maintainer approval required
3. **Security Review** - Required for security-sensitive changes
4. **Documentation Review** - Required for API changes

### Merge Requirements

- All CI checks passing
- At least 1 approving review
- No unresolved conversations
- Branch up to date with base

---

## Component Guidelines

### BASIS (Rule Engine)

```yaml
# Rule file structure
namespace: "your-namespace"
version: "1.0.0"
description: "Description of rule set"

rules:
  - id: "rule-001"
    name: "Human readable name"
    description: "What this rule does"
    when:
      intent_type: "specific_type"
    evaluate:
      - condition: "expression"
        result: "allow|deny|escalate"
```

**Guidelines:**
- Rules must be idempotent
- Include clear error messages
- Document all conditions
- Test edge cases

### PROOF (Evidence)

**Guidelines:**
- Never modify existing proof records
- Always include timestamps
- Hash all evidence cryptographically
- Maintain chain integrity

### Trust Engine

**Guidelines:**
- Signals must be timestamped
- Score calculations must be deterministic
- Document all scoring factors
- Include decay calculations

---

## Testing Requirements

### Test Coverage

| Component | Minimum Coverage |
|-----------|------------------|
| BASIS | 90% |
| ENFORCE | 90% |
| PROOF | 95% |
| Trust Engine | 90% |
| API | 85% |

### Test Structure

```typescript
// File: tests/unit/basis/evaluator.test.ts

describe('ConstraintEvaluator', () => {
  describe('evaluateConstraint', () => {
    it('should pass when all conditions met', async () => {
      // Arrange
      const constraint = createTestConstraint();
      const context = createTestContext();

      // Act
      const result = await evaluateConstraint(constraint, context);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.evaluatedConditions).toHaveLength(3);
    });

    it('should fail when condition not met', async () => {
      // ...
    });

    it('should throw on invalid constraint', async () => {
      // ...
    });
  });
});
```

### Test Types

1. **Unit Tests** - Test individual functions
2. **Integration Tests** - Test component interactions
3. **E2E Tests** - Test full workflows
4. **Performance Tests** - Test under load
5. **Security Tests** - Test security controls

---

## Documentation

### Code Documentation

- All public APIs must have JSDoc/docstrings
- Include examples in documentation
- Document error conditions
- Keep documentation up to date

### README Updates

When adding features:
1. Update feature list in README
2. Add usage examples
3. Update architecture diagram if needed

### API Documentation

- Use OpenAPI/Swagger for REST APIs
- Include request/response examples
- Document error codes
- Version API documentation

---

## Security

### Security Requirements

- **No secrets in code** - Use environment variables
- **Input validation** - Validate all inputs
- **Output encoding** - Encode outputs appropriately
- **Authentication** - All APIs must be authenticated
- **Authorization** - Implement least privilege
- **Logging** - Log security events
- **Dependencies** - Keep dependencies updated

### Reporting Vulnerabilities

**DO NOT** create public issues for security vulnerabilities.

Email: security@vorion.io

Include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

---

## Partner Program

### Partner Tiers

| Tier | Requirements | Benefits |
|------|--------------|----------|
| **Registered** | Sign agreement | Access to repo, basic support |
| **Certified** | Complete training | Priority support, early access |
| **Premier** | Dedicated commitment | Direct engineering access |
| **Strategic** | Joint roadmap | Co-development opportunities |

### Partner Responsibilities

- Follow contribution guidelines
- Maintain code quality
- Participate in reviews
- Report issues promptly
- Protect confidential information

### Getting Partner Access

1. Contact: partners@vorion.io
2. Complete partner agreement
3. Attend onboarding session
4. Receive repository access

---

## Questions?

- **General**: contribute@vorion.io
- **Partners**: partners@vorion.io
- **Security**: security@vorion.io

---

Thank you for contributing to Vorion!
