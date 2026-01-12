# Story 14-5: Validator Fine-Tuning Pipeline

**Epic:** 14 - Precedent Flywheel
**Story ID:** 14-5
**Title:** Validator Prompt Refinement Pipeline
**Status:** drafted
**Priority:** Low (Future Enhancement)
**Estimated Effort:** Large (8-12 hours)

---

## User Story

**As a** Platform Administrator,
**I want to** refine validator prompts based on accumulated precedent data,
**So that** Council decisions improve measurably over time.

---

## Acceptance Criteria

### AC1: Training Data Export
**Given** precedent data exists
**When** I request training data export
**Then** I receive structured data suitable for prompt refinement:
- High-quality decisions (consistency score > 0.8)
- Decision context and outcomes
- Validator reasoning patterns

### AC2: Prompt Version Management
**Given** multiple prompt versions exist
**When** I view the prompt manager
**Then** I see all versions for each validator
**With** associated metrics (decisions made, consistency score)

### AC3: Create New Prompt Version
**Given** I want to create a new prompt version
**When** I submit the new prompt
**Then** version is created with metadata
**And** linked to training data used

### AC4: Activate Prompt Version
**Given** a new prompt version exists
**When** I activate it
**Then** previous version is deactivated
**And** new version used for all future evaluations
**And** activation is logged

### AC5: Rollback Capability
**Given** an active prompt version underperforms
**When** I initiate rollback
**Then** previous version is reactivated
**And** rollback is logged with reason

### AC6: A/B Testing (Future)
**Given** multiple prompt versions exist
**When** A/B testing is enabled
**Then** requests are split between versions
**And** metrics collected for comparison

---

## Technical Implementation

### Database Schema

```sql
-- Migration: 20250620000005_prompt_versions.sql

CREATE TABLE validator_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validator_id TEXT NOT NULL, -- guardian, arbiter, scholar, etc.
  version INT NOT NULL,
  prompt_template TEXT NOT NULL,

  -- Training metadata
  based_on_precedent_count INT DEFAULT 0,
  training_date_range JSONB,
  training_notes TEXT,

  -- Performance tracking
  decisions_made INT DEFAULT 0,
  consistency_score_at_creation FLOAT,
  current_consistency_score FLOAT,

  -- Status
  is_active BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,

  UNIQUE(validator_id, version)
);

CREATE INDEX idx_prompt_validator ON validator_prompt_versions(validator_id);
CREATE INDEX idx_prompt_active ON validator_prompt_versions(is_active)
  WHERE is_active = true;

-- Prompt version change log
CREATE TABLE prompt_version_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id UUID NOT NULL REFERENCES validator_prompt_versions(id),
  change_type TEXT NOT NULL, -- created, activated, deactivated, rollback
  changed_by UUID,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_prompt_changes_version ON prompt_version_changes(prompt_version_id);
```

### Fine-Tuning Service

```typescript
// lib/council/fine-tuning-service.ts

interface TrainingDataset {
  validatorId: string;
  decisions: TrainingDecision[];
  metadata: {
    fromDate: Date;
    toDate: Date;
    totalDecisions: number;
    avgConsistencyScore: number;
  };
}

interface TrainingDecision {
  decisionId: string;
  actionType: string;
  actionContext: string;
  riskLevel: number;
  outcome: string;
  validatorVote: {
    vote: string;
    confidence: number;
    reasoning: string;
  };
  consistencyScore: number;
}

export async function exportTrainingData(
  validatorId: string,
  options?: {
    fromDate?: Date;
    toDate?: Date;
    minConsistencyScore?: number;
  }
): Promise<TrainingDataset> {
  const minScore = options?.minConsistencyScore ?? 0.8;

  // Fetch high-quality decisions
  const decisions = await db.query.councilDecisions.findMany({
    where: and(
      options?.fromDate ? gte(councilDecisions.createdAt, options.fromDate) : undefined,
      options?.toDate ? lte(councilDecisions.createdAt, options.toDate) : undefined,
    ),
    with: {
      consistencyLog: true,
    },
  });

  // Filter by consistency and extract validator-specific data
  const trainingDecisions: TrainingDecision[] = decisions
    .filter(d => d.consistencyLog?.consistencyScore >= minScore)
    .map(d => {
      const validatorVote = d.votes?.find(v => v.validatorId === validatorId);
      if (!validatorVote) return null;

      return {
        decisionId: d.id,
        actionType: d.subjectAction,
        actionContext: JSON.stringify(d.subjectContext),
        riskLevel: d.riskLevel,
        outcome: d.status,
        validatorVote: {
          vote: validatorVote.vote,
          confidence: validatorVote.confidence,
          reasoning: validatorVote.reasoning,
        },
        consistencyScore: d.consistencyLog.consistencyScore,
      };
    })
    .filter(Boolean) as TrainingDecision[];

  return {
    validatorId,
    decisions: trainingDecisions,
    metadata: {
      fromDate: options?.fromDate || new Date(0),
      toDate: options?.toDate || new Date(),
      totalDecisions: trainingDecisions.length,
      avgConsistencyScore:
        trainingDecisions.reduce((sum, d) => sum + d.consistencyScore, 0) /
        trainingDecisions.length,
    },
  };
}

export async function createPromptVersion(
  validatorId: string,
  promptTemplate: string,
  metadata: {
    basedOnPrecedentCount: number;
    trainingDateRange: { from: Date; to: Date };
    trainingNotes?: string;
  },
  createdBy: string
): Promise<PromptVersion> {
  // Get next version number
  const latestVersion = await db.query.validatorPromptVersions.findFirst({
    where: eq(validatorPromptVersions.validatorId, validatorId),
    orderBy: desc(validatorPromptVersions.version),
  });

  const newVersion = (latestVersion?.version || 0) + 1;

  // Get current consistency score for baseline
  const metrics = await getValidatorConsistencyMetrics(validatorId);

  const [version] = await db.insert(validatorPromptVersions).values({
    validatorId,
    version: newVersion,
    promptTemplate,
    basedOnPrecedentCount: metadata.basedOnPrecedentCount,
    trainingDateRange: metadata.trainingDateRange,
    trainingNotes: metadata.trainingNotes,
    consistencyScoreAtCreation: metrics.avgScore,
    createdBy,
  }).returning();

  // Log change
  await logPromptChange(version.id, 'created', createdBy);

  return version;
}

export async function activatePromptVersion(
  validatorId: string,
  version: number,
  activatedBy: string
): Promise<void> {
  // Deactivate current version
  await db.update(validatorPromptVersions)
    .set({
      isActive: false,
      deactivatedAt: new Date(),
      deactivationReason: 'Superseded by new version',
    })
    .where(and(
      eq(validatorPromptVersions.validatorId, validatorId),
      eq(validatorPromptVersions.isActive, true)
    ));

  // Activate new version
  await db.update(validatorPromptVersions)
    .set({
      isActive: true,
      activatedAt: new Date(),
    })
    .where(and(
      eq(validatorPromptVersions.validatorId, validatorId),
      eq(validatorPromptVersions.version, version)
    ));

  // Log change
  const newVersion = await getPromptVersion(validatorId, version);
  await logPromptChange(newVersion.id, 'activated', activatedBy);
}

export async function getActivePromptVersion(
  validatorId: string
): Promise<PromptVersion | null> {
  return db.query.validatorPromptVersions.findFirst({
    where: and(
      eq(validatorPromptVersions.validatorId, validatorId),
      eq(validatorPromptVersions.isActive, true)
    ),
  });
}

export async function rollbackPromptVersion(
  validatorId: string,
  toVersion: number,
  reason: string,
  rolledBackBy: string
): Promise<void> {
  await activatePromptVersion(validatorId, toVersion, rolledBackBy);

  // Log as rollback specifically
  const version = await getPromptVersion(validatorId, toVersion);
  await logPromptChange(version.id, 'rollback', rolledBackBy, reason);
}
```

### UI Components

```typescript
// app/(dashboard)/admin/validators/prompts/page.tsx

export default function PromptVersionManager() {
  const validators = ['guardian', 'arbiter', 'scholar', 'advocate', 'economist',
                      'sentinel', 'adversary', 'oracle', 'orchestrator'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1>Validator Prompt Manager</h1>
        <Button onClick={() => setShowExportDialog(true)}>
          Export Training Data
        </Button>
      </div>

      <Tabs defaultValue="guardian">
        <TabsList>
          {validators.map(v => (
            <TabsTrigger key={v} value={v}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        {validators.map(v => (
          <TabsContent key={v} value={v}>
            <ValidatorPromptVersions validatorId={v} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ValidatorPromptVersions({ validatorId }: { validatorId: string }) {
  const { data: versions } = useSWR(`/api/v1/admin/validators/${validatorId}/prompts`);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          Create New Version
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Decisions Made</TableHead>
            <TableHead>Consistency Score</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions?.map((v) => (
            <TableRow key={v.id}>
              <TableCell>v{v.version}</TableCell>
              <TableCell>
                <Badge variant={v.isActive ? 'default' : 'secondary'}>
                  {v.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell>{v.decisionsMade}</TableCell>
              <TableCell>
                {Math.round((v.currentConsistencyScore || 0) * 100)}%
              </TableCell>
              <TableCell>{formatDate(v.createdAt)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="ghost" size="sm">...</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => viewPrompt(v)}>
                      View Prompt
                    </DropdownMenuItem>
                    {!v.isActive && (
                      <DropdownMenuItem onClick={() => activate(v)}>
                        Activate
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## API Specification

### GET /api/v1/admin/validators/:id/prompts

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "version": 3,
      "isActive": true,
      "decisionsMade": 450,
      "consistencyScoreAtCreation": 0.82,
      "currentConsistencyScore": 0.87,
      "createdAt": "2025-12-01T..."
    }
  ]
}
```

### POST /api/v1/admin/validators/:id/prompts

**Request:**
```json
{
  "promptTemplate": "You are the Guardian validator...",
  "basedOnPrecedentCount": 1500,
  "trainingDateRange": {
    "from": "2025-01-01",
    "to": "2025-12-01"
  },
  "trainingNotes": "Refined based on Q4 governance patterns"
}
```

### POST /api/v1/admin/validators/:id/prompts/:version/activate

**Response (200):**
```json
{
  "success": true,
  "message": "Prompt version 4 activated for arbiter"
}
```

---

## Testing Checklist

- [ ] Unit: Training data export filters correctly
- [ ] Unit: Version numbering increments properly
- [ ] Integration: Create and activate prompt version
- [ ] Integration: Rollback works correctly
- [ ] Integration: Active prompt used in evaluations
- [ ] E2E: Full prompt version lifecycle

---

## Definition of Done

- [ ] Schema migration applied
- [ ] Training data export working
- [ ] Prompt version CRUD operations
- [ ] Activation/rollback flow complete
- [ ] Version change logging
- [ ] Admin UI for prompt management
- [ ] API endpoints implemented
- [ ] Unit tests passing
- [ ] Code reviewed

---

*Story drafted: 2025-12-09*
*Epic: 14 - Precedent Flywheel*
