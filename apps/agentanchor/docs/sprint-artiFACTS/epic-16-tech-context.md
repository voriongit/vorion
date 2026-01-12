# Epic 16: Safety & Governance Enhancement - Technical Context

**Epic:** Safety & Governance Enhancement (Council Priorities)
**Goal:** Risk×Trust Matrix routing + Circuit Breaker + HITL Automation
**Council Vote:** #1 Matrix (80pts), #2 HITL (42pts), #3 Circuit Breaker (39pts)
**Status:** COMPLETE (Retrospective Documentation)
**Generated:** 2025-12-09

---

## 1. Executive Summary

This epic consolidates the top 3 Council Priority features voted by the 16-advisor council (2025-12-07):

| Priority | Feature | Score | Stories | Status |
|----------|---------|-------|---------|--------|
| #1 | Risk×Trust Matrix | 80 | 16-0 | DONE |
| #2 | HITL Automation | 42 | 16-5, 16-6 | DONE |
| #3 | Circuit Breaker | 39 | 16-1 to 16-4 | DONE |

**Total Implementation:** 7 stories completed

---

## 2. Implemented Components

### 2.1 Risk×Trust Matrix Router (Story 16-0)

**Location:** `lib/governance/matrix-router.ts`

**Architecture:**
- **GREEN Express Path:** Trust ≥800 + Risk ≤2 → Auto-approve (100ms)
- **YELLOW Standard Path:** Trust 400-799 + Risk ≤3 → Policy check (500ms)
- **RED Full Path:** Trust <400 OR Critical Risk → Council consensus (5000ms)

**Key Functions:**
```typescript
routeAction(input: MatrixInput): MatrixResult
checkPolicy(input: PolicyCheckInput): PolicyCheckResult
getMatrix(): MatrixCell[][] // Visualization
toGovernanceDecision(result): GovernanceDecision
```

**Routing Logic:**
- Critical risk always routes RED (human review)
- Express path requires both high trust AND low risk
- Policy violations block YELLOW → RED escalation

### 2.2 Circuit Breaker (Stories 16-1 to 16-4)

**Location:** `lib/circuit-breaker/circuit-breaker-service.ts`

**Capabilities:**

#### Story 16-1: Agent Pause/Resume
```typescript
pauseAgent(request: PauseAgentRequest, userId: string): Promise<PauseAgentResult>
resumeAgent(request: ResumeAgentRequest, userId: string): Promise<ResumeAgentResult>
getAgentPauseState(agentId: string): Promise<AgentPauseState | null>
```

**Pause Reasons:**
- `investigation` - Under investigation (blocks resume)
- `maintenance` - Trainer-requested pause
- `consumer_request` - Consumer reported issue
- `circuit_breaker` - Automatic trigger
- `cascade_halt` - Dependent agent paused
- `emergency_stop` - Kill switch activation

#### Story 16-2: Global Kill Switch
```typescript
activateKillSwitch(request, userId): Promise<KillSwitchResult>
deactivateKillSwitch(request, userId): Promise<boolean>
getKillSwitchState(): Promise<KillSwitchState | null>
isBlockedByKillSwitch(agentId): Promise<{blocked, reason}>
```

**Scope Targeting:**
- `all` - All agents
- `tier:untrusted` - Specific trust tier
- `specialization:healthcare` - Specific specialization

#### Story 16-3: Cascade Halt Protocol
```typescript
cascadeHalt(agentId: string, userId: string): Promise<string[]>
```
- Recursive cascade through dependency graph
- Automatically halts all agents depending on paused agent

#### Story 16-4: Truth Chain Recording
All circuit breaker events recorded:
- Pause/resume with reason
- Kill switch activation/deactivation
- Cascade halt chains
- Auto-resume on expiry

### 2.3 HITL Automation (Stories 16-5, 16-6)

**Location:** `lib/hitl/hitl-service.ts`

#### Story 16-5: Proof Accumulation Tracker
```typescript
recordProof(request: RecordProofRequest): Promise<ProofRecord | null>
getAccumulation(agentId, actionType?): Promise<ProofAccumulation[]>
```

**Tracking:**
- Agent decision vs human decision
- Agreement rate over rolling window (30 days default)
- Per-action-type accumulation

#### Story 16-6: HITL Fade Logic
```typescript
checkReviewRequired(request): Promise<CheckReviewRequiredResult>
determinePhase(agreementRate, totalReviews): HITLPhase
getAgentHITLStatus(agentId): Promise<HITLStatusSummary>
```

**HITL Phases:**
| Phase | Agreement Rate | Review Probability |
|-------|---------------|-------------------|
| `full_review` | <85% | 100% |
| `spot_check` | 85-92% | 20% |
| `exception_only` | 92-98% | 5% |
| `autonomous` | ≥98% | 0% |

**Minimum Reviews:** 10 before reducing oversight

---

## 3. Database Schema

### Circuit Breaker Tables

```sql
-- Agent pause state (columns on bots/agents table)
is_paused BOOLEAN DEFAULT false
pause_reason TEXT
paused_at TIMESTAMPTZ
paused_by UUID REFERENCES profiles(id)
pause_notes TEXT
pause_expires_at TIMESTAMPTZ

-- Circuit breaker events
CREATE TABLE circuit_breaker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id),
  event_type TEXT NOT NULL, -- 'pause', 'resume', 'cascade_halt', 'emergency_stop', 'auto_resume'
  reason TEXT,
  notes TEXT,
  triggered_by UUID REFERENCES profiles(id),
  triggered_by_system BOOLEAN DEFAULT false,
  parent_agent_id UUID, -- For cascade tracking
  truth_chain_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global kill switch
CREATE TABLE global_kill_switch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  scope TEXT DEFAULT 'all',
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES profiles(id)
);

-- Agent dependencies (for cascade)
CREATE TABLE agent_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id),
  depends_on_agent_id UUID NOT NULL REFERENCES bots(id),
  dependency_type TEXT DEFAULT 'functional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, depends_on_agent_id)
);
```

### HITL Tables

```sql
-- Proof records
CREATE TABLE hitl_proof_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id),
  action_type TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  agent_decision TEXT NOT NULL,
  human_decision TEXT,
  agreed BOOLEAN NOT NULL,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accumulation (rolling window stats)
CREATE TABLE hitl_accumulation (
  agent_id UUID NOT NULL REFERENCES bots(id),
  action_type TEXT NOT NULL,
  total_reviews INT DEFAULT 0,
  agreed_count INT DEFAULT 0,
  disagreed_count INT DEFAULT 0,
  agreement_rate FLOAT DEFAULT 0,
  current_phase TEXT DEFAULT 'full_review',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (agent_id, action_type)
);

-- Review requests
CREATE TABLE hitl_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id),
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  agent_decision TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'modified'
  human_decision TEXT,
  human_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. API Endpoints

### Circuit Breaker API

**Location:** `app/api/v1/circuit-breaker/route.ts`

```
POST /api/v1/circuit-breaker/pause
POST /api/v1/circuit-breaker/resume
GET  /api/v1/circuit-breaker/status/:agentId
POST /api/v1/circuit-breaker/kill-switch/activate
POST /api/v1/circuit-breaker/kill-switch/deactivate
GET  /api/v1/circuit-breaker/kill-switch/status
```

### HITL API

**Location:** `app/api/v1/governance/hitl/route.ts`

```
POST /api/v1/governance/hitl/review
GET  /api/v1/governance/hitl/pending
GET  /api/v1/governance/hitl/status/:agentId
POST /api/v1/governance/hitl/submit-review
```

---

## 5. Type Definitions

**Location:** `lib/circuit-breaker/types.ts`, `lib/hitl/types.ts`

Key types exported:
- `PauseReason`, `CircuitBreakerEvent`, `AgentPauseState`
- `KillSwitchState`, `KillSwitchScope`, `AgentDependency`
- `HITLPhase`, `ProofRecord`, `ProofAccumulation`
- `HITLFadeConfig`, `HITLReviewRequest`

---

## 6. Integration Points

### With Council Service
- Circuit breaker can block council votes for paused agents
- Kill switch affects all pending council decisions

### With Trust Service
- Pause events may trigger trust decay
- HITL disagreements impact trust trajectory

### With Observer/Truth Chain
- All circuit breaker events recorded immutably
- HITL disagreements logged for audit

### With Governance Layer
- Matrix router integrates with existing decision flow
- HITL check runs before council submission

---

## 7. Testing Completed

- [x] Unit: Route determination for all trust×risk combinations
- [x] Unit: Pause/resume state transitions
- [x] Unit: HITL phase calculations
- [x] Integration: Cascade halt through dependency chain
- [x] Integration: Kill switch scope filtering
- [x] Integration: Proof accumulation window
- [x] E2E: Full pause→resume cycle with Truth Chain
- [x] E2E: HITL review flow

---

## 8. Retrospective Notes

**What Went Well:**
- Council vote prioritization gave clear direction
- Services cleanly separated by concern
- Type safety throughout

**Improvements Made During Implementation:**
- Added scope targeting to kill switch (not just all-or-nothing)
- Added investigation pause reason that blocks resume
- Added rolling window for HITL to prevent gaming

---

*Epic 16 completed as part of Council Priority Sprint*
*AgentAnchor Growth Phase - Safety Enhancement*
