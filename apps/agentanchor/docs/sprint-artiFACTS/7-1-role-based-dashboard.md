# Story 7-1: Role-Based Dashboard

**Epic:** 7 - Dashboard & Notifications
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** platform user
**I want** a dashboard tailored to my role (trainer or consumer)
**So that** I see the most relevant information and actions

---

## Acceptance Criteria

- [ ] Dashboard route at `/dashboard` redirects based on user role
- [ ] Trainer dashboard at `/dashboard/trainer`
- [ ] Consumer dashboard at `/dashboard/consumer`
- [ ] Dashboard shows role-specific summary cards
- [ ] Quick actions relevant to user role
- [ ] Recent activity feed
- [ ] Users with both roles can switch between dashboards

---

## Technical Notes

### Role Detection & Routing

```typescript
// app/(dashboard)/page.tsx
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (user.role === 'trainer' || user.roles?.includes('trainer')) {
    redirect('/dashboard/trainer');
  } else {
    redirect('/dashboard/consumer');
  }
}
```

### Trainer Dashboard

```
/dashboard/trainer/page.tsx
├── Summary Cards
│   ├── Total Agents
│   ├── Active Listings
│   ├── Monthly Earnings
│   └── Pending Escalations
├── Quick Actions
│   ├── Create Agent
│   ├── View Marketplace
│   └── Check Earnings
├── Recent Activity
│   ├── New acquisitions
│   ├── Trust changes
│   └── Council decisions
└── Agent Status Overview
```

### Consumer Dashboard

```
/dashboard/consumer/page.tsx
├── Summary Cards
│   ├── Active Agents
│   ├── Monthly Usage
│   ├── Pending Actions
│   └── Total Spent
├── Quick Actions
│   ├── Browse Marketplace
│   ├── View Agents
│   └── Check Notifications
├── Recent Activity
│   ├── Agent interactions
│   ├── New reviews
│   └── Trust updates
└── Acquired Agents Grid
```

### Files to Create/Modify

- `app/(dashboard)/page.tsx` - Role redirect
- `app/(dashboard)/trainer/page.tsx` - Trainer dashboard
- `app/(dashboard)/consumer/page.tsx` - Consumer dashboard
- `components/dashboard/SummaryCards.tsx` - Metrics cards
- `components/dashboard/QuickActions.tsx` - Action buttons
- `components/dashboard/RecentActivity.tsx` - Activity feed
- `components/dashboard/RoleSwitcher.tsx` - Role toggle (dual-role users)

---

## Dependencies

- Epic 1: User authentication and role system
- Layout system for dashboard shell

---

## Out of Scope

- Dashboard tabs organization (Story 7-2)
- Notification display (Stories 7-3, 7-4)
- Detailed metrics/analytics
