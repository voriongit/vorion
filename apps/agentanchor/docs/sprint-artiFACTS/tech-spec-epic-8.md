# Epic Technical Specification: API & Integration

Date: 2025-12-03
Author: frank the tank
Epic ID: 8
Status: Draft

---

## Overview

Epic 8 exposes AgentAnchor functionality via a RESTful API for external integrations. Includes API key authentication, webhooks for event streaming, and OpenAPI documentation.

## Stories

| Story | Title | Focus |
|-------|-------|-------|
| 8-1 | RESTful API | Core API endpoints |
| 8-2 | API Authentication | API key management |
| 8-3 | Webhooks | Event subscriptions |
| 8-4 | OpenAPI Documentation | Interactive docs |

## API Structure

```
/api/v1/
├── /agents
│   ├── GET /              # List agents
│   ├── POST /             # Create agent
│   ├── GET /:id           # Get agent
│   ├── PUT /:id           # Update agent
│   └── GET /:id/trust     # Trust score
├── /marketplace
│   ├── GET /listings      # Browse
│   └── POST /acquire      # Acquire agent
├── /council
│   ├── GET /decisions     # Decision history
│   └── POST /request      # Submit request
├── /verify (public)
│   └── GET /:recordId     # Verify record
└── /webhooks
    ├── GET /              # List subscriptions
    ├── POST /             # Create subscription
    └── DELETE /:id        # Remove subscription
```

## Authentication

```typescript
// API Key header
Authorization: Bearer sk_live_xxxxxxxxxxxx

// Key scopes
type ApiKeyScope =
  | 'agents:read'
  | 'agents:write'
  | 'marketplace:read'
  | 'marketplace:write'
  | 'council:read'
  | 'webhooks:manage';
```

## Webhook Events

```typescript
type WebhookEvent =
  | 'agent.created'
  | 'agent.graduated'
  | 'trust.changed'
  | 'trust.tier_changed'
  | 'council.decision'
  | 'acquisition.created'
  | 'escalation.required';
```

## Data Model

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  key_hash VARCHAR(64) NOT NULL,
  name VARCHAR(255),
  scopes TEXT[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  url TEXT NOT NULL,
  events TEXT[],
  secret VARCHAR(64),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
