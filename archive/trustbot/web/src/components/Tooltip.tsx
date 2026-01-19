import { useState, useRef, useEffect, ReactNode } from 'react';

/**
 * Contextual Tooltip Component
 *
 * Provides educational tooltips throughout the UI to help users
 * understand Aurais concepts and functionality.
 */

interface TooltipProps {
    /** The content to show in the tooltip */
    content: ReactNode;
    /** The element that triggers the tooltip */
    children: ReactNode;
    /** Position of the tooltip relative to the trigger */
    position?: 'top' | 'bottom' | 'left' | 'right';
    /** Delay before showing tooltip (ms) */
    delay?: number;
    /** Maximum width of tooltip */
    maxWidth?: number;
    /** Whether tooltip is disabled */
    disabled?: boolean;
    /** Optional title for the tooltip */
    title?: string;
    /** Optional "Learn More" link */
    learnMoreAction?: () => void;
}

export function Tooltip({
    content,
    children,
    position = 'top',
    delay = 300,
    maxWidth = 280,
    disabled = false,
    title,
    learnMoreAction,
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    const calculatePosition = () => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const padding = 8;

        let x = 0;
        let y = 0;

        switch (position) {
            case 'top':
                x = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                y = triggerRect.top - tooltipRect.height - padding;
                break;
            case 'bottom':
                x = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                y = triggerRect.bottom + padding;
                break;
            case 'left':
                x = triggerRect.left - tooltipRect.width - padding;
                y = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                break;
            case 'right':
                x = triggerRect.right + padding;
                y = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                break;
        }

        // Keep tooltip within viewport
        const viewportPadding = 10;
        x = Math.max(viewportPadding, Math.min(x, window.innerWidth - tooltipRect.width - viewportPadding));
        y = Math.max(viewportPadding, Math.min(y, window.innerHeight - tooltipRect.height - viewportPadding));

        setCoords({ x, y });
    };

    useEffect(() => {
        if (isVisible) {
            calculatePosition();
        }
    }, [isVisible]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleMouseEnter = () => {
        if (disabled) return;
        timeoutRef.current = window.setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    const arrowStyles: Record<string, React.CSSProperties> = {
        top: {
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
        },
        bottom: {
            top: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
        },
        left: {
            right: '-6px',
            top: '50%',
            transform: 'translateY(-50%) rotate(45deg)',
        },
        right: {
            left: '-6px',
            top: '50%',
            transform: 'translateY(-50%) rotate(45deg)',
        },
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleMouseEnter}
                onBlur={handleMouseLeave}
                style={{ display: 'inline-flex' }}
            >
                {children}
            </div>

            {isVisible && (
                <div
                    ref={tooltipRef}
                    className="contextual-tooltip"
                    style={{
                        position: 'fixed',
                        left: coords.x,
                        top: coords.y,
                        maxWidth,
                        zIndex: 10000,
                    }}
                    onMouseEnter={() => setIsVisible(true)}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Arrow */}
                    <div
                        className="tooltip-arrow"
                        style={arrowStyles[position]}
                    />

                    {/* Content */}
                    {title && <div className="tooltip-title">{title}</div>}
                    <div className="tooltip-content">{content}</div>

                    {learnMoreAction && (
                        <button
                            className="tooltip-learn-more"
                            onClick={(e) => {
                                e.stopPropagation();
                                learnMoreAction();
                                setIsVisible(false);
                            }}
                        >
                            Learn More
                        </button>
                    )}
                </div>
            )}
        </>
    );
}

// Pre-defined tooltip content for common UI elements
export const TOOLTIP_CONTENT = {
    // Trust Tiers
    TIER_0: {
        title: 'Tier 0: Passive',
        content: 'Observe-only agents. Cannot take any actions, only monitor and report. Perfect for learning or auditing.',
    },
    TIER_1: {
        title: 'Tier 1: Worker',
        content: 'Basic task execution with full human oversight. Every action requires explicit approval.',
    },
    TIER_2: {
        title: 'Tier 2: Operational',
        content: 'Can execute routine tasks independently. Escalates edge cases to humans.',
    },
    TIER_3: {
        title: 'Tier 3: Tactical',
        content: 'Makes decisions within defined boundaries. Can delegate to lower tiers.',
    },
    TIER_4: {
        title: 'Tier 4: Executive',
        content: 'Strategic decision-making capability. Can spawn and manage other agents.',
    },
    TIER_5: {
        title: 'Tier 5: Sovereign',
        content: 'Full autonomy within governance framework. Self-improving and self-directing.',
    },

    // Agent Statuses
    STATUS_IDLE: {
        title: 'Status: Idle',
        content: 'Agent is ready and waiting for tasks. No current workload.',
    },
    STATUS_WORKING: {
        title: 'Status: Working',
        content: 'Agent is actively executing tasks. Check blackboard for progress updates.',
    },
    STATUS_WAITING: {
        title: 'Status: Waiting',
        content: 'Agent is blocked, waiting for approval or external input to continue.',
    },
    STATUS_ERROR: {
        title: 'Status: Error',
        content: 'Agent encountered a problem. Review logs and consider intervention.',
    },

    // Agent Types
    TYPE_EXECUTOR: {
        title: 'Executor Agent',
        content: 'Carries out defined tasks and operations. The "doers" of your agent workforce.',
    },
    TYPE_PLANNER: {
        title: 'Planner Agent',
        content: 'Creates strategies and breaks down complex goals into actionable steps.',
    },
    TYPE_VALIDATOR: {
        title: 'Validator Agent',
        content: 'Reviews work from other agents, ensures quality and compliance.',
    },
    TYPE_EVOLVER: {
        title: 'Evolver Agent',
        content: 'Analyzes patterns and suggests improvements to processes and other agents.',
    },
    TYPE_SPAWNER: {
        title: 'Spawner Agent',
        content: 'Creates and manages other agents based on workload and needs.',
    },

    // HITL Levels
    HITL_FULL: {
        title: 'Full Human Control (100%)',
        content: 'Every agent action requires your approval. Maximum safety, slower throughput.',
    },
    HITL_HIGH: {
        title: 'High Oversight (75%)',
        content: 'Most actions need approval. Routine tasks may proceed automatically.',
    },
    HITL_BALANCED: {
        title: 'Balanced (50%)',
        content: 'Agents handle routine work, humans review important decisions.',
    },
    HITL_AUTONOMOUS: {
        title: 'Autonomous (25%)',
        content: 'Agents work independently, escalating only critical issues.',
    },
    HITL_MINIMAL: {
        title: 'Minimal Oversight (0%)',
        content: 'Full agent autonomy. Only use with highly trusted, validated agents.',
    },

    // Console Actions
    ACTION_TICK: {
        title: 'Run Tick',
        content: 'Manually trigger a work cycle. Agents will process queued tasks and report results.',
    },
    ACTION_SPAWN: {
        title: 'Spawn Agent',
        content: 'Create a new AI agent. Choose type, tier, and initial configuration.',
    },
    ACTION_STATUS: {
        title: 'System Status',
        content: 'View overall health: active agents, pending approvals, and governance level.',
    },

    // Metrics
    METRIC_TRUST: {
        title: 'Trust Score',
        content: 'Calculated from task success rate, compliance, and behavioral consistency. Higher = more reliable.',
    },
    METRIC_UPTIME: {
        title: 'System Uptime',
        content: 'How long the Aurais system has been running continuously.',
    },
    METRIC_PENDING: {
        title: 'Pending Approvals',
        content: 'Actions waiting for your review. High numbers may indicate bottlenecks.',
    },
};

// Helper component for inline tooltips with icons
interface InfoTooltipProps {
    content: ReactNode;
    title?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({ content, title, position = 'top' }: InfoTooltipProps) {
    return (
        <Tooltip content={content} title={title} position={position}>
            <span className="info-tooltip-icon">?</span>
        </Tooltip>
    );
}
