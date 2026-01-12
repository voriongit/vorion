# Changelog

All notable changes to ATSF will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.4.0] - 2026-01-09

### Added
- **Multi-Dimensional Data Cubes** - OLAP-style analytics for agent KB/memory/processing
  - `DataCube` - Slice, dice, roll-up, drill-down, pivot operations
  - `AgentMemory` - Episodic, semantic, procedural, working memory with decay
  - `AgentKnowledgeBase` - Unified analytics + memory + pattern learning
  - Time, agent, action, risk, decision dimensions
  - Anomaly detection across dimensions
  - Time series analysis
- **15 new API endpoints** for cube and memory operations
  - `/agents/{id}/cube/query` - Multi-dimensional queries
  - `/agents/{id}/cube/slice` - Single dimension filtering
  - `/agents/{id}/cube/pivot` - Cross-tabulation
  - `/agents/{id}/cube/timeseries` - Temporal analysis
  - `/agents/{id}/cube/anomalies` - Outlier detection
  - `/agents/{id}/memory/store` - Store memories
  - `/agents/{id}/memory/recall` - Retrieve by topic/type
  - `/agents/{id}/memory/context` - Get working context window

## [3.3.0] - 2026-01-09

### Added
- **AI TRiSM Integration** - Full Gartner 4-pillar governance framework
  - ModelDriftDetector with 4 drift types and 5 severity levels
  - ExplainabilityEngine with audit hashing and reproducibility verification
  - AdversarialDefenseSystem detecting 6 attack types
  - ModelOpsManager with version control and kill switch
  - AIPrivacyGuard with 4 privacy risk types and differential privacy
- **Kill Switch** - Configurable automatic agent halt triggers
  - High risk rate detection (>10%)
  - Injection attack detection
  - Critical drift detection
  - Denial rate spike detection
- **NIST RMF Integration** - Monitor phase metrics export
- **STPA Feedback Loops** - Real-time controller recommendations
- **FastAPI REST API** - 30+ production endpoints
- **pip Package** - `pip install atsf` with optional dependencies
- **Prometheus Metrics** - Production monitoring export

### Changed
- Merged L43-L46 into unified system
- Improved velocity cap enforcement (per-hour, per-day limits)
- Enhanced tool output sanitization patterns

### Fixed
- Empty exception handlers now log warnings
- ML fallback detector graceful degradation
- Config precedence (env > file > defaults)

## [3.2.0] - 2026-01-08

### Added
- **Advanced Security Layers L43-L46**
  - L43: Tool Output Sanitization
  - L44: Reasoning Trace Evaluation
  - L45: Benign Bias Probing (8 categories)
  - L46: CI/CD Safety Gate
- **Unified System** - Multi-party verifier network, red team scheduler
- **Human Oversight** - Approval workflows with timeouts

### Changed
- Refactored security layers for better modularity
- Improved detection patterns

## [3.1.0] - 2026-01-08

### Added
- **Creator Accountability System**
  - Economic staking with slashing
  - Reputation scoring (asymmetric: negative > positive)
  - Trust ceiling inheritance
- **STPA Control Structure** - 4 losses, 5 hazards, 6 controllers, 7 UCAs
- **HRO Principles** - 5 cognitive commitments with health scoring
- **Appeal Workflow** - False positive remediation

## [3.0.0] - 2026-01-08

### Added
- **46 Security Layers** (L0-L42)
- **Trust Scoring** with transparency tiers
- **Velocity Caps** per-action limits
- **Docker Deployment** - docker-compose.yml
- **GitHub Actions** - CI/CD safety gate

### Changed
- Complete architecture rewrite
- New layer classification system

## [2.2.0] - 2026-01-07

### Added
- Frontier safety layers (sandbagging, scheming detection)
- Behavioral drift monitoring
- Intent-outcome alignment

## [2.1.0] - 2026-01-07

### Added
- Traffic analysis
- Replication prevention
- Containment protocols

## [2.0.0] - 2026-01-07

### Added
- Initial 42-layer framework
- Basic trust scoring
- SQLAlchemy models

## [1.1.0] - 2026-01-06

### Added
- Core trust engine
- Action processing pipeline

## [1.0.0] - 2026-01-06

### Added
- Initial release
- Basic framework structure
