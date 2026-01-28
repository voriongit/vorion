# Data Flow Diagrams
## For: Engineers, Architects, Technical Leads

### Agent Request Flow (Happy Path)

```mermaid
sequenceDiagram
    participant Client as Aurais Client
    participant GW as API Gateway
    participant CG as Cognigate
    participant KZ as Kaizen
    participant AA as AgentAnchor
    participant AI as AI Provider
    participant DB as Database

    Client->>GW: Execute Agent Request
    GW->>GW: Authenticate JWT
    GW->>CG: Forward Request

    Note over CG: Check cached trust score
    CG->>CG: Trust Gate Check

    alt Trust Below Threshold
        CG-->>Client: 403 Insufficient Trust
    end

    CG->>KZ: Submit to Kaizen

    Note over KZ: Layer 1: BASIS
    KZ->>KZ: Validate Manifest
    KZ->>KZ: Check Capabilities

    Note over KZ: Layer 2: INTENT
    KZ->>DB: Log Intent Declaration
    KZ->>KZ: Generate Intent Hash

    Note over KZ: Layer 3: ENFORCE
    KZ->>AA: Get Current Trust Score
    AA-->>KZ: Score: 742 (Tier 4)
    KZ->>KZ: Evaluate Policies
    KZ->>KZ: Check Boundaries

    alt Policy Violation
        KZ-->>Client: 403 Policy Denied
    end

    Note over KZ: Execute Agent
    KZ->>AI: Forward to AI Provider
    AI-->>KZ: AI Response
    KZ->>KZ: Monitor Response

    Note over KZ: Layer 4: PROOF
    KZ->>KZ: Generate Execution Receipt
    KZ->>KZ: Compute Merkle Root
    KZ->>KZ: Sign Attestation
    KZ->>AA: Submit Event Batch (async)
    AA->>DB: Store Events
    AA->>AA: Calculate Score Delta

    KZ-->>CG: Execution Result
    CG-->>Client: Response + Proof Hash
```

### Trust Score Calculation Flow

```mermaid
flowchart TB
    subgraph "Event Sources"
        E1[Execution Events]
        E2[Compliance Signals]
        E3[Identity Verification]
        E4[Context Factors]
    end

    subgraph "Score Components"
        C1[Behavioral Score<br/>Weight: 40%]
        C2[Compliance Score<br/>Weight: 25%]
        C3[Identity Score<br/>Weight: 20%]
        C4[Context Score<br/>Weight: 15%]
    end

    subgraph "Calculation"
        CALC[Weighted Average<br/>0-1000 Scale]
        DECAY[Apply Decay<br/>182-day half-life]
        FLOOR[Apply Certification<br/>Floor]
        CEIL[Apply Context<br/>Ceiling]
    end

    subgraph "Output"
        SCORE[Final Trust Score]
        TIER[Trust Tier<br/>T0-T5]
    end

    E1 --> C1
    E2 --> C2
    E3 --> C3
    E4 --> C4

    C1 --> CALC
    C2 --> CALC
    C3 --> CALC
    C4 --> CALC

    CALC --> DECAY
    DECAY --> FLOOR
    FLOOR --> CEIL
    CEIL --> SCORE
    SCORE --> TIER
```

### Trust Score Decay Model

```mermaid
xychart-beta
    title "Trust Score Decay Over Time (182-day Half-Life)"
    x-axis "Days Since Last Activity" [0, 7, 14, 28, 56, 112, 182, 365]
    y-axis "Score Retention %" 0 --> 100
    line [100, 100, 97, 90, 75, 55, 50, 25]
```

```mermaid
flowchart LR
    subgraph "Decay Milestones"
        D0["Day 0-6<br/>100% (Grace)"]
        D7["Day 7<br/>100%"]
        D14["Day 14<br/>97%"]
        D28["Day 28<br/>90%"]
        D56["Day 56<br/>75%"]
        D112["Day 112<br/>55%"]
        D182["Day 182<br/>50%"]
    end

    D0 --> D7 --> D14 --> D28 --> D56 --> D112 --> D182

    subgraph "Reset Triggers"
        R1[Successful Execution]
        R2[Positive Compliance Signal]
        R3[Identity Re-verification]
    end

    R1 -.->|Resets to Day 0| D0
    R2 -.->|Resets to Day 0| D0
    R3 -.->|Resets to Day 0| D0
```

### Certification Process Flow

```mermaid
stateDiagram-v2
    [*] --> Unregistered

    Unregistered --> Registered: Submit BASIS Manifest
    Registered --> Verified: 1000+ Events + No Violations
    Verified --> Certified: Pass Full Audit
    Certified --> CertifiedPlus: Enterprise Audit

    Registered --> Suspended: Critical Violation
    Verified --> Suspended: Critical Violation
    Certified --> Suspended: Critical Violation
    CertifiedPlus --> Suspended: Critical Violation

    Suspended --> Registered: Appeal + Review

    Certified --> Expired: Annual Renewal Missed
    CertifiedPlus --> Expired: Quarterly Review Failed

    Expired --> Verified: Re-verify Events
    Expired --> Certified: Renew Certification

    state Registered {
        [*] --> IdentityVerified
        IdentityVerified --> ManifestValid
        ManifestValid --> APIKeysIssued
    }

    state Certified {
        [*] --> AuditPassed
        AuditPassed --> BadgeIssued
        BadgeIssued --> MonitoringActive
    }
```

### Event Processing Pipeline

```mermaid
flowchart TB
    subgraph "Event Ingestion"
        IN[Incoming Events<br/>POST /events]
        VAL[Schema Validation]
        DUP[Deduplication<br/>SHA-256 Hash]
        QUEUE[BullMQ Queue]
    end

    subgraph "Event Processing"
        WORKER[Event Worker]
        CHAIN[Chain to Previous<br/>Event Hash]
        STORE[Store in PostgreSQL]
        DELTA[Calculate Score Delta]
    end

    subgraph "Score Update"
        FETCH[Fetch Current Score]
        APPLY[Apply Delta]
        DECAY_CHK[Check Decay Reset]
        SAVE[Save New Score]
        CACHE[Update Redis Cache]
    end

    subgraph "Proof Aggregation"
        AGG[Aggregate Events<br/>Hourly Batch]
        MERKLE[Build Merkle Tree]
        SIGN[Sign Root]
        ANCHOR[Store Proof]
    end

    IN --> VAL --> DUP --> QUEUE
    QUEUE --> WORKER --> CHAIN --> STORE --> DELTA
    DELTA --> FETCH --> APPLY --> DECAY_CHK --> SAVE --> CACHE
    STORE --> AGG --> MERKLE --> SIGN --> ANCHOR
```

### Policy Evaluation Flow

```mermaid
flowchart TB
    subgraph "Input"
        INT[Intent]
        AGT[Agent Context]
        ENV[Environment]
    end

    subgraph "Policy Loader"
        CACHE{Cached?}
        LOAD[Load from DB]
        PARSE[Parse Policies]
        PRIO[Sort by Priority]
    end

    subgraph "Evaluation Engine"
        MATCH[Match Conditions]
        EVAL[Evaluate Rules]
        COMBINE[Combine Results]
    end

    subgraph "Decision"
        ALLOW[ALLOW<br/>Proceed]
        DENY[DENY<br/>Block]
        ESCALATE[ESCALATE<br/>Human Review]
        DEGRADE[DEGRADE<br/>Limit Scope]
    end

    INT --> CACHE
    AGT --> CACHE
    ENV --> CACHE

    CACHE -->|Yes| MATCH
    CACHE -->|No| LOAD --> PARSE --> PRIO --> MATCH

    MATCH --> EVAL --> COMBINE

    COMBINE --> ALLOW
    COMBINE --> DENY
    COMBINE --> ESCALATE
    COMBINE --> DEGRADE

    style ALLOW fill:#c8e6c9
    style DENY fill:#ffcdd2
    style ESCALATE fill:#fff9c4
    style DEGRADE fill:#e1f5fe
```

### Webhook Delivery Flow

```mermaid
sequenceDiagram
    participant KZ as Kaizen
    participant WQ as Webhook Queue
    participant WW as Webhook Worker
    participant EXT as External Endpoint
    participant DLQ as Dead Letter Queue

    KZ->>WQ: Enqueue Webhook Event
    WQ->>WW: Dequeue Event

    WW->>WW: Sign Payload (HMAC-SHA256)

    loop Retry Loop (max 5)
        WW->>EXT: POST webhook payload
        alt Success (2xx)
            EXT-->>WW: 200 OK
            WW->>WW: Mark Delivered
        else Failure
            EXT-->>WW: 5xx Error
            WW->>WW: Exponential Backoff
            Note over WW: Wait 5s, 15s, 45s, 135s, 405s
        end
    end

    alt Max Retries Exceeded
        WW->>DLQ: Move to Dead Letter Queue
        Note over DLQ: Admin can retry manually
    end
```

### Multi-Tenant Data Isolation

```mermaid
flowchart TB
    subgraph "Request Flow"
        REQ[Incoming Request]
        AUTH[JWT Auth]
        TID[Extract Tenant ID]
        VERIFY[Verify Membership]
    end

    subgraph "Data Access"
        QUERY[Database Query]
        FILTER[Apply Tenant Filter]
        RESULT[Results]
    end

    subgraph "Tenant A"
        TA_AGENTS[Agents]
        TA_POLICIES[Policies]
        TA_EVENTS[Events]
    end

    subgraph "Tenant B"
        TB_AGENTS[Agents]
        TB_POLICIES[Policies]
        TB_EVENTS[Events]
    end

    REQ --> AUTH --> TID --> VERIFY
    VERIFY --> QUERY --> FILTER

    FILTER -->|tenant_id = A| TA_AGENTS
    FILTER -->|tenant_id = A| TA_POLICIES
    FILTER -->|tenant_id = A| TA_EVENTS

    FILTER -.->|BLOCKED| TB_AGENTS
    FILTER -.->|BLOCKED| TB_POLICIES
    FILTER -.->|BLOCKED| TB_EVENTS

    FILTER --> RESULT

    style TB_AGENTS fill:#ffcdd2,stroke-dasharray: 5 5
    style TB_POLICIES fill:#ffcdd2,stroke-dasharray: 5 5
    style TB_EVENTS fill:#ffcdd2,stroke-dasharray: 5 5
```
