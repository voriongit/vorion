# Story 7-3: Escalation Notifications

**Epic:** 7 - Dashboard & Notifications
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** trainer
**I want** immediate notifications when my agents require human escalation
**So that** I can respond to high-risk situations promptly

---

## Acceptance Criteria

- [ ] Notification sent when L4 escalation triggered for user's agent
- [ ] Multiple channels: in-app, email, optional push
- [ ] In-app notification appears immediately (real-time)
- [ ] Email sent within 1 minute of escalation
- [ ] Notification includes: agent name, risk level, decision context, action required
- [ ] Direct link to escalation review page
- [ ] Escalation notifications marked as "Critical" priority
- [ ] Sound/visual alert for in-app critical notifications

---

## Technical Notes

### Notification Payload

```typescript
interface EscalationNotification {
  type: 'escalation';
  priority: 'critical';
  title: string;           // "Human Escalation Required"
  message: string;         // "Agent [name] triggered L4 escalation for [action]"
  agentId: string;
  agentName: string;
  escalationId: string;
  riskLevel: number;
  decisionContext: string;
  actionUrl: string;       // Link to review page
}
```

### Email Template

```
Subject: [URGENT] Human Escalation Required - {agentName}

Your agent {agentName} has triggered a Level 4 (Human Required) escalation.

Action: {decisionContext}
Risk Level: {riskLevel}/100

This decision requires your immediate review and approval.

[Review Escalation] (button)

This notification was sent because you are the trainer of {agentName}.
```

### Integration Points

- Hook into Epic 3 escalation flow (`lib/council/escalation-service.ts`)
- Create notification on `triggerHumanEscalation()` call
- Send via notification service

### Files to Create/Modify

- `lib/notifications/notification-service.ts` - Core notification service
- `lib/notifications/channels/email.ts` - Email channel
- `lib/notifications/channels/in-app.ts` - In-app channel
- `lib/notifications/templates/escalation.tsx` - Email template
- Modify `lib/council/escalation-service.ts` to trigger notification
- `components/notifications/CriticalAlert.tsx` - Alert UI component

---

## Dependencies

- Epic 3: Human Escalation Override (Story 3-5)
- Database: notifications table

---

## Out of Scope

- Push notifications (optional enhancement)
- SMS notifications
- Escalation response flow (handled in Epic 3)
