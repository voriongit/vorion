/**
 * Settings Page - System Configuration
 */
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface PageContext {
    hitlLevel: number;
    refresh: () => Promise<void>;
}

export function SettingsPage() {
    const ctx = useOutletContext<PageContext>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const activeTab = searchParams.get('tab') || 'general';
    const [apiUrl, setApiUrl] = useState('http://127.0.0.1:3003');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

    const testConnection = async () => {
        setTestStatus('testing');
        try {
            const res = await fetch(`${apiUrl}/health`, { method: 'GET' });
            setTestStatus(res.ok ? 'success' : 'error');
        } catch {
            setTestStatus('error');
        }
    };

    return (
        <div className="page-content" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>⚙️ Settings</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <button
                    className={`btn btn-small ${activeTab === 'general' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => navigate('/settings?tab=general')}
                >
                    General
                </button>
                <button
                    className={`btn btn-small ${activeTab === 'connections' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => navigate('/settings?tab=connections')}
                >
                    Connections
                </button>
            </div>

            {/* Connection Settings Tab */}
            {activeTab === 'connections' && (
                <div className="settings-section" style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>🔌 API Connection</h2>
                    
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            API Server URL
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={apiUrl}
                                onChange={e => setApiUrl(e.target.value)}
                                className="spawn-input"
                                style={{ flex: 1 }}
                                placeholder="http://127.0.0.1:3003"
                            />
                            <button
                                className="btn btn-secondary"
                                onClick={testConnection}
                                disabled={testStatus === 'testing'}
                            >
                                {testStatus === 'testing' ? '⏳ Testing...' : '🔍 Test'}
                            </button>
                        </div>
                        {testStatus === 'success' && (
                            <div style={{ marginTop: '8px', color: 'var(--accent-green)', fontSize: '0.85rem' }}>
                                ✅ Connection successful!
                            </div>
                        )}
                        {testStatus === 'error' && (
                            <div style={{ marginTop: '8px', color: 'var(--accent-red)', fontSize: '0.85rem' }}>
                                ❌ Connection failed. Check URL and ensure server is running.
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong>Quick Start:</strong>
                        <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
                            <li>Open a terminal in the project root</li>
                            <li>Run <code style={{ color: 'var(--accent-cyan)' }}>npm run dev</code></li>
                            <li>API server will start on port 3003</li>
                        </ol>
                    </div>
                </div>
            )}

            {/* General Settings Tab */}
            {activeTab === 'general' && (
                <div className="settings-section" style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>🎛️ General Settings</h2>
                    
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            HITL Governance Level
                        </label>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
                            {ctx.hitlLevel}%
                        </div>
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => ctx.refresh()}
                    >
                        🔄 Refresh System State
                    </button>
                </div>
            )}
        </div>
    );
}
