'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  MapPin,
  Users,
  Activity,
  ChevronRight,
  Briefcase,
  User,
  Crown,
  X
} from 'lucide-react'
import { BUILDING_FLOORS, WINGS, type WingType } from './BuildingNavigation'

interface FloorDirectoryProps {
  currentFloor?: number
  isOpen?: boolean
  onClose?: () => void
  onFloorSelect?: (floor: number) => void
  showActivity?: boolean
}

// Simulated floor activity (would come from real-time data)
const getFloorActivity = (floor: number) => {
  const activities: Record<number, { users: number; status: 'busy' | 'moderate' | 'quiet' }> = {
    9: { users: 3, status: 'quiet' },
    8: { users: 1, status: 'quiet' },
    7: { users: 12, status: 'busy' },
    6: { users: 5, status: 'moderate' },
    5: { users: 28, status: 'busy' },
    4: { users: 8, status: 'moderate' },
    3: { users: 45, status: 'busy' },
    2: { users: 15, status: 'moderate' },
    1: { users: 22, status: 'moderate' },
    0: { users: 2, status: 'quiet' },
  }
  return activities[floor] || { users: 0, status: 'quiet' }
}

const wingIcons = {
  trainer: Briefcase,
  consumer: User,
  governance: Crown,
  shared: Building2
}

const wingColors = {
  trainer: 'text-blue-500',
  consumer: 'text-green-500',
  governance: 'text-purple-500',
  shared: 'text-slate-500'
}

export function FloorDirectory({
  currentFloor = 1,
  isOpen = false,
  onClose,
  onFloorSelect,
  showActivity = true
}: FloorDirectoryProps) {
  const router = useRouter()
  const [filterWing, setFilterWing] = useState<WingType | 'all'>('all')
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null)

  const handleFloorClick = (floor: typeof BUILDING_FLOORS[number]) => {
    if (onFloorSelect) {
      onFloorSelect(floor.floor)
    } else {
      router.push(floor.path)
    }
    onClose?.()
  }

  const filteredFloors = BUILDING_FLOORS.filter(f =>
    filterWing === 'all' || f.wing === filterWing
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">The Anchor</h2>
                    <p className="text-white/70 text-sm">Building Directory</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>

              {/* You Are Here indicator */}
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
                <MapPin className="h-4 w-4 text-green-400 animate-pulse" />
                <span className="text-white text-sm">
                  You are on <strong>Floor {currentFloor}</strong> - {
                    BUILDING_FLOORS.find(f => f.floor === currentFloor)?.name
                  }
                </span>
              </div>
            </div>

            {/* Wing Filter */}
            <div className="px-4 py-3 border-b border-slate-700 flex gap-2 overflow-x-auto">
              <button
                onClick={() => setFilterWing('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  filterWing === 'all'
                    ? 'bg-white text-slate-900'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                All Floors
              </button>
              {(Object.keys(WINGS) as Array<keyof typeof WINGS>).map(wingKey => {
                const wing = WINGS[wingKey]
                const WingIcon = wingIcons[wingKey]
                return (
                  <button
                    key={wingKey}
                    onClick={() => setFilterWing(wingKey)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      filterWing === wingKey
                        ? `bg-gradient-to-r ${wing.color} text-white`
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <WingIcon className="h-3.5 w-3.5" />
                    {wing.name}
                  </button>
                )
              })}
            </div>

            {/* Floor List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <div className="space-y-2">
                {filteredFloors.map((floor) => {
                  const isCurrentFloor = floor.floor === currentFloor
                  const activity = getFloorActivity(floor.floor)
                  const FloorIcon = floor.icon
                  const WingIcon = wingIcons[floor.wing as keyof typeof wingIcons]

                  return (
                    <motion.button
                      key={floor.floor}
                      onClick={() => handleFloorClick(floor)}
                      onMouseEnter={() => setHoveredFloor(floor.floor)}
                      onMouseLeave={() => setHoveredFloor(null)}
                      className={`
                        w-full relative group transition-all duration-200
                        ${isCurrentFloor ? 'scale-[1.02]' : 'hover:scale-[1.01]'}
                      `}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className={`
                        relative overflow-hidden rounded-xl p-3 flex items-center gap-3
                        ${isCurrentFloor
                          ? `bg-gradient-to-r ${floor.color} shadow-lg`
                          : 'bg-slate-800 hover:bg-slate-750'
                        }
                      `}>
                        {/* Floor Number */}
                        <div className={`
                          w-12 h-12 rounded-lg flex flex-col items-center justify-center font-mono
                          ${isCurrentFloor ? 'bg-white/20' : 'bg-slate-700'}
                        `}>
                          <span className={`text-xs ${isCurrentFloor ? 'text-white/70' : 'text-slate-500'}`}>
                            F
                          </span>
                          <span className={`text-lg font-bold ${isCurrentFloor ? 'text-white' : 'text-slate-300'}`}>
                            {floor.floor}
                          </span>
                        </div>

                        {/* Floor Info */}
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <FloorIcon className={`h-4 w-4 ${isCurrentFloor ? 'text-white' : 'text-slate-400'}`} />
                            <span className={`font-semibold ${isCurrentFloor ? 'text-white' : 'text-slate-200'}`}>
                              {floor.name}
                            </span>
                            <WingIcon className={`h-3 w-3 ${wingColors[floor.wing as keyof typeof wingColors]}`} />
                          </div>
                          <p className={`text-sm ${isCurrentFloor ? 'text-white/70' : 'text-slate-500'}`}>
                            {floor.description}
                          </p>
                          {hoveredFloor === floor.floor && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="text-xs text-slate-400 mt-1 italic"
                            >
                              {floor.vibe}
                            </motion.p>
                          )}
                        </div>

                        {/* Activity & Badge */}
                        <div className="flex items-center gap-3">
                          {showActivity && (
                            <div className="flex items-center gap-1.5">
                              <Activity className={`h-3.5 w-3.5 ${
                                activity.status === 'busy' ? 'text-red-400' :
                                activity.status === 'moderate' ? 'text-yellow-400' :
                                'text-green-400'
                              }`} />
                              <Users className="h-3.5 w-3.5 text-slate-500" />
                              <span className="text-xs text-slate-400">{activity.users}</span>
                            </div>
                          )}

                          <span className={`
                            text-[10px] font-bold px-2 py-1 rounded
                            ${isCurrentFloor
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-700 text-slate-400'
                            }
                          `}>
                            {floor.badge}
                          </span>

                          <ChevronRight className={`h-4 w-4 ${isCurrentFloor ? 'text-white' : 'text-slate-500'}`} />
                        </div>

                        {/* Current floor indicator */}
                        {isCurrentFloor && (
                          <motion.div
                            className="absolute left-0 top-0 bottom-0 w-1 bg-green-400"
                            layoutId="currentFloorIndicator"
                          />
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Footer with quick stats */}
            <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>{BUILDING_FLOORS.length} Floors • 3 Wings</span>
                <span className="flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" />
                  {BUILDING_FLOORS.reduce((sum, f) => sum + getFloorActivity(f.floor).users, 0)} active users
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default FloorDirectory
