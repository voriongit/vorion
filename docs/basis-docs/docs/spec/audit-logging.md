---
sidebar_position: 6
title: Audit Logging
description: Logging, chaining, and retention requirements
---

# Audit Logging

## Record Schema

```typescript
interface AuditRecord {
  recordId: string;
  version: "1.2";
  
  // Chain
  hash: string;
  previousHash: string;
  sequenceNumber: number;
  
  // Temporal
  timestamp: ISO8601;
  
  // Subject
  agentId: string;
  sessionId: string;
  
  // Event
  eventType: AuditEventType;
  data: Record<string, any>;
  
  // Integrity
  signature: string;
  
  // Anchor (if applicable)
  anchor?: AnchorInfo;
}
```

## Event Types

- `intent_evaluated`
- `gate_decision`
- `escalation_created`
- `escalation_resolved`
- `action_executed`
- `incident_reported`

## Requirements

**REQ-AUD-001**: All governance decisions MUST be logged.

**REQ-AUD-002**: Logs MUST be append-only.

**REQ-AUD-003**: Logs MUST be cryptographically chained.

**REQ-AUD-004**: Logs MUST be retained for minimum 7 years.

**REQ-AUD-005**: HIGH risk events MUST be blockchain anchored.
