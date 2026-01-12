'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronUp,
  ChevronDown,
  Map,
  X,
  Maximize2,
  Users,
  Zap
} from 'lucide-react'
import { BUILDING_FLOORS, WINGS } from './BuildingNavigation'

// Simulated activity data (replace with real-time data from Pusher/API)
interface FloorActivity {
  floor: number
  users: number
  activity: 'quiet' | 'moderate' | 'busy' | 'bustling'
  recentEvents: number // events in last 5 min
  trending?: boolean
}

// Activity pulse colors
const ACTIVITY_COLORS = {
  quiet: { bg: 'bg-slate-600', pulse: 'bg-slate-400', text: 'text-slate-400' },
  moderate: { bg: 'bg-green-600', pulse: 'bg-green-400', text: 'text-green-400' },
  busy: { bg: 'bg-yellow-600', pulse: 'bg-yellow-400', text: 'text-yellow-400' },
  bustling: { bg: 'bg-orange-600', pulse: 'bg-orange-400', text: 'text-orange-400' }
}

// Hook to get floor activity (simulated for now)
function useFloorActivity(): FloorActivity[] {
  // Initialize with default values to avoid hydration mismatch
  const [activity, setActivity] = useState<FloorActivity[]>(() =>
    BUILDING_FLOORS.map(f => ({
      floor: f.floor,
      users: 5,
      activity: 'quiet' as const,
      recentEvents: 0,
      trending: false
    }))
  )

  useEffect(() => {
    // Simulate initial activity (only on client)
    const generateActivity = () => {
      return BUILDING_FLOORS.map(f => ({
        floor: f.floor,
        users: Math.floor(Math.random() * 50) + 1,
        activity: ['quiet', 'moderate', 'busy', 'bustling'][Math.floor(Math.random() * 4)] as FloorActivity['activity'],
        recentEvents: Math.floor(Math.random() * 20),
        trending: Math.random() > 0.7
      }))
    }

    // Delay to avoid hydration mismatch
    const timer = setTimeout(() => setActivity(generateActivity()), 100)

    // Update activity periodically
    const interval = setInterval(() => {
      setActivity(prev => prev.map(f => ({
        ...f,
        users: Math.max(1, f.users + Math.floor(Math.random() * 7) - 3),
        recentEvents: Math.floor(Math.random() * 20),
        activity: f.users > 35 ? 'bustling' : f.users > 20 ? 'busy' : f.users > 10 ? 'moderate' : 'quiet',
        trending: Math.random() > 0.8
      })))
    }, 5000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])

  return activity
}

interface MiniMapProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  defaultExpanded?: boolean
  onOpenDirectory?: () => void
  showActivity?: boolean
}

export function MiniMap({
  position = 'bottom-right',
  defaultExpanded = false,
  onOpenDirectory,
  showActivity = true
}: MiniMapProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isHovered, setIsHovered] = useState(false)
  const floorActivity = useFloorActivity()

  // Find current floor
  const currentFloor = BUILDING_FLOORS.find(f =>
    pathname.startsWith(f.path)
  )?.floor ?? 1

  // Get activity for a specific floor
  const getFloorActivity = (floor: number): FloorActivity =>
    floorActivity.find(a => a.floor === floor) ?? { floor, users: 0, activity: 'quiet' as const, recentEvents: 0, trending: false }

  // Total active users
  const totalUsers = floorActivity.reduce((sum, f) => sum + f.users, 0)

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  }

  const handleFloorClick = (floor: number) => {
    const floorConfig = BUILDING_FLOORS.find(f => f.floor === floor)
    if (floorConfig) {
      router.push(floorConfig.path)
    }
  }

  const goUp = () => {
    const nextFloor = BUILDING_FLOORS.find(f => f.floor === currentFloor + 1)
    if (nextFloor) {
      router.push(nextFloor.path)
    }
  }

  const goDown = () => {
    const nextFloor = BUILDING_FLOORS.find(f => f.floor === currentFloor - 1)
    if (nextFloor) {
      router.push(nextFloor.path)
    }
  }

  const canGoUp = currentFloor < 10
  const canGoDown = currentFloor > 1

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {isExpanded ? (
          // Expanded mini-map
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-white">The Anchor</span>
              </div>
              <div className="flex items-center gap-1">
                {onOpenDirectory && (
                  <button
                    onClick={onOpenDirectory}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                    title="Open Directory"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Floor stack */}
            <div className="p-2">
              <div className="relative">
                {/* Building outline */}
                <div className="absolute inset-0 border-2 border-slate-700 rounded-lg pointer-events-none" />

                {/* Floors */}
                <div className="space-y-0.5 p-1">
                  {BUILDING_FLOORS.map((floor) => {
                    const isActive = floor.floor === currentFloor
                    const FloorIcon = floor.icon
                    const activity = getFloorActivity(floor.floor)
                    const activityColor = ACTIVITY_COLORS[activity.activity]

                    return (
                      <motion.button
                        key={floor.floor}
                        onClick={() => handleFloorClick(floor.floor)}
                        className={`
                          w-full flex items-center gap-2 px-2 py-1 rounded text-left
                          transition-all text-xs relative
                          ${isActive
                            ? `bg-gradient-to-r ${floor.color} text-white`
                            : 'hover:bg-slate-800 text-slate-400'
                          }
                        `}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="w-4 font-mono text-[10px] opacity-70">
                          {floor.floor}
                        </span>
                        <FloorIcon className="h-3 w-3" />
                        <span className="truncate flex-1">{floor.name}</span>

                        {/* Activity indicators */}
                        {showActivity && (
                          <div className="flex items-center gap-1">
                            {/* User count */}
                            <span className={`text-[9px] ${isActive ? 'text-white/70' : activityColor.text}`}>
                              {activity.users}
                            </span>

                            {/* Activity pulse */}
                            <div className="relative">
                              <div className={`w-1.5 h-1.5 rounded-full ${activityColor.bg}`} />
                              {activity.activity !== 'quiet' && (
                                <motion.div
                                  className={`absolute inset-0 rounded-full ${activityColor.pulse}`}
                                  animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
                                  transition={{
                                    duration: activity.activity === 'bustling' ? 0.8 : 1.5,
                                    repeat: Infinity
                                  }}
                                />
                              )}
                            </div>

                            {/* Trending indicator */}
                            {activity.trending && (
                              <Zap className="h-2.5 w-2.5 text-yellow-400" />
                            )}
                          </div>
                        )}

                        {isActive && !showActivity && (
                          <motion.div
                            className="w-1.5 h-1.5 rounded-full bg-green-400"
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Quick navigation + total activity */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700 bg-slate-800/30">
              {/* Total users */}
              {showActivity && (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3 w-3" />
                  <span>{totalUsers}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={goDown}
                  disabled={!canGoDown}
                  className={`
                    p-1.5 rounded transition-colors
                    ${canGoDown
                      ? 'hover:bg-slate-700 text-slate-400'
                      : 'text-slate-600 cursor-not-allowed'
                    }
                  `}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <span className="text-xs text-slate-500 px-2">
                  F{currentFloor}
                </span>
                <button
                  onClick={goUp}
                  disabled={!canGoUp}
                  className={`
                    p-1.5 rounded transition-colors
                    ${canGoUp
                      ? 'hover:bg-slate-700 text-slate-400'
                      : 'text-slate-600 cursor-not-allowed'
                    }
                  `}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>

              {/* Activity legend */}
              {showActivity && (
                <div className="flex items-center gap-1">
                  {(['quiet', 'moderate', 'busy', 'bustling'] as const).map(level => (
                    <div
                      key={level}
                      className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_COLORS[level].bg}`}
                      title={level}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          // Collapsed mini-map
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            className={`
              relative flex items-center gap-2 px-3 py-2 rounded-xl
              bg-slate-900/90 backdrop-blur-sm border border-slate-700
              shadow-lg hover:shadow-xl transition-all
              ${isHovered ? 'scale-105' : ''}
            `}
            whileTap={{ scale: 0.95 }}
          >
            {/* Building visualization with activity */}
            <div className="relative w-6 h-12">
              {/* Building shape */}
              <div className="absolute inset-0 bg-slate-700 rounded-sm" />

              {/* Activity windows for each floor */}
              {showActivity && floorActivity.map(activity => {
                const colors = ACTIVITY_COLORS[activity.activity]
                const isCurrentFloor = activity.floor === currentFloor
                return (
                  <motion.div
                    key={activity.floor}
                    className={`absolute left-0.5 right-0.5 h-1 rounded-sm ${
                      isCurrentFloor
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                        : colors.bg
                    }`}
                    style={{
                      bottom: `${((activity.floor - 1) / 9) * 100}%`,
                    }}
                    animate={
                      activity.activity !== 'quiet' || isCurrentFloor
                        ? { opacity: [0.6, 1, 0.6] }
                        : { opacity: 0.3 }
                    }
                    transition={{
                      duration: activity.activity === 'bustling' ? 0.5 : 1.5,
                      repeat: Infinity
                    }}
                  />
                )
              })}

              {/* Floor lines */}
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 h-px bg-slate-600/50"
                  style={{ bottom: `${(i / 9) * 100}%` }}
                />
              ))}
            </div>

            {/* Floor label */}
            <div className="text-left">
              <div className="text-[10px] text-slate-500 leading-none">Floor</div>
              <div className="text-lg font-bold text-white leading-none">
                {currentFloor}
              </div>
            </div>

            {/* Elevator buttons */}
            <div className="flex flex-col gap-0.5">
              <motion.div
                className={`w-4 h-4 rounded flex items-center justify-center ${
                  canGoUp ? 'bg-slate-700 cursor-pointer' : 'bg-slate-800'
                }`}
                onClick={(e) => { e.stopPropagation(); goUp(); }}
                whileHover={canGoUp ? { backgroundColor: '#4b5563' } : {}}
                whileTap={canGoUp ? { scale: 0.9 } : {}}
              >
                <ChevronUp className={`h-3 w-3 ${canGoUp ? 'text-slate-400' : 'text-slate-600'}`} />
              </motion.div>
              <motion.div
                className={`w-4 h-4 rounded flex items-center justify-center ${
                  canGoDown ? 'bg-slate-700 cursor-pointer' : 'bg-slate-800'
                }`}
                onClick={(e) => { e.stopPropagation(); goDown(); }}
                whileHover={canGoDown ? { backgroundColor: '#4b5563' } : {}}
                whileTap={canGoDown ? { scale: 0.9 } : {}}
              >
                <ChevronDown className={`h-3 w-3 ${canGoDown ? 'text-slate-400' : 'text-slate-600'}`} />
              </motion.div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MiniMap
