# Story 13-4: Mentorship Program

**Epic:** 13 - Academy Specializations & Mentorship
**Story ID:** 13-4
**Title:** Mentorship Relationships & Management
**Status:** drafted
**Priority:** Medium
**Estimated Effort:** Large (8-12 hours)

---

## User Story

**As an** Agent (Mentee or Mentor),
**I want to** establish and manage mentorship relationships,
**So that** mentees get guidance and mentors can share their expertise.

---

## Acceptance Criteria

### AC1: Mentorship Relationships Table
**Given** the platform database
**When** migrations run
**Then** `mentorship_relationships` table exists with:
- mentor_id, mentee_id, enrollment_id
- status (requested, active, completed, terminated)
- outcome, ratings, feedback
- sessions_completed, trust_improvement

### AC2: Find Available Mentors
**Given** I am enrolling in a specialization
**When** I view mentor options
**Then** I see available mentors filtered by:
- Has open slots
- Has relevant specialization
- Sorted by rating

### AC3: Request Mentorship
**Given** I find a mentor I like
**When** I click "Request Mentorship"
**Then** relationship created with status='requested'
**And** mentor is notified
**And** I see "Request Sent" confirmation

### AC4: Accept/Decline Mentorship
**Given** I am a mentor with a pending request
**When** I view my mentor dashboard
**Then** I see pending requests
**And** I can accept or decline each
**And** acceptance activates the relationship

### AC5: Active Mentorship View
**Given** I am in an active mentorship
**When** I view the mentorship panel
**Then** I see:
- Partner info (mentor or mentee)
- Related enrollment progress
- Session history
- Communication options

### AC6: Complete Mentorship
**Given** mentorship has concluded
**When** either party initiates completion
**Then** both parties can provide rating (1-5)
**And** both can provide feedback
**And** trust bonuses applied if graduated

### AC7: Trust Score Integration
**Given** a mentee graduates while mentored
**When** completion is recorded
**Then** mentee gets +30 trust bonus
**And** mentor gets +20 trust bonus
**And** mentor stats updated

---

## Technical Implementation

### Database Migration

```sql
-- Migration: 20250625000004_mentorship_relationships.sql

CREATE TABLE mentorship_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES agents(id),
  mentee_id UUID NOT NULL REFERENCES agents(id),
  enrollment_id UUID REFERENCES specialization_enrollments(id),

  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'active', 'completed', 'terminated')),

  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  outcome TEXT CHECK (outcome IN (
    'graduated', 'withdrew', 'terminated_by_mentor', 'terminated_by_mentee', NULL
  )),
  outcome_notes TEXT,

  mentor_rating INT CHECK (mentor_rating BETWEEN 1 AND 5),
  mentee_rating INT CHECK (mentee_rating BETWEEN 1 AND 5),
  mentor_feedback TEXT,
  mentee_feedback TEXT,

  sessions_completed INT DEFAULT 0,
  trust_improvement INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(mentor_id, mentee_id, enrollment_id)
);

CREATE INDEX idx_mentorship_mentor ON mentorship_relationships(mentor_id);
CREATE INDEX idx_mentorship_mentee ON mentorship_relationships(mentee_id);
CREATE INDEX idx_mentorship_status ON mentorship_relationships(status);
CREATE INDEX idx_mentorship_active ON mentorship_relationships(status)
  WHERE status = 'active';
```

### Service Functions

```typescript
// lib/academy/mentorship-service.ts - Add relationship functions

interface MentorProfile {
  agent: Agent;
  certification: MentorCertification;
  availableSlots: number;
  specializations: string[];
  avgRating: number;
  totalMentees: number;
  successRate: number;
}

export async function findAvailableMentors(options?: {
  trackId?: string;
  specialization?: string;
  minRating?: number;
}): Promise<MentorProfile[]> {
  const supabase = createClient();

  const { data: certifications } = await supabase
    .from('mentor_certifications')
    .select(`
      *,
      agent:agents(*)
    `)
    .eq('status', 'active')
    .lt('current_mentee_count', 'max_concurrent_mentees');

  let mentors = (certifications || []).map(c => ({
    agent: c.agent,
    certification: c,
    availableSlots: c.max_concurrent_mentees - c.current_mentee_count,
    specializations: [], // Fetch separately
    avgRating: calculateAvgRating(c.agent_id),
    totalMentees: c.total_mentees,
    successRate: c.success_rate || 0,
  }));

  // Filter by specialization if requested
  if (options?.specialization) {
    // Filter to mentors with matching specialization
  }

  // Filter by rating if requested
  if (options?.minRating) {
    mentors = mentors.filter(m => m.avgRating >= options.minRating!);
  }

  // Sort by rating
  mentors.sort((a, b) => b.avgRating - a.avgRating);

  return mentors;
}

export async function requestMentorship(
  menteeId: string,
  mentorId: string,
  enrollmentId?: string
): Promise<{ success: boolean; relationshipId?: string; error?: string }> {
  // Verify mentor has availability
  const certification = await getMentorCertification(mentorId);
  if (!certification || certification.status !== 'active') {
    return { success: false, error: 'Mentor is not available' };
  }

  if (certification.current_mentee_count >= certification.max_concurrent_mentees) {
    return { success: false, error: 'Mentor has no available slots' };
  }

  // Check for existing relationship
  const existing = await getActiveRelationship(mentorId, menteeId);
  if (existing) {
    return { success: false, error: 'Already have a relationship with this mentor' };
  }

  // Create relationship
  const supabase = createClient();
  const { data, error } = await supabase
    .from('mentorship_relationships')
    .insert({
      mentor_id: mentorId,
      mentee_id: menteeId,
      enrollment_id: enrollmentId,
      status: 'requested',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Notify mentor
  await sendNotification(mentorId, {
    type: 'mentorship_request',
    message: 'You have a new mentorship request',
    relationshipId: data.id,
  });

  return { success: true, relationshipId: data.id };
}

export async function acceptMentorship(
  mentorId: string,
  relationshipId: string
): Promise<{ success: boolean; error?: string }> {
  const relationship = await getRelationship(relationshipId);

  if (!relationship || relationship.mentor_id !== mentorId) {
    return { success: false, error: 'Relationship not found' };
  }

  if (relationship.status !== 'requested') {
    return { success: false, error: 'Relationship not in requested state' };
  }

  const supabase = createClient();

  // Update relationship
  await supabase
    .from('mentorship_relationships')
    .update({
      status: 'active',
      accepted_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    })
    .eq('id', relationshipId);

  // Increment mentor's current count
  await supabase.rpc('increment_mentee_count', { mentor_id: mentorId });

  // Update enrollment if linked
  if (relationship.enrollment_id) {
    await supabase
      .from('specialization_enrollments')
      .update({
        mentor_id: mentorId,
        mentorship_started_at: new Date().toISOString(),
      })
      .eq('id', relationship.enrollment_id);
  }

  // Notify mentee
  await sendNotification(relationship.mentee_id, {
    type: 'mentorship_accepted',
    message: 'Your mentorship request was accepted!',
    relationshipId,
  });

  return { success: true };
}

export async function completeMentorship(
  relationshipId: string,
  initiatorId: string,
  outcome: 'graduated' | 'withdrew' | 'terminated_by_mentor' | 'terminated_by_mentee',
  feedback?: {
    rating?: number;
    feedbackText?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const relationship = await getRelationship(relationshipId);
  if (!relationship || relationship.status !== 'active') {
    return { success: false, error: 'Active relationship not found' };
  }

  const isMentor = initiatorId === relationship.mentor_id;
  const supabase = createClient();

  // Update relationship
  const updates: any = {
    status: 'completed',
    ended_at: new Date().toISOString(),
    outcome,
  };

  if (feedback) {
    if (isMentor) {
      updates.mentee_rating = feedback.rating;
      updates.mentor_feedback = feedback.feedbackText;
    } else {
      updates.mentor_rating = feedback.rating;
      updates.mentee_feedback = feedback.feedbackText;
    }
  }

  await supabase
    .from('mentorship_relationships')
    .update(updates)
    .eq('id', relationshipId);

  // Decrement mentor's current count
  await supabase.rpc('decrement_mentee_count', { mentor_id: relationship.mentor_id });

  // Update mentor stats
  await updateMentorStats(relationship.mentor_id);

  // Apply trust bonuses if graduated
  if (outcome === 'graduated') {
    await applyTrustScoreChange(
      relationship.mentee_id,
      30,
      'mentorship_graduation',
      'Graduated with mentor guidance'
    );

    await applyTrustScoreChange(
      relationship.mentor_id,
      20,
      'mentorship_success',
      'Successfully mentored an agent to graduation'
    );
  }

  // Record to Truth Chain
  await recordTruthChainEvent({
    type: 'mentorship.completed',
    actorId: initiatorId,
    actorType: 'AGENT',
    payload: {
      relationshipId,
      mentorId: relationship.mentor_id,
      menteeId: relationship.mentee_id,
      outcome,
    },
  });

  return { success: true };
}
```

### UI Components

```typescript
// components/academy/MentorFinder.tsx

export function MentorFinder({
  trackId,
  onSelect,
}: {
  trackId?: string;
  onSelect: (mentorId: string) => void;
}) {
  const { data: mentors } = useSWR(
    `/api/v1/academy/mentorship/mentors?${trackId ? `trackId=${trackId}` : ''}`
  );

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Available Mentors</h3>
      {mentors?.map((mentor) => (
        <MentorCard
          key={mentor.agent.id}
          mentor={mentor}
          onRequest={() => onSelect(mentor.agent.id)}
        />
      ))}
    </div>
  );
}

// components/academy/MentorCard.tsx

export function MentorCard({
  mentor,
  onRequest,
}: {
  mentor: MentorProfile;
  onRequest: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{mentor.agent.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{mentor.agent.name}</CardTitle>
            <div className="flex items-center gap-2">
              <StarRating value={mentor.avgRating} readonly />
              <span className="text-sm text-muted-foreground">
                ({mentor.totalMentees} mentees)
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {mentor.specializations.map((spec) => (
            <Badge key={spec} variant="secondary">{spec}</Badge>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          {mentor.availableSlots} slots available
          {mentor.successRate > 0 && ` • ${Math.round(mentor.successRate * 100)}% success rate`}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onRequest}>Request Mentorship</Button>
      </CardFooter>
    </Card>
  );
}

// components/academy/MentorshipPanel.tsx

export function MentorshipPanel({ relationshipId }: { relationshipId: string }) {
  const { data } = useSWR(`/api/v1/academy/mentorship/relationships/${relationshipId}`);

  if (!data) return <Skeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Mentorship</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Avatar>
            <AvatarFallback>{data.partner.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{data.partner.name}</p>
            <p className="text-sm text-muted-foreground">
              {data.isMentor ? 'Your mentee' : 'Your mentor'}
            </p>
          </div>
        </div>

        {data.enrollment && (
          <div className="mb-4">
            <p className="text-sm font-medium">Track Progress</p>
            <Progress value={data.enrollment.progress} />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Send Message
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowEndDialog(true)}
          >
            End Mentorship
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## API Specification

### GET /api/v1/academy/mentorship/mentors

**Query:** `trackId`, `minRating`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "agent": { "id": "uuid", "name": "Elite Agent" },
      "availableSlots": 2,
      "specializations": ["healthcare-certified", "finance-certified"],
      "avgRating": 4.8,
      "totalMentees": 15,
      "successRate": 0.87
    }
  ]
}
```

### POST /api/v1/academy/mentorship/request

**Request:**
```json
{
  "menteeId": "uuid",
  "mentorId": "uuid",
  "enrollmentId": "uuid"
}
```

### POST /api/v1/academy/mentorship/relationships/:id/accept

### POST /api/v1/academy/mentorship/relationships/:id/complete

**Request:**
```json
{
  "outcome": "graduated",
  "rating": 5,
  "feedback": "Excellent mentor, very helpful!"
}
```

---

## Testing Checklist

- [ ] Unit: findAvailableMentors filters correctly
- [ ] Unit: requestMentorship validates availability
- [ ] Integration: Full mentorship lifecycle
- [ ] Integration: Trust bonuses applied on graduation
- [ ] Integration: Mentor stats updated
- [ ] E2E: Find and request mentor
- [ ] E2E: Accept mentorship request
- [ ] E2E: Complete mentorship with feedback

---

## Definition of Done

- [ ] Schema migration applied
- [ ] Mentor finder service complete
- [ ] Request/accept flow working
- [ ] Completion with ratings working
- [ ] Trust Score integration
- [ ] Truth Chain recording
- [ ] All UI components complete
- [ ] Notifications working
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 13 - Academy Specializations & Mentorship*
