/**
 * Connection Status Indicator
 * Shows real-time connection state in the UI
 */

import { motion } from 'framer-motion';
import { useConnectionStatus, useAlerts } from '../hooks/useRealtime';

export function ConnectionStatus() {
    const { quality } = useConnectionStatus();
    const { unreadCount } = useAlerts();

    const statusConfig = {
        good: {
            color: 'bg-emerald-500',
            text: 'Live',
            pulse: true,
        },
        degraded: {
            color: 'bg-amber-500',
            text: 'Delayed',
            pulse: false,
        },
        disconnected: {
            color: 'bg-red-500',
            text: 'Offline',
            pulse: false,
        },
    };

    const config = statusConfig[quality];

    return (
        <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-2">
                <div className="relative">
                    <div className={`w-2 h-2 rounded-full ${config.color}`} />
                    {config.pulse && (
                        <motion.div
                            className={`absolute inset-0 w-2 h-2 rounded-full ${config.color}`}
                            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                    )}
                </div>
                <span className="text-xs text-slate-400">{config.text}</span>
            </div>

            {/* Alert badge */}
            {unreadCount > 0 && (
                <div className="relative">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs"
                    >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {unreadCount}
                    </motion.div>
                </div>
            )}
        </div>
    );
}

// Compact version for mobile
export function ConnectionDot() {
    const { quality } = useConnectionStatus();

    const colors = {
        good: 'bg-emerald-500',
        degraded: 'bg-amber-500',
        disconnected: 'bg-red-500',
    };

    return <div className={`w-2 h-2 rounded-full ${colors[quality]}`} />;
}

// Alert dropdown
export function AlertDropdown() {
    const { alerts, unreadCount, acknowledgeAll, clearAlerts } = useAlerts();

    if (alerts.length === 0) {
        return (
            <div className="p-4 text-center text-slate-500 text-sm">
                No recent alerts
            </div>
        );
    }

    const alertLevelColors = {
        info: 'text-blue-400 bg-blue-500/10',
        warning: 'text-amber-400 bg-amber-500/10',
        error: 'text-red-400 bg-red-500/10',
    };

    return (
        <div className="w-80">
            <div className="flex items-center justify-between p-3 border-b border-white/5">
                <span className="text-sm font-medium text-slate-200">
                    Alerts {unreadCount > 0 && `(${unreadCount} new)`}
                </span>
                <div className="flex gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={acknowledgeAll}
                            className="text-xs text-slate-400 hover:text-slate-200"
                        >
                            Mark read
                        </button>
                    )}
                    <button
                        onClick={clearAlerts}
                        className="text-xs text-slate-400 hover:text-slate-200"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
                {alerts.map((alert, i) => (
                    <div
                        key={alert.timestamp + i}
                        className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className={`px-2 py-0.5 rounded text-xs ${
                                    alertLevelColors[alert.data.level as keyof typeof alertLevelColors] || alertLevelColors.info
                                }`}
                            >
                                {alert.data.level}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200 truncate">
                                    {alert.data.message}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {alert.agentId && `${alert.agentId} • `}
                                    {new Date(alert.timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ConnectionStatus;
