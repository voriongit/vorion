# Orchestration Patterns
## For: Engineers, Architects, Platform Teams

### Multi-Agent Orchestration

```mermaid
flowchart TB
    subgraph "Orchestrator"
        ORCH[Agent Orchestrator<br/>Aurais Pro/Exec]
    end

    subgraph "Agent Pool"
        A1[Research Agent<br/>T3: 580]
        A2[Analysis Agent<br/>T4: 720]
        A3[Writing Agent<br/>T2: 420]
        A4[Review Agent<br/>T4: 810]
    end

    subgraph "Cognigate Runtime"
        CG[Cognigate<br/>Trust Gating + Optimization]
    end

    subgraph "Backend"
        KZ[Kaizen<br/>All 4 Layers]
        AA[AgentAnchor<br/>Trust + Events]
    end

    ORCH --> CG
    CG --> A1
    CG --> A2
    CG --> A3
    CG --> A4

    A1 --> KZ
    A2 --> KZ
    A3 --> KZ
    A4 --> KZ

    KZ --> AA
```

### Workflow: Sequential Agent Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Orch as Orchestrator
    participant CG as Cognigate
    participant A1 as Research Agent
    participant A2 as Analysis Agent
    participant A3 as Writing Agent
    participant KZ as Kaizen

    User->>Orch: "Write report on AI trends"

    Note over Orch: Step 1: Research

    Orch->>CG: Execute Research Agent
    CG->>CG: Trust Gate Check (T3 required)
    CG->>A1: Research task
    A1->>KZ: Intent: search_web
    KZ-->>A1: ALLOW
    A1->>A1: Execute search
    A1-->>CG: Research results
    CG-->>Orch: Step 1 complete

    Note over Orch: Step 2: Analysis

    Orch->>CG: Execute Analysis Agent
    CG->>A2: Analyze with context
    A2->>KZ: Intent: process_data
    KZ-->>A2: ALLOW
    A2-->>CG: Analysis results
    CG-->>Orch: Step 2 complete

    Note over Orch: Step 3: Writing

    Orch->>CG: Execute Writing Agent
    CG->>A3: Write with analysis
    A3->>KZ: Intent: generate_document
    KZ-->>A3: ALLOW
    A3-->>CG: Draft document
    CG-->>Orch: Step 3 complete

    Orch-->>User: Final report
```

### Workflow: Parallel Agent Execution

```mermaid
flowchart TB
    subgraph "Request"
        REQ[Complex Task]
    end

    subgraph "Decomposition"
        DEC[Task Decomposer]
    end

    subgraph "Parallel Execution"
        PAR1[Sub-task 1<br/>Agent A]
        PAR2[Sub-task 2<br/>Agent B]
        PAR3[Sub-task 3<br/>Agent C]
    end

    subgraph "Aggregation"
        AGG[Result Aggregator]
    end

    subgraph "Response"
        RES[Combined Result]
    end

    REQ --> DEC
    DEC --> PAR1
    DEC --> PAR2
    DEC --> PAR3
    PAR1 --> AGG
    PAR2 --> AGG
    PAR3 --> AGG
    AGG --> RES
```

### Trust-Based Routing

```mermaid
flowchart TB
    subgraph "Incoming Request"
        REQ[Agent Request<br/>Required Trust: T3]
    end

    subgraph "Agent Selection"
        CHECK{Check Available<br/>Agents}
    end

    subgraph "Agent Pool"
        A_HIGH[Premium Agent<br/>T5: 950<br/>$0.05/call]
        A_MED[Standard Agent<br/>T3: 580<br/>$0.02/call]
        A_LOW[Basic Agent<br/>T1: 180<br/>$0.01/call]
    end

    subgraph "Decision Logic"
        D1{T3+ Available?}
        D2{Prefer Cost<br/>or Quality?}
    end

    REQ --> CHECK --> D1
    D1 -->|No| QUEUE[Queue for Later]
    D1 -->|Yes| D2
    D2 -->|Quality| A_HIGH
    D2 -->|Cost| A_MED

    style A_LOW fill:#ffcdd2
    style A_MED fill:#c8e6c9
    style A_HIGH fill:#bbdefb
```

### Escalation Patterns

```mermaid
stateDiagram-v2
    [*] --> AgentProcessing: Request received

    AgentProcessing --> AutoApproved: Trust sufficient
    AgentProcessing --> NeedsEscalation: Trust insufficient

    NeedsEscalation --> PendingReview: Create escalation

    PendingReview --> Approved: Human approves
    PendingReview --> Rejected: Human rejects
    PendingReview --> Timeout: SLA expired

    Approved --> AgentProcessing: Continue with approval
    Rejected --> Failed: Request denied
    Timeout --> AutoEscalate: Escalate to manager

    AutoEscalate --> PendingReview: Higher authority

    AutoApproved --> Completed: Execute and log
    Failed --> [*]
    Completed --> [*]
```

### Circuit Breaker Pattern

```mermaid
flowchart TB
    subgraph "Circuit Breaker States"
        CLOSED[CLOSED<br/>Normal operation]
        OPEN[OPEN<br/>Failing fast]
        HALF[HALF-OPEN<br/>Testing recovery]
    end

    subgraph "Metrics"
        M1["Failure count: 0"]
        M2["Success rate: 99%"]
        M3["Last failure: N/A"]
    end

    CLOSED -->|"Failures > threshold"| OPEN
    OPEN -->|"Timeout elapsed"| HALF
    HALF -->|"Test succeeds"| CLOSED
    HALF -->|"Test fails"| OPEN

    subgraph "When OPEN"
        FAIL_FAST[Return cached result<br/>or graceful degradation]
    end

    OPEN --> FAIL_FAST
```

### Rate Limiting & Backpressure

```mermaid
flowchart TB
    subgraph "Request Flow"
        IN[Incoming Requests<br/>100 req/s]
    end

    subgraph "Rate Limiter"
        RL[Token Bucket<br/>Capacity: 50<br/>Refill: 10/s]
    end

    subgraph "Queue"
        Q[Request Queue<br/>Max: 100]
    end

    subgraph "Processing"
        PROC[Agent Execution<br/>10 concurrent]
    end

    subgraph "Backpressure"
        BP1["429 Too Many Requests"]
        BP2["Queue full, reject"]
    end

    IN --> RL
    RL -->|"Under limit"| Q
    RL -->|"Over limit"| BP1
    Q -->|"Queue space"| PROC
    Q -->|"Queue full"| BP2
```

### Event-Driven Architecture

```mermaid
flowchart LR
    subgraph "Producers"
        P1[Kaizen<br/>Execution Events]
        P2[AgentAnchor<br/>Trust Events]
        P3[Aurais<br/>User Events]
    end

    subgraph "Event Bus"
        BUS[(Redis Streams<br/>/ BullMQ)]
    end

    subgraph "Consumers"
        C1[Trust Calculator]
        C2[Webhook Dispatcher]
        C3[Analytics Pipeline]
        C4[Audit Logger]
        C5[Alert Service]
    end

    P1 --> BUS
    P2 --> BUS
    P3 --> BUS

    BUS --> C1
    BUS --> C2
    BUS --> C3
    BUS --> C4
    BUS --> C5
```

### Saga Pattern for Long-Running Operations

```mermaid
sequenceDiagram
    participant Saga as Saga Coordinator
    participant S1 as Step 1: Reserve
    participant S2 as Step 2: Process
    participant S3 as Step 3: Commit

    Note over Saga: Start Saga

    Saga->>S1: Execute Step 1
    S1-->>Saga: Success (reversible)

    Saga->>S2: Execute Step 2
    S2-->>Saga: Success (reversible)

    Saga->>S3: Execute Step 3

    alt Step 3 Fails
        S3-->>Saga: Failure
        Note over Saga: Compensate

        Saga->>S2: Compensate Step 2
        S2-->>Saga: Reversed

        Saga->>S1: Compensate Step 1
        S1-->>Saga: Reversed

        Note over Saga: Saga Failed
    else Step 3 Succeeds
        S3-->>Saga: Success
        Note over Saga: Saga Complete
    end
```

### Active Memory Architecture

```mermaid
flowchart TB
    subgraph "Memory Layers"
        L1[Working Memory<br/>Current conversation]
        L2[Short-term Memory<br/>Recent sessions]
        L3[Long-term Memory<br/>Persistent facts]
    end

    subgraph "Storage"
        S1[In-process cache]
        S2[Redis<br/>TTL: 24h]
        S3[PostgreSQL<br/>+ Vector DB]
    end

    subgraph "Retrieval"
        R1[Recency-based]
        R2[Relevance-based<br/>Semantic search]
        R3[Importance-ranked]
    end

    L1 --> S1
    L2 --> S2
    L3 --> S3

    S1 --> R1
    S2 --> R2
    S3 --> R3

    subgraph "Context Assembly"
        CTX[Assembled Context<br/>for AI Provider]
    end

    R1 --> CTX
    R2 --> CTX
    R3 --> CTX
```

### Token Budget Management

```mermaid
flowchart TB
    subgraph "Token Budget"
        TOTAL[Total Budget<br/>128K tokens]
    end

    subgraph "Allocation"
        A1[System Prompt<br/>2K fixed]
        A2[Memory Context<br/>16K max]
        A3[Current Request<br/>8K max]
        A4[Reserved for Response<br/>4K min]
        A5[Remaining<br/>98K available]
    end

    subgraph "Optimization"
        O1[Summarize old messages]
        O2[Prune low-relevance]
        O3[Compress context]
    end

    TOTAL --> A1
    TOTAL --> A2
    TOTAL --> A3
    TOTAL --> A4
    TOTAL --> A5

    A2 --> O1
    A2 --> O2
    A2 --> O3
```

### Deployment Topology

```mermaid
flowchart TB
    subgraph "Edge"
        CDN[CDN<br/>Static Assets]
        WAF[WAF<br/>DDoS Protection]
    end

    subgraph "Load Balancing"
        LB[Load Balancer<br/>SSL Termination]
    end

    subgraph "Application Tier"
        API1[API Server 1]
        API2[API Server 2]
        API3[API Server N]
    end

    subgraph "Worker Tier"
        W1[Intent Worker]
        W2[Event Worker]
        W3[Webhook Worker]
    end

    subgraph "Data Tier"
        PG[(PostgreSQL<br/>Primary)]
        PG_R[(PostgreSQL<br/>Replica)]
        RD[(Redis<br/>Cluster)]
    end

    subgraph "External"
        AI[AI Providers]
        WH[Webhook Consumers]
    end

    CDN --> LB
    WAF --> LB
    LB --> API1
    LB --> API2
    LB --> API3

    API1 --> RD
    API2 --> RD
    API3 --> RD

    API1 --> PG
    API2 --> PG_R
    API3 --> PG_R

    W1 --> RD
    W2 --> RD
    W3 --> RD

    W1 --> PG
    W2 --> PG
    W3 --> PG

    API1 --> AI
    W3 --> WH
```

### Health Check Architecture

```mermaid
flowchart TB
    subgraph "Health Endpoints"
        H1["/health<br/>Liveness"]
        H2["/ready<br/>Readiness"]
        H3["/metrics<br/>Prometheus"]
    end

    subgraph "Checks"
        C1[Memory usage < 90%]
        C2[CPU usage < 80%]
        C3[DB connection pool OK]
        C4[Redis connection OK]
        C5[Queue backlog < 1000]
        C6[Policies loaded]
    end

    subgraph "Kubernetes"
        K1[Liveness Probe<br/>Restart if unhealthy]
        K2[Readiness Probe<br/>Remove from LB]
    end

    H1 --> C1
    H1 --> C2

    H2 --> C3
    H2 --> C4
    H2 --> C5
    H2 --> C6

    K1 --> H1
    K2 --> H2
```
