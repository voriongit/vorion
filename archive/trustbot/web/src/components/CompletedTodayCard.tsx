import { useState } from 'react';
import { useCompletedToday, useAggressiveness } from '../api';

/**
 * Completed Today Card
 *
 * Displays the "Completed Today" summary from the Unified Workflow API
 * and provides the Aggressiveness Slider for controlling autonomy level.
 */

interface CompletedTodayCardProps {
    humanToken?: string;
    onTokenNeeded?: () => void;
}

export function CompletedTodayCard({ humanToken, onTokenNeeded }: CompletedTodayCardProps) {
    const { summary, loading: summaryLoading, refresh } = useCompletedToday(5000);
    const { config, loading: configLoading, setLevel } = useAggressiveness();
    const [localLevel, setLocalLevel] = useState(config?.level ?? 0);
    const [updating, setUpdating] = useState(false);

    const handleAggressivenessChange = async (newLevel: number) => {
        if (!humanToken) {
            onTokenNeeded?.();
            return;
        }
        setUpdating(true);
        try {
            await setLevel(newLevel, humanToken);
        } catch (e) {
            console.error('Failed to set aggressiveness:', e);
        }
        setUpdating(false);
    };

    if (summaryLoading || configLoading) {
        return (
            <div className="completed-today-card loading">
                <div className="loading-spinner">Loading Workflow Data...</div>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="completed-today-card error">
                <p>Workflow API unavailable</p>
                <button className="btn btn-secondary" onClick={refresh}>Retry</button>
            </div>
        );
    }

    return (
        <div className="completed-today-card">
            <div className="card-header">
                <h3>📊 Completed Today</h3>
                <span className="date">{summary.date}</span>
            </div>

            {/* Main Stats */}
            <div className="stats-grid">
                <div className="stat completed">
                    <div className="stat-value">{summary.totalCompleted}</div>
                    <div className="stat-label">Completed</div>
                </div>
                <div className="stat failed">
                    <div className="stat-value">{summary.totalFailed}</div>
                    <div className="stat-label">Failed</div>
                </div>
                <div className="stat pending">
                    <div className="stat-value">{summary.totalPending}</div>
                    <div className="stat-label">Pending</div>
                </div>
            </div>

            {/* Trust Changes */}
            <div className="trust-changes">
                <div className="trust-item rewards">
                    <span className="icon">📈</span>
                    <span className="label">Rewards</span>
                    <span className="value">+{summary.trustChanges.rewards}</span>
                </div>
                <div className="trust-item penalties">
                    <span className="icon">📉</span>
                    <span className="label">Penalties</span>
                    <span className="value">-{summary.trustChanges.penalties}</span>
                </div>
                <div className="trust-item net">
                    <span className="icon">{summary.trustChanges.netChange >= 0 ? '✨' : '⚠️'}</span>
                    <span className="label">Net</span>
                    <span className={`value ${summary.trustChanges.netChange >= 0 ? 'positive' : 'negative'}`}>
                        {summary.trustChanges.netChange >= 0 ? '+' : ''}{summary.trustChanges.netChange}
                    </span>
                </div>
            </div>

            {/* Autonomy Metrics */}
            <div className="autonomy-metrics">
                <h4>🤖 Autonomy Breakdown</h4>
                <div className="metrics-row">
                    <div className="metric">
                        <span className="metric-value">{summary.autonomyMetrics.autoApproved}</span>
                        <span className="metric-label">Auto-approved</span>
                    </div>
                    <div className="metric">
                        <span className="metric-value">{summary.autonomyMetrics.humanApproved}</span>
                        <span className="metric-label">Human-approved</span>
                    </div>
                    <div className="metric">
                        <span className="metric-value">{summary.autonomyMetrics.humanRejected}</span>
                        <span className="metric-label">Rejected</span>
                    </div>
                </div>
            </div>

            {/* Aggressiveness Slider */}
            {config && (
                <div className="aggressiveness-control">
                    <h4>🎚️ Aggressiveness Level</h4>
                    <div className="slider-container">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={localLevel}
                            onChange={e => setLocalLevel(Number(e.target.value))}
                            onMouseUp={() => handleAggressivenessChange(localLevel)}
                            onTouchEnd={() => handleAggressivenessChange(localLevel)}
                            disabled={updating || !humanToken}
                            className="aggressiveness-slider"
                        />
                        <div className="slider-value">{config.level}%</div>
                    </div>
                    <div className="aggressiveness-info">
                        <div className="info-item">
                            <span className="info-label">Auto-approve tier:</span>
                            <span className="info-value">T{config.autoApproveUpToTier}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Max delegation:</span>
                            <span className="info-value">{config.maxDelegationDepth}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Reward multiplier:</span>
                            <span className="info-value">{config.trustRewardMultiplier.toFixed(1)}x</span>
                        </div>
                    </div>
                    {!humanToken && (
                        <p className="auth-warning">
                            🔒 Human authentication required to adjust aggressiveness
                        </p>
                    )}
                </div>
            )}

            {/* Avg Completion Time */}
            {summary.avgCompletionTimeMs > 0 && (
                <div className="completion-time">
                    <span className="icon">⏱️</span>
                    <span className="label">Avg completion time:</span>
                    <span className="value">{Math.round(summary.avgCompletionTimeMs / 1000)}s</span>
                </div>
            )}
        </div>
    );
}

/**
 * Standalone Aggressiveness Slider Component
 *
 * Can be embedded in the ControlPanel or other places.
 */
export function AggressivenessSlider({ humanToken, onTokenNeeded }: { humanToken?: string; onTokenNeeded?: () => void }) {
    const { config, loading, setLevel } = useAggressiveness();
    const [localLevel, setLocalLevel] = useState(config?.level ?? 0);
    const [updating, setUpdating] = useState(false);

    const handleChange = async (newLevel: number) => {
        if (!humanToken) {
            onTokenNeeded?.();
            return;
        }
        setUpdating(true);
        try {
            await setLevel(newLevel, humanToken);
        } catch (e) {
            console.error('Failed to set aggressiveness:', e);
        }
        setUpdating(false);
    };

    if (loading || !config) {
        return <div className="aggressiveness-loading">Loading...</div>;
    }

    const getDescription = (level: number): string => {
        if (level >= 80) return '🚀 High autonomy - agents work mostly independently';
        if (level >= 50) return '🤝 Balanced - shared control between humans and agents';
        if (level >= 20) return '🔓 Conservative - most actions require approval';
        return '🔒 Fully supervised - all actions need human approval';
    };

    return (
        <div className="aggressiveness-slider-wrapper">
            <div className="slider-header">
                <span className="label">🎚️ Aggressiveness</span>
                <span className="value">{config.level}%</span>
            </div>
            <input
                type="range"
                min="0"
                max="100"
                value={localLevel}
                onChange={e => setLocalLevel(Number(e.target.value))}
                onMouseUp={() => handleChange(localLevel)}
                onTouchEnd={() => handleChange(localLevel)}
                disabled={updating || !humanToken}
                className="aggressiveness-slider"
            />
            <p className="slider-description">{getDescription(config.level)}</p>
            {!humanToken && (
                <p className="auth-warning">🔒 Auth required</p>
            )}
        </div>
    );
}
