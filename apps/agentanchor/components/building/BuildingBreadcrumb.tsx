'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2,
  ChevronRight,
  Home,
  MapPin
} from 'lucide-react'
import { BUILDING_FLOORS } from './BuildingNavigation'

interface BuildingBreadcrumbProps {
  className?: string
  showFloorNumber?: boolean
  showIcon?: boolean
  variant?: 'default' | 'minimal' | 'full'
}

// Map paths to friendly names
const pathNames: Record<string, string> = {
  'agents': 'My Agents',
  'new': 'New Agent',
  'edit': 'Edit',
  'marketplace': 'Marketplace',
  'academy': 'Academy',
  'shadow-training': 'Arena',
  'observer': 'Observer Deck',
  'trust': 'Trust Vault',
  'council': 'Council',
  'tribunal': 'Tribunal',
  'compliance': 'Compliance',
  'dashboard': 'Lobby',
  'settings': 'Settings',
  'earnings': 'Earnings',
  'my-agents': 'My Collection',
  'subscriptions': 'Subscriptions',
}

export function BuildingBreadcrumb({
  className = '',
  showFloorNumber = true,
  showIcon = true,
  variant = 'default'
}: BuildingBreadcrumbProps) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  // Find current floor based on first segment
  const currentFloor = BUILDING_FLOORS.find(f =>
    pathname.startsWith(f.path)
  )

  const FloorIcon = currentFloor?.icon || Building2

  // Build breadcrumb items
  const breadcrumbItems = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    const name = pathNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    const isLast = index === segments.length - 1

    return { path, name, isLast, segment }
  })

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        {showIcon && currentFloor && (
          <FloorIcon className="h-4 w-4 text-slate-400" />
        )}
        <span className="text-slate-300 font-medium">
          {currentFloor?.name || 'Unknown Floor'}
        </span>
        {showFloorNumber && currentFloor && (
          <span className="text-slate-500 text-xs">
            F{currentFloor.floor}
          </span>
        )}
      </div>
    )
  }

  return (
    <nav
      className={`flex items-center text-sm ${className}`}
      aria-label="Building navigation"
    >
      {/* Lobby/Home */}
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
      >
        <Home className="h-4 w-4" />
        {variant === 'full' && <span>Lobby</span>}
      </Link>

      {/* Current floor indicator */}
      {currentFloor && currentFloor.path !== '/dashboard' && (
        <>
          <ChevronRight className="h-4 w-4 text-slate-600 mx-2" />
          <Link
            href={currentFloor.path}
            className={`flex items-center gap-1.5 transition-colors ${
              breadcrumbItems.length <= 1
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {showIcon && <FloorIcon className="h-4 w-4" />}
            <span>{currentFloor.name}</span>
            {showFloorNumber && (
              <span className={`
                text-xs px-1.5 py-0.5 rounded
                bg-gradient-to-r ${currentFloor.color} text-white
              `}>
                F{currentFloor.floor}
              </span>
            )}
          </Link>
        </>
      )}

      {/* Additional path segments */}
      {breadcrumbItems.slice(1).map((item, index) => (
        <motion.div
          key={item.path}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center"
        >
          <ChevronRight className="h-4 w-4 text-slate-600 mx-2" />
          {item.isLast ? (
            <span className="text-white font-medium flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-green-400" />
              {item.name}
            </span>
          ) : (
            <Link
              href={item.path}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {item.name}
            </Link>
          )}
        </motion.div>
      ))}
    </nav>
  )
}

// Compact version for headers
export function FloorIndicator({
  className = '',
  onClick
}: {
  className?: string
  onClick?: () => void
}) {
  const pathname = usePathname()
  const currentFloor = BUILDING_FLOORS.find(f =>
    pathname.startsWith(f.path)
  )

  if (!currentFloor) return null

  const FloorIcon = currentFloor.icon

  return (
    <motion.button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg
        bg-gradient-to-r ${currentFloor.color}
        text-white text-sm font-medium
        hover:shadow-lg transition-shadow
        ${className}
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <FloorIcon className="h-4 w-4" />
      <span>{currentFloor.name}</span>
      <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
        F{currentFloor.floor}
      </span>
    </motion.button>
  )
}

export default BuildingBreadcrumb
