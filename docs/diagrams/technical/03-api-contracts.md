# API Contracts & Integration
## For: Engineers, API Consumers, Integration Partners

### AgentAnchor API Overview

```mermaid
flowchart LR
    subgraph "AgentAnchor API"
        subgraph "Trust Endpoints"
            T1["GET /trust/:agent_id"]
            T2["POST /events"]
        end

        subgraph "Verification Endpoints"
            V1["GET /verify/:proof_hash"]
        end

        subgraph "Registry Endpoints"
            R1["GET /registry/:agent_id"]
            R2["GET /registry/search"]
        end

        subgraph "Certification Endpoints"
            C1["POST /certify/apply"]
            C2["GET /certify/status/:id"]
            C3["GET /certify/badges/:agent_id"]
        end
    end
```

### Trust Score API

```mermaid
sequenceDiagram
    participant Client
    participant AA as AgentAnchor

    Note over Client,AA: GET /trust/:agent_id

    Client->>AA: GET /trust/agent_abc123
    AA->>AA: Validate API Key
    AA->>AA: Lookup Score (cached)
    AA-->>Client: 200 OK

    Note right of Client: Response:
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
    Note right of Client:   "last_activity": "2026-01-28T...",
    Note right of Client:   "signature": "base64..."
    Note right of Client: }
```

### Event Submission API

```mermaid
sequenceDiagram
    participant Client
    participant AA as AgentAnchor
    participant DB as Database
    participant Queue as Event Queue

    Note over Client,AA: POST /events (Batch)

    Client->>AA: POST /events
    Note right of Client: {
    Note right of Client:   "agent_id": "agent_abc123",
    Note right of Client:   "events": [
    Note right of Client:     {
    Note right of Client:       "type": "execution.success",
    Note right of Client:       "timestamp": "...",
    Note right of Client:       "intent_hash": "sha256...",
    Note right of Client:       "result_hash": "sha256...",
    Note right of Client:       "metadata": {...}
    Note right of Client:     }
    Note right of Client:   ]
    Note right of Client: }

    AA->>AA: Validate Schema
    AA->>AA: Verify Signatures
    AA->>Queue: Enqueue Events
    AA->>AA: Calculate Preliminary Delta
    AA-->>Client: 202 Accepted

    Note right of Client: {
    Note right of Client:   "accepted": 5,
    Note right of Client:   "rejected": 0,
    Note right of Client:   "score_delta": +12,
    Note right of Client:   "new_score": 754,
    Note right of Client:   "batch_id": "batch_xyz"
    Note right of Client: }

    Queue->>DB: Process & Store (async)
```

### Kaizen Layer API (Internal)

```mermaid
flowchart TB
    subgraph "Layer 1: BASIS Validation"
        L1_IN["validate(manifest)"]
        L1_OUT["{ valid: boolean, errors: [] }"]
    end

    subgraph "Layer 2: INTENT Declaration"
        L2_IN["declare(agent_id, action, resource)"]
        L2_OUT["{ intent_id, hash, timestamp }"]
    end

    subgraph "Layer 3: ENFORCE Runtime"
        L3_IN["evaluate(intent, trust_score)"]
        L3_OUT["{ decision, reasons, limits }"]
    end

    subgraph "Layer 4: PROOF Generation"
        L4_IN["attest(execution_result)"]
        L4_OUT["{ proof_hash, merkle_root, signature }"]
    end

    L1_IN --> L1_OUT
    L2_IN --> L2_OUT
    L3_IN --> L3_OUT
    L4_IN --> L4_OUT
```

### Cognigate SDK Interface

```mermaid
classDiagram
    class Cognigate {
        +init(config: CognigateConfig): Promise~void~
        +runAgent(request: AgentRequest): Promise~AgentResponse~
        +getScore(agentId: string): Promise~TrustScore~
        +shutdown(): Promise~void~
    }

    class CognigateConfig {
        +agentAnchorUrl: string
        +apiKey: string
        +cacheOptions: CacheOptions
        +tokenBudget: number
        +memoryEnabled: boolean
    }

    class AgentRequest {
        +agentId: string
        +goal: string
        +context: object
        +constraints: Constraints
    }

    class AgentResponse {
        +result: any
        +proofHash: string
        +tokensUsed: number
        +trustScore: TrustScore
        +events: Event[]
    }

    class TrustScore {
        +score: number
        +tier: string
        +components: ScoreComponents
        +lastActivity: Date
    }

    class Constraints {
        +maxTokens: number
        +timeout: number
        +allowedCapabilities: string[]
    }

    Cognigate --> CognigateConfig
    Cognigate --> AgentRequest
    Cognigate --> AgentResponse
    AgentResponse --> TrustScore
    AgentRequest --> Constraints
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant CG as Cognigate
    participant AA as AgentAnchor
    participant Auth as Auth Provider

    Note over App,Auth: Initial Setup

    App->>Auth: OAuth2 / OIDC Login
    Auth-->>App: JWT Token

    App->>CG: init({ apiKey, jwt })
    CG->>AA: Validate API Key
    AA-->>CG: Key Valid + Tenant Info
    CG-->>App: Initialized

    Note over App,Auth: Runtime Requests

    App->>CG: runAgent(request)
    CG->>CG: Check JWT Expiry

    alt Token Expired
        CG->>Auth: Refresh Token
        Auth-->>CG: New JWT
    end

    CG->>AA: Request with JWT
    AA->>AA: Verify JWT Signature
    AA->>AA: Extract Tenant ID
    AA->>AA: Verify Tenant Access
    AA-->>CG: Authorized Response
    CG-->>App: Agent Response
```

### Rate Limiting

```mermaid
flowchart TB
    subgraph "Rate Limit Tiers"
        T1["Aurais Core<br/>100 req/min"]
        T2["Aurais Pro<br/>1000 req/min"]
        T3["Aurais Exec<br/>10000 req/min"]
        T4["Custom<br/>Negotiated"]
    end

    subgraph "Rate Limit Response"
        REQ[Request] --> CHECK{Under Limit?}
        CHECK -->|Yes| PROCESS[Process Request]
        CHECK -->|No| REJECT["429 Too Many Requests<br/>Retry-After: X seconds"]
    end

    subgraph "Headers"
        H1["X-RateLimit-Limit: 1000"]
        H2["X-RateLimit-Remaining: 847"]
        H3["X-RateLimit-Reset: 1706454000"]
    end
```

### Error Response Format

```mermaid
flowchart LR
    subgraph "Error Categories"
        E4XX["4xx Client Errors"]
        E5XX["5xx Server Errors"]
    end

    subgraph "Error Response"
        ERR["
        {
          error: {
            code: 'TRUST_INSUFFICIENT',
            message: 'Agent trust score below threshold',
            details: {
              required: 500,
              actual: 342,
              tier_required: 'T3',
              tier_actual: 'T2'
            }
          },
          request_id: 'req_abc123',
          timestamp: '2026-01-28T...'
        }
        "]
    end

    E4XX --> ERR
    E5XX --> ERR
```

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_INVALID` | 401 | Invalid or expired API key/JWT |
| `AUTH_FORBIDDEN` | 403 | Valid auth but insufficient permissions |
| `TRUST_INSUFFICIENT` | 403 | Trust score below required threshold |
| `POLICY_DENIED` | 403 | Policy evaluation returned DENY |
| `MANIFEST_INVALID` | 400 | BASIS manifest validation failed |
| `INTENT_DUPLICATE` | 409 | Duplicate intent detected |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `AGENT_NOT_FOUND` | 404 | Agent ID not in registry |
| `CERT_EXPIRED` | 403 | Agent certification has expired |
| `PROOF_INVALID` | 400 | Proof hash verification failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Dependency unavailable |
