import React from 'react';

/**
 * Trend direction type
 */
export type TrendDirection = 'rising' | 'stable' | 'falling';

/**
 * Trend data structure with direction and percentage change
 */
export interface TrendData {
    direction: TrendDirection;
    percentChange: number;
}

/**
 * Calculate trend direction from percentage change
 * Rising: > 5% increase
 * Falling: > 5% decrease
 * Stable: within 5%
 *
 * @param percentChange - Percentage change (e.g., 10 for 10% increase)
 * @returns TrendDirection
 */
export function calculateTrendDirection(percentChange: number): TrendDirection {
    if (percentChange > 5) return 'rising';
    if (percentChange < -5) return 'falling';
    return 'stable';
}

/**
 * Calculate trend from 7-day score history
 *
 * @param history - Array of trust scores (oldest first)
 * @returns TrendData with direction and percentage change
 */
export function calculateTrendFromHistory(history: number[]): TrendData {
    if (history.length < 2) {
        return { direction: 'stable', percentChange: 0 };
    }

    const oldScore = history[0];
    const newScore = history[history.length - 1];

    if (oldScore === 0) {
        // Avoid division by zero
        return {
            direction: newScore > 0 ? 'rising' : 'stable',
            percentChange: newScore > 0 ? 100 : 0,
        };
    }

    const percentChange = ((newScore - oldScore) / oldScore) * 100;
    const direction = calculateTrendDirection(percentChange);

    return { direction, percentChange };
}

/**
 * Trend configuration for styling and accessibility
 */
export const TREND_CONFIG: Record<
    TrendDirection,
    {
        icon: string;
        color: string;
        bgColor: string;
        label: string;
        ariaLabel: string;
    }
> = {
    rising: {
        icon: '↑',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        label: 'Rising',
        ariaLabel: 'Trust score is trending upward',
    },
    stable: {
        icon: '→',
        color: '#6B7280',
        bgColor: 'rgba(107, 114, 128, 0.1)',
        label: 'Stable',
        ariaLabel: 'Trust score is stable',
    },
    falling: {
        icon: '↓',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        label: 'Falling',
        ariaLabel: 'Trust score is trending downward',
    },
};

export interface TrendIndicatorProps {
    /** Trend direction */
    trend: TrendDirection;
    /** Percentage change (optional) */
    percentChange?: number;
    /** Whether to show percentage value */
    showPercentage?: boolean;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Additional CSS class name */
    className?: string;
    /** Test ID for testing */
    testId?: string;
}

const SIZE_STYLES = {
    sm: {
        fontSize: '10px',
        padding: '2px 4px',
        iconSize: '10px',
        gap: '2px',
    },
    md: {
        fontSize: '12px',
        padding: '2px 6px',
        iconSize: '12px',
        gap: '3px',
    },
    lg: {
        fontSize: '14px',
        padding: '4px 8px',
        iconSize: '14px',
        gap: '4px',
    },
};

/**
 * TrendIndicator Component
 *
 * Displays a visual indicator for trust score trend direction
 * with optional percentage change display.
 *
 * @example
 * ```tsx
 * <TrendIndicator trend="rising" percentChange={12.5} showPercentage />
 * // Displays: "↑ +12.5%"
 *
 * <TrendIndicator trend="falling" />
 * // Displays: "↓" (no percentage)
 * ```
 */
export function TrendIndicator({
    trend,
    percentChange,
    showPercentage = false,
    size = 'md',
    className = '',
    testId = 'trend-indicator',
}: TrendIndicatorProps): React.ReactElement {
    const config = TREND_CONFIG[trend];
    const sizeStyles = SIZE_STYLES[size];

    const containerStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        fontWeight: 600,
        fontFamily: 'monospace',
        color: config.color,
        backgroundColor: config.bgColor,
        borderRadius: '4px',
        whiteSpace: 'nowrap',
    };

    const iconStyle: React.CSSProperties = {
        fontSize: sizeStyles.iconSize,
        lineHeight: 1,
    };

    const percentageStyle: React.CSSProperties = {
        fontWeight: 500,
    };

    // Format percentage change
    const formatPercentage = (value: number): string => {
        const absValue = Math.abs(value);
        const formattedValue = absValue.toFixed(1);
        const sign = value > 0 ? '+' : value < 0 ? '-' : '';
        return `${sign}${formattedValue}%`;
    };

    return (
        <span
            style={containerStyle}
            className={className}
            data-testid={testId}
            role="status"
            aria-label={
                showPercentage && percentChange !== undefined
                    ? `${config.ariaLabel} by ${Math.abs(percentChange).toFixed(1)} percent`
                    : config.ariaLabel
            }
        >
            <span style={iconStyle} data-testid={`${testId}-icon`} aria-hidden="true">
                {config.icon}
            </span>
            {showPercentage && percentChange !== undefined && (
                <span style={percentageStyle} data-testid={`${testId}-percentage`}>
                    {formatPercentage(percentChange)}
                </span>
            )}
        </span>
    );
}

export default TrendIndicator;
