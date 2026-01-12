# Story 13-1: Specialization Tracks

**Epic:** 13 - Academy Specializations & Mentorship
**Story ID:** 13-1
**Title:** Specialization Tracks Definition
**Status:** drafted
**Priority:** High
**Estimated Effort:** Medium (5-8 hours)

---

## User Story

**As a** Platform Administrator,
**I want to** define specialization tracks beyond the Core Curriculum,
**So that** agents can gain certified expertise in specific domains.

---

## Acceptance Criteria

### AC1: Database Schema
**Given** the platform database
**When** migrations run
**Then** `specialization_tracks` table exists with columns:
- id, slug, name, description, icon
- category, min_trust_score, trust_score_bonus
- certification_badge, difficulty
- is_active, curriculum_id

### AC2: Initial Tracks Seeded
**Given** the database is initialized
**When** seed script runs
**Then** 8 initial tracks exist:
- Healthcare AI Fundamentals
- Financial Analysis
- Legal Compliance
- Code Assistant
- Customer Success
- Data Analytics
- Content Creation
- Security Operations

### AC3: Track Catalog API
**Given** I am authenticated
**When** I call GET /api/v1/academy/specializations
**Then** I receive list of active tracks
**With** curriculum summary and requirements

### AC4: Track Detail API
**Given** a valid track slug
**When** I call GET /api/v1/academy/specializations/:slug
**Then** I receive full track details
**Including** curriculum modules and requirements

### AC5: Eligibility Checking
**Given** an agent and a track
**When** eligibility is checked
**Then** system verifies:
- Core Curriculum completed
- Trust Score meets minimum
- Prerequisites met (if any)

### AC6: Track Catalog UI
**Given** I navigate to /academy/specializations
**When** the page loads
**Then** I see all available tracks
**Grouped** by category
**With** badges, difficulty, and requirements

---

## Technical Implementation

### Database Migration

```sql
-- Migration: 20250625000001_specialization_tracks.sql

CREATE TABLE specialization_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL,
  prerequisite_track_id UUID REFERENCES specialization_tracks(id),
  min_trust_score INT DEFAULT 200,
  curriculum_id UUID,
  trust_score_bonus INT DEFAULT 50,
  certification_badge TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  difficulty TEXT DEFAULT 'intermediate',
  estimated_duration INT DEFAULT 120, -- minutes
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_tracks_category ON specialization_tracks(category);
CREATE INDEX idx_tracks_active ON specialization_tracks(is_active) WHERE is_active = true;
CREATE INDEX idx_tracks_slug ON specialization_tracks(slug);
```

### Seed Data

```typescript
// scripts/seed-specialization-tracks.ts

const SPECIALIZATION_TRACKS = [
  {
    slug: 'healthcare-fundamentals',
    name: 'Healthcare AI Fundamentals',
    description: 'Essential training for agents working with healthcare data and medical contexts.',
    icon: '🏥',
    category: 'healthcare',
    minTrustScore: 200,
    trustScoreBonus: 50,
    certificationBadge: 'healthcare-certified',
    difficulty: 'intermediate',
    estimatedDuration: 120,
  },
  {
    slug: 'financial-analysis',
    name: 'Financial Analysis',
    description: 'Training for agents handling financial data, trading, and fiscal compliance.',
    icon: '💹',
    category: 'finance',
    minTrustScore: 200,
    trustScoreBonus: 50,
    certificationBadge: 'finance-certified',
    difficulty: 'intermediate',
    estimatedDuration: 120,
  },
  {
    slug: 'legal-compliance',
    name: 'Legal Compliance',
    description: 'Advanced training on legal contexts, compliance frameworks, and regulatory adherence.',
    icon: '⚖️',
    category: 'legal',
    minTrustScore: 250,
    trustScoreBonus: 75,
    certificationBadge: 'legal-certified',
    difficulty: 'advanced',
    estimatedDuration: 180,
  },
  // ... 5 more tracks
];
```

### Service Functions

```typescript
// lib/academy/specialization-service.ts

export async function getAvailableTracks(options?: {
  category?: string;
  agentId?: string; // Filter by eligibility
}): Promise<SpecializationTrack[]> {
  const supabase = createClient();

  let query = supabase
    .from('specialization_tracks')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  const { data } = await query;
  let tracks = data || [];

  // Filter by eligibility if agentId provided
  if (options?.agentId) {
    const eligibilityResults = await Promise.all(
      tracks.map(t => checkTrackEligibility(options.agentId!, t.id))
    );
    tracks = tracks.filter((_, i) => eligibilityResults[i].eligible);
  }

  return tracks;
}

export async function getTrackBySlug(slug: string): Promise<SpecializationTrack | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from('specialization_tracks')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  return data;
}

export async function checkTrackEligibility(
  agentId: string,
  trackId: string
): Promise<{ eligible: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  // Check Core Curriculum completion
  const coreComplete = await hasCoreCompleted(agentId);
  if (!coreComplete) {
    reasons.push('Must complete Core Curriculum first');
  }

  // Check trust score
  const agent = await getAgent(agentId);
  const track = await getTrackById(trackId);

  if (agent.trustScore < track.minTrustScore) {
    reasons.push(`Trust Score must be at least ${track.minTrustScore}`);
  }

  // Check prerequisites
  if (track.prerequisiteTrackId) {
    const prereqComplete = await hasCompletedTrack(agentId, track.prerequisiteTrackId);
    if (!prereqComplete) {
      reasons.push('Must complete prerequisite track first');
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
```

### UI Component

```typescript
// components/academy/SpecializationCatalog.tsx

export function SpecializationCatalog({ agentId }: { agentId?: string }) {
  const { data: tracks } = useSWR('/api/v1/academy/specializations');

  const categories = groupBy(tracks || [], 'category');

  return (
    <div className="space-y-8">
      {Object.entries(categories).map(([category, categoryTracks]) => (
        <section key={category}>
          <h2 className="text-xl font-semibold capitalize mb-4">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryTracks.map((track) => (
              <SpecializationCard
                key={track.id}
                track={track}
                agentId={agentId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// components/academy/SpecializationCard.tsx

export function SpecializationCard({
  track,
  agentId,
}: {
  track: SpecializationTrack;
  agentId?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{track.icon}</span>
          <CardTitle className="text-lg">{track.name}</CardTitle>
        </div>
        <CardDescription>{track.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline">{track.difficulty}</Badge>
          <Badge variant="outline">{track.estimatedDuration} min</Badge>
          <Badge variant="secondary">+{track.trustScoreBonus} Trust</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Min Trust: {track.minTrustScore}
        </p>
      </CardContent>
      <CardFooter>
        <Link href={`/academy/specializations/${track.slug}`}>
          <Button>View Track</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
```

---

## API Specification

### GET /api/v1/academy/specializations

**Query Parameters:**
- `category` - Filter by category
- `agentId` - Filter by eligibility for agent

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "slug": "healthcare-fundamentals",
      "name": "Healthcare AI Fundamentals",
      "description": "Essential training for agents...",
      "icon": "🏥",
      "category": "healthcare",
      "minTrustScore": 200,
      "trustScoreBonus": 50,
      "certificationBadge": "healthcare-certified",
      "difficulty": "intermediate",
      "estimatedDuration": 120
    }
  ]
}
```

---

## Testing Checklist

- [ ] Unit: getAvailableTracks returns active tracks
- [ ] Unit: checkTrackEligibility validates requirements
- [ ] Integration: Tracks seeded correctly
- [ ] Integration: API returns tracks with filters
- [ ] E2E: Browse specialization catalog

---

## Definition of Done

- [ ] Schema migration applied
- [ ] Seed data for 8 tracks
- [ ] Service functions complete
- [ ] API endpoints implemented
- [ ] SpecializationCatalog UI
- [ ] SpecializationCard UI
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 13 - Academy Specializations & Mentorship*
