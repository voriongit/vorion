import React from 'react';

/**
 * Connection Status Modal
 * 
 * Explains the difference between LIVE and DEMO modes,
 * shows connection status, and provides troubleshooting tips.
 */

interface ConnectionStatusModalProps {
    isConnected: boolean;
    persistenceMode?: 'postgres' | 'memory';
    onClose: () => void;
}

export const ConnectionStatusModal: React.FC<ConnectionStatusModalProps> = ({
    isConnected,
    persistenceMode,
    onClose,
}) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                <div className="modal-header">
                    <h2>{isConnected ? '🟢 Live Mode' : '🔵 Demo Mode'}</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-content">
                    {/* Current Status */}
                    <div style={{
                        background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        border: `1px solid ${isConnected ? 'var(--accent-green)' : 'var(--accent-blue)'}`,
                        borderRadius: 'var(--radius-lg)',
                        padding: '24px',
                        textAlign: 'center',
                        marginBottom: '24px',
                    }}>
                        <div style={{
                            fontSize: '3rem',
                            marginBottom: '12px',
                        }}>
                            {isConnected ? '📡' : '🎭'}
                        </div>
                        <div style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: isConnected ? 'var(--accent-green)' : 'var(--accent-blue)',
                            marginBottom: '8px',
                        }}>
                            {isConnected ? 'Connected to API' : 'Using Demo Data'}
                        </div>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                        }}>
                            {isConnected
                                ? 'Real-time data from your backend server'
                                : 'Simulated data for demonstration purposes'
                            }
                        </div>
                    </div>

                    {/* Persistence Status */}
                    <div style={{
                        marginBottom: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{
                            padding: '16px',
                            background: persistenceMode === 'postgres' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${persistenceMode === 'postgres' ? 'var(--accent-green)' : 'var(--accent-gold)'}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>
                                    {persistenceMode === 'postgres' ? '💾' : '⚠️'}
                                </span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {persistenceMode === 'postgres' ? 'Persistent Storage Active' : 'Volatile Storage (Demo)'}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                {persistenceMode === 'postgres'
                                    ? 'Connected to Vercel Postgres. Tasks, agents, and history are saved safely.'
                                    : 'Using in-memory storage. All agents and history will be reset when the server restarts or deploys. Connect a database to save progress.'}
                            </div>
                        </div>
                    </div>


            {/* Connection Info */}
            <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
            }}>
                <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.9rem' }}>
                    ⚙️ Connection Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>API Endpoint:</span>
                        <code style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>/api/*</code>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                        <span style={{ color: isConnected ? 'var(--accent-green)' : 'var(--accent-gold)' }}>
                            {isConnected ? 'Connected' : 'Fallback Active'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Data Source:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            {isConnected ? 'Vercel Serverless' : 'Client-side Fallback'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tips */}
            {!isConnected && (
                <div style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '3px solid var(--accent-gold)',
                }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--accent-gold)' }}>💡 Tip:</strong> To enable live mode,
                        ensure the API endpoints are responding. The UI will automatically detect and switch
                        to live data when available.
                    </div>
                </div>
            )}
        </div>
            </div >
        </div >
    );
};

export default ConnectionStatusModal;
