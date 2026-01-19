# Aurais Architecture

> **Version:** 2.0 | **Updated:** January 2026 | **Status:** Active Development

## System Overview

Aurais (formerly Aurais) is a multi-agent AI orchestration platform designed for enterprise-grade governance, trust management, and human oversight. It implements the **BASIS (Behavioral AI Safety and Integrity Standard)** specification and integrates with **Cognigate** for production governance.

### Key Features

- **6-Tier Trust System** - BASIS-compliant trust scoring (Sandbox → Autonomous)
- **ATSF-Core Engine** - Published npm package `@vorionsys/atsf-core`
- **Recovery Path** - Demoted agents can earn their way back up
- **Complexity-Aware Decay** - Trust decay adjusted by task complexity
- **Multi-Dimensional Signals** - Behavioral, compliance, identity, and context factors

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                   Mission Control Web (React/Vite)                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │  Agent   │ │  Task    │ │  Trust   │ │  Audit   │ │Executive │  │    │
│  │  │ Overview │ │ Pipeline │ │ Metrics  │ │  Trail   │ │Dashboard │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ REST/WebSocket
┌────────────────────────────────────┴────────────────────────────────────────┐
│                               API LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Aurais Unified API (Hono)                        │    │
│  │                                                                       │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │    │
│  │  │Work-Loop│ │  Trust  │ │Recovery │ │ Agents  │ │  Tasks  │        │    │
│  │  │ Routes  │ │ Routes  │ │ Routes  │ │ Routes  │ │ Routes  │        │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────────────┐
│                          TRUST INTEGRATION LAYER                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      TrustIntegration Service                        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐   │    │
│  │  │ Work Loop   │  │ Complexity  │  │  Recovery   │  │  Event    │   │    │
│  │  │ Integration │  │   Tracker   │  │  Manager    │  │ Emitter   │   │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────────────┐
│                       @vorionsys/atsf-core (npm)                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                │
│  │  TrustEngine    │ │  RecoveryPath   │ │ComplexityDecay  │                │
│  │ • 6-tier system │ │ • Point-based   │ │ • Decay adjust  │                │
│  │ • Multi-signal  │ │ • Progressive   │ │ • Complexity    │                │
│  │ • Event-driven  │ │ • Tier recovery │ │   bonuses       │                │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                │
│  │ TrustSignals    │ │  Persistence    │ │  LangChain      │                │
│  │ • Behavioral    │ │ • JSON file     │ │ • ATSF Tool     │                │
│  │ • Compliance    │ │ • Supabase      │ │ • Gate Tools    │                │
│  │ • Identity      │ │ • Graceful save │ │                 │                │
│  │ • Context       │ │                 │ │                 │                │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────────────┐
│                               CORE SERVICES                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                │
│  │AgentWorkLoop    │ │Blackboard       │ │SecurityLayer    │                │
│  │ • Task queue    │ │ • Stigmergic    │ │ • Auth tokens   │                │
│  │ • Agent pool    │ │ • Pub/Sub       │ │ • RBAC          │                │
│  │ • Execution     │ │ • Events        │ │ • Audit log     │                │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────────────┐
│                            DATA/PERSISTENCE                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                │
│  │    Supabase     │ │  File-Based     │ │   Hash Chain    │                │
│  │ • PostgreSQL    │ │ • Trust data    │ │ • Audit trail   │                │
│  │ • RLS policies  │ │ • Agent state   │ │ • Integrity     │                │
│  │ • Migrations    │ │ • Work loop     │ │ • Verification  │                │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Presentation Layer

#### Mission Control Web
- **Framework**: React 18 with Vite
- **State Management**: Zustand stores
- **Real-time**: WebSocket connections
- **Styling**: Tailwind CSS

Key modules:
- `AgentOverviewModule`: Agent listing, status, trust badges
- `TaskPipelineModule`: Task queue, assignments, progress
- `TrustMetricsCard`: Trust scores, tier visualization
- `AuditEntry`: Hash-verified audit trail entries
- `ExecutiveDashboard`: KPIs, fleet health, cost metrics

### 2. API Layer

#### Aurais API
- **Framework**: Express with Hono router
- **Port**: 3002 (dev), 8080 (prod)
- **Auth**: Token-based with RBAC middleware

Routes:
```
/auth/human          POST - Get operator token
/api/spawn           POST - Spawn new agent
/tasks               GET/POST - Task CRUD
/tasks/:id/assign    POST - Assign task
/tasks/:id/complete  POST - Complete task
/approvals           GET - Pending approvals
/trust/stats         GET - Trust statistics
/dashboard/today     GET - Daily metrics
```

#### Decision Pipeline
Three-stage approval flow:

1. **TrustGate**: Automatic approval for high-trust agents
2. **Bot Tribunal**: Peer voting for borderline cases
3. **HITL Queue**: Human review for flagged actions

### 3. Service Layer

#### TrustScoreCalculator
```typescript
interface TrustScoreCalculator {
  calculateScore(agent: Agent): number;
  getTier(score: number): TrustTier;
  updateScore(agentId: string, delta: number): void;
  getHistory(agentId: string): TrustHistory[];
}
```

#### TribunalManager
```typescript
interface TribunalManager {
  initiateVoting(request: ActionRequest): VotingSession;
  castVote(sessionId: string, agentId: string, vote: Vote): void;
  getConsensus(sessionId: string): ConsensusResult;
  appeal(sessionId: string, reason: string): AppealRequest;
}
```

#### TaskAssignmentService
```typescript
interface TaskAssignmentService {
  assignTask(taskId: string, agentId: string): Assignment;
  findBestAgent(task: Task): Agent | null;
  rebalanceLoad(): void;
}
```

### 4. Trust System (@vorionsys/atsf-core)

The trust system is powered by the `@vorionsys/atsf-core` npm package, implementing the BASIS specification.

#### Trust Tiers (BASIS-Compliant)

| Tier | Score Range | Name | Capabilities |
|------|-------------|------|--------------|
| 0 | 0-99 | Sandbox | Isolated testing only |
| 1 | 100-299 | Provisional | Limited, monitored actions |
| 2 | 300-499 | Standard | Normal operations |
| 3 | 500-699 | Trusted | Elevated privileges |
| 4 | 700-899 | Certified | High-trust operations |
| 5 | 900-1000 | Autonomous | Minimal oversight |

#### Multi-Dimensional Trust Signals

```typescript
interface TrustComponents {
  behavioral: number;  // 40% weight - Task success/failure patterns
  compliance: number;  // 25% weight - Policy adherence
  identity: number;    // 20% weight - Identity verification strength
  context: number;     // 15% weight - Environmental appropriateness
}
```

#### Complexity-Aware Decay

Trust decay is adjusted based on task complexity:
- **High complexity tasks**: Up to 50% decay reduction
- **Decay calculation**: `basedecay * (1 - complexityBonus)`
- **Accelerated decay**: 3x rate after repeated failures

```typescript
// Complexity tracking per agent
interface ComplexityStats {
  averageComplexity: number;      // 0.0 - 1.0
  recentComplexity: number;       // Last N tasks
  complexityBonus: number;        // Decay reduction factor
  decayReduction: string;         // Human-readable percentage
}
```

#### Recovery Path System

Demoted agents can recover trust through sustained successful performance:

```
Recovery Requirements by Target Tier:
┌────────┬────────┬───────────────────────┬─────────────┐
│ Target │ Points │ Consecutive Successes │ Success Rate│
├────────┼────────┼───────────────────────┼─────────────┤
│ T2     │ 100    │ 5                     │ 70%+        │
│ T3     │ 200    │ 8                     │ 70%+        │
│ T4     │ 350    │ 12                    │ 70%+        │
│ T5     │ 500    │ 15                    │ 70%+        │
└────────┴────────┴───────────────────────┴─────────────┘

Points = task_complexity × 10 (for successful tasks)
```

**Recovery Events:**
- `trust:recovery_started` - Agent enters recovery mode
- `trust:recovery_progress` - Progress update after each task
- `trust:recovery_complete` - Agent promoted to target tier

#### TrustEngine API

```typescript
interface TrustEngine {
  // Core operations
  initializeEntity(entityId: string, initialScore?: number): Promise<TrustRecord>;
  getScore(entityId: string): Promise<TrustRecord | null>;
  recordSignal(entityId: string, signal: TrustSignal): Promise<TrustRecord>;

  // Decay management
  applyDecay(entityId: string): Promise<TrustRecord>;
  setComplexityForDecay(entityId: string, complexity: number): void;

  // Recovery operations
  startRecovery(entityId: string, originalTier: TrustLevel): Promise<RecoveryState>;
  updateRecoveryProgress(entityId: string, complexity: number, success: boolean): Promise<void>;
  evaluateRecovery(entityId: string): Promise<boolean>;
  cancelRecovery(entityId: string, reason?: string): Promise<boolean>;
  getRecoveryState(entityId: string): RecoveryState | null;
  isInRecovery(entityId: string): boolean;
}
```

### 5. Core Services

#### Blackboard
Stigmergic coordination:
- Pub/sub messaging
- Agent communication
- Event broadcasting
- State synchronization

#### SecurityLayer
Authentication and authorization:
- Token issuance (human/agent)
- RBAC enforcement
- Permission checking
- Audit logging

### 5. Data Layer

#### Supabase (PostgreSQL)
- Persistent storage
- Row-Level Security (RLS)
- Migrations versioning

#### In-Memory
- Agent runtime state
- Task queue
- WebSocket connections

#### Hash Chain
- Cryptographic audit trail
- Tamper detection
- Integrity verification

---

## Agent Communication Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AGENT COORDINATOR                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Message Router                                  │    │
│  │  • Direct delivery    • Broadcast     • Skill matching              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Claude    │  │   Gemini    │  │    Grok     │  │   Custom    │        │
│  │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │        │
│  │             │  │             │  │             │  │             │        │
│  │ Skills:     │  │ Skills:     │  │ Skills:     │  │ Skills:     │        │
│  │ - planning  │  │ - research  │  │ - creative  │  │ - custom    │        │
│  │ - analysis  │  │ - data      │  │ - trends    │  │ - domain    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Message Types
- `QUERY`: Ask questions
- `REQUEST_HELP`: Request assistance
- `DELEGATE_TASK`: Assign work
- `SHARE_CONTEXT`: Share data
- `BROADCAST`: Message all
- `TASK_RESULT`: Return results

### Collaboration Flow
1. Agent requests collaboration with required skills
2. Coordinator matches skills to available agents
3. Best-matched agent accepts/declines
4. Work is executed and results returned

---

## Data Flow

### Task Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  CREATE  │ →  │  ASSIGN  │ →  │ EXECUTE  │ →  │ COMPLETE │ →  │  AUDIT   │
│          │    │          │    │          │    │          │    │          │
│ • Title  │    │ • Agent  │    │ • LLM    │    │ • Result │    │ • Hash   │
│ • Desc   │    │ • Token  │    │   call   │    │ • Trust  │    │ • Store  │
│ • Prior  │    │          │    │          │    │   update │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Trust Update Flow

```
┌──────────────┐
│ Task Result  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Success?     │──→  │ Reward       │
│              │ YES │ +5 to +20    │
└──────┬───────┘     └──────────────┘
       │ NO
       ▼
┌──────────────┐
│ Penalty      │
│ -10 to -50   │
└──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Tier Change? │──→  │ Notify       │
│              │ YES │ Operators    │
└──────────────┘     └──────────────┘
```

---

## Deployment Architecture

### Production

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                CLOUDFLARE                                    │
│                              (DNS + CDN)                                     │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   Vercel      │           │   Local/Fly   │           │   Supabase    │
│   (Web)       │           │   (API)       │           │   (Database)  │
│               │           │               │           │               │
│ aurais.       │  ←─API──→ │ Aurais API    │  ←─SQL──→ │  PostgreSQL   │
│ agentanchor   │           │ Port: 3003    │           │               │
│ ai.com       │           │               │           │               │
└───────────────┘           └───────────────┘           └───────────────┘
```

### API Endpoints (Port 3003)

**Trust Management:**
```
GET  /trust/stats                    - Trust statistics overview
GET  /trust/all                      - All agent trust records
GET  /work-loop/trust/:agentId       - Single agent trust + recovery state
POST /work-loop/trust/:agentId/adjust - Adjust agent trust score
```

**Recovery Path:**
```
GET  /work-loop/trust/recovery                  - Summary of agents in recovery
POST /work-loop/trust/:agentId/recovery/start   - Start recovery for agent
POST /work-loop/trust/:agentId/recovery/cancel  - Cancel agent recovery
POST /work-loop/trust/:agentId/original-tier    - Set original tier for recovery
```

**Work Loop:**
```
GET  /work-loop/agents               - List all agents
GET  /work-loop/agents/:agentId      - Single agent details
POST /work-loop/agents/:agentId/task - Assign task to agent
POST /work-loop/task/completed       - Mark task completed
POST /work-loop/task/failed          - Mark task failed
```

### Environment Variables

| Service | Variable | Description |
|---------|----------|-------------|
| API | `MASTER_KEY` | Auth master key |
| API | `SUPABASE_URL` | Database URL |
| API | `SUPABASE_ANON_KEY` | Database key |
| API | `ANTHROPIC_API_KEY` | Claude (optional) |
| Web | `VITE_API_URL` | API base URL |

---

## Security Model

### Authentication
- Human operators: Master key → Token
- AI agents: Spawn → Agent token
- Tokens expire after 24 hours

### Authorization (RBAC)
| Role | Permissions |
|------|-------------|
| HUMAN | All operations |
| DIRECTOR | Governance rules |
| SUPERVISOR | Team management |
| OPERATOR | Task operations |
| AGENT | Execute, report |

### Audit Trail
- All actions logged with hash chain
- Tamper-evident verification
- Compliance-ready exports

---

## Scalability Considerations

### Current Limits
- 100+ concurrent agents
- 1000+ tasks/hour
- Sub-100ms response times

### Scaling Strategies
1. **Horizontal**: Multiple API instances
2. **Database**: Read replicas
3. **Caching**: Redis for hot data
4. **Queue**: Background job processing

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Zustand, Tailwind |
| API | Node.js, Hono |
| Trust Engine | @vorionsys/atsf-core (npm) |
| Governance | Cognigate (cognigate.dev) |
| Database | PostgreSQL (Supabase), File-based persistence |
| Auth | Custom token system |
| Testing | Vitest |
| Deployment | Vercel (Web), Local/Fly.io (API) |
| AI | Claude, Gemini, Grok |

---

## Cognigate Integration

Aurais integrates with Cognigate for production governance:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Aurais (Frontend)                                │
│                       aurais.agentanchorai.com                               │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Aurais Backend API                                 │
│                                                                              │
│  ┌───────────────┐    ┌──────────────────┐    ┌───────────────────┐         │
│  │ Chat Handler  │ →  │ Governance       │ →  │ LLM Provider      │         │
│  │               │    │ Middleware       │    │ (Claude/GPT)      │         │
│  └───────────────┘    └────────┬─────────┘    └───────────────────┘         │
│                                │                                             │
└────────────────────────────────┼─────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Cognigate Engine                                    │
│                         cognigate.dev                                        │
│                                                                              │
│  POST /v1/intent  → Parse request, classify risk                            │
│  POST /v1/enforce → Check trust, return ALLOW/DENY/ESCALATE                 │
│  POST /v1/proof   → Log to immutable audit trail                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Governance Decisions

| Decision | Meaning | Action |
|----------|---------|--------|
| ALLOW | Trust sufficient | Execute action |
| DENY | Trust insufficient | Block with explanation |
| ESCALATE | Human review required | Queue for approval |
| DEGRADE | Partial capability | Execute with limits |

---

## Related Documentation

- **[PRODUCT_SPEC.md](./PRODUCT_SPEC.md)** - Product specification
- **[AGENT_SDK.md](./AGENT_SDK.md)** - Agent SDK documentation
- **[DEMO_FLOW.md](./DEMO_FLOW.md)** - Demo flow documentation
- **[COGNIGATE-AURAIS-COMPLETE-PLAN.md](../COGNIGATE-AURAIS-COMPLETE-PLAN.md)** - Integration plan

---

*Last updated: January 2026*
