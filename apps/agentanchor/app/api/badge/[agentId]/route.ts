/**
 * Badge API - Public embeddable SVG badges
 * FR98: Public verification via API
 * FR99: Public verification URLs for certificates
 *
 * GET /api/badge/:agentId - Returns SVG badge
 * Query params:
 *   - variant: 'full' | 'compact' | 'inline' (default: 'compact')
 *   - theme: 'light' | 'dark' (default: 'light')
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TrustTier, TRUST_TIERS } from '@/lib/agents/types'
import { urls } from '@/lib/config'

// BAI Brand Colors
const BAI_COLORS = {
  trustBlue: '#1E40AF',
  trustBlueLight: '#3B82F6',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  genesis: '#7C3AED',
}

type CertificationLevel = 'none' | 'verified' | 'trusted' | 'certified' | 'autonomous' | 'genesis'

const tierToCertification: Record<TrustTier, CertificationLevel> = {
  untrusted: 'none',
  novice: 'verified',
  proven: 'trusted',
  trusted: 'certified',
  elite: 'autonomous',
  legendary: 'genesis',
}

const certificationLabels: Record<CertificationLevel, string> = {
  none: 'Uncertified',
  verified: 'BAI Verified',
  trusted: 'BAI Trusted',
  certified: 'BAI Certified',
  autonomous: 'BAI Autonomous',
  genesis: 'BAI Genesis',
}

const certificationColors: Record<CertificationLevel, string> = {
  none: '#6B7280',
  verified: BAI_COLORS.bronze,
  trusted: BAI_COLORS.silver,
  certified: BAI_COLORS.gold,
  autonomous: BAI_COLORS.platinum,
  genesis: BAI_COLORS.genesis,
}

function generateInlineBadge(
  agentName: string,
  score: number,
  tier: TrustTier,
  theme: 'light' | 'dark'
): string {
  const cert = tierToCertification[tier]
  const label = certificationLabels[cert]
  const color = certificationColors[cert]
  const bgColor = theme === 'dark' ? '#1F2937' : '#FFFFFF'
  const textColor = theme === 'dark' ? '#F9FAFB' : '#111827'

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 24" width="160" height="24">
  <rect width="160" height="24" rx="12" fill="${bgColor}" stroke="${color}" stroke-width="1.5"/>
  <g transform="translate(6, 4)">
    <circle cx="8" cy="8" r="5" stroke="${BAI_COLORS.trustBlue}" stroke-width="1.5" fill="none"/>
    <path d="M8 5 L8 14" stroke="${BAI_COLORS.trustBlue}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M4 7 L12 7" stroke="${BAI_COLORS.trustBlue}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M3 12 Q3 15 8 16 Q13 15 13 12" stroke="${BAI_COLORS.trustBlue}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </g>
  <text x="28" y="16" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600" fill="${color}">${label}</text>
  <text x="148" y="16" font-family="Inter, system-ui, sans-serif" font-size="10" fill="${textColor}" text-anchor="end">${score}</text>
</svg>`
}

function generateCompactBadge(
  agentName: string,
  score: number,
  tier: TrustTier,
  theme: 'light' | 'dark'
): string {
  const cert = tierToCertification[tier]
  const label = certificationLabels[cert]
  const color = certificationColors[cert]
  const bgColor = theme === 'dark' ? '#1F2937' : '#FFFFFF'
  const textColor = theme === 'dark' ? '#F9FAFB' : '#111827'
  const subTextColor = theme === 'dark' ? '#9CA3AF' : '#6B7280'

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 48" width="180" height="48">
  <defs>
    <linearGradient id="anchorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${BAI_COLORS.trustBlue}"/>
      <stop offset="100%" style="stop-color:${BAI_COLORS.trustBlueLight}"/>
    </linearGradient>
  </defs>
  <rect width="180" height="48" rx="8" fill="${bgColor}" stroke="${color}" stroke-width="2"/>

  <!-- Anchor Icon -->
  <g transform="translate(8, 8)">
    <circle cx="16" cy="6" r="5" stroke="url(#anchorGrad)" stroke-width="2" fill="none"/>
    <path d="M16 11 L16 26" stroke="url(#anchorGrad)" stroke-width="2" stroke-linecap="round"/>
    <path d="M10 14 L22 14" stroke="url(#anchorGrad)" stroke-width="2" stroke-linecap="round"/>
    <path d="M6 22 Q6 28 16 30 Q26 28 26 22" stroke="url(#anchorGrad)" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>

  <!-- Text -->
  <text x="48" y="20" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" fill="${color}">${label}</text>
  <text x="48" y="36" font-family="Inter, system-ui, sans-serif" font-size="11" fill="${subTextColor}">Score: ${score}/1000</text>

  <!-- Verify link indicator -->
  <circle cx="168" cy="24" r="4" fill="${BAI_COLORS.trustBlue}" opacity="0.2"/>
  <path d="M166 24 L170 24 M168 22 L168 26" stroke="${BAI_COLORS.trustBlue}" stroke-width="1.5" stroke-linecap="round"/>
</svg>`
}

function generateFullBadge(
  agentName: string,
  score: number,
  tier: TrustTier,
  theme: 'light' | 'dark',
  verifyUrl: string
): string {
  const cert = tierToCertification[tier]
  const label = certificationLabels[cert]
  const color = certificationColors[cert]
  const bgColor = theme === 'dark' ? '#1F2937' : '#FFFFFF'
  const textColor = theme === 'dark' ? '#F9FAFB' : '#111827'
  const subTextColor = theme === 'dark' ? '#9CA3AF' : '#6B7280'
  const progressWidth = Math.round((score / 1000) * 140)
  const tierInfo = TRUST_TIERS[tier]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" width="200" height="120">
  <defs>
    <linearGradient id="anchorGradFull" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${BAI_COLORS.trustBlue}"/>
      <stop offset="100%" style="stop-color:${BAI_COLORS.trustBlueLight}"/>
    </linearGradient>
    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${BAI_COLORS.trustBlue}"/>
      <stop offset="100%" style="stop-color:${color}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="200" height="120" rx="12" fill="${bgColor}" stroke="${color}" stroke-width="2"/>

  <!-- Header -->
  <g transform="translate(12, 12)">
    <!-- Anchor icon -->
    <circle cx="14" cy="5" r="4" stroke="url(#anchorGradFull)" stroke-width="2" fill="none"/>
    <path d="M14 9 L14 22" stroke="url(#anchorGradFull)" stroke-width="2" stroke-linecap="round"/>
    <path d="M9 12 L19 12" stroke="url(#anchorGradFull)" stroke-width="2" stroke-linecap="round"/>
    <path d="M6 19 Q6 24 14 26 Q22 24 22 19" stroke="url(#anchorGradFull)" stroke-width="2" fill="none" stroke-linecap="round"/>

    <!-- BAI text -->
    <text x="32" y="12" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" fill="${BAI_COLORS.trustBlue}">BAI</text>
    <text x="32" y="24" font-family="Inter, system-ui, sans-serif" font-size="9" fill="${subTextColor}">AgentAnchor</text>
  </g>

  <!-- Agent name -->
  <text x="12" y="56" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="${textColor}">${agentName.length > 20 ? agentName.substring(0, 20) + '...' : agentName}</text>

  <!-- Certification -->
  <text x="12" y="72" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="500" fill="${color}">${label}</text>

  <!-- Score -->
  <text x="188" y="56" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="${textColor}" text-anchor="end">${score}</text>
  <text x="188" y="70" font-family="Inter, system-ui, sans-serif" font-size="9" fill="${subTextColor}" text-anchor="end">/1000</text>

  <!-- Progress bar -->
  <rect x="12" y="82" width="176" height="6" rx="3" fill="${theme === 'dark' ? '#374151' : '#E5E7EB'}"/>
  <rect x="12" y="82" width="${progressWidth}" height="6" rx="3" fill="url(#progressGrad)"/>

  <!-- Verify link -->
  <g transform="translate(12, 96)">
    <text font-family="Inter, system-ui, sans-serif" font-size="8" fill="${subTextColor}">Verify at ${new URL(urls.marketing).host}</text>
  </g>
</svg>`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const { searchParams } = new URL(request.url)
  const variant = (searchParams.get('variant') || 'compact') as 'full' | 'compact' | 'inline'
  const theme = (searchParams.get('theme') || 'light') as 'light' | 'dark'

  try {
    const supabase = createClient()

    // Fetch agent data
    const { data: agent, error } = await supabase
      .from('bots')
      .select('id, name, trust_score, trust_tier, status')
      .eq('id', agentId)
      .single()

    if (error || !agent) {
      // Return a "not found" badge
      const notFoundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 24" width="160" height="24">
        <rect width="160" height="24" rx="12" fill="#FEE2E2" stroke="#EF4444" stroke-width="1"/>
        <text x="80" y="16" font-family="Inter, system-ui, sans-serif" font-size="11" fill="#EF4444" text-anchor="middle">Agent Not Found</text>
      </svg>`
      return new NextResponse(notFoundSvg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=300',
        },
      })
    }

    const verifyUrl = `${urls.verify}/agent/${agentId}`
    let svg: string

    switch (variant) {
      case 'inline':
        svg = generateInlineBadge(agent.name, agent.trust_score, agent.trust_tier as TrustTier, theme)
        break
      case 'full':
        svg = generateFullBadge(agent.name, agent.trust_score, agent.trust_tier as TrustTier, theme, verifyUrl)
        break
      case 'compact':
      default:
        svg = generateCompactBadge(agent.name, agent.trust_score, agent.trust_tier as TrustTier, theme)
        break
    }

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'Access-Control-Allow-Origin': '*', // Allow embedding anywhere
      },
    })
  } catch (error) {
    console.error('Badge generation error:', error)
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 24" width="160" height="24">
      <rect width="160" height="24" rx="12" fill="#FEE2E2" stroke="#EF4444" stroke-width="1"/>
      <text x="80" y="16" font-family="Inter, system-ui, sans-serif" font-size="11" fill="#EF4444" text-anchor="middle">Error</text>
    </svg>`
    return new NextResponse(errorSvg, {
      status: 500,
      headers: { 'Content-Type': 'image/svg+xml' },
    })
  }
}
