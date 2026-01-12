# AgentAnchor - Frontend Architecture

**Version:** 1.0
**Date:** 2025-12-03
**Status:** Active
**Architect:** Winston + BMad Party Mode Collective

---

## Executive Summary

This document defines the frontend architecture for AgentAnchor, the world's first AI Governance Operating System. It expands on Section 10 of the System Architecture and addresses gaps identified through cross-functional analysis:

- **RSC/Client boundaries** - Server vs client component strategy
- **Component composition** - Patterns for building complex UIs
- **Shared hooks & utilities** - DX consistency across the codebase
- **Accessibility** - WCAG 2.1 AA compliance
- **Performance** - Real-time feeds, virtualization, bundle optimization
- **Testing** - Component and integration testing strategy

**Guiding Principle:** *"User journeys drive technical decisions. Embrace boring technology for stability."*

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Application Structure](#2-application-structure)
3. [Server/Client Boundaries](#3-serverclient-boundaries)
4. [Component Architecture](#4-component-architecture)
5. [State Management](#5-state-management)
6. [Shared Hooks & Utilities](#6-shared-hooks--utilities)
7. [Accessibility](#7-accessibility)
8. [Performance Strategy](#8-performance-strategy)
9. [Testing Strategy](#9-testing-strategy)
10. [Design System & Tokens](#10-design-system--tokens)
11. [User Journey Mapping](#11-user-journey-mapping)
12. [Error Handling](#12-error-handling)

---

## 1. Technology Stack

### 1.1 Core Technologies

| Technology | Version | Purpose | Decision Rationale |
|------------|---------|---------|-------------------|
| **Next.js** | 14.x | React framework | App Router, RSC, streaming SSR |
| **React** | 18.x | UI library | Concurrent features, Suspense |
| **TypeScript** | 5.x | Type safety | Strict mode enabled |
| **Tailwind CSS** | 3.x | Styling | Utility-first, design tokens |
| **shadcn/ui** | Latest | Component library | Accessible, customizable |
| **Framer Motion** | Latest | Animations | Dignified micro-interactions |
| **Recharts** | Latest | Data visualization | Trust score charts |
| **Zustand** | Latest | State management | Minimal, performant |
| **Pusher** | Latest | Real-time | Observer feed, notifications |

### 1.2 Development Dependencies

| Tool | Purpose |
|------|---------|
| **ESLint** | Code quality |
| **Prettier** | Code formatting |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |
| **Storybook** | Component documentation |

---

## 2. Application Structure

### 2.1 Directory Layout

```
app/
├── (public)/                    # No auth required
│   ├── page.tsx                 # Landing page (RSC)
│   ├── verify/
│   │   └── [hash]/page.tsx      # Public verification (RSC)
│   └── docs/
│       └── api/page.tsx         # API documentation (RSC)
│
├── (auth)/                      # Auth pages
│   ├── login/page.tsx           # Login (Client)
│   ├── signup/page.tsx          # Signup (Client)
│   └── layout.tsx               # Auth layout (RSC)
│
├── (dashboard)/                 # Authenticated users
│   ├── layout.tsx               # Dashboard shell (RSC + Client islands)
│   ├── dashboard/page.tsx       # Role-based dashboard (RSC)
│   ├── agents/
│   │   ├── page.tsx             # Agent list (RSC)
│   │   ├── new/page.tsx         # Create agent (Client)
│   │   └── [id]/
│   │       ├── page.tsx         # Agent detail (RSC)
│   │       └── trust/page.tsx   # Trust history (RSC)
│   ├── marketplace/
│   │   ├── page.tsx             # Browse (RSC)
│   │   └── [id]/page.tsx        # Listing detail (RSC + Client)
│   ├── observer/page.tsx        # Live feed (Client)
│   ├── council/page.tsx         # Decisions (RSC)
│   ├── truth-chain/page.tsx     # Records (RSC)
│   ├── earnings/page.tsx        # Trainer earnings (RSC)
│   └── settings/
│       ├── page.tsx             # Settings (RSC)
│       ├── notifications/page.tsx
│       └── api-keys/page.tsx
│
├── api/                         # API routes
│   └── ...
│
└── layout.tsx                   # Root layout (RSC)

components/
├── ui/                          # shadcn/ui primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
│
├── agents/                      # Agent domain components
│   ├── AgentCard.tsx            # Client
│   ├── AgentForm.tsx            # Client
│   ├── TrustBadge.tsx           # Client
│   ├── TrustHistoryChart.tsx    # Client
│   └── ProbationIndicator.tsx   # Client
│
├── academy/                     # Academy domain
│   ├── CurriculumCard.tsx       # RSC
│   ├── ModuleProgress.tsx       # Client
│   └── EnrollmentStatus.tsx     # RSC
│
├── marketplace/                 # Marketplace domain
│   ├── ListingCard.tsx          # RSC
│   ├── MarketplaceFilters.tsx   # Client
│   └── AcquisitionModal.tsx     # Client
│
├── observer/                    # Observer domain
│   ├── EventFeed.tsx            # Client (real-time)
│   ├── AnomalyList.tsx          # Client
│   └── EventLine.tsx            # Client
│
├── council/                     # Council domain
│   ├── DecisionCard.tsx         # RSC
│   ├── VotingPanel.tsx          # Client
│   └── EscalationBanner.tsx     # Client
│
├── truth-chain/                 # Truth Chain domain
│   ├── RecordCard.tsx           # RSC
│   ├── VerificationBadge.tsx    # RSC
│   └── ChainViewer.tsx          # Client
│
├── navigation/                  # Navigation components
│   ├── AppShell.tsx             # RSC + Client
│   ├── Sidebar.tsx              # Client
│   ├── Header.tsx               # Client
│   └── Breadcrumbs.tsx          # RSC
│
└── shared/                      # Cross-cutting components
    ├── ErrorBoundary.tsx        # Client
    ├── LoadingState.tsx         # RSC
    ├── EmptyState.tsx           # RSC
    └── ConfirmDialog.tsx        # Client

hooks/
├── index.ts                     # Barrel export
├── useAccessibility.ts          # a11y hooks (focus trap, announcements)
├── useAgent.ts                  # Agent data fetching with SWR
├── useDebounce.ts               # Debounce/throttle utilities
├── useMediaQuery.ts             # Responsive breakpoints
├── useSidebar.ts                # Sidebar state
├── useTrustScore.ts             # Trust score with real-time updates
└── useUser.ts                   # Current user context

lib/pusher/
└── hooks.ts                     # Real-time hooks (observer, notifications)

lib/
├── agents/                      # Agent business logic
├── council/                     # Council services
├── marketplace/                 # Marketplace services
├── observer/                    # Observer services
├── truth-chain/                 # Truth Chain services
├── pusher/                      # Real-time client
├── supabase/                    # Auth & database
└── utils/                       # Shared utilities
```

### 2.2 Route Groups

| Group | Purpose | Auth | Layout |
|-------|---------|------|--------|
| `(public)` | Public pages | None | Minimal |
| `(auth)` | Authentication | None | Centered card |
| `(dashboard)` | Main app | Required | AppShell |

---

## 3. Server/Client Boundaries

### 3.1 Boundary Strategy

**Default to RSC.** Only use `'use client'` when:
1. Using React hooks (`useState`, `useEffect`, etc.)
2. Using browser APIs (`window`, `localStorage`, etc.)
3. Handling user interactions (`onClick`, `onSubmit`, etc.)
4. Using third-party client libraries (Pusher, Framer Motion)

### 3.2 Component Classification

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER COMPONENTS (RSC)                       │
│                                                                  │
│  • Data fetching (async/await)                                  │
│  • Static content rendering                                      │
│  • SEO-critical content                                          │
│  • Layout and structure                                          │
│                                                                  │
│  Examples:                                                       │
│  - Page layouts                                                  │
│  - ListingCard (static display)                                  │
│  - DecisionCard (read-only)                                      │
│  - VerificationBadge                                             │
│  - Breadcrumbs                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Props & Children
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT COMPONENTS                             │
│                    ('use client' directive)                      │
│                                                                  │
│  • Interactive elements                                          │
│  • Real-time updates                                             │
│  • Form handling                                                 │
│  • Animations                                                    │
│                                                                  │
│  Examples:                                                       │
│  - TrustBadge (animations)                                       │
│  - AgentForm (form state)                                        │
│  - EventFeed (real-time)                                         │
│  - MarketplaceFilters (interactions)                             │
│  - Sidebar (client state)                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Composition Pattern: Islands Architecture

```tsx
// app/(dashboard)/agents/[id]/page.tsx (RSC)
import { Suspense } from 'react'
import { AgentHeader } from '@/components/agents/AgentHeader'
import { TrustScorePanel } from '@/components/agents/TrustScorePanel'
import { TrustHistoryChart } from '@/components/agents/TrustHistoryChart'

export default async function AgentPage({ params }: { params: { id: string } }) {
  // Data fetching in RSC
  const agent = await getAgent(params.id)

  return (
    <div className="space-y-6">
      {/* RSC: Static header */}
      <AgentHeader agent={agent} />

      {/* Client Island: Interactive trust panel */}
      <Suspense fallback={<TrustScoreSkeleton />}>
        <TrustScorePanel agentId={agent.id} initialScore={agent.trustScore} />
      </Suspense>

      {/* Client Island: Chart with animations */}
      <Suspense fallback={<ChartSkeleton />}>
        <TrustHistoryChart agentId={agent.id} />
      </Suspense>
    </div>
  )
}
```

### 3.4 Suspense Boundaries

Place Suspense boundaries at:
1. **Domain boundaries** - Each major feature area
2. **Data dependencies** - Components that fetch independently
3. **Heavy client components** - Charts, real-time feeds

```tsx
// Suspense boundary hierarchy
<AppShell>
  <Suspense fallback={<PageSkeleton />}>
    <PageContent>
      <Suspense fallback={<SectionSkeleton />}>
        <DataHeavySection />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <InteractiveChart />
      </Suspense>
    </PageContent>
  </Suspense>
</AppShell>
```

---

## 4. Component Architecture

### 4.1 Composition Patterns

#### Pattern 1: Compound Components

For complex UI elements with multiple related parts:

```tsx
// components/agents/TrustDisplay/index.tsx
export const TrustDisplay = {
  Root: TrustDisplayRoot,
  Badge: TrustBadge,
  Score: TrustScore,
  Progress: TrustProgress,
  History: TrustHistory,
}

// Usage
<TrustDisplay.Root agent={agent}>
  <TrustDisplay.Badge />
  <TrustDisplay.Score showLabel />
  <TrustDisplay.Progress showNextTier />
</TrustDisplay.Root>
```

#### Pattern 2: Render Props

For flexible data display:

```tsx
// components/shared/DataList.tsx
interface DataListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  renderEmpty?: () => React.ReactNode
  keyExtractor: (item: T) => string
}

// Usage
<DataList
  items={agents}
  keyExtractor={(a) => a.id}
  renderItem={(agent) => <AgentCard agent={agent} />}
  renderEmpty={() => <EmptyState message="No agents found" />}
/>
```

#### Pattern 3: Slot Pattern

For layout customization:

```tsx
// components/shared/PageLayout.tsx
interface PageLayoutProps {
  header?: React.ReactNode
  sidebar?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}

// Usage
<PageLayout
  header={<PageTitle>My Agents</PageTitle>}
  actions={<Button>Create Agent</Button>}
  sidebar={<AgentFilters />}
>
  <AgentGrid agents={agents} />
</PageLayout>
```

### 4.2 Component Structure

Each component should follow this structure:

```tsx
// components/domain/ComponentName.tsx
'use client' // Only if needed

import { type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 1. Types
interface ComponentNameProps extends ComponentProps<'div'> {
  variant?: 'default' | 'compact'
  // ...domain-specific props
}

// 2. Constants (if any)
const VARIANTS = {
  default: 'px-4 py-3',
  compact: 'px-2 py-1',
}

// 3. Component
export function ComponentName({
  variant = 'default',
  className,
  children,
  ...props
}: ComponentNameProps) {
  return (
    <div className={cn(VARIANTS[variant], className)} {...props}>
      {children}
    </div>
  )
}

// 4. Sub-components (if compound)
ComponentName.Header = function Header() { /* ... */ }
ComponentName.Body = function Body() { /* ... */ }

// 5. Variants for different contexts
export function ComponentNameCompact(props: Omit<ComponentNameProps, 'variant'>) {
  return <ComponentName variant="compact" {...props} />
}
```

### 4.3 Error Boundaries

Wrap each domain with an error boundary:

```tsx
// components/shared/DomainErrorBoundary.tsx
'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  domain: string
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class DomainErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" />
          <h3 className="font-medium text-red-900">
            {this.props.domain} encountered an error
          </h3>
          <p className="text-sm text-red-700 mt-1">
            {this.state.error?.message}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

// Usage in layouts
<DomainErrorBoundary domain="Trust Score">
  <TrustScorePanel />
</DomainErrorBoundary>
```

---

## 5. State Management

### 5.1 State Strategy

| State Type | Solution | When to Use |
|------------|----------|-------------|
| **Server State** | RSC + fetch | Initial data, SEO content |
| **URL State** | `useSearchParams` | Filters, pagination, tabs |
| **Form State** | React Hook Form | Form inputs, validation |
| **UI State** | Zustand | Sidebar, modals, themes |
| **Real-time State** | Pusher + Zustand | Observer feed, notifications |

### 5.2 Zustand Stores

```tsx
// stores/ui.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  sidebarOpen: boolean
  viewMode: 'trainer' | 'consumer'
  theme: 'light' | 'dark' | 'system'
  toggleSidebar: () => void
  setViewMode: (mode: 'trainer' | 'consumer') => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      viewMode: 'trainer',
      theme: 'system',
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setViewMode: (viewMode) => set({ viewMode }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'agentanchor-ui' }
  )
)
```

```tsx
// stores/notifications.ts
import { create } from 'zustand'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  read: boolean
  timestamp: Date
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  dismiss: (id: string) => void
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (n) => {
    const notification: Notification = {
      ...n,
      id: crypto.randomUUID(),
      read: false,
      timestamp: new Date(),
    }
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    }))
  },
  markRead: (id) => set((s) => ({
    notifications: s.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(0, s.unreadCount - 1),
  })),
  markAllRead: () => set((s) => ({
    notifications: s.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  })),
  dismiss: (id) => set((s) => ({
    notifications: s.notifications.filter((n) => n.id !== id),
  })),
}))
```

```tsx
// stores/observer.ts
import { create } from 'zustand'
import type { ObserverEvent } from '@/lib/observer/types'

interface ObserverStore {
  connected: boolean
  events: ObserverEvent[]
  filters: {
    agentId?: string
    eventTypes?: string[]
    minLevel?: number
  }
  setConnected: (connected: boolean) => void
  addEvent: (event: ObserverEvent) => void
  setFilters: (filters: ObserverStore['filters']) => void
  clearEvents: () => void
}

export const useObserverStore = create<ObserverStore>((set) => ({
  connected: false,
  events: [],
  filters: {},
  setConnected: (connected) => set({ connected }),
  addEvent: (event) => set((s) => ({
    events: [event, ...s.events].slice(0, 1000), // Keep last 1000
  })),
  setFilters: (filters) => set({ filters }),
  clearEvents: () => set({ events: [] }),
}))
```

### 5.3 URL State Management

```tsx
// Use nuqs for type-safe URL state
import { parseAsString, parseAsInteger, useQueryStates } from 'nuqs'

// In marketplace page
const [filters, setFilters] = useQueryStates({
  category: parseAsString.withDefault('all'),
  tier: parseAsString,
  sort: parseAsString.withDefault('trust_score'),
  page: parseAsInteger.withDefault(1),
})

// Updates URL: /marketplace?category=automation&tier=elite&sort=trust_score&page=1
```

---

## 6. Shared Hooks & Utilities

### 6.1 Data Fetching Hooks

```tsx
// hooks/useAgent.ts
'use client'

import useSWR from 'swr'
import { getAgent } from '@/lib/agents/agent-service'
import type { Agent } from '@/lib/agents/types'

export function useAgent(agentId: string) {
  const { data, error, isLoading, mutate } = useSWR<Agent>(
    agentId ? `/api/agents/${agentId}` : null,
    () => getAgent(agentId)
  )

  return {
    agent: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}
```

```tsx
// hooks/useTrustScore.ts
'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { usePusher } from '@/lib/pusher/hooks'
import type { TrustScore } from '@/lib/agents/types'

export function useTrustScore(agentId: string) {
  const { data, mutate } = useSWR<TrustScore>(
    `/api/agents/${agentId}/trust`
  )

  const pusher = usePusher()

  useEffect(() => {
    if (!pusher || !agentId) return

    const channel = pusher.subscribe(`agent-${agentId}`)
    channel.bind('trust-update', (newScore: TrustScore) => {
      mutate(newScore, false) // Update without revalidation
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`agent-${agentId}`)
    }
  }, [pusher, agentId, mutate])

  return { trustScore: data, mutate }
}
```

### 6.2 UI Hooks

```tsx
// hooks/useMediaQuery.ts
'use client'

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

// Convenience hooks
export const useIsMobile = () => useMediaQuery('(max-width: 768px)')
export const useIsTablet = () => useMediaQuery('(max-width: 1024px)')
export const usePrefersDark = () => useMediaQuery('(prefers-color-scheme: dark)')
```

```tsx
// hooks/useDebounce.ts
'use client'

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

### 6.3 Utility Functions

```tsx
// lib/utils/format.ts
export function formatTrustScore(score: number): string {
  return new Intl.NumberFormat().format(score)
}

export function formatRelativeTime(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diff = Date.now() - date.getTime()

  if (diff < 60000) return rtf.format(-Math.floor(diff / 1000), 'second')
  if (diff < 3600000) return rtf.format(-Math.floor(diff / 60000), 'minute')
  if (diff < 86400000) return rtf.format(-Math.floor(diff / 3600000), 'hour')
  return rtf.format(-Math.floor(diff / 86400000), 'day')
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}
```

```tsx
// lib/utils/cn.ts (already exists via shadcn)
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 7. Accessibility

### 7.1 Compliance Target

**WCAG 2.1 Level AA** compliance across all pages.

### 7.2 Accessibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Keyboard Navigation** | All interactive elements focusable, logical tab order |
| **Screen Readers** | ARIA labels, live regions, semantic HTML |
| **Color Contrast** | 4.5:1 for text, 3:1 for UI elements |
| **Focus Indicators** | Visible focus rings on all interactive elements |
| **Motion** | Respect `prefers-reduced-motion` |
| **Text Scaling** | Support up to 200% zoom |

### 7.3 Component Accessibility Patterns

#### Trust Badge (Already Implemented)

```tsx
// components/agents/TrustBadge.tsx
<div
  className={tierColors[tier]}
  title={`Trust Score: ${score}/1000 - ${tierInfo.label}`}
  role="status"
  aria-label={`Trust tier: ${tierInfo.label}, score ${score} out of 1000`}
>
  <span role="img" aria-label={tierInfo.label}>
    {emoji}
  </span>
  {/* ... */}
</div>
```

#### Observer Feed (Live Region)

```tsx
// components/observer/EventFeed.tsx
'use client'

export function EventFeed() {
  return (
    <div
      role="log"
      aria-label="Observer event feed"
      aria-live="polite"
      aria-atomic="false"
    >
      {events.map((event) => (
        <EventLine
          key={event.id}
          event={event}
          // Screen reader announcement
          aria-label={`${event.type}: ${event.summary}`}
        />
      ))}
    </div>
  )
}
```

#### Council Decision Card

```tsx
// components/council/DecisionCard.tsx
<article
  aria-labelledby={`decision-${decision.id}-title`}
  aria-describedby={`decision-${decision.id}-desc`}
>
  <h3 id={`decision-${decision.id}-title`}>
    {decision.actionType}
  </h3>
  <p id={`decision-${decision.id}-desc`}>
    {decision.outcome} - {decision.reasoning}
  </p>
  <div role="group" aria-label="Validator votes">
    {decision.votes.map((vote) => (
      <VoteBadge key={vote.validator} vote={vote} />
    ))}
  </div>
</article>
```

### 7.4 Motion Preferences

```tsx
// hooks/useReducedMotion.ts
'use client'

import { useMediaQuery } from './useMediaQuery'

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

// Usage in components
const prefersReducedMotion = useReducedMotion()

<motion.div
  animate={{ opacity: 1 }}
  transition={{
    duration: prefersReducedMotion ? 0 : 0.3
  }}
/>
```

### 7.5 Focus Management

```tsx
// components/shared/FocusTrap.tsx
'use client'

import { useEffect, useRef } from 'react'

export function FocusTrap({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()

    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [])

  return <div ref={containerRef}>{children}</div>
}
```

---

## 8. Performance Strategy

### 8.1 Bundle Optimization

```tsx
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
    ],
  },
}
```

### 8.2 Dynamic Imports

```tsx
// Heavy components loaded on demand
const TrustHistoryChart = dynamic(
  () => import('@/components/agents/TrustHistoryChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Charts need client-side rendering
  }
)

const GraduationCeremony = dynamic(
  () => import('@/components/academy/GraduationCeremony'),
  {
    loading: () => <CeremonySkeleton />,
  }
)
```

### 8.3 Virtualization for Large Lists

```tsx
// components/observer/VirtualizedEventFeed.tsx
'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function VirtualizedEventFeed({ events }: { events: ObserverEvent[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 10, // Render 10 extra items above/below viewport
  })

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
      role="log"
      aria-label="Observer event feed"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <EventLine event={events[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 8.4 Image Optimization

```tsx
// Always use next/image
import Image from 'next/image'

<Image
  src={agent.avatarUrl}
  alt={`${agent.name} avatar`}
  width={48}
  height={48}
  className="rounded-full"
  priority={isAboveFold}
/>
```

### 8.5 Performance Budgets

| Metric | Target | Current |
|--------|--------|---------|
| **LCP** | < 2.5s | Measure |
| **FID** | < 100ms | Measure |
| **CLS** | < 0.1 | Measure |
| **TTI** | < 3.5s | Measure |
| **Bundle Size** | < 200KB (initial) | Measure |

---

## 9. Testing Strategy

### 9.1 Testing Pyramid

```
          ┌─────────┐
          │   E2E   │  ← 10% (Critical user journeys)
         ─┴─────────┴─
        ┌─────────────┐
        │ Integration │  ← 30% (Component + API)
       ─┴─────────────┴─
      ┌─────────────────┐
      │      Unit       │  ← 60% (Hooks, utils, components)
     ─┴─────────────────┴─
```

### 9.2 Unit Testing

```tsx
// __tests__/components/TrustBadge.test.tsx
import { render, screen } from '@testing-library/react'
import TrustBadge from '@/components/agents/TrustBadge'

describe('TrustBadge', () => {
  it('renders trust tier label', () => {
    render(<TrustBadge score={750} tier="trusted" />)
    expect(screen.getByText('Trusted')).toBeInTheDocument()
  })

  it('shows score when showScore is true', () => {
    render(<TrustBadge score={750} tier="trusted" showScore />)
    expect(screen.getByText('(750)')).toBeInTheDocument()
  })

  it('applies correct color for tier', () => {
    const { container } = render(<TrustBadge score={750} tier="trusted" />)
    expect(container.firstChild).toHaveClass('text-green-600')
  })

  it('is accessible', () => {
    render(<TrustBadge score={750} tier="trusted" />)
    expect(screen.getByTitle(/Trust Score: 750\/1000/)).toBeInTheDocument()
  })
})
```

### 9.3 Integration Testing

```tsx
// __tests__/integration/marketplace.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { rest } from 'msw'
import MarketplacePage from '@/app/(dashboard)/marketplace/page'

describe('Marketplace', () => {
  it('loads and displays listings', async () => {
    render(<MarketplacePage />)

    await waitFor(() => {
      expect(screen.getByText('Agent Alpha')).toBeInTheDocument()
    })
  })

  it('filters by category', async () => {
    const user = userEvent.setup()
    render(<MarketplacePage />)

    await user.click(screen.getByRole('combobox', { name: /category/i }))
    await user.click(screen.getByText('Automation'))

    await waitFor(() => {
      expect(screen.getByText('Automation Agent')).toBeInTheDocument()
      expect(screen.queryByText('Customer Support Agent')).not.toBeInTheDocument()
    })
  })
})
```

### 9.4 E2E Testing

```tsx
// e2e/trust-verification.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Trust Verification Flow', () => {
  test('user can verify agent trust score', async ({ page }) => {
    await page.goto('/verify/abc123')

    await expect(page.getByRole('heading', { name: /verification/i })).toBeVisible()
    await expect(page.getByText(/verified/i)).toBeVisible()
    await expect(page.getByText(/trust score/i)).toBeVisible()
  })
})
```

---

## 10. Design System & Tokens

### 10.1 Color Tokens

```css
/* tailwind.config.js - extend theme */
colors: {
  // Trust Tiers
  trust: {
    untrusted: {
      DEFAULT: '#9CA3AF', // gray-400
      bg: '#F3F4F6',      // gray-100
    },
    novice: {
      DEFAULT: '#CA8A04', // yellow-600
      bg: '#FEF9C3',      // yellow-100
    },
    proven: {
      DEFAULT: '#2563EB', // blue-600
      bg: '#DBEAFE',      // blue-100
    },
    trusted: {
      DEFAULT: '#16A34A', // green-600
      bg: '#DCFCE7',      // green-100
    },
    elite: {
      DEFAULT: '#9333EA', // purple-600
      bg: '#F3E8FF',      // purple-100
    },
    legendary: {
      DEFAULT: '#F59E0B', // amber-500
      bg: 'linear-gradient(to right, #FEF3C7, #FEF9C3)', // amber-100 to yellow-100
    },
  },

  // Risk Levels
  risk: {
    low: '#22C55E',      // green-500
    medium: '#EAB308',   // yellow-500
    high: '#F97316',     // orange-500
    critical: '#EF4444', // red-500
  },

  // Observer Events
  observer: {
    info: '#3B82F6',     // blue-500
    success: '#22C55E',  // green-500
    warning: '#EAB308',  // yellow-500
    error: '#EF4444',    // red-500
    anomaly: '#A855F7',  // purple-500
  },
}
```

### 10.2 Typography Scale

```css
/* Base: 16px */
fontSize: {
  xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
  sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
  base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
  lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
  xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
  '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
}
```

### 10.3 Spacing Scale

Standard Tailwind spacing: `0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96`

### 10.4 Animation Tokens

```css
/* Dignified animations per UX spec */
transition: {
  DEFAULT: '150ms ease-in-out',
  fast: '100ms ease-in-out',
  slow: '300ms ease-in-out',
}

animation: {
  'pulse-slow': 'pulse 3s ease-in-out infinite',
  'fade-in': 'fadeIn 200ms ease-out',
  'slide-up': 'slideUp 200ms ease-out',
}
```

---

## 11. User Journey Mapping

### 11.1 Priority Journeys (P0)

| Journey | Pages | Critical Components |
|---------|-------|-------------------|
| **Trust Verification** | `/verify/[hash]` | VerificationBadge, ChainViewer |
| **Marketplace Acquisition** | `/marketplace` → `/marketplace/[id]` | ListingCard, AcquisitionModal |
| **Agent Creation** | `/agents/new` | AgentForm |
| **Dashboard Overview** | `/dashboard` | Role-based views |

### 11.2 Journey: Trust Verification

```
User lands on /verify/abc123
        │
        ▼
┌───────────────────────┐
│ 1. Load verification  │  RSC fetches record
│    data (RSC)         │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 2. Display verified   │  VerificationBadge
│    status             │  ChainIntegrityIndicator
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 3. Show record        │  RecordCard
│    details            │  TimestampDisplay
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 4. Blockchain anchor  │  AnchorProof
│    (if available)     │  ExternalLink to explorer
└───────────────────────┘
```

### 11.3 Journey: Marketplace Acquisition

```
User browses /marketplace
        │
        ▼
┌───────────────────────┐
│ 1. Filter listings    │  MarketplaceFilters (Client)
│    (Client)           │  URL state management
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 2. View listing grid  │  ListingCard (RSC)
│    (RSC)              │  TrustBadge, CertificationBadge
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 3. Click listing      │  Navigate to /marketplace/[id]
│                       │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 4. View detail page   │  ListingDetail (RSC)
│    (RSC + Client)     │  AcquisitionOptions (Client)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 5. Select acquisition │  AcquisitionModal (Client)
│    type               │  PaymentForm
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 6. Confirm & record   │  SuccessState
│    on Truth Chain     │  TruthChainReceipt
└───────────────────────┘
```

---

## 12. Error Handling

### 12.1 Error Hierarchy

```tsx
// app/error.tsx - Global error boundary
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-gray-600 mt-2">{error.message}</p>
            <button onClick={reset} className="mt-4 btn-primary">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
```

```tsx
// app/(dashboard)/error.tsx - Dashboard error boundary
'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">
          Dashboard Error
        </h2>
        <p className="text-red-700 mt-2">{error.message}</p>
        <button onClick={reset} className="mt-4 btn-outline">
          Retry
        </button>
      </div>
    </div>
  )
}
```

### 12.2 API Error Handling

```tsx
// lib/api/client.ts
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export async function fetchAPI<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new APIError(
      error.message || 'An error occurred',
      response.status,
      error.code
    )
  }

  return response.json()
}
```

---

## Appendix A: File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Components** | PascalCase | `TrustBadge.tsx` |
| **Hooks** | camelCase with `use` prefix | `useTrustScore.ts` |
| **Utils** | kebab-case | `format-utils.ts` |
| **Types** | PascalCase | `Agent.ts` or inline |
| **Pages** | `page.tsx` | `app/agents/page.tsx` |
| **Layouts** | `layout.tsx` | `app/(dashboard)/layout.tsx` |
| **Tests** | `*.test.tsx` | `TrustBadge.test.tsx` |

---

## Appendix B: Import Ordering

```tsx
// 1. React/Next
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 2. Third-party libraries
import { motion } from 'framer-motion'
import { z } from 'zod'

// 3. Internal aliases (@/)
import { cn } from '@/lib/utils'
import { useAgent } from '@/hooks/useAgent'

// 4. Relative imports
import { SubComponent } from './SubComponent'

// 5. Types (always last)
import type { Agent } from '@/lib/agents/types'
```

---

**End of Frontend Architecture Document**

*"User journeys drive technical decisions. Embrace boring technology for stability."*

*AgentAnchor Frontend Architecture v1.0*
