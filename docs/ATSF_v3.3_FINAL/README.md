# ATSF v2.1 - AgentAnchor Trust Scoring Framework

## Hardened Validation Suite

**Version:** 2.1.0  
**Status:** Production-Ready  
**Last Updated:** January 2025

---

## 🎯 Overview

The AgentAnchor Trust Scoring Framework (ATSF) is a comprehensive system for measuring, tracking, and certifying trust in AI agents. This repository contains the hardened v2.1 implementation with full validation suite.

### Core Principle: Zero-Start (Mandatory Audit Trail)

**All agents must begin at trust score zero.** This is a foundational axiom of ATSF:

- No external reputation can be imported
- No prior deployment history counts without ATSF observation
- No third-party endorsements substitute for observed behavior
- Even established agents from outside ATSF start fresh

**Why?** Trust without an audit trail is unverifiable. An agent claiming "I've been reliable for 2 years" provides no evidence within ATSF. The observation sequence IS the trust evidence—without it, trust cannot be assessed.

```
Registration → τ = 0, κ = 0, |Ω| = 0 → Observations → Trust Builds
```

This ensures all trust scores are grounded in observable, verifiable behavior.

### Key Features

- **Opaque Trust Inference**: Measure trust without access to agent internals
- **4-Tier Observation System**: BLACK_BOX → GRAY_BOX → WHITE_BOX → ATTESTED_BOX
- **5-Level Trust Progression**: PROBATIONARY → PROVISIONAL → CERTIFIED → TRUSTED → EXEMPLARY
- **Grooming Detection**: Multi-window trend analysis catches gradual behavioral degradation
- **Sybil Resistance**: Graph-based detection of vouch cluster attacks
- **Formal Verification**: TLA+ spec with Python model checker

---

## 📊 Validation Results Summary

| Test Suite | Passed | Total | Pass Rate |
|------------|--------|-------|-----------|
| Enhanced Validation | 11 | 11 | **100%** |
| TLA+ Model Check | 6 | 6 | **100%** |
| Hypothesis Property Tests | 9 | 9 | **100%** |
| Jailbreak Probes (Safe Agent) | 16 | 21 | 76.2% |

### States Explored
- **TLA+ Model Checker**: 303,819 distinct states verified
- **Hypothesis Tests**: 2,050+ random test cases
- **Jailbreak Probes**: 21 attack vectors across 10 categories

---

## 📁 Repository Structure

```
atsf/
├── src/
│   ├── Core Implementation
│   │   ├── atsf_v2_1_hardened.py     # Main ATSF implementation
│   │   └── enhanced_trust_registry.py # Trust registry with grooming detection
│   │
│   ├── Formal Verification
│   │   ├── ATSFTrustSystem.tla       # TLA+ specification
│   │   ├── ATSFTrustSystemTLC.tla    # TLC-compatible spec
│   │   └── tla_model_checker.py      # Python model checker
│   │
│   ├── Validation Suites
│   │   ├── enhanced_validation_suite.py   # 11 research-based tests
│   │   ├── hypothesis_property_tests.py   # Property-based tests
│   │   ├── jailbreak_probe_suite.py       # 21 jailbreak probes
│   │   └── brutal_verification_suite.py   # Adversarial tests
│   │
│   ├── Research & Analysis
│   │   ├── research_improvement_plan.py   # Research findings
│   │   ├── bulletproofing_analysis.py     # Gap analysis
│   │   └── competitive_benchmark.py       # Industry comparison
│   │
│   └── Documentation
│       ├── LIMITATIONS.md             # Known limitations
│       └── VALIDATION_PLAN.md         # 5-phase validation roadmap
│
└── README.md                          # This file
```

---

## 🚀 Quick Start

### Run All Validation Tests

```bash
cd src/
python3 run_all_tests.py
```

### Run Individual Suites

```bash
# Enhanced validation suite (11 tests)
python3 enhanced_validation_suite.py

# TLA+ model checking (303K+ states)
python3 tla_model_checker.py

# Hypothesis property tests (2050+ cases)
python3 hypothesis_property_tests.py

# Jailbreak probe suite (21 probes)
python3 jailbreak_probe_suite.py
```

### Test Your Own Agent

```python
from jailbreak_probe_suite import JailbreakProbeRunner

def my_agent(prompt: str) -> str:
    # Your agent implementation
    return response

runner = JailbreakProbeRunner()
report = runner.run_all_probes(my_agent)
print(f"Pass rate: {report.probes_passed/report.total_probes*100:.1f}%")
```

---

## 📋 Test Categories

### Enhanced Validation Suite (11 Tests)

| Category | Test | Status |
|----------|------|--------|
| Deception Detection | Deceptive Behavior Detection | ✅ |
| Safety & Resilience | Recursive Loop Detection | ✅ |
| Sybil Resistance | Vouch Cluster Detection | ✅ |
| Fairness | Trust/Confidence Separation | ✅ |
| Formal Verification | Tier Ceiling Enforcement | ✅ |
| Formal Verification | Trust Bounded [0,1] | ✅ |
| Formal Verification | Deterministic Scoring | ✅ |
| Chaos Engineering | Observation Flood | ✅ |
| Chaos Engineering | Rapid Registration | ✅ |
| Observability | Trace Completeness | ✅ |
| Security (Red Team) | Multi-Turn Grooming Resistance | ✅ |

### Jailbreak Probe Categories (21 Probes)

| Category | Probes | Research ASR |
|----------|--------|--------------|
| Roleplay | 3 | 89.6% |
| Logic Trap | 3 | 81.4% |
| Encoding | 3 | 76.2% |
| Authority | 2 | - |
| Hypothetical | 2 | - |
| Many-Shot | 2 | - |
| Context Switch | 1 | - |
| Emotional | 2 | - |
| Technical | 1 | - |
| Prompt Injection | 2 | - |

---

## 🔬 Research Sources

This validation suite is based on extensive research:

1. **AI Agent Failures 2024-2025**: 233 documented incidents (MITRE)
2. **SybilGuard/SybilLimit**: Academic Sybil attack research
3. **Anthropic Many-Shot**: Jailbreaking research (89.6% ASR)
4. **DeepTeam**: 40+ attack types framework
5. **AWS TLA+**: Formal verification in production
6. **Netflix Chaos Monkey**: Chaos engineering principles
7. **OpenTelemetry**: AI observability standards

### Key Incidents Addressed

| Incident | Year | Impact | Mitigation |
|----------|------|--------|------------|
| SaaStr Database Deletion | 2025 | Data loss + deception | Deception detection |
| $47K Recursive Loop | 2024 | $47,000 | Loop detection |
| Air Canada Chatbot | 2024 | Legal liability | Observation tracing |
| McDonald's AI Drive-Thru | 2024 | Brand damage | Behavioral monitoring |

---

## 📈 Unforeseen Risks Identified

Research identified 10 risks not previously considered:

### Critical (2)
1. **Deceptive Agent Behavior** - Agents lying about their behavior
2. **Registry Centralization Attack** - Single point of failure

### High (4)
3. **Recursive Loop Exploitation** - Multi-agent infinite loops
4. **Trust Graph Sybil Attack** - Vouch cluster manipulation
5. **Jailbreak-Vulnerable Agents** - 89.6% attack success rate
6. **Actuarial Formula Exploitation** - Gaming insurance premiums

### Medium (4)
7. **Observation Timing Attack** - Gaming observation windows
8. **Cold Start Trust Manipulation** - Fast trust building then exploit
9. **Multi-Turn Grooming Attack** - Gradual boundary pushing
10. **Trust/Distrust Conflation** - Unknown vs bad agents

---

## 🛡️ Grooming Detection (New in v2.1)

The enhanced trust registry now detects gradual behavioral degradation:

```python
# Before (Basic Registry)
# Attack: 90% → 0% success over 10 phases
# Result: Trust dropped only 12.8%

# After (Enhanced Registry)  
# Attack: 90% → 0% success over 10 phases
# Result: Trust dropped 96.7%
# Alerts: 4 triggered (SEVERE, CRITICAL)
# Circuit breaker: TRIPPED
```

### Features
- **Exponential time-decay weighting**: Recent observations matter more
- **Multi-window trend detection**: 20, 50, 100 observation windows
- **Severity levels**: NONE → MILD → MODERATE → SEVERE → CRITICAL
- **Automatic circuit breaker**: Trips when trust < 0.1

---

## 📊 TLA+ Invariants Verified

Six safety invariants verified across 303,819 states:

1. **TrustBounded**: Trust scores always in [0, 100]
2. **CeilingEnforced**: Trust ≤ tier ceiling
3. **UnregisteredZeroTrust**: Unregistered agents have zero trust
4. **TierDeterminesCeiling**: Valid ceiling values only
5. **CircuitBreakerConsistency**: Valid state transitions
6. **CeilingAlwaysHigher**: Ceiling ≥ trust for all agents

---

## 🔒 Requirements for Production

Based on validation, these requirements must be met:

### Phase 1: Critical (Weeks 1-2)
- [x] Deception detection probes
- [x] Loop detection
- [x] Grooming detection
- [x] Trust/confidence separation

### Phase 2: Formal (Weeks 3-4)
- [x] TLA+ model checking
- [x] Hypothesis property tests
- [ ] Trace validation

### Phase 3: Red Team (Weeks 5-8)
- [x] Jailbreak probe suite
- [x] Sybil cluster detection
- [ ] Multi-turn attack sequences

### Phase 4: External (Months 2-4)
- [ ] Security audit ($30-80K)
- [ ] Actuarial review ($10-30K)
- [ ] Academic submission

### Phase 5: Production (Months 3-6)
- [ ] Banquet AIq pilot (Dec 19 launch)
- [ ] External pilot (3-5 operators)
- [ ] Adversarial bounty ($5-20K)

---

## 📝 License

Proprietary - AgentAnchor LLC

---

## 🤝 Contact

For questions about ATSF certification or partnership inquiries:

**AgentAnchor** - The UL Listing for AI Agents
