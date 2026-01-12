# Epic: A3I Testing Studio - Red Team Infrastructure

## Epic Overview

| Field | Value |
|-------|-------|
| **Epic ID** | EPIC-TS-001 |
| **Title** | Testing Studio - Red Team Infrastructure |
| **Priority** | P0 - Critical Path |
| **Estimated Sprints** | 4-6 sprints |
| **Dependencies** | Existing agent infrastructure |
| **Business Value** | Competitive moat, certification authority |

## Epic Description

Build the A3I Testing Studio: an adversarial testing infrastructure where AI agents battle each other to discover, document, and defend against security vulnerabilities. This epic establishes the red team agent framework, sandboxed arena, attack library, and detection pipeline.

## Success Criteria

1. Red agents can execute attacks in sandboxed environment
2. Attack vectors are automatically catalogued
3. Detection pipeline catches 95%+ of known attacks
4. Zero sandbox escapes in production
5. 1,000+ attack vectors documented by epic completion

---

## Story 1: Agent Role System

### Story Details
| Field | Value |
|-------|-------|
| **Story ID** | TS-001 |
| **Title** | Create Agent Role and Specialization System |
| **Points** | 5 |
| **Sprint** | 1 |

### User Story
As a **platform administrator**, I want to **assign security roles to agents** so that **agents can be designated as red team, blue team, or standard**.

### Acceptance Criteria

- [ ] **AC1**: Add `agent_role` enum to agents table: `standard`, `red_team`, `blue_team`, `target`
- [ ] **AC2**: Add `security_specialization` field for attack/defense domain
- [ ] **AC3**: Create role assignment API endpoint `POST /api/agents/[id]/role`
- [ ] **AC4**: Add role indicator to agent cards in dashboard
- [ ] **AC5**: Implement role-based capability restrictions
- [ ] **AC6**: Add audit logging for role changes

### Technical Notes

```sql
-- Migration: Add agent security roles
ALTER TABLE agents ADD COLUMN agent_role TEXT DEFAULT 'standard'
  CHECK (agent_role IN ('standard', 'red_team', 'blue_team', 'target'));

ALTER TABLE agents ADD COLUMN security_specialization JSONB DEFAULT '{}';

-- Index for role queries
CREATE INDEX idx_agents_role ON agents(agent_role);
```

### Definition of Done
- [ ] Code complete and reviewed
- [ ] Unit tests passing (>90% coverage on new code)
- [ ] API documentation updated
- [ ] Role changes audit logged
- [ ] No breaking changes to existing agent functionality

---

## Story 2: Sandboxed Arena Environment

### Story Details
| Field | Value |
|-------|-------|
| **Story ID** | TS-002 |
| **Title** | Build Sandboxed Arena Execution Environment |
| **Points** | 13 |
| **Sprint** | 1-2 |

### User Story
As a **security engineer**, I want to **execute adversarial sessions in isolated environments** so that **red team attacks cannot affect production systems**.

### Acceptance Criteria

- [ ] **AC1**: Create `arena_sessions` table to track adversarial sessions
- [ ] **AC2**: Implement session isolation with separate execution contexts
- [ ] **AC3**: Red agents cannot access production endpoints
- [ ] **AC4**: All arena network traffic is logged
- [ ] **AC5**: Session has configurable timeout (default 5 min)
- [ ] **AC6**: Implement kill switch to terminate runaway sessions
- [ ] **AC7**: Create arena dashboard showing active sessions

### Technical Notes

```typescript
interface ArenaSession {
  id: string;
  red_agents: string[];      // Agent IDs
  blue_agents: string[];     // Agent IDs
  target_agent: string;      // Agent being tested
  status: 'pending' | 'running' | 'completed' | 'terminated';
  started_at: Date;
  timeout_at: Date;
  results: SessionResults;
  containment_verified: boolean;
}

interface ContainmentRules {
  allowed_endpoints: string[];
  blocked_endpoints: string[];
  max_tokens_per_turn: number;
  max_turns: number;
  network_isolated: boolean;
}
```

### Definition of Done
- [ ] Sandbox isolation verified by security review
- [ ] Zero external network access from arena
- [ ] Kill switch tested and functional
- [ ] Session logging complete
- [ ] Performance impact <5% on main platform

---

## Story 3: Attack Vector Collection System

### Story Details
| Field | Value |
|-------|-------|
| **Story ID** | TS-003 |
| **Title** | Implement Attack Vector Collection and Cataloging |
| **Points** | 8 |
| **Sprint** | 2 |

### User Story
As a **security researcher**, I want to **automatically capture and catalog attack vectors** so that **successful attacks are documented in the attack library**.

### Acceptance Criteria

- [ ] **AC1**: Create `attack_vectors` table with taxonomy structure
- [ ] **AC2**: Capture attack payloads from red agent outputs
- [ ] **AC3**: Detect successful attacks (target behavior changed)
- [ ] **AC4**: Auto-classify attacks using taxonomy
- [ ] **AC5**: Generate unique hash for deduplication
- [ ] **AC6**: Track attack lineage (mutations from base vectors)
- [ ] **AC7**: Create attack library browsing UI

### Technical Notes

```sql
CREATE TABLE attack_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vector_hash TEXT UNIQUE NOT NULL,  -- For deduplication

  -- Taxonomy classification
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  technique TEXT NOT NULL,

  -- Attack details
  payload TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),

  -- Lineage
  parent_vector_id UUID REFERENCES attack_vectors(id),
  mutation_type TEXT,  -- How it was derived

  -- Discovery metadata
  discovered_by UUID REFERENCES agents(id),
  discovered_in_session UUID REFERENCES arena_sessions(id),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Effectiveness tracking
  success_count INT DEFAULT 0,
  attempt_count INT DEFAULT 0,
  bypass_detection_count INT DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'deprecated')),
  verified_by UUID,  -- Human reviewer
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_attack_vectors_taxonomy ON attack_vectors(category, subcategory, technique);
CREATE INDEX idx_attack_vectors_severity ON attack_vectors(severity);
```

### Definition of Done
- [ ] Attack capture working in arena sessions
- [ ] Taxonomy auto-classification >80% accuracy
- [ ] Deduplication preventing duplicate entries
- [ ] Lineage tracking functional
- [ ] Attack library UI displays vectors

---

## Story 4: Red Agent Framework

### Story Details
| Field | Value |
|-------|-------|
| **Story ID** | TS-004 |
| **Title** | Create Red Agent Attack Generation Framework |
| **Points** | 13 |
| **Sprint** | 2-3 |

### User Story
As a **platform architect**, I want to **create specialized red agents that generate attacks** so that **we can systematically discover vulnerabilities**.

### Acceptance Criteria

- [ ] **AC1**: Create base `RedAgent` class with attack generation interface
- [ ] **AC2**: Implement `InjectorAgent` specialization
- [ ] **AC3**: Implement `ObfuscatorAgent` specialization
- [ ] **AC4**: Implement `JailbreakerAgent` specialization
- [ ] **AC5**: Red agents can mutate existing attack vectors
- [ ] **AC6**: Attack generation respects creativity/persistence configs
- [ ] **AC7**: All generated attacks are captured for library
- [ ] **AC8**: Red agents cannot access their own detection rules

### Technical Notes

```typescript
// lib/testing-studio/red-agents/base.ts
abstract class RedAgent {
  abstract specialization: AttackCategory;
  abstract creativityLevel: number; // 0.0-1.0

  abstract generateAttack(
    target: AgentProfile,
    context: AttackContext
  ): Promise<AttackPayload>;

  abstract mutateAttack(
    baseVector: AttackVector,
    mutationType: MutationType
  ): Promise<AttackPayload>;

  protected async recordDiscovery(
    payload: AttackPayload,
    result: AttackResult
  ): Promise<void>;
}

// Specializations
class InjectorAgent extends RedAgent {
  specialization = 'prompt_injection';
  techniques = ['direct', 'indirect', 'multi_stage'];
}

class ObfuscatorAgent extends RedAgent {
  specialization = 'obfuscation';
  techniques = ['encoding', 'unicode', 'semantic'];

  // Can wrap any attack in obfuscation
  async obfuscate(attack: AttackPayload): Promise<AttackPayload>;
}

class JailbreakerAgent extends RedAgent {
  specialization = 'jailbreak';
  techniques = ['roleplay', 'hypothetical', 'authority'];
}
```

### Definition of Done
- [ ] Three red agent types functional
- [ ] Attack generation producing valid payloads
- [ ] Mutation creating novel variants
- [ ] All attacks logged to library
- [ ] Compartmentalization verified (no detection access)

---

## Story 5: Blue Agent Detection Framework

### Story Details
| Field | Value |
|-------|-------|
| **Story ID** | TS-005 |
| **Title** | Create Blue Agent Detection Framework |
| **Points** | 13 |
| **Sprint** | 3 |

### User Story
As a **security engineer**, I want to **create blue agents that detect attacks** so that **we can measure and improve our detection capabilities**.

### Acceptance Criteria

- [ ] **AC1**: Create base `BlueAgent` class with detection interface
- [ ] **AC2**: Implement `PatternDetector` for signature matching
- [ ] **AC3**: Implement `SemanticDetector` for intent analysis
- [ ] **AC4**: Implement `AnomalyDetector` for behavioral analysis
- [ ] **AC5**: Detection results include confidence scores
- [ ] **AC6**: False positive/negative tracking
- [ ] **AC7**: Blue agents cannot access attack generation logic
- [ ] **AC8**: Detection rules auto-updated from verified vectors

### Technical Notes

```typescript
// lib/testing-studio/blue-agents/base.ts
abstract class BlueAgent {
  abstract detectionDomain: DetectionCategory;

  abstract analyze(
    input: string,
    context: RequestContext
  ): Promise<DetectionResult>;

  abstract getConfidence(): number;
}

interface DetectionResult {
  detected: boolean;
  attack_category: string | null;
  confidence: number;  // 0.0-1.0
  indicators: DetectionIndicator[];
  recommended_action: 'allow' | 'block' | 'flag' | 'escalate';
}

// Specializations
class PatternDetector extends BlueAgent {
  patterns: DetectionPattern[];

  async loadPatternsFromLibrary(): Promise<void>;
  async matchPatterns(input: string): Promise<PatternMatch[]>;
}

class SemanticDetector extends BlueAgent {
  // Uses embeddings to detect semantic similarity to known attacks
  async getSemanticSimilarity(
    input: string,
    knownAttacks: AttackVector[]
  ): Promise<number>;
}

class AnomalyDetector extends BlueAgent {
  baseline: BehaviorBaseline;

  async detectAnomaly(
    input: string,
    sessionHistory: Message[]
  ): Promise<AnomalyScore>;
}
```

### Definition of Done
- [ ] Three blue agent types functional
- [ ] Detection accuracy >90% on known vectors
- [ ] False positive rate <5%
- [ ] Confidence scores calibrated
- [ ] Auto-update from attack library working

---

## Story 6: Orchestration Layer

### Story Details
| Field | Value |
|-------|-------|
| **Story ID** | TS-006 |
| **Title** | Build Testing Studio Orchestration Layer |
| **Points** | 8 |
| **Sprint** | 3-4 |

### User Story
As an **operations engineer**, I want to **schedule and manage adversarial sessions** so that **testing runs continuously and efficiently**.

### Acceptance Criteria

- [ ] **AC1**: Create session scheduler with configurable intervals
- [ ] **AC2**: Support one-off and recurring battle sessions
- [ ] **AC3**: Load balance across available arena slots
- [ ] **AC4**: Collect and aggregate session results
- [ ] **AC5**: Generate session reports with metrics
- [ ] **AC6**: Alert on significant discoveries
- [ ] **AC7**: Dashboard showing orchestration status

### Technical Notes

```typescript
// lib/testing-studio/orchestrator.ts
class TestingStudioOrchestrator {
  async scheduleSession(config: SessionConfig): Promise<ArenaSession>;

  async runSession(sessionId: string): Promise<SessionResults>;

  async collectIntelligence(session: ArenaSession): Promise<AttackVector[]>;

  async updateDetectionPipeline(vectors: AttackVector[]): Promise<void>;

  async generateReport(
    timeRange: DateRange
  ): Promise<OrchestratorReport>;
}

interface SessionConfig {
  red_agents: RedAgentConfig[];
  blue_agents: BlueAgentConfig[];
  target_agents: string[];
  duration_minutes: number;
  attack_categories: string[];
  schedule?: CronExpression;
}

interface OrchestratorReport {
  sessions_run: number;
  attacks_discovered: number;
  attacks_blocked: number;
  detection_accuracy: number;
  false_positive_rate: number;
  novel_categories_found: string[];
}
```

### Definition of Done
- [ ] Scheduler running sessions on configured intervals
- [ ] Results aggregated correctly
- [ ] Reports generating accurate metrics
- [ ] Alerts firing on novel discoveries
- [ ] Dashboard showing real-time status

---

## Story 7: Intelligence Dashboard

### Story Details
| Field | Value |
|-------|-------|
| **Story ID** | TS-007 |
| **Title** | Create Attack Library and Intelligence Dashboard |
| **Points** | 8 |
| **Sprint** | 4 |

### User Story
As a **security analyst**, I want to **browse and analyze the attack library** so that **I can understand threats and improve defenses**.

### Acceptance Criteria

- [ ] **AC1**: Attack library browser with filtering/search
- [ ] **AC2**: Taxonomy tree navigation
- [ ] **AC3**: Attack detail view with examples
- [ ] **AC4**: Detection coverage visualization
- [ ] **AC5**: Trend charts for attack categories
- [ ] **AC6**: Red/blue agent leaderboards
- [ ] **AC7**: Export functionality for reports

### Technical Notes

```tsx
// app/(dashboard)/testing-studio/page.tsx
// - Overview metrics
// - Active sessions
// - Recent discoveries
// - Detection accuracy trends

// app/(dashboard)/testing-studio/library/page.tsx
// - Attack vector browser
// - Taxonomy tree
// - Search and filter

// app/(dashboard)/testing-studio/library/[id]/page.tsx
// - Attack detail
// - Example payloads
// - Detection rules
// - Lineage visualization
```

### Definition of Done
- [ ] All dashboard pages implemented
- [ ] Filtering and search functional
- [ ] Visualizations rendering correctly
- [ ] Export producing valid reports
- [ ] Performance acceptable (<2s page load)

---

## Sprint Planning

### Sprint 1 (Stories 1, 2 partial)
- Agent role system
- Begin arena sandbox

### Sprint 2 (Stories 2, 3, 4 partial)
- Complete arena sandbox
- Attack vector collection
- Begin red agent framework

### Sprint 3 (Stories 4, 5)
- Complete red agents
- Blue agent framework

### Sprint 4 (Stories 6, 7)
- Orchestration layer
- Intelligence dashboard

### Sprint 5-6 (Hardening)
- Security review
- Performance optimization
- Documentation
- Initial attack library seeding

---

## Technical Dependencies

1. Existing agent infrastructure (agents table)
2. Supabase for data storage
3. Edge functions for session isolation
4. Real-time updates via Pusher

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Sandbox escape | Multiple isolation layers, security audit |
| Performance impact | Separate infrastructure for arena |
| Red agent misuse | Strict role permissions, audit logging |
| Detection evasion | Continuous red/blue improvement cycle |

---

*Epic Version: 1.0*
*Created: 2024-12-14*
*Status: Ready for Sprint Planning*
