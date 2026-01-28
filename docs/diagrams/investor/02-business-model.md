# Business Model Deep Dive
## For: Investors, Financial Analysts, Board

### Revenue Architecture

```mermaid
flowchart TB
    subgraph "Revenue Pillars"
        direction TB
        P1[SaaS Subscriptions<br/>Aurais Tiers]
        P2[Certification Revenue<br/>AgentAnchor]
        P3[Usage Revenue<br/>Cognigate API]
        P4[Enterprise Contracts<br/>Custom Solutions]
    end

    subgraph "Year 1 Mix"
        M1["SaaS: 60%"]
        M2["Cert: 15%"]
        M3["Usage: 15%"]
        M4["Enterprise: 10%"]
    end

    subgraph "Year 5 Mix (Target)"
        T1["SaaS: 40%"]
        T2["Cert: 20%"]
        T3["Usage: 25%"]
        T4["Enterprise: 15%"]
    end

    P1 --> M1 --> T1
    P2 --> M2 --> T2
    P3 --> M3 --> T3
    P4 --> M4 --> T4
```

### SaaS Pricing Tiers

```mermaid
flowchart LR
    subgraph "Aurais Core - $29/mo"
        C1[5 agents]
        C2[10K events/mo]
        C3[Basic trust]
        C4[Community support]
    end

    subgraph "Aurais Pro - $199/mo"
        P1[25 agents]
        P2[100K events/mo]
        P3[Advanced trust]
        P4[Priority support]
        P5[Custom workflows]
    end

    subgraph "Aurais Exec - Custom"
        E1[Unlimited agents]
        E2[Unlimited events]
        E3[Full platform]
        E4[Dedicated support]
        E5[SLA guarantees]
        E6[On-prem option]
    end

    C1 --> P1 --> E1
```

### Certification Revenue Model

```mermaid
flowchart TB
    subgraph "One-Time Fees"
        O1["Registration: Free"]
        O2["Verification: $0 (automated)"]
        O3["Certification: $500"]
        O4["Certified+: $2,500"]
    end

    subgraph "Recurring Fees"
        R1["Cert Renewal: $250/yr"]
        R2["Cert+ Renewal: $1,500/yr"]
        R3["Badge API: $50/mo"]
        R4["Compliance Reports: $100/mo"]
    end

    subgraph "Volume Discounts"
        V1["10+ agents: 15% off"]
        V2["50+ agents: 25% off"]
        V3["100+ agents: 35% off"]
    end
```

### Usage-Based Pricing (Cognigate)

```mermaid
flowchart TB
    subgraph "API Pricing"
        A1["Trust Score Query<br/>$0.001/call"]
        A2["Event Submission<br/>$0.0005/event"]
        A3["Proof Verification<br/>$0.002/call"]
        A4["Batch Operations<br/>$0.0003/item"]
    end

    subgraph "Volume Tiers"
        V1["0-100K calls: Base rate"]
        V2["100K-1M: 20% discount"]
        V3["1M-10M: 40% discount"]
        V4["10M+: Custom pricing"]
    end

    subgraph "Committed Use"
        CU1["Annual commitment: 30% off"]
        CU2["3-year commitment: 45% off"]
    end
```

### Customer Acquisition Funnel

```mermaid
flowchart TB
    subgraph "Awareness"
        AW1[Content Marketing]
        AW2[Developer Advocacy]
        AW3[Conference Presence]
        AW4[Open Source BASIS]
    end

    subgraph "Interest"
        IN1[Free Tier Signup]
        IN2[Documentation]
        IN3[Playground/Demo]
    end

    subgraph "Evaluation"
        EV1[POC/Trial]
        EV2[Technical Review]
        EV3[Security Assessment]
    end

    subgraph "Purchase"
        PU1[Self-Serve (Core)]
        PU2[Sales-Assisted (Pro)]
        PU3[Enterprise Deal (Exec)]
    end

    subgraph "Expansion"
        EX1[More Agents]
        EX2[Higher Tier]
        EX3[More Features]
    end

    AW1 --> IN1
    AW2 --> IN1
    AW3 --> IN2
    AW4 --> IN1

    IN1 --> EV1
    IN2 --> EV2
    IN3 --> EV1

    EV1 --> PU1
    EV2 --> PU2
    EV3 --> PU3

    PU1 --> EX1
    PU2 --> EX2
    PU3 --> EX3
```

### Cohort Analysis Model

```mermaid
xychart-beta
    title "Monthly Cohort Revenue Retention"
    x-axis ["M1", "M3", "M6", "M12", "M18", "M24"]
    y-axis "Net Revenue Retention %" 80 --> 140
    line [100, 105, 112, 125, 132, 138]
```

### Customer Segmentation

```mermaid
pie showData
    title "Target Customer Mix (Year 3)"
    "Enterprise (500+)" : 35
    "Mid-Market (100-499)" : 30
    "SMB (10-99)" : 25
    "Startups (<10)" : 10
```

### Sales Motion by Segment

```mermaid
flowchart LR
    subgraph "Self-Serve"
        SS1[Startups]
        SS2[Developers]
        SS3[Small Teams]
    end

    subgraph "Inside Sales"
        IS1[SMB]
        IS2[Mid-Market]
        IS3[Tech-Forward Enterprise]
    end

    subgraph "Field Sales"
        FS1[Large Enterprise]
        FS2[Regulated Industries]
        FS3[Government]
    end

    subgraph "Channel Partners"
        CP1[System Integrators]
        CP2[Consultancies]
        CP3[Cloud Providers]
    end

    SS1 --> |Upgrade| IS1
    IS1 --> |Upgrade| FS1
    CP1 --> FS1
    CP2 --> FS2
```

### Gross Margin Analysis

```mermaid
flowchart TB
    subgraph "Revenue: $100"
        REV[Gross Revenue]
    end

    subgraph "COGS: $20-25"
        COGS1["Infrastructure: $8-10"]
        COGS2["AI API Costs: $5-7"]
        COGS3["Support: $4-5"]
        COGS4["Payment Processing: $3"]
    end

    subgraph "Gross Profit: $75-80"
        GP["75-80% Gross Margin"]
    end

    REV --> COGS1
    REV --> COGS2
    REV --> COGS3
    REV --> COGS4
    COGS1 --> GP
    COGS2 --> GP
    COGS3 --> GP
    COGS4 --> GP

    style GP fill:#c8e6c9
```

### Path to Profitability

```mermaid
xychart-beta
    title "Path to Profitability"
    x-axis ["Y1", "Y2", "Y3", "Y4", "Y5"]
    y-axis "Operating Margin %" -80 --> 30
    bar [-70, -45, -15, 10, 25]
```

### Key SaaS Metrics Targets

| Metric | Year 1 | Year 3 | Year 5 |
|--------|--------|--------|--------|
| ARR | $3M | $35M | $100M |
| Customers | 500 | 3,000 | 8,000 |
| NRR | 110% | 125% | 135% |
| Gross Margin | 70% | 78% | 82% |
| CAC Payback | 18 mo | 12 mo | 9 mo |
| LTV:CAC | 4x | 8x | 12x |
| Magic Number | 0.6 | 0.9 | 1.2 |

### Expansion Revenue Drivers

```mermaid
mindmap
  root((Expansion<br/>Revenue))
    More Agents
      Team growth
      New use cases
      Acquisitions
    Higher Tiers
      Feature needs
      Scale requirements
      Compliance mandates
    More Seats
      Team expansion
      Cross-department
      Global rollout
    Add-ons
      Premium support
      Custom integrations
      Training
    Usage Growth
      API volume
      Event volume
      Storage
```

### Strategic Partnerships

```mermaid
flowchart TB
    subgraph "Cloud Providers"
        CP1[AWS Marketplace]
        CP2[Azure Partner]
        CP3[GCP Integration]
    end

    subgraph "AI Platforms"
        AI1[OpenAI]
        AI2[Anthropic]
        AI3[Cohere]
        AI4[Hugging Face]
    end

    subgraph "Enterprise Software"
        ES1[Salesforce AppExchange]
        ES2[ServiceNow]
        ES3[Workday]
    end

    subgraph "System Integrators"
        SI1[Accenture]
        SI2[Deloitte]
        SI3[KPMG]
    end

    CP1 --> REV[Revenue Share<br/>15-20%]
    AI1 --> REV
    ES1 --> REV
    SI1 --> REF[Referral Fees<br/>10-15%]
```
