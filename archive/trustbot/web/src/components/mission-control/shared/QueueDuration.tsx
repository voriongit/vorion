/**
 * Queue Duration Component
 *
 * Displays time-in-queue duration for action requests.
 * Shows formatted duration with visual indicators for long waits.
 *
 * Story 2.1: Task Pipeline Module - Pending Decisions View
 * FRs: FR12 (Time-in-queue duration)
 */

import { memo, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface QueueDurationProps {
    /** Pre-formatted duration string (e.g., "2h 15m") */
    duration?: string;
    /** Alternatively, provide createdAt timestamp for calculation */
    createdAt?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Show icon prefix */
    showIcon?: boolean;
    /** Custom class name */
    className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate duration from timestamp
 */
export function formatDuration(createdAt: string): string {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours === 0) {
        return `${diffMins}m`;
    }
    if (diffHours >= 24) {
        const days = Math.floor(diffHours / 24);
        const remainingHours = diffHours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
    return `${diffHours}h ${remainingMins}m`;
}

/**
 * Parse duration string to get approximate minutes
 */
export function parseDurationToMinutes(duration: string): number {
    let totalMinutes = 0;

    // Match patterns like "2h", "15m", "2h 15m", "1d 5h"
    const dayMatch = duration.match(/(\d+)d/);
    const hourMatch = duration.match(/(\d+)h/);
    const minMatch = duration.match(/(\d+)m/);

    if (dayMatch) {
        totalMinutes += parseInt(dayMatch[1], 10) * 24 * 60;
    }
    if (hourMatch) {
        totalMinutes += parseInt(hourMatch[1], 10) * 60;
    }
    if (minMatch) {
        totalMinutes += parseInt(minMatch[1], 10);
    }

    return totalMinutes;
}

/**
 * Get urgency level based on wait time
 */
export function getDurationUrgency(minutes: number): 'normal' | 'warning' | 'critical' {
    if (minutes >= 480) return 'critical';  // 8+ hours
    if (minutes >= 120) return 'warning';   // 2+ hours
    return 'normal';
}

// ============================================================================
// Component
// ============================================================================

export const QueueDuration = memo(function QueueDuration({
    duration,
    createdAt,
    size = 'md',
    showIcon = true,
    className = '',
}: QueueDurationProps) {
    const displayDuration = useMemo(() => {
        if (duration) return duration;
        if (createdAt) return formatDuration(createdAt);
        return '0m';
    }, [duration, createdAt]);

    const urgencyLevel = useMemo(() => {
        const minutes = parseDurationToMinutes(displayDuration);
        return getDurationUrgency(minutes);
    }, [displayDuration]);

    const sizeClasses = {
        sm: 'queue-duration--sm',
        md: 'queue-duration--md',
        lg: 'queue-duration--lg',
    };

    const urgencyClasses = {
        normal: 'queue-duration--normal',
        warning: 'queue-duration--warning',
        critical: 'queue-duration--critical',
    };

    return (
        <span
            className={`queue-duration ${sizeClasses[size]} ${urgencyClasses[urgencyLevel]} ${className}`}
            role="timer"
            aria-label={`Time in queue: ${displayDuration}`}
        >
            {showIcon && (
                <span className="queue-duration__icon" aria-hidden="true">
                    {/* Clock icon */}
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="queue-duration__svg"
                    >
                        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8 4v4l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </span>
            )}
            <span className="queue-duration__value">{displayDuration}</span>
        </span>
    );
});

// ============================================================================
// Styles
// ============================================================================

export const queueDurationStyles = `
.queue-duration {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: monospace;
    white-space: nowrap;
}

.queue-duration--sm {
    font-size: 11px;
}

.queue-duration--md {
    font-size: 12px;
}

.queue-duration--lg {
    font-size: 14px;
}

.queue-duration--normal {
    color: var(--color-muted, #6b7280);
}

.queue-duration--warning {
    color: var(--color-warning, #f59e0b);
}

.queue-duration--critical {
    color: var(--color-error, #ef4444);
    font-weight: 600;
}

.queue-duration__icon {
    display: flex;
    align-items: center;
    justify-content: center;
}

.queue-duration__svg {
    width: 1em;
    height: 1em;
}

.queue-duration__value {
    font-weight: 500;
}

/* Animation for critical items */
.queue-duration--critical .queue-duration__icon {
    animation: clock-pulse 1.5s ease-in-out infinite;
}

@keyframes clock-pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.6;
    }
}
`;

export default QueueDuration;
