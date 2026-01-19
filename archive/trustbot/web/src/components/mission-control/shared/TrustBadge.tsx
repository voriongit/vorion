import React from 'react';

/**
 * Trust tier information structure
 */
export interface TierInfo {
    tier: 0 | 1 | 2 | 3 | 4 | 5;
    name: string;
    color: string;
    bgColor: string;
    borderColor: string;
    minScore: number;
    maxScore: number;
    ariaLabel: string;
}

/**
 * Trust tier definitions following the 6-tier authority system
 * T5 (900-1000): SOVEREIGN - Highest authority, gold
 * T4 (700-899): EXECUTIVE - Executive authority, silver
 * T3 (500-699): TACTICAL - Tactical authority, blue
 * T2 (300-499): OPERATIONAL - Operational authority, green
 * T1 (100-299): WORKER - Basic worker, gray
 * T0 (0-99): PASSIVE - Passive/monitoring only, muted
 */
export const TIERS: TierInfo[] = [
    {
        tier: 5,
        name: 'SOVEREIGN',
        color: '#B8860B',
        bgColor: 'rgba(184, 134, 11, 0.15)',
        borderColor: 'rgba(184, 134, 11, 0.5)',
        minScore: 900,
        maxScore: 1000,
        ariaLabel: 'Tier 5 Sovereign: Highest authority level with autonomous decision-making',
    },
    {
        tier: 4,
        name: 'EXECUTIVE',
        color: '#A0A0A0',
        bgColor: 'rgba(192, 192, 192, 0.15)',
        borderColor: 'rgba(192, 192, 192, 0.5)',
        minScore: 700,
        maxScore: 899,
        ariaLabel: 'Tier 4 Executive: High authority with strategic decision capability',
    },
    {
        tier: 3,
        name: 'TACTICAL',
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        minScore: 500,
        maxScore: 699,
        ariaLabel: 'Tier 3 Tactical: Medium authority for tactical operations',
    },
    {
        tier: 2,
        name: 'OPERATIONAL',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.5)',
        minScore: 300,
        maxScore: 499,
        ariaLabel: 'Tier 2 Operational: Standard operational authority',
    },
    {
        tier: 1,
        name: 'WORKER',
        color: '#6B7280',
        bgColor: 'rgba(107, 114, 128, 0.15)',
        borderColor: 'rgba(107, 114, 128, 0.5)',
        minScore: 100,
        maxScore: 299,
        ariaLabel: 'Tier 1 Worker: Basic worker-level authority',
    },
    {
        tier: 0,
        name: 'PASSIVE',
        color: '#9CA3AF',
        bgColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 0.3)',
        minScore: 0,
        maxScore: 99,
        ariaLabel: 'Tier 0 Passive: Monitoring only, no active authority',
    },
];

/**
 * Get tier information from a trust score
 * @param score - Trust score (0-1000)
 * @returns TierInfo for the matching tier
 */
export function getTierFromScore(score: number): TierInfo {
    // Clamp score to valid range
    const clampedScore = Math.max(0, Math.min(1000, score));

    const tier = TIERS.find(t => clampedScore >= t.minScore && clampedScore <= t.maxScore);

    // Fallback to PASSIVE tier if no match (shouldn't happen with valid input)
    return tier ?? TIERS[5];
}

/**
 * Get tier information by tier number
 * @param tierNum - Tier number (0-5)
 * @returns TierInfo for the specified tier
 */
export function getTierByNumber(tierNum: number): TierInfo {
    const tier = TIERS.find(t => t.tier === tierNum);
    return tier ?? TIERS[5];
}

export interface TrustBadgeProps {
    /** Trust score (0-1000) */
    score: number;
    /** Whether to display the numeric score */
    showScore?: boolean;
    /** Whether to display the tier name */
    showTierName?: boolean;
    /** Badge size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Additional CSS class name */
    className?: string;
    /** Test ID for testing */
    testId?: string;
}

const SIZE_STYLES = {
    sm: {
        padding: '2px 6px',
        fontSize: '10px',
        gap: '3px',
        minWidth: '50px',
    },
    md: {
        padding: '4px 8px',
        fontSize: '12px',
        gap: '4px',
        minWidth: '60px',
    },
    lg: {
        padding: '6px 12px',
        fontSize: '14px',
        gap: '6px',
        minWidth: '80px',
    },
};

/**
 * TrustBadge Component
 *
 * Displays an agent's trust score with a visual tier badge.
 * The badge color and name reflect the agent's authority level.
 *
 * @example
 * ```tsx
 * <TrustBadge score={750} />
 * // Displays: "T4 EXECUTIVE 750" with silver badge
 *
 * <TrustBadge score={350} showScore={false} />
 * // Displays: "T2 OPERATIONAL" with green badge
 * ```
 */
export function TrustBadge({
    score,
    showScore = true,
    showTierName = true,
    size = 'md',
    className = '',
    testId = 'trust-badge',
}: TrustBadgeProps): React.ReactElement {
    const tierInfo = getTierFromScore(score);
    const sizeStyles = SIZE_STYLES[size];

    const badgeStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        fontWeight: 600,
        fontFamily: 'monospace',
        color: tierInfo.color,
        backgroundColor: tierInfo.bgColor,
        border: `1px solid ${tierInfo.borderColor}`,
        borderRadius: '4px',
        minWidth: sizeStyles.minWidth,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
    };

    const tierLabelStyle: React.CSSProperties = {
        fontWeight: 700,
    };

    const tierNameStyle: React.CSSProperties = {
        fontWeight: 500,
        opacity: 0.9,
    };

    const scoreStyle: React.CSSProperties = {
        fontWeight: 400,
        opacity: 0.8,
    };

    return (
        <span
            style={badgeStyle}
            className={className}
            data-testid={testId}
            role="status"
            aria-label={tierInfo.ariaLabel}
        >
            <span style={tierLabelStyle} data-testid={`${testId}-tier`}>
                T{tierInfo.tier}
            </span>
            {showTierName && (
                <span style={tierNameStyle} data-testid={`${testId}-name`}>
                    {tierInfo.name}
                </span>
            )}
            {showScore && (
                <span style={scoreStyle} data-testid={`${testId}-score`}>
                    {Math.round(score)}
                </span>
            )}
        </span>
    );
}

export default TrustBadge;
