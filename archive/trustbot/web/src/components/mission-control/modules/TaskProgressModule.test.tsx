/**
 * TaskProgressModule Component Tests
 *
 * Story 2.7: Task Execution Progress View
 * FRs: FR8, FR9
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    TaskProgressModule,
    getStatusLabel,
    getStatusColor,
    getStatusIcon,
    formatDuration,
    formatEstimatedTime,
} from './TaskProgressModule';
import type { ExecutingTask, ExecutingTaskCounts } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockExecutingTask: ExecutingTask = {
    id: 'task-001',
    decisionId: 'ar-001',
    agentId: 'worker-1',
    agentName: 'DataProcessor-Alpha',
    actionType: 'data_export',
    status: 'executing',
    progress: 65,
    startedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    estimatedCompletion: new Date(Date.now() + 600000).toISOString(), // 10 minutes from now
    currentStep: 'Processing records 6500 of 10000',
};

const mockCompletedTask: ExecutingTask = {
    id: 'task-002',
    decisionId: 'ar-002',
    agentId: 'worker-2',
    agentName: 'ReportGenerator-Beta',
    actionType: 'report_generation',
    status: 'completed',
    progress: 100,
    startedAt: new Date(Date.now() - 900000).toISOString(),
    completedAt: new Date(Date.now() - 300000).toISOString(),
    duration: '10m 0s',
};

const mockFailedTask: ExecutingTask = {
    id: 'task-003',
    decisionId: 'ar-003',
    agentId: 'worker-3',
    agentName: 'SecurityScanner-Gamma',
    actionType: 'security_scan',
    status: 'failed',
    progress: 45,
    startedAt: new Date(Date.now() - 600000).toISOString(),
    error: 'Connection timeout to security service',
};

const mockTasks: ExecutingTask[] = [mockExecutingTask, mockCompletedTask, mockFailedTask];

const mockCounts: ExecutingTaskCounts = {
    executing: 1,
    completed: 1,
    failed: 1,
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getStatusLabel', () => {
    it('returns correct labels', () => {
        expect(getStatusLabel('executing')).toBe('Executing');
        expect(getStatusLabel('completed')).toBe('Completed');
        expect(getStatusLabel('failed')).toBe('Failed');
        expect(getStatusLabel('cancelled')).toBe('Cancelled');
    });
});

describe('getStatusColor', () => {
    it('returns primary color for executing', () => {
        expect(getStatusColor('executing')).toContain('3b82f6');
    });

    it('returns success color for completed', () => {
        expect(getStatusColor('completed')).toContain('10b981');
    });

    it('returns error color for failed', () => {
        expect(getStatusColor('failed')).toContain('ef4444');
    });

    it('returns muted color for cancelled', () => {
        expect(getStatusColor('cancelled')).toContain('6b7280');
    });
});

describe('getStatusIcon', () => {
    it('returns correct icons', () => {
        expect(getStatusIcon('executing')).toBe('⏳');
        expect(getStatusIcon('completed')).toBe('✅');
        expect(getStatusIcon('failed')).toBe('❌');
        expect(getStatusIcon('cancelled')).toBe('⏹️');
    });
});

describe('formatDuration', () => {
    it('formats duration in seconds', () => {
        const start = new Date(Date.now() - 30000).toISOString();
        const duration = formatDuration(start);
        expect(duration).toMatch(/^\d+s$/);
    });

    it('formats duration in minutes and seconds', () => {
        const start = new Date(Date.now() - 90000).toISOString();
        const duration = formatDuration(start);
        expect(duration).toMatch(/^\d+m \d+s$/);
    });

    it('formats duration with completed time', () => {
        const start = new Date(Date.now() - 600000).toISOString();
        const end = new Date(Date.now() - 300000).toISOString();
        const duration = formatDuration(start, end);
        expect(duration).toBe('5m 0s');
    });
});

describe('formatEstimatedTime', () => {
    it('returns "Unknown" when no estimate provided', () => {
        expect(formatEstimatedTime(undefined)).toBe('Unknown');
    });

    it('returns "Any moment" when estimate is in the past', () => {
        const pastDate = new Date(Date.now() - 1000).toISOString();
        expect(formatEstimatedTime(pastDate)).toBe('Any moment');
    });

    it('formats future estimate in minutes', () => {
        const futureDate = new Date(Date.now() + 300000).toISOString();
        const result = formatEstimatedTime(futureDate);
        expect(result).toMatch(/^~\d+m$/);
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('TaskProgressModule', () => {
    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders with tasks', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Header />
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByRole('region', { name: 'Task Progress' })).toBeInTheDocument();
        });

        it('renders header with title', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Header title="Execution Monitor" />
                </TaskProgressModule>
            );

            expect(screen.getByText('Execution Monitor')).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts} className="custom-class">
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(container.querySelector('.task-progress-module')).toHaveClass('custom-class');
        });
    });

    // ========================================================================
    // Header Component
    // ========================================================================

    describe('Header Component', () => {
        it('displays count badges', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Header />
                </TaskProgressModule>
            );

            // All counts are 1, so multiple elements with "1" exist
            expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('executing')).toBeInTheDocument();
            expect(screen.getByText('completed')).toBeInTheDocument();
            expect(screen.getByText('failed')).toBeInTheDocument();
        });

        it('hides zero counts for executing and failed', () => {
            render(
                <TaskProgressModule
                    tasks={[mockCompletedTask]}
                    counts={{ executing: 0, completed: 1, failed: 0 }}
                >
                    <TaskProgressModule.Header />
                </TaskProgressModule>
            );

            expect(screen.queryByText('executing')).not.toBeInTheDocument();
            expect(screen.queryByText('failed')).not.toBeInTheDocument();
            expect(screen.getByText('completed')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Filters Component
    // ========================================================================

    describe('Filters Component', () => {
        it('renders all filter buttons', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Filters />
                </TaskProgressModule>
            );

            expect(screen.getByText(/All/)).toBeInTheDocument();
            expect(screen.getByText(/Executing/)).toBeInTheDocument();
            expect(screen.getByText(/Completed/)).toBeInTheDocument();
            expect(screen.getByText(/Failed/)).toBeInTheDocument();
        });

        it('shows counts in filter buttons', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Filters />
                </TaskProgressModule>
            );

            expect(screen.getByText('All (3)')).toBeInTheDocument();
            expect(screen.getByText('Executing (1)')).toBeInTheDocument();
            expect(screen.getByText('Completed (1)')).toBeInTheDocument();
            expect(screen.getByText('Failed (1)')).toBeInTheDocument();
        });

        it('filters tasks when clicking filter button', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Filters />
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            // Initially shows all tasks
            expect(screen.getByText('DataProcessor-Alpha')).toBeInTheDocument();
            expect(screen.getByText('ReportGenerator-Beta')).toBeInTheDocument();
            expect(screen.getByText('SecurityScanner-Gamma')).toBeInTheDocument();

            // Click executing filter
            fireEvent.click(screen.getByText('Executing (1)'));

            // Should only show executing task
            expect(screen.getByText('DataProcessor-Alpha')).toBeInTheDocument();
            expect(screen.queryByText('ReportGenerator-Beta')).not.toBeInTheDocument();
            expect(screen.queryByText('SecurityScanner-Gamma')).not.toBeInTheDocument();
        });

        it('resets to all when clicking active filter', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Filters />
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            // Click executing filter
            fireEvent.click(screen.getByText('Executing (1)'));
            expect(screen.queryByText('ReportGenerator-Beta')).not.toBeInTheDocument();

            // Click executing filter again to reset
            fireEvent.click(screen.getByText('Executing (1)'));
            expect(screen.getByText('ReportGenerator-Beta')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // List Component
    // ========================================================================

    describe('List Component', () => {
        it('renders task items', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByText('DataProcessor-Alpha')).toBeInTheDocument();
            expect(screen.getByText('ReportGenerator-Beta')).toBeInTheDocument();
            expect(screen.getByText('SecurityScanner-Gamma')).toBeInTheDocument();
        });

        it('shows loading skeleton when loading', () => {
            render(
                <TaskProgressModule tasks={[]} counts={mockCounts} isLoading={true}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByLabelText('Loading tasks')).toBeInTheDocument();
        });

        it('shows error message when error occurs', () => {
            render(
                <TaskProgressModule tasks={[]} counts={mockCounts} error="Failed to load tasks">
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load tasks');
        });

        it('shows empty message when no tasks', () => {
            render(
                <TaskProgressModule tasks={[]} counts={{ executing: 0, completed: 0, failed: 0 }}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByText('No tasks to display')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Item Component
    // ========================================================================

    describe('Item Component', () => {
        it('displays task information', () => {
            render(
                <TaskProgressModule tasks={[mockExecutingTask]} counts={mockCounts}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByText('DataProcessor-Alpha')).toBeInTheDocument();
            expect(screen.getByText('Data Export')).toBeInTheDocument();
            expect(screen.getByText('65%')).toBeInTheDocument();
        });

        it('shows status icons', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByText('⏳')).toBeInTheDocument(); // Executing
            expect(screen.getByText('✅')).toBeInTheDocument(); // Completed
            expect(screen.getByText('❌')).toBeInTheDocument(); // Failed
        });

        it('expands to show details on click', () => {
            render(
                <TaskProgressModule tasks={[mockExecutingTask]} counts={mockCounts}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            // Details should not be visible initially
            expect(screen.queryByText('Current Step:')).not.toBeInTheDocument();

            // Click expand button
            fireEvent.click(screen.getByLabelText('Expand details'));

            // Details should now be visible
            expect(screen.getByText('Current Step:')).toBeInTheDocument();
            expect(screen.getByText('Processing records 6500 of 10000')).toBeInTheDocument();
        });

        it('shows error in expanded details for failed task', () => {
            render(
                <TaskProgressModule tasks={[mockFailedTask]} counts={mockCounts}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            // Expand the failed task
            fireEvent.click(screen.getByLabelText('Expand details'));

            expect(screen.getByText('Error:')).toBeInTheDocument();
            expect(screen.getByText('Connection timeout to security service')).toBeInTheDocument();
        });

        it('calls onTaskClick when task is clicked', () => {
            const handleClick = vi.fn();
            render(
                <TaskProgressModule
                    tasks={[mockExecutingTask]}
                    counts={mockCounts}
                    onTaskClick={handleClick}
                >
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            fireEvent.click(screen.getByRole('button', { name: /DataProcessor-Alpha/i }));

            expect(handleClick).toHaveBeenCalledWith(mockExecutingTask);
        });
    });

    // ========================================================================
    // Footer Component
    // ========================================================================

    describe('Footer Component', () => {
        it('shows tasks in progress count', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Footer />
                </TaskProgressModule>
            );

            expect(screen.getByText('1 task in progress')).toBeInTheDocument();
        });

        it('pluralizes correctly for multiple tasks', () => {
            render(
                <TaskProgressModule
                    tasks={mockTasks}
                    counts={{ executing: 3, completed: 1, failed: 0 }}
                >
                    <TaskProgressModule.Footer />
                </TaskProgressModule>
            );

            expect(screen.getByText('3 tasks in progress')).toBeInTheDocument();
        });

        it('renders custom children', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Footer>
                        <span>Custom footer content</span>
                    </TaskProgressModule.Footer>
                </TaskProgressModule>
            );

            expect(screen.getByText('Custom footer content')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility
    // ========================================================================

    describe('Accessibility', () => {
        it('has accessible region label', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByRole('region', { name: 'Task Progress' })).toBeInTheDocument();
        });

        it('has accessible list', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByRole('list', { name: 'Task list' })).toBeInTheDocument();
        });

        it('has accessible filter buttons with aria-pressed', () => {
            render(
                <TaskProgressModule tasks={mockTasks} counts={mockCounts}>
                    <TaskProgressModule.Filters />
                </TaskProgressModule>
            );

            const allButton = screen.getByText('All (3)');
            expect(allButton).toHaveAttribute('aria-pressed', 'true');

            const executingButton = screen.getByText('Executing (1)');
            expect(executingButton).toHaveAttribute('aria-pressed', 'false');
        });

        it('items have accessible labels', () => {
            const handleClick = vi.fn();
            render(
                <TaskProgressModule
                    tasks={[mockExecutingTask]}
                    counts={mockCounts}
                    onTaskClick={handleClick}
                >
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            const item = screen.getByRole('button', { name: /DataProcessor-Alpha - Data Export, Executing, 65% complete/i });
            expect(item).toBeInTheDocument();
        });

        it('expand button has accessible label', () => {
            render(
                <TaskProgressModule tasks={[mockExecutingTask]} counts={mockCounts}>
                    <TaskProgressModule.List />
                </TaskProgressModule>
            );

            expect(screen.getByLabelText('Expand details')).toBeInTheDocument();
        });
    });
});
