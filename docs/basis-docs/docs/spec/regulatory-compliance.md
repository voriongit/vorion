---
sidebar_position: 7
title: Regulatory Compliance
description: EU AI Act and NIST AI RMF alignment
---

# Regulatory Compliance

BASIS is designed to support compliance with emerging AI regulations. This document maps BASIS capabilities to key regulatory frameworks.

---

## EU AI Act Alignment

The EU AI Act (Regulation 2024/1689) establishes a risk-based framework for AI systems. BASIS provides mechanisms to support compliance across all risk categories.

### Risk Classification Mapping

| EU AI Act Category | BASIS Risk Level | BASIS Mechanisms |
|-------------------|------------------|------------------|
| **Unacceptable Risk** | N/A | Prohibited by policy |
| **High-Risk** | CRITICAL/HIGH | Full governance stack, human oversight required |
| **Limited Risk** | HIGH/LOW | Transparency requirements, audit logging |
| **Minimal Risk** | MINIMAL/LOW | Standard governance, optional logging |

### Article-by-Article Compliance

#### Article 9: Risk Management System

**Requirement**: High-risk AI systems require continuous risk management.

**BASIS Implementation**:
- Trust scoring provides continuous risk assessment
- Decay mechanics ensure ongoing evaluation
- Signal-based updates capture operational risks

```typescript
// Example: Continuous risk monitoring
engine.on('trust:score_changed', async (event) => {
  if (event.newScore < RISK_THRESHOLD) {
    await alertRiskManagement(event);
  }
});
```

#### Article 13: Transparency and Information

**Requirement**: High-risk systems must be sufficiently transparent.

**BASIS Implementation**:
- PROOF layer provides complete audit trails
- All decisions are logged with rationale
- Receipts enable third-party verification

```typescript
// Example: Transparency logging
const proof = await proofService.createProof({
  decision: 'ALLOW',
  agentId: 'agent-001',
  rationale: 'Trust level sufficient, policy check passed',
  evidence: { trustScore: 650, policyId: 'policy-001' },
});
```

#### Article 14: Human Oversight

**Requirement**: High-risk AI must enable human oversight and intervention.

**BASIS Implementation**:
- Escalation mechanisms for human review
- Circuit breakers for emergency stops
- HITL (Human-in-the-Loop) integration points

```yaml
# Example: Policy requiring human oversight
policy:
  name: high-risk-decision
  risk_level: HIGH
  requires:
    human_approval: true
    escalation_timeout: 300s
```

#### Article 15: Accuracy, Robustness, Cybersecurity

**Requirement**: High-risk systems must be accurate and secure.

**BASIS Implementation**:
- Trust scoring tracks accuracy via behavioral signals
- Accelerated decay penalizes unreliable agents
- Ed25519 signatures ensure cryptographic integrity

#### Article 17: Quality Management System

**Requirement**: Providers must implement quality management.

**BASIS Implementation**:
- Standardized governance processes
- Documented policies and procedures
- Audit trails for all operations

### High-Risk System Requirements Checklist

| Requirement | BASIS Feature | Status |
|-------------|---------------|--------|
| Risk management | Trust Engine, Risk Classification | ✅ Supported |
| Data governance | Policy Framework | ✅ Supported |
| Technical documentation | PROOF Layer | ✅ Supported |
| Record-keeping | CHAIN Anchoring | ✅ Supported |
| Transparency | Audit Logging | ✅ Supported |
| Human oversight | Escalation, HITL | ✅ Supported |
| Accuracy monitoring | Behavioral Signals | ✅ Supported |
| Robustness testing | Signal Validation | ✅ Supported |
| Cybersecurity | Ed25519, Hash Chains | ✅ Supported |

---

## NIST AI RMF Alignment

The NIST AI Risk Management Framework (AI RMF 1.0) provides voluntary guidance for managing AI risks. BASIS maps to all four core functions.

### Core Functions Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                    NIST AI RMF Functions                     │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│    GOVERN   │     MAP     │   MEASURE   │      MANAGE      │
│             │             │             │                  │
│ Policies &  │ Identify &  │ Assess &    │ Mitigate &       │
│ Oversight   │ Categorize  │ Quantify    │ Monitor          │
├─────────────┼─────────────┼─────────────┼──────────────────┤
│ BASIS       │ INTENT      │ Trust       │ ENFORCE          │
│ Policies    │ Layer       │ Engine      │ Layer            │
│             │             │             │                  │
│ PROOF       │ Risk        │ Behavioral  │ Circuit          │
│ Layer       │ Classifier  │ Signals     │ Breakers         │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

### GOVERN Function

**Purpose**: Establish and maintain governance structures.

**BASIS Implementation**:

| GOVERN Category | BASIS Feature |
|-----------------|---------------|
| GV-1: Accountability | Proof records with entity attribution |
| GV-2: Risk appetite | Configurable risk thresholds |
| GV-3: Policies | BASIS policy framework |
| GV-4: Roles | Trust tiers with capability grants |
| GV-5: Third-party management | Trust scoring for external agents |

### MAP Function

**Purpose**: Identify and categorize AI risks.

**BASIS Implementation**:

| MAP Category | BASIS Feature |
|--------------|---------------|
| MAP-1: Context | INTENT layer normalizes goals |
| MAP-2: Categorization | Risk classification (MINIMAL/LOW/HIGH/CRITICAL) |
| MAP-3: Impact assessment | Trust components (behavioral, compliance, etc.) |

### MEASURE Function

**Purpose**: Assess and quantify risks.

**BASIS Implementation**:

| MEASURE Category | BASIS Feature |
|------------------|---------------|
| ME-1: Metrics | Trust scores (0-1000) |
| ME-2: Evaluation | Continuous signal processing |
| ME-3: Monitoring | Event emission, wildcard subscriptions |
| ME-4: Testing | Decay formula validation, tier tests |

### MANAGE Function

**Purpose**: Mitigate and monitor risks.

**BASIS Implementation**:

| MANAGE Category | BASIS Feature |
|-----------------|---------------|
| MG-1: Response | Escalation workflows |
| MG-2: Mitigation | Trust decay, accelerated penalties |
| MG-3: Recovery | Recovery mechanics, consecutive successes |
| MG-4: Communication | PROOF receipts, CHAIN anchoring |

---

## ISO 42001 Alignment

ISO 42001 (AI Management System) provides requirements for establishing AI governance. BASIS supports certification preparation.

### Clause Mapping

| ISO 42001 Clause | BASIS Support |
|------------------|---------------|
| 4. Context | Risk classification framework |
| 5. Leadership | Governance council orchestration |
| 6. Planning | Policy definition system |
| 7. Support | Documentation, audit trails |
| 8. Operation | ENFORCE layer, Cognigate |
| 9. Performance | Trust metrics, monitoring |
| 10. Improvement | Recovery mechanics, signal learning |

---

## Compliance Implementation Guide

### Step 1: Risk Assessment

Classify your AI system's risk level:

```typescript
import { classifyRisk } from '@vorionsys/atsf-core/enforce';

const riskLevel = classifyRisk({
  domain: 'healthcare',      // High-risk domain
  dataType: 'personal',      // PII handling
  autonomyLevel: 'advisory', // Human makes final decision
  impactScope: 'individual', // Single person affected
});
// Returns: 'HIGH'
```

### Step 2: Configure Governance

Set up appropriate policies:

```yaml
# High-risk AI policy
policy:
  name: high-risk-healthcare-advisor
  version: "1.0"
  risk_level: HIGH

  requirements:
    min_trust_level: 3  # Trusted tier
    human_oversight: required
    audit_logging: full
    chain_anchoring: true

  escalation:
    triggers:
      - trust_drop > 100
      - policy_violation
      - uncertainty > 0.8
    timeout: 300s
    default_action: deny
```

### Step 3: Enable Audit Trail

Configure comprehensive logging:

```typescript
import { createProofService } from '@vorionsys/atsf-core/proof';

const proofService = createProofService({
  signingKey: process.env.ED25519_PRIVATE_KEY,
  includeMetadata: true,
  hashAlgorithm: 'SHA-256',
});

// Log all significant decisions
engine.on('trust:tier_changed', async (event) => {
  await proofService.createProof({
    type: 'TIER_CHANGE',
    ...event,
  });
});
```

### Step 4: Implement Anchoring

Anchor high-risk proofs to blockchain:

```typescript
import { createChainAnchor } from './chain-anchor';

const chainAnchor = createChainAnchor({
  network: 'mainnet',
  contractAddress: ANCHOR_CONTRACT,
  privateKey: process.env.POLYGON_PRIVATE_KEY,
});

// Anchor daily batches
const pendingProofs = await proofService.getUnanchored({ risk: 'HIGH' });
await chainAnchor.anchorBatch(pendingProofs);
```

---

## Regulatory Resources

### EU AI Act
- [Official Text](https://eur-lex.europa.eu/eli/reg/2024/1689)
- [European AI Office](https://digital-strategy.ec.europa.eu/en/policies/european-approach-artificial-intelligence)

### NIST AI RMF
- [AI RMF 1.0](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST AI RMF Playbook](https://airc.nist.gov/AI_RMF_Knowledge_Base/Playbook)

### ISO 42001
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html)

---

*BASIS is designed to facilitate regulatory compliance but does not guarantee it. Organizations should consult legal experts for specific compliance requirements.*
