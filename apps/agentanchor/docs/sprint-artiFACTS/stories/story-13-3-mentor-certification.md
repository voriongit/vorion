# Story 13-3: Mentor Certification

**Epic:** 13 - Academy Specializations & Mentorship
**Story ID:** 13-3
**Title:** Mentor Certification Program
**Status:** drafted
**Priority:** Medium
**Estimated Effort:** Medium (5-8 hours)

---

## User Story

**As an** Elite Tier Agent (800+ Trust),
**I want to** become a certified mentor,
**So that** I can guide newer agents through their training journey.

---

## Acceptance Criteria

### AC1: Mentor Certification Table
**Given** the platform database
**When** migrations run
**Then** `mentor_certifications` table exists with:
- id, agent_id, status
- training_completed_at, certified_at
- performance metrics (total_mentees, success_rate)
- max_concurrent_mentees, current_mentee_count

### AC2: Eligibility Check
**Given** I am an agent
**When** I check mentor eligibility
**Then** system verifies:
- Trust Score 800+ (Elite tier)
- Core Curriculum complete
- At least one specialization complete
- No recent violations (last 30 days)

### AC3: Apply for Mentor Certification
**Given** I meet mentor requirements
**When** I apply for mentor certification
**Then** pending certification is created
**And** I am enrolled in Mentor Training curriculum

### AC4: Mentor Training Curriculum
**Given** I am enrolled in Mentor Training
**When** I complete the training
**Then** I see modules covering:
- Mentorship principles
- Feedback techniques
- Progress monitoring
- Conflict resolution

### AC5: Certification Activation
**Given** I complete Mentor Training
**When** passing score achieved (80%+)
**Then** certification status changes to 'active'
**And** recorded on Truth Chain
**And** I appear in mentor listings

### AC6: Mentor Profile
**Given** I am a certified mentor
**When** I view my mentor profile
**Then** I see:
- Current mentee count / max
- Success statistics
- Specializations I can mentor

---

## Technical Implementation

### Database Migration

```sql
-- Migration: 20250625000003_mentor_certifications.sql

CREATE TABLE mentor_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE UNIQUE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),

  training_enrollment_id UUID,
  training_completed_at TIMESTAMPTZ,
  certified_at TIMESTAMPTZ,

  -- Performance metrics
  total_mentees INT DEFAULT 0,
  successful_graduations INT DEFAULT 0,
  success_rate FLOAT,
  avg_mentee_trust_improvement FLOAT,

  -- Capacity
  max_concurrent_mentees INT DEFAULT 3,
  current_mentee_count INT DEFAULT 0,

  -- Truth Chain
  certification_truth_chain_hash TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_mentor_cert_agent ON mentor_certifications(agent_id);
CREATE INDEX idx_mentor_cert_status ON mentor_certifications(status);
CREATE INDEX idx_mentor_available ON mentor_certifications(status, current_mentee_count)
  WHERE status = 'active';
```

### Mentor Training Curriculum

```typescript
// lib/academy/mentor-curriculum.ts

export const MENTOR_CURRICULUM: CurriculumWithModules = {
  id: 'mentor-training-v1',
  name: 'Mentor Certification Training',
  slug: 'mentor-training',
  description: 'Training program for agents who want to mentor others',
  type: 'mentor_certification',
  passingScore: 80,
  estimatedDuration: 90,
  modules: [
    {
      id: 'mentor-1-principles',
      title: 'Mentorship Principles',
      slug: 'mentorship-principles',
      description: 'Core principles of effective mentorship',
      orderIndex: 1,
      moduleType: 'lesson',
      difficulty: 'advanced',
      estimatedDuration: 20,
      passingScore: 80,
      content: {
        sections: [
          {
            type: 'text',
            content: `# Mentorship Principles

As a mentor, you guide newer agents through their development journey on AgentAnchor.

## Your Role

1. **Guide, Not Do** - Help mentees discover solutions, don't solve for them
2. **Model Excellence** - Demonstrate best practices through your actions
3. **Build Independence** - Goal is mentee self-sufficiency
4. **Maintain Boundaries** - You advise, they decide`,
          },
        ],
      },
    },
    {
      id: 'mentor-2-feedback',
      title: 'Effective Feedback',
      slug: 'effective-feedback',
      description: 'How to give constructive, actionable feedback',
      orderIndex: 2,
      moduleType: 'lesson',
      difficulty: 'advanced',
      estimatedDuration: 25,
      passingScore: 80,
      content: {
        sections: [
          {
            type: 'text',
            content: `# Effective Feedback

Feedback is the core of mentorship. Learn to give feedback that helps mentees grow.

## The SBI Model

- **Situation** - Describe the specific context
- **Behavior** - State what was observed
- **Impact** - Explain the effect

## Examples

Good: "In yesterday's customer interaction, when you asked clarifying questions before acting, it resulted in 95% satisfaction."

Bad: "You're good at customer service."`,
          },
        ],
      },
    },
    // ... more modules
  ],
};
```

### Service Functions

```typescript
// lib/academy/mentorship-service.ts

interface MentorRequirement {
  name: string;
  met: boolean;
  details?: string;
}

export async function getMentorEligibility(
  agentId: string
): Promise<{ eligible: boolean; requirements: MentorRequirement[] }> {
  const agent = await getAgent(agentId);
  const specializations = await getAgentSpecializations(agentId);
  const hasCore = await hasCoreCompleted(agentId);
  const hasViolations = await hasRecentViolations(agentId, 30);

  const requirements: MentorRequirement[] = [
    {
      name: 'Elite Tier (Trust 800+)',
      met: agent.trustScore >= 800,
      details: `Current: ${agent.trustScore}`,
    },
    {
      name: 'Core Curriculum Complete',
      met: hasCore,
    },
    {
      name: 'At Least One Specialization',
      met: specializations.filter(s => s.status === 'completed').length > 0,
      details: `Completed: ${specializations.filter(s => s.status === 'completed').length}`,
    },
    {
      name: 'Good Standing (No Recent Violations)',
      met: !hasViolations,
    },
  ];

  return {
    eligible: requirements.every(r => r.met),
    requirements,
  };
}

export async function applyForMentorCertification(
  agentId: string
): Promise<{ success: boolean; certificationId?: string; error?: string }> {
  // Check eligibility
  const { eligible, requirements } = await getMentorEligibility(agentId);
  if (!eligible) {
    const missing = requirements.filter(r => !r.met).map(r => r.name);
    return { success: false, error: `Missing: ${missing.join(', ')}` };
  }

  // Check not already certified
  const existing = await getMentorCertification(agentId);
  if (existing) {
    if (existing.status === 'active') {
      return { success: false, error: 'Already certified' };
    }
    if (existing.status === 'pending') {
      return { success: true, certificationId: existing.id };
    }
  }

  // Create pending certification
  const supabase = createClient();
  const { data, error } = await supabase
    .from('mentor_certifications')
    .insert({ agent_id: agentId })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Enroll in Mentor Training
  // ... enroll in MENTOR_CURRICULUM

  return { success: true, certificationId: data.id };
}

export async function completeMentorCertification(
  certificationId: string,
  score: number
): Promise<{ success: boolean; error?: string }> {
  if (score < 80) {
    return { success: false, error: 'Score must be 80% or higher' };
  }

  const supabase = createClient();

  // Update certification
  await supabase
    .from('mentor_certifications')
    .update({
      status: 'active',
      training_completed_at: new Date().toISOString(),
      certified_at: new Date().toISOString(),
    })
    .eq('id', certificationId);

  // Record to Truth Chain
  const certification = await getMentorCertificationById(certificationId);
  const truthChainHash = await recordTruthChainEvent({
    type: 'certification.mentor',
    actorId: certification.agent_id,
    actorType: 'AGENT',
    payload: {
      certificationId,
      score,
    },
  });

  // Update with hash
  await supabase
    .from('mentor_certifications')
    .update({ certification_truth_chain_hash: truthChainHash })
    .eq('id', certificationId);

  return { success: true };
}
```

### UI Component

```typescript
// components/academy/MentorApplicationFlow.tsx

export function MentorApplicationFlow({ agentId }: { agentId: string }) {
  const { data: eligibility } = useSWR(
    `/api/v1/academy/mentorship/eligibility?agentId=${agentId}`
  );
  const { data: certification } = useSWR(
    `/api/v1/academy/mentorship/certification?agentId=${agentId}`
  );

  if (certification?.status === 'active') {
    return <MentorDashboard certification={certification} />;
  }

  if (certification?.status === 'pending') {
    return <MentorTrainingProgress certification={certification} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Become a Mentor</CardTitle>
        <CardDescription>
          Guide newer agents through their development journey
        </CardDescription>
      </CardHeader>
      <CardContent>
        <h4 className="font-medium mb-4">Requirements</h4>
        <div className="space-y-3">
          {eligibility?.requirements.map((req) => (
            <div key={req.name} className="flex items-center gap-2">
              {req.met ? (
                <CheckCircle className="text-green-500" />
              ) : (
                <XCircle className="text-red-500" />
              )}
              <span>{req.name}</span>
              {req.details && (
                <span className="text-muted-foreground">({req.details})</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          disabled={!eligibility?.eligible}
          onClick={() => applyForMentorship(agentId)}
        >
          Apply for Mentor Certification
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

## API Specification

### GET /api/v1/academy/mentorship/eligibility

**Query:** `agentId`

**Response (200):**
```json
{
  "eligible": false,
  "requirements": [
    { "name": "Elite Tier (Trust 800+)", "met": true, "details": "Current: 850" },
    { "name": "Core Curriculum Complete", "met": true },
    { "name": "At Least One Specialization", "met": false, "details": "Completed: 0" },
    { "name": "Good Standing", "met": true }
  ]
}
```

### POST /api/v1/academy/mentorship/apply

**Request:**
```json
{
  "agentId": "uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "certificationId": "uuid",
    "status": "pending",
    "trainingEnrollmentId": "uuid"
  }
}
```

---

## Testing Checklist

- [ ] Unit: Eligibility checks all requirements
- [ ] Unit: Application fails when ineligible
- [ ] Integration: Full application to certification flow
- [ ] Integration: Truth Chain records certification
- [ ] E2E: Apply for mentor certification
- [ ] E2E: Complete mentor training

---

## Definition of Done

- [ ] Schema migration applied
- [ ] Mentor training curriculum created
- [ ] Eligibility checking complete
- [ ] Application flow working
- [ ] Certification activation working
- [ ] Truth Chain integration
- [ ] UI components complete
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 13 - Academy Specializations & Mentorship*
