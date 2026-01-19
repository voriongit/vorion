/**
 * AccountabilityChain Component
 *
 * Story 4.3: Five-Level Accountability Chain Display
 * FRs: FR25
 */

import { memo } from 'react';
import type { AccountabilityLevel, AccountabilityChain as AccountabilityChainType } from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getLevelIcon(entityType: AccountabilityLevel['entityType']): string {
    const icons = {
        agent: '🤖',
        hitl: '👤',
        tribunal: '⚖️',
        governance: '🏛️',
        na: '—',
    };
    return icons[entityType];
}

export function getLevelColor(level: number, applicable: boolean): string {
    if (!applicable) return '#64748b';
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];
    return colors[level - 1] || '#64748b';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface AccountabilityLevelCardProps {
    level: AccountabilityLevel;
    onEntityClick?: (entityId: string, entityType: string) => void;
}

const AccountabilityLevelCard = memo(function AccountabilityLevelCard({
    level,
    onEntityClick,
}: AccountabilityLevelCardProps) {
    const color = getLevelColor(level.level, level.applicable);

    return (
        <div
            className={`accountability-level ${!level.applicable ? 'accountability-level--na' : ''}`}
            style={{ borderLeftColor: color }}
        >
            <div className="accountability-level__header">
                <span className="accountability-level__number" style={{ backgroundColor: color }}>
                    {level.level}
                </span>
                <span className="accountability-level__title">{level.title}</span>
            </div>

            {level.applicable ? (
                <div className="accountability-level__content">
                    <span className="accountability-level__icon" aria-hidden="true">
                        {getLevelIcon(level.entityType)}
                    </span>
                    {level.entityId ? (
                        <button
                            className="accountability-level__entity"
                            onClick={() => onEntityClick?.(level.entityId!, level.entityType)}
                        >
                            {level.entityName || level.entityId}
                        </button>
                    ) : (
                        <span className="accountability-level__entity-text">
                            {level.entityName || 'Unknown'}
                        </span>
                    )}
                </div>
            ) : (
                <div className="accountability-level__content accountability-level__content--na">
                    <span className="accountability-level__na-text">N/A</span>
                    {level.reason && (
                        <span className="accountability-level__reason">{level.reason}</span>
                    )}
                </div>
            )}
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface AccountabilityChainProps {
    chain: AccountabilityChainType;
    onEntityClick?: (entityId: string, entityType: string) => void;
    className?: string;
}

export const AccountabilityChain = memo(function AccountabilityChain({
    chain,
    onEntityClick,
    className = '',
}: AccountabilityChainProps) {
    return (
        <section
            className={`accountability-chain ${className}`}
            aria-label="Accountability chain"
        >
            <h3 className="accountability-chain__title">Accountability Chain</h3>
            <p className="accountability-chain__subtitle">
                5-level responsibility hierarchy for this action
            </p>

            <div className="accountability-chain__levels">
                {chain.levels.map((level) => (
                    <AccountabilityLevelCard
                        key={level.level}
                        level={level}
                        onEntityClick={onEntityClick}
                    />
                ))}
            </div>
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.accountability-chain {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.accountability-chain__title {
    margin: 0 0 4px;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.accountability-chain__subtitle {
    margin: 0 0 16px;
    font-size: 0.875rem;
    color: #64748b;
}

.accountability-chain__levels {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.accountability-level {
    background: #0f172a;
    border: 1px solid #334155;
    border-left: 4px solid;
    border-radius: 8px;
    padding: 12px 16px;
}

.accountability-level--na {
    opacity: 0.6;
}

.accountability-level__header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.accountability-level__number {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
}

.accountability-level__title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #94a3b8;
}

.accountability-level__content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 36px;
}

.accountability-level__content--na {
    flex-direction: column;
    align-items: flex-start;
}

.accountability-level__icon {
    font-size: 1.25rem;
}

.accountability-level__entity {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 0.9375rem;
    font-weight: 500;
    padding: 0;
    text-decoration: underline;
}

.accountability-level__entity:hover {
    color: #60a5fa;
}

.accountability-level__entity-text {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #e2e8f0;
}

.accountability-level__na-text {
    font-size: 0.875rem;
    color: #64748b;
    font-style: italic;
}

.accountability-level__reason {
    font-size: 0.8125rem;
    color: #64748b;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'accountability-chain-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default AccountabilityChain;
