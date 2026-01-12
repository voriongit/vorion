# Contributing to BASIS

Thank you for your interest in contributing to the BASIS standard. This document outlines how to participate in the development of the specification and reference implementations.

## The Role of VORION

**VORION** serves as the commercial steward of BASIS, maintaining the specification and ensuring it remains:

- **Open**: Free to use, implement, and extend
- **Stable**: Changes follow a rigorous RFC process
- **Interoperable**: Implementations must pass conformance tests

## Ways to Contribute

### 1. Reporting Issues

Found a bug in the schema? Unclear specification language? [Open an issue](https://github.com/vorion-org/basis-core/issues) with:

- Clear description of the problem
- Relevant section of the spec or schema
- Suggested improvement (if any)

### 2. Proposing Changes (CRC Process)

Significant changes to BASIS follow the **Community Request for Comments (CRC)** process:

1. **Draft**: Create a proposal in `proposals/crc-NNNN-title.md`
2. **Discussion**: Open a PR and gather community feedback (minimum 14 days)
3. **Revision**: Address feedback and refine the proposal
4. **Vote**: Steering committee votes on adoption
5. **Implementation**: Accepted CRCs are implemented in the next minor/major version

#### CRC Template

```markdown
# CRC-NNNN: Title

**Author:** Your Name
**Status:** Draft | Discussion | Accepted | Rejected | Withdrawn
**Created:** YYYY-MM-DD

## Abstract
One paragraph summary.

## Motivation
Why is this change needed?

## Specification
Detailed technical specification.

## Backwards Compatibility
How does this affect existing policies?

## Security Considerations
Security implications of this change.

## Reference Implementation
Link to reference implementation (required for acceptance).
```

### 3. Reference Implementations

We welcome implementations in new languages. Requirements:

- Must pass the conformance test suite
- Must include comprehensive documentation
- Must be licensed under Apache 2.0 or compatible

### 4. Example Policies

Share real-world policy bundles (sanitized) to help others:

- Place in `examples/` directory
- Include descriptive comments
- Ensure no proprietary or sensitive information

## Development Setup

### Prerequisites

- Node.js 20+ or Python 3.11+
- Git

### Running Tests

```bash
# TypeScript
cd lib/typescript
npm install
npm test

# Python
cd lib/python
pip install -e ".[dev]"
pytest
```

### Schema Validation

```bash
# Validate a policy bundle against the schema
npm run validate -- path/to/policy.yaml
```

## Code of Conduct

All contributors must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment.

## License

By contributing, you agree that your contributions will be licensed under:

- **Apache 2.0** for code and schemas
- **CC-BY 4.0** for documentation

## Governance

The BASIS Steering Committee consists of:

- VORION representatives (2 seats)
- Community representatives (3 seats, elected annually)
- Technical Advisory Board (non-voting)

Steering Committee decisions require a 2/3 majority for specification changes and simple majority for procedural matters.

## Questions?

- **General**: Open a [Discussion](https://github.com/vorion-org/basis-core/discussions)
- **Security**: Email security@vorion.org (do not open public issues for vulnerabilities)
- **Commercial**: Contact partners@vorion.org

---

*Thank you for helping make autonomous AI systems safer and more accountable.*
