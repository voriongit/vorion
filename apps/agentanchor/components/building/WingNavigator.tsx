'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  User,
  Bot,
  GraduationCap,
  DollarSign,
  Settings,
  Store,
  Heart,
  CreditCard,
  Compass
} from 'lucide-react'

// Wing configuration with detailed routes
const TRAINER_WING = {
  id: 'trainer',
  name: 'Trainer Wing',
  tagline: 'Build. Train. Earn.',
  icon: Briefcase,
  color: 'from-blue-600 to-indigo-700',
  bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  borderColor: 'border-blue-300 dark:border-blue-700',
  routes: [
    { path: '/agents', name: 'My Agents', icon: Bot, description: 'Manage your agents' },
    { path: '/agents/new', name: 'Agent Builder', icon: Briefcase, description: 'Create new agent' },
    { path: '/academy', name: 'Academy', icon: GraduationCap, description: 'Train agents' },
    { path: '/shadow-training', name: 'Shadow Training', icon: Compass, description: 'A/B testing' },
    { path: '/earnings', name: 'Earnings', icon: DollarSign, description: 'Revenue dashboard' },
    { path: '/settings', name: 'Settings', icon: Settings, description: 'Account settings' },
  ]
}

const CONSUMER_WING = {
  id: 'consumer',
  name: 'Consumer Wing',
  tagline: 'Discover. Trust. Deploy.',
  icon: User,
  color: 'from-green-600 to-emerald-700',
  bgColor: 'bg-green-50 dark:bg-green-900/20',
  borderColor: 'border-green-300 dark:border-green-700',
  routes: [
    { path: '/marketplace', name: 'Marketplace', icon: Store, description: 'Browse agents' },
    { path: '/my-agents', name: 'My Collection', icon: Heart, description: 'Acquired agents' },
    { path: '/subscriptions', name: 'Subscriptions', icon: CreditCard, description: 'Active plans' },
    { path: '/settings', name: 'Settings', icon: Settings, description: 'Preferences' },
  ]
}

interface WingNavigatorProps {
  defaultWing?: 'trainer' | 'consumer'
  showRoutes?: boolean
  onWingChange?: (wing: 'trainer' | 'consumer') => void
}

export function WingNavigator({
  defaultWing = 'trainer',
  showRoutes = true,
  onWingChange
}: WingNavigatorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeWing, setActiveWing] = useState<'trainer' | 'consumer'>(defaultWing)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const currentWing = activeWing === 'trainer' ? TRAINER_WING : CONSUMER_WING
  const otherWing = activeWing === 'trainer' ? CONSUMER_WING : TRAINER_WING

  const handleWingSwitch = async () => {
    setIsTransitioning(true)

    // Animate transition
    await new Promise(resolve => setTimeout(resolve, 500))

    const newWing = activeWing === 'trainer' ? 'consumer' : 'trainer'
    setActiveWing(newWing)
    onWingChange?.(newWing)

    setIsTransitioning(false)
  }

  const handleRouteSelect = (path: string) => {
    router.push(path)
  }

  return (
    <div className="relative">
      {/* Wing Selector */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {/* Trainer Wing Button */}
        <motion.button
          onClick={() => activeWing !== 'trainer' && handleWingSwitch()}
          className={`
            relative flex items-center gap-2 px-4 py-3 rounded-xl transition-all
            ${activeWing === 'trainer'
              ? `bg-gradient-to-r ${TRAINER_WING.color} text-white shadow-lg scale-105`
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }
          `}
          whileHover={{ scale: activeWing === 'trainer' ? 1.05 : 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowLeft className="h-4 w-4" />
          <Briefcase className="h-5 w-5" />
          <div className="text-left">
            <div className="font-semibold text-sm">{TRAINER_WING.name}</div>
            <div className="text-xs opacity-70">{TRAINER_WING.tagline}</div>
          </div>
        </motion.button>

        {/* Center Divider */}
        <div className="flex flex-col items-center">
          <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-400 to-transparent" />
          <motion.div
            animate={{ rotate: isTransitioning ? 180 : 0 }}
            className="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-200 flex items-center justify-center"
          >
            <Compass className="h-4 w-4 text-white dark:text-slate-800" />
          </motion.div>
          <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-400 to-transparent" />
        </div>

        {/* Consumer Wing Button */}
        <motion.button
          onClick={() => activeWing !== 'consumer' && handleWingSwitch()}
          className={`
            relative flex items-center gap-2 px-4 py-3 rounded-xl transition-all
            ${activeWing === 'consumer'
              ? `bg-gradient-to-r ${CONSUMER_WING.color} text-white shadow-lg scale-105`
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }
          `}
          whileHover={{ scale: activeWing === 'consumer' ? 1.05 : 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="text-right">
            <div className="font-semibold text-sm">{CONSUMER_WING.name}</div>
            <div className="text-xs opacity-70">{CONSUMER_WING.tagline}</div>
          </div>
          <User className="h-5 w-5" />
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Transition Animation */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.8, rotate: 10 }}
              className="text-center text-white"
            >
              <motion.div
                animate={{ x: activeWing === 'trainer' ? [0, 50] : [0, -50] }}
                className="text-6xl mb-4"
              >
                {activeWing === 'trainer' ? '👉' : '👈'}
              </motion.div>
              <p className="text-xl font-bold">
                Switching to {otherWing.name}
              </p>
              <p className="text-sm opacity-70">{otherWing.tagline}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wing Routes */}
      {showRoutes && (
        <motion.div
          key={activeWing}
          initial={{ opacity: 0, x: activeWing === 'trainer' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`
            p-4 rounded-xl border-2
            ${currentWing.bgColor} ${currentWing.borderColor}
          `}
        >
          {/* Wing Header */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-current/10">
            <div className={`p-2 rounded-lg bg-gradient-to-r ${currentWing.color}`}>
              <currentWing.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                {currentWing.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentWing.tagline}
              </p>
            </div>
          </div>

          {/* Route Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {currentWing.routes.map((route) => {
              const isActive = pathname === route.path || pathname.startsWith(route.path + '/')
              const RouteIcon = route.icon

              return (
                <motion.button
                  key={route.path}
                  onClick={() => handleRouteSelect(route.path)}
                  className={`
                    relative flex items-center gap-2 p-3 rounded-lg text-left transition-all
                    ${isActive
                      ? `bg-gradient-to-r ${currentWing.color} text-white shadow-md`
                      : 'bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'
                    }
                  `}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <RouteIcon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <div>
                    <div className="font-medium text-sm">{route.name}</div>
                    <div className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-500'}`}>
                      {route.description}
                    </div>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeRoute"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white"
                    />
                  )}
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default WingNavigator
