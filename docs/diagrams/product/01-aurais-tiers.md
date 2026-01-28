# Aurais Product Tiers
## For: Sales, Marketing, Product Teams, Customers

### Product Line Overview

```mermaid
flowchart TB
    subgraph "AURAIS PRODUCT LINE"
        subgraph "Aurais Core"
            AC_T["Individual / SMB"]
            AC_P["Starting at $29/mo"]
            AC_F["Trust-verified agents<br/>Standard workflows<br/>Basic memory"]
        end

        subgraph "Aurais Pro"
            AP_T["Professional / Teams"]
            AP_P["Starting at $149/mo"]
            AP_F["Multi-agent orchestration<br/>Custom workflows<br/>Advanced memory"]
        end

        subgraph "Aurais Exec"
            AE_T["Enterprise"]
            AE_P["Custom pricing"]
            AE_F["Fleet management<br/>Custom policies<br/>Compliance reporting"]
        end
    end

    style AC_T fill:#e8f5e9
    style AP_T fill:#fff3e0
    style AE_T fill:#e1f5fe
```

### Feature Comparison

```mermaid
flowchart LR
    subgraph "CORE"
        C1["5 agents max"]
        C2["Standard trust tiers"]
        C3["Basic workflows"]
        C4["Email support"]
        C5["Community forum"]
    end

    subgraph "PRO"
        P1["50 agents max"]
        P2["Custom trust policies"]
        P3["Workflow builder"]
        P4["Priority support"]
        P5["API access"]
        P6["Team management"]
    end

    subgraph "EXEC"
        E1["Unlimited agents"]
        E2["Policy editor"]
        E3["Fleet orchestration"]
        E4["Dedicated support"]
        E5["Full API + webhooks"]
        E6["SSO / SAML"]
        E7["Compliance reports"]
        E8["Custom SLA"]
    end

    C1 --> P1 --> E1
    C2 --> P2 --> E2
    C3 --> P3 --> E3
    C4 --> P4 --> E4
    C5 --> P5 --> E5
```

### Backend Access by Tier

```mermaid
flowchart TB
    subgraph "AgentAnchor Access"
        AA_C["CORE: Query only<br/>Trust lookups"]
        AA_P["PRO: Query + Submit<br/>Event submission"]
        AA_E["EXEC: Full API<br/>+ Webhooks<br/>+ Cert management"]
    end

    subgraph "Kaizen Access"
        KZ_C["CORE: Basic logging<br/>Standard enforcement"]
        KZ_P["PRO: Full layers<br/>Custom policies"]
        KZ_E["EXEC: Policy editor<br/>Custom rules"]
    end

    subgraph "Cognigate Access"
        CG_C["CORE: Not included"]
        CG_P["PRO: Lite edition<br/>Token optimization"]
        CG_E["EXEC: Full + Dedicated<br/>Active memory"]
    end

    style AA_C fill:#e8f5e9
    style AA_P fill:#fff3e0
    style AA_E fill:#e1f5fe
    style KZ_C fill:#e8f5e9
    style KZ_P fill:#fff3e0
    style KZ_E fill:#e1f5fe
    style CG_C fill:#ffcdd2
    style CG_P fill:#fff3e0
    style CG_E fill:#e1f5fe
```

### Pricing Structure

```mermaid
graph TB
    subgraph "Aurais Core"
        C_BASE["Base: $29/mo"]
        C_AGENT["+ $5/agent/mo"]
        C_MAX["Max: 5 agents"]
        C_TOTAL["Total: $29-$54/mo"]
    end

    subgraph "Aurais Pro"
        P_BASE["Base: $149/mo"]
        P_SEAT["+ $25/seat/mo"]
        P_AGENT["+ $3/agent/mo"]
        P_MAX["Max: 50 agents, 20 seats"]
        P_TOTAL["Total: $149-$799/mo"]
    end

    subgraph "Aurais Exec"
        E_BASE["Custom base"]
        E_VOLUME["Volume discounts"]
        E_SUPPORT["Dedicated support"]
        E_CUSTOM["Custom SLA"]
        E_TOTAL["Contact sales"]
    end
```

### User Journey: Core to Pro

```mermaid
journey
    title Upgrade Journey: Core to Pro
    section Using Core
      Sign up for Core: 5: User
      Deploy first agent: 5: User
      Hit 5 agent limit: 3: User
    section Evaluating Pro
      Request Pro trial: 4: User
      Test multi-agent: 5: User
      Build custom workflow: 5: User
    section Upgrading
      Purchase Pro: 5: User
      Migrate agents: 4: User
      Add team members: 5: Team
    section Growing
      Scale to 30 agents: 5: Team
      Consider Exec: 4: Team
```

### User Journey: Pro to Exec

```mermaid
journey
    title Upgrade Journey: Pro to Exec
    section Using Pro
      Team at 15 agents: 5: Team
      Compliance audit coming: 3: Manager
      Need custom policies: 3: Manager
    section Evaluating Exec
      Contact sales: 4: Manager
      Demo compliance features: 5: Manager
      Security review: 4: Security
    section Enterprise Onboarding
      Contract negotiation: 4: Procurement
      SSO integration: 4: IT
      Policy configuration: 5: Admin
    section Operating
      Fleet management: 5: Team
      Compliance reporting: 5: Compliance
      Executive dashboards: 5: C-Level
```

### Feature Matrix

| Feature | Core | Pro | Exec |
|---------|:----:|:---:|:----:|
| **Agents** | 5 | 50 | Unlimited |
| **Users** | 1 | 20 | Unlimited |
| **Trust Queries** | 1K/mo | 50K/mo | Unlimited |
| **Event Submission** | - | 10K/mo | Unlimited |
| **Workflows** | Standard | Custom | Custom + Templates |
| **Memory** | Basic | Advanced | Enterprise |
| **API Access** | - | REST | REST + GraphQL |
| **Webhooks** | - | - | Full |
| **SSO/SAML** | - | - | Yes |
| **Policy Editor** | - | - | Yes |
| **Compliance Reports** | - | - | Yes |
| **SLA** | Best effort | 99.5% | Custom (99.9%+) |
| **Support** | Community | Priority | Dedicated |
| **Onboarding** | Self-serve | Guided | White-glove |

### Target Customer Profiles

```mermaid
mindmap
  root((Aurais<br/>Customers))
    Core
      Solo developers
      Freelancers
      Small businesses
      Hobbyists
      Students
    Pro
      Development teams
      Agencies
      Startups
      Mid-size companies
      Consultants
    Exec
      Fortune 500
      Regulated industries
      Government
      Healthcare
      Financial services
```

### Integration Capabilities by Tier

```mermaid
flowchart TB
    subgraph "Core Integrations"
        CI1[Slack notifications]
        CI2[Email alerts]
        CI3[Basic API]
    end

    subgraph "Pro Integrations"
        PI1[All Core +]
        PI2[Zapier]
        PI3[Custom webhooks]
        PI4[GitHub Actions]
        PI5[Jira]
    end

    subgraph "Exec Integrations"
        EI1[All Pro +]
        EI2[SSO/SAML]
        EI3[SIEM integration]
        EI4[ServiceNow]
        EI5[Salesforce]
        EI6[Custom connectors]
    end

    CI1 --> PI1
    PI1 --> EI1
```

### Upgrade Triggers

```mermaid
flowchart TB
    subgraph "Core → Pro"
        T1["Need >5 agents"]
        T2["Team collaboration required"]
        T3["Custom workflows needed"]
        T4["API access required"]
    end

    subgraph "Pro → Exec"
        T5["Need >50 agents"]
        T6["Compliance requirements"]
        T7["Custom policies"]
        T8["Enterprise SSO"]
        T9["Dedicated support"]
    end

    T1 --> UPGRADE1[Upgrade to Pro]
    T2 --> UPGRADE1
    T3 --> UPGRADE1
    T4 --> UPGRADE1

    T5 --> UPGRADE2[Upgrade to Exec]
    T6 --> UPGRADE2
    T7 --> UPGRADE2
    T8 --> UPGRADE2
    T9 --> UPGRADE2
```

### Value Calculator

```mermaid
flowchart LR
    subgraph "Inputs"
        I1["Number of agents"]
        I2["Team size"]
        I3["Compliance needs"]
        I4["Support level"]
    end

    subgraph "Calculation"
        CALC["Value Calculator"]
    end

    subgraph "Recommendation"
        R1["Core<br/>Simple, affordable"]
        R2["Pro<br/>Team productivity"]
        R3["Exec<br/>Enterprise ready"]
    end

    I1 --> CALC
    I2 --> CALC
    I3 --> CALC
    I4 --> CALC

    CALC --> |"≤5 agents, solo"| R1
    CALC --> |"6-50 agents, team"| R2
    CALC --> |"50+ or compliance"| R3
```
