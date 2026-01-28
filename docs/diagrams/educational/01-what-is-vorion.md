# What is Vorion?
## For: General Audience, New Users, Non-Technical Stakeholders

### Simple Explanation

Think of Vorion like a **credit score system for AI agents**.

Just like banks check your credit score before giving you a loan, Vorion checks an AI agent's "trust score" before letting it do important things.

```mermaid
flowchart LR
    subgraph "Real World Analogy"
        P1[Person] --> B1[Bank]
        B1 --> CS[Credit Score<br/>Check]
        CS --> L1[Loan<br/>Decision]
    end

    subgraph "AI World with Vorion"
        A1[AI Agent] --> V1[Vorion]
        V1 --> TS[Trust Score<br/>Check]
        TS --> D1[Action<br/>Decision]
    end

    style CS fill:#fff9c4
    style TS fill:#fff9c4
```

### The Five Parts of Vorion

```mermaid
flowchart TB
    subgraph "VORION ECOSYSTEM"
        BASIS["BASIS<br/>The Rulebook<br/>What makes a 'good' AI agent"]
        AA["AgentAnchor<br/>The Credit Bureau<br/>Tracks agent reputation"]
        KZ["Kaizen<br/>The Security Guard<br/>Watches agents at runtime"]
        CG["Cognigate<br/>The Efficiency Expert<br/>Makes everything fast"]
        AU["Aurais<br/>The App<br/>Where you use trusted agents"]
    end

    BASIS --> KZ
    AA <--> KZ
    KZ --> CG
    CG --> AU

    style BASIS fill:#e1f5fe
    style AA fill:#fff3e0
    style KZ fill:#f3e5f5
    style CG fill:#e8f5e9
    style AU fill:#fce4ec
```

### How Trust Works

```mermaid
flowchart TB
    subgraph "Building Trust"
        N[New Agent<br/>No History] --> |Does good work| L[Low Trust<br/>Limited Access]
        L --> |More good work| M[Medium Trust<br/>Normal Access]
        M --> |Proven track record| H[High Trust<br/>Full Access]
    end

    subgraph "Trust Levels"
        T0["Level 0: Sandbox<br/>Like a new employee<br/>on their first day"]
        T1["Level 1-2: Learning<br/>Like a junior employee<br/>needs supervision"]
        T2["Level 3-4: Trusted<br/>Like a senior employee<br/>works independently"]
        T3["Level 5: Autonomous<br/>Like a VP<br/>full authority"]
    end

    N --> T0
    L --> T1
    M --> T2
    H --> T3

    style T0 fill:#ffcdd2
    style T1 fill:#fff9c4
    style T2 fill:#c8e6c9
    style T3 fill:#bbdefb
```

### What Happens When You Use an AI Agent

```mermaid
flowchart TB
    subgraph "Step 1: Check ID"
        S1["Is this agent who<br/>it claims to be?"]
        S1 --> |Yes| S2
        S1 --> |No| STOP1[Blocked]
    end

    subgraph "Step 2: Check Trust"
        S2["What's the agent's<br/>trust score?"]
        S2 --> S3
    end

    subgraph "Step 3: Check Permission"
        S3["Is the agent allowed<br/>to do this action?"]
        S3 --> |Yes| S4
        S3 --> |No| STOP2[Needs Approval]
    end

    subgraph "Step 4: Do the Work"
        S4["Agent performs<br/>the action"]
        S4 --> S5
    end

    subgraph "Step 5: Keep Records"
        S5["Record what happened<br/>for the audit trail"]
    end

    style S1 fill:#e1f5fe
    style S2 fill:#fff3e0
    style S3 fill:#f3e5f5
    style S4 fill:#e8f5e9
    style S5 fill:#fce4ec
    style STOP1 fill:#ffcdd2
    style STOP2 fill:#fff9c4
```

### Real-World Examples

```mermaid
flowchart TB
    subgraph "Example 1: Customer Service Bot"
        E1A[Customer asks<br/>for refund] --> E1B[Bot checks<br/>its trust level]
        E1B --> |Trust OK| E1C[Bot processes<br/>small refund]
        E1B --> |Trust too low| E1D[Human agent<br/>reviews request]
    end

    subgraph "Example 2: Code Assistant"
        E2A[Developer asks<br/>for code help] --> E2B[Assistant checks<br/>what it can access]
        E2B --> |Public repos only| E2C[Helps with<br/>public code]
        E2B --> |Can access private| E2D[Helps with<br/>all code]
    end

    subgraph "Example 3: Data Analyst"
        E3A[Manager requests<br/>sales report] --> E3B[Agent checks<br/>data permissions]
        E3B --> |Aggregated only| E3C[Shows summary<br/>statistics]
        E3B --> |Full access| E3D[Shows detailed<br/>breakdown]
    end
```

### Why This Matters

```mermaid
mindmap
  root((Why<br/>Vorion?))
    Safety
      AI can't go rogue
      Actions are limited
      Humans stay in control
    Trust
      See agent history
      Know what it can do
      Verify its actions
    Compliance
      Audit trails
      Regulatory ready
      Clear accountability
    Efficiency
      Automate safely
      Less manual review
      Scale with confidence
```

### Aurais Product Tiers: Which One is Right for You?

```mermaid
flowchart TB
    Q1{How many<br/>agents?} --> |1-5| A1[Aurais Core<br/>Perfect for individuals]
    Q1 --> |5-50| Q2{Need custom<br/>workflows?}
    Q1 --> |50+| A3[Aurais Exec<br/>Enterprise solution]

    Q2 --> |No| A1
    Q2 --> |Yes| A2[Aurais Pro<br/>Great for teams]

    style A1 fill:#e8f5e9
    style A2 fill:#fff3e0
    style A3 fill:#e1f5fe
```

### The Trust Journey Analogy

```mermaid
flowchart LR
    subgraph "Like Building Trust with a New Employee"
        H1["Day 1<br/>Orientation<br/>(Sandbox)"] --> H2["Month 1<br/>Supervised work<br/>(Provisional)"]
        H2 --> H3["Month 3<br/>Working alone<br/>(Standard)"]
        H3 --> H4["Month 6<br/>Leading projects<br/>(Trusted)"]
        H4 --> H5["Year 1<br/>Team lead<br/>(Certified)"]
        H5 --> H6["Year 2+<br/>Department head<br/>(Autonomous)"]
    end

    subgraph "Trust Score"
        S1["0-99"]
        S2["100-299"]
        S3["300-499"]
        S4["500-699"]
        S5["700-899"]
        S6["900-1000"]
    end

    H1 --> S1
    H2 --> S2
    H3 --> S3
    H4 --> S4
    H5 --> S5
    H6 --> S6
```

### Quick Glossary

| Term | Simple Meaning |
|------|----------------|
| **BASIS** | The rulebook that defines what a "good" AI agent looks like |
| **AgentAnchor** | The system that tracks and certifies AI agents |
| **Kaizen** | The security layer that watches agents while they work |
| **Cognigate** | The runtime that makes everything fast and efficient |
| **Aurais** | The app you use to work with trusted AI agents |
| **Trust Score** | A number (0-1000) showing how reliable an agent is |
| **Certification** | Official verification that an agent meets quality standards |
| **Proof** | Cryptographic record proving what an agent did |
