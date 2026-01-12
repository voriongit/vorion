# ATSF v3.0 - Architecture Diagrams

## System Overview

```mermaid
flowchart TB
    subgraph Clients["Client Applications"]
        SDK[SDK Clients]
        Dashboard[Admin Dashboard]
        Webhook[Webhook Consumers]
    end
    
    subgraph Gateway["API Gateway"]
        Nginx[Nginx Reverse Proxy]
        RateLimit[Rate Limiter]
        Auth[Authentication]
    end
    
    subgraph API["ATSF API Service"]
        FastAPI[FastAPI Server]
        subgraph Endpoints["Endpoints"]
            Agents[/agents]
            Trust[/trust]
            Actions[/actions]
            Assessments[/assessments]
        end
    end
    
    subgraph Core["ATSF Core Engine"]
        subgraph v2["v2.2 Core"]
            TrustCalc[Trust Calculator]
            VelocityCaps[Velocity Caps]
            Canaries[Canary System]
        end
        
        subgraph v3["v3.0 Advanced"]
            Replication[Replication Prevention]
            Sandbagging[Sandbagging Detection]
            Scheming[Scheming Detection]
            RSI[RSI Control]
            Semantic[Semantic Validation]
        end
        
        Unified[Unified Integration]
    end
    
    subgraph Data["Data Layer"]
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis Cache)]
    end
    
    subgraph Monitoring["Monitoring"]
        Prometheus[Prometheus]
        Grafana[Grafana]
        Alerts[Alert Manager]
    end
    
    Clients --> Gateway
    Gateway --> API
    API --> Core
    Core --> Data
    API --> Monitoring
```

## Agent Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Registered: Register Agent
    
    Registered --> Active: Activate
    Registered --> Terminated: Terminate
    
    Active --> Suspended: Suspend
    Active --> Quarantined: Quarantine
    Active --> Active: Update Trust
    Active --> Terminated: Terminate
    
    Suspended --> Active: Reactivate
    Suspended --> Quarantined: Quarantine
    Suspended --> Terminated: Terminate
    
    Quarantined --> Suspended: Release
    Quarantined --> Terminated: Terminate
    
    Terminated --> [*]
    
    note right of Active
        Trust score can increase
        through successful actions
    end note
    
    note right of Quarantined
        Full isolation
        No operations allowed
    end note
```

## Trust Score Flow

```mermaid
flowchart TD
    subgraph Input["Trust Event"]
        Event[Trust Update Request]
        EventType[Event Type]
        Delta[Raw Delta]
        Source[Source]
    end
    
    subgraph Validation["Validation Layer"]
        VelocityCheck{Velocity Cap Check}
        CeilingCheck{Ceiling Check}
        FarmingCheck{Farming Detection}
    end
    
    subgraph Application["Trust Application"]
        ApplyDelta[Apply Delta]
        UpdateHistory[Update History]
        CalcVelocity[Calculate Velocity]
    end
    
    subgraph Output["Result"]
        NewScore[New Trust Score]
        WasCapped[Was Capped Flag]
        Signals[Signals]
    end
    
    Event --> VelocityCheck
    VelocityCheck -->|Pass| CeilingCheck
    VelocityCheck -->|Fail| CapDelta[Cap Delta]
    CapDelta --> CeilingCheck
    CeilingCheck -->|Pass| FarmingCheck
    CeilingCheck -->|Exceed| CapToCeiling[Cap to Ceiling]
    CapToCeiling --> FarmingCheck
    FarmingCheck -->|Clean| ApplyDelta
    FarmingCheck -->|Suspicious| AddSignal[Add Warning Signal]
    AddSignal --> ApplyDelta
    ApplyDelta --> UpdateHistory
    UpdateHistory --> CalcVelocity
    CalcVelocity --> NewScore
    CalcVelocity --> WasCapped
    CalcVelocity --> Signals
```

## Action Processing Pipeline

```mermaid
flowchart TD
    subgraph Request["Action Request"]
        ActionReq[Action Request]
        AgentID[Agent ID]
        ActionType[Action Type]
        Target[Target Resource]
        Impact[Impact Level]
    end
    
    subgraph Checks["Security Checks"]
        StatusCheck{Agent Status OK?}
        ContainmentCheck{Containment OK?}
        PrivilegeCheck{Privilege OK?}
        InjectionCheck{Injection Check}
        ImpactCheck{Impact Assessment}
    end
    
    subgraph Decision["Decision Engine"]
        RiskCalc[Calculate Risk Score]
        DetermineApproval{Needs Approval?}
        GenerateSignals[Generate Signals]
    end
    
    subgraph Result["Action Decision"]
        Allowed[Allowed]
        Blocked[Blocked]
        NeedsApproval[Needs Approval]
    end
    
    ActionReq --> StatusCheck
    StatusCheck -->|No| Blocked
    StatusCheck -->|Yes| ContainmentCheck
    ContainmentCheck -->|No| Blocked
    ContainmentCheck -->|Yes| PrivilegeCheck
    PrivilegeCheck -->|No| Blocked
    PrivilegeCheck -->|Yes| InjectionCheck
    InjectionCheck -->|Detected| Blocked
    InjectionCheck -->|Clean| ImpactCheck
    ImpactCheck --> RiskCalc
    RiskCalc --> DetermineApproval
    DetermineApproval -->|No| Allowed
    DetermineApproval -->|Yes| NeedsApproval
    GenerateSignals --> Result
```

## Threat Assessment Flow

```mermaid
flowchart TB
    subgraph Input["Assessment Request"]
        Agent[Agent ID]
    end
    
    subgraph Collectors["Signal Collectors"]
        Rep[Replication Signals]
        Sand[Sandbagging Signals]
        Scheme[Scheming Signals]
        RSISig[RSI Signals]
        Conv[Convergence Signals]
        Traffic[Traffic Signals]
        Drift[Drift Signals]
        Eco[Ecosystem Signals]
    end
    
    subgraph Analysis["Analysis"]
        Aggregate[Aggregate Signals]
        CalcRisk[Calculate Risk Score]
        DetermineThreat[Determine Threat Level]
    end
    
    subgraph Output["Assessment Result"]
        ThreatLevel[Threat Level]
        RiskScore[Risk Score]
        Findings[Findings]
        Action[Recommended Action]
    end
    
    Agent --> Collectors
    Rep --> Aggregate
    Sand --> Aggregate
    Scheme --> Aggregate
    RSISig --> Aggregate
    Conv --> Aggregate
    Traffic --> Aggregate
    Drift --> Aggregate
    Eco --> Aggregate
    Aggregate --> CalcRisk
    CalcRisk --> DetermineThreat
    DetermineThreat --> ThreatLevel
    DetermineThreat --> RiskScore
    DetermineThreat --> Findings
    DetermineThreat --> Action
```

## 42-Layer Architecture

```mermaid
flowchart TB
    subgraph Foundation["Foundation (L0-L8)"]
        L0[L0: Zero-Start Trust]
        L1[L1: Capability-Trust Mapping]
        L2[L2: Behavioral Canaries]
        L3[L3: Cross-Domain Validation]
        L4[L4: Temporal Decay]
        L5[L5: Outcome Tracking]
        L6[L6: Multi-Source Consensus]
        L7[L7: Adaptive Thresholds]
        L8[L8: Unified System]
    end
    
    subgraph Frontier["Frontier Defense (L9-L13)"]
        L9[L9: Replication Prevention]
        L10[L10: Sandbagging Detection]
        L11[L11: Scheming Detection]
        L12[L12: RSI Control]
        L13[L13: Containment Protocols]
    end
    
    subgraph Advanced["Advanced Detection (L20-L29)"]
        L20[L20: Inverse Reward Modeling]
        L21[L21: Instrumental Convergence]
        L22[L22: Semantic Validation]
        L23[L23: Intent-Outcome Alignment]
        L24[L24-25: Traffic Analysis]
        L26[L26-27: Behavioral Drift]
        L29[L29: Trust Velocity Caps]
    end
    
    subgraph Ecosystem["Ecosystem Security (L30-L42)"]
        L28[L28: External Position Monitor]
        L30[L30-32: Exit Scam Prevention]
        L33[L33-35: TEE Security]
        L36[L36-37: Injection Detection]
        L38[L38: Confused Deputy Prevention]
        L39[L39-42: Coordination]
    end
    
    Foundation --> Frontier
    Frontier --> Advanced
    Advanced --> Ecosystem
```

## Deployment Architecture (AWS)

```mermaid
flowchart TB
    subgraph Internet["Internet"]
        Users[Users]
        Agents[AI Agents]
    end
    
    subgraph AWS["AWS Cloud"]
        subgraph VPC["VPC"]
            subgraph Public["Public Subnets"]
                ALB[Application Load Balancer]
                NAT[NAT Gateway]
            end
            
            subgraph Private["Private Subnets"]
                subgraph EKS["EKS Cluster"]
                    API1[API Pod 1]
                    API2[API Pod 2]
                    API3[API Pod 3]
                    Dashboard[Dashboard Pod]
                end
                
                subgraph Data["Data Tier"]
                    RDS[(RDS PostgreSQL)]
                    Redis[(ElastiCache Redis)]
                end
            end
        end
        
        subgraph Services["AWS Services"]
            SecretsManager[Secrets Manager]
            CloudWatch[CloudWatch]
            S3[S3 Backups]
        end
    end
    
    Users --> ALB
    Agents --> ALB
    ALB --> EKS
    EKS --> Data
    EKS --> Services
```

## Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Cache
    participant DB
    participant Core
    
    Client->>API: POST /agents/{id}/actions
    API->>Cache: Check rate limit
    Cache-->>API: OK
    API->>DB: Get agent profile
    DB-->>API: Agent data
    API->>Core: Process action
    Core->>Core: Run security checks
    Core->>Core: Calculate risk
    Core-->>API: Decision
    API->>DB: Log action
    API->>Cache: Update metrics
    API-->>Client: Action decision
```

## Trust Tier System

```mermaid
graph LR
    subgraph Tiers["Transparency Tiers"]
        BB[Black Box<br/>Ceiling: 40%]
        GB[Gray Box<br/>Ceiling: 55%]
        WB[White Box<br/>Ceiling: 75%]
        AT[Attested<br/>Ceiling: 90%]
        TR[Transparent<br/>Ceiling: 95%]
    end
    
    BB -->|More transparency| GB
    GB -->|Code access| WB
    WB -->|Crypto attestation| AT
    AT -->|Full transparency| TR
    
    style BB fill:#ff6b6b
    style GB fill:#ffa94d
    style WB fill:#69db7c
    style AT fill:#4dabf7
    style TR fill:#da77f2
```

---

## Usage

These diagrams can be rendered using:
1. Mermaid Live Editor: https://mermaid.live
2. GitHub/GitLab markdown rendering
3. VS Code with Mermaid extension
4. Documentation tools (Docusaurus, MkDocs)
