/**
 * Urgency Badge Component
 *
 * Displays urgency level for action requests.
 * Shows IMMEDIATE (red) or QUEUED (yellow) with appropriate styling.
 *
 * Story 2.1: Task Pipeline Module - Pending Decisions View
 * FRs: FR11 (Urgency indicators)
 */

import { memo } from 'react';
import type { ActionRequestUrgency } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export interface UrgencyBadgeProps {
    urgency: ActionRequestUrgency;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

// ============================================================================
// Configuration
// ============================================================================

export interface UrgencyConfig {
    label: string;
    shortLabel: string;
    color: string;
    backgroundColor: string;
    icon: string;
    ariaLabel: string;
}

export const URGENCY_CONFIG: Record<ActionRequestUrgency, UrgencyConfig> = {
    immediate: {
        label: 'IMMEDIATE',
        shortLabel: 'IMM',
        color: '#ffffff',
        backgroundColor: '#dc2626',
        icon: '!',
        ariaLabel: 'Immediate attention required',
    },
    queued: {
        label: 'QUEUED',
        shortLabel: 'Q',
        color: '#000000',
        backgroundColor: '#fbbf24',
        icon: '~',
        ariaLabel: 'Queued for review',
    },
};

// ============================================================================
// Component
// ============================================================================

export const UrgencyBadge = memo(function UrgencyBadge({
    urgency,
    size = 'md',
    showLabel = true,
    className = '',
}: UrgencyBadgeProps) {
    const config = URGENCY_CONFIG[urgency];

    const sizeClasses = {
        sm: 'urgency-badge--sm',
        md: 'urgency-badge--md',
        lg: 'urgency-badge--lg',
    };

    return (
        <span
            className={`urgency-badge ${sizeClasses[size]} ${className}`}
            style={{
                color: config.color,
                backgroundColor: config.backgroundColor,
            }}
            role="status"
            aria-label={config.ariaLabel}
        >
            <span className="urgency-badge__icon" aria-hidden="true">
                {config.icon}
            </span>
            {showLabel && (
                <span className="urgency-badge__label">
                    {size === 'sm' ? config.shortLabel : config.label}
                </span>
            )}
        </span>
    );
});

// ============================================================================
// Styles
// ============================================================================

export const urgencyBadgeStyles = `
.urgency-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
}

.urgency-badge--sm {
    font-size: 10px;
    padding: 2px 6px;
}

.urgency-badge--md {
    font-size: 11px;
    padding: 3px 8px;
}

.urgency-badge--lg {
    font-size: 12px;
    padding: 4px 10px;
}

.urgency-badge__icon {
    font-weight: 700;
}

.urgency-badge__label {
    font-family: system-ui, -apple-system, sans-serif;
}

/* Animation for immediate urgency */
.urgency-badge[style*="dc2626"] {
    animation: urgency-pulse 2s ease-in-out infinite;
}

@keyframes urgency-pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.85;
    }
}
`;

export default UrgencyBadge;
