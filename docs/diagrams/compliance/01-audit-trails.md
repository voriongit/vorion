# Audit Trails & Compliance
## For: Compliance Officers, Auditors, Legal Teams

### Immutable Audit Trail Architecture

```mermaid
flowchart TB
    subgraph "Event Generation"
        E1[Agent Action] --> E2[Intent Declaration]
        E2 --> E3[Execution]
        E3 --> E4[Result]
    end

    subgraph "Proof Layer (Kaizen L4)"
        P1[Generate Receipt]
        P2[SHA-256 Hash]
        P3[Chain to Previous]
        P4[Timestamp]
        P5[Sign Attestation]
    end

    subgraph "Storage"
        S1[(PostgreSQL<br/>Event Store)]
        S2[(Object Storage<br/>Proof Artifacts)]
        S3["Merkle Tree<br/>Aggregation"]
    end

    subgraph "Verification"
        V1[Hash Verification]
        V2[Chain Integrity]
        V3[Signature Validation]
    end

    E4 --> P1 --> P2 --> P3 --> P4 --> P5
    P5 --> S1
    P5 --> S2
    S1 --> S3

    S1 --> V1
    S2 --> V2
    S3 --> V3

    style P2 fill:#e1f5fe
    style P3 fill:#e1f5fe
    style P5 fill:#e1f5fe
    style S3 fill:#fff3e0
```

### Event Chain Structure

```mermaid
flowchart LR
    subgraph "Event N-2"
        EN2_DATA["Event Data"]
        EN2_HASH["Hash: abc123..."]
    end

    subgraph "Event N-1"
        EN1_DATA["Event Data"]
        EN1_PREV["Prev: abc123..."]
        EN1_HASH["Hash: def456..."]
    end

    subgraph "Event N"
        EN_DATA["Event Data"]
        EN_PREV["Prev: def456..."]
        EN_HASH["Hash: ghi789..."]
    end

    subgraph "Event N+1"
        EN1_DATA2["Event Data"]
        EN1_PREV2["Prev: ghi789..."]
        EN1_HASH2["Hash: jkl012..."]
    end

    EN2_HASH --> EN1_PREV
    EN1_HASH --> EN_PREV
    EN_HASH --> EN1_PREV2

    style EN2_HASH fill:#c8e6c9
    style EN1_HASH fill:#c8e6c9
    style EN_HASH fill:#c8e6c9
    style EN1_HASH2 fill:#c8e6c9
```

### What Gets Logged

```mermaid
mindmap
  root((Audit<br/>Events))
    Intent Events
      intent.declared
      intent.hash
      intent.timestamp
      intent.agent_id
      intent.action_type
    Execution Events
      execution.started
      execution.completed
      execution.failed
      execution.duration
      execution.resources
    Policy Events
      policy.evaluated
      policy.decision
      policy.rules_matched
      policy.escalated
    Trust Events
      trust.calculated
      trust.changed
      trust.decay_applied
      trust.signal_received
    Access Events
      access.requested
      access.granted
      access.denied
      access.elevated
    Security Events
      security.violation
      security.anomaly
      security.incident
      security.remediation
```

### Compliance Framework Mapping

```mermaid
flowchart TB
    subgraph "Vorion Capabilities"
        V1[Immutable Audit Trail]
        V2[Access Controls]
        V3[Trust Scoring]
        V4[Policy Enforcement]
        V5[Cryptographic Proofs]
        V6[Data Classification]
    end

    subgraph "SOC 2 Trust Principles"
        S1[Security]
        S2[Availability]
        S3[Processing Integrity]
        S4[Confidentiality]
        S5[Privacy]
    end

    subgraph "GDPR Articles"
        G1[Art. 5: Data Principles]
        G2[Art. 25: Privacy by Design]
        G3[Art. 30: Records of Processing]
        G4[Art. 32: Security]
        G5[Art. 35: Impact Assessment]
    end

    V1 --> S3
    V1 --> G3
    V2 --> S1
    V2 --> S4
    V2 --> G4
    V3 --> S3
    V4 --> S1
    V4 --> G2
    V5 --> S3
    V5 --> G3
    V6 --> S4
    V6 --> G1
```

### Regulatory Coverage Matrix

| Requirement | SOC 2 | GDPR | ISO 27001 | HIPAA | EU AI Act | Vorion Feature |
|-------------|-------|------|-----------|-------|-----------|----------------|
| Access Control | CC6.1 | Art. 32 | A.9 | 164.312(a) | Art. 9 | Trust Gates |
| Audit Logging | CC7.2 | Art. 30 | A.12.4 | 164.312(b) | Art. 12 | Proof Layer |
| Data Integrity | CC7.1 | Art. 5 | A.12.2 | 164.312(c) | Art. 10 | Hash Chains |
| Incident Response | CC7.4 | Art. 33 | A.16 | 164.308(a) | Art. 62 | Alert System |
| Risk Assessment | CC3.2 | Art. 35 | A.8.2 | 164.308(a) | Art. 9 | Trust Scoring |
| Human Oversight | - | Art. 22 | - | - | Art. 14 | Escalation |
| Documentation | CC2.1 | Art. 30 | A.5.1 | 164.316 | Art. 11 | BASIS Spec |

### GDPR Data Subject Rights

```mermaid
flowchart TB
    subgraph "Right to Access (Art. 15)"
        A1[Request] --> A2[Identify Data]
        A2 --> A3[Generate Report]
        A3 --> A4[Deliver within 30 days]
    end

    subgraph "Right to Erasure (Art. 17)"
        E1[Request] --> E2[Verify Eligibility]
        E2 --> E3[Mark for Deletion]
        E3 --> E4[Cascade to Systems]
        E4 --> E5[Confirm Erasure]
    end

    subgraph "Right to Portability (Art. 20)"
        P1[Request] --> P2[Extract Data]
        P2 --> P3[Format as JSON/CSV]
        P3 --> P4[Secure Transfer]
    end

    subgraph "Vorion Support"
        V1[GDPR Export API]
        V2[Consent Service]
        V3[Data Redaction]
        V4[Audit Trail]
    end

    A3 --> V1
    E3 --> V3
    P2 --> V1
    A4 --> V4
    E5 --> V4
    P4 --> V4
```

### EU AI Act Compliance

```mermaid
flowchart TB
    subgraph "EU AI Act Requirements"
        R1["Risk Classification<br/>(Art. 6)"]
        R2["Transparency<br/>(Art. 13)"]
        R3["Human Oversight<br/>(Art. 14)"]
        R4["Accuracy & Robustness<br/>(Art. 15)"]
        R5["Documentation<br/>(Art. 11)"]
        R6["Record Keeping<br/>(Art. 12)"]
    end

    subgraph "Vorion Implementation"
        I1["Trust Tiers map to<br/>risk categories"]
        I2["Intent declaration<br/>before execution"]
        I3["Escalation system<br/>for high-risk actions"]
        I4["Trust scoring based<br/>on behavioral metrics"]
        I5["BASIS manifest<br/>standard format"]
        I6["Proof layer with<br/>7-year retention"]
    end

    R1 --> I1
    R2 --> I2
    R3 --> I3
    R4 --> I4
    R5 --> I5
    R6 --> I6

    style I1 fill:#c8e6c9
    style I2 fill:#c8e6c9
    style I3 fill:#c8e6c9
    style I4 fill:#c8e6c9
    style I5 fill:#c8e6c9
    style I6 fill:#c8e6c9
```

### Audit Report Generation

```mermaid
sequenceDiagram
    participant Auditor
    participant Aurais as Aurais Exec
    participant AA as AgentAnchor
    participant Store as Event Store

    Auditor->>Aurais: Request Audit Report
    Note right of Auditor: Time range, agent IDs,<br/>event types

    Aurais->>AA: Fetch Trust History
    AA-->>Aurais: Trust snapshots

    Aurais->>Store: Query Events
    Store-->>Aurais: Event records

    Aurais->>Aurais: Verify Chain Integrity
    Aurais->>Aurais: Validate Signatures
    Aurais->>Aurais: Generate Report

    Aurais-->>Auditor: Audit Report PDF
    Note right of Auditor: Includes:<br/>- Event timeline<br/>- Trust changes<br/>- Policy decisions<br/>- Integrity verification<br/>- Chain of custody
```

### Chain of Custody

```mermaid
flowchart TB
    subgraph "Data Lifecycle"
        C1["Creation<br/>Intent declared<br/>Hash generated"]
        C2["Storage<br/>Immutable write<br/>Replicated"]
        C3["Access<br/>Auth required<br/>Logged"]
        C4["Retention<br/>7-year minimum<br/>Encrypted at rest"]
        C5["Disposal<br/>Secure deletion<br/>Audit trail kept"]
    end

    C1 --> C2 --> C3 --> C4 --> C5

    subgraph "Verification Points"
        V1["Hash verification<br/>at each stage"]
        V2["Signature validation<br/>for authenticity"]
        V3["Timestamp proof<br/>for timing"]
    end

    C1 --> V1
    C2 --> V2
    C3 --> V3
```

### Incident Investigation Flow

```mermaid
flowchart TB
    subgraph "Incident Detected"
        I1[Alert Triggered]
        I2[Incident ID Created]
    end

    subgraph "Evidence Collection"
        E1[Query Events by Agent]
        E2[Query Events by Time]
        E3[Query Events by Type]
        E4[Verify Chain Integrity]
    end

    subgraph "Analysis"
        A1[Timeline Reconstruction]
        A2[Trust Score History]
        A3[Policy Decisions]
        A4[Root Cause]
    end

    subgraph "Documentation"
        D1[Generate Report]
        D2[Export Evidence]
        D3[Archive for Retention]
    end

    I1 --> I2 --> E1
    I2 --> E2
    I2 --> E3

    E1 --> E4
    E2 --> E4
    E3 --> E4

    E4 --> A1
    A1 --> A2
    A2 --> A3
    A3 --> A4

    A4 --> D1
    D1 --> D2
    D2 --> D3
```

### Compliance Dashboard Metrics

```mermaid
block-beta
    columns 4

    block:header:4
        title["COMPLIANCE DASHBOARD"]
    end

    block:metric1
        m1_title["Audit Trail Integrity"]
        m1_value["100%"]
        m1_status["All chains verified"]
    end

    block:metric2
        m2_title["Policy Violations"]
        m2_value["3"]
        m2_status["Last 30 days"]
    end

    block:metric3
        m3_title["Trust Events"]
        m3_value["1.2M"]
        m3_status["This month"]
    end

    block:metric4
        m4_title["Retention Compliance"]
        m4_value["100%"]
        m4_status["7-year requirement"]
    end

    block:chart:4
        chart_title["Policy Decision Distribution"]
    end
```
