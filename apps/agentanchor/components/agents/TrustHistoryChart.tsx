'use client'

import { useMemo } from 'react'
import { TrustTier } from '@/lib/agents/types'

interface TrustTrendPoint {
  date: string
  score: number
  tier: TrustTier
}

interface TrustHistoryChartProps {
  data: TrustTrendPoint[]
  days?: number
}

// Tier thresholds and colors
const TIER_THRESHOLDS = [
  { min: 0, max: 199, tier: 'untrusted', color: '#ef4444' },
  { min: 200, max: 399, tier: 'novice', color: '#22c55e' },
  { min: 400, max: 599, tier: 'proven', color: '#3b82f6' },
  { min: 600, max: 799, tier: 'trusted', color: '#8b5cf6' },
  { min: 800, max: 899, tier: 'elite', color: '#f59e0b' },
  { min: 900, max: 1000, tier: 'legendary', color: '#ec4899' },
]

function getTierColor(score: number): string {
  const tier = TIER_THRESHOLDS.find(t => score >= t.min && score <= t.max)
  return tier?.color || '#6b7280'
}

export function TrustHistoryChart({ data, days = 30 }: TrustHistoryChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: [], minScore: 0, maxScore: 100 }
    }

    // Sort by date
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const scores = sorted.map(d => d.score)
    const minScore = Math.max(0, Math.min(...scores) - 50)
    const maxScore = Math.min(1000, Math.max(...scores) + 50)

    return { points: sorted, minScore, maxScore }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
        <h3 className="text-lg font-medium text-neutral-100 mb-4">
          Trust Score Trend ({days} days)
        </h3>
        <div className="h-48 flex items-center justify-center text-neutral-500">
          No trust history data available
        </div>
      </div>
    )
  }

  const { points, minScore, maxScore } = chartData
  const range = maxScore - minScore

  // Calculate SVG path
  const width = 100
  const height = 100
  const padding = 5

  const getX = (index: number) => {
    return padding + (index / (points.length - 1 || 1)) * (width - 2 * padding)
  }

  const getY = (score: number) => {
    return height - padding - ((score - minScore) / range) * (height - 2 * padding)
  }

  const pathData = points
    .map((point, i) => {
      const x = getX(i)
      const y = getY(point.score)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Create gradient area path
  const areaPath = pathData + ` L ${getX(points.length - 1)} ${height - padding} L ${getX(0)} ${height - padding} Z`

  const latestScore = points[points.length - 1]?.score || 0
  const latestColor = getTierColor(latestScore)

  const firstScore = points[0]?.score || 0
  const change = latestScore - firstScore
  const changePercent = firstScore > 0 ? ((change / firstScore) * 100).toFixed(1) : '0'

  return (
    <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-neutral-100">
          Trust Score Trend ({days} days)
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-400">
            {points.length} data points
          </span>
          <span className={change >= 0 ? 'text-green-400' : 'text-red-400'}>
            {change >= 0 ? '+' : ''}{change} ({changePercent}%)
          </span>
        </div>
      </div>

      <div className="relative h-48">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-neutral-500">
          <span>{maxScore}</span>
          <span>{Math.round((maxScore + minScore) / 2)}</span>
          <span>{minScore}</span>
        </div>

        {/* Chart area */}
        <div className="ml-12 h-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Tier threshold lines */}
            {TIER_THRESHOLDS.map((tier) => {
              const y = getY(tier.min)
              if (tier.min > minScore && tier.min < maxScore) {
                return (
                  <line
                    key={tier.tier}
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke={tier.color}
                    strokeWidth="0.3"
                    strokeDasharray="2,2"
                    opacity="0.5"
                  />
                )
              }
              return null
            })}

            {/* Gradient area */}
            <defs>
              <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={latestColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={latestColor} stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path
              d={areaPath}
              fill="url(#trustGradient)"
            />

            {/* Line */}
            <path
              d={pathData}
              fill="none"
              stroke={latestColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {points.map((point, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(point.score)}
                r="1.5"
                fill={getTierColor(point.score)}
              />
            ))}
          </svg>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-12 flex justify-between text-xs text-neutral-500 mt-2">
        <span>
          {points[0] && new Date(points[0].date).toLocaleDateString()}
        </span>
        <span>
          {points[points.length - 1] && new Date(points[points.length - 1].date).toLocaleDateString()}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {TIER_THRESHOLDS.map((tier) => (
          <div key={tier.tier} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tier.color }}
            />
            <span className="text-neutral-400 capitalize">
              {tier.tier} ({tier.min}-{tier.max})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrustHistoryChart
