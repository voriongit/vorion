/**
 * Progress Bar Component
 *
 * A reusable progress bar for showing execution progress.
 *
 * Story 2.7: Task Execution Progress View
 * FRs: FR8, FR9
 */

import { memo, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ProgressBarStatus = 'executing' | 'completed' | 'failed' | 'cancelled';
export type ProgressBarSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
    progress: number; // 0-100
    status?: ProgressBarStatus;
    size?: ProgressBarSize;
    showLabel?: boolean;
    showPercentage?: boolean;
    label?: string;
    animated?: boolean;
    className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

export function getStatusColor(status: ProgressBarStatus): string {
    switch (status) {
        case 'executing':
            return 'var(--color-primary, #3b82f6)';
        case 'completed':
            return 'var(--color-success, #10b981)';
        case 'failed':
            return 'var(--color-error, #ef4444)';
        case 'cancelled':
            return 'var(--color-muted, #6b7280)';
        default:
            return 'var(--color-primary, #3b82f6)';
    }
}

export function getSizeConfig(size: ProgressBarSize) {
    switch (size) {
        case 'sm':
            return { height: 4, fontSize: 10 };
        case 'lg':
            return { height: 12, fontSize: 14 };
        case 'md':
        default:
            return { height: 8, fontSize: 12 };
    }
}

// ============================================================================
// Component
// ============================================================================

export const ProgressBar = memo(function ProgressBar({
    progress,
    status = 'executing',
    size = 'md',
    showLabel = false,
    showPercentage = true,
    label,
    animated = true,
    className = '',
}: ProgressBarProps) {
    const normalizedProgress = useMemo(
        () => Math.min(100, Math.max(0, progress)),
        [progress]
    );

    const color = useMemo(() => getStatusColor(status), [status]);
    const sizeConfig = useMemo(() => getSizeConfig(size), [size]);

    const isAnimated = animated && status === 'executing' && normalizedProgress < 100;

    return (
        <div
            className={`progress-bar ${className}`}
            role="progressbar"
            aria-valuenow={normalizedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label || `Progress: ${normalizedProgress}%`}
        >
            {(showLabel && label) && (
                <div className="progress-bar__label" style={{ fontSize: sizeConfig.fontSize }}>
                    {label}
                </div>
            )}
            <div className="progress-bar__container">
                <div
                    className="progress-bar__track"
                    style={{ height: sizeConfig.height }}
                >
                    <div
                        className={`progress-bar__fill ${isAnimated ? 'progress-bar__fill--animated' : ''}`}
                        style={{
                            width: `${normalizedProgress}%`,
                            backgroundColor: color,
                        }}
                    />
                </div>
                {showPercentage && (
                    <span
                        className="progress-bar__percentage"
                        style={{ fontSize: sizeConfig.fontSize }}
                    >
                        {normalizedProgress}%
                    </span>
                )}
            </div>
        </div>
    );
});

// ============================================================================
// Styles
// ============================================================================

export const progressBarStyles = `
.progress-bar {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
}

.progress-bar__label {
    color: var(--color-muted, #6b7280);
    font-weight: 500;
}

.progress-bar__container {
    display: flex;
    align-items: center;
    gap: 8px;
}

.progress-bar__track {
    flex: 1;
    background: var(--color-surface-alt, #151525);
    border-radius: 4px;
    overflow: hidden;
}

.progress-bar__fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
}

.progress-bar__fill--animated {
    background-image: linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.15) 25%,
        transparent 25%,
        transparent 50%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 255, 255, 0.15) 75%,
        transparent 75%,
        transparent
    );
    background-size: 20px 20px;
    animation: progress-bar-stripes 1s linear infinite;
}

@keyframes progress-bar-stripes {
    from {
        background-position: 20px 0;
    }
    to {
        background-position: 0 0;
    }
}

.progress-bar__percentage {
    color: var(--color-text, #fff);
    font-weight: 600;
    min-width: 36px;
    text-align: right;
}
`;

export default ProgressBar;
