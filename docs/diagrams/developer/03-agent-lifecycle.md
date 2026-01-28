# Agent Lifecycle
## For: Developers, DevOps Engineers

### Agent States

```mermaid
stateDiagram-v2
    [*] --> Unregistered: Agent code created

    Unregistered --> Registering: Submit manifest
    Registering --> Registered: Validation passed
    Registering --> Invalid: Validation failed
    Invalid --> Registering: Fix and resubmit

    Registered --> Active: First execution
    Active --> Trusted: Score > 500
    Trusted --> Certified: Pass audit

    Active --> Suspended: Violation detected
    Trusted --> Suspended: Violation detected
    Certified --> Suspended: Violation detected

    Suspended --> UnderReview: Appeal submitted
    UnderReview --> Active: Appeal approved
    UnderReview --> Revoked: Appeal denied

    Certified --> Expired: Renewal missed
    Expired --> Active: Re-accumulate events

    Active --> Inactive: No activity 30+ days
    Inactive --> Active: New activity
    Inactive --> Archived: No activity 180+ days

    Revoked --> [*]
    Archived --> [*]
```

### Registration Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CLI as Vorion CLI
    participant Val as Validator
    participant AA as AgentAnchor
    participant DB as Registry DB

    Dev->>CLI: vorion register manifest.json
    CLI->>Val: Validate manifest

    Val->>Val: Check BASIS schema
    Val->>Val: Verify capabilities
    Val->>Val: Check dependencies

    alt Invalid Manifest
        Val-->>CLI: Errors
        CLI-->>Dev: Fix these issues
    end

    Val-->>CLI: Valid

    CLI->>AA: POST /registry
    AA->>DB: Create agent record
    DB-->>AA: agent_id generated
    AA->>AA: Generate API keys
    AA-->>CLI: Credentials

    CLI-->>Dev: agent_id + keys
```

### Deployment Strategies

```mermaid
flowchart TB
    subgraph "Blue-Green Deployment"
        BG1[Agent v1 (Blue)]
        BG2[Agent v2 (Green)]
        BG3{Traffic Switch}

        BG1 --> BG3
        BG2 --> BG3
        BG3 -->|Gradual| PROD[Production Traffic]
    end

    subgraph "Canary Deployment"
        C1[Agent v1<br/>95% traffic]
        C2[Agent v2<br/>5% traffic]
        C3[Monitor metrics]
        C4[Increase v2 traffic]

        C1 --> C3
        C2 --> C3
        C3 --> C4
    end

    subgraph "A/B Testing"
        AB1[Agent variant A]
        AB2[Agent variant B]
        AB3[Experiment config]
        AB4[Measure outcomes]

        AB1 --> AB3
        AB2 --> AB3
        AB3 --> AB4
    end
```

### Version Management

```mermaid
flowchart TB
    subgraph "Manifest Versioning"
        V1["v1.0.0: Initial release"]
        V2["v1.1.0: New capability"]
        V3["v2.0.0: Breaking change"]
    end

    subgraph "Trust Continuity"
        T1[Same agent_id]
        T2[Trust carries over]
        T3[New capabilities<br/>may need re-verification]
    end

    subgraph "Migration Path"
        M1[Register new version]
        M2[Gradual traffic shift]
        M3[Deprecate old version]
        M4[Archive after 90 days]
    end

    V1 --> V2 --> V3
    V2 --> T1 --> T2
    V3 --> T3
    V3 --> M1 --> M2 --> M3 --> M4
```

### Monitoring Dashboard Concept

```mermaid
flowchart TB
    subgraph "Agent Health"
        H1["Status: Active ✓"]
        H2["Trust Score: 742"]
        H3["Uptime: 99.9%"]
    end

    subgraph "Metrics"
        M1["Requests/min: 150"]
        M2["Avg latency: 230ms"]
        M3["Error rate: 0.1%"]
    end

    subgraph "Trust Trend"
        T1["7d: +12 points"]
        T2["30d: +45 points"]
        T3["90d: +120 points"]
    end

    subgraph "Recent Events"
        E1["10:42 - Execution success"]
        E2["10:41 - Execution success"]
        E3["10:40 - Trust updated"]
    end
```

### Alert Configuration

```mermaid
flowchart TB
    subgraph "Alert Types"
        A1[Trust score drop > 50]
        A2[Error rate > 5%]
        A3[Latency P99 > 1s]
        A4[Certification expiring]
        A5[Policy violation]
    end

    subgraph "Notification Channels"
        N1[Email]
        N2[Slack]
        N3[PagerDuty]
        N4[Webhook]
    end

    subgraph "Alert Rules"
        R1["IF trust_delta < -50 in 1h"]
        R2["THEN notify: critical"]
        R3["ESCALATE after: 15m"]
    end

    A1 --> R1 --> N1
    A1 --> R1 --> N2
    A5 --> N3
```

### Scaling Agents

```mermaid
flowchart TB
    subgraph "Horizontal Scaling"
        HS1[Multiple instances]
        HS2[Same agent_id]
        HS3[Shared trust score]
        HS4[Load balanced]
    end

    subgraph "Considerations"
        C1["Events aggregate correctly"]
        C2["Cache consistency"]
        C3["Rate limits shared"]
    end

    subgraph "Architecture"
        A1[Load Balancer]
        A2[Agent Instance 1]
        A3[Agent Instance 2]
        A4[Agent Instance N]
        A5[Shared Cache<br/>Redis]

        A1 --> A2
        A1 --> A3
        A1 --> A4
        A2 --> A5
        A3 --> A5
        A4 --> A5
    end

    HS1 --> A1
```

### Graceful Shutdown

```mermaid
sequenceDiagram
    participant K8s as Kubernetes
    participant Agent as Agent Instance
    participant CG as Cognigate SDK
    participant AA as AgentAnchor

    K8s->>Agent: SIGTERM

    Agent->>Agent: Stop accepting requests
    Agent->>CG: Drain in-flight requests

    loop Wait for completion
        CG->>CG: Check pending requests
    end

    CG->>AA: Flush event buffer
    AA-->>CG: Events accepted

    CG->>CG: Close connections
    Agent->>K8s: Exit 0
```

### Rollback Procedure

```mermaid
flowchart TB
    subgraph "Detect Issue"
        D1[Monitoring alert]
        D2[Trust score drop]
        D3[Error spike]
    end

    subgraph "Rollback Steps"
        R1[Stop new deployments]
        R2[Route traffic to v(n-1)]
        R3[Investigate issue]
        R4[Fix and redeploy]
    end

    subgraph "Trust Recovery"
        T1["Trust may be impacted"]
        T2["Positive events rebuild"]
        T3["Consider: separate agent_id for risky deploys"]
    end

    D1 --> R1
    D2 --> R1
    D3 --> R1
    R1 --> R2 --> R3 --> R4
    R2 --> T1 --> T2
```

### Agent Deprecation

```mermaid
timeline
    title Agent Deprecation Timeline

    section Active Phase
        Normal : Full operation
               : All features available

    section Deprecation Notice
        -30 days : Announce deprecation
                 : Recommend migration

    section Migration Period
        -30 to 0 : Support both versions
                 : Migration assistance

    section End of Life
        Day 0 : Stop new registrations
              : Existing continue (90d)

    section Sunset
        +90 days : Read-only mode
                 : Export data

    section Archive
        +180 days : Full decommission
                  : Data deleted
```

### Multi-Environment Setup

```mermaid
flowchart TB
    subgraph "Development"
        DEV1[Local agent]
        DEV2[sandbox.agentanchor.com]
        DEV3[Test data only]
    end

    subgraph "Staging"
        STG1[Staging agent]
        STG2[staging.agentanchor.com]
        STG3[Separate agent_id]
    end

    subgraph "Production"
        PRD1[Production agent]
        PRD2[agentanchor.com]
        PRD3[Real trust accumulation]
    end

    DEV1 --> DEV2
    STG1 --> STG2
    PRD1 --> PRD2

    DEV3 -.->|Promote| STG3
    STG3 -.->|Promote| PRD3
```
