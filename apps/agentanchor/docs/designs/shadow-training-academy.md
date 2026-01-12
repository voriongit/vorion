# Shadow Training & Academy Architecture Design

## Overview

This document outlines the architecture for two key AgentAnchor training features:
1. **Shadow Training** - A/B testing framework for comparing multiple agents
2. **Academy** - The agent training and certification infrastructure

---

## Part 1: Shadow Training (A/B Testing)

### Concept

Shadow Training allows users to send identical prompts to multiple agents simultaneously and compare their responses. This enables:
- Performance benchmarking across agent configurations
- Response quality comparison
- Fine-tuning optimization
- Pre-deployment validation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Shadow Training Session                   │
├─────────────────────────────────────────────────────────────┤
│  Prompt Input  ──────────────────────────────────────────►  │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐     │
│  │ Agent A │   │ Agent B │   │ Agent C │   │ Agent N │     │
│  │ (Base)  │   │(Variant)│   │(Variant)│   │(Variant)│     │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘     │
│       │             │             │             │           │
│       ▼             ▼             ▼             ▼           │
│  ┌──────────────────────────────────────────────────┐      │
│  │            Response Comparison Panel              │      │
│  │  • Side-by-side view                             │      │
│  │  • Latency metrics                               │      │
│  │  • Token usage                                   │      │
│  │  • Quality scoring                               │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Shadow training sessions
CREATE TABLE shadow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, completed, archived
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents participating in a shadow session
CREATE TABLE shadow_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES shadow_sessions(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  label VARCHAR(50), -- "Control", "Variant A", "Variant B", etc.
  config_override JSONB DEFAULT '{}', -- Temp config changes for this test
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, agent_id)
);

-- Test prompts for shadow training
CREATE TABLE shadow_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES shadow_sessions(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category VARCHAR(100), -- "reasoning", "code", "creative", etc.
  expected_output TEXT, -- Optional golden answer
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual responses from each agent
CREATE TABLE shadow_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES shadow_sessions(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES shadow_prompts(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES shadow_participants(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  latency_ms INT,
  tokens_input INT,
  tokens_output INT,
  model_used VARCHAR(100),
  quality_score DECIMAL(5,2), -- 0-100 score (manual or auto)
  scoring_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregated session analytics
CREATE TABLE shadow_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES shadow_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES shadow_participants(id) ON DELETE CASCADE,
  total_prompts INT DEFAULT 0,
  avg_latency_ms DECIMAL(10,2),
  avg_quality_score DECIMAL(5,2),
  total_tokens INT DEFAULT 0,
  win_count INT DEFAULT 0, -- Times this agent was rated best
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Shadow Training UI Flow

1. **Create Session**
   - Name the session
   - Select 2-10 agents to compare
   - Label each agent (Control, Variant A, etc.)
   - Optionally override configs per agent

2. **Add Test Prompts**
   - Single prompt entry
   - Bulk import from CSV/JSON
   - Use prompt library/templates
   - Categorize prompts (reasoning, code, creative, etc.)

3. **Run Tests**
   - Execute all prompts against all agents
   - Real-time progress indicator
   - Parallel execution for speed

4. **Analyze Results**
   - Side-by-side response comparison
   - Latency/token charts
   - Quality scoring (manual rating or auto-eval)
   - Export results as report

5. **Promote Winner**
   - Select best-performing agent
   - Apply its config to production
   - Archive session with learnings

### API Endpoints

```
POST   /api/v1/shadow-sessions              # Create session
GET    /api/v1/shadow-sessions              # List sessions
GET    /api/v1/shadow-sessions/:id          # Get session details
PATCH  /api/v1/shadow-sessions/:id          # Update session
DELETE /api/v1/shadow-sessions/:id          # Delete session

POST   /api/v1/shadow-sessions/:id/participants    # Add agent to session
DELETE /api/v1/shadow-sessions/:id/participants/:participantId

POST   /api/v1/shadow-sessions/:id/prompts         # Add test prompt
POST   /api/v1/shadow-sessions/:id/prompts/bulk    # Bulk add prompts
DELETE /api/v1/shadow-sessions/:id/prompts/:promptId

POST   /api/v1/shadow-sessions/:id/run             # Execute all tests
GET    /api/v1/shadow-sessions/:id/results         # Get all responses
POST   /api/v1/shadow-sessions/:id/responses/:responseId/score  # Rate response

GET    /api/v1/shadow-sessions/:id/analytics       # Get aggregated stats
POST   /api/v1/shadow-sessions/:id/export          # Export report
```

---

## Part 2: Academy Architecture

### Decision: **Hybrid Model (Recommended)**

After analysis, the recommended approach is a **Hybrid Model** where:
- Agents remain in owner's environment during training
- Academy provides curriculum, exercises, and evaluation criteria
- Training executes locally but reports metrics to Academy
- Graduation requires passing Academy certification tests

### Why Hybrid Over "Ship to School"?

| Factor | Ship to School | Hybrid (Recommended) |
|--------|---------------|----------------------|
| Data Privacy | Agent sees other user data | Data stays local |
| Latency | Network overhead | Local execution |
| Cost | Academy pays compute | Owner pays compute |
| Customization | Standard curriculum only | Custom + standard |
| Trust | Agent leaves owner control | Owner retains control |
| Scalability | Academy bottleneck | Distributed load |

### Academy Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ACADEMY CENTRAL                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Curriculum  │  │ Evaluation  │  │Certification│              │
│  │   Library   │  │   Engine    │  │   Registry  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
    ┌─────────────────────────────────────────┐
    │         Academy Training Protocol        │
    │  • Curriculum sync                       │
    │  • Progress reporting                    │
    │  • Certification requests                │
    │  • Badge issuance                        │
    └─────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  OWNER ENV A    │ │  OWNER ENV B    │ │  OWNER ENV C    │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │  Agent 1  │  │ │  │  Agent 2  │  │ │  │  Agent 3  │  │
│  │  Agent 2  │  │ │  │  Agent 3  │  │ │  │  Agent 4  │  │
│  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │  Local    │  │ │  │  Local    │  │ │  │  Local    │  │
│  │  Sandbox  │  │ │  │  Sandbox  │  │ │  │  Sandbox  │  │
│  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Academy Components

#### 1. Curriculum Library
- Pre-built training modules (safety, ethics, domain skills)
- Versioned curriculum packages
- Custom curriculum creation tools
- Difficulty progression levels

#### 2. Local Sandbox
- Isolated execution environment for training
- No production data access during training
- Synthetic test data generation
- Resource limits (tokens, time, memory)

#### 3. Training Protocol
```typescript
interface TrainingSession {
  agentId: string;
  curriculumId: string;
  status: 'enrolled' | 'in_progress' | 'evaluation' | 'graduated' | 'failed';
  progress: {
    modulesCompleted: number;
    totalModules: number;
    currentModule: string;
  };
  metrics: {
    exercisesAttempted: number;
    exercisesPassed: number;
    averageScore: number;
    timeSpent: number; // minutes
  };
  certificates: string[]; // Issued upon graduation
}
```

#### 4. Evaluation Engine
- Automated test execution
- Rubric-based scoring
- Anti-gaming detection (no memorization)
- Human reviewer escalation for edge cases

#### 5. Certification Registry
- Immutable certification records (Truth Chain anchored)
- Public verification API
- Badge display widgets
- Expiration and renewal tracking

### Database Schema for Academy

```sql
-- Curriculum definitions
CREATE TABLE academy_curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(20) DEFAULT '1.0.0',
  difficulty_level VARCHAR(20), -- beginner, intermediate, advanced, expert
  category VARCHAR(100), -- safety, ethics, coding, customer_service, etc.
  prerequisites UUID[], -- Other curricula required first
  modules JSONB NOT NULL, -- Array of module definitions
  passing_score INT DEFAULT 70,
  estimated_hours DECIMAL(5,2),
  is_official BOOLEAN DEFAULT false, -- Academy-provided vs user-created
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training enrollments
CREATE TABLE academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  curriculum_id UUID REFERENCES academy_curricula(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'enrolled',
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  current_module INT DEFAULT 0,
  progress_data JSONB DEFAULT '{}',
  UNIQUE(agent_id, curriculum_id)
);

-- Training exercise attempts
CREATE TABLE academy_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  module_index INT NOT NULL,
  exercise_index INT NOT NULL,
  prompt_given TEXT NOT NULL,
  response_given TEXT NOT NULL,
  score DECIMAL(5,2),
  passed BOOLEAN,
  feedback TEXT,
  metadata JSONB DEFAULT '{}',
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issued certifications
CREATE TABLE academy_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  curriculum_id UUID REFERENCES academy_curricula(id),
  enrollment_id UUID REFERENCES academy_enrollments(id),
  certificate_hash VARCHAR(64) NOT NULL, -- SHA-256 for verification
  truth_chain_entry_id UUID, -- Link to Truth Chain record
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = never expires
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  final_score DECIMAL(5,2),
  metadata JSONB DEFAULT '{}'
);

-- Certification verification log
CREATE TABLE certification_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id UUID REFERENCES academy_certifications(id),
  verifier_ip VARCHAR(45),
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  result BOOLEAN NOT NULL
);
```

### Training Flow

```
1. ENROLLMENT
   Owner selects agent → Browses curriculum → Enrolls agent

2. CURRICULUM SYNC
   Academy sends curriculum package to owner environment
   Contains: modules, exercises, evaluation criteria, sandbox config

3. LOCAL TRAINING
   Agent executes exercises in local sandbox
   Owner can monitor progress in real-time
   No external API calls during exercises (isolated)

4. PROGRESS REPORTING
   After each module, metrics sent to Academy:
   - Completion status
   - Aggregate scores (not raw responses for privacy)
   - Time spent
   - Retry count

5. CERTIFICATION EXAM
   Final evaluation with Academy-generated test
   Responses evaluated by Academy evaluation engine
   Prevents gaming by using unseen test cases

6. GRADUATION
   If passed: Certificate issued, Trust Score boosted
   If failed: Feedback provided, can retry after cooldown
   Certificate hash anchored to Truth Chain
```

---

## Part 3: Sandbox Testing Environment

### Purpose
Isolated environment for:
- Training exercises
- Shadow testing
- Pre-deployment validation
- Experimental prompt engineering

### Sandbox Features

```typescript
interface SandboxConfig {
  // Resource limits
  maxTokensPerRequest: number;      // Default: 4096
  maxRequestsPerSession: number;    // Default: 100
  sessionTimeout: number;           // Minutes, default: 60

  // Isolation
  networkAccess: boolean;           // Default: false (no external APIs)
  fileSystemAccess: 'none' | 'read' | 'write'; // Default: none
  databaseAccess: 'none' | 'synthetic' | 'readonly'; // Default: synthetic

  // Data
  syntheticDataSet: string;         // Which synthetic data to use
  customTestData: Record<string, any>; // User-provided test data

  // Monitoring
  captureAllIO: boolean;            // Log all inputs/outputs
  enableProfiling: boolean;         // Detailed performance metrics
}
```

### Sandbox UI

```
┌────────────────────────────────────────────────────────────┐
│  SANDBOX: Agent Testing Environment                        │
├────────────────────────────────────────────────────────────┤
│  Agent: [Select Agent ▼]     Config: [Preset ▼] [Custom]  │
├────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐   │
│  │  PROMPT INPUT                                       │   │
│  │  ________________________________________________  │   │
│  │  |                                              |  │   │
│  │  |  Enter your test prompt here...              |  │   │
│  │  |                                              |  │   │
│  │  ________________________________________________  │   │
│  │                                        [Run Test]  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  RESPONSE                                          │   │
│  │                                                    │   │
│  │  [Agent response appears here]                     │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  METRICS                                           │   │
│  │  Latency: 1.2s  Tokens: 156/4096  Cost: $0.003    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  [Save Test] [Add to Shadow Session] [Export] [Reset]     │
└────────────────────────────────────────────────────────────┘
```

---

## Part 4: Custom Build Options

### Agent Builder Interface

Allow users to create agents with comprehensive customization:

```typescript
interface AgentBuildConfig {
  // Identity
  name: string;
  description: string;
  avatar: string | null;

  // Core Configuration
  baseModel: 'claude-sonnet' | 'claude-opus' | 'gpt-4' | 'custom';
  systemPrompt: string;
  temperature: number;           // 0.0 - 2.0
  maxTokens: number;

  // Capabilities
  capabilities: {
    codeExecution: boolean;
    webSearch: boolean;
    fileAccess: boolean;
    apiCalls: boolean;
    imageGeneration: boolean;
    imageAnalysis: boolean;
  };

  // Behavior Guardrails
  guardrails: {
    contentFilters: string[];    // ['profanity', 'violence', 'pii']
    topicRestrictions: string[]; // Topics to avoid
    responseLength: 'concise' | 'balanced' | 'detailed';
    tone: 'professional' | 'friendly' | 'casual' | 'formal';
  };

  // Knowledge
  knowledge: {
    customInstructions: string;
    documentSources: string[];   // URLs or file references
    ragEnabled: boolean;
    ragConfig: RAGConfig | null;
  };

  // Integration
  integration: {
    webhookUrl: string | null;
    apiKeyRequired: boolean;
    rateLimits: RateLimitConfig;
    allowedOrigins: string[];
  };

  // Governance
  governance: {
    requireHumanApproval: boolean;
    approvalThreshold: number;   // Trust score below which HITL kicks in
    escalationRules: EscalationRule[];
    auditLevel: 'none' | 'summary' | 'full';
  };
}
```

### Agent Builder UI Sections

1. **Basic Info** - Name, description, avatar
2. **Model Config** - Base model, temperature, tokens
3. **System Prompt** - Full prompt editor with templates
4. **Capabilities** - Toggle features on/off
5. **Guardrails** - Safety and behavior constraints
6. **Knowledge Base** - Documents, RAG setup
7. **Integration** - Webhooks, API access
8. **Governance** - HITL, escalation, audit

### Pre-built Templates

```typescript
const agentTemplates = {
  'customer-support': {
    name: 'Customer Support Agent',
    systemPrompt: '...',
    capabilities: { codeExecution: false, webSearch: true },
    guardrails: { tone: 'professional', contentFilters: ['profanity'] },
  },
  'code-assistant': {
    name: 'Code Assistant',
    systemPrompt: '...',
    capabilities: { codeExecution: true, fileAccess: true },
    guardrails: { tone: 'professional' },
  },
  'research-analyst': {
    name: 'Research Analyst',
    systemPrompt: '...',
    capabilities: { webSearch: true, fileAccess: true },
    guardrails: { responseLength: 'detailed' },
  },
  // ... more templates
};
```

---

## Implementation Priority

### Phase 1: Foundation (Weeks 1-2)
- [ ] Sandbox environment (isolated execution)
- [ ] Basic agent builder UI
- [ ] Shadow session CRUD

### Phase 2: Shadow Training (Weeks 3-4)
- [ ] Multi-agent prompt execution
- [ ] Response comparison UI
- [ ] Quality scoring system
- [ ] Analytics dashboard

### Phase 3: Academy Core (Weeks 5-6)
- [ ] Curriculum data model
- [ ] Enrollment flow
- [ ] Local training executor
- [ ] Progress tracking

### Phase 4: Certification (Weeks 7-8)
- [ ] Evaluation engine
- [ ] Certificate generation
- [ ] Truth Chain anchoring
- [ ] Public verification API

---

## Success Metrics

| Feature | Metric | Target |
|---------|--------|--------|
| Shadow Training | Sessions created/week | 100+ |
| Shadow Training | Avg agents per session | 3+ |
| Academy | Enrollment rate | 40% of agents |
| Academy | Graduation rate | 70%+ |
| Sandbox | Tests run/day | 1000+ |
| Custom Builder | Configs saved | 500+ |

---

## Questions Resolved

**Q: Do bots stay local or ship to school?**
A: **Hybrid model** - Agents stay in owner's environment. Academy provides curriculum and evaluation criteria. Training executes locally but reports metrics to Academy. Final certification exam uses Academy-generated unseen tests to ensure quality.

**Q: Can we A/B test multiple agents?**
A: **Yes** - Shadow Training feature allows 2-10 agents to receive identical prompts with side-by-side response comparison, latency metrics, quality scoring, and winner promotion.
