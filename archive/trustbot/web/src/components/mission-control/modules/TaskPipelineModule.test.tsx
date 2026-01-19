/**
 * TaskPipelineModule Component Tests
 *
 * Story 2.1: Task Pipeline Module - Pending Decisions View
 * FRs: FR7, FR11, FR12, FR13
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TaskPipelineModule, getActionTypeConfig, ACTION_TYPE_LABELS } from './TaskPipelineModule';
import type { ActionRequest, ActionRequestCounts } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockDecisions: ActionRequest[] = [
    {
        id: 'ar-001',
        orgId: 'demo-org',
        agentId: 'agent-1',
        agentName: 'DataProcessor-Alpha',
        actionType: 'data_export',
        status: 'pending',
        urgency: 'immediate',
        queuedReason: 'Bulk data export exceeds 10,000 records',
        trustGateRules: ['high_volume_data', 'low_tier_agent'],
        priority: 10,
        createdAt: '2025-12-23T10:00:00Z',
        updatedAt: '2025-12-23T10:00:00Z',
        timeInQueue: '2h 15m',
    },
    {
        id: 'ar-002',
        orgId: 'demo-org',
        agentId: 'agent-2',
        agentName: 'SecurityAnalyst',
        actionType: 'security_scan',
        status: 'pending',
        urgency: 'immediate',
        queuedReason: 'Production security scan requires approval',
        trustGateRules: ['production_access'],
        priority: 20,
        createdAt: '2025-12-23T11:15:00Z',
        updatedAt: '2025-12-23T11:15:00Z',
        timeInQueue: '45m',
    },
    {
        id: 'ar-003',
        orgId: 'demo-org',
        agentId: 'agent-3',
        agentName: 'ReportGenerator',
        actionType: 'report_generation',
        status: 'pending',
        urgency: 'queued',
        queuedReason: 'Routine report - can wait for normal hours',
        trustGateRules: ['report_generation'],
        priority: 5,
        createdAt: '2025-12-23T04:00:00Z',
        updatedAt: '2025-12-23T04:00:00Z',
        timeInQueue: '8h',
    },
];

const mockCounts: ActionRequestCounts = {
    immediate: 2,
    queued: 1,
    total: 3,
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getActionTypeConfig', () => {
    it('returns correct config for known action types', () => {
        expect(getActionTypeConfig('data_export')).toEqual(ACTION_TYPE_LABELS.data_export);
        expect(getActionTypeConfig('security_scan')).toEqual(ACTION_TYPE_LABELS.security_scan);
        expect(getActionTypeConfig('report_generation')).toEqual(ACTION_TYPE_LABELS.report_generation);
    });

    it('returns default config for unknown action types', () => {
        expect(getActionTypeConfig('unknown_action')).toEqual(ACTION_TYPE_LABELS.default);
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('TaskPipelineModule', () => {
    // ========================================================================
    // Basic Rendering Tests
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders module container', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Header />
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByRole('region', { name: 'Decision Queue' })).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts} className="custom-class">
                    <TaskPipelineModule.Header />
                </TaskPipelineModule>
            );

            const module = screen.getByRole('region');
            expect(module).toHaveClass('task-pipeline-module');
            expect(module).toHaveClass('custom-class');
        });
    });

    // ========================================================================
    // Header Tests
    // ========================================================================

    describe('Header', () => {
        it('renders default title', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Header />
                </TaskPipelineModule>
            );

            expect(screen.getByText('Decision Queue')).toBeInTheDocument();
        });

        it('renders custom title', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Header title="Pending Actions" />
                </TaskPipelineModule>
            );

            expect(screen.getByText('Pending Actions')).toBeInTheDocument();
        });

        it('displays immediate count when > 0', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Header />
                </TaskPipelineModule>
            );

            expect(screen.getByText('2')).toBeInTheDocument();
            expect(screen.getByText('immediate')).toBeInTheDocument();
        });

        it('displays total count', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Header />
                </TaskPipelineModule>
            );

            expect(screen.getByText('3')).toBeInTheDocument();
            expect(screen.getByText('total')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Filters Tests
    // ========================================================================

    describe('Filters', () => {
        it('renders filter buttons', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Filters />
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByRole('button', { name: /All \(3\)/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Immediate \(2\)/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Queued \(1\)/i })).toBeInTheDocument();
        });

        it('filters list when immediate filter clicked', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Filters />
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            // Initially all 3 are shown
            expect(screen.getAllByRole('listitem')).toHaveLength(3);

            // Click immediate filter
            fireEvent.click(screen.getByRole('button', { name: /Immediate/i }));

            // Now only 2 are shown
            expect(screen.getAllByRole('listitem')).toHaveLength(2);
        });

        it('filters list when queued filter clicked', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Filters />
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            fireEvent.click(screen.getByRole('button', { name: /Queued/i }));

            expect(screen.getAllByRole('listitem')).toHaveLength(1);
        });

        it('clears filter when same filter clicked again', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Filters />
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            // Apply filter
            fireEvent.click(screen.getByRole('button', { name: /Immediate/i }));
            expect(screen.getAllByRole('listitem')).toHaveLength(2);

            // Click again to clear
            fireEvent.click(screen.getByRole('button', { name: /Immediate/i }));
            expect(screen.getAllByRole('listitem')).toHaveLength(3);
        });
    });

    // ========================================================================
    // List Tests
    // ========================================================================

    describe('List', () => {
        it('renders all decisions', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getAllByRole('listitem')).toHaveLength(3);
        });

        it('shows empty message when no decisions', () => {
            render(
                <TaskPipelineModule queue={[]} counts={{ immediate: 0, queued: 0, total: 0 }}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByText('No decisions pending')).toBeInTheDocument();
        });

        it('shows loading skeleton when loading with empty queue', () => {
            render(
                <TaskPipelineModule queue={[]} counts={mockCounts} isLoading>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByLabelText('Loading decisions')).toBeInTheDocument();
        });

        it('shows error message when error provided', () => {
            render(
                <TaskPipelineModule queue={[]} counts={mockCounts} error="Failed to load queue">
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load queue');
        });

        it('applies maxHeight style', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List maxHeight={300} />
                </TaskPipelineModule>
            );

            const list = screen.getByRole('list');
            expect(list).toHaveStyle({ maxHeight: '300px' });
        });
    });

    // ========================================================================
    // Item Tests
    // ========================================================================

    describe('Item', () => {
        it('displays urgency badge', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            // Check for immediate badges
            const urgencyBadges = screen.getAllByRole('status');
            expect(urgencyBadges.length).toBeGreaterThan(0);
        });

        it('displays agent name', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByText('DataProcessor-Alpha')).toBeInTheDocument();
            expect(screen.getByText('SecurityAnalyst')).toBeInTheDocument();
        });

        it('displays action type', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByText('Data Export')).toBeInTheDocument();
            expect(screen.getByText('Security Scan')).toBeInTheDocument();
        });

        it('displays time in queue', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByText('2h 15m')).toBeInTheDocument();
            expect(screen.getByText('45m')).toBeInTheDocument();
        });

        it('expands to show details on expand button click', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            // Find first expand button
            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);

            // Should now show the queued reason (FR13)
            expect(screen.getByText('Why queued:')).toBeInTheDocument();
            expect(screen.getByText('Bulk data export exceeds 10,000 records')).toBeInTheDocument();
        });

        it('shows trust gate rules when expanded', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);

            expect(screen.getByText('Trust Gate rules:')).toBeInTheDocument();
            expect(screen.getByText('high volume data')).toBeInTheDocument();
            expect(screen.getByText('low tier agent')).toBeInTheDocument();
        });

        it('collapses on second expand button click', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);
            expect(screen.getByText('Why queued:')).toBeInTheDocument();

            // Find collapse button and click it
            const collapseButton = screen.getByLabelText('Collapse details');
            fireEvent.click(collapseButton);

            expect(screen.queryByText('Why queued:')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Callback Tests
    // ========================================================================

    describe('Callbacks', () => {
        it('calls onDecisionClick when item clicked', () => {
            const handleClick = vi.fn();

            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts} onDecisionClick={handleClick}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            // When onDecisionClick is provided, items become buttons
            // Find item by agent name and click the main container
            const firstItem = screen.getByText('DataProcessor-Alpha').closest('li');
            expect(firstItem).toBeInTheDocument();
            fireEvent.click(firstItem!);

            expect(handleClick).toHaveBeenCalledWith(mockDecisions[0]);
        });

        it('shows action buttons when onApprove/onDeny provided', () => {
            const handleApprove = vi.fn();
            const handleDeny = vi.fn();

            render(
                <TaskPipelineModule
                    queue={mockDecisions}
                    counts={mockCounts}
                    onApprove={handleApprove}
                    onDeny={handleDeny}
                >
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            // Expand first item
            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);

            expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Deny' })).toBeInTheDocument();
        });

        it('calls onApprove when approve button clicked', () => {
            const handleApprove = vi.fn();

            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts} onApprove={handleApprove}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);

            fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
            expect(handleApprove).toHaveBeenCalledWith(mockDecisions[0]);
        });

        it('calls onDeny when deny button clicked', () => {
            const handleDeny = vi.fn();

            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts} onDeny={handleDeny}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);

            fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
            expect(handleDeny).toHaveBeenCalledWith(mockDecisions[0]);
        });
    });

    // ========================================================================
    // Footer Tests
    // ========================================================================

    describe('Footer', () => {
        it('renders urgent count message when immediate > 0', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Footer />
                </TaskPipelineModule>
            );

            expect(screen.getByText('2 require immediate attention')).toBeInTheDocument();
        });

        it('renders custom footer content', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Footer>
                        <span>Custom footer content</span>
                    </TaskPipelineModule.Footer>
                </TaskPipelineModule>
            );

            expect(screen.getByText('Custom footer content')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility Tests
    // ========================================================================

    describe('Accessibility', () => {
        it('has proper ARIA region label', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Header />
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByRole('region', { name: 'Decision Queue' })).toBeInTheDocument();
        });

        it('list has proper ARIA label', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            expect(screen.getByRole('list', { name: 'Pending decisions' })).toBeInTheDocument();
        });

        it('filter buttons have aria-pressed attribute', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.Filters />
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            const allButton = screen.getByRole('button', { name: /All/i });
            expect(allButton).toHaveAttribute('aria-pressed', 'true');

            const immediateButton = screen.getByRole('button', { name: /Immediate/i });
            expect(immediateButton).toHaveAttribute('aria-pressed', 'false');
        });

        it('items have aria-expanded attribute', () => {
            render(
                <TaskPipelineModule queue={mockDecisions} counts={mockCounts}>
                    <TaskPipelineModule.List />
                </TaskPipelineModule>
            );

            const items = screen.getAllByRole('listitem');
            expect(items[0]).toHaveAttribute('aria-expanded', 'false');

            // Expand
            const expandButtons = screen.getAllByLabelText('Expand details');
            fireEvent.click(expandButtons[0]);

            expect(items[0]).toHaveAttribute('aria-expanded', 'true');
        });
    });

    // ========================================================================
    // Compound Component Context Tests
    // ========================================================================

    describe('Compound Component Context', () => {
        it('throws error when using sub-components outside context', () => {
            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => {
                render(<TaskPipelineModule.Header />);
            }).toThrow('TaskPipelineModule compound components must be used within TaskPipelineModule');

            consoleSpy.mockRestore();
        });
    });
});
