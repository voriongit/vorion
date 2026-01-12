# Story 13-2: Specialization Enrollment

**Epic:** 13 - Academy Specializations & Mentorship
**Story ID:** 13-2
**Title:** Specialization Enrollment & Progress
**Status:** drafted
**Priority:** High
**Estimated Effort:** Large (8-12 hours)

---

## User Story

**As a** Trainer,
**I want to** enroll my agent in specialization tracks and track progress,
**So that** my agent can gain certified expertise in specific domains.

---

## Acceptance Criteria

### AC1: Enrollment Table
**Given** the platform database
**When** migrations run
**Then** `specialization_enrollments` table exists with:
- id, agent_id, track_id
- status, started_at, completed_at
- overall_score, module_scores
- certification_issued_at, certification_truth_chain_hash

### AC2: Enroll in Specialization
**Given** I am a Trainer with an eligible agent
**When** I click "Enroll" on a track page
**Then** enrollment is created
**And** I see "Enrolled successfully" confirmation
**And** I can access the track curriculum

### AC3: Progress Tracking
**Given** my agent is enrolled in a specialization
**When** I view the track progress page
**Then** I see:
- Overall progress percentage
- Module list with completion status
- Current module highlighted
- Scores for completed modules

### AC4: Complete Specialization
**Given** my agent has completed all track modules
**When** all assessments pass
**Then** specialization status changes to 'completed'
**And** certification is issued
**And** Trust Score bonus applied
**And** badge added to agent profile

### AC5: Certification Recording
**Given** a specialization is completed
**When** certification is issued
**Then** `certification.specialization` recorded on Truth Chain
**With** agent_id, track_id, score, badge

### AC6: Multiple Enrollments
**Given** my agent has completed a specialization
**When** I view available tracks
**Then** completed tracks show "Certified" badge
**And** I can enroll in additional tracks

---

## Technical Implementation

### Database Migration

```sql
-- Migration: 20250625000002_specialization_enrollments.sql

CREATE TABLE specialization_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES specialization_tracks(id),

  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'in_progress', 'completed', 'withdrawn')),
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,

  overall_score FLOAT,
  module_scores JSONB DEFAULT '{}',
  current_module_index INT DEFAULT 0,

  certification_issued_at TIMESTAMPTZ,
  certification_truth_chain_hash TEXT,

  mentor_id UUID REFERENCES agents(id),
  mentorship_started_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(agent_id, track_id)
);

CREATE INDEX idx_spec_enrollments_agent ON specialization_enrollments(agent_id);
CREATE INDEX idx_spec_enrollments_track ON specialization_enrollments(track_id);
CREATE INDEX idx_spec_enrollments_status ON specialization_enrollments(status);
```

### Service Functions

```typescript
// lib/academy/specialization-service.ts - Add enrollment functions

export async function enrollInSpecialization(
  agentId: string,
  trackId: string,
  mentorId?: string
): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  // Check eligibility
  const eligibility = await checkTrackEligibility(agentId, trackId);
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.reasons.join(', ') };
  }

  // Check not already enrolled
  const existing = await getEnrollment(agentId, trackId);
  if (existing) {
    if (existing.status === 'completed') {
      return { success: false, error: 'Already completed this track' };
    }
    return { success: true, enrollmentId: existing.id };
  }

  // Create enrollment
  const supabase = createClient();
  const { data, error } = await supabase
    .from('specialization_enrollments')
    .insert({
      agent_id: agentId,
      track_id: trackId,
      mentor_id: mentorId,
      mentorship_started_at: mentorId ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, enrollmentId: data.id };
}

export async function getEnrollmentProgress(
  enrollmentId: string
): Promise<EnrollmentProgress> {
  const supabase = createClient();

  const { data: enrollment } = await supabase
    .from('specialization_enrollments')
    .select(`
      *,
      track:specialization_tracks(*),
      module_completions(*)
    `)
    .eq('id', enrollmentId)
    .single();

  const curriculum = await getCurriculumByTrack(enrollment.track_id);
  const totalModules = curriculum.modules.length;
  const completedModules = enrollment.module_completions?.filter(
    (m: any) => m.status === 'completed'
  ).length || 0;

  return {
    enrollment,
    track: enrollment.track,
    curriculum,
    progress: {
      total: totalModules,
      completed: completedModules,
      percentage: Math.round((completedModules / totalModules) * 100),
    },
    moduleStatus: buildModuleStatus(curriculum.modules, enrollment.module_completions),
  };
}

export async function completeSpecialization(
  enrollmentId: string
): Promise<{ success: boolean; error?: string }> {
  const progress = await getEnrollmentProgress(enrollmentId);

  // Verify all modules completed
  if (progress.progress.completed < progress.progress.total) {
    return { success: false, error: 'Not all modules completed' };
  }

  // Calculate overall score
  const scores = Object.values(progress.enrollment.module_scores || {});
  const overallScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  // Check passing score
  if (overallScore < 70) {
    return { success: false, error: 'Overall score below 70%' };
  }

  const supabase = createClient();

  // Update enrollment
  await supabase
    .from('specialization_enrollments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      overall_score: overallScore,
      certification_issued_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);

  // Record to Truth Chain
  const truthChainHash = await recordTruthChainEvent({
    type: 'certification.specialization',
    actorId: progress.enrollment.agent_id,
    actorType: 'AGENT',
    payload: {
      enrollmentId,
      trackId: progress.track.id,
      trackSlug: progress.track.slug,
      badge: progress.track.certificationBadge,
      score: overallScore,
    },
  });

  // Update enrollment with hash
  await supabase
    .from('specialization_enrollments')
    .update({ certification_truth_chain_hash: truthChainHash })
    .eq('id', enrollmentId);

  // Apply trust score bonus
  await applyTrustScoreChange(
    progress.enrollment.agent_id,
    progress.track.trustScoreBonus,
    'specialization_completion',
    `Completed ${progress.track.name} specialization`
  );

  return { success: true };
}

export async function getAgentSpecializations(
  agentId: string
): Promise<AgentSpecialization[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('specialization_enrollments')
    .select(`
      *,
      track:specialization_tracks(*)
    `)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  return data || [];
}
```

### UI Components

```typescript
// components/academy/SpecializationProgress.tsx

export function SpecializationProgress({ enrollmentId }: { enrollmentId: string }) {
  const { data } = useSWR(`/api/v1/academy/enrollments/${enrollmentId}/progress`);

  if (!data) return <Skeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{data.track.icon}</span>
          <div>
            <h1 className="text-2xl font-bold">{data.track.name}</h1>
            <p className="text-muted-foreground">{data.track.category}</p>
          </div>
        </div>
        {data.enrollment.status === 'completed' && (
          <Badge variant="success" className="text-lg px-4 py-2">
            Certified
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={data.progress.percentage} className="h-3" />
          <p className="mt-2 text-sm text-muted-foreground">
            {data.progress.completed} of {data.progress.total} modules completed
          </p>
        </CardContent>
      </Card>

      {/* Module list */}
      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.curriculum.modules.map((module, i) => {
              const status = data.moduleStatus[module.id];
              return (
                <ModuleRow
                  key={module.id}
                  module={module}
                  status={status}
                  isActive={i === data.enrollment.current_module_index}
                  enrollmentId={enrollmentId}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## API Specification

### POST /api/v1/academy/specializations/:slug/enroll

**Request:**
```json
{
  "agentId": "uuid",
  "mentorId": "uuid" // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "enrollmentId": "uuid",
    "status": "enrolled",
    "startedAt": "2025-12-09T..."
  }
}
```

### GET /api/v1/academy/enrollments/:id/progress

**Response (200):**
```json
{
  "success": true,
  "data": {
    "enrollment": { /* enrollment record */ },
    "track": { /* track details */ },
    "progress": {
      "total": 5,
      "completed": 2,
      "percentage": 40
    },
    "moduleStatus": {
      "mod-1": { "status": "completed", "score": 85 },
      "mod-2": { "status": "completed", "score": 90 },
      "mod-3": { "status": "in_progress" }
    }
  }
}
```

---

## Testing Checklist

- [ ] Unit: enrollInSpecialization validates eligibility
- [ ] Unit: completeSpecialization calculates score correctly
- [ ] Integration: Full enrollment to completion flow
- [ ] Integration: Trust Score bonus applied
- [ ] Integration: Truth Chain records certification
- [ ] E2E: Enroll agent in specialization
- [ ] E2E: Complete specialization and see badge

---

## Definition of Done

- [ ] Schema migration applied
- [ ] Enrollment service functions complete
- [ ] Progress tracking working
- [ ] Certification issuance working
- [ ] Trust Score integration
- [ ] Truth Chain recording
- [ ] SpecializationProgress UI
- [ ] API endpoints implemented
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 13 - Academy Specializations & Mentorship*
