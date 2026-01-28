# SDK Deep Dive
## For: Developers, Backend Engineers

### SDK Architecture

```mermaid
flowchart TB
    subgraph "Your Application"
        APP[Application Code]
    end

    subgraph "Cognigate SDK"
        subgraph "Public API"
            API1[Cognigate class]
            API2[Helper functions]
        end

        subgraph "Core Modules"
            CM1[TrustClient]
            CM2[KaizenClient]
            CM3[EventBatcher]
            CM4[CacheManager]
        end

        subgraph "Internal"
            INT1[HTTP Client]
            INT2[Retry Logic]
            INT3[Telemetry]
        end
    end

    subgraph "Vorion Services"
        VS1[AgentAnchor API]
        VS2[Kaizen API]
    end

    APP --> API1
    APP --> API2
    API1 --> CM1
    API1 --> CM2
    API1 --> CM3
    API1 --> CM4
    CM1 --> INT1
    CM2 --> INT1
    CM3 --> INT1
    INT1 --> INT2
    INT1 --> INT3
    INT1 --> VS1
    INT1 --> VS2
```

### Initialization Options

```mermaid
flowchart TB
    subgraph "Basic Init"
        B1["new Cognigate({ apiKey })"]
    end

    subgraph "Full Options"
        F1["new Cognigate({"]
        F2["  apiKey: 'vk_...',"]
        F3["  environment: 'production',"]
        F4["  timeout: 30000,"]
        F5["  retries: 3,"]
        F6["  cache: { ttl: 60, maxSize: 1000 },"]
        F7["  batch: { size: 100, interval: 5000 },"]
        F8["  telemetry: { enabled: true },"]
        F9["  hooks: { onError, onSuccess }"]
        F10["})"]
    end

    B1 --> F1
```

### Cache Management

```mermaid
flowchart TB
    subgraph "Cache Layers"
        L1[In-Memory LRU Cache<br/>Default: 1000 items]
        L2[Optional Redis<br/>For distributed]
    end

    subgraph "Cached Data"
        D1[Trust scores<br/>TTL: 60s]
        D2[Policies<br/>TTL: 300s]
        D3[Agent metadata<br/>TTL: 3600s]
    end

    subgraph "Cache Operations"
        O1["cg.cache.get(key)"]
        O2["cg.cache.set(key, value, ttl)"]
        O3["cg.cache.invalidate(pattern)"]
        O4["cg.cache.clear()"]
    end

    L1 --> D1
    L1 --> D2
    L1 --> D3
    L2 --> D1
    L2 --> D2
```

### Event Batching

```mermaid
sequenceDiagram
    participant App as Application
    participant SDK as Cognigate SDK
    participant Batcher as Event Batcher
    participant AA as AgentAnchor

    App->>SDK: runAgent() #1
    SDK->>Batcher: Add event
    Batcher->>Batcher: Buffer (not full)

    App->>SDK: runAgent() #2
    SDK->>Batcher: Add event
    Batcher->>Batcher: Buffer (not full)

    Note over Batcher: Batch interval reached (5s)
    Batcher->>AA: POST /events (batch of 2)
    AA-->>Batcher: Accepted

    App->>SDK: runAgent() x 100
    SDK->>Batcher: Add events
    Note over Batcher: Batch size reached (100)
    Batcher->>AA: POST /events (batch of 100)
```

### Error Handling

```mermaid
flowchart TB
    subgraph "Error Types"
        E1[VorionAuthError<br/>401, 403]
        E2[VorionValidationError<br/>400]
        E3[VorionTrustError<br/>403 + trust reason]
        E4[VorionRateLimitError<br/>429]
        E5[VorionNetworkError<br/>Connection issues]
        E6[VorionTimeoutError<br/>Request timeout]
    end

    subgraph "Handling Pattern"
        H1["try {"]
        H2["  await cg.runAgent(...)"]
        H3["} catch (e) {"]
        H4["  if (e instanceof VorionTrustError)"]
        H5["    // Handle low trust"]
        H6["  if (e instanceof VorionRateLimitError)"]
        H7["    // Wait and retry"]
        H8["}"]
    end

    E1 --> H4
    E3 --> H4
    E4 --> H6
```

### Retry Strategy

```mermaid
flowchart TB
    subgraph "Retry Configuration"
        RC1["retries: 3"]
        RC2["retryDelay: 1000"]
        RC3["retryBackoff: 2"]
        RC4["retryCondition: (err) => ..."]
    end

    subgraph "Retry Flow"
        RF1[Request fails]
        RF2{Retryable?}
        RF3{Retries left?}
        RF4[Wait backoff]
        RF5[Retry request]
        RF6[Throw error]
        RF7[Success]

        RF1 --> RF2
        RF2 -->|No| RF6
        RF2 -->|Yes| RF3
        RF3 -->|No| RF6
        RF3 -->|Yes| RF4
        RF4 --> RF5
        RF5 -->|Fail| RF1
        RF5 -->|Success| RF7
    end
```

### Middleware / Hooks

```mermaid
flowchart LR
    subgraph "Request Lifecycle"
        R1[Request Created]
        R2[onBeforeRequest]
        R3[HTTP Call]
        R4[onAfterResponse]
        R5[Result Returned]
    end

    subgraph "Error Lifecycle"
        E1[Error Occurs]
        E2[onError]
        E3[Retry or Throw]
    end

    R1 --> R2 --> R3 --> R4 --> R5
    R3 -->|Error| E1 --> E2 --> E3
```

### Hook Examples

```mermaid
flowchart TB
    subgraph "Logging Hook"
        L1["onBeforeRequest: (req) => {"]
        L2["  console.log('Calling:', req.path)"]
        L3["}"]
    end

    subgraph "Auth Refresh Hook"
        A1["onError: async (err) => {"]
        A2["  if (err.status === 401) {"]
        A3["    await refreshToken()"]
        A4["    return { retry: true }"]
        A5["  }"]
        A6["}"]
    end

    subgraph "Metrics Hook"
        M1["onAfterResponse: (res) => {"]
        M2["  metrics.record({"]
        M3["    latency: res.duration,"]
        M4["    status: res.status"]
        M5["  })"]
        M6["}"]
    end
```

### TypeScript Types

```mermaid
classDiagram
    class AgentRequest {
        +agentId: string
        +goal: string
        +context?: Record~string, any~
        +constraints?: AgentConstraints
        +metadata?: Record~string, any~
    }

    class AgentConstraints {
        +maxTokens?: number
        +timeout?: number
        +allowedCapabilities?: string[]
        +deniedCapabilities?: string[]
        +trustFloor?: number
    }

    class AgentResponse {
        +output: T
        +proofHash: string
        +trustScore: TrustScore
        +events: AgentEvent[]
        +usage: UsageMetrics
        +timing: TimingMetrics
    }

    class TrustScore {
        +score: number
        +tier: TrustTier
        +components: TrustComponents
        +lastActivity: Date
    }

    class TrustComponents {
        +behavioral: number
        +compliance: number
        +identity: number
        +context: number
    }

    AgentRequest --> AgentConstraints
    AgentResponse --> TrustScore
    TrustScore --> TrustComponents
```

### Async Patterns

```mermaid
flowchart TB
    subgraph "Promise-based"
        P1["cg.runAgent(req).then(res => ...)"]
    end

    subgraph "Async/Await"
        A1["const res = await cg.runAgent(req)"]
    end

    subgraph "Streaming (Future)"
        S1["for await (const chunk of cg.streamAgent(req))"]
        S2["  process(chunk)"]
    end

    subgraph "Parallel Execution"
        PA1["await Promise.all(["]
        PA2["  cg.runAgent(req1),"]
        PA3["  cg.runAgent(req2),"]
        PA4["  cg.runAgent(req3)"]
        PA5["])"]
    end
```

### Memory Management

```mermaid
flowchart TB
    subgraph "Memory Features"
        M1[Context windowing]
        M2[Smart summarization]
        M3[Priority retention]
        M4[Cross-session persistence]
    end

    subgraph "Memory API"
        API1["cg.memory.add(agentId, item)"]
        API2["cg.memory.query(agentId, query)"]
        API3["cg.memory.summarize(agentId)"]
        API4["cg.memory.clear(agentId)"]
    end

    subgraph "Configuration"
        C1["memory: {"]
        C2["  enabled: true,"]
        C3["  backend: 'redis',"]
        C4["  maxItems: 1000,"]
        C5["  ttl: 86400"]
        C6["}"]
    end

    M1 --> API1
    M2 --> API3
    M3 --> API2
    M4 --> C3
```

### Testing Utilities

```mermaid
flowchart TB
    subgraph "Mock Client"
        MC1["import { MockCognigate } from '@vorion/cognigate/testing'"]
        MC2["const mock = new MockCognigate()"]
        MC3["mock.onRunAgent().returns({ output: 'test' })"]
    end

    subgraph "Sandbox Client"
        SC1["new Cognigate({ environment: 'sandbox' })"]
        SC2["// Real API, test data"]
    end

    subgraph "Assertions"
        A1["expect(mock.runAgent).toHaveBeenCalledWith(...)"]
        A2["expect(result.trustScore.score).toBeGreaterThan(500)"]
    end
```

### Performance Tips

```mermaid
mindmap
  root((Performance<br/>Optimization))
    Caching
      Enable score caching
      Tune TTL for freshness
      Use Redis for distributed
    Batching
      Batch events
      Tune batch size
      Async submission
    Connection
      Keep-alive enabled
      Connection pooling
      Retry with backoff
    Parallelization
      Concurrent requests
      Promise.all for independent
      Rate limit awareness
```
