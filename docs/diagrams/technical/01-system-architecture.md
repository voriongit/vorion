# System Architecture
## For: Engineers, Architects, Technical Leads

### Complete System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        AU_C[Aurais Core<br/>Web/Mobile]
        AU_P[Aurais Pro<br/>Web/Desktop]
        AU_E[Aurais Exec<br/>Web/API]
        SDK[Agent SDK<br/>Developer Integration]
    end

    subgraph "API Gateway"
        GW[API Gateway<br/>Rate Limiting / Auth]
    end

    subgraph "Cognigate Runtime"
        CG_AA[AgentAnchor<br/>Client]
        CG_KZ[Kaizen<br/>Engine]
        CG_BS[BASIS<br/>Validator]
        CG_TG[Trust<br/>Gating]
        CG_TM[Token<br/>Manager]
        CG_AM[Active<br/>Memory]
    end

    subgraph "Backend Services"
        subgraph "AgentAnchor"
            AA_TS[Trust<br/>Service]
            AA_CS[Certification<br/>Service]
            AA_RS[Registry<br/>Service]
            AA_ES[Event<br/>Service]
        end

        subgraph "Kaizen"
            KZ_L1[Layer 1<br/>BASIS]
            KZ_L2[Layer 2<br/>INTENT]
            KZ_L3[Layer 3<br/>ENFORCE]
            KZ_L4[Layer 4<br/>PROOF]
        end
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Primary Store)]
        RD[(Redis<br/>Cache/Queue)]
        S3[(Object Storage<br/>Proofs/Artifacts)]
    end

    subgraph "External"
        AI[AI Providers<br/>OpenAI/Anthropic/etc]
        WH[Webhook<br/>Consumers]
    end

    AU_C --> GW
    AU_P --> GW
    AU_E --> GW
    SDK --> GW

    GW --> CG_AA
    GW --> CG_KZ

    CG_AA --> AA_TS
    CG_AA --> AA_RS
    CG_KZ --> KZ_L1
    CG_BS --> KZ_L1

    KZ_L1 --> KZ_L2
    KZ_L2 --> KZ_L3
    KZ_L3 --> KZ_L4
    KZ_L4 --> AA_ES

    AA_TS --> PG
    AA_TS --> RD
    AA_CS --> PG
    AA_RS --> PG
    AA_ES --> PG
    AA_ES --> S3

    KZ_L4 --> S3
    CG_AM --> RD

    CG_TM --> AI
    KZ_L4 --> WH

    style CG_AA fill:#fff3e0
    style CG_KZ fill:#f3e5f5
    style CG_BS fill:#e1f5fe
    style AA_TS fill:#fff3e0
    style KZ_L1 fill:#e1f5fe
    style KZ_L2 fill:#f3e5f5
    style KZ_L3 fill:#f3e5f5
    style KZ_L4 fill:#f3e5f5
```

### Kaizen Layer Architecture

```mermaid
flowchart TB
    subgraph "KAIZEN - Execution Integrity Engine"
        subgraph "Layer 1: BASIS Validation"
            L1_IN[Agent Request] --> L1_PARSE[Parse Manifest]
            L1_PARSE --> L1_SCHEMA[Validate Schema]
            L1_SCHEMA --> L1_CAP[Check Capabilities]
            L1_CAP --> L1_PROF[Match Profile]
            L1_PROF --> L1_OUT{Valid?}
            L1_OUT -->|No| L1_REJ[Reject]
            L1_OUT -->|Yes| L2_IN
        end

        subgraph "Layer 2: INTENT Declaration"
            L2_IN[Validated Request] --> L2_DECL[Declare Intent]
            L2_DECL --> L2_LOG[Log Immutably]
            L2_LOG --> L2_HASH[Generate Hash]
            L2_HASH --> L2_TS[Timestamp]
            L2_TS --> L3_IN
        end

        subgraph "Layer 3: ENFORCE Runtime"
            L3_IN[Declared Intent] --> L3_TRUST[Check Trust Score]
            L3_TRUST --> L3_POLICY[Evaluate Policy]
            L3_POLICY --> L3_BOUND[Check Boundaries]
            L3_BOUND --> L3_DEC{Decision}
            L3_DEC -->|DENY| L3_BLOCK[Block Execution]
            L3_DEC -->|ESCALATE| L3_ESC[Human Review]
            L3_DEC -->|ALLOW| L3_EXEC[Execute]
            L3_EXEC --> L3_MON[Monitor Runtime]
            L3_MON --> L3_INT{Violation?}
            L3_INT -->|Yes| L3_STOP[Interrupt]
            L3_INT -->|No| L4_IN
        end

        subgraph "Layer 4: PROOF Generation"
            L4_IN[Execution Complete] --> L4_REC[Generate Receipt]
            L4_REC --> L4_CHAIN[Chain Events]
            L4_CHAIN --> L4_MERKLE[Compute Merkle Root]
            L4_MERKLE --> L4_SIGN[Sign Attestation]
            L4_SIGN --> L4_BATCH[Batch for Submission]
            L4_BATCH --> L4_AA[Submit to AgentAnchor]
        end
    end

    style L1_IN fill:#e1f5fe
    style L2_IN fill:#f3e5f5
    style L3_IN fill:#fff3e0
    style L4_IN fill:#e8f5e9
```

### AgentAnchor Service Architecture

```mermaid
flowchart TB
    subgraph "AgentAnchor - Trust Authority"
        subgraph "API Layer"
            API_TRUST["/trust/:agent_id"]
            API_EVENTS["/events"]
            API_VERIFY["/verify/:hash"]
            API_REG["/registry/:agent_id"]
            API_CERT["/certify/*"]
        end

        subgraph "Trust Service"
            TS_QUERY[Score Query]
            TS_CALC[Score Calculator]
            TS_DECAY[Decay Engine<br/>182-day half-life]
            TS_CACHE[Score Cache<br/>Redis]
        end

        subgraph "Event Service"
            ES_INGEST[Event Ingestion]
            ES_VALIDATE[Event Validation]
            ES_STORE[Event Storage]
            ES_DELTA[Delta Calculator]
        end

        subgraph "Certification Service"
            CS_APP[Application Handler]
            CS_AUDIT[Audit Engine]
            CS_VERIFY[Verification Tests]
            CS_BADGE[Badge Generator]
        end

        subgraph "Registry Service"
            RS_LOOKUP[Agent Lookup]
            RS_PROFILE[Profile Manager]
            RS_HISTORY[History Tracker]
        end
    end

    API_TRUST --> TS_QUERY
    TS_QUERY --> TS_CACHE
    TS_CACHE --> TS_CALC
    TS_CALC --> TS_DECAY

    API_EVENTS --> ES_INGEST
    ES_INGEST --> ES_VALIDATE
    ES_VALIDATE --> ES_STORE
    ES_STORE --> ES_DELTA
    ES_DELTA --> TS_CALC

    API_VERIFY --> ES_STORE

    API_REG --> RS_LOOKUP
    RS_LOOKUP --> RS_PROFILE
    RS_PROFILE --> RS_HISTORY

    API_CERT --> CS_APP
    CS_APP --> CS_AUDIT
    CS_AUDIT --> CS_VERIFY
    CS_VERIFY --> CS_BADGE
```

### Cognigate Integration Layer

```mermaid
flowchart LR
    subgraph "Your Application"
        APP[Application Code]
    end

    subgraph "Cognigate SDK"
        SDK_INIT[Initialize]
        SDK_RUN[Run Agent]
        SDK_RESULT[Get Result]
    end

    subgraph "Cognigate Runtime"
        subgraph "Cached Services"
            C_BASIS[BASIS Validator<br/>Local Cache]
            C_TRUST[Trust Scores<br/>Predictive Cache]
        end

        subgraph "Integrated Engine"
            C_KAIZEN[Kaizen Engine<br/>In-Process]
        end

        subgraph "Optimizations"
            C_TOKEN[Token Manager<br/>Context Window]
            C_MEM[Active Memory<br/>Cross-Session]
            C_BATCH[Event Batcher<br/>Async Submit]
        end
    end

    subgraph "External Services"
        EXT_AA[AgentAnchor API]
        EXT_AI[AI Provider]
    end

    APP --> SDK_INIT
    SDK_INIT --> SDK_RUN
    SDK_RUN --> SDK_RESULT

    SDK_RUN --> C_BASIS
    SDK_RUN --> C_TRUST
    SDK_RUN --> C_KAIZEN
    SDK_RUN --> C_TOKEN
    SDK_RUN --> C_MEM

    C_TRUST -.->|Periodic Sync| EXT_AA
    C_BATCH -.->|Async| EXT_AA
    C_TOKEN --> EXT_AI
    C_KAIZEN --> C_BATCH

    style C_BASIS fill:#e1f5fe
    style C_TRUST fill:#fff3e0
    style C_KAIZEN fill:#f3e5f5
```

### Technology Stack

```mermaid
graph TB
    subgraph "Frontend - Aurais"
        FE_FRAME[Next.js 16]
        FE_UI[React 19]
        FE_STYLE[Tailwind CSS]
        FE_STATE[Zustand/TanStack Query]
    end

    subgraph "API Layer"
        API_FRAME[Fastify 5]
        API_VAL[Zod Validation]
        API_AUTH[JWT Auth]
        API_RATE[Rate Limiting]
    end

    subgraph "Backend Services"
        BE_LANG[TypeScript 5.x]
        BE_ORM[Drizzle ORM]
        BE_QUEUE[BullMQ]
        BE_CACHE[ioredis]
    end

    subgraph "Data Stores"
        DS_PG[PostgreSQL 16<br/>Neon Serverless]
        DS_RD[Redis 7<br/>Upstash]
        DS_S3[S3-Compatible<br/>Object Storage]
    end

    subgraph "Observability"
        OB_LOG[Pino Logging]
        OB_TRACE[OpenTelemetry]
        OB_METRIC[Prometheus]
    end

    subgraph "Infrastructure"
        INF_CONT[Docker]
        INF_ORCH[Kubernetes]
        INF_CI[GitHub Actions]
    end

    FE_FRAME --> API_FRAME
    API_FRAME --> BE_LANG
    BE_ORM --> DS_PG
    BE_CACHE --> DS_RD
    BE_LANG --> OB_LOG
    BE_LANG --> OB_TRACE
```

### Database Schema Overview

```mermaid
erDiagram
    AGENTS ||--o{ TRUST_SCORES : has
    AGENTS ||--o{ EVENTS : generates
    AGENTS ||--o{ CERTIFICATIONS : holds
    AGENTS ||--o{ INTENTS : submits

    TRUST_SCORES ||--o{ TRUST_HISTORY : tracks

    EVENTS ||--o{ PROOFS : anchors

    INTENTS ||--o{ INTENT_EVENTS : logs
    INTENTS ||--o{ ESCALATIONS : triggers
    INTENTS ||--o{ EVALUATIONS : receives

    POLICIES ||--o{ EVALUATIONS : applies

    TENANTS ||--o{ AGENTS : owns
    TENANTS ||--o{ POLICIES : defines

    AGENTS {
        uuid id PK
        uuid tenant_id FK
        string aci_string
        jsonb manifest
        string status
        timestamp created_at
    }

    TRUST_SCORES {
        uuid id PK
        uuid agent_id FK
        int score
        int level
        float behavioral
        float compliance
        float identity
        float context
        timestamp last_activity
    }

    EVENTS {
        uuid id PK
        uuid agent_id FK
        string event_type
        jsonb payload
        string hash
        timestamp timestamp
    }

    PROOFS {
        uuid id PK
        uuid event_id FK
        string merkle_root
        bytes signature
        timestamp anchored_at
    }

    CERTIFICATIONS {
        uuid id PK
        uuid agent_id FK
        string tier
        timestamp issued_at
        timestamp expires_at
        string status
    }

    INTENTS {
        uuid id PK
        uuid agent_id FK
        uuid tenant_id FK
        string goal
        string status
        jsonb context
        timestamp created_at
    }
```
