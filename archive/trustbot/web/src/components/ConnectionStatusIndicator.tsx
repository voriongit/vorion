/**
 * Connection Status Indicator
 *
 * Displays real-time connection status in the header.
 * Shows "Last sync: Xs ago" when connection is lost.
 *
 * Story 1.2: Zustand Store & Real-Time Connection
 * FRs: FR55 (Real-time updates)
 */

import { useState, useEffect, memo } from 'react';
import { useMissionControlStore } from '../stores/missionControlStore';
import { formatSyncAge, isSyncStale } from '../hooks/useRealtimeConnection';

// ============================================================================
// Types
// ============================================================================

export interface ConnectionStatusIndicatorProps {
    /** Show detailed status or just icon */
    compact?: boolean;
    /** Custom class name */
    className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const ConnectionStatusIndicator = memo(function ConnectionStatusIndicator({
    compact = false,
    className = '',
}: ConnectionStatusIndicatorProps) {
    const connectionStatus = useMissionControlStore((state) => state.connectionStatus);
    const lastSync = useMissionControlStore((state) => state.lastSync);
    const reconnectAttempts = useMissionControlStore((state) => state.reconnectAttempts);

    // Update sync age every second when disconnected
    const [syncAge, setSyncAge] = useState<number | null>(null);

    useEffect(() => {
        if (connectionStatus === 'connected' && !isSyncStale(lastSync)) {
            setSyncAge(null);
            return;
        }

        const updateAge = () => {
            if (lastSync) {
                setSyncAge(Math.floor((Date.now() - lastSync.getTime()) / 1000));
            } else {
                setSyncAge(null);
            }
        };

        updateAge();
        const interval = setInterval(updateAge, 1000);

        return () => clearInterval(interval);
    }, [connectionStatus, lastSync]);

    // Don't show anything when connected and fresh
    if (connectionStatus === 'connected' && syncAge === null) {
        if (compact) {
            return (
                <div className={`connection-status connection-status--connected ${className}`}>
                    <span className="connection-status__dot connection-status__dot--connected" />
                </div>
            );
        }
        return null;
    }

    // Determine display state
    const isReconnecting = connectionStatus === 'reconnecting';
    const isDisconnected = connectionStatus === 'disconnected';
    const showSyncAge = syncAge !== null && syncAge >= 5;

    return (
        <div
            className={`connection-status connection-status--${connectionStatus} ${className}`}
            role="status"
            aria-live="polite"
        >
            {/* Status Dot */}
            <span
                className={`connection-status__dot connection-status__dot--${connectionStatus}`}
                aria-hidden="true"
            />

            {/* Status Text */}
            {!compact && (
                <span className="connection-status__text">
                    {isReconnecting && (
                        <>
                            <span className="connection-status__spinner" />
                            Reconnecting
                            {reconnectAttempts > 1 && ` (${reconnectAttempts})`}
                        </>
                    )}
                    {isDisconnected && 'Disconnected'}
                    {showSyncAge && !isReconnecting && !isDisconnected && (
                        <>Last sync: {formatSyncAge(syncAge)}</>
                    )}
                </span>
            )}

            {/* Sync Age (compact mode) */}
            {compact && showSyncAge && (
                <span className="connection-status__age">{formatSyncAge(syncAge)}</span>
            )}
        </div>
    );
});

// ============================================================================
// Styles (CSS-in-JS for portability)
// ============================================================================

export const connectionStatusStyles = `
.connection-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: inherit;
}

.connection-status--connected {
    color: var(--color-success, #10b981);
}

.connection-status--disconnected {
    color: var(--color-error, #ef4444);
    background: rgba(239, 68, 68, 0.1);
}

.connection-status--reconnecting {
    color: var(--color-warning, #f59e0b);
    background: rgba(245, 158, 11, 0.1);
}

.connection-status__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.connection-status__dot--connected {
    background: var(--color-success, #10b981);
    box-shadow: 0 0 4px var(--color-success, #10b981);
}

.connection-status__dot--disconnected {
    background: var(--color-error, #ef4444);
}

.connection-status__dot--reconnecting {
    background: var(--color-warning, #f59e0b);
    animation: pulse 1.5s ease-in-out infinite;
}

.connection-status__spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 4px;
}

.connection-status__text {
    display: flex;
    align-items: center;
    gap: 4px;
}

.connection-status__age {
    opacity: 0.8;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
`;

export default ConnectionStatusIndicator;
