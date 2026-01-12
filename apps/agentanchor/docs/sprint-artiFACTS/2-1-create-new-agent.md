# Story 2-1: Create New Agent

**Epic:** 2 - Agent Creation & Academy
**Status:** Done
**Priority:** High

---

## User Story

**As a** trainer on AgentAnchor,
**I want to** create a new AI agent with customizable settings,
**So that** I can define its personality, capabilities, and behavior before training.

---

## Acceptance Criteria

- [x] Trainer can access "Create Agent" from navigation
- [x] Form validates required fields (name, system prompt) before submission
- [x] New agent is created with status="draft", trust_score=0, trust_tier="untrusted"
- [x] Agent appears in trainer's agent list
- [x] Trust badge shows correct tier
- [x] Agent detail page displays all information
- [x] API endpoints handle CRUD operations

---

## Tasks Completed

### Task 1: Database Migration
- Created `supabase/migrations/20250129000000_agents_evolution.sql`
- Added governance columns to bots table (trust_score, trust_tier, certification_level, status, etc.)
- Created trust_history table for tracking score changes
- Created academy_curriculum table with seed data
- Created academy_enrollments table
- Created council_examinations table
- Added calculate_trust_tier function
- Added RLS policies for all new tables

### Task 2: TypeScript Types
- Created `lib/agents/types.ts` with:
  - Agent interface with all governance fields
  - Trust types (TrustTier, TrustSource, TrustHistoryEntry)
  - Academy types (Curriculum, Enrollment, Module)
  - Council types (Examination, ValidatorVote)
  - Form input types (CreateAgentInput, UpdateAgentInput)
  - Constants (TRUST_TIERS, SPECIALIZATIONS, CAPABILITIES, etc.)
  - Utility functions (getTrustTierFromScore, etc.)

### Task 3: UI Components
- Created `components/agents/TrustBadge.tsx`:
  - TrustBadge with tier icons and colors
  - TrustScoreIndicator with progress bar
  - CertificationBadge with level display
- Created `components/agents/AgentCard.tsx`:
  - Full agent card with menu actions
  - AgentListItem compact variant
  - Status badge, trust badge, capabilities
- Created `components/agents/AgentForm.tsx`:
  - Full form with validation
  - Basic info section (name, description, specialization)
  - System prompt editor
  - Personality traits and capabilities selection
  - Advanced settings (model, temperature, max_tokens)
  - API submission handling

### Task 4: API Endpoints
- Created `app/api/agents/route.ts`:
  - GET: List agents with pagination and status filter
  - POST: Create new agent with validation
  - Records initial trust history entry
- Created `app/api/agents/[id]/route.ts`:
  - GET: Fetch single agent with optional relations
  - PUT: Update agent with status transition validation
  - DELETE: Soft delete (archive)

### Task 5: Pages
- Updated `app/(dashboard)/agents/page.tsx`:
  - Stats cards (total, training, active, certified)
  - Agent grid with AgentCard components
  - Empty state with CTA
- Created `app/(dashboard)/agents/new/page.tsx`:
  - AgentForm with navigation
- Created `app/(dashboard)/agents/[id]/page.tsx`:
  - Full agent detail view
  - Trust score section with history
  - Academy enrollments section
  - Configuration sidebar
  - Quick actions

---

## Technical Notes

1. **Backward Compatibility**: Existing `bots` table is enhanced, not replaced
2. **Trust Calculation**: Trust tier auto-calculated via database trigger
3. **Soft Delete**: Agents are archived, not permanently deleted
4. **Default Values**: New agents start with status=draft, trust_score=0

---

## Files Created/Modified

### Created
- `supabase/migrations/20250129000000_agents_evolution.sql`
- `lib/agents/types.ts`
- `components/agents/TrustBadge.tsx`
- `components/agents/AgentCard.tsx`
- `components/agents/AgentForm.tsx`
- `components/agents/index.ts`
- `app/api/agents/route.ts`
- `app/api/agents/[id]/route.ts`
- `app/(dashboard)/agents/new/page.tsx`
- `app/(dashboard)/agents/[id]/page.tsx`
- `docs/sprint-artiFACTS/tech-spec-epic-2.md`

### Modified
- `app/(dashboard)/agents/page.tsx` - Full implementation
- `docs/sprint-artiFACTS/sprint-status.yaml` - Updated status

---

## Definition of Done

- [x] Code compiles without errors
- [x] All acceptance criteria met
- [x] API endpoints functional
- [x] UI components render correctly
- [x] Database migration created
- [x] Story documentation complete
