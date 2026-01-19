/**
 * Agent Overview Module
 *
 * Displays all agents in the organization with status indicators.
 * Uses compound component pattern for flexible composition.
 *
 * Story 1.3: Agent Overview Module - List View
 * FRs: FR1, FR4, FR5
 */

import { createContext, useContext, memo, useMemo, useCallback } from 'react';
import type { Agent } from '../../../types';
import { useMissionControlStore } from '../../../stores/missionControlStore';
import { TrustBadge } from '../shared/TrustBadge';
import { TrendIndicator } from '../shared/TrendIndicator';
import { AgentLink } from '../shared/AgentLink';

// ============================================================================
// Types
// ============================================================================

export interface AgentOverviewContextValue {
    agents: Agent[];
    isLoading: boolean;
    error: string | null;
    onAgentClick?: (agent: Agent) => void;
}

export interface AgentOverviewModuleProps {
    children: React.ReactNode;
    onAgentClick?: (agent: Agent) => void;
    className?: string;
}

export interface HeaderProps {
    title?: string;
    count?: number;
    className?: string;
}

export interface ListProps {
    children?: React.ReactNode;
    maxHeight?: string | number;
    className?: string;
}

export interface ItemProps {
    agent: Agent;
    className?: string;
}

export interface FooterProps {
    children?: React.ReactNode;
    className?: string;
}

// ============================================================================
// Status Configuration
// ============================================================================

export const STATUS_CONFIG = {
    WORKING: {
        color: 'var(--color-success, #10b981)',
        label: 'Active',
        icon: '●',
        ariaLabel: 'Agent is actively working',
    },
    IDLE: {
        color: 'var(--color-muted, #6b7280)',
        label: 'Idle',
        icon: '○',
        ariaLabel: 'Agent is idle and available',
    },
    WAITING_APPROVAL: {
        color: 'var(--color-warning, #f59e0b)',
        label: 'Pending',
        icon: '◐',
        ariaLabel: 'Agent is waiting for approval',
    },
    IN_MEETING: {
        color: 'var(--color-info, #3b82f6)',
        label: 'In Meeting',
        icon: '◉',
        ariaLabel: 'Agent is in a meeting',
    },
    ERROR: {
        color: 'var(--color-error, #ef4444)',
        label: 'Error',
        icon: '✕',
        ariaLabel: 'Agent has encountered an error',
    },
    TERMINATED: {
        color: 'var(--color-muted, #6b7280)',
        label: 'Terminated',
        icon: '—',
        ariaLabel: 'Agent has been terminated',
    },
    INITIALIZING: {
        color: 'var(--color-warning, #f59e0b)',
        label: 'Starting',
        icon: '◌',
        ariaLabel: 'Agent is initializing',
    },
} as const;

export type AgentStatusKey = keyof typeof STATUS_CONFIG;

// ============================================================================
// Context
// ============================================================================

const AgentOverviewContext = createContext<AgentOverviewContextValue | null>(null);

function useAgentOverviewContext() {
    const context = useContext(AgentOverviewContext);
    if (!context) {
        throw new Error('AgentOverviewModule compound components must be used within AgentOverviewModule');
    }
    return context;
}

// ============================================================================
// Main Component
// ============================================================================

function AgentOverviewModuleRoot({ children, onAgentClick, className = '' }: AgentOverviewModuleProps) {
    const agents = useMissionControlStore((state) => state.agents);
    const connectionStatus = useMissionControlStore((state) => state.connectionStatus);

    const isLoading = connectionStatus === 'reconnecting';
    const error = connectionStatus === 'disconnected' ? 'Connection lost' : null;

    const contextValue = useMemo(
        () => ({
            agents,
            isLoading,
            error,
            onAgentClick,
        }),
        [agents, isLoading, error, onAgentClick]
    );

    return (
        <AgentOverviewContext.Provider value={contextValue}>
            <div className={`agent-overview-module ${className}`} role="region" aria-label="Agent Overview">
                {children}
            </div>
        </AgentOverviewContext.Provider>
    );
}

// ============================================================================
// Header Component
// ============================================================================

const Header = memo(function Header({ title = 'Agent Fleet', count, className = '' }: HeaderProps) {
    const { agents } = useAgentOverviewContext();
    const displayCount = count ?? agents.length;

    return (
        <div className={`agent-overview-module__header ${className}`}>
            <h3 className="agent-overview-module__title">{title}</h3>
            <span className="agent-overview-module__count" aria-label={`${displayCount} agents`}>
                {displayCount}
            </span>
        </div>
    );
});

// ============================================================================
// List Component
// ============================================================================

const List = memo(function List({ children, maxHeight = '400px', className = '' }: ListProps) {
    const { agents, isLoading, error, onAgentClick: _onAgentClick } = useAgentOverviewContext();

    if (error) {
        return (
            <div className={`agent-overview-module__list agent-overview-module__list--error ${className}`}>
                <p className="agent-overview-module__error" role="alert">
                    {error}
                </p>
            </div>
        );
    }

    if (isLoading && agents.length === 0) {
        return (
            <div className={`agent-overview-module__list agent-overview-module__list--loading ${className}`}>
                <div className="agent-overview-module__skeleton" aria-busy="true" aria-label="Loading agents">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="agent-overview-module__skeleton-item" />
                    ))}
                </div>
            </div>
        );
    }

    if (agents.length === 0) {
        return (
            <div className={`agent-overview-module__list agent-overview-module__list--empty ${className}`}>
                <p className="agent-overview-module__empty">No agents found</p>
            </div>
        );
    }

    // Use children if provided, otherwise render default items
    const content = children || agents.map((agent) => <Item key={agent.id} agent={agent} />);

    return (
        <ul
            className={`agent-overview-module__list ${className}`}
            style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
            role="list"
            aria-label="Agent list"
        >
            {content}
        </ul>
    );
});

// ============================================================================
// Item Component
// ============================================================================

const Item = memo(function Item({ agent, className = '' }: ItemProps) {
    const { onAgentClick } = useAgentOverviewContext();

    const statusConfig = STATUS_CONFIG[agent.status as AgentStatusKey] || STATUS_CONFIG.IDLE;

    const handleClick = useCallback(() => {
        onAgentClick?.(agent);
    }, [agent, onAgentClick]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAgentClick?.(agent);
            }
        },
        [agent, onAgentClick]
    );

    // Format structured ID or fallback to regular ID
    const displayId = agent.structuredId || agent.id.slice(0, 8);

    return (
        <li
            className={`agent-overview-module__item ${className}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={onAgentClick ? 0 : undefined}
            role={onAgentClick ? 'button' : undefined}
            aria-label={`${agent.name}, ${statusConfig.label}, Trust score ${agent.trustScore}`}
        >
            {/* Status Indicator */}
            <span
                className="agent-overview-module__status"
                style={{ color: statusConfig.color }}
                aria-label={statusConfig.ariaLabel}
                role="img"
            >
                {statusConfig.icon}
            </span>

            {/* Agent Info with AgentLink */}
            <div className="agent-overview-module__info">
                <AgentLink
                    agentId={agent.id}
                    agentName={agent.name}
                    showId={false}
                    showTooltip={false}
                    onClick={onAgentClick ? () => onAgentClick(agent) : undefined}
                    className="agent-overview-module__name-link"
                    size="sm"
                />
                <span className="agent-overview-module__id">{displayId}</span>
            </div>

            {/* Trust Score with Badge and Trend */}
            <div className="agent-overview-module__trust">
                <TrustBadge
                    score={agent.trustScore}
                    size="sm"
                    showScore={true}
                    showTierName={false}
                />
                {agent.trustTrend && (
                    <TrendIndicator
                        trend={agent.trustTrend.direction}
                        percentChange={agent.trustTrend.percentChange}
                        size="sm"
                    />
                )}
            </div>

            {/* Status Label */}
            <span
                className="agent-overview-module__status-label"
                style={{ color: statusConfig.color }}
            >
                {statusConfig.label}
            </span>
        </li>
    );
});

// ============================================================================
// Footer Component
// ============================================================================

const Footer = memo(function Footer({ children, className = '' }: FooterProps) {
    const { agents } = useAgentOverviewContext();

    // Calculate quick stats
    const stats = useMemo(() => {
        const working = agents.filter((a) => a.status === 'WORKING').length;
        const idle = agents.filter((a) => a.status === 'IDLE').length;
        const error = agents.filter((a) => a.status === 'ERROR').length;
        const avgTrust = agents.length > 0
            ? Math.round(agents.reduce((sum, a) => sum + a.trustScore, 0) / agents.length)
            : 0;

        return { working, idle, error, avgTrust };
    }, [agents]);

    if (children) {
        return <div className={`agent-overview-module__footer ${className}`}>{children}</div>;
    }

    return (
        <div className={`agent-overview-module__footer ${className}`}>
            <span className="agent-overview-module__stat">
                <span className="agent-overview-module__stat-value" style={{ color: 'var(--color-success)' }}>
                    {stats.working}
                </span>
                <span className="agent-overview-module__stat-label">active</span>
            </span>
            <span className="agent-overview-module__stat">
                <span className="agent-overview-module__stat-value">{stats.idle}</span>
                <span className="agent-overview-module__stat-label">idle</span>
            </span>
            {stats.error > 0 && (
                <span className="agent-overview-module__stat">
                    <span className="agent-overview-module__stat-value" style={{ color: 'var(--color-error)' }}>
                        {stats.error}
                    </span>
                    <span className="agent-overview-module__stat-label">error</span>
                </span>
            )}
            <span className="agent-overview-module__stat agent-overview-module__stat--trust">
                <span className="agent-overview-module__stat-value">{stats.avgTrust}</span>
                <span className="agent-overview-module__stat-label">avg trust</span>
            </span>
        </div>
    );
});

// ============================================================================
// Compound Component Export
// ============================================================================

export const AgentOverviewModule = Object.assign(AgentOverviewModuleRoot, {
    Header,
    List,
    Item,
    Footer,
});

// ============================================================================
// Styles
// ============================================================================

export const agentOverviewModuleStyles = `
.agent-overview-module {
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-border, #2a2a4a);
    border-radius: 8px;
    overflow: hidden;
}

.agent-overview-module__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #2a2a4a);
}

.agent-overview-module__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #fff);
}

.agent-overview-module__count {
    background: var(--color-primary, #3b82f6);
    color: white;
    font-size: 12px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 10px;
}

.agent-overview-module__list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
}

.agent-overview-module__list--error,
.agent-overview-module__list--loading,
.agent-overview-module__list--empty {
    padding: 24px 16px;
    text-align: center;
}

.agent-overview-module__error {
    color: var(--color-error, #ef4444);
    margin: 0;
}

.agent-overview-module__empty {
    color: var(--color-muted, #6b7280);
    margin: 0;
}

.agent-overview-module__skeleton-item {
    height: 48px;
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

.agent-overview-module__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-border, #2a2a4a);
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.agent-overview-module__item:last-child {
    border-bottom: none;
}

.agent-overview-module__item:hover {
    background: var(--color-surface-hover, #252540);
}

.agent-overview-module__item:focus {
    outline: 2px solid var(--color-primary, #3b82f6);
    outline-offset: -2px;
}

.agent-overview-module__status {
    font-size: 14px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
}

.agent-overview-module__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.agent-overview-module__name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.agent-overview-module__name-link {
    padding: 0 !important;
    color: var(--color-text, #fff) !important;
}

.agent-overview-module__name-link:hover {
    color: var(--color-primary, #3b82f6) !important;
}

.agent-overview-module__id {
    font-size: 11px;
    color: var(--color-muted, #6b7280);
    font-family: monospace;
}

.agent-overview-module__trust {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.agent-overview-module__status-label {
    font-size: 11px;
    font-weight: 500;
    flex-shrink: 0;
    width: 60px;
    text-align: right;
}

.agent-overview-module__footer {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    border-top: 1px solid var(--color-border, #2a2a4a);
    background: var(--color-surface-alt, #151525);
}

.agent-overview-module__stat {
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.agent-overview-module__stat-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #fff);
}

.agent-overview-module__stat-label {
    font-size: 11px;
    color: var(--color-muted, #6b7280);
}

.agent-overview-module__stat--trust {
    margin-left: auto;
}
`;

export default AgentOverviewModule;
