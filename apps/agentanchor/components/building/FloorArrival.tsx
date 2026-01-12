'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown, Gavel, Sparkles, Eye, GraduationCap,
  Shield, Store, Wrench, Building2, Users,
  BookOpen, Scale, Zap, FileSearch, Award,
  ShoppingBag, Hammer, DoorOpen
} from 'lucide-react'

// Floor-specific theming and arrival animations
const FLOOR_THEMES = {
  10: {
    name: 'Council Chambers',
    icon: Crown,
    bgGradient: 'from-purple-900 via-purple-800 to-indigo-900',
    accentColor: 'purple',
    doorStyle: 'ornate',
    ambientElements: ['marble pillars', 'council seal', 'golden trim'],
    arrivalMessage: 'Entering the Council Chambers...',
    subtitle: 'Where governance decisions shape the future',
    particles: 'gold-dust'
  },
  9: {
    name: 'Tribunal',
    icon: Gavel,
    bgGradient: 'from-red-900 via-rose-800 to-red-900',
    accentColor: 'red',
    doorStyle: 'judicial',
    ambientElements: ['scales of justice', 'judicial bench', 'case files'],
    arrivalMessage: 'Approaching the Tribunal...',
    subtitle: 'Justice through fair deliberation',
    particles: 'paper-flutter'
  },
  8: {
    name: 'Arena',
    icon: Sparkles,
    bgGradient: 'from-orange-900 via-amber-800 to-yellow-900',
    accentColor: 'orange',
    doorStyle: 'arena-gates',
    ambientElements: ['sparring mats', 'scoreboards', 'training dummies'],
    arrivalMessage: 'Welcome to the Arena!',
    subtitle: 'Where agents prove their worth',
    particles: 'sparks'
  },
  7: {
    name: 'Observer Deck',
    icon: Eye,
    bgGradient: 'from-cyan-900 via-blue-800 to-cyan-900',
    accentColor: 'cyan',
    doorStyle: 'glass',
    ambientElements: ['panoramic windows', 'monitoring screens', 'audit trails'],
    arrivalMessage: 'Entering Observer Deck...',
    subtitle: 'Transparency through vigilance',
    particles: 'scan-lines'
  },
  6: {
    name: 'Academy',
    icon: GraduationCap,
    bgGradient: 'from-green-900 via-emerald-800 to-teal-900',
    accentColor: 'green',
    doorStyle: 'academic',
    ambientElements: ['bookshelves', 'graduation caps', 'certificates'],
    arrivalMessage: 'Welcome to the Academy',
    subtitle: 'Knowledge builds trust',
    particles: 'page-turn'
  },
  5: {
    name: 'Trust Vault',
    icon: Shield,
    bgGradient: 'from-blue-900 via-indigo-800 to-blue-900',
    accentColor: 'blue',
    doorStyle: 'vault',
    ambientElements: ['safety deposit boxes', 'credential displays', 'trust meters'],
    arrivalMessage: 'Accessing Trust Vault...',
    subtitle: 'Where credentials are earned and stored',
    particles: 'shield-shimmer'
  },
  4: {
    name: 'Marketplace',
    icon: Store,
    bgGradient: 'from-pink-900 via-rose-800 to-pink-900',
    accentColor: 'pink',
    doorStyle: 'bazaar',
    ambientElements: ['agent storefronts', 'price tickers', 'busy crowds'],
    arrivalMessage: 'Welcome to the Marketplace!',
    subtitle: 'Discover agents you can anchor to',
    particles: 'confetti'
  },
  3: {
    name: 'Workshop',
    icon: Wrench,
    bgGradient: 'from-yellow-900 via-orange-800 to-amber-900',
    accentColor: 'yellow',
    doorStyle: 'industrial',
    ambientElements: ['workbenches', 'tools', 'agents under construction'],
    arrivalMessage: 'Entering the Workshop...',
    subtitle: 'Build something amazing',
    particles: 'welding-sparks'
  },
  2: {
    name: 'Compliance Vault',
    icon: Shield,
    bgGradient: 'from-slate-900 via-zinc-800 to-slate-900',
    accentColor: 'slate',
    doorStyle: 'secure',
    ambientElements: ['filing cabinets', 'audit logs', 'compliance badges'],
    arrivalMessage: 'Accessing Compliance Vault...',
    subtitle: 'Security. Privacy. Trust.',
    particles: 'lock-click'
  },
  1: {
    name: 'Lobby',
    icon: Building2,
    bgGradient: 'from-gray-800 via-slate-700 to-gray-800',
    accentColor: 'gray',
    doorStyle: 'grand',
    ambientElements: ['concierge desk', 'directory board', 'welcome mat'],
    arrivalMessage: 'Welcome to The Anchor',
    subtitle: 'Your AI Governance Headquarters',
    particles: 'gentle-glow'
  }
} as const

interface FloorArrivalProps {
  floor: number
  isVisible: boolean
  onComplete: () => void
  showFullAnimation?: boolean
}

export function FloorArrival({
  floor,
  isVisible,
  onComplete,
  showFullAnimation = true
}: FloorArrivalProps) {
  const [phase, setPhase] = useState<'doors-closed' | 'doors-opening' | 'reveal' | 'complete'>('doors-closed')
  const theme = FLOOR_THEMES[floor as keyof typeof FLOOR_THEMES] || FLOOR_THEMES[1]
  const Icon = theme.icon

  useEffect(() => {
    if (!isVisible) {
      setPhase('doors-closed')
      return
    }

    const timeline = async () => {
      setPhase('doors-closed')
      await delay(300)
      setPhase('doors-opening')
      await delay(800)
      setPhase('reveal')
      await delay(showFullAnimation ? 1500 : 800)
      setPhase('complete')
      onComplete()
    }

    timeline()
  }, [isVisible, showFullAnimation, onComplete])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-hidden"
      >
        {/* Background */}
        <div className={`absolute inset-0 bg-gradient-to-b ${theme.bgGradient}`} />

        {/* Ambient Particles */}
        <AmbientParticles type={theme.particles} />

        {/* Elevator Doors */}
        <div className="absolute inset-0 flex">
          {/* Left Door */}
          <motion.div
            className="w-1/2 h-full bg-gradient-to-r from-slate-700 to-slate-600 border-r border-slate-500"
            initial={{ x: 0 }}
            animate={{
              x: phase === 'doors-opening' || phase === 'reveal' || phase === 'complete' ? '-100%' : 0
            }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            <DoorPanel side="left" floor={floor} />
          </motion.div>

          {/* Right Door */}
          <motion.div
            className="w-1/2 h-full bg-gradient-to-l from-slate-700 to-slate-600 border-l border-slate-500"
            initial={{ x: 0 }}
            animate={{
              x: phase === 'doors-opening' || phase === 'reveal' || phase === 'complete' ? '100%' : 0
            }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            <DoorPanel side="right" floor={floor} />
          </motion.div>
        </div>

        {/* Floor Content (revealed after doors open) */}
        <AnimatePresence>
          {(phase === 'reveal' || phase === 'complete') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="text-center">
                {/* Floor Icon */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`
                    inline-flex items-center justify-center w-24 h-24 rounded-full mb-6
                    bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-sm
                    border border-white/30
                  `}
                >
                  <Icon className="w-12 h-12 text-white" />
                </motion.div>

                {/* Floor Number */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mb-2"
                >
                  <span className="text-6xl font-mono font-bold text-white/90">
                    F{floor}
                  </span>
                </motion.div>

                {/* Floor Name */}
                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-bold text-white mb-2"
                >
                  {theme.name}
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-white/70 text-lg"
                >
                  {theme.subtitle}
                </motion.p>

                {/* Ambient Elements Preview */}
                {showFullAnimation && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mt-8 flex items-center justify-center gap-4"
                  >
                    {theme.ambientElements.map((element, i) => (
                      <span
                        key={element}
                        className="px-3 py-1 bg-white/10 rounded-full text-white/60 text-sm"
                      >
                        {element}
                      </span>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floor indicator during door animation */}
        {phase === 'doors-closed' && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-center">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-5xl mb-2"
              >
                {floor > 5 ? '🔼' : '🔽'}
              </motion.div>
              <p className="text-white/80 text-lg">{theme.arrivalMessage}</p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

// Door panel with floor-specific styling
function DoorPanel({ side, floor }: { side: 'left' | 'right', floor: number }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {/* Door trim */}
      <div className={`
        w-2 h-full absolute ${side === 'left' ? 'right-0' : 'left-0'} top-0
        bg-gradient-to-b from-slate-500 via-slate-400 to-slate-500
      `} />

      {/* Floor indicator on door */}
      <div className="bg-amber-900/50 border-2 border-amber-600 rounded-lg px-4 py-2">
        <span className="font-mono text-2xl text-amber-400">F{floor}</span>
      </div>
    </div>
  )
}

// Ambient particles based on floor theme
function AmbientParticles({ type }: { type: string }) {
  const [particles, setParticles] = useState<Array<{ id: number, x: number, y: number, delay: number }>>([])

  useEffect(() => {
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2
    }))
    setParticles(newParticles)
  }, [type])

  const getParticleStyle = () => {
    switch (type) {
      case 'gold-dust':
        return 'bg-yellow-400/30 w-1 h-1 rounded-full'
      case 'sparks':
        return 'bg-orange-400/50 w-1 h-2 rounded-full'
      case 'confetti':
        return 'bg-pink-400/40 w-2 h-2 rounded-sm rotate-45'
      case 'scan-lines':
        return 'bg-cyan-400/20 w-full h-px'
      default:
        return 'bg-white/10 w-1 h-1 rounded-full'
    }
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className={`absolute ${getParticleStyle()}`}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            y: [0, -20, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 3,
            delay: p.delay,
            repeat: Infinity,
          }}
        />
      ))}
    </div>
  )
}

// Utility
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export { FLOOR_THEMES }
