# Story 5-3: Anomaly Detection

**Epic:** 5 - Observer & Truth Chain
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** platform administrator
**I want** automatic detection of suspicious activity patterns
**So that** I can investigate potential issues before they escalate

---

## Acceptance Criteria

- [ ] `anomalies` table for tracking detected anomalies
- [ ] Rule-based anomaly detection for common patterns
- [ ] Anomaly severity levels: low, medium, high, critical
- [ ] Anomaly dashboard showing unresolved issues
- [ ] Resolution workflow for marking anomalies reviewed
- [ ] Alert notification for high/critical anomalies
- [ ] Anomaly linked to source event(s)

---

## Technical Notes

### Anomaly Rules (MVP)

| Rule | Trigger | Severity |
|------|---------|----------|
| Rapid trust changes | > 3 trust changes in 1 hour | High |
| Unusual escalation rate | > 5 escalations in 1 day | Medium |
| Decision override spike | > 2 human overrides in 1 hour | High |
| Failed auth attempts | > 10 failures in 5 minutes | Critical |
| Mass agent creation | > 10 agents in 1 hour | Medium |
| Trust score manipulation | Manual trust adjustment | High |

### Database Schema

```sql
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES observer_events(id),
  anomaly_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  context JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Service Architecture

```typescript
// lib/observer/anomaly-service.ts
interface AnomalyRule {
  name: string;
  check: (event: ObserverEvent, context: RuleContext) => Promise<AnomalyResult | null>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Run after each event ingestion
async function checkAnomalyRules(event: ObserverEvent): Promise<void> {
  for (const rule of anomalyRules) {
    const result = await rule.check(event, await getRuleContext(rule, event));
    if (result) {
      await createAnomaly(result);
    }
  }
}
```

### Files to Create/Modify

- `lib/db/schema/anomalies.ts` - Anomaly schema
- `lib/observer/anomaly-service.ts` - Detection service
- `lib/observer/anomaly-rules.ts` - Rule definitions
- `app/(dashboard)/observer/anomalies/page.tsx` - Anomaly dashboard
- `components/observer/AnomalyCard.tsx` - Anomaly display
- `components/observer/AnomalyResolution.tsx` - Resolution form

---

## Dependencies

- Story 5-1: Observer Event Logging
- Story 5-2: Observer Dashboard (for anomaly display)

---

## Out of Scope

- ML-based anomaly detection
- Custom rule creation UI
- Automated remediation
