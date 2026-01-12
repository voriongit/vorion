# Compliance & Regulatory Mapping

**Vorion — Framework Alignment Without Hardcoding Law**

**Version:** 1.1 (Expanded)
**Date:** 2026-01-08
**Classification:** Vorion Confidential

---

## 1. Executive Summary

Vorion treats law and regulation as versioned policy bundles rather than embedded logic, enabling adaptation to regulatory changes without code modifications. This document maps Vorion controls to major compliance frameworks and demonstrates how evidence generation proves compliance through artifacts rather than assertions.

---

## 2. Compliance Philosophy

### 2.1 Core Compliance Principles

```mermaid
flowchart TB
    subgraph Philosophy["Compliance Philosophy"]
        P1["Regulation as Data<br/>Not embedded in code"]
        P2["Evidence over Assertion<br/>Prove, don't claim"]
        P3["Continuous Compliance<br/>Not point-in-time"]
        P4["Adaptable Framework<br/>Change without rebuild"]
    end

    subgraph Implementation["Implementation Approach"]
        I1["BASIS policy bundles"]
        I2["PROOF artifact generation"]
        I3["Real-time monitoring"]
        I4["Versioned rule updates"]
    end

    P1 --> I1
    P2 --> I2
    P3 --> I3
    P4 --> I4
```

### 2.2 Compliance Architecture

```mermaid
flowchart TB
    subgraph Regulations["Regulatory Sources"]
        GDPR["GDPR"]
        SOC2["SOC 2"]
        ISO["ISO 27001"]
        NIST["NIST 800-53"]
        EUAI["EU AI Act"]
        CCPA["CCPA/CPRA"]
    end

    subgraph Translation["Translation Layer"]
        INTERPRET["Regulatory Interpretation"]
        MAP["Control Mapping"]
        BUNDLE["Policy Bundle Creation"]
    end

    subgraph BASIS_Layer["BASIS Layer"]
        RULES["Compliance Rules"]
        VERSION["Version Control"]
        DEPLOY["Deployment"]
    end

    subgraph Enforcement["Enforcement Layer"]
        ENFORCE_COMP["ENFORCE Compliance Checks"]
        MONITOR["Compliance Monitoring"]
        ALERT["Violation Alerts"]
    end

    subgraph Evidence["Evidence Layer"]
        PROOF_GEN["PROOF Generation"]
        REPORTS["Compliance Reports"]
        AUDIT["Audit Support"]
    end

    GDPR --> INTERPRET
    SOC2 --> INTERPRET
    ISO --> INTERPRET
    NIST --> INTERPRET
    EUAI --> INTERPRET
    CCPA --> INTERPRET

    INTERPRET --> MAP
    MAP --> BUNDLE
    BUNDLE --> RULES

    RULES --> VERSION
    VERSION --> DEPLOY
    DEPLOY --> ENFORCE_COMP

    ENFORCE_COMP --> MONITOR
    MONITOR --> ALERT
    ENFORCE_COMP --> PROOF_GEN
    PROOF_GEN --> REPORTS
    REPORTS --> AUDIT
```

---

## 3. Framework Coverage

### 3.1 Supported Frameworks

| Framework | Version | Coverage | Status |
|-----------|---------|----------|--------|
| **SOC 2 Type II** | 2017 | Full | Active |
| **ISO 27001** | 2022 | Full | Active |
| **NIST 800-53** | Rev 5 | High baseline | Active |
| **GDPR** | 2016/679 | Full | Active |
| **EU AI Act** | 2024 | High-risk AI | Active |
| **CCPA/CPRA** | 2023 | Full | Active |
| **HIPAA** | Current | Technical safeguards | Planned |
| **PCI DSS** | 4.0 | Applicable controls | Planned |

### 3.2 Framework Relationship Map

```mermaid
flowchart TB
    subgraph Core["Core Frameworks"]
        ISO["ISO 27001<br/>Foundation"]
        NIST["NIST 800-53<br/>Comprehensive"]
    end

    subgraph Industry["Industry Specific"]
        SOC2["SOC 2<br/>Service Orgs"]
        PCI["PCI DSS<br/>Payment"]
        HIPAA["HIPAA<br/>Healthcare"]
    end

    subgraph Regional["Regional Privacy"]
        GDPR["GDPR<br/>EU"]
        CCPA["CCPA<br/>California"]
        LGPD["LGPD<br/>Brazil"]
    end

    subgraph AI["AI Governance"]
        EUAI["EU AI Act"]
        NIST_AI["NIST AI RMF"]
    end

    ISO --> SOC2
    ISO --> PCI
    ISO --> HIPAA
    NIST --> ISO
    NIST --> SOC2

    GDPR --> CCPA
    GDPR --> LGPD

    ISO --> EUAI
    NIST --> NIST_AI
```

---

## 4. SOC 2 Control Mapping

### 4.1 Trust Service Criteria Coverage

```mermaid
flowchart LR
    subgraph TSC["Trust Service Criteria"]
        CC["Common Criteria (CC)"]
        AV["Availability (A)"]
        PI["Processing Integrity (PI)"]
        CO["Confidentiality (C)"]
        PR["Privacy (P)"]
    end

    subgraph Vorion["Vorion Controls"]
        V1["Governance Model"]
        V2["Resilience Architecture"]
        V3["PROOF System"]
        V4["Encryption + Access"]
        V5["Data Governance"]
    end

    CC --> V1
    AV --> V2
    PI --> V3
    CO --> V4
    PR --> V5
```

### 4.2 SOC 2 Control Matrix

| SOC 2 Control | Vorion Implementation | Evidence Source |
|---------------|----------------------|-----------------|
| **CC1.1** - COSO Principles | Governance model, separation of powers | Governance docs, PROOF records |
| **CC2.1** - Information Quality | INTENT validation, data classification | Validation logs, classification tags |
| **CC3.1** - Risk Assessment | Risk-Trust model, threat modeling | Risk assessments, trust scores |
| **CC4.1** - Monitoring Activities | Continuous monitoring, anomaly detection | SIEM logs, alerts |
| **CC5.1** - Control Activities | BASIS rules, ENFORCE gates | Rule definitions, enforcement logs |
| **CC6.1** - Logical Access | RBAC/ABAC, MFA, authentication | Access logs, auth records |
| **CC6.6** - System Boundaries | Network segmentation, zone architecture | Infrastructure configs |
| **CC7.1** - System Changes | Change management, versioned policies | Change records, version history |
| **CC7.2** - Change Detection | Integrity monitoring, drift detection | Monitoring logs, alerts |
| **CC8.1** - Incident Response | IR procedures, PROOF forensics | Incident records, PIRs |
| **CC9.1** - Risk Mitigation | Control mapping, residual risk acceptance | Risk registers, control evidence |
| **A1.1** - Availability Commitments | SLAs, resilience architecture | Uptime reports, failover tests |
| **A1.2** - Availability Recovery | Recovery procedures, replay capability | DR tests, recovery logs |
| **PI1.1** - Processing Integrity | ENFORCE validation, PROOF verification | Validation logs, proof artifacts |
| **C1.1** - Confidentiality | Encryption, access control, DLP | Encryption configs, access logs |
| **P1.1** - Privacy Notice | Privacy policies, consent management | Policy versions, consent records |

---

## 5. ISO 27001 Control Mapping

### 5.1 Annex A Control Coverage

```mermaid
flowchart TB
    subgraph Organizational["Organizational Controls (A.5)"]
        A5["Policies, Roles, Segregation"]
    end

    subgraph People["People Controls (A.6)"]
        A6["Screening, Awareness, Termination"]
    end

    subgraph Physical["Physical Controls (A.7)"]
        A7["Secure Areas, Equipment"]
    end

    subgraph Tech["Technological Controls (A.8)"]
        A8["Access, Crypto, Operations, Development"]
    end

    subgraph Vorion_Controls["Vorion Mapping"]
        V_GOV["Governance Model"]
        V_HR["HR Integration"]
        V_DC["Data Center Security"]
        V_TECH["Technical Controls"]
    end

    A5 --> V_GOV
    A6 --> V_HR
    A7 --> V_DC
    A8 --> V_TECH
```

### 5.2 Key ISO 27001 Controls

| ISO Control | Description | Vorion Implementation |
|-------------|-------------|----------------------|
| **A.5.1** | Policies for information security | BASIS policy framework |
| **A.5.2** | Information security roles | Separation of powers model |
| **A.5.3** | Segregation of duties | Component authority isolation |
| **A.5.15** | Access control | ENFORCE + RBAC/ABAC |
| **A.5.23** | Information security for cloud | Multi-region architecture |
| **A.5.28** | Collection of evidence | PROOF artifact system |
| **A.8.2** | Privileged access rights | Trust-based autonomy |
| **A.8.3** | Information access restriction | Data classification + DLP |
| **A.8.5** | Secure authentication | MFA + token architecture |
| **A.8.9** | Configuration management | Versioned BASIS policies |
| **A.8.15** | Logging | Comprehensive audit logging |
| **A.8.16** | Monitoring activities | SIEM + anomaly detection |
| **A.8.24** | Use of cryptography | Encryption standards |
| **A.8.28** | Secure coding | SAST/DAST/SCA pipeline |

---

## 6. NIST 800-53 Control Mapping

### 6.1 Control Family Coverage

```mermaid
flowchart TB
    subgraph Families["NIST Control Families"]
        AC["AC - Access Control"]
        AU["AU - Audit"]
        CA["CA - Assessment"]
        CM["CM - Configuration"]
        CP["CP - Contingency"]
        IA["IA - Identification"]
        IR["IR - Incident Response"]
        MA["MA - Maintenance"]
        MP["MP - Media Protection"]
        PE["PE - Physical"]
        PL["PL - Planning"]
        PM["PM - Program Mgmt"]
        PS["PS - Personnel"]
        RA["RA - Risk Assessment"]
        SA["SA - Acquisition"]
        SC["SC - System/Comms"]
        SI["SI - System Integrity"]
        SR["SR - Supply Chain"]
    end

    subgraph Coverage["Coverage Level"]
        FULL["Full Coverage"]
        PARTIAL["Partial Coverage"]
        NA["N/A (Physical/HR)"]
    end

    AC --> FULL
    AU --> FULL
    CA --> FULL
    CM --> FULL
    CP --> FULL
    IA --> FULL
    IR --> FULL
    SC --> FULL
    SI --> FULL

    MA --> PARTIAL
    PL --> PARTIAL
    PM --> PARTIAL
    RA --> PARTIAL
    SA --> PARTIAL
    SR --> PARTIAL

    PE --> NA
    PS --> NA
    MP --> NA
```

### 6.2 High-Impact Control Matrix

| NIST Control | Control Name | Vorion Implementation | Evidence |
|--------------|--------------|----------------------|----------|
| **AC-2** | Account Management | Identity management + lifecycle | Account logs |
| **AC-3** | Access Enforcement | ENFORCE gate + BASIS rules | Enforcement logs |
| **AC-6** | Least Privilege | Trust-based autonomy levels | Trust scores |
| **AU-2** | Audit Events | Comprehensive event logging | PROOF artifacts |
| **AU-6** | Audit Review | SIEM analysis + alerting | Analysis reports |
| **AU-9** | Protection of Audit Info | Immutable PROOF storage | Integrity proofs |
| **AU-10** | Non-repudiation | Cryptographic signing | Signatures |
| **CA-7** | Continuous Monitoring | Real-time monitoring | Dashboards |
| **CM-2** | Baseline Configuration | Versioned BASIS policies | Version history |
| **CM-3** | Configuration Change Control | Change management | Change records |
| **CP-9** | System Backup | Multi-region replication | Backup logs |
| **CP-10** | System Recovery | Deterministic replay | Recovery tests |
| **IA-2** | Identification and Auth | MFA + token architecture | Auth logs |
| **IA-5** | Authenticator Management | Key rotation + lifecycle | Key logs |
| **IR-4** | Incident Handling | IR procedures | Incident records |
| **IR-5** | Incident Monitoring | SIEM + anomaly detection | Alerts |
| **SC-8** | Transmission Confidentiality | TLS 1.3 everywhere | TLS configs |
| **SC-13** | Cryptographic Protection | Encryption standards | Crypto inventory |
| **SC-28** | Protection at Rest | AES-256-GCM | Encryption configs |
| **SI-4** | System Monitoring | Continuous monitoring | Monitoring data |
| **SI-7** | Software Integrity | Code signing + verification | Integrity logs |

---

## 7. GDPR Compliance Mapping

### 7.1 GDPR Article Implementation

```mermaid
flowchart TB
    subgraph Principles["GDPR Principles (Art. 5)"]
        P1["Lawfulness, Fairness, Transparency"]
        P2["Purpose Limitation"]
        P3["Data Minimization"]
        P4["Accuracy"]
        P5["Storage Limitation"]
        P6["Integrity & Confidentiality"]
        P7["Accountability"]
    end

    subgraph Implementation["Vorion Implementation"]
        I1["Legal basis tracking, consent management"]
        I2["Purpose binding in BASIS"]
        I3["Collection validation"]
        I4["Update workflows"]
        I5["Retention automation"]
        I6["Encryption + access control"]
        I7["PROOF evidence"]
    end

    P1 --> I1
    P2 --> I2
    P3 --> I3
    P4 --> I4
    P5 --> I5
    P6 --> I6
    P7 --> I7
```

### 7.2 Data Subject Rights Implementation

| GDPR Right | Article | Implementation | Response SLA |
|------------|---------|----------------|--------------|
| **Right to Access** | Art. 15 | Automated data export | 30 days |
| **Right to Rectification** | Art. 16 | Self-service + workflow | 30 days |
| **Right to Erasure** | Art. 17 | Automated purge workflow | 30 days |
| **Right to Restriction** | Art. 18 | Processing flags | Immediate |
| **Right to Portability** | Art. 20 | Machine-readable export | 30 days |
| **Right to Object** | Art. 21 | Opt-out processing | Immediate |
| **Automated Decision Rights** | Art. 22 | Human review escalation | Per request |

### 7.3 GDPR Compliance Flow

```mermaid
sequenceDiagram
    autonumber
    participant DS as Data Subject
    participant PORTAL as Privacy Portal
    participant WORKFLOW as DSR Workflow
    participant DATA as Data Services
    participant PROOF as PROOF
    participant DPO as DPO

    DS->>PORTAL: Submit Rights Request
    PORTAL->>PORTAL: Verify Identity
    PORTAL->>WORKFLOW: Create DSR Ticket

    WORKFLOW->>WORKFLOW: Classify Request Type

    alt Access/Portability Request
        WORKFLOW->>DATA: Extract Data
        DATA-->>WORKFLOW: Data Package
        WORKFLOW->>PROOF: Record Fulfillment
        WORKFLOW->>DS: Deliver Data
    else Erasure Request
        WORKFLOW->>DATA: Identify Data Locations
        DATA->>DATA: Execute Deletion
        DATA->>PROOF: Record Deletion Certificate
        WORKFLOW->>DS: Confirm Erasure
    else Complex Request
        WORKFLOW->>DPO: Escalate for Review
        DPO->>WORKFLOW: Decision
        WORKFLOW->>DS: Response
    end

    PROOF->>PROOF: Generate Compliance Evidence
```

---

## 8. EU AI Act Compliance

### 8.1 AI System Classification

```mermaid
flowchart TB
    subgraph Classification["AI Risk Classification"]
        UNACCEPTABLE["UNACCEPTABLE RISK<br/>Prohibited"]
        HIGH["HIGH RISK<br/>Heavy obligations"]
        LIMITED["LIMITED RISK<br/>Transparency"]
        MINIMAL["MINIMAL RISK<br/>Voluntary"]
    end

    subgraph Vorion_Class["Vorion Classification"]
        V_CLASS["HIGH RISK<br/>(Decision support system)"]
    end

    subgraph Requirements["High-Risk Requirements"]
        R1["Risk Management System"]
        R2["Data Governance"]
        R3["Technical Documentation"]
        R4["Record Keeping"]
        R5["Transparency"]
        R6["Human Oversight"]
        R7["Accuracy & Robustness"]
    end

    HIGH --> V_CLASS
    V_CLASS --> R1
    V_CLASS --> R2
    V_CLASS --> R3
    V_CLASS --> R4
    V_CLASS --> R5
    V_CLASS --> R6
    V_CLASS --> R7
```

### 8.2 EU AI Act Control Matrix

| Requirement | Article | Vorion Implementation | Evidence |
|-------------|---------|----------------------|----------|
| **Risk Management** | Art. 9 | Risk-Trust model, threat modeling | Risk assessments |
| **Data Governance** | Art. 10 | Data classification, quality controls | Data governance docs |
| **Documentation** | Art. 11 | Architecture docs, this specification | Documentation set |
| **Record Keeping** | Art. 12 | PROOF artifact system | Audit trail |
| **Transparency** | Art. 13 | Clear documentation, explanations | User documentation |
| **Human Oversight** | Art. 14 | Human override mechanisms | Override logs |
| **Accuracy** | Art. 15 | Validation, testing, monitoring | Test results |
| **Robustness** | Art. 15 | Resilience architecture | Resilience tests |
| **Cybersecurity** | Art. 15 | Security architecture | Security assessments |

---

## 9. Evidence Generation

### 9.1 Evidence Architecture

```mermaid
flowchart TB
    subgraph Sources["Evidence Sources"]
        ENFORCE_EV["ENFORCE Decisions"]
        COGNIGATE_EV["Execution Records"]
        CONFIG_EV["Configuration State"]
        CHANGE_EV["Change Records"]
        ACCESS_EV["Access Logs"]
    end

    subgraph Processing["Evidence Processing"]
        COLLECT["Collection"]
        NORMALIZE["Normalization"]
        CORRELATE["Correlation"]
        SIGN["Cryptographic Signing"]
    end

    subgraph Storage["Evidence Storage"]
        PROOF_STORE["PROOF Immutable Store"]
        INDEX["Search Index"]
        ARCHIVE["Long-term Archive"]
    end

    subgraph Output["Evidence Output"]
        REPORTS["Compliance Reports"]
        AUDITOR["Auditor Access"]
        REGULATOR["Regulator Requests"]
    end

    ENFORCE_EV --> COLLECT
    COGNIGATE_EV --> COLLECT
    CONFIG_EV --> COLLECT
    CHANGE_EV --> COLLECT
    ACCESS_EV --> COLLECT

    COLLECT --> NORMALIZE
    NORMALIZE --> CORRELATE
    CORRELATE --> SIGN

    SIGN --> PROOF_STORE
    PROOF_STORE --> INDEX
    PROOF_STORE --> ARCHIVE

    INDEX --> REPORTS
    PROOF_STORE --> AUDITOR
    ARCHIVE --> REGULATOR
```

### 9.2 Evidence Types

| Evidence Type | Description | Retention | Format |
|---------------|-------------|-----------|--------|
| **Decision Records** | Every ENFORCE permit/deny | 7 years | PROOF artifact |
| **Execution Records** | Cognigate operation details | 7 years | PROOF artifact |
| **Access Logs** | All authentication/authorization | 2 years | Structured log |
| **Change Records** | Policy and config changes | Permanent | PROOF artifact |
| **Consent Records** | User consent actions | Duration + 5 years | PROOF artifact |
| **DSR Records** | Data subject request handling | 5 years | PROOF artifact |
| **Incident Records** | Security incident details | 7 years | PROOF artifact |
| **Test Results** | Security and compliance tests | 3 years | Test report |

### 9.3 Evidence Generation Flow

```mermaid
sequenceDiagram
    autonumber
    participant ACTION as System Action
    participant COLLECTOR as Evidence Collector
    participant PROCESSOR as Evidence Processor
    participant PROOF as PROOF Service
    participant STORE as Immutable Store

    ACTION->>COLLECTOR: Action Occurred
    COLLECTOR->>COLLECTOR: Capture Context
    COLLECTOR->>COLLECTOR: Extract Metadata

    COLLECTOR->>PROCESSOR: Raw Evidence
    PROCESSOR->>PROCESSOR: Normalize Format
    PROCESSOR->>PROCESSOR: Add Timestamps
    PROCESSOR->>PROCESSOR: Link to Chain

    PROCESSOR->>PROOF: Evidence Package
    PROOF->>PROOF: Validate Completeness
    PROOF->>PROOF: Compute Hash
    PROOF->>PROOF: Sign with HSM

    PROOF->>STORE: Signed Artifact
    STORE->>STORE: Write (Append-only)
    STORE->>STORE: Replicate

    STORE-->>PROOF: Storage Confirmation
    PROOF-->>ACTION: Evidence Reference
```

---

## 10. Compliance Reporting

### 10.1 Report Types

```yaml
compliance_reports:
  continuous:
    - name: "Compliance Dashboard"
      frequency: real_time
      audience: internal
      content: [control_status, violations, metrics]

    - name: "Control Effectiveness"
      frequency: daily
      audience: security_team
      content: [control_performance, gaps, trends]

  periodic:
    - name: "SOC 2 Evidence Package"
      frequency: quarterly
      audience: auditors
      content: [control_evidence, test_results, exceptions]

    - name: "ISO 27001 ISMS Report"
      frequency: quarterly
      audience: management
      content: [isms_status, risk_treatment, improvements]

    - name: "GDPR Compliance Report"
      frequency: monthly
      audience: dpo
      content: [dsr_stats, breach_records, consent_status]

  on_demand:
    - name: "Auditor Evidence Request"
      trigger: auditor_request
      content: [specific_evidence, supporting_docs]

    - name: "Regulator Response"
      trigger: regulatory_inquiry
      content: [requested_information, proof_artifacts]
```

### 10.2 Compliance Metrics Dashboard

```mermaid
flowchart TB
    subgraph Metrics["Key Compliance Metrics"]
        M1["Control Coverage: 98%"]
        M2["Evidence Completeness: 100%"]
        M3["Policy Violations: 2 (minor)"]
        M4["DSR Response Time: 12 days avg"]
        M5["Audit Findings: 0 critical"]
    end

    subgraph Trends["Trend Indicators"]
        T1["Coverage: ↑ 2%"]
        T2["Completeness: → Stable"]
        T3["Violations: ↓ 50%"]
        T4["DSR Time: ↓ 3 days"]
        T5["Findings: → Stable"]
    end

    subgraph Actions["Required Actions"]
        A1["2 controls pending implementation"]
        A2["Quarterly pen test due"]
        A3["Policy review scheduled"]
    end
```

---

## 11. Regulatory Change Management

### 11.1 Change Management Process

```mermaid
stateDiagram-v2
    [*] --> MONITORING: Continuous Watch

    MONITORING --> IDENTIFIED: New Regulation/Change
    IDENTIFIED --> ASSESSMENT: Impact Assessment

    ASSESSMENT --> LOW_IMPACT: Minimal Change
    ASSESSMENT --> HIGH_IMPACT: Significant Change

    LOW_IMPACT --> POLICY_UPDATE: Update BASIS Policies
    HIGH_IMPACT --> DESIGN: Design Changes

    DESIGN --> IMPLEMENTATION: Build Controls
    IMPLEMENTATION --> TESTING: Validate

    POLICY_UPDATE --> TESTING: Validate
    TESTING --> DEPLOYMENT: Deploy Changes

    DEPLOYMENT --> MONITORING: Resume Monitoring

    MONITORING --> [*]: Ongoing
```

### 11.2 Regulatory Watch List

| Regulation | Status | Expected Impact | Target Date |
|------------|--------|-----------------|-------------|
| **EU AI Act** | Enacted | High | Aug 2025 |
| **DORA (EU)** | Enacted | Medium | Jan 2025 |
| **NIS2 (EU)** | Enacted | Medium | Oct 2024 |
| **US Privacy Laws** | Various | Medium | Ongoing |
| **UK GDPR Changes** | Proposed | Low | TBD |

---

## 12. Appendix

### 12.1 Compliance Glossary

| Term | Definition |
|------|------------|
| **Control** | Safeguard or countermeasure to manage risk |
| **Evidence** | Proof that a control is operating effectively |
| **Framework** | Structured set of compliance requirements |
| **Policy Bundle** | VERSION controlled set of compliance rules |
| **DSR** | Data Subject Request |
| **DPO** | Data Protection Officer |

### 12.2 Related Documents

- 01_System_Governance_and_Authority_Model.pdf
- 04_Audit_Evidence_and_Forensics.pdf
- 05_Data_Governance_and_Privacy.pdf

---

*Vorion Confidential — 2026-01-08 — Expanded Compliance Mapping Specification*
