# Story 7-5: Notification Preferences

**Epic:** 7 - Dashboard & Notifications
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** platform user
**I want** to control my notification preferences
**So that** I receive only the notifications I care about

---

## Acceptance Criteria

- [ ] `notification_preferences` table per user
- [ ] Settings page at `/dashboard/settings/notifications`
- [ ] Toggle email notifications by type
- [ ] Toggle in-app notifications by type
- [ ] Email digest frequency: instant, daily, weekly, none
- [ ] Push notification opt-in (if supported)
- [ ] Cannot disable critical escalation notifications
- [ ] Default preferences created on user registration

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  -- Email preferences
  email_escalations BOOLEAN DEFAULT TRUE,   -- Cannot be disabled
  email_council_decisions BOOLEAN DEFAULT TRUE,
  email_trust_changes BOOLEAN DEFAULT FALSE,
  email_acquisitions BOOLEAN DEFAULT TRUE,
  email_reviews BOOLEAN DEFAULT TRUE,
  email_system BOOLEAN DEFAULT TRUE,
  -- Digest settings
  digest_frequency VARCHAR(20) DEFAULT 'instant', -- instant, daily, weekly, none
  digest_time TIME DEFAULT '09:00',              -- For daily/weekly
  digest_day INTEGER DEFAULT 1,                   -- For weekly (1=Monday)
  -- In-app preferences
  inapp_enabled BOOLEAN DEFAULT TRUE,
  inapp_sound BOOLEAN DEFAULT TRUE,
  -- Push preferences
  push_enabled BOOLEAN DEFAULT FALSE,
  push_token TEXT,
  -- Meta
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Settings UI

```
/dashboard/settings/notifications/page.tsx
├── Email Notifications Section
│   ├── Escalations (locked on) ⚠️
│   ├── Council Decisions [toggle]
│   ├── Trust Changes [toggle]
│   ├── Acquisitions [toggle]
│   ├── Reviews [toggle]
│   └── System [toggle]
├── Email Digest Section
│   ├── Frequency [select: instant/daily/weekly/none]
│   ├── Time [time picker] (if daily/weekly)
│   └── Day [select] (if weekly)
├── In-App Notifications Section
│   ├── Enable all [master toggle]
│   └── Sound [toggle]
└── Push Notifications Section
    ├── Enable push [toggle]
    └── Browser permission status
```

### Preference Checks

```typescript
// lib/notifications/notification-service.ts
async function shouldNotify(
  userId: string,
  type: NotificationType,
  channel: 'email' | 'inapp' | 'push'
): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);

  // Escalations always notify
  if (type === 'escalation') return true;

  if (channel === 'email') {
    if (prefs.digestFrequency === 'none') return false;
    return prefs[`email_${type}`] ?? true;
  }

  if (channel === 'inapp') {
    return prefs.inappEnabled;
  }

  if (channel === 'push') {
    return prefs.pushEnabled && !!prefs.pushToken;
  }

  return true;
}
```

### Files to Create/Modify

- `lib/db/schema/notification-preferences.ts` - Schema
- `lib/notifications/preferences-service.ts` - Preference logic
- `app/(dashboard)/settings/notifications/page.tsx` - Settings page
- `components/settings/NotificationPreferences.tsx` - Form component
- `app/api/users/preferences/notifications/route.ts` - Preferences API
- Modify `notification-service.ts` to check preferences

---

## Dependencies

- Story 7-4: Event Notifications (notification types defined)
- User settings page structure

---

## Out of Scope

- Per-agent notification settings
- Notification scheduling
- Custom notification sounds
- Webhook notifications
