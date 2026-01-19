/**
 * MorningQueueSection Component Tests
 *
 * Story 2.2: Morning Queue View
 * FRs: FR10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    MorningQueueSection,
    formatPeriod,
    isMorningReviewTime,
} from './MorningQueueSection';
import type { ActionRequest, ActionRequestCounts } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockQueue: ActionRequest[] = [
    {
        id: 'ar-001',
        orgId: 'demo-org',
        agentId: 'agent-1',
        agentName: 'DataProcessor-Alpha',
        actionType: 'data_export',
        status: 'pending',
        urgency: 'queued',
        queuedReason: 'Overnight batch processing',
        trustGateRules: ['overnight_queue'],
        priority: 5,
        createdAt: '2025-12-23T02:30:00Z',
        updatedAt: '2025-12-23T02:30:00Z',
        timeInQueue: '6h 30m',
    },
    {
        id: 'ar-002',
        orgId: 'demo-org',
        agentId: 'agent-2',
        agentName: 'ReportGenerator',
        actionType: 'report_generation',
        status: 'pending',
        urgency: 'immediate',
        queuedReason: 'Critical overnight report',
        trustGateRules: ['high_priority'],
        priority: 10,
        createdAt: '2025-12-23T01:00:00Z',
        updatedAt: '2025-12-23T01:00:00Z',
        timeInQueue: '8h',
    },
];

const mockCounts: ActionRequestCounts = {
    immediate: 1,
    queued: 1,
    total: 2,
};

const mockPeriod = {
    start: '2025-12-22T18:00:00Z',
    end: '2025-12-23T08:00:00Z',
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('formatPeriod', () => {
    it('returns "Overnight" when no period provided', () => {
        expect(formatPeriod(undefined)).toBe('Overnight');
    });

    it('formats period with date and times', () => {
        const result = formatPeriod(mockPeriod);
        // Should contain the date and times
        expect(result).toContain('Dec');
        expect(result).toContain('PM');
        expect(result).toContain('AM');
    });

    it('handles same-day periods', () => {
        const sameDayPeriod = {
            start: '2025-12-23T18:00:00Z',
            end: '2025-12-24T08:00:00Z',
        };
        const result = formatPeriod(sameDayPeriod);
        expect(result).toBeTruthy();
    });
});

describe('isMorningReviewTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns true before 12 PM', () => {
        vi.setSystemTime(new Date('2025-12-23T09:00:00'));
        expect(isMorningReviewTime()).toBe(true);

        vi.setSystemTime(new Date('2025-12-23T11:59:00'));
        expect(isMorningReviewTime()).toBe(true);
    });

    it('returns false at 12 PM and after', () => {
        vi.setSystemTime(new Date('2025-12-23T12:00:00'));
        expect(isMorningReviewTime()).toBe(false);

        vi.setSystemTime(new Date('2025-12-23T15:00:00'));
        expect(isMorningReviewTime()).toBe(false);
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('MorningQueueSection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Set time to 9 AM for morning review tests
        vi.setSystemTime(new Date('2025-12-23T09:00:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ========================================================================
    // Basic Rendering Tests
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders with queue data', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            expect(screen.getByText('Morning Queue')).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    className="custom-class"
                />
            );

            const section = container.querySelector('.morning-queue-section');
            expect(section).toHaveClass('custom-class');
        });
    });

    // ========================================================================
    // Morning Alert Banner Tests
    // ========================================================================

    describe('Morning Alert Banner', () => {
        it('shows alert during morning hours with pending items', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/2 overnight decisions awaiting review/i)).toBeInTheDocument();
        });

        it('shows immediate count in alert when immediate items exist', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            expect(screen.getByText('(1 immediate)')).toBeInTheDocument();
        });

        it('hides alert when no pending items', () => {
            render(
                <MorningQueueSection
                    queue={[]}
                    counts={{ immediate: 0, queued: 0, total: 0 }}
                    period={mockPeriod}
                />
            );

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('hides alert after morning hours', () => {
            vi.setSystemTime(new Date('2025-12-23T14:00:00'));

            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('uses singular form for 1 decision', () => {
            const singleCount = { immediate: 0, queued: 1, total: 1 };
            render(
                <MorningQueueSection
                    queue={[mockQueue[0]]}
                    counts={singleCount}
                    period={mockPeriod}
                />
            );

            expect(screen.getByText(/1 overnight decision awaiting review/i)).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Period Display Tests
    // ========================================================================

    describe('Period Display', () => {
        it('displays the period label', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            expect(screen.getByText('Period:')).toBeInTheDocument();
        });

        it('displays "Overnight" when no period provided', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                />
            );

            expect(screen.getByText('Overnight')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Queue List Tests
    // ========================================================================

    describe('Queue List', () => {
        it('displays queue items', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            expect(screen.getByText('DataProcessor-Alpha')).toBeInTheDocument();
            expect(screen.getByText('ReportGenerator')).toBeInTheDocument();
        });

        it('shows empty message when queue is empty', () => {
            render(
                <MorningQueueSection
                    queue={[]}
                    counts={{ immediate: 0, queued: 0, total: 0 }}
                    period={mockPeriod}
                />
            );

            expect(screen.getByText('No decisions pending')).toBeInTheDocument();
        });

        it('shows loading state', () => {
            render(
                <MorningQueueSection
                    queue={[]}
                    counts={mockCounts}
                    isLoading={true}
                    period={mockPeriod}
                />
            );

            expect(screen.getByLabelText('Loading decisions')).toBeInTheDocument();
        });

        it('shows error state', () => {
            // Set time to afternoon so morning alert doesn't show
            vi.setSystemTime(new Date('2025-12-23T14:00:00'));

            render(
                <MorningQueueSection
                    queue={[]}
                    counts={{ immediate: 0, queued: 0, total: 0 }}
                    error="Failed to load morning queue"
                    period={mockPeriod}
                />
            );

            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load morning queue');
        });
    });

    // ========================================================================
    // Filter Tests
    // ========================================================================

    describe('Filters', () => {
        it('renders urgency filters', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Immediate/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Queued/i })).toBeInTheDocument();
        });

        it('filters queue when filter clicked', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            // Initially 2 items
            expect(screen.getAllByRole('listitem')).toHaveLength(2);

            // Filter to queued only
            fireEvent.click(screen.getByRole('button', { name: /Queued/i }));
            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });
    });

    // ========================================================================
    // Callback Tests
    // ========================================================================

    describe('Callbacks', () => {
        it('calls onDecisionClick when item clicked', () => {
            const handleClick = vi.fn();

            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                    onDecisionClick={handleClick}
                />
            );

            const firstItem = screen.getByText('DataProcessor-Alpha').closest('li');
            fireEvent.click(firstItem!);

            expect(handleClick).toHaveBeenCalled();
        });

        it('calls onApprove when approve button clicked', () => {
            const handleApprove = vi.fn();

            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                    onApprove={handleApprove}
                />
            );

            // Expand first item
            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);

            fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
            expect(handleApprove).toHaveBeenCalled();
        });

        it('calls onDeny when deny button clicked', () => {
            const handleDeny = vi.fn();

            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                    onDeny={handleDeny}
                />
            );

            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);

            fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
            expect(handleDeny).toHaveBeenCalled();
        });
    });

    // ========================================================================
    // Footer Tests
    // ========================================================================

    describe('Footer', () => {
        it('shows urgent count in footer when immediate > 0', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            expect(screen.getByText('1 require immediate attention')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility Tests
    // ========================================================================

    describe('Accessibility', () => {
        it('alert has role="alert"', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            const alerts = screen.getAllByRole('alert');
            // At least one alert for the morning banner
            expect(alerts.length).toBeGreaterThan(0);
        });

        it('morning alert has aria-live', () => {
            render(
                <MorningQueueSection
                    queue={mockQueue}
                    counts={mockCounts}
                    period={mockPeriod}
                />
            );

            const morningAlert = screen.getByText(/overnight decisions awaiting review/i).closest('[role="alert"]');
            expect(morningAlert).toHaveAttribute('aria-live', 'polite');
        });
    });
});
