# Story 1.5: Basic Navigation & Layout

Status: in-progress

## Story

As a **user**,
I want a consistent navigation experience,
so that I can easily find platform features.

## Acceptance Criteria

1. **AC1:** Sidebar navigation visible on all pages
   - Given I am logged in
   - When I view any page
   - Then I see sidebar navigation with: Dashboard, Agents, Academy, Council, Observer, Marketplace, Truth Chain

2. **AC2:** Desktop sidebar behavior
   - Given I am on desktop (>1024px)
   - When sidebar is visible
   - Then it shows icons + labels, collapsible to icons only

3. **AC3:** Mobile navigation
   - Given I am on mobile (<768px)
   - When I tap hamburger menu
   - Then sidebar slides in as overlay

4. **AC4:** Role-based menu items
   - Given I have Trainer role
   - When I view navigation
   - Then I see Trainer-specific items (My Agents, Earnings)

5. **AC5:** Active state highlighting
   - Given I am on a specific page
   - When I view navigation
   - Then the current section is highlighted

6. **AC6:** Breadcrumb navigation
   - Given I am on an inner page (e.g., /agents/[id])
   - When I view the header
   - Then I see breadcrumb trail showing navigation path

7. **AC7:** Header with user menu
   - Given I am logged in
   - When I view the header
   - Then I see search placeholder, notifications icon, and user avatar dropdown

## Tasks / Subtasks

- [ ] **Task 1: Create dashboard layout shell** (AC: 1, 2, 3)
  - [ ] 1.1 Create `app/(dashboard)/layout.tsx` - main dashboard wrapper
  - [ ] 1.2 Implement responsive sidebar container
  - [ ] 1.3 Add sidebar collapse/expand state (localStorage persistence)
  - [ ] 1.4 Implement mobile overlay with backdrop
  - [ ] 1.5 Add keyboard shortcut for sidebar toggle (Cmd/Ctrl + B)

- [ ] **Task 2: Build sidebar navigation component** (AC: 1, 4, 5)
  - [ ] 2.1 Create `components/navigation/Sidebar.tsx`
  - [ ] 2.2 Define navigation items array with icons, labels, paths
  - [ ] 2.3 Implement role-based filtering of menu items
  - [ ] 2.4 Add active state detection using usePathname()
  - [ ] 2.5 Style active/hover/focus states per UX spec
  - [ ] 2.6 Add section dividers (Main, Management, System)

- [ ] **Task 3: Define navigation menu structure** (AC: 1, 4)
  - [ ] 3.1 Create `lib/navigation/menu-items.ts` with full menu config
  - [ ] 3.2 Define items: Dashboard, Agents, Academy, Council, Observer, Marketplace, Truth Chain
  - [ ] 3.3 Add Trainer-only items: My Agents, Earnings, Storefront
  - [ ] 3.4 Add Consumer-only items: My Portfolio, Usage
  - [ ] 3.5 Add shared items: Settings, Help
  - [ ] 3.6 Include Lucide icon names for each item

- [ ] **Task 4: Build header component** (AC: 6, 7)
  - [ ] 4.1 Create `components/navigation/Header.tsx`
  - [ ] 4.2 Add mobile hamburger menu button (hidden on desktop)
  - [ ] 4.3 Add breadcrumb component slot
  - [ ] 4.4 Add global search input (placeholder, MVP)
  - [ ] 4.5 Add notifications bell icon (placeholder badge)
  - [ ] 4.6 Add user avatar dropdown (profile, settings, logout)

- [ ] **Task 5: Create breadcrumb system** (AC: 6)
  - [ ] 5.1 Create `components/navigation/Breadcrumbs.tsx`
  - [ ] 5.2 Create `lib/navigation/breadcrumb-utils.ts` - path parsing
  - [ ] 5.3 Auto-generate breadcrumbs from URL segments
  - [ ] 5.4 Support custom breadcrumb labels via page metadata
  - [ ] 5.5 Style with proper separators and truncation

- [ ] **Task 6: Create placeholder pages** (AC: 1)
  - [ ] 6.1 Create `app/(dashboard)/dashboard/page.tsx` - main dashboard
  - [ ] 6.2 Create `app/(dashboard)/agents/page.tsx` - agents list
  - [ ] 6.3 Create `app/(dashboard)/academy/page.tsx` - academy
  - [ ] 6.4 Create `app/(dashboard)/council/page.tsx` - council
  - [ ] 6.5 Create `app/(dashboard)/observer/page.tsx` - observer feed
  - [ ] 6.6 Create `app/(dashboard)/marketplace/page.tsx` - marketplace
  - [ ] 6.7 Create `app/(dashboard)/truth-chain/page.tsx` - truth chain
  - [ ] 6.8 Each page shows: title, "Coming soon" message, navigation works

- [ ] **Task 7: Implement responsive behavior** (AC: 2, 3)
  - [ ] 7.1 Create `hooks/useMediaQuery.ts` for responsive detection
  - [ ] 7.2 Create `hooks/useSidebar.ts` for sidebar state management
  - [ ] 7.3 Test breakpoints: mobile (<768px), tablet (768-1024px), desktop (>1024px)
  - [ ] 7.4 Ensure touch-friendly targets on mobile (44px minimum)
  - [ ] 7.5 Test keyboard navigation through menu items

- [ ] **Task 8: Validate complete navigation** (AC: All)
  - [ ] 8.1 Test navigation on desktop - expand/collapse works
  - [ ] 8.2 Test navigation on mobile - overlay works
  - [ ] 8.3 Test role-based menu items appear correctly
  - [ ] 8.4 Test active states highlight correctly
  - [ ] 8.5 Test breadcrumbs generate correctly
  - [ ] 8.6 Test user menu dropdown works
  - [ ] 8.7 Verify WCAG 2.1 AA compliance (contrast, focus states)

## Dev Notes

### Architecture Alignment

This story implements navigation per:
- **UX Design Spec:** Information architecture, sidebar design
- **Architecture Section 2.1:** shadcn/ui components
- **PRD:** Role-based user experience

### Prerequisites

- Story 1.3 (User Auth) - need session for user info
- Story 1.4 (User Profile) - need role for menu filtering

### Navigation Structure

```
MAIN
├── Dashboard (/)
├── Agents (/agents)
│   └── [Trainer] My Agents (/agents/mine)
├── Academy (/academy)
├── Council (/council)
├── Observer (/observer)
├── Marketplace (/marketplace)
└── Truth Chain (/truth-chain)

MANAGEMENT (Trainer only)
├── Earnings (/earnings)
└── Storefront (/storefront)

CONSUMER (Consumer only)
├── Portfolio (/portfolio)
└── Usage (/usage)

SYSTEM
├── Settings (/settings)
└── Help (/help)
```

### Component Dependencies

Using shadcn/ui components:
- `Sheet` - for mobile sidebar overlay
- `Button` - for menu items
- `Avatar` - for user menu
- `DropdownMenu` - for user dropdown
- `Tooltip` - for collapsed sidebar icons
- `Badge` - for notification count

### Learnings from Previous Stories

**From Story 1.1 (done):**
- shadcn/ui already configured
- components/ui/ exists

**From Story 1.2 (ready-for-dev):**
- Role stored in profiles table

**From Story 1.3 (drafted):**
- Session available via auth provider

**From Story 1.4 (drafted):**
- Role selection complete, role available in session

### Project Structure Notes

**Files to Create:**
```
components/navigation/
├── Sidebar.tsx
├── Header.tsx
├── Breadcrumbs.tsx
├── UserMenu.tsx
└── MobileNav.tsx

lib/navigation/
├── menu-items.ts
└── breadcrumb-utils.ts

hooks/
├── useMediaQuery.ts
└── useSidebar.ts

app/(dashboard)/
├── layout.tsx
├── dashboard/page.tsx
├── agents/page.tsx
├── academy/page.tsx
├── council/page.tsx
├── observer/page.tsx
├── marketplace/page.tsx
└── truth-chain/page.tsx
```

### Testing Requirements

- Visual regression: Sidebar states (expanded, collapsed, mobile)
- E2E: Navigation between all pages works
- Accessibility: Keyboard navigation, screen reader
- Responsive: Breakpoint behavior

### References

- [Source: docs/epics.md#Story-1.5]
- [Source: docs/ux-design-spec.md#Navigation]
- [Source: docs/architecture.md#Section-2.1]
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar)

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

<!-- To be filled during implementation -->

### Completion Notes List

<!-- To be filled after implementation -->

### File List

<!-- To be filled after implementation -->
| Action | File Path | Notes |
|--------|-----------|-------|
| | | |

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-28 | Bob (SM Agent) | Initial draft created |
