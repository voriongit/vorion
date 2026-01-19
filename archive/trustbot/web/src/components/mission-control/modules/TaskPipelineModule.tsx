/**
 * Task Pipeline Module
 *
 * Displays pending action requests requiring HITL approval.
 * Uses compound component pattern for flexible composition.
 *
 * Story 2.1: Task Pipeline Module - Pending Decisions View
 * FRs: FR7, FR11, FR12, FR13
 */

import { createContext, useContext, memo, useMemo, useCallback, useState } from 'react';
import type { ActionRequest, ActionRequestUrgency, ActionRequestCounts } from '../../../types';
import { UrgencyBadge } from '../shared/UrgencyBadge';
import { QueueDuration } from '../shared/QueueDuration';
import { AgentLink } from '../shared/AgentLink';

// ============================================================================
// Types
// ============================================================================

export interface TaskPipelineContextValue {
    queue: ActionRequest[];
    counts: ActionRequestCounts;
    isLoading: boolean;
    error: string | null;
    selectedUrgency: ActionRequestUrgency | null;
    setSelectedUrgency: (urgency: ActionRequestUrgency | null) => void;
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
    onDecisionClick?: (decision: ActionRequest) => void;
    onApprove?: (decision: ActionRequest) => void;
    onDeny?: (decision: ActionRequest) => void;
}

export interface TaskPipelineModuleProps {
    children: React.ReactNode;
    queue?: ActionRequest[];
    counts?: ActionRequestCounts;
    isLoading?: boolean;
    error?: string | null;
    onDecisionClick?: (decision: ActionRequest) => void;
    onApprove?: (decision: ActionRequest) => void;
    onDeny?: (decision: ActionRequest) => void;
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
    decision: ActionRequest;
    className?: string;
}

export interface FooterProps {
    children?: React.ReactNode;
    className?: string;
}

// ============================================================================
// Action Type Labels
// ============================================================================

export const ACTION_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
    data_export: { label: 'Data Export', icon: '📤' },
    data_import: { label: 'Data Import', icon: '📥' },
    data_correction: { label: 'Data Correction', icon: '✏️' },
    security_scan: { label: 'Security Scan', icon: '🔒' },
    report_generation: { label: 'Report Generation', icon: '📊' },
    alert_escalation: { label: 'Alert Escalation', icon: '⚠️' },
    system_access: { label: 'System Access', icon: '🔑' },
    default: { label: 'Action', icon: '⚡' },
};

export function getActionTypeConfig(actionType: string) {
    return ACTION_TYPE_LABELS[actionType] || ACTION_TYPE_LABELS.default;
}

// ============================================================================
// Context
// ============================================================================

const TaskPipelineContext = createContext<TaskPipelineContextValue | null>(null);

function useTaskPipelineContext() {
    const context = useContext(TaskPipelineContext);
    if (!context) {
        throw new Error('TaskPipelineModule compound components must be used within TaskPipelineModule');
    }
    return context;
}

// ============================================================================
// Main Component
// ============================================================================

function TaskPipelineModuleRoot({
    children,
    queue = [],
    counts = { immediate: 0, queued: 0, total: 0 },
    isLoading = false,
    error = null,
    onDecisionClick,
    onApprove,
    onDeny,
    className = '',
}: TaskPipelineModuleProps) {
    const [selectedUrgency, setSelectedUrgency] = useState<ActionRequestUrgency | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const contextValue = useMemo(
        () => ({
            queue,
            counts,
            isLoading,
            error,
            selectedUrgency,
            setSelectedUrgency,
            expandedId,
            setExpandedId,
            onDecisionClick,
            onApprove,
            onDeny,
        }),
        [queue, counts, isLoading, error, selectedUrgency, expandedId, onDecisionClick, onApprove, onDeny]
    );

    return (
        <TaskPipelineContext.Provider value={contextValue}>
            <div className={`task-pipeline-module ${className}`} role="region" aria-label="Decision Queue">
                {children}
            </div>
        </TaskPipelineContext.Provider>
    );
}

// ============================================================================
// Header Component
// ============================================================================

const Header = memo(function Header({ title = 'Decision Queue', className = '' }: HeaderProps) {
    const { counts } = useTaskPipelineContext();

    return (
        <div className={`task-pipeline-module__header ${className}`}>
            <h3 className="task-pipeline-module__title">{title}</h3>
            <div className="task-pipeline-module__counts">
                {counts.immediate > 0 && (
                    <span className="task-pipeline-module__count task-pipeline-module__count--immediate">
                        <span className="task-pipeline-module__count-value">{counts.immediate}</span>
                        <span className="task-pipeline-module__count-label">immediate</span>
                    </span>
                )}
                <span className="task-pipeline-module__count task-pipeline-module__count--total">
                    <span className="task-pipeline-module__count-value">{counts.total}</span>
                    <span className="task-pipeline-module__count-label">total</span>
                </span>
            </div>
        </div>
    );
});

// ============================================================================
// Filters Component
// ============================================================================

const Filters = memo(function Filters({ className = '' }: FiltersProps) {
    const { counts, selectedUrgency, setSelectedUrgency } = useTaskPipelineContext();

    const handleFilterClick = useCallback(
        (urgency: ActionRequestUrgency | null) => {
            setSelectedUrgency(urgency === selectedUrgency ? null : urgency);
        },
        [selectedUrgency, setSelectedUrgency]
    );

    return (
        <div className={`task-pipeline-module__filters ${className}`} role="group" aria-label="Filter by urgency">
            <button
                type="button"
                className={`task-pipeline-module__filter ${selectedUrgency === null ? 'task-pipeline-module__filter--active' : ''}`}
                onClick={() => handleFilterClick(null)}
                aria-pressed={selectedUrgency === null}
            >
                All ({counts.total})
            </button>
            <button
                type="button"
                className={`task-pipeline-module__filter task-pipeline-module__filter--immediate ${selectedUrgency === 'immediate' ? 'task-pipeline-module__filter--active' : ''}`}
                onClick={() => handleFilterClick('immediate')}
                aria-pressed={selectedUrgency === 'immediate'}
            >
                Immediate ({counts.immediate})
            </button>
            <button
                type="button"
                className={`task-pipeline-module__filter task-pipeline-module__filter--queued ${selectedUrgency === 'queued' ? 'task-pipeline-module__filter--active' : ''}`}
                onClick={() => handleFilterClick('queued')}
                aria-pressed={selectedUrgency === 'queued'}
            >
                Queued ({counts.queued})
            </button>
        </div>
    );
});

// ============================================================================
// List Component
// ============================================================================

const List = memo(function List({ children, maxHeight = '400px', className = '' }: ListProps) {
    const { queue, isLoading, error, selectedUrgency } = useTaskPipelineContext();

    // Filter queue by selected urgency
    const filteredQueue = useMemo(() => {
        if (!selectedUrgency) return queue;
        return queue.filter((d) => d.urgency === selectedUrgency);
    }, [queue, selectedUrgency]);

    if (error) {
        return (
            <div className={`task-pipeline-module__list task-pipeline-module__list--error ${className}`}>
                <p className="task-pipeline-module__error" role="alert">
                    {error}
                </p>
            </div>
        );
    }

    if (isLoading && queue.length === 0) {
        return (
            <div className={`task-pipeline-module__list task-pipeline-module__list--loading ${className}`}>
                <div className="task-pipeline-module__skeleton" aria-busy="true" aria-label="Loading decisions">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="task-pipeline-module__skeleton-item" />
                    ))}
                </div>
            </div>
        );
    }

    if (filteredQueue.length === 0) {
        return (
            <div className={`task-pipeline-module__list task-pipeline-module__list--empty ${className}`}>
                <p className="task-pipeline-module__empty">
                    {selectedUrgency
                        ? `No ${selectedUrgency} decisions pending`
                        : 'No decisions pending'}
                </p>
            </div>
        );
    }

    // Use children if provided, otherwise render default items
    const content = children || filteredQueue.map((decision) => <Item key={decision.id} decision={decision} />);

    return (
        <ul
            className={`task-pipeline-module__list ${className}`}
            style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
            role="list"
            aria-label="Pending decisions"
        >
            {content}
        </ul>
    );
});

// ============================================================================
// Item Component
// ============================================================================

const Item = memo(function Item({ decision, className = '' }: ItemProps) {
    const { expandedId, setExpandedId, onDecisionClick, onApprove, onDeny } = useTaskPipelineContext();

    const isExpanded = expandedId === decision.id;
    const actionConfig = getActionTypeConfig(decision.actionType);

    const handleClick = useCallback(() => {
        onDecisionClick?.(decision);
    }, [decision, onDecisionClick]);

    const handleToggleExpand = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setExpandedId(isExpanded ? null : decision.id);
        },
        [decision.id, isExpanded, setExpandedId]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onDecisionClick?.(decision);
            }
        },
        [decision, onDecisionClick]
    );

    const handleApprove = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onApprove?.(decision);
        },
        [decision, onApprove]
    );

    const handleDeny = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDeny?.(decision);
        },
        [decision, onDeny]
    );

    return (
        <li
            className={`task-pipeline-module__item ${isExpanded ? 'task-pipeline-module__item--expanded' : ''} ${className}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={onDecisionClick ? 0 : undefined}
            role={onDecisionClick ? 'button' : undefined}
            aria-label={`${decision.agentName} requests ${actionConfig.label}, urgency ${decision.urgency}`}
            aria-expanded={isExpanded}
        >
            {/* Main row */}
            <div className="task-pipeline-module__item-main">
                {/* Urgency */}
                <UrgencyBadge urgency={decision.urgency} size="sm" />

                {/* Action Type Icon */}
                <span className="task-pipeline-module__action-icon" aria-hidden="true">
                    {actionConfig.icon}
                </span>

                {/* Agent & Action Info */}
                <div className="task-pipeline-module__info">
                    <AgentLink
                        agentId={decision.agentId}
                        agentName={decision.agentName}
                        showId={false}
                        showTooltip={false}
                        className="task-pipeline-module__agent-link"
                        size="sm"
                    />
                    <span className="task-pipeline-module__action-type">{actionConfig.label}</span>
                </div>

                {/* Time in Queue */}
                <QueueDuration duration={decision.timeInQueue} size="sm" />

                {/* Expand/Collapse Button */}
                <button
                    type="button"
                    className="task-pipeline-module__expand-btn"
                    onClick={handleToggleExpand}
                    aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                >
                    {isExpanded ? '▲' : '▼'}
                </button>
            </div>

            {/* Expanded details */}
            {isExpanded && (
                <div className="task-pipeline-module__item-details">
                    {/* Queued Reason (FR13) */}
                    {decision.queuedReason && (
                        <div className="task-pipeline-module__reason">
                            <span className="task-pipeline-module__reason-label">Why queued:</span>
                            <span className="task-pipeline-module__reason-text">{decision.queuedReason}</span>
                        </div>
                    )}

                    {/* Trust Gate Rules */}
                    {decision.trustGateRules && decision.trustGateRules.length > 0 && (
                        <div className="task-pipeline-module__rules">
                            <span className="task-pipeline-module__rules-label">Trust Gate rules:</span>
                            <div className="task-pipeline-module__rules-list">
                                {decision.trustGateRules.map((rule) => (
                                    <span key={rule} className="task-pipeline-module__rule-tag">
                                        {rule.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    {(onApprove || onDeny) && (
                        <div className="task-pipeline-module__actions">
                            {onApprove && (
                                <button
                                    type="button"
                                    className="task-pipeline-module__action-btn task-pipeline-module__action-btn--approve"
                                    onClick={handleApprove}
                                >
                                    Approve
                                </button>
                            )}
                            {onDeny && (
                                <button
                                    type="button"
                                    className="task-pipeline-module__action-btn task-pipeline-module__action-btn--deny"
                                    onClick={handleDeny}
                                >
                                    Deny
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </li>
    );
});

// ============================================================================
// Footer Component
// ============================================================================

const Footer = memo(function Footer({ children, className = '' }: FooterProps) {
    const { counts } = useTaskPipelineContext();

    if (children) {
        return <div className={`task-pipeline-module__footer ${className}`}>{children}</div>;
    }

    return (
        <div className={`task-pipeline-module__footer ${className}`}>
            <span className="task-pipeline-module__footer-stat">
                {counts.immediate > 0 && (
                    <span className="task-pipeline-module__footer-urgent">
                        {counts.immediate} require immediate attention
                    </span>
                )}
            </span>
        </div>
    );
});

// ============================================================================
// Compound Component Export
// ============================================================================

export const TaskPipelineModule = Object.assign(TaskPipelineModuleRoot, {
    Header,
    Filters,
    List,
    Item,
    Footer,
});

// ============================================================================
// Styles
// ============================================================================

export const taskPipelineModuleStyles = `
.task-pipeline-module {
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-border, #2a2a4a);
    border-radius: 8px;
    overflow: hidden;
}

.task-pipeline-module__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #2a2a4a);
}

.task-pipeline-module__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #fff);
}

.task-pipeline-module__counts {
    display: flex;
    gap: 12px;
}

.task-pipeline-module__count {
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.task-pipeline-module__count-value {
    font-size: 14px;
    font-weight: 600;
}

.task-pipeline-module__count--immediate .task-pipeline-module__count-value {
    color: var(--color-error, #ef4444);
}

.task-pipeline-module__count--total .task-pipeline-module__count-value {
    color: var(--color-text, #fff);
}

.task-pipeline-module__count-label {
    font-size: 11px;
    color: var(--color-muted, #6b7280);
}

/* Filters */
.task-pipeline-module__filters {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--color-border, #2a2a4a);
    background: var(--color-surface-alt, #151525);
}

.task-pipeline-module__filter {
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

.task-pipeline-module__filter:hover {
    border-color: var(--color-primary, #3b82f6);
    color: var(--color-text, #fff);
}

.task-pipeline-module__filter--active {
    background: var(--color-primary, #3b82f6);
    border-color: var(--color-primary, #3b82f6);
    color: white;
}

.task-pipeline-module__filter--immediate:not(.task-pipeline-module__filter--active):hover {
    border-color: var(--color-error, #ef4444);
}

.task-pipeline-module__filter--queued:not(.task-pipeline-module__filter--active):hover {
    border-color: var(--color-warning, #f59e0b);
}

/* List */
.task-pipeline-module__list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
}

.task-pipeline-module__list--error,
.task-pipeline-module__list--loading,
.task-pipeline-module__list--empty {
    padding: 24px 16px;
    text-align: center;
}

.task-pipeline-module__error {
    color: var(--color-error, #ef4444);
    margin: 0;
}

.task-pipeline-module__empty {
    color: var(--color-muted, #6b7280);
    margin: 0;
}

.task-pipeline-module__skeleton-item {
    height: 56px;
    background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface-hover) 50%, var(--color-border) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    margin: 8px 16px;
    border-radius: 4px;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* Item */
.task-pipeline-module__item {
    border-bottom: 1px solid var(--color-border, #2a2a4a);
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.task-pipeline-module__item:last-child {
    border-bottom: none;
}

.task-pipeline-module__item:hover {
    background: var(--color-surface-hover, #252540);
}

.task-pipeline-module__item:focus {
    outline: 2px solid var(--color-primary, #3b82f6);
    outline-offset: -2px;
}

.task-pipeline-module__item-main {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
}

.task-pipeline-module__action-icon {
    font-size: 16px;
    flex-shrink: 0;
}

.task-pipeline-module__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.task-pipeline-module__agent-link {
    padding: 0 !important;
    color: var(--color-text, #fff) !important;
    font-weight: 500;
}

.task-pipeline-module__agent-link:hover {
    color: var(--color-primary, #3b82f6) !important;
}

.task-pipeline-module__action-type {
    font-size: 12px;
    color: var(--color-muted, #6b7280);
}

.task-pipeline-module__expand-btn {
    padding: 4px 8px;
    font-size: 10px;
    background: transparent;
    border: none;
    color: var(--color-muted, #6b7280);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
}

.task-pipeline-module__expand-btn:hover {
    background: var(--color-surface-hover, #252540);
    color: var(--color-text, #fff);
}

/* Expanded details */
.task-pipeline-module__item-details {
    padding: 12px 16px;
    padding-top: 0;
    background: var(--color-surface-alt, #151525);
    border-top: 1px solid var(--color-border, #2a2a4a);
}

.task-pipeline-module__reason {
    margin-bottom: 8px;
}

.task-pipeline-module__reason-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted, #6b7280);
    text-transform: uppercase;
    margin-bottom: 4px;
}

.task-pipeline-module__reason-text {
    font-size: 13px;
    color: var(--color-text, #fff);
    line-height: 1.4;
}

.task-pipeline-module__rules {
    margin-bottom: 12px;
}

.task-pipeline-module__rules-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted, #6b7280);
    text-transform: uppercase;
    margin-bottom: 6px;
}

.task-pipeline-module__rules-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.task-pipeline-module__rule-tag {
    padding: 2px 8px;
    font-size: 11px;
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-border, #2a2a4a);
    border-radius: 4px;
    color: var(--color-text-secondary, #a0a0a0);
    text-transform: capitalize;
}

.task-pipeline-module__actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}

.task-pipeline-module__action-btn {
    flex: 1;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.task-pipeline-module__action-btn--approve {
    background: var(--color-success, #10b981);
    color: white;
}

.task-pipeline-module__action-btn--approve:hover {
    background: #0d9669;
}

.task-pipeline-module__action-btn--deny {
    background: var(--color-error, #ef4444);
    color: white;
}

.task-pipeline-module__action-btn--deny:hover {
    background: #dc2626;
}

/* Footer */
.task-pipeline-module__footer {
    padding: 10px 16px;
    border-top: 1px solid var(--color-border, #2a2a4a);
    background: var(--color-surface-alt, #151525);
}

.task-pipeline-module__footer-stat {
    font-size: 12px;
    color: var(--color-muted, #6b7280);
}

.task-pipeline-module__footer-urgent {
    color: var(--color-error, #ef4444);
    font-weight: 500;
}
`;

export default TaskPipelineModule;
