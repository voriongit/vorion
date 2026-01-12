# Story 7-4: Event Notifications

**Epic:** 7 - Dashboard & Notifications
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** platform user
**I want** notifications for important platform events
**So that** I stay informed about activity relevant to me

---

## Acceptance Criteria

- [ ] `notifications` table storing all user notifications
- [ ] Notification bell icon in header with unread count
- [ ] Notification dropdown/panel showing recent notifications
- [ ] Mark as read (individual and all)
- [ ] Notification types: council decision, trust change, acquisition, system
- [ ] Priority levels: low, medium, high, critical
- [ ] Notification center page with full history
- [ ] Real-time notification updates

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  action_url TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
```

### Notification Types

| Type | Trigger | Priority | Channel |
|------|---------|----------|---------|
| `council.decision` | Council rules on agent | High | Email + In-app |
| `trust.changed` | Trust score changes | Medium | In-app |
| `trust.tier_changed` | Trust tier upgrade/downgrade | High | Email + In-app |
| `acquisition.new` | Agent acquired (trainer) | Medium | Email + In-app |
| `acquisition.confirmed` | Acquisition confirmed (consumer) | Medium | In-app |
| `review.received` | New review on listing | Medium | In-app |
| `system.announcement` | Platform announcements | Low | In-app |
| `system.maintenance` | Scheduled maintenance | High | Email + In-app |

### UI Components

```
components/notifications/
├── NotificationBell.tsx     # Header icon with badge
├── NotificationDropdown.tsx # Quick view dropdown
├── NotificationItem.tsx     # Individual notification
├── NotificationCenter.tsx   # Full page view
└── NotificationFilters.tsx  # Filter by type/read
```

### Real-time Updates

- Server-Sent Events for notification stream
- `/api/notifications/stream` endpoint
- Increment badge count on new notification
- Auto-mark as read when dropdown opened (optional)

### Files to Create/Modify

- `lib/db/schema/notifications.ts` - Schema
- `lib/notifications/notification-service.ts` - Extend from 7-3
- `components/notifications/NotificationBell.tsx`
- `components/notifications/NotificationDropdown.tsx`
- `components/notifications/NotificationItem.tsx`
- `app/(dashboard)/notifications/page.tsx` - Full center
- `app/api/notifications/route.ts` - CRUD API
- `app/api/notifications/stream/route.ts` - SSE endpoint

---

## Dependencies

- Story 7-3: Escalation Notifications (base notification system)
- Header layout component

---

## Out of Scope

- Notification preferences (Story 7-5)
- Push notifications
- Notification grouping
