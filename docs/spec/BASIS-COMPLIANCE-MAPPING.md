# BASIS Compliance Mapping

**Version 1.0.0 | January 2026**

---

## Overview

This document maps BASIS capabilities to major regulatory and compliance frameworks. It provides guidance for organizations seeking to demonstrate that their AI governance implementation meets specific compliance requirements.

---

## 1. Compliance Framework Summary

| Framework | Jurisdiction | Focus Area | BASIS Relevance |
|-----------|--------------|------------|-----------------|
| SOC 2 Type II | Global | Security, Availability, Confidentiality | High |
| ISO 27001:2022 | Global | Information Security | High |
| GDPR | EU/EEA | Data Protection | High |
| HIPAA | US | Health Information | High |
| PCI DSS 4.0 | Global | Payment Card Data | Medium |
| EU AI Act | EU | AI Systems Regulation | Critical |
| NIST AI RMF | US | AI Risk Management | High |
| SOX | US | Financial Reporting | Medium |

---

## 2. SOC 2 Type II Mapping

### 2.1 Trust Services Criteria Coverage

| TSC Category | BASIS Component | Coverage |
|--------------|-----------------|----------|
| Security (CC) | All layers | Full |
| Availability (A) | Failure handling | Full |
| Processing Integrity (PI) | ENFORCE, PROOF | Full |
| Confidentiality (C) | Capability gating | Full |
| Privacy (P) | Data capabilities | Partial |

### 2.2 Common Criteria Mapping

#### CC1: Control Environment

| Control | BASIS Implementation |
|---------|---------------------|
| CC1.1 - COSO Principles | Trust scoring provides quantified integrity assessment |
| CC1.2 - Board oversight | Council governance supports escalation to oversight |
| CC1.3 - Organizational structure | Entity hierarchy with clear capability boundaries |
| CC1.4 - Commitment to competence | Trust tiers map competence to autonomy |
| CC1.5 - Accountability | PROOF layer provides complete accountability chain |

#### CC2: Communication and Information

| Control | BASIS Implementation |
|---------|---------------------|
| CC2.1 - Quality information | Structured intent records with metadata |
| CC2.2 - Internal communication | Escalation system for governance decisions |
| CC2.3 - External communication | Audit trail for external communications |

#### CC5: Control Activities

| Control | BASIS Implementation |
|---------|---------------------|
| CC5.1 - Risk mitigation | Risk classification in INTENT layer |
| CC5.2 - Technology controls | Capability gating, trust tiers |
| CC5.3 - Policies and procedures | Policy engine in ENFORCE layer |

#### CC6: Logical and Physical Access

| Control | BASIS Implementation |
|---------|---------------------|
| CC6.1 - Access controls | Trust-based capability gating |
| CC6.2 - Credential management | Entity authentication |
| CC6.3 - System boundaries | Trust boundaries between zones |
| CC6.6 - Access restrictions | DENY decisions with audit |
| CC6.7 - Information modification | Write capability restrictions |
| CC6.8 - Transmission security | TLS requirement |

#### CC7: System Operations

| Control | BASIS Implementation |
|---------|---------------------|
| CC7.1 - Detection | Anomaly detection in trust scoring |
| CC7.2 - Monitoring | Real-time governance decisions |
| CC7.3 - Vulnerability management | INTENT layer threat detection |
| CC7.4 - Incident response | Failure mode handling |

#### CC8: Change Management

| Control | BASIS Implementation |
|---------|---------------------|
| CC8.1 - Change authorization | Policy modification requires escalation |

#### CC9: Risk Mitigation

| Control | BASIS Implementation |
|---------|---------------------|
| CC9.1 - Risk identification | Risk classification in INTENT |
| CC9.2 - Risk assessment | Trust scoring, capability gating |

### 2.3 SOC 2 Audit Evidence

BASIS provides the following audit evidence:

| Evidence Type | Source | Retention |
|---------------|--------|-----------|
| Access logs | ENFORCE decisions | 7 years |
| Change logs | Policy modifications | 7 years |
| Security events | Threat detection | 7 years |
| Operational metrics | System monitoring | 1 year |

---

## 3. ISO 27001:2022 Mapping

### 3.1 Annex A Controls

#### A.5: Organizational Controls

| Control | BASIS Implementation |
|---------|---------------------|
| A.5.1 Policies for information security | ENFORCE policy engine |
| A.5.2 Information security roles | Entity trust tiers |
| A.5.3 Segregation of duties | Capability separation |
| A.5.7 Threat intelligence | INTENT threat detection |
| A.5.8 Information security in project management | Governance-by-default |
| A.5.23 Information security for cloud services | Trust boundaries |
| A.5.24 Information security incident management | Failure mode handling |

#### A.6: People Controls

| Control | BASIS Implementation |
|---------|---------------------|
| A.6.1 Screening | Trust scoring for entities |
| A.6.3 Information security awareness | (Not directly applicable) |

#### A.7: Physical Controls

| Control | BASIS Implementation |
|---------|---------------------|
| (Not directly applicable to AI governance) | — |

#### A.8: Technological Controls

| Control | BASIS Implementation |
|---------|---------------------|
| A.8.1 User endpoint devices | Entity authentication |
| A.8.2 Privileged access rights | Certified/Autonomous tiers |
| A.8.3 Information access restriction | Capability gating |
| A.8.4 Access to source code | Admin capabilities |
| A.8.5 Secure authentication | API authentication |
| A.8.6 Capacity management | Rate limiting |
| A.8.7 Protection against malware | INTENT injection detection |
| A.8.9 Configuration management | Policy management |
| A.8.10 Information deletion | Data:delete capabilities |
| A.8.11 Data masking | Capability-based data access |
| A.8.12 Data leakage prevention | Data export controls |
| A.8.15 Logging | PROOF layer |
| A.8.16 Monitoring activities | Real-time governance |
| A.8.17 Clock synchronization | Timestamp requirements |
| A.8.20 Network security | TLS requirements |
| A.8.24 Use of cryptography | SHA-256 hashing, signatures |
| A.8.25 Secure development lifecycle | (Implementation dependent) |
| A.8.28 Secure coding | Input validation requirements |

### 3.2 ISMS Integration

BASIS supports ISMS by providing:

| ISMS Component | BASIS Support |
|----------------|---------------|
| Risk assessment | Risk classification in INTENT |
| Risk treatment | Trust scoring, capability gating |
| Statement of Applicability | Capability taxonomy |
| Monitoring | ENFORCE decisions, metrics |
| Continual improvement | Trust decay, behavioral feedback |

---

## 4. GDPR Mapping

### 4.1 Key GDPR Articles

| Article | Requirement | BASIS Implementation |
|---------|-------------|---------------------|
| Art. 5(1)(a) | Lawfulness, fairness, transparency | PROOF layer transparency |
| Art. 5(1)(b) | Purpose limitation | Intent extraction with purpose |
| Art. 5(1)(c) | Data minimization | Capability-gated data access |
| Art. 5(1)(d) | Accuracy | Trust scoring validation |
| Art. 5(1)(e) | Storage limitation | Proof retention policies |
| Art. 5(1)(f) | Integrity and confidentiality | Cryptographic proofs, access control |
| Art. 5(2) | Accountability | Complete audit trail |
| Art. 25 | Data protection by design | Governance-before-execution |
| Art. 30 | Records of processing | PROOF layer records |
| Art. 32 | Security of processing | Trust boundaries, capability gating |
| Art. 35 | DPIA | Risk classification supports DPIA |

### 4.2 Data Subject Rights Support

| Right | BASIS Support |
|-------|---------------|
| Right of access | PROOF records show processing |
| Right to rectification | Data:write capabilities with audit |
| Right to erasure | Data:delete capabilities with proof |
| Right to restriction | Capability gating can restrict |
| Right to data portability | Data:export capabilities |
| Right to object | Escalation mechanism |

### 4.3 GDPR-Specific Capabilities

Organizations processing EU data SHOULD implement:

```yaml
gdpr_capabilities:
  - capability: "data:read/sensitive/pii"
    additional_requirements:
      - legal_basis_required: true
      - purpose_limitation: true
      - data_subject_notification: conditional

  - capability: "data:delete/pii/erasure"
    behavior: "Right to erasure execution"
    audit_requirements:
      - record_request_source: true
      - verify_identity: true
      - cascade_to_processors: true

  - capability: "data:export/pii/portability"
    behavior: "Data portability execution"
    format_requirements:
      - structured: true
      - machine_readable: true
      - commonly_used: true
```

---

## 5. HIPAA Mapping

### 5.1 Security Rule Requirements

#### Administrative Safeguards (§164.308)

| Requirement | BASIS Implementation |
|-------------|---------------------|
| Security Management Process | Trust scoring, risk classification |
| Assigned Security Responsibility | Entity ownership model |
| Workforce Security | Trust tiers for access |
| Information Access Management | Capability gating |
| Security Awareness Training | (Organizational) |
| Security Incident Procedures | Failure mode handling |
| Contingency Plan | Failure recovery procedures |
| Evaluation | Trust scoring as continuous evaluation |

#### Technical Safeguards (§164.312)

| Requirement | BASIS Implementation |
|-------------|---------------------|
| Access Control | Trust-based capability gating |
| Audit Controls | PROOF layer |
| Integrity | Hash chain, cryptographic proofs |
| Person/Entity Authentication | Entity authentication |
| Transmission Security | TLS requirements |

### 5.2 PHI-Specific Capabilities

```yaml
hipaa_capabilities:
  - capability: "data:read/sensitive/phi"
    minimum_tier: "certified"
    additional_requirements:
      - minimum_necessary: true
      - authorization_check: true
      - audit_required: true

  - capability: "data:write/phi"
    minimum_tier: "certified"
    requires_escalation: conditional
    audit_requirements:
      - detailed_access_log: true
      - modification_tracking: true

  - capability: "comm:external/phi"
    minimum_tier: "autonomous"
    requires_escalation: true
    encryption_required: true
```

---

## 6. PCI DSS 4.0 Mapping

### 6.1 Key Requirements

| Requirement | BASIS Implementation |
|-------------|---------------------|
| 1. Network Security | Trust boundaries |
| 2. Secure Configurations | Policy management |
| 3. Protect Account Data | Data:read/sensitive/pci capability |
| 4. Encrypt Transmission | TLS requirement |
| 5. Protect from Malware | INTENT threat detection |
| 6. Secure Development | Input validation |
| 7. Restrict Access | Capability gating |
| 8. Identify Users | Entity authentication |
| 9. Physical Security | (Infrastructure) |
| 10. Log and Monitor | PROOF layer, monitoring |
| 11. Test Security | Threat model testing |
| 12. Information Security Policies | Policy engine |

### 6.2 PCI-Specific Capabilities

```yaml
pci_capabilities:
  - capability: "data:read/sensitive/pci"
    description: "Access payment card data"
    minimum_tier: "certified"
    additional_requirements:
      - need_to_know: true
      - encryption_at_rest: true
      - masking_default: true

  - capability: "financial:transaction/*"
    minimum_tier: "certified"
    fraud_detection_required: true
    audit_requirements:
      - real_time_logging: true
      - amount_threshold_alerts: true
```

---

## 7. EU AI Act Mapping

### 7.1 Risk Classification Alignment

The EU AI Act classifies AI systems by risk. BASIS supports compliance for all levels:

| EU AI Act Risk | BASIS Mapping |
|----------------|---------------|
| Unacceptable | INTENT layer: detect and block prohibited uses |
| High-Risk | Full governance: trust scoring, capability gating, audit |
| Limited Risk | Transparency: PROOF layer disclosure |
| Minimal Risk | Baseline governance optional |

### 7.2 High-Risk AI System Requirements

| Article | Requirement | BASIS Implementation |
|---------|-------------|---------------------|
| Art. 9 | Risk management | Risk classification, trust scoring |
| Art. 10 | Data governance | Data capabilities, access control |
| Art. 11 | Technical documentation | PROOF layer records |
| Art. 12 | Record-keeping | 7-year retention, hash chain |
| Art. 13 | Transparency | Audit trail, decision explanations |
| Art. 14 | Human oversight | Escalation mechanism, council governance |
| Art. 15 | Accuracy & robustness | Trust decay, failure handling |
| Art. 17 | Quality management | Continuous trust evaluation |

### 7.3 EU AI Act Capabilities

```yaml
eu_ai_act_capabilities:
  - capability: "admin:ai/deploy/high_risk"
    requirements:
      - conformity_assessment: true
      - ce_marking: true
      - registration: true
      - human_oversight: mandatory

  - capability: "execute:ai/inference"
    logging_requirements:
      - input_logging: true
      - output_logging: true
      - timestamp: true
      - version_tracking: true

  - capability: "admin:ai/modify/high_risk"
    requires_escalation: true
    post_modification_requirements:
      - revalidation: true
      - notification: conditional
```

---

## 8. NIST AI RMF Mapping

### 8.1 Core Functions

| Function | BASIS Implementation |
|----------|---------------------|
| GOVERN | Policy engine, council governance |
| MAP | Risk classification, capability taxonomy |
| MEASURE | Trust scoring, behavioral metrics |
| MANAGE | Capability gating, escalation |

### 8.2 Trustworthy AI Characteristics

| Characteristic | BASIS Support |
|----------------|---------------|
| Valid and Reliable | Trust scoring validates reliability |
| Safe | Risk classification, capability gating |
| Secure and Resilient | Threat model, failure handling |
| Accountable and Transparent | PROOF layer, audit trail |
| Explainable | Decision logging with reasons |
| Privacy-Enhanced | Data capability restrictions |
| Fair | Consistent trust scoring algorithm |

---

## 9. Compliance Implementation Guide

### 9.1 Minimum Viable Compliance

| Framework | Minimum BASIS Level | Key Components |
|-----------|---------------------|----------------|
| SOC 2 | BASIS Core | ENFORCE + PROOF |
| ISO 27001 | BASIS Core | Full capability gating |
| GDPR | BASIS Complete | Data capabilities + PROOF |
| HIPAA | BASIS Complete | PHI capabilities + encryption |
| PCI DSS | BASIS Complete | PCI capabilities + monitoring |
| EU AI Act | BASIS Complete | Full governance + human oversight |

### 9.2 Compliance Checklist

**Pre-Deployment:**
- [ ] Define applicable compliance frameworks
- [ ] Map required capabilities to trust tiers
- [ ] Configure retention policies
- [ ] Enable required audit logging
- [ ] Configure escalation targets

**Operational:**
- [ ] Monitor trust score distributions
- [ ] Review escalation patterns
- [ ] Verify proof chain integrity
- [ ] Generate compliance reports
- [ ] Conduct periodic access reviews

**Audit Preparation:**
- [ ] Export proof records for audit period
- [ ] Generate trust score history reports
- [ ] Document policy configurations
- [ ] Prepare capability grant evidence
- [ ] Compile incident response records

### 9.3 Compliance Reporting

BASIS implementations SHOULD provide:

```yaml
compliance_reports:
  - name: "access_control_report"
    description: "Entity access and capability grants"
    frequency: "monthly"
    includes:
      - entity_inventory
      - capability_assignments
      - trust_tier_distribution
      - access_anomalies

  - name: "audit_trail_report"
    description: "Complete governance decisions"
    frequency: "on_demand"
    includes:
      - proof_records
      - escalation_decisions
      - policy_changes
      - trust_score_changes

  - name: "incident_report"
    description: "Security events and responses"
    frequency: "on_demand"
    includes:
      - threat_detections
      - trust_suspensions
      - integrity_violations
      - failure_events
```

---

## 10. Audit Support

### 10.1 Evidence Export

BASIS provides structured evidence export:

```bash
# Export audit evidence for SOC 2
basis-cli export --framework soc2 \
  --start-date 2025-01-01 \
  --end-date 2025-12-31 \
  --output soc2-evidence-2025.json

# Export for GDPR DPIA
basis-cli export --framework gdpr \
  --data-type pii \
  --processing-activities \
  --output gdpr-dpia-evidence.json
```

### 10.2 Auditor Access

Configure read-only auditor access:

```yaml
auditor_entity:
  id: "ent_auditor_2025"
  type: "external_auditor"
  trust_tier: "certified"
  capabilities:
    - "data:read/audit/*"
    - "admin:read/policy"
    - "admin:read/config"
  restrictions:
    - "no_operational_access"
    - "read_only"
  expires: "2025-06-30"
```

---

*Copyright © 2026 Vorion Risk, LLC. This work is licensed under CC BY 4.0.*
