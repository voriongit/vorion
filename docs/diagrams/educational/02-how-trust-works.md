# How Trust Works in Vorion
## For: General Audience, New Users, Training Materials

### Trust is Earned, Not Given

```mermaid
flowchart TB
    subgraph "The Trust Principle"
        NEW["New AI Agent<br/>Starts with low trust<br/>Like a new hire"]
        PROVE["Agent Does Work<br/>Good work = trust up<br/>Bad work = trust down"]
        EARN["Trust Level Changes<br/>Based on track record<br/>Not just promises"]
    end

    NEW --> PROVE --> EARN
    EARN -->|Continuous| PROVE

    style NEW fill:#fff9c4
    style PROVE fill:#e8f5e9
    style EARN fill:#bbdefb
```

### The Six Trust Levels

```mermaid
flowchart TB
    subgraph "Level 0: SANDBOX (0-99 points)"
        L0["Testing environment only<br/>Cannot affect real data<br/>Every action requires approval"]
    end

    subgraph "Level 1: PROVISIONAL (100-299 points)"
        L1["Can read public data<br/>Internal messages only<br/>Closely monitored"]
    end

    subgraph "Level 2: STANDARD (300-499 points)"
        L2["Normal operations<br/>Limited external communication<br/>Standard monitoring"]
    end

    subgraph "Level 3: TRUSTED (500-699 points)"
        L3["External API calls allowed<br/>Can send emails/messages<br/>Periodic review"]
    end

    subgraph "Level 4: CERTIFIED (700-899 points)"
        L4["Financial transactions OK<br/>Sensitive data access<br/>Exception-based alerts"]
    end

    subgraph "Level 5: AUTONOMOUS (900-1000 points)"
        L5["Full autonomy within policy<br/>Minimal human oversight<br/>Self-managing"]
    end

    L0 --> L1 --> L2 --> L3 --> L4 --> L5

    style L0 fill:#ffcdd2
    style L1 fill:#ffe0b2
    style L2 fill:#fff9c4
    style L3 fill:#c8e6c9
    style L4 fill:#b2dfdb
    style L5 fill:#bbdefb
```

### What Affects Trust Score?

```mermaid
mindmap
  root((Trust<br/>Score))
    Behavioral (40%)
      Task completion rate
      Error frequency
      Response quality
      Policy compliance
    Compliance (25%)
      Rule adherence
      Audit performance
      Violation history
      Documentation
    Identity (20%)
      Verification level
      Credential strength
      Provider reputation
      Manifest validity
    Context (15%)
      Deployment environment
      Access scope
      Integration points
      Security posture
```

### How Trust Goes Up

```mermaid
flowchart LR
    subgraph "Positive Signals"
        P1["Complete task<br/>successfully"] --> UP1["+5 to +20 points"]
        P2["Pass compliance<br/>check"] --> UP2["+10 to +30 points"]
        P3["Get certified"] --> UP3["+50 to +100 points"]
        P4["Long track record<br/>no issues"] --> UP4["+5 to +15 points/month"]
    end

    style UP1 fill:#c8e6c9
    style UP2 fill:#c8e6c9
    style UP3 fill:#c8e6c9
    style UP4 fill:#c8e6c9
```

### How Trust Goes Down

```mermaid
flowchart LR
    subgraph "Negative Signals"
        N1["Task failure"] --> DOWN1["-10 to -30 points"]
        N2["Policy violation"] --> DOWN2["-50 to -100 points"]
        N3["Security incident"] --> DOWN3["-100 to -500 points"]
        N4["Inactivity<br/>(182-day decay)"] --> DOWN4["Score decays 50%"]
    end

    style DOWN1 fill:#ffcdd2
    style DOWN2 fill:#ffcdd2
    style DOWN3 fill:#ffcdd2
    style DOWN4 fill:#fff9c4
```

### Trust Decay: Use It or Lose It

```mermaid
xychart-beta
    title "Trust Score Decay When Inactive"
    x-axis "Days Since Last Activity" [0, 30, 60, 90, 120, 150, 182]
    y-axis "Score Retained %" 0 --> 100
    bar [100, 90, 75, 62, 55, 52, 50]
```

```mermaid
flowchart TB
    subgraph "Why Trust Decays"
        R1["Technology changes<br/>Agent may be outdated"]
        R2["Context changes<br/>Policies may have evolved"]
        R3["Freshness matters<br/>Recent proof is better"]
    end

    subgraph "How to Prevent Decay"
        P1["Keep agent active<br/>Regular usage resets clock"]
        P2["Periodic verification<br/>Re-certify annually"]
        P3["Continuous monitoring<br/>Maintain good behavior"]
    end

    R1 --> P1
    R2 --> P2
    R3 --> P3
```

### Trust Gates: What Each Level Can Do

```mermaid
flowchart TB
    subgraph "Level 0-1: Restricted"
        G1["Read public data only"]
        G2["No external communication"]
        G3["Every action logged"]
    end

    subgraph "Level 2-3: Standard"
        G4["Read/write internal data"]
        G5["Limited external APIs"]
        G6["Automated logging"]
    end

    subgraph "Level 4-5: Full Access"
        G7["All data access"]
        G8["Financial transactions"]
        G9["Exception-only alerts"]
    end

    LOW[Low Trust Agent] --> G1
    LOW --> G2
    LOW --> G3

    MED[Medium Trust Agent] --> G4
    MED --> G5
    MED --> G6

    HIGH[High Trust Agent] --> G7
    HIGH --> G8
    HIGH --> G9

    style LOW fill:#ffcdd2
    style MED fill:#fff9c4
    style HIGH fill:#c8e6c9
```

### Example: Customer Service Bot Trust Journey

```mermaid
timeline
    title "Trust Journey of a Customer Service Bot"

    section Week 1
        Day 1 : Deployed in sandbox (Score: 50)
        Day 3 : Passed initial tests (Score: 150)
        Day 7 : First real customer handled (Score: 200)

    section Month 1
        Week 2 : 100 conversations, 95% success (Score: 350)
        Week 3 : Compliance audit passed (Score: 420)
        Week 4 : No escalations needed (Score: 480)

    section Month 2-3
        Month 2 : Handling complex queries (Score: 580)
        Month 3 : Certified for refunds <$50 (Score: 720)

    section Month 6+
        Month 6 : Full certification achieved (Score: 850)
        Year 1 : Autonomous operation (Score: 920)
```

### What Happens at Each Decision Point

```mermaid
stateDiagram-v2
    [*] --> Request: Agent wants to do something

    Request --> TrustCheck: Check trust score

    TrustCheck --> Allowed: Score >= Required
    TrustCheck --> Denied: Score < Required

    Allowed --> Execute: Run the action
    Denied --> Escalate: Ask human

    Execute --> Record: Log what happened
    Escalate --> HumanDecision: Human reviews

    HumanDecision --> Execute: Approved
    HumanDecision --> Blocked: Rejected

    Record --> UpdateScore: Adjust trust
    Blocked --> UpdateScore: Lower trust

    UpdateScore --> [*]: Done
```

### Key Takeaways

| Concept | What It Means |
|---------|---------------|
| **Trust is earned** | Agents prove themselves through good behavior |
| **Trust is dynamic** | Scores change based on performance |
| **Trust decays** | Inactive agents lose trust over time |
| **Trust gates access** | Higher trust = more capabilities |
| **Trust is verifiable** | Every action is recorded and provable |
