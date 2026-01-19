import { useState } from 'react';
import { workflowApi } from '../api';

/**
 * Human Authentication Modal
 *
 * Allows human operators to authenticate using the master key
 * to gain elevated privileges like adjusting aggressiveness.
 */

interface HumanAuthModalProps {
    onAuthenticated: (token: string) => void;
    onClose: () => void;
}

export function HumanAuthModal({ onAuthenticated, onClose }: HumanAuthModalProps) {
    const [masterKey, setMasterKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!masterKey.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const result = await workflowApi.getHumanToken(masterKey);
            onAuthenticated(result.tokenId);
        } catch (err) {
            setError('Invalid master key. Check the API server console for the correct key.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>🔐 Human Authentication</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-content">
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
                        Enter the master key from the API server to authenticate as a human operator.
                        This grants elevated privileges including aggressiveness control.
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)'
                        }}>
                            Master Key
                        </label>
                        <input
                            type="password"
                            value={masterKey}
                            onChange={e => setMasterKey(e.target.value)}
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            className="spawn-input"
                            style={{
                                width: '100%',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.85rem'
                            }}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid var(--accent-red)',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '16px',
                            fontSize: '0.85rem',
                            color: 'var(--accent-red)'
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                    }}>
                        <strong>Tip:</strong> The master key is displayed in the API server console when it starts.
                        Look for "🔑 MASTER KEY: xxx" in the terminal.
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !masterKey.trim()}
                            style={{
                                background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                            }}
                        >
                            {loading ? 'Authenticating...' : '🔓 Authenticate'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
