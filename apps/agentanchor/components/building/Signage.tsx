'use client'

import { motion } from 'framer-motion'
import {
  Building2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  ChevronRight,
  LucideIcon
} from 'lucide-react'

// Signage Types
type SignageVariant = 'floor' | 'direction' | 'warning' | 'info' | 'success' | 'error' | 'comic'

interface SignageProps {
  variant?: SignageVariant
  title: string
  subtitle?: string
  icon?: LucideIcon
  direction?: 'up' | 'down' | 'left' | 'right'
  floorNumber?: number
  animated?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
}

export function Signage({
  variant = 'info',
  title,
  subtitle,
  icon: CustomIcon,
  direction,
  floorNumber,
  animated = true,
  size = 'md',
  className = '',
  onClick
}: SignageProps) {
  // Get variant styles
  const variantStyles = {
    floor: {
      bg: 'bg-gradient-to-r from-slate-700 to-slate-800',
      border: 'border-slate-600',
      text: 'text-white',
      glow: 'shadow-slate-500/50'
    },
    direction: {
      bg: 'bg-gradient-to-r from-blue-600 to-indigo-700',
      border: 'border-blue-500',
      text: 'text-white',
      glow: 'shadow-blue-500/50'
    },
    warning: {
      bg: 'bg-gradient-to-r from-yellow-500 to-orange-600',
      border: 'border-yellow-400',
      text: 'text-white',
      glow: 'shadow-yellow-500/50'
    },
    info: {
      bg: 'bg-gradient-to-r from-cyan-500 to-blue-600',
      border: 'border-cyan-400',
      text: 'text-white',
      glow: 'shadow-cyan-500/50'
    },
    success: {
      bg: 'bg-gradient-to-r from-green-500 to-emerald-600',
      border: 'border-green-400',
      text: 'text-white',
      glow: 'shadow-green-500/50'
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500 to-rose-600',
      border: 'border-red-400',
      text: 'text-white',
      glow: 'shadow-red-500/50'
    },
    comic: {
      bg: 'bg-gradient-to-r from-purple-600 to-pink-600',
      border: 'border-purple-400',
      text: 'text-white',
      glow: 'shadow-purple-500/50'
    }
  }

  const style = variantStyles[variant]

  // Size configuration
  const sizeStyles = {
    sm: {
      padding: 'px-2 py-1',
      text: 'text-xs',
      subtitleText: 'text-[10px]',
      iconSize: 'h-3 w-3',
      floorSize: 'text-sm'
    },
    md: {
      padding: 'px-3 py-2',
      text: 'text-sm',
      subtitleText: 'text-xs',
      iconSize: 'h-4 w-4',
      floorSize: 'text-lg'
    },
    lg: {
      padding: 'px-4 py-3',
      text: 'text-base',
      subtitleText: 'text-sm',
      iconSize: 'h-5 w-5',
      floorSize: 'text-2xl'
    }
  }

  const sizes = sizeStyles[size]

  // Direction arrows
  const directionIcons = {
    up: ArrowUp,
    down: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight
  }

  // Default icons per variant
  const defaultIcons: Record<SignageVariant, LucideIcon> = {
    floor: Building2,
    direction: ChevronRight,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle,
    error: XCircle,
    comic: Building2
  }

  const Icon = CustomIcon || (direction ? directionIcons[direction] : defaultIcons[variant])

  const content = (
    <div
      className={`
        relative inline-flex items-center gap-2
        ${sizes.padding} rounded-lg
        ${style.bg} ${style.text}
        border-2 ${style.border}
        shadow-lg ${animated ? style.glow : ''}
        ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
        transition-transform
        ${className}
      `}
      onClick={onClick}
    >
      {/* Metallic bolts effect */}
      <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-400/50" />
      <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-400/50" />
      <div className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-400/50" />
      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-400/50" />

      {/* Floor Number Badge */}
      {floorNumber !== undefined && (
        <div className={`
          font-mono font-bold ${sizes.floorSize}
          bg-white/20 px-2 py-0.5 rounded
        `}>
          F{floorNumber}
        </div>
      )}

      {/* Icon */}
      <Icon className={sizes.iconSize} />

      {/* Text */}
      <div className="text-left">
        <div className={`font-bold ${sizes.text} tracking-wide`}>
          {title}
        </div>
        {subtitle && (
          <div className={`${sizes.subtitleText} opacity-80`}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Direction arrow animation */}
      {direction && animated && (
        <motion.div
          animate={{
            x: direction === 'right' ? [0, 4, 0] : direction === 'left' ? [0, -4, 0] : 0,
            y: direction === 'down' ? [0, 4, 0] : direction === 'up' ? [0, -4, 0] : 0
          }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {React.createElement(directionIcons[direction], { className: sizes.iconSize })}
        </motion.div>
      )}
    </div>
  )

  if (animated && variant === 'comic') {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      >
        {content}
      </motion.div>
    )
  }

  return content
}

// Comic-style action burst
export function ComicBurst({
  text,
  color = 'yellow',
  size = 'md',
  className = ''
}: {
  text: string
  color?: 'yellow' | 'red' | 'blue' | 'green' | 'purple'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const colorStyles = {
    yellow: 'from-yellow-400 to-orange-500 text-black',
    red: 'from-red-500 to-rose-600 text-white',
    blue: 'from-blue-500 to-indigo-600 text-white',
    green: 'from-green-500 to-emerald-600 text-white',
    purple: 'from-purple-500 to-pink-600 text-white'
  }

  const sizeStyles = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-lg px-4 py-2'
  }

  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      className={`
        inline-block font-black uppercase tracking-wider
        bg-gradient-to-br ${colorStyles[color]}
        ${sizeStyles[size]}
        rounded-lg shadow-lg
        transform -skew-x-3
        border-2 border-black/20
        ${className}
      `}
      style={{
        textShadow: '1px 1px 0 rgba(0,0,0,0.2)',
        clipPath: 'polygon(0 15%, 15% 0, 85% 0, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0 85%)'
      }}
    >
      {text}
    </motion.div>
  )
}

// Floor Marker Sign
export function FloorMarker({
  floor,
  name,
  isActive = false,
  onClick
}: {
  floor: number
  name: string
  isActive?: boolean
  onClick?: () => void
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        relative flex items-center gap-3 px-4 py-2 rounded-lg
        ${isActive
          ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }
        border-2 ${isActive ? 'border-purple-400' : 'border-slate-600'}
        transition-all
      `}
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Floor number */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center
        font-mono font-bold text-lg
        ${isActive ? 'bg-white/20' : 'bg-slate-800'}
      `}>
        {floor}
      </div>

      {/* Floor name */}
      <span className="font-semibold">{name}</span>

      {/* Active indicator */}
      {isActive && (
        <motion.div
          className="absolute right-3 w-2 h-2 rounded-full bg-green-400"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.button>
  )
}

// Directional Corridor Sign
export function CorridorSign({
  leftLabel,
  leftPath,
  rightLabel,
  rightPath,
  onNavigate
}: {
  leftLabel: string
  leftPath: string
  rightLabel: string
  rightPath: string
  onNavigate: (path: string) => void
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl border-2 border-slate-600">
      {/* Left direction */}
      <motion.button
        onClick={() => onNavigate(leftPath)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="font-medium">{leftLabel}</span>
      </motion.button>

      {/* Divider */}
      <div className="h-8 w-px bg-slate-600" />

      {/* Right direction */}
      <motion.button
        onClick={() => onNavigate(rightPath)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="font-medium">{rightLabel}</span>
        <ArrowRight className="h-4 w-4" />
      </motion.button>
    </div>
  )
}

// Import React for createElement
import React from 'react'

export default Signage
