'use client'

import { motion } from 'framer-motion'
import { getFloorTheme, type FloorTheme } from '@/lib/building/floor-themes'

interface FloorLandingProps {
  floor: number
  children?: React.ReactNode
}

// Themed decorative elements for each floor type
function FloorDecorations({ theme }: { theme: FloorTheme }) {
  switch (theme.theme) {
    case 'luxury':
      return <LuxuryDecorations />
    case 'judicial':
      return <JudicialDecorations />
    case 'arena':
      return <ArenaDecorations />
    case 'control-room':
      return <ControlRoomDecorations />
    case 'academic':
      return <AcademicDecorations />
    case 'vault':
      return <VaultDecorations />
    case 'bazaar':
      return <BazaarDecorations />
    case 'workshop':
      return <WorkshopDecorations />
    case 'archive':
      return <ArchiveDecorations />
    case 'lobby':
      return <LobbyDecorations />
    default:
      return null
  }
}

// Floor 10: Luxury Executive - Marble & Gold
function LuxuryDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Marble texture overlay */}
      <div className="absolute inset-0 bg-[url('/patterns/marble.svg')] opacity-5" />

      {/* Gold corner accents */}
      <div className="absolute top-0 left-0 w-32 h-32 border-l-4 border-t-4 border-amber-500/30" />
      <div className="absolute top-0 right-0 w-32 h-32 border-r-4 border-t-4 border-amber-500/30" />
      <div className="absolute bottom-0 left-0 w-32 h-32 border-l-4 border-b-4 border-amber-500/30" />
      <div className="absolute bottom-0 right-0 w-32 h-32 border-r-4 border-b-4 border-amber-500/30" />

      {/* Chandelier glow effect */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-400/10 blur-3xl rounded-full"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Floating gold dust */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-amber-400/60 rounded-full"
          style={{ left: `${10 + i * 8}%`, top: `${20 + (i % 3) * 20}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
    </div>
  )
}

// Floor 9: Judicial - Oak & Scales
function JudicialDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Wood grain texture */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900/50 to-stone-950/50" />

      {/* Scales of justice silhouette */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 opacity-10">
        <svg width="120" height="80" viewBox="0 0 120 80" className="text-red-400">
          <path fill="currentColor" d="M60 0v60M30 20h60M20 20l10 30h-20zM100 20l-10 30h20z" strokeWidth="2" stroke="currentColor" />
        </svg>
      </div>

      {/* Dramatic side lighting */}
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-red-900/20 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-red-900/20 to-transparent" />

      {/* Floating papers effect */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-4 bg-stone-200/10 rounded-sm"
          style={{ left: `${15 + i * 15}%`, top: `${40 + (i % 2) * 20}%` }}
          animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}
    </div>
  )
}

// Floor 8: Arena - Neon & Stadium
function ArenaDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Stadium spotlight beams */}
      <motion.div
        className="absolute -top-20 left-1/4 w-40 h-96 bg-gradient-to-b from-orange-500/20 to-transparent rotate-12 blur-sm"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute -top-20 right-1/4 w-40 h-96 bg-gradient-to-b from-orange-500/20 to-transparent -rotate-12 blur-sm"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
      />

      {/* Neon border glow */}
      <div className="absolute inset-4 border-2 border-orange-500/30 rounded-lg shadow-[0_0_30px_rgba(249,115,22,0.3)]" />

      {/* Scoreboard dots */}
      <div className="absolute top-4 right-4 flex gap-1">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-orange-400 rounded-full"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>

      {/* Sparks */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-3 bg-orange-400"
          style={{ left: `${10 + i * 12}%`, bottom: '10%' }}
          animate={{ y: [-50, -100], opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

// Floor 7: Control Room - Monitors & Data
function ControlRoomDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Scan line effect */}
      <motion.div
        className="absolute inset-x-0 h-px bg-cyan-400/30"
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Monitor glow zones */}
      <div className="absolute top-4 left-4 w-24 h-16 rounded bg-cyan-500/5 border border-cyan-500/20" />
      <div className="absolute top-4 right-4 w-24 h-16 rounded bg-cyan-500/5 border border-cyan-500/20" />

      {/* Data streams */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-px h-12 bg-gradient-to-b from-cyan-400/50 to-transparent"
          style={{ left: `${20 + i * 12}%`, top: '10%' }}
          animate={{ y: [0, 100], opacity: [0.8, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      {/* Radar sweep */}
      <motion.div
        className="absolute bottom-4 right-4 w-16 h-16 rounded-full border border-cyan-500/30 overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-conic from-cyan-400/30 to-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    </div>
  )
}

// Floor 6: Academic - Books & Ivy
function AcademicDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Warm reading light glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-400/10 blur-3xl rounded-full" />

      {/* Bookshelf silhouettes */}
      <div className="absolute bottom-0 left-4 w-2 h-32 bg-emerald-900/30 rounded-t" />
      <div className="absolute bottom-0 left-8 w-2 h-24 bg-emerald-900/20 rounded-t" />
      <div className="absolute bottom-0 right-4 w-2 h-28 bg-emerald-900/30 rounded-t" />
      <div className="absolute bottom-0 right-8 w-2 h-20 bg-emerald-900/20 rounded-t" />

      {/* Ivy vine decorations */}
      <svg className="absolute top-0 left-0 w-24 h-48 text-emerald-600/20" viewBox="0 0 100 200">
        <path d="M10 0 Q 30 50 10 100 Q 30 150 10 200" fill="none" stroke="currentColor" strokeWidth="2"/>
        <circle cx="20" cy="40" r="8" fill="currentColor"/>
        <circle cx="5" cy="80" r="6" fill="currentColor"/>
        <circle cx="25" cy="120" r="7" fill="currentColor"/>
      </svg>

      {/* Floating pages */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-4 h-5 bg-stone-200/5 rounded-sm border border-stone-400/10"
          style={{ left: `${30 + i * 15}%`, top: `${30 + (i % 2) * 15}%` }}
          animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}
    </div>
  )
}

// Floor 5: Vault - Steel & Security
function VaultDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Hexagon pattern */}
      <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2256%22%20height%3D%22100%22%3E%3Cpath%20d%3D%22M28%2066L0%2050L0%2016L28%200L56%2016L56%2050L28%2066%22%20fill%3D%22none%22%20stroke%3D%22%233b82f6%22%20stroke-width%3D%221%22%2F%3E%3C%2Fsvg%3E')]" />

      {/* Security laser lines */}
      <motion.div
        className="absolute top-1/4 inset-x-8 h-px bg-blue-400/40"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-3/4 inset-x-8 h-px bg-blue-400/40"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
      />

      {/* Vault door accent */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-24 rounded-full border-4 border-blue-500/20" />

      {/* Badge spotlights */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-8 h-8 rounded-full bg-blue-400/10"
          style={{ left: `${30 + i * 20}%`, top: '20%' }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}
    </div>
  )
}

// Floor 4: Bazaar - Colorful & Busy
function BazaarDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Awning stripes */}
      <div className="absolute top-0 inset-x-0 h-8 bg-[linear-gradient(90deg,rgba(236,72,153,0.2)_0%,rgba(147,51,234,0.2)_50%,rgba(236,72,153,0.2)_100%)]" />

      {/* Neon sign glow */}
      <motion.div
        className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded text-pink-400/50 text-sm font-bold border border-pink-400/30"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        OPEN
      </motion.div>

      {/* Price tag decorations */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-6 h-4 bg-pink-500/20 rounded-sm"
          style={{ left: `${15 + i * 18}%`, top: `${50 + (i % 3) * 10}%` }}
          animate={{ rotate: [-5, 5, -5], y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}

      {/* Confetti */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-2 h-2 rounded-sm ${i % 3 === 0 ? 'bg-pink-400/40' : i % 3 === 1 ? 'bg-purple-400/40' : 'bg-amber-400/40'}`}
          style={{ left: `${5 + i * 8}%`, top: '-5%' }}
          animate={{ y: ['0%', '120%'], rotate: [0, 360] }}
          transition={{ duration: 4 + i * 0.3, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
    </div>
  )
}

// Floor 3: Workshop - Industrial & Creative
function WorkshopDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Exposed brick texture hint */}
      <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-amber-900/20 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-amber-900/20 to-transparent" />

      {/* Tool pegboard pattern */}
      <div className="absolute top-4 right-4 grid grid-cols-4 gap-2 opacity-30">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-amber-600/50" />
        ))}
      </div>

      {/* Warm work light */}
      <motion.div
        className="absolute top-0 left-1/3 w-48 h-32 bg-amber-400/15 blur-2xl rounded-full"
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Welding sparks */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-amber-300"
          style={{ left: '60%', bottom: '30%' }}
          animate={{
            x: [0, (i % 2 ? 30 : -30) + i * 5],
            y: [0, -20 - i * 5],
            opacity: [1, 0]
          }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}

      {/* Blueprint grid */}
      <div className="absolute bottom-4 left-4 w-24 h-16 bg-blue-900/10 border border-blue-400/20 rounded">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:8px_8px]" />
      </div>
    </div>
  )
}

// Floor 2: Archive - Filing & Documents
function ArchiveDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Fluorescent light effect */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-b from-zinc-400/10 to-transparent" />

      {/* Filing cabinet silhouettes */}
      <div className="absolute bottom-0 left-4 w-8 h-48 bg-zinc-700/20 rounded-t" />
      <div className="absolute bottom-0 left-14 w-8 h-48 bg-zinc-700/15 rounded-t" />
      <div className="absolute bottom-0 right-4 w-8 h-48 bg-zinc-700/20 rounded-t" />
      <div className="absolute bottom-0 right-14 w-8 h-48 bg-zinc-700/15 rounded-t" />

      {/* Drawer lines */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="absolute left-4 w-8 h-px bg-zinc-500/30" style={{ bottom: `${10 + i * 10}%` }} />
      ))}

      {/* Floating folders */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-6 h-4 bg-amber-200/10 rounded-sm border-t-2 border-amber-300/20"
          style={{ left: `${35 + i * 12}%`, top: `${30 + (i % 2) * 20}%` }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}

      {/* Stamp effect */}
      <div className="absolute bottom-4 right-4 w-12 h-12 rounded border-2 border-red-500/20 flex items-center justify-center">
        <span className="text-red-500/30 text-xs font-bold rotate-[-15deg]">APPROVED</span>
      </div>
    </div>
  )
}

// Floor 1: Lobby - Grand & Welcoming
function LobbyDecorations() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Chandelier warm glow */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-amber-200/10 blur-3xl rounded-full"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Marble floor reflection */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-600/10 to-transparent" />

      {/* Potted plant silhouettes */}
      <div className="absolute bottom-0 left-8 w-6 h-16 bg-emerald-900/20 rounded-t-full" />
      <div className="absolute bottom-0 right-8 w-6 h-16 bg-emerald-900/20 rounded-t-full" />

      {/* Reception desk hint */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-slate-700/30 rounded-t-lg" />

      {/* Directory board */}
      <div className="absolute top-8 right-8 w-16 h-24 bg-slate-700/30 rounded border border-slate-500/20">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="mx-2 mt-2 h-2 bg-slate-500/20 rounded" />
        ))}
      </div>

      {/* Gentle ambient glow particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-amber-200/20 rounded-full blur-sm"
          style={{ left: `${20 + i * 12}%`, top: `${30 + (i % 2) * 20}%` }}
          animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}
    </div>
  )
}

// Main FloorLanding component
export function FloorLanding({ floor, children }: FloorLandingProps) {
  const theme = getFloorTheme(floor)
  const Icon = theme.icon

  return (
    <div className={`relative min-h-screen bg-gradient-to-b ${theme.bgGradient}`}>
      {/* Theme-specific decorations */}
      <FloorDecorations theme={theme} />

      {/* Floor header */}
      <div className="relative z-10 px-6 py-8">
        <div className="flex items-center gap-4 mb-2">
          <div className={`p-3 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border ${theme.themeDetails.doorTrim}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono ${theme.themeDetails.floorIndicator}`}>
                F{floor}
              </span>
              <span className="text-white/40 text-xs">{theme.themeDetails.mood}</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{theme.name}</h1>
          </div>
        </div>
        <p className="text-white/60 ml-16">{theme.subtitle}</p>
      </div>

      {/* Page content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

export default FloorLanding
