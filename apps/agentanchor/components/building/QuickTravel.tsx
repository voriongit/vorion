'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, Command } from 'lucide-react'
import { BUILDING_FLOORS, WINGS } from './BuildingNavigation'
import { getSmartFloorPath } from './FloorMemory'

interface QuickTravelState {
  isOpen: boolean
  mode: 'floors' | 'wings' | 'search'
  inputBuffer: string
}

/**
 * Hook for keyboard navigation throughout The Anchor
 *
 * Shortcuts:
 * - 1-9, 0: Jump to floor (0 = floor 10)
 * - T: Trainer Wing
 * - C: Consumer Wing
 * - G: Governance Wing
 * - /: Quick search (focus search bar)
 * - ?: Help overlay
 * - Escape: Close any overlay
 */
export function useQuickTravel() {
  const router = useRouter()
  const pathname = usePathname()
  const [showHelp, setShowHelp] = useState(false)
  const [lastNavigation, setLastNavigation] = useState<string | null>(null)

  const navigateToFloor = useCallback((floor: number) => {
    const path = getSmartFloorPath(floor)
    setLastNavigation(`Floor ${floor}`)
    router.push(path)
  }, [router])

  const navigateToWing = useCallback((wing: 'trainer' | 'consumer' | 'governance') => {
    const wingConfig = WINGS[wing]
    if (!wingConfig) return

    // Navigate to first floor in wing
    const firstFloor = wingConfig.floors[0]
    const path = getSmartFloorPath(firstFloor)
    setLastNavigation(wingConfig.name)
    router.push(path)
  }, [router])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Number keys for floors (1-9, 0 for 10)
      if (/^[0-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        const floor = e.key === '0' ? 10 : parseInt(e.key)
        navigateToFloor(floor)
        return
      }

      // Wing shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 't':
            e.preventDefault()
            navigateToWing('trainer')
            break
          case 'c':
            e.preventDefault()
            navigateToWing('consumer')
            break
          case 'g':
            e.preventDefault()
            navigateToWing('governance')
            break
          case '?':
            e.preventDefault()
            setShowHelp(prev => !prev)
            break
          case 'escape':
            setShowHelp(false)
            break
        }
      }

      // Cmd/Ctrl + K for search (common pattern)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Focus search if exists, or show floor picker
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateToFloor, navigateToWing])

  // Clear last navigation after a delay
  useEffect(() => {
    if (lastNavigation) {
      const timer = setTimeout(() => setLastNavigation(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [lastNavigation])

  return {
    showHelp,
    setShowHelp,
    lastNavigation,
    navigateToFloor,
    navigateToWing
  }
}

/**
 * Quick Travel Provider - adds keyboard listener and UI components
 */
export function QuickTravelProvider({ children }: { children: React.ReactNode }) {
  const { showHelp, setShowHelp, lastNavigation } = useQuickTravel()

  return (
    <>
      {children}

      {/* Navigation Toast */}
      <AnimatePresence>
        {lastNavigation && (
          <QuickTravelToast destination={lastNavigation} />
        )}
      </AnimatePresence>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <QuickTravelHelp onClose={() => setShowHelp(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * Toast notification for quick navigation
 */
function QuickTravelToast({ destination }: { destination: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full shadow-lg border border-slate-700">
        <Keyboard className="w-4 h-4 text-slate-400" />
        <span className="text-white font-medium">Traveling to {destination}</span>
      </div>
    </motion.div>
  )
}

/**
 * Help overlay showing all keyboard shortcuts
 */
function QuickTravelHelp({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-600/20 rounded-lg">
            <Command className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Quick Travel</h2>
            <p className="text-slate-400 text-sm">Keyboard shortcuts for The Anchor</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Floor Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Floors
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {BUILDING_FLOORS.slice().reverse().map(floor => (
                <ShortcutRow
                  key={floor.floor}
                  shortcut={floor.floor === 10 ? '0' : floor.floor.toString()}
                  label={`F${floor.floor}: ${floor.name}`}
                />
              ))}
            </div>
          </div>

          {/* Wing Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Wings
            </h3>
            <div className="space-y-2">
              <ShortcutRow shortcut="T" label="Trainer Wing" />
              <ShortcutRow shortcut="C" label="Consumer Wing" />
              <ShortcutRow shortcut="G" label="Governance Wing" />
            </div>
          </div>

          {/* General */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              General
            </h3>
            <div className="space-y-2">
              <ShortcutRow shortcut="?" label="Toggle this help" />
              <ShortcutRow shortcut="Esc" label="Close overlays" />
              <ShortcutRow shortcut="Cmd+K" label="Quick search" />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700">
          <p className="text-center text-slate-500 text-sm">
            Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">?</kbd> anytime to see these shortcuts
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ShortcutRow({ shortcut, label }: { shortcut: string, label: string }) {
  return (
    <div className="flex items-center gap-3">
      <kbd className="min-w-[2rem] px-2 py-1 bg-slate-700 rounded text-center text-white font-mono text-sm">
        {shortcut}
      </kbd>
      <span className="text-slate-300 text-sm">{label}</span>
    </div>
  )
}

/**
 * Compact shortcut hint for headers/footers
 */
export function QuickTravelHint() {
  return (
    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
      <Keyboard className="w-3 h-3" />
      <span>Press</span>
      <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 font-mono text-[10px]">?</kbd>
      <span>for shortcuts</span>
    </div>
  )
}
