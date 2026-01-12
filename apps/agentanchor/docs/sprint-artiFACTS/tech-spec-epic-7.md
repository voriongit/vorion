# Epic Technical Specification: Dashboard & Notifications

Date: 2025-12-03
Author: frank the tank
Epic ID: 7
Status: Draft

---

## Overview

Epic 7 creates a unified dashboard experience with role-based views and comprehensive notification system. Trainers and Consumers see different dashboards optimized for their workflows.

## Stories

| Story | Title | Focus |
|-------|-------|-------|
| 7-1 | Role-Based Dashboard | Trainer vs Consumer views |
| 7-2 | Dashboard Tabs | Organized content sections |
| 7-3 | Escalation Notifications | Council/human alerts |
| 7-4 | Event Notifications | General platform notifications |
| 7-5 | Notification Preferences | User control over alerts |

## Key Components

```
app/(dashboard)/
├── page.tsx              # Role-based redirect
├── trainer/
│   ├── page.tsx          # Trainer dashboard
│   ├── agents/           # Agent management
│   ├── earnings/         # Revenue tracking
│   └── academy/          # Training oversight
├── consumer/
│   ├── page.tsx          # Consumer dashboard
│   ├── agents/           # Acquired agents
│   └── usage/            # Usage tracking
└── shared/
    ├── notifications/    # Notification center
    └── settings/         # Preferences
```

## Notification Types

| Type | Priority | Channel |
|------|----------|---------|
| Escalation (L4) | Critical | Push + Email + In-app |
| Council Decision | High | Email + In-app |
| Trust Change | Medium | In-app |
| Acquisition | Medium | Email + In-app |
| System | Low | In-app |

## Data Model

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  priority VARCHAR(20),
  read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  email_escalations BOOLEAN DEFAULT TRUE,
  email_decisions BOOLEAN DEFAULT TRUE,
  email_acquisitions BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT FALSE,
  digest_frequency VARCHAR(20) DEFAULT 'instant'
);
```
