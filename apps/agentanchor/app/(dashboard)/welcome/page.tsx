'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Shield,
  Star,
  Zap
} from 'lucide-react'
import { BuildingNavigation, BUILDING_FLOORS, WingNavigator, ComicBurst, Signage } from '@/components/building'

type Stage = 'approach' | 'doors' | 'lobby' | 'elevator' | 'floor-select'

export default function WelcomePage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('approach')
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)

  // Auto-advance through initial stages
  useEffect(() => {
    if (stage === 'approach') {
      const timer = setTimeout(() => setStage('doors'), 2000)
      return () => clearTimeout(timer)
    }
    if (stage === 'doors') {
      const timer = setTimeout(() => setStage('lobby'), 1500)
      return () => clearTimeout(timer)
    }
  }, [stage])

  const handleFloorSelect = (floor: number) => {
    setSelectedFloor(floor)
    const floorConfig = BUILDING_FLOORS.find(f => f.floor === floor)
    if (floorConfig) {
      // Animate to floor then navigate
      setTimeout(() => {
        router.push(floorConfig.path)
      }, 1000)
    }
  }

  const skipToLobby = () => {
    setStage('lobby')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      <AnimatePresence mode="wait">
        {/* Stage 1: Approaching the building */}
        {stage === 'approach' && (
          <motion.div
            key="approach"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="fixed inset-0 flex items-center justify-center"
            onClick={skipToLobby}
          >
            {/* Night sky */}
            <div className="absolute inset-0">
              {[...Array(50)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-white rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 60}%`,
                  }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 2 }}
                />
              ))}
            </div>

            {/* Building silhouette */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1 }}
              className="relative"
            >
              {/* Building */}
              <div className="w-64 h-96 bg-gradient-to-b from-slate-700 to-slate-800 rounded-t-lg relative overflow-hidden">
                {/* Windows */}
                <div className="grid grid-cols-4 gap-2 p-4">
                  {[...Array(32)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-full h-6 bg-yellow-500/70 rounded-sm"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 2 }}
                    />
                  ))}
                </div>

                {/* Sign */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2"
                >
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg">
                    <span className="text-white font-bold text-sm tracking-wider">
                      AGENT ANCHOR
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Ground */}
              <div className="h-8 bg-slate-600 rounded-b-lg" />
            </motion.div>

            {/* Comic text */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 1, type: 'spring' }}
              className="absolute bottom-20"
            >
              <ComicBurst text="Welcome to Agent Anchor Tower!" color="purple" size="lg" />
            </motion.div>

            {/* Skip hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="absolute bottom-8 text-slate-400 text-sm"
            >
              Click anywhere to skip
            </motion.p>
          </motion.div>
        )}

        {/* Stage 2: Doors opening */}
        {stage === 'doors' && (
          <motion.div
            key="doors"
            className="fixed inset-0 flex items-center justify-center bg-slate-900"
            onClick={skipToLobby}
          >
            <div className="relative w-80 h-[500px]">
              {/* Door frame */}
              <div className="absolute inset-0 border-8 border-slate-600 rounded-lg bg-amber-100" />

              {/* Left door */}
              <motion.div
                initial={{ x: 0 }}
                animate={{ x: -160 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="absolute left-2 top-2 bottom-2 w-[calc(50%-8px)] bg-gradient-to-r from-amber-800 to-amber-700 rounded-l-lg"
              >
                {/* Door handle */}
                <div className="absolute right-4 top-1/2 w-3 h-8 bg-yellow-500 rounded-full" />
              </motion.div>

              {/* Right door */}
              <motion.div
                initial={{ x: 0 }}
                animate={{ x: 160 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="absolute right-2 top-2 bottom-2 w-[calc(50%-8px)] bg-gradient-to-l from-amber-800 to-amber-700 rounded-r-lg"
              >
                {/* Door handle */}
                <div className="absolute left-4 top-1/2 w-3 h-8 bg-yellow-500 rounded-full" />
              </motion.div>

              {/* "WELCOME" mat */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-8 py-2 bg-red-800 rounded text-white font-bold"
              >
                WELCOME
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Stage 3: Lobby */}
        {stage === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 flex flex-col items-center justify-center p-8"
          >
            {/* Lobby background */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-50 to-amber-100 dark:from-slate-800 dark:to-slate-900" />

            {/* Floor pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 1px, transparent 20px)',
              }} />
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-4xl w-full">
              {/* Lobby sign */}
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-8"
              >
                <Signage
                  variant="floor"
                  title="MAIN LOBBY"
                  subtitle="Floor 1 • Agent Anchor Tower"
                  floorNumber={1}
                  size="lg"
                />
              </motion.div>

              {/* Welcome message */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-8"
              >
                <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-2">
                  Welcome, Agent
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg">
                  Where will your journey take you today?
                </p>
              </motion.div>

              {/* Quick actions */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
              >
                <QuickActionCard
                  icon={Shield}
                  title="Dashboard"
                  description="Your command center"
                  onClick={() => router.push('/dashboard')}
                  color="purple"
                />
                <QuickActionCard
                  icon={Building2}
                  title="Elevator"
                  description="Navigate floors"
                  onClick={() => setStage('floor-select')}
                  color="blue"
                  highlight
                />
                <QuickActionCard
                  icon={Sparkles}
                  title="Arena"
                  description="Shadow training"
                  onClick={() => router.push('/shadow-training')}
                  color="orange"
                />
              </motion.div>

              {/* Wing selector */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <WingNavigator showRoutes={false} />
              </motion.div>
            </div>

            {/* Decorative elements */}
            <motion.div
              className="absolute bottom-4 left-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <Signage
                variant="info"
                title="INFO"
                subtitle="Tap elevator to select floor"
                direction="up"
                size="sm"
              />
            </motion.div>
          </motion.div>
        )}

        {/* Stage 4: Floor selection */}
        {stage === 'floor-select' && (
          <motion.div
            key="floor-select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 flex items-center justify-center p-8 bg-slate-900"
          >
            <div className="flex gap-8 items-start">
              {/* Elevator panel */}
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <div className="bg-slate-800 rounded-xl p-6 border-2 border-slate-600">
                  <h2 className="text-white font-bold text-lg mb-4 text-center">
                    Select Your Destination
                  </h2>

                  <BuildingNavigation
                    onFloorSelect={handleFloorSelect}
                    showElevator={true}
                  />

                  <button
                    onClick={() => setStage('lobby')}
                    className="mt-4 w-full py-2 text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    ← Back to Lobby
                  </button>
                </div>
              </motion.div>

              {/* Floor preview */}
              <motion.div
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="hidden lg:block w-80"
              >
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-white font-semibold mb-4">Floor Guide</h3>

                  <div className="space-y-3 text-sm">
                    <FloorGuideItem floor={9} name="Council" desc="Governance decisions" color="purple" />
                    <FloorGuideItem floor={7} name="Arena" desc="A/B testing" color="orange" />
                    <FloorGuideItem floor={5} name="Academy" desc="Agent training" color="green" />
                    <FloorGuideItem floor={3} name="Marketplace" desc="Agent commerce" color="pink" />
                    <FloorGuideItem floor={1} name="Lobby" desc="Dashboard" color="slate" />
                  </div>

                  <div className="mt-6 p-3 bg-purple-900/30 rounded-lg border border-purple-700">
                    <div className="flex items-center gap-2 text-purple-300">
                      <Star className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        PRO TIP: Use keyboard numbers 1-9 for quick navigation
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Selected floor animation */}
            <AnimatePresence>
              {selectedFloor !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
                >
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{ y: [0, -20, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="text-8xl mb-4"
                    >
                      🛗
                    </motion.div>
                    <p className="text-white text-2xl font-bold">
                      Going to Floor {selectedFloor}
                    </p>
                    <p className="text-white/70">
                      {BUILDING_FLOORS.find(f => f.floor === selectedFloor)?.name}
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Quick action card component
function QuickActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  color,
  highlight = false
}: {
  icon: any
  title: string
  description: string
  onClick: () => void
  color: string
  highlight?: boolean
}) {
  const colors: Record<string, string> = {
    purple: 'from-purple-600 to-indigo-700',
    blue: 'from-blue-600 to-cyan-700',
    orange: 'from-orange-500 to-amber-600',
    green: 'from-green-500 to-emerald-600'
  }

  return (
    <motion.button
      onClick={onClick}
      className={`
        relative p-4 rounded-xl text-left
        ${highlight
          ? `bg-gradient-to-br ${colors[color]} text-white shadow-lg`
          : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
        }
        border-2 ${highlight ? 'border-white/20' : 'border-slate-200 dark:border-slate-700'}
        transition-all group
      `}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon className={`h-6 w-6 mb-2 ${highlight ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`} />
      <div className={`font-semibold ${highlight ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
        {title}
      </div>
      <div className={`text-sm ${highlight ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
        {description}
      </div>

      {highlight && (
        <motion.div
          className="absolute top-2 right-2"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Zap className="h-4 w-4 text-yellow-300" />
        </motion.div>
      )}

      <ArrowRight className={`
        absolute bottom-4 right-4 h-4 w-4
        ${highlight ? 'text-white/50' : 'text-slate-300 dark:text-slate-600'}
        group-hover:translate-x-1 transition-transform
      `} />
    </motion.button>
  )
}

// Floor guide item
function FloorGuideItem({
  floor,
  name,
  desc,
  color
}: {
  floor: number
  name: string
  desc: string
  color: string
}) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    pink: 'bg-pink-500',
    slate: 'bg-slate-500'
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold ${colors[color]}`}>
        {floor}
      </div>
      <div>
        <div className="text-white font-medium">{name}</div>
        <div className="text-slate-400 text-xs">{desc}</div>
      </div>
    </div>
  )
}
