# Story 8.6: Urgency Level Configuration

## Story
**As an** administrator
**I want** to configure urgency rules for approval requests
**So that** my team sees appropriate priority levels

## Status: Done

## Acceptance Criteria
- [x] View current urgency rules
- [x] Set default urgency level
- [x] Configure escalation timeouts per level
- [x] Enable/disable individual rules
- [x] Edit rule button for future editing
- [x] Visual urgency level indicators
- [x] Accessible form controls

## Technical Notes

### Components Created
- `UrgencyConfigPanel` - Main configuration interface
- `UrgencyRuleCard` - Individual rule display/toggle

### Types Added
```typescript
interface UrgencyRule {
    id: string;
    name: string;
    description: string;
    condition: {
        field: string;
        operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches';
        value: string | number;
    };
    urgencyLevel: 'low' | 'medium' | 'high' | 'immediate';
    enabled: boolean;
    priority: number;
}

interface UrgencyRuleConfig {
    orgId: string;
    defaultUrgency: string;
    rules: UrgencyRule[];
    escalationTimeouts: {
        low: number;
        medium: number;
        high: number;
    };
}
```

### API Endpoints
- `GET /mission-control/settings/urgency` - Get current config
- `PUT /mission-control/settings/urgency` - Update config

### Helper Functions
- `getUrgencyColor(level)` - Returns color for urgency badge
  - low: green (#10b981)
  - medium: amber (#f59e0b)
  - high: orange (#f97316)
  - immediate: red (#ef4444)

### Escalation Timeouts
- Low: 60 minutes (3600000ms)
- Medium: 30 minutes (1800000ms)
- High: 15 minutes (900000ms)
- Immediate: No timeout, immediate attention required

## Implementation Details
- Rules evaluated in priority order
- First matching rule determines urgency
- Default urgency used when no rules match
- Timeouts trigger escalation notifications

### Sample Rules
```typescript
{
    name: "High Impact Actions",
    description: "Actions affecting more than 100 records",
    condition: {
        field: "affected_records",
        operator: "greater_than",
        value: 100
    },
    urgencyLevel: "high"
}
```

## Definition of Done
- [x] Code complete with tests
- [x] Rules displayed with toggle controls
- [x] Timeout values formatted for readability
- [x] Color-coded urgency indicators
- [x] Accessible form elements
