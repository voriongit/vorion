# Developer Quickstart
## For: New Developers, Integration Engineers

### Getting Started in 5 Minutes

```mermaid
flowchart LR
    subgraph "Step 1"
        S1[Sign Up<br/>aurais.ai]
    end

    subgraph "Step 2"
        S2[Get API Key<br/>Dashboard]
    end

    subgraph "Step 3"
        S3[Install SDK<br/>npm install]
    end

    subgraph "Step 4"
        S4[Run Agent<br/>First call!]
    end

    S1 --> S2 --> S3 --> S4

    style S4 fill:#c8e6c9
```

### Installation Options

```mermaid
flowchart TB
    subgraph "JavaScript / TypeScript"
        JS1["npm install @vorion/cognigate"]
        JS2["yarn add @vorion/cognigate"]
        JS3["pnpm add @vorion/cognigate"]
    end

    subgraph "Python"
        PY1["pip install cognigate"]
        PY2["poetry add cognigate"]
    end

    subgraph "Go"
        GO1["go get github.com/vorion/cognigate-go"]
    end

    subgraph "REST API"
        REST["Direct HTTP calls<br/>No SDK required"]
    end
```

### First Agent Registration

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CLI as Vorion CLI
    participant AA as AgentAnchor

    Dev->>CLI: vorion init
    CLI->>Dev: Create manifest template

    Dev->>Dev: Edit manifest.json
    Note right of Dev: {
    Note right of Dev:   "name": "my-agent",
    Note right of Dev:   "version": "1.0.0",
    Note right of Dev:   "capabilities": [...]
    Note right of Dev: }

    Dev->>CLI: vorion validate
    CLI->>CLI: Check BASIS schema
    CLI-->>Dev: ✓ Valid

    Dev->>CLI: vorion register
    CLI->>AA: POST /registry
    AA-->>CLI: agent_id + API keys
    CLI-->>Dev: ✓ Registered!
```

### Minimal Code Example

```mermaid
flowchart TB
    subgraph "1. Initialize"
        I1["import { Cognigate } from '@vorion/cognigate'"]
        I2["const cg = new Cognigate({ apiKey: '...' })"]
    end

    subgraph "2. Run Agent"
        R1["const result = await cg.runAgent({"]
        R2["  agentId: 'my-agent',"]
        R3["  goal: 'Summarize this document',"]
        R4["  context: { doc: '...' }"]
        R5["})"]
    end

    subgraph "3. Get Result"
        G1["console.log(result.output)"]
        G2["console.log(result.proofHash)"]
        G3["console.log(result.trustScore)"]
    end

    I1 --> I2 --> R1 --> R2 --> R3 --> R4 --> R5 --> G1 --> G2 --> G3
```

### Project Structure

```mermaid
flowchart TB
    subgraph "Recommended Layout"
        ROOT[my-agent-project/]
        SRC[src/]
        AGENT[agent.ts]
        TOOLS[tools/]
        CONFIG[config/]
        MANIFEST[manifest.json]
        ENV[.env]
    end

    ROOT --> SRC
    ROOT --> CONFIG
    ROOT --> MANIFEST
    ROOT --> ENV
    SRC --> AGENT
    SRC --> TOOLS
```

### Environment Variables

```mermaid
flowchart LR
    subgraph "Required"
        R1["VORION_API_KEY"]
        R2["VORION_AGENT_ID"]
    end

    subgraph "Optional"
        O1["VORION_ENV=production|sandbox"]
        O2["VORION_LOG_LEVEL=debug|info|warn"]
        O3["VORION_CACHE_TTL=60"]
    end

    subgraph "AI Provider"
        AI1["OPENAI_API_KEY"]
        AI2["ANTHROPIC_API_KEY"]
    end
```

### Development Workflow

```mermaid
flowchart TB
    subgraph "Local Development"
        L1[Write code]
        L2[Test locally]
        L3[Use sandbox]
    end

    subgraph "Staging"
        S1[Deploy to staging]
        S2[Integration tests]
        S3[Trust accumulation]
    end

    subgraph "Production"
        P1[Promote agent]
        P2[Monitor trust]
        P3[Iterate]
    end

    L1 --> L2 --> L3
    L3 --> S1 --> S2 --> S3
    S3 --> P1 --> P2 --> P3
    P3 -.-> L1
```

### Testing Your Agent

```mermaid
flowchart TB
    subgraph "Unit Tests"
        U1[Mock Cognigate SDK]
        U2[Test agent logic]
        U3[Verify outputs]
    end

    subgraph "Integration Tests"
        I1[Use sandbox environment]
        I2[Real API calls]
        I3[Check trust scoring]
    end

    subgraph "E2E Tests"
        E1[Full workflow]
        E2[Multiple agents]
        E3[Escalation paths]
    end

    U1 --> U2 --> U3
    U3 --> I1 --> I2 --> I3
    I3 --> E1 --> E2 --> E3
```

### Common Patterns

```mermaid
flowchart TB
    subgraph "Pattern: Pre-check Trust"
        PC1[Get trust score]
        PC2{Score OK?}
        PC3[Proceed]
        PC4[Handle low trust]

        PC1 --> PC2
        PC2 -->|Yes| PC3
        PC2 -->|No| PC4
    end

    subgraph "Pattern: Graceful Degradation"
        GD1[Try high-trust action]
        GD2{Allowed?}
        GD3[Execute]
        GD4[Fallback to safer action]

        GD1 --> GD2
        GD2 -->|Yes| GD3
        GD2 -->|No| GD4
    end

    subgraph "Pattern: Trust Building"
        TB1[Start with safe actions]
        TB2[Accumulate positive events]
        TB3[Unlock more capabilities]

        TB1 --> TB2 --> TB3
        TB3 -.-> TB1
    end
```

### Debugging

```mermaid
flowchart TB
    subgraph "Debug Tools"
        D1["VORION_LOG_LEVEL=debug"]
        D2["cg.getLastRequest()"]
        D3["cg.getLastResponse()"]
        D4["Dashboard → Agent Logs"]
    end

    subgraph "Common Issues"
        C1["401: Check API key"]
        C2["403: Check trust score"]
        C3["400: Check manifest"]
        C4["429: Rate limited"]
    end

    subgraph "Solutions"
        S1[Rotate API key]
        S2[Build trust first]
        S3[Validate manifest]
        S4[Implement backoff]
    end

    C1 --> S1
    C2 --> S2
    C3 --> S3
    C4 --> S4
```

### SDK Reference Quick Look

```mermaid
classDiagram
    class Cognigate {
        +constructor(config)
        +runAgent(request) Promise~Result~
        +getScore(agentId) Promise~Score~
        +validateManifest(manifest) ValidationResult
        +submitEvents(events) Promise~void~
    }

    class Config {
        +apiKey string
        +environment string
        +timeout number
        +retries number
    }

    class Request {
        +agentId string
        +goal string
        +context object
        +constraints Constraints
    }

    class Result {
        +output any
        +proofHash string
        +trustScore Score
        +events Event[]
        +tokensUsed number
    }

    Cognigate --> Config
    Cognigate --> Request
    Cognigate --> Result
```

### Next Steps

```mermaid
flowchart LR
    subgraph "After Quickstart"
        N1[Read full docs]
        N2[Explore examples]
        N3[Join Discord]
        N4[Get certified]
    end

    subgraph "Resources"
        R1[docs.vorion.org]
        R2[github.com/vorion/examples]
        R3[discord.gg/vorion]
        R4[agentanchor.com/certify]
    end

    N1 --> R1
    N2 --> R2
    N3 --> R3
    N4 --> R4
```
