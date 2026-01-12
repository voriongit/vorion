/**
 * Hooks Barrel Export
 *
 * Central export for all custom hooks.
 * Part of Frontend Architecture Section 6.
 */

// Agent Hooks
export { useAgent, useAgents, useOptimisticAgent } from './useAgent'

// Trust Score Hooks
export { useTrustScore, useTrustHistory, useTrustTrend } from './useTrustScore'

// User/Auth Hooks
export { useUser, useRequireAuth } from './useUser'

// Media Query Hooks
export { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from './useMediaQuery'

// UI State Hooks
export { useSidebar } from './useSidebar'

// Utility Hooks
export { useDebounce, useDebouncedCallback, useThrottledCallback } from './useDebounce'

// Accessibility Hooks
export {
  useReducedMotion,
  useHighContrast,
  useFocusTrap,
  useAnnounce,
  useSkipLink,
  useKeyboardShortcut,
  useEscapeKey,
} from './useAccessibility'

// Re-export Pusher hooks for convenience
export {
  usePusherEvent,
  useTypedPusherEvent,
  usePrivatePusherEvent,
  useObserverFeed,
  useUserNotifications,
} from '@/lib/pusher/hooks'
