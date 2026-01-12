'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Building2,
  ArrowRight,
  HelpCircle,
  Compass,
  Star,
  Store,
  Wrench,
  GraduationCap
} from 'lucide-react'
import { BUILDING_FLOORS, WINGS } from './BuildingNavigation'

interface ConciergeProps {
  userName?: string
  isFirstVisit?: boolean
}

type SuggestionType = {
  id: string
  text: string
  action: () => void
  icon: typeof Building2
  color: string
}

export function Concierge({
  userName = 'Guest',
  isFirstVisit = false
}: ConciergeProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(isFirstVisit)
  const [currentMessage, setCurrentMessage] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(true)

  // Welcome messages
  const welcomeMessages = [
    `Welcome to The Anchor, ${userName}!`,
    "I'm your building concierge. How can I help you today?",
    "Whether you're here to build agents, discover trusted AI, or oversee governance - I'll point you in the right direction."
  ]

  // Quick action suggestions - Floor 4=Marketplace, Floor 3=Workshop, Floor 6=Academy
  const suggestions: SuggestionType[] = [
    {
      id: 'marketplace',
      text: 'Browse the Marketplace',
      action: () => router.push('/marketplace'),
      icon: BUILDING_FLOORS.find(f => f.floor === 4)?.icon ?? Store,
      color: 'from-pink-500 to-rose-600'
    },
    {
      id: 'workshop',
      text: 'Build a new Agent',
      action: () => router.push('/agents/new'),
      icon: BUILDING_FLOORS.find(f => f.floor === 3)?.icon ?? Wrench,
      color: 'from-yellow-500 to-orange-600'
    },
    {
      id: 'academy',
      text: 'Train your Agents',
      action: () => router.push('/academy'),
      icon: BUILDING_FLOORS.find(f => f.floor === 6)?.icon ?? GraduationCap,
      color: 'from-green-500 to-emerald-600'
    },
    {
      id: 'tour',
      text: 'Take a building tour',
      action: () => { /* Would open FloorDirectory */ },
      icon: Compass,
      color: 'from-purple-500 to-indigo-600'
    }
  ]

  // Cycle through welcome messages
  useEffect(() => {
    if (isOpen && currentMessage < welcomeMessages.length - 1) {
      const timer = setTimeout(() => {
        setCurrentMessage(prev => prev + 1)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, currentMessage, welcomeMessages.length])

  return (
    <>
      {/* Concierge Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-4 left-4 z-40
          flex items-center gap-2 px-4 py-3 rounded-full
          bg-gradient-to-r from-purple-600 to-indigo-700
          text-white shadow-lg hover:shadow-xl
          transition-shadow
          ${isOpen ? 'hidden' : ''}
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="font-medium">Concierge</span>
        {isFirstVisit && (
          <motion.span
            className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.button>

      {/* Concierge Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -20, y: 20 }}
            className="fixed bottom-4 left-4 z-50 w-80 max-h-[70vh] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Building Concierge</h3>
                    <p className="text-white/70 text-xs">Here to help you navigate</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="p-4 space-y-3 max-h-48 overflow-y-auto">
              {welcomeMessages.slice(0, currentMessage + 1).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <Building2 className="h-3 w-3 text-white" />
                  </div>
                  <div className="bg-slate-800 rounded-xl rounded-tl-none px-3 py-2 text-sm text-slate-200">
                    {msg}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {currentMessage < welcomeMessages.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-3 w-3 text-white" />
                  </div>
                  <div className="bg-slate-800 rounded-xl rounded-tl-none px-3 py-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-slate-500 rounded-full"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Suggestions */}
            {showSuggestions && currentMessage >= welcomeMessages.length - 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 pb-4"
              >
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  Quick Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {suggestions.map((suggestion) => {
                    const Icon = suggestion.icon
                    return (
                      <motion.button
                        key={suggestion.id}
                        onClick={() => {
                          suggestion.action()
                          setIsOpen(false)
                        }}
                        className={`
                          flex items-center gap-2 p-2 rounded-lg text-left
                          bg-gradient-to-r ${suggestion.color}
                          text-white text-xs font-medium
                          hover:shadow-lg transition-shadow
                        `}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{suggestion.text}</span>
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-slate-500" />
                <span className="text-xs text-slate-500">
                  Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-400">?</kbd> for help anytime
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Concierge
