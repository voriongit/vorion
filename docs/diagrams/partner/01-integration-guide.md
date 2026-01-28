# Partner Integration Guide
## For: System Integrators, ISVs, Technology Partners

### Partner Types

```mermaid
flowchart TB
    subgraph "Technology Partners"
        TP1[AI Platform Providers<br/>OpenAI, Anthropic, etc.]
        TP2[Cloud Providers<br/>AWS, Azure, GCP]
        TP3[Agent Frameworks<br/>LangChain, AutoGPT, etc.]
    end

    subgraph "Solution Partners"
        SP1[System Integrators<br/>Accenture, Deloitte]
        SP2[Consultancies<br/>AI/ML specialists]
        SP3[ISVs<br/>Vertical solutions]
    end

    subgraph "Reseller Partners"
        RP1[VARs]
        RP2[Distributors]
        RP3[Regional Partners]
    end

    subgraph "Integration Points"
        IP1[Cognigate SDK]
        IP2[AgentAnchor API]
        IP3[Aurais White-label]
    end

    TP1 --> IP1
    TP2 --> IP1
    TP3 --> IP1
    SP1 --> IP2
    SP2 --> IP2
    SP3 --> IP3
    RP1 --> IP3
```

### Integration Architecture Options

```mermaid
flowchart TB
    subgraph "Option 1: SDK Integration"
        SDK1[Your Application]
        SDK2[Cognigate SDK]
        SDK3[Vorion Backend]

        SDK1 --> SDK2 --> SDK3
    end

    subgraph "Option 2: API Integration"
        API1[Your Application]
        API2[REST/GraphQL APIs]
        API3[AgentAnchor + Kaizen]

        API1 --> API2 --> API3
    end

    subgraph "Option 3: Webhook Integration"
        WH1[Your Application]
        WH2[Webhook Receiver]
        WH3[Event-Driven Updates]

        WH3 --> WH2 --> WH1
    end

    subgraph "Option 4: White-Label"
        WL1[Your Brand]
        WL2[Aurais Backend]
        WL3[Custom Domain]

        WL1 --> WL2
        WL3 --> WL2
    end
```

### SDK Integration Flow

```mermaid
sequenceDiagram
    participant App as Partner App
    participant SDK as Cognigate SDK
    participant Cache as Local Cache
    participant AA as AgentAnchor
    participant KZ as Kaizen

    Note over App,KZ: Initialization

    App->>SDK: cognigate.init(config)
    SDK->>AA: Validate API key
    AA-->>SDK: Tenant info + config
    SDK->>Cache: Cache policies
    SDK-->>App: Ready

    Note over App,KZ: Agent Execution

    App->>SDK: runAgent(request)
    SDK->>Cache: Check trust score

    alt Score cached & fresh
        Cache-->>SDK: Cached score
    else Score stale
        SDK->>AA: GET /trust/:id
        AA-->>SDK: Fresh score
        SDK->>Cache: Update cache
    end

    SDK->>KZ: Execute through layers
    KZ-->>SDK: Result + proof
    SDK->>AA: POST /events (async)
    SDK-->>App: Response
```

### API Integration Patterns

```mermaid
flowchart TB
    subgraph "Pattern 1: Pre-flight Check"
        PF1[Before agent action]
        PF2[Query trust score]
        PF3[Decision: proceed?]
        PF4[Execute or deny]

        PF1 --> PF2 --> PF3 --> PF4
    end

    subgraph "Pattern 2: Post-execution Logging"
        PE1[Agent executes]
        PE2[Capture result]
        PE3[Submit events]
        PE4[Update score]

        PE1 --> PE2 --> PE3 --> PE4
    end

    subgraph "Pattern 3: Continuous Monitoring"
        CM1[Subscribe to webhooks]
        CM2[Receive trust changes]
        CM3[Adjust agent behavior]
        CM4[Real-time governance]

        CM1 --> CM2 --> CM3 --> CM4
    end
```

### Webhook Event Integration

```mermaid
sequenceDiagram
    participant AA as AgentAnchor
    participant WH as Your Webhook Endpoint
    participant App as Your Application
    participant Agent as Your Agent

    Note over AA,Agent: Subscribe to Events

    App->>AA: POST /webhooks/subscribe
    Note right of App: {
    Note right of App:   "url": "https://you.com/hook",
    Note right of App:   "events": ["trust.*", "cert.*"],
    Note right of App:   "secret": "hmac_secret"
    Note right of App: }
    AA-->>App: Subscription confirmed

    Note over AA,Agent: Event Delivery

    AA->>WH: POST (trust.score_changed)
    Note right of AA: Headers:
    Note right of AA: X-Signature: hmac...
    Note right of AA: X-Event-Type: trust.score_changed

    WH->>WH: Verify HMAC signature
    WH->>App: Process event
    App->>Agent: Adjust permissions
    WH-->>AA: 200 OK
```

### White-Label Configuration

```mermaid
flowchart TB
    subgraph "Your Branding"
        B1[Logo]
        B2[Colors]
        B3[Domain]
        B4[Email Templates]
    end

    subgraph "Vorion Backend"
        V1[Aurais Platform]
        V2[AgentAnchor]
        V3[Cognigate]
    end

    subgraph "Your Customer Experience"
        C1[yourbrand.com/agents]
        C2[trust.yourbrand.com]
        C3[Your support]
    end

    B1 --> V1
    B2 --> V1
    B3 --> C1
    B4 --> V1

    V1 --> C1
    V2 --> C2
```

### Partner Revenue Share

```mermaid
flowchart LR
    subgraph "Referral Partner"
        REF1["10-15% of first year"]
        REF2["5% ongoing"]
    end

    subgraph "Reseller Partner"
        RES1["20-30% margin"]
        RES2["Volume bonuses"]
    end

    subgraph "Technology Partner"
        TECH1["Co-marketing funds"]
        TECH2["Integration bounties"]
    end

    subgraph "White-Label Partner"
        WL1["50-60% margin"]
        WL2["Your pricing"]
    end
```

### Integration Certification

```mermaid
stateDiagram-v2
    [*] --> Registered: Sign partner agreement

    Registered --> Development: Access sandbox
    Development --> Testing: Build integration

    Testing --> Review: Submit for review
    Review --> Certified: Pass certification
    Review --> Development: Issues found

    Certified --> Listed: Published in marketplace
    Listed --> Featured: High performance
    Featured --> Premier: Strategic partnership

    Certified --> Recertification: Annual review
    Recertification --> Certified: Pass
    Recertification --> Suspended: Fail
```

### Sandbox Environment

```mermaid
flowchart TB
    subgraph "Sandbox Features"
        S1[Full API access]
        S2[Test agents]
        S3[Simulated events]
        S4[Mock trust scores]
    end

    subgraph "Sandbox Limits"
        L1[100 agents max]
        L2[10K events/day]
        L3[No production data]
        L4[Reset weekly]
    end

    subgraph "Endpoints"
        E1["sandbox.agentanchor.com"]
        E2["sandbox-api.cognigate.dev"]
    end

    S1 --> E1
    S2 --> E1
    S3 --> E2
    S4 --> E2
```

### Security Requirements

```mermaid
mindmap
  root((Partner<br/>Security))
    Authentication
      API key rotation
      JWT tokens
      OAuth 2.0
      mTLS option
    Data Handling
      Encryption in transit
      No PII storage
      Data residency
      Retention policies
    Compliance
      SOC 2 recommended
      GDPR compliant
      Security review
      Penetration testing
    Monitoring
      Audit logging
      Anomaly detection
      Incident response
      SLA tracking
```

### Support Tiers for Partners

```mermaid
flowchart TB
    subgraph "Registered Partner"
        RP1[Documentation access]
        RP2[Community forum]
        RP3[Email support (72h)]
    end

    subgraph "Certified Partner"
        CP1[All Registered +]
        CP2[Slack channel]
        CP3[Email support (24h)]
        CP4[Quarterly sync]
    end

    subgraph "Premier Partner"
        PP1[All Certified +]
        PP2[Dedicated SE]
        PP3[Priority support (4h)]
        PP4[Monthly sync]
        PP5[Roadmap input]
    end

    RP1 --> CP1 --> PP1
```

### Co-Marketing Opportunities

```mermaid
flowchart LR
    subgraph "Joint Activities"
        J1[Case studies]
        J2[Webinars]
        J3[Blog posts]
        J4[Conference booths]
    end

    subgraph "Listing Benefits"
        L1[Partner directory]
        L2[Integration showcase]
        L3[Customer referrals]
    end

    subgraph "MDF (Premier)"
        M1[Marketing funds]
        M2[Event sponsorship]
        M3[Content creation]
    end

    J1 --> L1
    J2 --> L2
    J3 --> L3
    L1 --> M1
```

### Getting Started Checklist

```mermaid
flowchart TB
    subgraph "Week 1"
        W1_1[Sign partner agreement]
        W1_2[Get sandbox access]
        W1_3[Review documentation]
    end

    subgraph "Week 2-3"
        W2_1[Build initial integration]
        W2_2[Test in sandbox]
        W2_3[Attend partner training]
    end

    subgraph "Week 4"
        W4_1[Submit for certification]
        W4_2[Address review feedback]
        W4_3[Go live!]
    end

    W1_1 --> W1_2 --> W1_3
    W1_3 --> W2_1 --> W2_2 --> W2_3
    W2_3 --> W4_1 --> W4_2 --> W4_3

    style W4_3 fill:#c8e6c9
```
