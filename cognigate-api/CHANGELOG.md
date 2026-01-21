# Changelog

All notable changes to Cognigate Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive documentation suite (README, INSTALLATION, DEPLOYMENT, CONFIGURATION, TROUBLESHOOTING)
- System status dashboard at `/status` with real-time health monitoring
- Enhanced landing page with interactive API playground
- Quickstart section with tabbed code examples (curl, TypeScript, Python)
- Copy-to-clipboard functionality for code blocks
- Tooltips for technical terms (INTENT, ENFORCE, PROOF, trust_score)
- Dropdown navigation menus (Product, Docs, Ecosystem)
- Comprehensive footer with ecosystem links

### Changed
- Expanded README.md from 12 lines to 375+ lines
- Updated sitemap.xml to include /status page

---

## [0.1.0] - 2026-01-15

### Added
- Initial release of Cognigate Engine
- **INTENT Layer**
  - LLM-powered intent parsing (OpenAI, Anthropic, Google)
  - Automatic risk classification
  - Capability detection
  - Structured output for ENFORCE layer
- **ENFORCE Layer**
  - Trust score integration (AgentAnchor, local, custom)
  - Dynamic capability gating
  - YAML-based policy engine
  - Rate limiting
  - Escalation handling
  - Gate decisions: ALLOW, DENY, ESCALATE, DEGRADE
- **PROOF Layer**
  - Cryptographically chained audit logs
  - SHA-256 hash chaining
  - Agent signatures
  - Append-only storage
  - Query and verification API
- **Core Infrastructure**
  - FastAPI-based REST API
  - Health check endpoints (`/health`, `/ready`)
  - Interactive API documentation (Swagger UI, ReDoc)
  - Structured JSON logging
  - CORS middleware with configurable origins
- **Landing Page**
  - Product overview
  - Quick start instructions
  - API documentation links

### Security
- Input validation on all endpoints
- CORS configuration for trusted origins
- Rate limiting support

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2026-01-15 | Initial release with INTENT, ENFORCE, PROOF layers |

---

## Upgrade Notes

### Upgrading to 0.1.0

This is the initial release. No upgrade path required.

---

## Links

- [GitHub Repository](https://github.com/voriongit/cognigate)
- [Documentation](https://cognigate.dev/docs)
- [Issue Tracker](https://github.com/voriongit/cognigate/issues)

---

*Cognigate is developed and maintained by [VORION](https://vorion.org).*
