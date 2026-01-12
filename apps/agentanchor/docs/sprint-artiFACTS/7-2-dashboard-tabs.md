# Story 7-2: Dashboard Tabs

**Epic:** 7 - Dashboard & Notifications
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** platform user
**I want** organized tabs in my dashboard
**So that** I can easily navigate between different sections

---

## Acceptance Criteria

- [ ] Tab navigation component for dashboard
- [ ] Trainer tabs: Overview, Agents, Academy, Earnings, Settings
- [ ] Consumer tabs: Overview, Agents, Usage, Settings
- [ ] Active tab visually indicated
- [ ] URL reflects active tab for bookmarking/sharing
- [ ] Tabs persist across navigation
- [ ] Mobile-responsive (dropdown or scrollable on small screens)

---

## Technical Notes

### Trainer Tab Structure

```
/dashboard/trainer/
├── /                    # Overview (default)
├── /agents              # Agent management
│   ├── /[id]            # Agent detail
│   └── /[id]/publish    # Publish to marketplace
├── /academy             # Training oversight
│   └── /[agentId]       # Specific agent training
├── /earnings            # Revenue tracking
│   └── /payouts         # Payout history
└── /settings            # Account settings
```

### Consumer Tab Structure

```
/dashboard/consumer/
├── /                    # Overview (default)
├── /agents              # Acquired agents
│   └── /[id]            # Agent usage detail
├── /usage               # Usage tracking
│   └── /history         # Usage history
└── /settings            # Account settings
```

### Tab Navigation Component

```typescript
interface DashboardTab {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType;
  badge?: number;  // For notifications count
}

const trainerTabs: DashboardTab[] = [
  { id: 'overview', label: 'Overview', href: '/dashboard/trainer', icon: HomeIcon },
  { id: 'agents', label: 'Agents', href: '/dashboard/trainer/agents', icon: BotIcon },
  { id: 'academy', label: 'Academy', href: '/dashboard/trainer/academy', icon: GraduationCapIcon },
  { id: 'earnings', label: 'Earnings', href: '/dashboard/trainer/earnings', icon: DollarSignIcon },
  { id: 'settings', label: 'Settings', href: '/dashboard/trainer/settings', icon: SettingsIcon },
];
```

### Files to Create/Modify

- `components/dashboard/DashboardTabs.tsx` - Tab component
- `components/dashboard/DashboardLayout.tsx` - Layout with tabs
- `app/(dashboard)/trainer/layout.tsx` - Trainer layout
- `app/(dashboard)/consumer/layout.tsx` - Consumer layout
- Create page stubs for each tab route

---

## Dependencies

- Story 7-1: Role-Based Dashboard
- Epic 1: Basic navigation

---

## Out of Scope

- Content for individual tabs (other stories)
- Nested sub-navigation
- Tab customization
