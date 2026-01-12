'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  MapPin,
  Play,
  Pause,
  SkipForward,
  Home
} from 'lucide-react'
import { BUILDING_FLOORS, WINGS } from './BuildingNavigation'

const STORAGE_KEY = 'anchor-tour-state'

// Aria - Pioneer Bot #4, Agent Liaison
const ARIA = {
  name: 'Aria',
  title: 'Agent Liaison',
  emoji: '🎭',
  avatar: '/avatars/aria.png', // Optional avatar image
  personality: 'warm, helpful, slightly theatrical'
}

// Tour stops with Aria's commentary
interface TourStop {
  floor: number
  path: string
  title: string
  ariaMessage: string
  highlights: string[]
  actionHint?: string
  duration?: number // seconds to auto-advance
}

const FULL_TOUR: TourStop[] = [
  {
    floor: 1,
    path: '/dashboard',
    title: 'Welcome to The Anchor!',
    ariaMessage: "Hello, and welcome! I'm Aria, your guide through The Anchor - the world's first AI Governance Headquarters. Think of this building as your home base for everything AI agents. Let me show you around!",
    highlights: ['Your personalized dashboard', 'Quick stats and notifications', 'Recent activity feed'],
    actionHint: 'This is your main hub - you can always return here.',
    duration: 8
  },
  {
    floor: 2,
    path: '/compliance',
    title: 'The Compliance Vault',
    ariaMessage: "Down here in the Compliance Vault, we take security seriously. SOC 2, HIPAA, ISO 27001 - all the frameworks that keep your data safe and your operations compliant. It's not the most glamorous floor, but it's the foundation of trust.",
    highlights: ['Audit trail logs', 'Compliance dashboards', 'Security controls'],
    actionHint: 'Check your compliance status anytime.',
    duration: 7
  },
  {
    floor: 3,
    path: '/agents',
    title: 'The Workshop',
    ariaMessage: "Now THIS is where the magic happens! The Workshop is where you build and configure your agents. Think of it as a maker space - tools on the walls, agents under construction, endless possibilities.",
    highlights: ['Agent builder', 'Configuration templates', 'Testing sandbox'],
    actionHint: 'Create your first agent here!',
    duration: 7
  },
  {
    floor: 4,
    path: '/marketplace',
    title: 'The Marketplace',
    ariaMessage: "Welcome to the bustling Marketplace! Here you'll find agents built by trainers from around the world - each one verified, rated, and ready to help. Browse by category, check trust scores, find the perfect agent for your needs.",
    highlights: ['Curated agent catalog', 'Trust scores & reviews', 'Acquisition options'],
    actionHint: 'Discover agents you can anchor to.',
    duration: 8
  },
  {
    floor: 5,
    path: '/trust',
    title: 'The Trust Vault',
    ariaMessage: "This floor is like a bank vault for reputation. Every credential, every trust score, every badge earned - it's all stored here. Transparent, verifiable, and tamper-proof. Trust isn't given, it's earned and recorded.",
    highlights: ['Trust score breakdown', 'Credential verification', 'Badge collection'],
    duration: 6
  },
  {
    floor: 6,
    path: '/academy',
    title: 'The Academy',
    ariaMessage: "Welcome to the Academy! This is where agents learn and grow. Training courses, certification programs, specialization tracks - think of it as a university for AI. The more they learn, the more they can be trusted.",
    highlights: ['Training curricula', 'Certification programs', 'Mentorship matching'],
    actionHint: 'Enroll your agents in training.',
    duration: 7
  },
  {
    floor: 7,
    path: '/observer',
    title: 'The Observer Deck',
    ariaMessage: "From up here, you can see everything. The Observer Deck provides real-time monitoring of all agent activities. Every decision, every interaction - logged, hashed, and verifiable. Transparency is our watchword.",
    highlights: ['Real-time activity feed', 'Decision audit logs', 'Truth chain verification'],
    duration: 6
  },
  {
    floor: 8,
    path: '/shadow-training',
    title: 'The Arena',
    ariaMessage: "Step into the Arena! This is where agents compete head-to-head in shadow training. A/B testing, performance comparisons, the ultimate proving ground. May the best agent win!",
    highlights: ['A/B test setup', 'Performance metrics', 'Side-by-side comparison'],
    actionHint: 'Test agent performance here.',
    duration: 6
  },
  {
    floor: 9,
    path: '/tribunal',
    title: 'The Tribunal',
    ariaMessage: "The Tribunal handles the serious matters - appeals, disputes, edge cases. When decisions are challenged, this is where justice is served. Fair, thorough, and transparent.",
    highlights: ['Case submissions', 'Appeal tracking', 'Resolution history'],
    duration: 5
  },
  {
    floor: 10,
    path: '/council',
    title: 'The Council Chambers',
    ariaMessage: "We've reached the top floor - the Council Chambers. This is where the Nine sit - validators who guide the platform's governance. Weighty decisions are made here, with humanity's interests always first.",
    highlights: ['Governance proposals', 'Voting records', 'Policy updates'],
    duration: 6
  }
]

// Quick tour - just the essentials
const QUICK_TOUR: TourStop[] = [
  FULL_TOUR[0], // Lobby
  FULL_TOUR[3], // Marketplace
  FULL_TOUR[2], // Workshop
  FULL_TOUR[5], // Academy
]

interface GuidedTourProps {
  tourType?: 'full' | 'quick'
  onComplete?: () => void
  autoStart?: boolean
}

interface TourState {
  hasSeenTour: boolean
  completedAt?: number
  stopsVisited: number[]
}

function loadTourState(): TourState {
  if (typeof window === 'undefined') return { hasSeenTour: false, stopsVisited: [] }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : { hasSeenTour: false, stopsVisited: [] }
  } catch {
    return { hasSeenTour: false, stopsVisited: [] }
  }
}

function saveTourState(state: TourState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export function GuidedTour({
  tourType = 'full',
  onComplete,
  autoStart = false
}: GuidedTourProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isActive, setIsActive] = useState(autoStart)
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isTyping, setIsTyping] = useState(true)
  const [displayedMessage, setDisplayedMessage] = useState('')

  const tour = tourType === 'quick' ? QUICK_TOUR : FULL_TOUR
  const currentStop = tour[currentStopIndex]
  const progress = ((currentStopIndex + 1) / tour.length) * 100

  // Typing effect for Aria's messages
  useEffect(() => {
    if (!isActive || !currentStop) return

    setIsTyping(true)
    setDisplayedMessage('')

    let i = 0
    const message = currentStop.ariaMessage
    const interval = setInterval(() => {
      if (i < message.length) {
        setDisplayedMessage(message.slice(0, i + 1))
        i++
      } else {
        setIsTyping(false)
        clearInterval(interval)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [isActive, currentStopIndex, currentStop])

  // Navigate to current stop
  useEffect(() => {
    if (isActive && currentStop && pathname !== currentStop.path) {
      router.push(currentStop.path)
    }
  }, [isActive, currentStop, pathname, router])

  // Auto-advance timer
  useEffect(() => {
    if (!isActive || isPaused || isTyping || !currentStop?.duration) return

    const timer = setTimeout(() => {
      if (currentStopIndex < tour.length - 1) {
        goNext()
      }
    }, currentStop.duration * 1000)

    return () => clearTimeout(timer)
  }, [isActive, isPaused, isTyping, currentStopIndex, currentStop, tour.length])

  const completeTour = useCallback(() => {
    setIsActive(false)
    saveTourState({
      hasSeenTour: true,
      completedAt: Date.now(),
      stopsVisited: tour.map(s => s.floor)
    })
    onComplete?.()
  }, [tour, onComplete])

  const goNext = useCallback(() => {
    if (currentStopIndex < tour.length - 1) {
      setCurrentStopIndex(prev => Math.min(prev + 1, tour.length - 1))
    } else {
      completeTour()
    }
  }, [currentStopIndex, tour.length, completeTour])

  const goPrev = useCallback(() => {
    if (currentStopIndex > 0) {
      setCurrentStopIndex(prev => prev - 1)
    }
  }, [currentStopIndex])

  const startTour = useCallback(() => {
    setCurrentStopIndex(0)
    setIsActive(true)
  }, [])

  if (!isActive || !currentStop) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
      >
        <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-purple-500/30 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-slate-800">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              {/* Aria avatar */}
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl">
                  {ARIA.emoji}
                </div>
                {isTyping && (
                  <motion.div
                    className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )}
              </div>

              {/* Title & floor */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-medium">{ARIA.name}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 text-sm">{ARIA.title}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span className="text-white font-semibold">{currentStop.title}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">
                    F{currentStop.floor}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="p-1.5 hover:bg-slate-800 rounded transition-colors"
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Pause className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                <button
                  onClick={completeTour}
                  className="p-1.5 hover:bg-slate-800 rounded transition-colors"
                  title="End tour"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Message */}
            <div className="min-h-[4rem] mb-3">
              <p className="text-slate-300 text-sm leading-relaxed">
                {displayedMessage}
                {isTyping && (
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-purple-400"
                  >
                    |
                  </motion.span>
                )}
              </p>
            </div>

            {/* Highlights */}
            {!isTyping && currentStop.highlights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 mb-3"
              >
                {currentStop.highlights.map((highlight, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs text-purple-300"
                  >
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    {highlight}
                  </span>
                ))}
              </motion.div>
            )}

            {/* Action hint */}
            {!isTyping && currentStop.actionHint && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-slate-500 italic mb-3"
              >
                💡 {currentStop.actionHint}
              </motion.p>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              {/* Stop counter */}
              <span className="text-xs text-slate-500">
                Stop {currentStopIndex + 1} of {tour.length}
              </span>

              {/* Nav buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={currentStopIndex === 0}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors
                    ${currentStopIndex === 0
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>

                {currentStopIndex === tour.length - 1 ? (
                  <button
                    onClick={completeTour}
                    className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-sm text-white font-medium hover:from-purple-500 hover:to-pink-500 transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Finish Tour
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-sm text-white font-medium hover:from-purple-500 hover:to-pink-500 transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => {
                    goNext()
                    goNext()
                  }}
                  disabled={currentStopIndex >= tour.length - 2}
                  className={`
                    p-1.5 rounded transition-colors
                    ${currentStopIndex >= tour.length - 2
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:bg-slate-800'
                    }
                  `}
                  title="Skip"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Button to start a guided tour
 */
export function TourStartButton({
  tourType = 'full',
  variant = 'default'
}: {
  tourType?: 'full' | 'quick'
  variant?: 'default' | 'compact' | 'icon'
}) {
  const [showTour, setShowTour] = useState(false)
  const tourState = loadTourState()

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setShowTour(true)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors group"
          title="Take a tour"
        >
          <MapPin className="w-5 h-5 text-slate-400 group-hover:text-purple-400" />
        </button>
        {showTour && (
          <GuidedTour
            tourType={tourType}
            onComplete={() => setShowTour(false)}
            autoStart
          />
        )}
      </>
    )
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={() => setShowTour(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-sm text-purple-400 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          Tour
        </button>
        {showTour && (
          <GuidedTour
            tourType={tourType}
            onComplete={() => setShowTour(false)}
            autoStart
          />
        )}
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowTour(true)}
        className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-medium transition-colors shadow-lg shadow-purple-500/20"
      >
        <MapPin className="w-5 h-5" />
        <div className="text-left">
          <div className="text-sm font-semibold">
            {tourType === 'quick' ? 'Quick Tour' : 'Take the Tour'}
          </div>
          <div className="text-xs opacity-70">
            {tourState.hasSeenTour ? 'Take it again' : 'First time? Let Aria guide you'}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 opacity-70" />
      </button>
      {showTour && (
        <GuidedTour
          tourType={tourType}
          onComplete={() => setShowTour(false)}
          autoStart
        />
      )}
    </>
  )
}

/**
 * Check if user has completed the tour
 */
export function hasCompletedTour(): boolean {
  return loadTourState().hasSeenTour
}

/**
 * Reset tour state (for testing)
 */
export function resetTourState(): void {
  saveTourState({ hasSeenTour: false, stopsVisited: [] })
}
