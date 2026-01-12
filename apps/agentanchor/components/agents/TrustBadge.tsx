'use client'

import { Shield, ShieldCheck, ShieldAlert, Star, Crown, Sparkles, ExternalLink, Anchor } from 'lucide-react'
import { TrustTier, TRUST_TIERS, getTrustTierFromScore } from '@/lib/agents/types'

// BAI Brand Colors
export const BAI_COLORS = {
  trustBlue: '#1E40AF',
  actionOrange: '#EA580C',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  // Certification Tier Colors
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  genesis: '#7C3AED',
} as const

// BAI Certification Level mapping (aligns with brand)
export type CertificationLevel = 'none' | 'verified' | 'trusted' | 'certified' | 'autonomous' | 'genesis'

export const tierToCertification: Record<TrustTier, CertificationLevel> = {
  untrusted: 'none',
  novice: 'verified',      // Bronze (300-499 in brand, 200-399 in system)
  proven: 'trusted',       // Silver (500-699 in brand, 400-599 in system)
  trusted: 'certified',    // Gold (700-849 in brand, 600-799 in system)
  elite: 'autonomous',     // Platinum (850-1000 in brand, 800-899 in system)
  legendary: 'genesis',    // Special founding status (900-1000)
}

export const certificationLabels: Record<CertificationLevel, string> = {
  none: 'Uncertified',
  verified: 'BAI Verified',
  trusted: 'BAI Trusted',
  certified: 'BAI Certified',
  autonomous: 'BAI Autonomous',
  genesis: 'BAI Genesis',
}

interface TrustBadgeProps {
  score: number
  tier: TrustTier
  size?: 'sm' | 'md' | 'lg'
  showScore?: boolean
  showLabel?: boolean
  showEmoji?: boolean
  agentId?: string  // For verification link
}

// Emoji badges per PRD spec (FR50, FR53)
export const tierEmojis: Record<TrustTier, string> = {
  untrusted: '⚠️',
  novice: '🌱',
  proven: '✅',
  trusted: '🛡️',
  elite: '👑',
  legendary: '🌟',
}

// Autonomy limits by tier (FR54) - describes what actions are permitted
export const tierAutonomy: Record<TrustTier, { description: string; riskLevel: string }> = {
  untrusted: { description: 'Cannot operate autonomously', riskLevel: 'None' },
  novice: { description: 'Low-risk actions with logging', riskLevel: 'Low' },
  proven: { description: 'Standard actions with oversight', riskLevel: 'Medium' },
  trusted: { description: 'Most actions independently', riskLevel: 'High' },
  elite: { description: 'High-risk with minimal oversight', riskLevel: 'High+' },
  legendary: { description: 'Full autonomy, mentor privileges', riskLevel: 'All' },
}

const tierIcons: Record<TrustTier, React.ElementType> = {
  untrusted: ShieldAlert,
  novice: Shield,
  proven: ShieldCheck,
  trusted: ShieldCheck,
  elite: Star,
  legendary: Crown,
}

// BAI Brand-aligned colors using Trust Blue as primary
const tierColors: Record<TrustTier, string> = {
  untrusted: 'text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  novice: 'text-[#CD7F32] bg-amber-50 dark:bg-amber-900/20 border-[#CD7F32]/30',
  proven: 'text-gray-500 bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600',
  trusted: 'text-[#B8860B] bg-yellow-50 dark:bg-yellow-900/20 border-[#FFD700]/50',
  elite: 'text-gray-600 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 border-[#E5E4E2]',
  legendary: 'text-[#7C3AED] bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30 border-[#7C3AED]/50',
}

const sizeClasses = {
  sm: {
    container: 'px-2 py-0.5 text-xs gap-1',
    icon: 'h-3 w-3',
  },
  md: {
    container: 'px-2.5 py-1 text-sm gap-1.5',
    icon: 'h-4 w-4',
  },
  lg: {
    container: 'px-3 py-1.5 text-base gap-2',
    icon: 'h-5 w-5',
  },
}

export default function TrustBadge({
  score,
  tier,
  size = 'md',
  showScore = false,
  showLabel = true,
  showEmoji = true,
}: TrustBadgeProps) {
  // Defensive: calculate tier from score if tier is invalid/undefined
  const validTier: TrustTier = tier && tierIcons[tier] ? tier : getTrustTierFromScore(score)

  const Icon = tierIcons[validTier]
  const tierInfo = TRUST_TIERS[validTier]
  const sizes = sizeClasses[size]
  const emoji = tierEmojis[validTier]

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium border ${tierColors[validTier]} ${sizes.container}`}
      title={`Trust Score: ${score}/1000 - ${tierInfo.label}`}
    >
      {showEmoji ? (
        <span className={sizes.icon} role="img" aria-label={tierInfo.label}>
          {emoji}
        </span>
      ) : (
        <Icon className={sizes.icon} />
      )}
      {showLabel && <span>{tierInfo.label}</span>}
      {showScore && (
        <span className="ml-1 opacity-75">({score})</span>
      )}
      {validTier === 'legendary' && (
        <Sparkles className={`${sizes.icon} ml-0.5 animate-pulse`} />
      )}
    </div>
  )
}

// Compact version for cards
export function TrustScoreIndicator({ score, tier }: { score: number; tier: TrustTier }) {
  // Defensive: calculate tier from score if tier is invalid/undefined
  const validTier: TrustTier = tier && tierEmojis[tier] ? tier : getTrustTierFromScore(score)
  const tierInfo = TRUST_TIERS[validTier]
  const emoji = tierEmojis[validTier]
  const percentage = (score / 1000) * 100

  return (
    <div className="flex items-center gap-2">
      <TrustBadge score={score} tier={validTier} size="sm" showLabel={false} />
      <div className="flex-1">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>
            <span role="img" aria-label={tierInfo.label}>{emoji}</span> {tierInfo.label}
          </span>
          <span>{score}/1000</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              validTier === 'legendary'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                : validTier === 'elite'
                ? 'bg-purple-500'
                : validTier === 'trusted'
                ? 'bg-green-500'
                : validTier === 'proven'
                ? 'bg-blue-500'
                : validTier === 'novice'
                ? 'bg-yellow-500'
                : 'bg-gray-400'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Certification level badge
export function CertificationBadge({
  level,
  size = 'md',
}: {
  level: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = sizeClasses[size]

  if (level === 0) {
    return (
      <div
        className={`inline-flex items-center rounded-full font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 ${sizes.container}`}
      >
        <Shield className={sizes.icon} />
        <span>Uncertified</span>
      </div>
    )
  }

  const levelColors = [
    'text-gray-600 bg-gray-100', // Should not appear
    'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    'text-green-600 bg-green-100 dark:bg-green-900/30',
    'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    'text-rose-600 bg-gradient-to-r from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30',
  ]

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium ${levelColors[level]} ${sizes.container}`}
      title={`Certification Level ${level}`}
    >
      <ShieldCheck className={sizes.icon} />
      <span>Level {level}</span>
      {level === 5 && <Sparkles className={`${sizes.icon} ml-0.5 animate-pulse`} />}
    </div>
  )
}

// Autonomy indicator showing what actions are permitted (FR54)
export function AutonomyIndicator({ tier, score = 0 }: { tier: TrustTier; score?: number }) {
  // Defensive: calculate tier from score if tier is invalid/undefined
  const validTier: TrustTier = tier && tierAutonomy[tier] ? tier : getTrustTierFromScore(score)
  const autonomy = tierAutonomy[validTier]
  const tierInfo = TRUST_TIERS[validTier]
  const emoji = tierEmojis[validTier]

  const riskLevelColors: Record<string, string> = {
    'None': 'text-gray-500 bg-gray-100 dark:bg-gray-800',
    'Low': 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    'Medium': 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    'High': 'text-green-600 bg-green-100 dark:bg-green-900/30',
    'High+': 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    'All': 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span role="img" aria-label={tierInfo.label} className="text-lg">
          {emoji}
        </span>
        <h4 className="font-medium text-gray-900 dark:text-white">
          {tierInfo.label} Autonomy
        </h4>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {autonomy.description}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Max Risk Level:</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskLevelColors[autonomy.riskLevel]}`}>
          {autonomy.riskLevel}
        </span>
      </div>
    </div>
  )
}

// Detailed trust tier card with all info (for profiles/tooltips)
export function TrustTierCard({ score, tier }: { score: number; tier: TrustTier }) {
  // Defensive: calculate tier from score if tier is invalid/undefined
  const validTier: TrustTier = tier && tierEmojis[tier] ? tier : getTrustTierFromScore(score)
  const tierInfo = TRUST_TIERS[validTier]
  const emoji = tierEmojis[validTier]
  const autonomy = tierAutonomy[validTier]
  const percentage = (score / 1000) * 100

  // Calculate next tier threshold
  const tiers: TrustTier[] = ['untrusted', 'novice', 'proven', 'trusted', 'elite', 'legendary']
  const currentTierIndex = tiers.indexOf(validTier)
  const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null
  const nextTierInfo = nextTier ? TRUST_TIERS[nextTier] : null
  const pointsToNext = nextTierInfo ? nextTierInfo.min - score : 0

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      {/* Header with emoji and score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span role="img" aria-label={tierInfo.label} className="text-3xl">
            {emoji}
          </span>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {tierInfo.label}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Trust Tier
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {score}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">/ 1000</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              validTier === 'legendary'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                : validTier === 'elite'
                ? 'bg-purple-500'
                : validTier === 'trusted'
                ? 'bg-green-500'
                : validTier === 'proven'
                ? 'bg-blue-500'
                : validTier === 'novice'
                ? 'bg-yellow-500'
                : 'bg-gray-400'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {nextTier && pointsToNext > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {pointsToNext} points to {tierEmojis[nextTier]} {TRUST_TIERS[nextTier].label}
          </p>
        )}
      </div>

      {/* Autonomy section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Autonomy Level
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {autonomy.description}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Max risk level: <span className="font-medium">{autonomy.riskLevel}</span>
        </p>
      </div>
    </div>
  )
}

// BAI Certification Badge - embeddable version for external use (FR98, FR99)
interface BAICertificationBadgeProps {
  agentId: string
  agentName: string
  score: number
  tier: TrustTier
  verificationHash?: string
  variant?: 'full' | 'compact' | 'inline'
  showVerifyLink?: boolean
}

export function BAICertificationBadge({
  agentId,
  agentName,
  score,
  tier,
  verificationHash,
  variant = 'full',
  showVerifyLink = true,
}: BAICertificationBadgeProps) {
  const certification = tierToCertification[tier]
  const certLabel = certificationLabels[certification]
  const tierInfo = TRUST_TIERS[tier]

  const verifyUrl = verificationHash
    ? `/verify/${verificationHash}`
    : `/verify/agent/${agentId}`

  // Certification tier colors aligned with BAI brand
  const certColors: Record<CertificationLevel, { bg: string; border: string; text: string }> = {
    none: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-500' },
    verified: { bg: 'bg-gradient-to-r from-amber-50 to-orange-50', border: 'border-[#CD7F32]', text: 'text-[#CD7F32]' },
    trusted: { bg: 'bg-gradient-to-r from-gray-100 to-slate-100', border: 'border-[#C0C0C0]', text: 'text-gray-600' },
    certified: { bg: 'bg-gradient-to-r from-yellow-50 to-amber-50', border: 'border-[#FFD700]', text: 'text-[#B8860B]' },
    autonomous: { bg: 'bg-gradient-to-r from-gray-50 to-slate-50', border: 'border-[#E5E4E2]', text: 'text-gray-700' },
    genesis: { bg: 'bg-gradient-to-r from-purple-50 to-violet-50', border: 'border-[#7C3AED]', text: 'text-[#7C3AED]' },
  }

  const colors = certColors[certification]

  if (variant === 'inline') {
    return (
      <a
        href={verifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.border} ${colors.text} hover:opacity-80 transition-opacity`}
        title={`${certLabel} - Score: ${score}/1000`}
      >
        <Anchor className="h-3 w-3" style={{ color: BAI_COLORS.trustBlue }} />
        <span>{certLabel}</span>
      </a>
    )
  }

  if (variant === 'compact') {
    return (
      <a
        href={verifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 ${colors.bg} ${colors.border} hover:shadow-md transition-shadow`}
      >
        <div className="flex items-center gap-1.5">
          <Anchor className="h-4 w-4" style={{ color: BAI_COLORS.trustBlue }} />
          <span className={`font-semibold text-sm ${colors.text}`}>{certLabel}</span>
        </div>
        <span className="text-xs text-gray-500">{score}</span>
      </a>
    )
  }

  // Full badge variant
  return (
    <div className={`rounded-xl border-2 ${colors.bg} ${colors.border} p-4 max-w-xs`}>
      {/* Header with BAI anchor logo */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-full bg-white shadow-sm">
          <Anchor className="h-5 w-5" style={{ color: BAI_COLORS.trustBlue }} />
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: BAI_COLORS.trustBlue }}>BAI</p>
          <p className="text-[10px] text-gray-500">AgentAnchor</p>
        </div>
      </div>

      {/* Agent info */}
      <div className="mb-3">
        <p className="font-semibold text-gray-900 truncate">{agentName}</p>
        <p className={`text-sm font-medium ${colors.text}`}>{certLabel}</p>
      </div>

      {/* Trust score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <span className="text-2xl font-bold text-gray-900">{score}</span>
          <span className="text-sm text-gray-400">/1000</span>
        </div>
        <span className="text-lg">{tierEmojis[tier]}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(score / 1000) * 100}%`,
            backgroundColor: certification === 'genesis' ? BAI_COLORS.genesis : BAI_COLORS.trustBlue
          }}
        />
      </div>

      {/* Verify link */}
      {showVerifyLink && (
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          <span>Verify on AgentAnchor</span>
        </a>
      )}
    </div>
  )
}

// Probation indicator for agents under review (FR57)
export function ProbationIndicator({
  daysRemaining,
  reason
}: {
  daysRemaining: number
  reason?: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
      <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
      <div>
        <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
          Probation Period
        </p>
        <p className="text-xs text-orange-600 dark:text-orange-400">
          {daysRemaining} days remaining{reason && ` - ${reason}`}
        </p>
      </div>
    </div>
  )
}
