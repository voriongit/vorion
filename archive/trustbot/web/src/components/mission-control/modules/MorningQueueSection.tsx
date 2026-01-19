/**
 * Morning Queue Section
 *
 * Displays overnight decisions requiring operator review.
 * Wraps TaskPipelineModule with morning-specific data fetching and UI.
 *
 * Story 2.2: Morning Queue View
 * FRs: FR10
 */

import { memo, useMemo } from 'react';
import { TaskPipelineModule } from './TaskPipelineModule';
import type { ActionRequest, ActionRequestCounts } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export interface MorningQueuePeriod {
    start: string;
    end: string;
}

export interface MorningQueueResponse {
    queue: ActionRequest[];
    counts: ActionRequestCounts;
    period: MorningQueuePeriod;
}

export interface MorningQueueSectionProps {
    queue?: ActionRequest[];
    counts?: ActionRequestCounts;
    period?: MorningQueuePeriod;
    isLoading?: boolean;
    error?: string | null;
    onDecisionClick?: (decision: ActionRequest) => void;
    onApprove?: (decision: ActionRequest) => void;
    onDeny?: (decision: ActionRequest) => void;
    className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format the overnight period for display
 */
export function formatPeriod(period?: MorningQueuePeriod): string {
    if (!period) return 'Overnight';

    const startDate = new Date(period.start);
    const endDate = new Date(period.end);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    return `${formatDate(startDate)} ${formatTime(startDate)} - ${formatTime(endDate)}`;
}

/**
 * Check if current time is during morning review hours (before 12 PM)
 */
export function isMorningReviewTime(): boolean {
    const now = new Date();
    return now.getHours() < 12;
}

// ============================================================================
// Component
// ============================================================================

export const MorningQueueSection = memo(function MorningQueueSection({
    queue = [],
    counts = { immediate: 0, queued: 0, total: 0 },
    period,
    isLoading = false,
    error = null,
    onDecisionClick,
    onApprove,
    onDeny,
    className = '',
}: MorningQueueSectionProps) {
    const periodLabel = useMemo(() => formatPeriod(period), [period]);
    const showMorningAlert = useMemo(() => isMorningReviewTime() && counts.total > 0, [counts.total]);

    return (
        <div className={`morning-queue-section ${className}`}>
            {/* Morning Alert Banner */}
            {showMorningAlert && (
                <div
                    className="morning-queue-section__alert"
                    role="alert"
                    aria-live="polite"
                >
                    <span className="morning-queue-section__alert-icon" aria-hidden="true">
                        ☀️
                    </span>
                    <span className="morning-queue-section__alert-text">
                        {counts.total} overnight decision{counts.total !== 1 ? 's' : ''} awaiting review
                    </span>
                    {counts.immediate > 0 && (
                        <span className="morning-queue-section__alert-urgent">
                            ({counts.immediate} immediate)
                        </span>
                    )}
                </div>
            )}

            {/* Queue Module */}
            <TaskPipelineModule
                queue={queue}
                counts={counts}
                isLoading={isLoading}
                error={error}
                onDecisionClick={onDecisionClick}
                onApprove={onApprove}
                onDeny={onDeny}
            >
                <TaskPipelineModule.Header title="Morning Queue" />
                <div className="morning-queue-section__period">
                    <span className="morning-queue-section__period-label">Period:</span>
                    <span className="morning-queue-section__period-value">{periodLabel}</span>
                </div>
                <TaskPipelineModule.Filters />
                <TaskPipelineModule.List maxHeight={500} />
                <TaskPipelineModule.Footer />
            </TaskPipelineModule>
        </div>
    );
});

// ============================================================================
// Styles
// ============================================================================

export const morningQueueSectionStyles = `
.morning-queue-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.morning-queue-section__alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    color: #92400e;
}

.morning-queue-section__alert-icon {
    font-size: 20px;
}

.morning-queue-section__alert-text {
    font-weight: 600;
    flex: 1;
}

.morning-queue-section__alert-urgent {
    font-weight: 500;
    color: #dc2626;
    background: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 13px;
}

.morning-queue-section__period {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-surface-alt, #151525);
    font-size: 12px;
}

.morning-queue-section__period-label {
    color: var(--color-muted, #6b7280);
}

.morning-queue-section__period-value {
    color: var(--color-text, #fff);
    font-family: monospace;
}

/* Empty state for after morning hours */
.morning-queue-section--no-items .morning-queue-section__alert {
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    border-color: #10b981;
    color: #065f46;
}
`;

export default MorningQueueSection;
