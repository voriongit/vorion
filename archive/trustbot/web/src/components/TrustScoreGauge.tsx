/**
 * TrustScoreGauge - Visual trust score indicator
 *
 * Circular gauge showing agent trust score (0-1000) with:
 * - Animated arc fill
 * - Tier-based color coding
 * - Central tier badge
 * - Trend indicator
 * - Responsive sizing
 */

import { useEffect, useState } from 'react';
import { TrustTier, TIER_CONFIG, getTierFromScore } from '../types';

export interface TrustScoreGaugeProps {
    score: number;
    trend?: 'rising' | 'falling' | 'stable';
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
    animated?: boolean;
}

// Size configurations
const SIZE_CONFIG = {
    small: { width: 80, strokeWidth: 6, fontSize: 14, tierSize: 10 },
    medium: { width: 120, strokeWidth: 8, fontSize: 20, tierSize: 12 },
    large: { width: 160, strokeWidth: 10, fontSize: 28, tierSize: 14 },
};

// Tier icons for visual flair
const TIER_ICONS: Record<TrustTier, string> = {
    [TrustTier.ELITE]: '👑',
    [TrustTier.CERTIFIED]: '⭐',
    [TrustTier.VERIFIED]: '✓',
    [TrustTier.TRUSTED]: '🛡️',
    [TrustTier.PROBATIONARY]: '⏳',
    [TrustTier.UNTRUSTED]: '⚠️',
};

export function TrustScoreGauge({
    score,
    trend = 'stable',
    size = 'medium',
    showLabel = true,
    animated = true,
}: TrustScoreGaugeProps) {
    const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
    const config = SIZE_CONFIG[size];
    const tier = getTierFromScore(score);
    const tierConfig = TIER_CONFIG[tier];

    // Animate score on mount or change
    useEffect(() => {
        if (!animated) {
            setDisplayScore(score);
            return;
        }

        const duration = 1000; // 1 second animation
        const startScore = displayScore;
        const diff = score - startScore;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayScore(Math.round(startScore + diff * eased));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [score, animated]);

    // SVG calculations
    const center = config.width / 2;
    const radius = center - config.strokeWidth;
    const circumference = 2 * Math.PI * radius;

    // Arc goes from 135deg to 405deg (270deg sweep, 3/4 circle)
    const sweepAngle = 270;
    const maxScore = 1000;
    const fillPercent = Math.min(displayScore / maxScore, 1);
    const strokeDashoffset = circumference * (1 - (fillPercent * (sweepAngle / 360)));

    // Trend arrow
    const trendArrow = trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : '→';
    const trendColor = trend === 'rising' ? '#10b981' : trend === 'falling' ? '#ef4444' : '#6b7280';

    return (
        <div
            className="trust-score-gauge"
            style={{
                position: 'relative',
                width: config.width,
                height: config.width,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {/* SVG Gauge */}
            <svg
                width={config.width}
                height={config.width}
                viewBox={`0 0 ${config.width} ${config.width}`}
                style={{ transform: 'rotate(135deg)' }}
            >
                {/* Background track */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={config.strokeWidth}
                    strokeDasharray={`${circumference * (sweepAngle / 360)} ${circumference}`}
                    strokeLinecap="round"
                />

                {/* Filled arc with gradient */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={tierConfig.color}
                    strokeWidth={config.strokeWidth}
                    strokeDasharray={`${circumference * (sweepAngle / 360)} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{
                        transition: animated ? 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease' : 'none',
                        filter: `drop-shadow(0 0 ${config.strokeWidth}px ${tierConfig.color}40)`,
                    }}
                />

                {/* Glow effect */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={tierConfig.color}
                    strokeWidth={config.strokeWidth + 4}
                    strokeDasharray={`${circumference * (sweepAngle / 360)} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    opacity={0.2}
                    style={{
                        transition: animated ? 'stroke-dashoffset 0.3s ease-out' : 'none',
                    }}
                />
            </svg>

            {/* Center content */}
            <div
                style={{
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                }}
            >
                {/* Score */}
                <div
                    style={{
                        fontSize: config.fontSize,
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: tierConfig.color,
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    }}
                >
                    {displayScore}
                    <span
                        style={{
                            fontSize: config.fontSize * 0.5,
                            color: trendColor,
                            marginLeft: 2,
                        }}
                    >
                        {trendArrow}
                    </span>
                </div>

                {/* Tier badge */}
                {showLabel && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                            fontSize: config.tierSize,
                            color: 'rgba(255,255,255,0.7)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}
                    >
                        <span>{TIER_ICONS[tier]}</span>
                        <span>{tierConfig.name}</span>
                    </div>
                )}
            </div>

            {/* Pulse animation for high tiers */}
            {tier >= TrustTier.CERTIFIED && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        border: `2px solid ${tierConfig.color}`,
                        opacity: 0.3,
                        animation: 'trustPulse 2s ease-in-out infinite',
                    }}
                />
            )}

            <style>{`
                @keyframes trustPulse {
                    0%, 100% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(1.05); opacity: 0.1; }
                }
            `}</style>
        </div>
    );
}

/**
 * Compact inline version for agent cards
 */
export function TrustScoreBadge({ score, size = 'small' }: { score: number; size?: 'small' | 'medium' }) {
    const tier = getTierFromScore(score);
    const tierConfig = TIER_CONFIG[tier];
    const isSmall = size === 'small';

    return (
        <div
            className="trust-score-badge"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: isSmall ? 4 : 6,
                padding: isSmall ? '2px 6px' : '4px 10px',
                borderRadius: 999,
                background: `${tierConfig.color}20`,
                border: `1px solid ${tierConfig.color}40`,
            }}
        >
            <span style={{ fontSize: isSmall ? 10 : 12 }}>{TIER_ICONS[tier]}</span>
            <span
                style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: isSmall ? 11 : 13,
                    fontWeight: 600,
                    color: tierConfig.color,
                }}
            >
                {score}
            </span>
        </div>
    );
}

/**
 * Mini sparkline for trend history
 */
export function TrustTrendLine({
    history,
    width = 60,
    height = 20
}: {
    history: number[];
    width?: number;
    height?: number;
}) {
    if (history.length < 2) return null;

    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = max - min || 1;

    const points = history.map((val, i) => {
        const x = (i / (history.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const lastScore = history[history.length - 1];
    const tier = getTierFromScore(lastScore);
    const color = TIER_CONFIG[tier].color;

    return (
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            <circle
                cx={width}
                cy={height - ((lastScore - min) / range) * height}
                r={2}
                fill={color}
            />
        </svg>
    );
}

export default TrustScoreGauge;
