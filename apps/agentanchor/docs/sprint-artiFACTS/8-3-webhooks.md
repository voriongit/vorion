# Story 8-3: Webhooks

**Epic:** 8 - API & Integration
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** developer
**I want** to receive webhook notifications for platform events
**So that** my application can react to changes in real-time

---

## Acceptance Criteria

- [ ] `webhook_subscriptions` table for webhook management
- [ ] Webhooks page at `/dashboard/settings/webhooks`
- [ ] Subscribe to specific event types
- [ ] Webhook secret for signature verification
- [ ] Webhook delivery with retry logic
- [ ] Webhook delivery logs
- [ ] Test webhook endpoint
- [ ] HMAC signature on all payloads

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret VARCHAR(64) NOT NULL,
  description VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES webhook_subscriptions(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'pending', 'delivered', 'failed'
  response_code INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deliveries_retry ON webhook_deliveries(status, next_retry_at)
  WHERE status = 'pending';
```

### Webhook Events

```typescript
type WebhookEvent =
  | 'agent.created'
  | 'agent.updated'
  | 'agent.graduated'
  | 'trust.changed'
  | 'trust.tier_changed'
  | 'council.decision'
  | 'acquisition.created'
  | 'acquisition.revoked'
  | 'escalation.required'
  | 'escalation.resolved';
```

### Webhook Payload

```typescript
interface WebhookPayload {
  id: string;              // Delivery ID
  event: WebhookEvent;
  created_at: string;      // ISO timestamp
  data: Record<string, unknown>;
}

// Signature header
// X-AgentAnchor-Signature: sha256=<HMAC-SHA256 of body using secret>
```

### Delivery Logic

```typescript
async function deliverWebhook(delivery: WebhookDelivery): Promise<void> {
  const subscription = await getSubscription(delivery.subscriptionId);
  const signature = computeSignature(delivery.payload, subscription.secret);

  try {
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentAnchor-Signature': `sha256=${signature}`,
        'X-AgentAnchor-Event': delivery.eventType,
        'X-AgentAnchor-Delivery': delivery.id
      },
      body: JSON.stringify(delivery.payload),
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    await updateDelivery(delivery.id, {
      status: response.ok ? 'delivered' : 'failed',
      responseCode: response.status,
      deliveredAt: response.ok ? new Date() : null
    });
  } catch (error) {
    await scheduleRetry(delivery);
  }
}

// Retry schedule: 1m, 5m, 30m, 2h, 12h (5 attempts)
```

### Files to Create/Modify

- `lib/db/schema/webhooks.ts` - Schema
- `lib/webhooks/webhook-service.ts` - Webhook management
- `lib/webhooks/delivery-service.ts` - Delivery logic
- `lib/webhooks/signature.ts` - HMAC signing
- `app/(dashboard)/settings/webhooks/page.tsx` - Webhook UI
- `components/settings/WebhookForm.tsx` - Create/edit form
- `components/settings/WebhookList.tsx` - List webhooks
- `components/settings/WebhookLogs.tsx` - Delivery logs
- `app/api/users/webhooks/route.ts` - Webhook management API
- `app/api/users/webhooks/test/route.ts` - Test endpoint

---

## Dependencies

- Story 8-2: API Authentication (webhooks require auth)
- Platform events from all epics

---

## Out of Scope

- Webhook filtering by resource
- Batch webhooks
- Webhook transformation
