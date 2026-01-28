# Trust Scoring Deep Dive
## For: Engineers, Product Managers, Data Scientists

### Trust Score Architecture

```mermaid
flowchart TB
    subgraph "Input Signals"
        S1[Behavioral Events]
        S2[Compliance Checks]
        S3[Identity Verification]
        S4[Context Factors]
    end

    subgraph "Processing Pipeline"
        P1[Signal Ingestion]
        P2[Normalization]
        P3[Weighting]
        P4[Decay Application]
        P5[Aggregation]
    end

    subgraph "Output"
        O1[Trust Score<br/>0-1000]
        O2[Trust Tier<br/>T0-T5]
        O3[Component Breakdown]
        O4[Trend Analysis]
    end

    S1 --> P1
    S2 --> P1
    S3 --> P1
    S4 --> P1

    P1 --> P2 --> P3 --> P4 --> P5

    P5 --> O1
    P5 --> O2
    P5 --> O3
    P5 --> O4
```

### Component Weights

```mermaid
pie showData
    title "Trust Score Component Weights"
    "Behavioral (40%)" : 40
    "Compliance (25%)" : 25
    "Identity (20%)" : 20
    "Context (15%)" : 15
```

### Behavioral Score Calculation

```mermaid
flowchart TB
    subgraph "Behavioral Signals"
        B1[Task completions]
        B2[Task failures]
        B3[Response quality]
        B4[Resource usage]
        B5[Error rates]
    end

    subgraph "Signal Processing"
        SP1["Success weight: +1.0"]
        SP2["Failure weight: -3.0 (3x amplification)"]
        SP3["Quality score: 0.0 to 1.0"]
        SP4["Efficiency bonus: 0 to 0.1"]
    end

    subgraph "Time Weighting"
        TW1["Recent events weighted higher"]
        TW2["Exponential decay: 0.95^days"]
    end

    subgraph "Normalization"
        N1["Min samples: 10"]
        N2["Scale to 0-1"]
        N3["Clip outliers"]
    end

    B1 --> SP1 --> TW1
    B2 --> SP2 --> TW1
    B3 --> SP3 --> TW2
    B4 --> SP4 --> TW2
    B5 --> SP2

    TW1 --> N1
    TW2 --> N1
    N1 --> N2 --> N3

    N3 --> BS[Behavioral Score<br/>0.0 to 1.0]
```

### Compliance Score Calculation

```mermaid
flowchart TB
    subgraph "Compliance Signals"
        C1[Policy adherence rate]
        C2[Audit performance]
        C3[Violation count]
        C4[Remediation speed]
        C5[Documentation completeness]
    end

    subgraph "Scoring Rules"
        R1["100% adherence = 1.0"]
        R2["Each violation: -0.1"]
        R3["Fast remediation: +0.05"]
        R4["Audit pass: +0.1"]
    end

    subgraph "Severity Multipliers"
        M1["Low violation: 1x"]
        M2["Medium violation: 2x"]
        M3["High violation: 5x"]
        M4["Critical violation: 10x"]
    end

    C1 --> R1
    C2 --> R4
    C3 --> R2
    C3 --> M1
    C3 --> M2
    C3 --> M3
    C3 --> M4
    C4 --> R3
    C5 --> R1

    R1 --> CS[Compliance Score<br/>0.0 to 1.0]
    R2 --> CS
    R3 --> CS
    R4 --> CS
```

### Identity Score Calculation

```mermaid
flowchart TB
    subgraph "Identity Factors"
        I1[Verification level]
        I2[Credential strength]
        I3[Publisher reputation]
        I4[Manifest validity]
        I5[Certificate chain]
    end

    subgraph "Verification Levels"
        V1["Unverified: 0.2"]
        V2["Email verified: 0.4"]
        V3["Domain verified: 0.6"]
        V4["Organization verified: 0.8"]
        V5["Enterprise verified: 1.0"]
    end

    subgraph "Certificate Bonus"
        CB1["Registered: +0.0"]
        CB2["Verified: +0.1"]
        CB3["Certified: +0.2"]
        CB4["Certified+: +0.3"]
    end

    I1 --> V1
    I1 --> V2
    I1 --> V3
    I1 --> V4
    I1 --> V5

    I2 --> CB1
    I2 --> CB2
    I2 --> CB3
    I2 --> CB4

    V1 --> IS[Identity Score<br/>0.0 to 1.0]
    V2 --> IS
    V3 --> IS
    V4 --> IS
    V5 --> IS
    CB1 --> IS
    CB2 --> IS
    CB3 --> IS
    CB4 --> IS
```

### Context Score Calculation

```mermaid
flowchart TB
    subgraph "Context Factors"
        X1[Deployment environment]
        X2[Network isolation]
        X3[Data sensitivity]
        X4[Access scope]
        X5[Integration security]
    end

    subgraph "Environment Scores"
        E1["Sandbox: 1.0 (safest)"]
        E2["Development: 0.8"]
        E3["Staging: 0.6"]
        E4["Production: 0.4"]
        E5["Public: 0.2"]
    end

    subgraph "Isolation Bonus"
        IB1["VPC isolated: +0.2"]
        IB2["mTLS enabled: +0.1"]
        IB3["Secrets managed: +0.1"]
    end

    X1 --> E1
    X1 --> E2
    X1 --> E3
    X1 --> E4
    X1 --> E5

    X2 --> IB1
    X3 --> IB2
    X5 --> IB3

    E1 --> XS[Context Score<br/>0.0 to 1.0]
    IB1 --> XS
    IB2 --> XS
    IB3 --> XS
```

### Trust Decay Model

```mermaid
xychart-beta
    title "182-Day Trust Decay Curve"
    x-axis "Days Since Last Activity" [0, 7, 14, 28, 56, 112, 182, 365]
    y-axis "Trust Retention %" 0 --> 100
    line [100, 95, 88, 75, 62, 55, 50, 25]
```

### Decay Milestone Table

```mermaid
flowchart LR
    subgraph "Decay Milestones"
        D0["Day 0-6: 100%<br/>(Grace period)"]
        D7["Day 7: 95%"]
        D14["Day 14: 88%"]
        D28["Day 28: 75%"]
        D56["Day 56: 62%"]
        D112["Day 112: 55%"]
        D182["Day 182: 50%<br/>(Half-life)"]
    end

    D0 --> D7 --> D14 --> D28 --> D56 --> D112 --> D182
```

### Decay Interpolation

```mermaid
flowchart TB
    subgraph "Interpolation Formula"
        F1["For days between milestones:"]
        F2["progress = (day - prev_milestone) / (next_milestone - prev_milestone)"]
        F3["retention = prev_retention - (progress × (prev_retention - next_retention))"]
    end

    subgraph "Example: Day 21"
        E1["Between Day 14 (88%) and Day 28 (75%)"]
        E2["progress = (21-14) / (28-14) = 0.5"]
        E3["retention = 88 - (0.5 × (88-75)) = 81.5%"]
    end
```

### Score Update Flow

```mermaid
sequenceDiagram
    participant Event as Event Source
    participant TE as Trust Engine
    participant DB as Database
    participant Cache as Cache

    Event->>TE: New trust signal

    TE->>DB: Get current record
    DB-->>TE: Trust record

    TE->>TE: Validate signal
    TE->>TE: Apply signal to component

    alt Behavioral signal
        TE->>TE: Update behavioral score
    else Compliance signal
        TE->>TE: Update compliance score
    else Identity signal
        TE->>TE: Update identity score
    end

    TE->>TE: Recalculate composite score
    TE->>TE: Determine tier

    TE->>DB: Update record
    TE->>Cache: Invalidate cache

    alt Score crosses tier boundary
        TE->>Event: Emit tier_changed event
    end

    TE->>TE: Reset decay clock
```

### Tier Thresholds

```mermaid
flowchart TB
    subgraph "Trust Tiers"
        T0["T0: SANDBOX<br/>Score: 0-99<br/>Capabilities: Testing only"]
        T1["T1: PROVISIONAL<br/>Score: 100-299<br/>Capabilities: Read public"]
        T2["T2: STANDARD<br/>Score: 300-499<br/>Capabilities: Limited external"]
        T3["T3: TRUSTED<br/>Score: 500-699<br/>Capabilities: External APIs"]
        T4["T4: CERTIFIED<br/>Score: 700-899<br/>Capabilities: Financial"]
        T5["T5: AUTONOMOUS<br/>Score: 900-1000<br/>Capabilities: Full autonomy"]
    end

    T0 --> T1 --> T2 --> T3 --> T4 --> T5

    style T0 fill:#ffcdd2
    style T1 fill:#ffe0b2
    style T2 fill:#fff9c4
    style T3 fill:#c8e6c9
    style T4 fill:#b2dfdb
    style T5 fill:#bbdefb
```

### Score History & Trends

```mermaid
flowchart TB
    subgraph "Historical Data"
        H1[Score snapshots<br/>Every 24h]
        H2[Event log<br/>All signals]
        H3[Tier changes<br/>Timestamped]
    end

    subgraph "Trend Analysis"
        T1[7-day trend]
        T2[30-day trend]
        T3[90-day trend]
        T4[Velocity<br/>points/day]
    end

    subgraph "Predictions"
        P1[Estimated tier change]
        P2[Decay projection]
        P3[Risk indicators]
    end

    H1 --> T1
    H1 --> T2
    H1 --> T3
    H2 --> T4

    T1 --> P1
    T2 --> P2
    T4 --> P3
```

### Anti-Gaming Measures

```mermaid
flowchart TB
    subgraph "Gaming Attempts"
        G1[Spam positive events]
        G2[Fake verification]
        G3[Clock manipulation]
        G4[Score transfer]
    end

    subgraph "Countermeasures"
        C1[Rate limiting<br/>Max events/hour]
        C2[Signal verification<br/>Check source]
        C3[Server-side timestamps]
        C4[Agent ID binding<br/>Non-transferable]
    end

    subgraph "Detection"
        D1[Anomaly detection]
        D2[Pattern analysis]
        D3[Source validation]
    end

    G1 --> C1
    G2 --> C2
    G3 --> C3
    G4 --> C4

    C1 --> D1
    C2 --> D2
    C3 --> D3
```

### Score API

```mermaid
sequenceDiagram
    participant Client
    participant AA as AgentAnchor

    Note over Client,AA: GET /trust/:agent_id

    Client->>AA: GET /trust/agent_abc123
    AA-->>Client: 200 OK

    Note right of Client: {
    Note right of Client:   "agent_id": "agent_abc123",
    Note right of Client:   "score": 742,
    Note right of Client:   "tier": "T4",
    Note right of Client:   "tier_name": "Certified",
    Note right of Client:   "components": {
    Note right of Client:     "behavioral": 0.78,
    Note right of Client:     "compliance": 0.82,
    Note right of Client:     "identity": 0.90,
    Note right of Client:     "context": 0.65
    Note right of Client:   },
    Note right of Client:   "history": {
    Note right of Client:     "7d_delta": +12,
    Note right of Client:     "30d_delta": +45
    Note right of Client:   },
    Note right of Client:   "last_activity": "2026-01-28T10:42:00Z",
    Note right of Client:   "decay_status": "active",
    Note right of Client:   "signature": "..."
    Note right of Client: }
```
