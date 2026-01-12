'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  ChevronUp,
  ChevronDown,
  Users,
  GraduationCap,
  Shield,
  Eye,
  Store,
  Wrench,
  Crown,
  Gavel,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  DoorOpen,
  User,
  Briefcase
} from 'lucide-react'

// Building floor configuration - "The Anchor" Tower (10 floors, 1-10)
export const BUILDING_FLOORS = [
  {
    floor: 10,
    name: 'Council Chambers',
    icon: Crown,
    path: '/council',
    description: 'Governance & Decisions',
    color: 'from-purple-600 to-indigo-700',
    badge: 'RESTRICTED',
    wing: 'governance',
    vibe: 'Marble halls, council table, serious deliberation'
  },
  {
    floor: 9,
    name: 'Tribunal',
    icon: Gavel,
    path: '/tribunal',
    description: 'Appeals & Disputes',
    color: 'from-red-600 to-rose-700',
    badge: 'JUDICIAL',
    wing: 'governance',
    vibe: 'Courtroom aesthetic, balanced scales, fair hearing'
  },
  {
    floor: 8,
    name: 'Arena',
    icon: Sparkles,
    path: '/shadow-training',
    description: 'A/B Testing & Comparison',
    color: 'from-orange-500 to-amber-600',
    badge: 'TRAINING',
    wing: 'trainer',
    vibe: 'Sparring grounds, side-by-side displays, competition'
  },
  {
    floor: 7,
    name: 'Observer Deck',
    icon: Eye,
    path: '/observer',
    description: 'Audit Trail & Monitoring',
    color: 'from-cyan-500 to-blue-600',
    badge: 'SURVEILLANCE',
    wing: 'governance',
    vibe: 'Glass walls, panoramic views, watchful presence'
  },
  {
    floor: 6,
    name: 'Academy',
    icon: GraduationCap,
    path: '/academy',
    description: 'Training & Certification',
    color: 'from-green-500 to-emerald-600',
    badge: 'EDUCATION',
    wing: 'trainer',
    vibe: 'Classrooms, libraries, graduation ceremonies'
  },
  {
    floor: 5,
    name: 'Trust Vault',
    icon: Shield,
    path: '/trust',
    description: 'Scores & Credentials',
    color: 'from-blue-500 to-indigo-600',
    badge: 'SECURE',
    wing: 'consumer',
    vibe: 'Bank vault aesthetic, credentials on display, earned badges'
  },
  {
    floor: 4,
    name: 'Marketplace',
    icon: Store,
    path: '/marketplace',
    description: 'Browse & Acquire Agents',
    color: 'from-pink-500 to-rose-600',
    badge: 'COMMERCE',
    wing: 'consumer',
    vibe: 'Bustling bazaar, agent storefronts, live ticker'
  },
  {
    floor: 3,
    name: 'Workshop',
    icon: Wrench,
    path: '/agents',
    description: 'Build & Configure',
    color: 'from-yellow-500 to-orange-600',
    badge: 'CREATION',
    wing: 'trainer',
    vibe: 'Maker space, tools on walls, agents under construction'
  },
  {
    floor: 2,
    name: 'Compliance Vault',
    icon: Shield,
    path: '/compliance',
    description: 'SOC2, HIPAA, ISO 27001',
    color: 'from-slate-700 to-zinc-800',
    badge: 'COMPLIANCE',
    wing: 'governance',
    vibe: 'Secure archive, filing cabinets, audit rooms'
  },
  {
    floor: 1,
    name: 'Lobby',
    icon: Building2,
    path: '/dashboard',
    description: 'Main Dashboard & Welcome',
    color: 'from-gray-600 to-slate-700',
    badge: 'WELCOME',
    wing: 'shared',
    vibe: 'Grand entrance, directory, concierge desk'
  },
] as const

// Wing type for filtering
export type WingType = 'trainer' | 'consumer' | 'governance' | 'shared'

// Wing configuration - Three distinct areas of The Anchor
export const WINGS = {
  trainer: {
    name: 'Trainer Wing',
    icon: Briefcase,
    tagline: 'Build. Train. Earn.',
    description: 'Build, train, and monetize agents',
    color: 'from-blue-500 to-indigo-600',
    floors: [3, 6, 8], // Workshop, Academy, Arena
    paths: ['/agents', '/academy', '/shadow-training', '/earnings', '/settings']
  },
  consumer: {
    name: 'Consumer Wing',
    icon: User,
    tagline: 'Discover. Trust. Deploy.',
    description: 'Discover and acquire trusted agents',
    color: 'from-green-500 to-emerald-600',
    floors: [1, 4, 5], // Lobby, Marketplace, Trust Vault
    paths: ['/marketplace', '/my-agents', '/subscriptions', '/dashboard']
  },
  governance: {
    name: 'Governance Wing',
    icon: Crown,
    tagline: 'Oversee. Audit. Protect.',
    description: 'Oversight, compliance, and governance',
    color: 'from-purple-500 to-indigo-600',
    floors: [2, 7, 9, 10], // Compliance, Observer, Tribunal, Council
    paths: ['/compliance', '/observer', '/tribunal', '/council']
  }
} as const

interface BuildingNavigationProps {
  currentFloor?: number
  onFloorSelect?: (floor: number) => void
  showElevator?: boolean
  compact?: boolean
}

export function BuildingNavigation({
  currentFloor: propCurrentFloor,
  onFloorSelect,
  showElevator = true,
  compact = false
}: BuildingNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [elevatorMoving, setElevatorMoving] = useState(false)
  const [targetFloor, setTargetFloor] = useState<number | null>(null)

  // Determine current floor from pathname
  const currentFloor = propCurrentFloor ?? BUILDING_FLOORS.find(f =>
    pathname.startsWith(f.path)
  )?.floor ?? 1

  const handleFloorSelect = async (floor: number) => {
    if (floor === currentFloor) return

    const floorConfig = BUILDING_FLOORS.find(f => f.floor === floor)
    if (!floorConfig) return

    setTargetFloor(floor)
    setElevatorMoving(true)

    // Simulate elevator travel time (100ms per floor)
    const travelTime = Math.abs(currentFloor - floor) * 100
    await new Promise(resolve => setTimeout(resolve, travelTime))

    setElevatorMoving(false)
    setTargetFloor(null)

    if (onFloorSelect) {
      onFloorSelect(floor)
    } else {
      router.push(floorConfig.path)
    }
  }

  if (compact) {
    return (
      <CompactFloorIndicator
        currentFloor={currentFloor}
        onFloorSelect={handleFloorSelect}
      />
    )
  }

  return (
    <div className="relative">
      {/* Building Exterior Frame */}
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-1 shadow-2xl">
        <div className="bg-gradient-to-b from-slate-700 to-slate-800 rounded-lg p-3">
          {/* Building Sign */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full">
              <Building2 className="h-4 w-4 text-white" />
              <span className="text-xs font-bold text-white tracking-wider">
                AGENT ANCHOR TOWER
              </span>
            </div>
          </div>

          {/* Floor Stack */}
          <div className="relative space-y-1">
            {BUILDING_FLOORS.map((floor) => {
              const isActive = currentFloor === floor.floor
              const isTarget = targetFloor === floor.floor
              const FloorIcon = floor.icon

              return (
                <motion.button
                  key={floor.floor}
                  onClick={() => handleFloorSelect(floor.floor)}
                  disabled={elevatorMoving}
                  className={`
                    w-full relative group transition-all duration-200
                    ${isActive
                      ? 'scale-105 z-10'
                      : 'hover:scale-102 opacity-80 hover:opacity-100'
                    }
                  `}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`
                    relative overflow-hidden rounded-lg p-2
                    ${isActive
                      ? `bg-gradient-to-r ${floor.color} shadow-lg`
                      : 'bg-slate-600/50 hover:bg-slate-600'
                    }
                  `}>
                    {/* Floor Number */}
                    <div className={`
                      absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center
                      font-mono font-bold text-lg
                      ${isActive ? 'text-white/90' : 'text-slate-400'}
                    `}>
                      {floor.floor}
                    </div>

                    {/* Floor Content */}
                    <div className="ml-8 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FloorIcon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                        <div className="text-left">
                          <div className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-200'}`}>
                            {floor.name}
                          </div>
                          <div className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                            {floor.description}
                          </div>
                        </div>
                      </div>

                      {/* Badge */}
                      <span className={`
                        text-[8px] font-bold px-1.5 py-0.5 rounded
                        ${isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-700 text-slate-400'
                        }
                      `}>
                        {floor.badge}
                      </span>
                    </div>

                    {/* Active Floor Indicator Light */}
                    {isActive && (
                      <motion.div
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-400"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}

                    {/* Target Floor Indicator */}
                    {isTarget && (
                      <motion.div
                        className="absolute inset-0 border-2 border-yellow-400 rounded-lg"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 0.3, repeat: Infinity }}
                      />
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Elevator Animation */}
          {showElevator && elevatorMoving && (
            <ElevatorAnimation
              fromFloor={currentFloor}
              toFloor={targetFloor!}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Compact floor indicator for header/sidebar
function CompactFloorIndicator({
  currentFloor,
  onFloorSelect
}: {
  currentFloor: number
  onFloorSelect: (floor: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const floor = BUILDING_FLOORS.find(f => f.floor === currentFloor)
  const FloorIcon = floor?.icon ?? Building2

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-gradient-to-r ${floor?.color ?? 'from-gray-600 to-slate-700'}
          text-white shadow-lg hover:shadow-xl transition-all
        `}
      >
        <FloorIcon className="h-4 w-4" />
        <span className="font-semibold text-sm">{floor?.name ?? 'Unknown'}</span>
        <span className="text-xs opacity-70">F{currentFloor}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50"
          >
            {BUILDING_FLOORS.map((f) => {
              const Icon = f.icon
              const isActive = f.floor === currentFloor
              return (
                <button
                  key={f.floor}
                  onClick={() => {
                    onFloorSelect(f.floor)
                    setIsOpen(false)
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                    ${isActive
                      ? `bg-gradient-to-r ${f.color} text-white`
                      : 'hover:bg-slate-700 text-slate-300'
                    }
                  `}
                >
                  <span className="font-mono text-sm w-6">{f.floor}</span>
                  <Icon className="h-4 w-4" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs opacity-70">{f.description}</div>
                  </div>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Elevator animation overlay
function ElevatorAnimation({
  fromFloor,
  toFloor
}: {
  fromFloor: number
  toFloor: number
}) {
  const goingUp = toFloor > fromFloor
  const floors = Math.abs(toFloor - fromFloor)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
    >
      <div className="text-center">
        {/* Elevator Doors */}
        <div className="relative w-48 h-64 mx-auto mb-4">
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-1/2 bg-gradient-to-r from-slate-600 to-slate-500 rounded-l-lg"
            initial={{ x: 0 }}
            animate={{ x: -100 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-slate-600 to-slate-500 rounded-r-lg"
            initial={{ x: 0 }}
            animate={{ x: 100 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />

          {/* Inside elevator */}
          <div className="absolute inset-0 bg-gradient-to-b from-amber-100 to-amber-200 rounded-lg flex items-center justify-center">
            <motion.div
              animate={{ y: goingUp ? [-10, 10] : [10, -10] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
              className="text-6xl"
            >
              {goingUp ? '🔼' : '🔽'}
            </motion.div>
          </div>
        </div>

        {/* Floor Counter */}
        <motion.div
          className="text-4xl font-mono font-bold text-white mb-2"
          key={toFloor}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          F{toFloor}
        </motion.div>

        <p className="text-white/70 text-sm">
          {goingUp ? 'Going up...' : 'Going down...'}
        </p>

        {/* Floor name */}
        <p className="text-white font-semibold mt-2">
          {BUILDING_FLOORS.find(f => f.floor === toFloor)?.name}
        </p>
      </div>
    </motion.div>
  )
}

export default BuildingNavigation
