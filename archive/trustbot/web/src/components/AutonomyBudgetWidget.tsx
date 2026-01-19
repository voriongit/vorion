/**
 * AutonomyBudgetWidget - Shows agent daily autonomy budget
 *
 * TRUST-5.9: Visual indicator of autonomous actions remaining
 * - Progress bar showing used/max
 * - Color changes as budget depletes
 * - Time until reset countdown
 * - Tier-based limits display
 */

import { useState, useEffect } from 'react';

export interface AutonomyBudgetData {
    tier: number;
    actions: {
        used: number;
        max: number;
        remaining: number;
        percentage: number;
    };
    delegations: {
        used: number;
        max: number;
        remaining: number;
    };
    tokens: {
        spent: number;
        max: number;
        remaining: number;
    };
    resetsIn: number; // milliseconds
    resetsAt: string;
}

interface AutonomyBudgetWidgetProps {
    data: AutonomyBudgetData;
    compact?: boolean;
}

function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return 'Resetting...';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function getBudgetColor(percentage: number): string {
    if (percentage >= 75) return '#ef4444'; // Red - low budget
    if (percentage >= 50) return '#f59e0b'; // Yellow - medium
    return '#10b981'; // Green - plenty left
}

export function AutonomyBudgetWidget({ data, compact = false }: AutonomyBudgetWidgetProps) {
    const [timeRemaining, setTimeRemaining] = useState(data.resetsIn);

    // Update countdown timer
    useEffect(() => {
        setTimeRemaining(data.resetsIn);

        const interval = setInterval(() => {
            setTimeRemaining(prev => Math.max(0, prev - 60000)); // Update every minute
        }, 60000);

        return () => clearInterval(interval);
    }, [data.resetsIn]);

    const isUnlimited = data.actions.max === -1;
    const percentage = isUnlimited ? 0 : data.actions.percentage;
    const barColor = getBudgetColor(percentage);

    if (compact) {
        return (
            <div
                className="autonomy-budget-compact"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 8,
                    fontSize: 12,
                }}
            >
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Budget:</span>
                {isUnlimited ? (
                    <span style={{ color: '#10b981' }}>Unlimited</span>
                ) : (
                    <>
                        <div
                            style={{
                                width: 40,
                                height: 4,
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: 2,
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${100 - percentage}%`,
                                    height: '100%',
                                    background: barColor,
                                    transition: 'width 0.3s ease',
                                }}
                            />
                        </div>
                        <span style={{ color: barColor, fontFamily: 'monospace' }}>
                            {data.actions.remaining}/{data.actions.max}
                        </span>
                    </>
                )}
            </div>
        );
    }

    return (
        <div
            className="autonomy-budget-widget"
            style={{
                background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                borderRadius: 12,
                padding: 16,
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
            }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Autonomy Budget
                </span>
                <span style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: 'monospace',
                }}>
                    T{data.tier}
                </span>
            </div>

            {/* Actions Budget */}
            <div style={{ marginBottom: 16 }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    fontSize: 12,
                }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>Actions</span>
                    {isUnlimited ? (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Unlimited</span>
                    ) : (
                        <span style={{ fontFamily: 'monospace' }}>
                            <span style={{ color: barColor }}>{data.actions.remaining}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}> / {data.actions.max}</span>
                        </span>
                    )}
                </div>

                {!isUnlimited && (
                    <div
                        style={{
                            height: 8,
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: 4,
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                width: `${100 - percentage}%`,
                                height: '100%',
                                background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                                borderRadius: 4,
                                transition: 'width 0.5s ease, background 0.3s ease',
                                boxShadow: `0 0 10px ${barColor}40`,
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Delegations & Tokens (smaller) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 16,
            }}>
                <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                        Delegations
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {data.delegations.max === -1 ? (
                            <span style={{ color: '#10b981' }}>Unlimited</span>
                        ) : (
                            <>
                                <span style={{ color: '#3b82f6' }}>{data.delegations.remaining}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}> / {data.delegations.max}</span>
                            </>
                        )}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                        Tokens
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {data.tokens.max === -1 ? (
                            <span style={{ color: '#10b981' }}>Unlimited</span>
                        ) : (
                            <>
                                <span style={{ color: '#8b5cf6' }}>
                                    {(data.tokens.remaining / 1000).toFixed(1)}k
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    {' '}/ {(data.tokens.max / 1000).toFixed(0)}k
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Reset Timer */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 8,
                fontSize: 12,
            }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Resets in</span>
                <span style={{ color: '#3b82f6', fontFamily: 'monospace', fontWeight: 600 }}>
                    {formatTimeRemaining(timeRemaining)}
                </span>
            </div>
        </div>
    );
}

export default AutonomyBudgetWidget;
