'use client'

import { useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { BUILDING_FLOORS } from './BuildingNavigation'

const STORAGE_KEY = 'anchor-floor-memory'

interface FloorMemoryState {
  [floorNumber: number]: {
    lastPath: string
    lastVisited: number
    scrollPosition?: number
    activeTab?: string
    searchQuery?: string
    filters?: Record<string, unknown>
  }
}

// Get current floor from pathname
function getFloorFromPath(pathname: string): number | null {
  const floor = BUILDING_FLOORS.find(f => pathname.startsWith(f.path))
  return floor?.floor ?? null
}

// Load memory from localStorage
function loadFloorMemory(): FloorMemoryState {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Save memory to localStorage
function saveFloorMemory(state: FloorMemoryState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Hook to remember and restore user's position on each floor
 *
 * Usage:
 * ```tsx
 * const {
 *   savePosition,
 *   getLastPosition,
 *   clearFloorMemory
 * } = useFloorMemory()
 *
 * // Save current state when leaving
 * savePosition({
 *   scrollPosition: window.scrollY,
 *   activeTab: 'grid',
 *   searchQuery: 'react'
 * })
 *
 * // Restore when returning
 * const lastState = getLastPosition(4) // Marketplace
 * if (lastState?.scrollPosition) {
 *   window.scrollTo(0, lastState.scrollPosition)
 * }
 * ```
 */
export function useFloorMemory() {
  const pathname = usePathname()

  // Save current position for current floor
  const savePosition = useCallback((extras?: {
    scrollPosition?: number
    activeTab?: string
    searchQuery?: string
    filters?: Record<string, unknown>
  }) => {
    const currentFloor = getFloorFromPath(pathname)
    if (currentFloor === null) return

    const memory = loadFloorMemory()
    memory[currentFloor] = {
      lastPath: pathname,
      lastVisited: Date.now(),
      ...extras
    }
    saveFloorMemory(memory)
  }, [pathname])

  // Get last position for a floor
  const getLastPosition = useCallback((floor: number) => {
    const memory = loadFloorMemory()
    return memory[floor] ?? null
  }, [])

  // Get last path for a floor (for navigation)
  const getLastPath = useCallback((floor: number): string | null => {
    const memory = loadFloorMemory()
    return memory[floor]?.lastPath ?? null
  }, [])

  // Clear memory for a floor or all floors
  const clearFloorMemory = useCallback((floor?: number) => {
    if (floor !== undefined) {
      const memory = loadFloorMemory()
      delete memory[floor]
      saveFloorMemory(memory)
    } else {
      saveFloorMemory({})
    }
  }, [])

  // Auto-save path on navigation
  useEffect(() => {
    const currentFloor = getFloorFromPath(pathname)
    if (currentFloor === null) return

    const memory = loadFloorMemory()
    memory[currentFloor] = {
      ...memory[currentFloor],
      lastPath: pathname,
      lastVisited: Date.now()
    }
    saveFloorMemory(memory)
  }, [pathname])

  return {
    savePosition,
    getLastPosition,
    getLastPath,
    clearFloorMemory,
    currentFloor: getFloorFromPath(pathname)
  }
}

/**
 * Provider component for floor memory with scroll restoration
 */
export function FloorMemoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { getLastPosition, savePosition } = useFloorMemory()

  // Save scroll position on route change
  useEffect(() => {
    const handleBeforeUnload = () => {
      savePosition({ scrollPosition: window.scrollY })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [savePosition])

  // Restore scroll position when returning to a floor
  useEffect(() => {
    const currentFloor = getFloorFromPath(pathname)
    if (currentFloor === null) return

    const lastState = getLastPosition(currentFloor)
    if (lastState?.scrollPosition && lastState.lastPath === pathname) {
      // Small delay to let content render
      setTimeout(() => {
        window.scrollTo({ top: lastState.scrollPosition, behavior: 'instant' })
      }, 100)
    }
  }, [pathname, getLastPosition])

  return <>{children}</>
}

/**
 * Get recently visited floors (for quick access)
 */
export function getRecentFloors(limit: number = 5): Array<{
  floor: number
  path: string
  lastVisited: number
}> {
  const memory = loadFloorMemory()
  return Object.entries(memory)
    .map(([floor, state]) => ({
      floor: parseInt(floor),
      path: state.lastPath,
      lastVisited: state.lastVisited
    }))
    .sort((a, b) => b.lastVisited - a.lastVisited)
    .slice(0, limit)
}

/**
 * Smart navigation - returns last path for floor if available, otherwise default
 */
export function getSmartFloorPath(floor: number): string {
  const memory = loadFloorMemory()
  const floorConfig = BUILDING_FLOORS.find(f => f.floor === floor)
  const defaultPath = floorConfig?.path ?? '/dashboard'

  // If we have a recent memory (within 24 hours), use it
  const lastState = memory[floor]
  if (lastState) {
    const hoursSinceVisit = (Date.now() - lastState.lastVisited) / (1000 * 60 * 60)
    if (hoursSinceVisit < 24) {
      return lastState.lastPath
    }
  }

  return defaultPath
}
