/**
 * Task Progress Module
 *
 * Displays executing and completed tasks with progress tracking.
 * Uses compound component pattern for flexible composition.
 *
 * Story 2.7: Task Execution Progress View
 * FRs: FR8, FR9
 */

import { createContext, useContext, memo, useMemo, useCallback, useState } from 'react';
import type { ExecutingTask, ExecutingTaskStatus, ExecutingTaskCounts } from '../../../types';
import { ProgressBar } from '../shared/ProgressBar';
import { AgentLink } from '../shared/AgentLink';
import { getActionTypeConfig } from './TaskPipelineModule';

// ============================================================================
// Types
// ============================================================================

export type TaskProgressFilter = 'all' | 'executing' | 'completed' | 'failed';

export interface TaskProgressContextValue {
    tasks: ExecutingTask[];
    counts: ExecutingTaskCounts;
    isLoading: boolean;
    error: string | null;
    selectedFilter: TaskProgressFilter;
    setSelectedFilter: (filter: TaskProgressFilter) => void;
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
    onTaskClick?: (task: ExecutingTask) => void;
}

export interface TaskProgressModuleProps {
    children: React.ReactNode;
    tasks?: ExecutingTask[];
    counts?: ExecutingTaskCounts;
    isLoading?: boolean;
    error?: string | null;
    onTaskClick?: (task: ExecutingTask) => void;
    className?: string;
}

export interface HeaderProps {
    title?: string;
    className?: string;
}

export interface FiltersProps {
    className?: string;
}

export interface ListProps {
    children?: React.ReactNode;
    maxHeight?: string | number;
    className?: string;
}

export interface ItemProps {
    task: ExecutingTask;
    className?: string;
}

export interface FooterProps {
    children?: React.ReactNode;
    className?: string;
}

// ============================================================================
// Status Helpers
// ============================================================================

export function getStatusLabel(status: ExecutingTaskStatus): string {
    switch (status) {
        case 'executing':
            return 'Executing';
        case 'completed':
            return 'Completed';
        case 'failed':
            return 'Failed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return 'Unknown';
    }
}

export function getStatusColor(status: ExecutingTaskStatus): string {
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
            return 'var(--color-text, #fff)';
    }
}

export function getStatusIcon(status: ExecutingTaskStatus): string {
    switch (status) {
        case 'executing':
            return '⏳';
        case 'completed':
            return '✅';
        case 'failed':
            return '❌';
        case 'cancelled':
            return '⏹️';
        default:
            return '❓';
    }
}

export function formatDuration(startedAt: string, completedAt?: string): string {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const diffMs = end - start;

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

export function formatEstimatedTime(estimatedCompletion?: string): string {
    if (!estimatedCompletion) return 'Unknown';

    const now = Date.now();
    const estimated = new Date(estimatedCompletion).getTime();
    const diffMs = estimated - now;

    if (diffMs <= 0) return 'Any moment';

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `~${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `~${minutes}m`;
    }
    return `~${seconds}s`;
}

// ============================================================================
// Context
// ============================================================================

const TaskProgressContext = createContext<TaskProgressContextValue | null>(null);

function useTaskProgressContext() {
    const context = useContext(TaskProgressContext);
    if (!context) {
        throw new Error('TaskProgressModule compound components must be used within TaskProgressModule');
    }
    return context;
}

// ============================================================================
// Main Component
// ============================================================================

function TaskProgressModuleRoot({
    children,
    tasks = [],
    counts = { executing: 0, completed: 0, failed: 0 },
    isLoading = false,
    error = null,
    onTaskClick,
    className = '',
}: TaskProgressModuleProps) {
    const [selectedFilter, setSelectedFilter] = useState<TaskProgressFilter>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const contextValue = useMemo(
        () => ({
            tasks,
            counts,
            isLoading,
            error,
            selectedFilter,
            setSelectedFilter,
            expandedId,
            setExpandedId,
            onTaskClick,
        }),
        [tasks, counts, isLoading, error, selectedFilter, expandedId, onTaskClick]
    );

    return (
        <TaskProgressContext.Provider value={contextValue}>
            <div className={`task-progress-module ${className}`} role="region" aria-label="Task Progress">
                {children}
            </div>
        </TaskProgressContext.Provider>
    );
}

// ============================================================================
// Header Component
// ============================================================================

const Header = memo(function Header({ title = 'Task Progress', className = '' }: HeaderProps) {
    const { counts } = useTaskProgressContext();

    return (
        <div className={`task-progress-module__header ${className}`}>
            <h3 className="task-progress-module__title">{title}</h3>
            <div className="task-progress-module__counts">
                {counts.executing > 0 && (
                    <span className="task-progress-module__count task-progress-module__count--executing">
                        <span className="task-progress-module__count-value">{counts.executing}</span>
                        <span className="task-progress-module__count-label">executing</span>
                    </span>
                )}
                <span className="task-progress-module__count task-progress-module__count--completed">
                    <span className="task-progress-module__count-value">{counts.completed}</span>
                    <span className="task-progress-module__count-label">completed</span>
                </span>
                {counts.failed > 0 && (
                    <span className="task-progress-module__count task-progress-module__count--failed">
                        <span className="task-progress-module__count-value">{counts.failed}</span>
                        <span className="task-progress-module__count-label">failed</span>
                    </span>
                )}
            </div>
        </div>
    );
});

// ============================================================================
// Filters Component
// ============================================================================

const Filters = memo(function Filters({ className = '' }: FiltersProps) {
    const { counts, selectedFilter, setSelectedFilter } = useTaskProgressContext();

    const handleFilterClick = useCallback(
        (filter: TaskProgressFilter) => {
            setSelectedFilter(filter === selectedFilter ? 'all' : filter);
        },
        [selectedFilter, setSelectedFilter]
    );

    const totalCount = counts.executing + counts.completed + counts.failed;

    return (
        <div className={`task-progress-module__filters ${className}`} role="group" aria-label="Filter by status">
            <button
                type="button"
                className={`task-progress-module__filter ${selectedFilter === 'all' ? 'task-progress-module__filter--active' : ''}`}
                onClick={() => handleFilterClick('all')}
                aria-pressed={selectedFilter === 'all'}
            >
                All ({totalCount})
            </button>
            <button
                type="button"
                className={`task-progress-module__filter task-progress-module__filter--executing ${selectedFilter === 'executing' ? 'task-progress-module__filter--active' : ''}`}
                onClick={() => handleFilterClick('executing')}
                aria-pressed={selectedFilter === 'executing'}
            >
                Executing ({counts.executing})
            </button>
            <button
                type="button"
                className={`task-progress-module__filter task-progress-module__filter--completed ${selectedFilter === 'completed' ? 'task-progress-module__filter--active' : ''}`}
                onClick={() => handleFilterClick('completed')}
                aria-pressed={selectedFilter === 'completed'}
            >
                Completed ({counts.completed})
            </button>
            <button
                type="button"
                className={`task-progress-module__filter task-progress-module__filter--failed ${selectedFilter === 'failed' ? 'task-progress-module__filter--active' : ''}`}
                onClick={() => handleFilterClick('failed')}
                aria-pressed={selectedFilter === 'failed'}
            >
                Failed ({counts.failed})
            </button>
        </div>
    );
});

// ============================================================================
// List Component
// ============================================================================

const List = memo(function List({ children, maxHeight = '400px', className = '' }: ListProps) {
    const { tasks, isLoading, error, selectedFilter } = useTaskProgressContext();

    // Filter tasks by selected status
    const filteredTasks = useMemo(() => {
        if (selectedFilter === 'all') return tasks;
        return tasks.filter((t) => t.status === selectedFilter);
    }, [tasks, selectedFilter]);

    if (error) {
        return (
            <div className={`task-progress-module__list task-progress-module__list--error ${className}`}>
                <p className="task-progress-module__error" role="alert">
                    {error}
                </p>
            </div>
        );
    }

    if (isLoading && tasks.length === 0) {
        return (
            <div className={`task-progress-module__list task-progress-module__list--loading ${className}`}>
                <div className="task-progress-module__skeleton" aria-busy="true" aria-label="Loading tasks">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="task-progress-module__skeleton-item" />
                    ))}
                </div>
            </div>
        );
    }

    if (filteredTasks.length === 0) {
        return (
            <div className={`task-progress-module__list task-progress-module__list--empty ${className}`}>
                <p className="task-progress-module__empty">
                    {selectedFilter === 'all'
                        ? 'No tasks to display'
                        : `No ${selectedFilter} tasks`}
                </p>
            </div>
        );
    }

    // Use children if provided, otherwise render default items
    const content = children || filteredTasks.map((task) => <Item key={task.id} task={task} />);

    return (
        <ul
            className={`task-progress-module__list ${className}`}
            style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
            role="list"
            aria-label="Task list"
        >
            {content}
        </ul>
    );
});

// ============================================================================
// Item Component
// ============================================================================

const Item = memo(function Item({ task, className = '' }: ItemProps) {
    const { expandedId, setExpandedId, onTaskClick } = useTaskProgressContext();

    const isExpanded = expandedId === task.id;
    const actionConfig = getActionTypeConfig(task.actionType);
    const statusColor = getStatusColor(task.status);
    const statusIcon = getStatusIcon(task.status);
    const duration = task.duration || formatDuration(task.startedAt, task.completedAt);

    const handleClick = useCallback(() => {
        onTaskClick?.(task);
    }, [task, onTaskClick]);

    const handleToggleExpand = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setExpandedId(isExpanded ? null : task.id);
        },
        [task.id, isExpanded, setExpandedId]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTaskClick?.(task);
            }
        },
        [task, onTaskClick]
    );

    return (
        <li
            className={`task-progress-module__item task-progress-module__item--${task.status} ${isExpanded ? 'task-progress-module__item--expanded' : ''} ${className}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={onTaskClick ? 0 : undefined}
            role={onTaskClick ? 'button' : undefined}
            aria-label={`${task.agentName} - ${actionConfig.label}, ${getStatusLabel(task.status)}, ${task.progress}% complete`}
            aria-expanded={isExpanded}
        >
            {/* Main row */}
            <div className="task-progress-module__item-main">
                {/* Status Icon */}
                <span className="task-progress-module__status-icon" aria-hidden="true">
                    {statusIcon}
                </span>

                {/* Action Type Icon */}
                <span className="task-progress-module__action-icon" aria-hidden="true">
                    {actionConfig.icon}
                </span>

                {/* Agent & Action Info */}
                <div className="task-progress-module__info">
                    <AgentLink
                        agentId={task.agentId}
                        agentName={task.agentName}
                        showId={false}
                        showTooltip={false}
                        className="task-progress-module__agent-link"
                        size="sm"
                    />
                    <span className="task-progress-module__action-type">{actionConfig.label}</span>
                </div>

                {/* Progress */}
                <div className="task-progress-module__progress">
                    <ProgressBar
                        progress={task.progress}
                        status={task.status}
                        size="sm"
                        showPercentage={true}
                        animated={task.status === 'executing'}
                    />
                </div>

                {/* Duration */}
                <span className="task-progress-module__duration">{duration}</span>

                {/* Expand/Collapse Button */}
                <button
                    type="button"
                    className="task-progress-module__expand-btn"
                    onClick={handleToggleExpand}
                    aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                >
                    {isExpanded ? '▲' : '▼'}
                </button>
            </div>

            {/* Expanded details */}
            {isExpanded && (
                <div className="task-progress-module__item-details">
                    {/* Current Step */}
                    {task.currentStep && (
                        <div className="task-progress-module__detail-row">
                            <span className="task-progress-module__detail-label">Current Step:</span>
                            <span className="task-progress-module__detail-value">{task.currentStep}</span>
                        </div>
                    )}

                    {/* Estimated Completion */}
                    {task.status === 'executing' && task.estimatedCompletion && (
                        <div className="task-progress-module__detail-row">
                            <span className="task-progress-module__detail-label">ETA:</span>
                            <span className="task-progress-module__detail-value">
                                {formatEstimatedTime(task.estimatedCompletion)}
                            </span>
                        </div>
                    )}

                    {/* Started At */}
                    <div className="task-progress-module__detail-row">
                        <span className="task-progress-module__detail-label">Started:</span>
                        <span className="task-progress-module__detail-value">
                            {new Date(task.startedAt).toLocaleTimeString()}
                        </span>
                    </div>

                    {/* Completed At */}
                    {task.completedAt && (
                        <div className="task-progress-module__detail-row">
                            <span className="task-progress-module__detail-label">Completed:</span>
                            <span className="task-progress-module__detail-value">
                                {new Date(task.completedAt).toLocaleTimeString()}
                            </span>
                        </div>
                    )}

                    {/* Error */}
                    {task.error && (
                        <div className="task-progress-module__detail-row task-progress-module__detail-row--error">
                            <span className="task-progress-module__detail-label">Error:</span>
                            <span className="task-progress-module__detail-value">{task.error}</span>
                        </div>
                    )}

                    {/* Status Badge */}
                    <div className="task-progress-module__status-badge" style={{ color: statusColor }}>
                        {getStatusLabel(task.status)}
                    </div>
                </div>
            )}
        </li>
    );
});

// ============================================================================
// Footer Component
// ============================================================================

const Footer = memo(function Footer({ children, className = '' }: FooterProps) {
    const { counts } = useTaskProgressContext();

    if (children) {
        return <div className={`task-progress-module__footer ${className}`}>{children}</div>;
    }

    return (
        <div className={`task-progress-module__footer ${className}`}>
            <span className="task-progress-module__footer-stat">
                {counts.executing > 0 && (
                    <span className="task-progress-module__footer-executing">
                        {counts.executing} task{counts.executing !== 1 ? 's' : ''} in progress
                    </span>
                )}
            </span>
        </div>
    );
});

// ============================================================================
// Compound Component Export
// ============================================================================

export const TaskProgressModule = Object.assign(TaskProgressModuleRoot, {
    Header,
    Filters,
    List,
    Item,
    Footer,
});

// ============================================================================
// Styles
// ============================================================================

export const taskProgressModuleStyles = `
.task-progress-module {
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-border, #2a2a4a);
    border-radius: 8px;
    overflow: hidden;
}

.task-progress-module__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #2a2a4a);
}

.task-progress-module__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #fff);
}

.task-progress-module__counts {
    display: flex;
    gap: 12px;
}

.task-progress-module__count {
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.task-progress-module__count-value {
    font-size: 14px;
    font-weight: 600;
}

.task-progress-module__count--executing .task-progress-module__count-value {
    color: var(--color-primary, #3b82f6);
}

.task-progress-module__count--completed .task-progress-module__count-value {
    color: var(--color-success, #10b981);
}

.task-progress-module__count--failed .task-progress-module__count-value {
    color: var(--color-error, #ef4444);
}

.task-progress-module__count-label {
    font-size: 11px;
    color: var(--color-muted, #6b7280);
}

/* Filters */
.task-progress-module__filters {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--color-border, #2a2a4a);
    background: var(--color-surface-alt, #151525);
    flex-wrap: wrap;
}

.task-progress-module__filter {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--color-border, #2a2a4a);
    border-radius: 4px;
    background: transparent;
    color: var(--color-muted, #6b7280);
    cursor: pointer;
    transition: all 0.15s ease;
}

.task-progress-module__filter:hover {
    border-color: var(--color-primary, #3b82f6);
    color: var(--color-text, #fff);
}

.task-progress-module__filter--active {
    background: var(--color-primary, #3b82f6);
    border-color: var(--color-primary, #3b82f6);
    color: white;
}

.task-progress-module__filter--executing:not(.task-progress-module__filter--active):hover {
    border-color: var(--color-primary, #3b82f6);
}

.task-progress-module__filter--completed:not(.task-progress-module__filter--active):hover {
    border-color: var(--color-success, #10b981);
}

.task-progress-module__filter--failed:not(.task-progress-module__filter--active):hover {
    border-color: var(--color-error, #ef4444);
}

/* List */
.task-progress-module__list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
}

.task-progress-module__list--error,
.task-progress-module__list--loading,
.task-progress-module__list--empty {
    padding: 24px 16px;
    text-align: center;
}

.task-progress-module__error {
    color: var(--color-error, #ef4444);
    margin: 0;
}

.task-progress-module__empty {
    color: var(--color-muted, #6b7280);
    margin: 0;
}

.task-progress-module__skeleton-item {
    height: 72px;
    background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface-hover) 50%, var(--color-border) 75%);
    background-size: 200% 100%;
    animation: task-progress-shimmer 1.5s infinite;
    margin: 8px 16px;
    border-radius: 4px;
}

@keyframes task-progress-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* Item */
.task-progress-module__item {
    border-bottom: 1px solid var(--color-border, #2a2a4a);
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.task-progress-module__item:last-child {
    border-bottom: none;
}

.task-progress-module__item:hover {
    background: var(--color-surface-hover, #252540);
}

.task-progress-module__item:focus {
    outline: 2px solid var(--color-primary, #3b82f6);
    outline-offset: -2px;
}

.task-progress-module__item--failed {
    border-left: 3px solid var(--color-error, #ef4444);
}

.task-progress-module__item--completed {
    border-left: 3px solid var(--color-success, #10b981);
}

.task-progress-module__item--executing {
    border-left: 3px solid var(--color-primary, #3b82f6);
}

.task-progress-module__item-main {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
}

.task-progress-module__status-icon {
    font-size: 14px;
    flex-shrink: 0;
}

.task-progress-module__action-icon {
    font-size: 16px;
    flex-shrink: 0;
}

.task-progress-module__info {
    flex: 0 0 140px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.task-progress-module__agent-link {
    padding: 0 !important;
    color: var(--color-text, #fff) !important;
    font-weight: 500;
}

.task-progress-module__agent-link:hover {
    color: var(--color-primary, #3b82f6) !important;
}

.task-progress-module__action-type {
    font-size: 12px;
    color: var(--color-muted, #6b7280);
}

.task-progress-module__progress {
    flex: 1;
    min-width: 120px;
}

.task-progress-module__duration {
    flex: 0 0 60px;
    font-size: 12px;
    color: var(--color-muted, #6b7280);
    text-align: right;
}

.task-progress-module__expand-btn {
    padding: 4px 8px;
    font-size: 10px;
    background: transparent;
    border: none;
    color: var(--color-muted, #6b7280);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
}

.task-progress-module__expand-btn:hover {
    background: var(--color-surface-hover, #252540);
    color: var(--color-text, #fff);
}

/* Expanded details */
.task-progress-module__item-details {
    padding: 12px 16px;
    padding-top: 0;
    background: var(--color-surface-alt, #151525);
    border-top: 1px solid var(--color-border, #2a2a4a);
}

.task-progress-module__detail-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
}

.task-progress-module__detail-row:last-child {
    margin-bottom: 0;
}

.task-progress-module__detail-row--error {
    color: var(--color-error, #ef4444);
}

.task-progress-module__detail-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted, #6b7280);
    text-transform: uppercase;
    flex: 0 0 100px;
}

.task-progress-module__detail-value {
    font-size: 13px;
    color: var(--color-text, #fff);
    line-height: 1.4;
}

.task-progress-module__status-badge {
    display: inline-block;
    margin-top: 8px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid currentColor;
    border-radius: 4px;
}

/* Footer */
.task-progress-module__footer {
    padding: 10px 16px;
    border-top: 1px solid var(--color-border, #2a2a4a);
    background: var(--color-surface-alt, #151525);
}

.task-progress-module__footer-stat {
    font-size: 12px;
    color: var(--color-muted, #6b7280);
}

.task-progress-module__footer-executing {
    color: var(--color-primary, #3b82f6);
    font-weight: 500;
}
`;

export default TaskProgressModule;
