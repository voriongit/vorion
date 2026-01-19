import React, { useState, useCallback } from 'react';

/**
 * AgentLink Component
 *
 * A clickable agent reference that can navigate to the agent's profile.
 * Displays agent name/ID with optional tooltips explaining the ID format.
 *
 * Story 1.5: Agent Profile Navigation with AgentLink
 * FR: FR2
 */

/**
 * ID segment explanations for tooltip
 */
export const ID_SEGMENT_INFO = {
    HH: {
        name: 'Hierarchy Level',
        description: 'Agent tier in the hierarchy (00-99)',
    },
    OO: {
        name: 'Organization Code',
        description: 'Org identifier (e.g., MC=Mission Control)',
    },
    RR: {
        name: 'Role Code',
        description: 'Agent role (OP=Operator, EX=Executor, SP=Specialist, SV=Supervisor, WK=Worker)',
    },
    II: {
        name: 'Instance Number',
        description: 'Unique instance identifier within role',
    },
};

/**
 * Role code mappings for human-readable display
 */
export const ROLE_CODES: Record<string, string> = {
    OP: 'Operator',
    EX: 'Executor',
    SP: 'Specialist',
    SV: 'Supervisor',
    WK: 'Worker',
    PL: 'Planner',
    VA: 'Validator',
    EV: 'Evolver',
    SW: 'Spawner',
    LI: 'Listener',
    SI: 'Sitter',
    OR: 'Orchestrator',
};

export interface AgentLinkProps {
    /** Agent's unique identifier (structured or UUID) */
    agentId: string;
    /** Agent's display name (optional) */
    agentName?: string;
    /** Show ID alongside name */
    showId?: boolean;
    /** Show hierarchy tooltip on hover */
    showTooltip?: boolean;
    /** Custom click handler (overrides default navigation) */
    onClick?: (agentId: string) => void;
    /** Navigation handler for router integration */
    onNavigate?: (path: string) => void;
    /** Additional CSS class */
    className?: string;
    /** Test ID for testing */
    testId?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Disable click behavior */
    disabled?: boolean;
}

/**
 * Parse a structured agent ID (HH-OO-RR-II format)
 */
export function parseStructuredId(id: string): {
    isValid: boolean;
    segments: { code: string; value: string; label: string; description: string }[];
} {
    // Check for HH-OO-RR-II format
    const match = id.match(/^(\d{2})-([A-Z]{2})-([A-Z]{2})-(\d{2})$/);

    if (!match) {
        return { isValid: false, segments: [] };
    }

    const [, hh, oo, rr, ii] = match;

    return {
        isValid: true,
        segments: [
            {
                code: 'HH',
                value: hh,
                label: `Hierarchy Level ${parseInt(hh, 10)}`,
                description: ID_SEGMENT_INFO.HH.description,
            },
            {
                code: 'OO',
                value: oo,
                label: `Org: ${oo}`,
                description: ID_SEGMENT_INFO.OO.description,
            },
            {
                code: 'RR',
                value: rr,
                label: ROLE_CODES[rr] || rr,
                description: ID_SEGMENT_INFO.RR.description,
            },
            {
                code: 'II',
                value: ii,
                label: `Instance ${parseInt(ii, 10)}`,
                description: ID_SEGMENT_INFO.II.description,
            },
        ],
    };
}

const SIZE_STYLES = {
    sm: {
        fontSize: '11px',
        padding: '2px 6px',
        gap: '4px',
    },
    md: {
        fontSize: '13px',
        padding: '4px 8px',
        gap: '6px',
    },
    lg: {
        fontSize: '14px',
        padding: '6px 10px',
        gap: '8px',
    },
};

/**
 * AgentLink Component
 *
 * @example
 * ```tsx
 * // Basic usage with click handler
 * <AgentLink agentId="01-MC-OP-42" onClick={handleViewAgent} />
 *
 * // With name and ID shown
 * <AgentLink agentId="01-MC-OP-42" agentName="DataProcessor" showId />
 *
 * // With router navigation
 * <AgentLink agentId="agent-123" onNavigate={navigate} />
 * ```
 */
export function AgentLink({
    agentId,
    agentName,
    showId = false,
    showTooltip = true,
    onClick,
    onNavigate,
    className = '',
    testId = 'agent-link',
    size = 'md',
    disabled = false,
}: AgentLinkProps): React.ReactElement {
    const [showTooltipPopup, setShowTooltipPopup] = useState(false);
    const sizeStyles = SIZE_STYLES[size];

    // Parse structured ID for tooltip
    const parsedId = parseStructuredId(agentId);

    // Display ID: use structured ID if valid, otherwise truncate UUID
    const displayId = parsedId.isValid
        ? agentId
        : agentId.length > 8
            ? `${agentId.slice(0, 8)}...`
            : agentId;

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (disabled) return;

            e.preventDefault();
            e.stopPropagation();

            if (onClick) {
                onClick(agentId);
            } else if (onNavigate) {
                onNavigate(`/agents/${agentId}`);
            }
        },
        [agentId, onClick, onNavigate, disabled]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (disabled) return;

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onClick) {
                    onClick(agentId);
                } else if (onNavigate) {
                    onNavigate(`/agents/${agentId}`);
                }
            }
        },
        [agentId, onClick, onNavigate, disabled]
    );

    const containerStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        fontFamily: 'inherit',
        color: disabled ? 'var(--color-muted, #6b7280)' : 'var(--color-primary, #3b82f6)',
        background: 'transparent',
        border: 'none',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textDecoration: 'none',
        transition: 'background-color 0.15s ease, color 0.15s ease',
        position: 'relative',
    };

    const idStyle: React.CSSProperties = {
        fontFamily: 'monospace',
        fontSize: '0.9em',
        opacity: 0.8,
        background: 'var(--color-surface, rgba(0,0,0,0.1))',
        padding: '1px 4px',
        borderRadius: '3px',
    };

    const tooltipStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '8px',
        padding: '12px',
        background: 'var(--color-tooltip-bg, #1a1a2e)',
        border: '1px solid var(--color-border, #2a2a4a)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        minWidth: '200px',
        pointerEvents: 'none',
    };

    const tooltipHeaderStyle: React.CSSProperties = {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--color-primary, #3b82f6)',
        marginBottom: '8px',
        paddingBottom: '6px',
        borderBottom: '1px solid var(--color-border, #2a2a4a)',
    };

    const tooltipRowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        marginBottom: '4px',
        fontSize: '11px',
    };

    const tooltipCodeStyle: React.CSSProperties = {
        fontFamily: 'monospace',
        fontWeight: 600,
        color: 'var(--color-accent, #10b981)',
        minWidth: '24px',
    };

    const tooltipLabelStyle: React.CSSProperties = {
        color: 'var(--color-text, #fff)',
        flex: 1,
    };

    return (
        <span
            className={`agent-link ${className}`}
            style={containerStyle}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => showTooltip && parsedId.isValid && setShowTooltipPopup(true)}
            onMouseLeave={() => setShowTooltipPopup(false)}
            tabIndex={disabled ? -1 : 0}
            role="link"
            aria-label={`View agent ${agentName || agentId}`}
            data-testid={testId}
        >
            {/* Agent Name */}
            {agentName && (
                <span className="agent-link__name" data-testid={`${testId}-name`}>
                    {agentName}
                </span>
            )}

            {/* Agent ID */}
            {(showId || !agentName) && (
                <span
                    className="agent-link__id"
                    style={idStyle}
                    data-testid={`${testId}-id`}
                >
                    {displayId}
                </span>
            )}

            {/* Tooltip */}
            {showTooltipPopup && parsedId.isValid && (
                <div
                    className="agent-link__tooltip"
                    style={tooltipStyle}
                    role="tooltip"
                    data-testid={`${testId}-tooltip`}
                >
                    <div style={tooltipHeaderStyle}>{agentId}</div>
                    {parsedId.segments.map((segment) => (
                        <div key={segment.code} style={tooltipRowStyle}>
                            <span style={tooltipCodeStyle}>{segment.code}:</span>
                            <span style={tooltipLabelStyle}>
                                <strong>{segment.value}</strong> - {segment.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </span>
    );
}

export default AgentLink;
