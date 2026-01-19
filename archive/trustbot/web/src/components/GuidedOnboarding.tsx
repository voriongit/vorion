import { useState } from 'react';

/**
 * Guided Onboarding for MCP, RAG, and API Integrations
 *
 * Step-by-step wizard to help users configure external integrations.
 */

interface GuidedOnboardingProps {
    onClose: () => void;
    onComplete?: (config: IntegrationConfig) => void;
}

interface IntegrationConfig {
    mcp: MCPConfig;
    rag: RAGConfig;
    apis: APIConfig[];
}

interface MCPConfig {
    enabled: boolean;
    servers: MCPServer[];
}

interface MCPServer {
    id: string;
    name: string;
    command: string;
    args: string[];
    enabled: boolean;
}

interface RAGConfig {
    enabled: boolean;
    provider: 'local' | 'pinecone' | 'weaviate' | 'chromadb';
    indexName: string;
    embedModel: string;
}

interface APIConfig {
    id: string;
    name: string;
    type: 'rest' | 'graphql' | 'webhook';
    endpoint: string;
    authType: 'none' | 'api_key' | 'oauth' | 'bearer';
    enabled: boolean;
}

const MCP_TEMPLATES: Omit<MCPServer, 'id'>[] = [
    { name: 'Filesystem', command: 'npx', args: ['-y', '@anthropic/mcp-server-filesystem', './'], enabled: false },
    { name: 'GitHub', command: 'npx', args: ['-y', '@anthropic/mcp-server-github'], enabled: false },
    { name: 'Brave Search', command: 'npx', args: ['-y', '@anthropic/mcp-server-brave-search'], enabled: false },
    { name: 'Postgres', command: 'npx', args: ['-y', '@anthropic/mcp-server-postgres'], enabled: false },
    { name: 'Puppeteer', command: 'npx', args: ['-y', '@anthropic/mcp-server-puppeteer'], enabled: false },
];

const RAG_PROVIDERS = [
    { id: 'local', name: 'Local Vector Store', description: 'File-based, no external service', icon: '💾' },
    { id: 'pinecone', name: 'Pinecone', description: 'Managed vector database', icon: '🌲' },
    { id: 'weaviate', name: 'Weaviate', description: 'Open-source vector search', icon: '🔷' },
    { id: 'chromadb', name: 'ChromaDB', description: 'AI-native embedding database', icon: '🎨' },
];

const API_TEMPLATES = [
    { name: 'Slack', type: 'rest' as const, endpoint: 'https://slack.com/api/', authType: 'bearer' as const },
    { name: 'Jira', type: 'rest' as const, endpoint: 'https://your-domain.atlassian.net/rest/api/3/', authType: 'bearer' as const },
    { name: 'GitHub API', type: 'rest' as const, endpoint: 'https://api.github.com/', authType: 'bearer' as const },
    { name: 'Custom Webhook', type: 'webhook' as const, endpoint: '', authType: 'none' as const },
];

type Step = 'intro' | 'mcp' | 'rag' | 'apis' | 'review';

export function GuidedOnboarding({ onClose, onComplete }: GuidedOnboardingProps) {
    const [step, setStep] = useState<Step>('intro');
    const [config, setConfig] = useState<IntegrationConfig>({
        mcp: { enabled: false, servers: [] },
        rag: { enabled: false, provider: 'local', indexName: 'aurais-index', embedModel: 'text-embedding-3-small' },
        apis: [],
    });

    const steps: { id: Step; label: string; icon: string }[] = [
        { id: 'intro', label: 'Welcome', icon: '👋' },
        { id: 'mcp', label: 'MCP Servers', icon: '🔌' },
        { id: 'rag', label: 'RAG Setup', icon: '🧠' },
        { id: 'apis', label: 'API Integrations', icon: '🔗' },
        { id: 'review', label: 'Review', icon: '✅' },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === step);
    const progress = ((currentStepIndex) / (steps.length - 1)) * 100;

    const handleToggleMCPServer = (serverName: string) => {
        setConfig(prev => {
            const existing = prev.mcp.servers.find(s => s.name === serverName);
            if (existing) {
                return {
                    ...prev,
                    mcp: {
                        ...prev.mcp,
                        servers: prev.mcp.servers.filter(s => s.name !== serverName),
                    },
                };
            } else {
                const template = MCP_TEMPLATES.find(t => t.name === serverName);
                if (template) {
                    return {
                        ...prev,
                        mcp: {
                            enabled: true,
                            servers: [...prev.mcp.servers, { id: `mcp-${Date.now()}`, ...template, enabled: true }],
                        },
                    };
                }
            }
            return prev;
        });
    };

    const handleAddAPI = (template: typeof API_TEMPLATES[0]) => {
        setConfig(prev => ({
            ...prev,
            apis: [...prev.apis, { id: `api-${Date.now()}`, ...template, enabled: true }],
        }));
    };

    const handleComplete = () => {
        onComplete?.(config);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '700px', maxHeight: '90vh' }}
            >
                {/* Header with Progress */}
                <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '1.5rem' }}>⚙️</span>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Integration Setup</h2>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Configure MCP, RAG, and external APIs
                                </p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '8px',
                            }}>
                                {steps.map((s, i) => (
                                    <div
                                        key={s.id}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px',
                                            opacity: i <= currentStepIndex ? 1 : 0.4,
                                        }}
                                    >
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: i < currentStepIndex
                                                ? 'var(--accent-green)'
                                                : i === currentStepIndex
                                                    ? 'var(--accent-blue)'
                                                    : 'var(--bg-lighter)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.9rem',
                                        }}>
                                            {i < currentStepIndex ? '✓' : s.icon}
                                        </div>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                            {s.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div style={{
                                height: '4px',
                                background: 'var(--bg-lighter)',
                                borderRadius: '2px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                                    borderRadius: '2px',
                                    transition: 'width 0.3s ease',
                                }} />
                            </div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Content */}
                <div style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(90vh - 200px)' }}>
                    {/* Intro Step */}
                    {step === 'intro' && (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🚀</div>
                            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem' }}>
                                Welcome to Integration Setup
                            </h3>
                            <p style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem',
                                lineHeight: 1.6,
                                maxWidth: '500px',
                                margin: '0 auto 24px',
                            }}>
                                This wizard will help you configure external integrations for your Aurais agents.
                                You can set up MCP servers for extended capabilities, RAG for knowledge retrieval,
                                and connect to external APIs.
                            </p>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '16px',
                                textAlign: 'left',
                            }}>
                                {[
                                    { icon: '🔌', title: 'MCP Servers', desc: 'Model Context Protocol for extended tools' },
                                    { icon: '🧠', title: 'RAG Setup', desc: 'Retrieval-Augmented Generation for knowledge' },
                                    { icon: '🔗', title: 'API Integrations', desc: 'Connect to Slack, Jira, and more' },
                                ].map(item => (
                                    <div key={item.title} style={{
                                        padding: '16px',
                                        background: 'var(--bg-card)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '8px' }}>
                                            {item.title}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {item.desc}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* MCP Step */}
                    {step === 'mcp' && (
                        <div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>
                                🔌 MCP Servers
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                                MCP (Model Context Protocol) servers extend agent capabilities with tools like file access,
                                web browsing, and database queries.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {MCP_TEMPLATES.map(server => {
                                    const isEnabled = config.mcp.servers.some(s => s.name === server.name);
                                    return (
                                        <div
                                            key={server.name}
                                            onClick={() => handleToggleMCPServer(server.name)}
                                            style={{
                                                padding: '14px',
                                                background: isEnabled ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
                                                border: isEnabled ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                            }}
                                        >
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '6px',
                                                background: isEnabled ? 'var(--accent-blue)' : 'var(--bg-lighter)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '0.8rem',
                                            }}>
                                                {isEnabled ? '✓' : ''}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                    {server.name}
                                                </div>
                                                <code style={{
                                                    fontSize: '0.7rem',
                                                    color: 'var(--text-muted)',
                                                    background: 'var(--bg-lighter)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                }}>
                                                    {server.command} {server.args.join(' ')}
                                                </code>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{
                                marginTop: '16px',
                                padding: '12px',
                                background: 'rgba(245, 158, 11, 0.1)',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                color: 'var(--accent-gold)',
                            }}>
                                💡 Tip: You can add custom MCP servers later in Settings → Integrations
                            </div>
                        </div>
                    )}

                    {/* RAG Step */}
                    {step === 'rag' && (
                        <div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>
                                🧠 RAG Configuration
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                                Retrieval-Augmented Generation allows agents to query your knowledge base for relevant context.
                            </p>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    marginBottom: '16px',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={config.rag.enabled}
                                        onChange={e => setConfig(prev => ({
                                            ...prev,
                                            rag: { ...prev.rag, enabled: e.target.checked },
                                        }))}
                                        style={{ width: '20px', height: '20px' }}
                                    />
                                    <span style={{ fontWeight: 600 }}>Enable RAG</span>
                                </label>

                                {config.rag.enabled && (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: '10px',
                                    }}>
                                        {RAG_PROVIDERS.map(provider => (
                                            <div
                                                key={provider.id}
                                                onClick={() => setConfig(prev => ({
                                                    ...prev,
                                                    rag: { ...prev.rag, provider: provider.id as RAGConfig['provider'] },
                                                }))}
                                                style={{
                                                    padding: '14px',
                                                    background: config.rag.provider === provider.id
                                                        ? 'rgba(139, 92, 246, 0.1)'
                                                        : 'var(--bg-card)',
                                                    border: config.rag.provider === provider.id
                                                        ? '2px solid var(--accent-purple)'
                                                        : '1px solid var(--border-color)',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.5rem' }}>{provider.icon}</span>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '8px' }}>
                                                    {provider.name}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {provider.description}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {config.rag.enabled && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                            Index Name
                                        </label>
                                        <input
                                            type="text"
                                            value={config.rag.indexName}
                                            onChange={e => setConfig(prev => ({
                                                ...prev,
                                                rag: { ...prev.rag, indexName: e.target.value },
                                            }))}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '6px',
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                            Embedding Model
                                        </label>
                                        <select
                                            value={config.rag.embedModel}
                                            onChange={e => setConfig(prev => ({
                                                ...prev,
                                                rag: { ...prev.rag, embedModel: e.target.value },
                                            }))}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '6px',
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            <option value="text-embedding-3-small">text-embedding-3-small</option>
                                            <option value="text-embedding-3-large">text-embedding-3-large</option>
                                            <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* APIs Step */}
                    {step === 'apis' && (
                        <div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>
                                🔗 API Integrations
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                                Connect to external services to enable agents to interact with your tools.
                            </p>

                            {/* Add from templates */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '10px' }}>
                                    Quick Add
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {API_TEMPLATES.map(template => (
                                        <button
                                            key={template.name}
                                            onClick={() => handleAddAPI(template)}
                                            disabled={config.apis.some(a => a.name === template.name)}
                                            style={{
                                                padding: '8px 14px',
                                                background: config.apis.some(a => a.name === template.name)
                                                    ? 'var(--bg-lighter)'
                                                    : 'var(--bg-card)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '20px',
                                                color: config.apis.some(a => a.name === template.name)
                                                    ? 'var(--text-muted)'
                                                    : 'var(--text-primary)',
                                                fontSize: '0.8rem',
                                                cursor: config.apis.some(a => a.name === template.name)
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                            }}
                                        >
                                            {config.apis.some(a => a.name === template.name) ? '✓ ' : '+ '}
                                            {template.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Added APIs */}
                            {config.apis.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '10px' }}>
                                        Configured APIs ({config.apis.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {config.apis.map(api => (
                                            <div
                                                key={api.id}
                                                style={{
                                                    padding: '12px',
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                }}
                                            >
                                                <span style={{
                                                    padding: '4px 8px',
                                                    background: 'var(--accent-blue)',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {api.type}
                                                </span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                        {api.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        {api.endpoint || 'No endpoint configured'}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setConfig(prev => ({
                                                        ...prev,
                                                        apis: prev.apis.filter(a => a.id !== api.id),
                                                    }))}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--accent-red)',
                                                        cursor: 'pointer',
                                                        fontSize: '1rem',
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {config.apis.length === 0 && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '30px',
                                    color: 'var(--text-muted)',
                                    background: 'var(--bg-card)',
                                    borderRadius: '12px',
                                    border: '2px dashed var(--border-color)',
                                }}>
                                    <span style={{ fontSize: '1.5rem' }}>🔗</span>
                                    <p style={{ margin: '8px 0 0' }}>No APIs configured yet</p>
                                    <p style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>Click a template above to add</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Review Step */}
                    {step === 'review' && (
                        <div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>
                                ✅ Review Configuration
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                                Review your integration setup before saving.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* MCP Summary */}
                                <div style={{
                                    padding: '16px',
                                    background: 'var(--bg-card)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '1.25rem' }}>🔌</span>
                                        <span style={{ fontWeight: 600 }}>MCP Servers</span>
                                        <span style={{
                                            padding: '2px 8px',
                                            background: config.mcp.servers.length > 0 ? 'var(--accent-green)' : 'var(--bg-lighter)',
                                            color: config.mcp.servers.length > 0 ? 'white' : 'var(--text-muted)',
                                            borderRadius: '10px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                        }}>
                                            {config.mcp.servers.length} enabled
                                        </span>
                                    </div>
                                    {config.mcp.servers.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {config.mcp.servers.map(s => (
                                                <span key={s.id} style={{
                                                    padding: '4px 10px',
                                                    background: 'var(--bg-lighter)',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                }}>
                                                    {s.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No servers configured</span>
                                    )}
                                </div>

                                {/* RAG Summary */}
                                <div style={{
                                    padding: '16px',
                                    background: 'var(--bg-card)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '1.25rem' }}>🧠</span>
                                        <span style={{ fontWeight: 600 }}>RAG</span>
                                        <span style={{
                                            padding: '2px 8px',
                                            background: config.rag.enabled ? 'var(--accent-purple)' : 'var(--bg-lighter)',
                                            color: config.rag.enabled ? 'white' : 'var(--text-muted)',
                                            borderRadius: '10px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                        }}>
                                            {config.rag.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                    {config.rag.enabled ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            Provider: {RAG_PROVIDERS.find(p => p.id === config.rag.provider)?.name}<br />
                                            Index: {config.rag.indexName}<br />
                                            Model: {config.rag.embedModel}
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RAG not enabled</span>
                                    )}
                                </div>

                                {/* APIs Summary */}
                                <div style={{
                                    padding: '16px',
                                    background: 'var(--bg-card)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '1.25rem' }}>🔗</span>
                                        <span style={{ fontWeight: 600 }}>API Integrations</span>
                                        <span style={{
                                            padding: '2px 8px',
                                            background: config.apis.length > 0 ? 'var(--accent-blue)' : 'var(--bg-lighter)',
                                            color: config.apis.length > 0 ? 'white' : 'var(--text-muted)',
                                            borderRadius: '10px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                        }}>
                                            {config.apis.length} configured
                                        </span>
                                    </div>
                                    {config.apis.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {config.apis.map(a => (
                                                <span key={a.id} style={{
                                                    padding: '4px 10px',
                                                    background: 'var(--bg-lighter)',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                }}>
                                                    {a.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No APIs configured</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                }}>
                    <button
                        onClick={() => {
                            const prevStep = steps[currentStepIndex - 1];
                            if (prevStep) setStep(prevStep.id);
                        }}
                        disabled={currentStepIndex === 0}
                        style={{
                            padding: '10px 20px',
                            background: currentStepIndex === 0 ? 'var(--bg-lighter)' : 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            color: currentStepIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                            fontSize: '0.85rem',
                            cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        ← Back
                    </button>

                    {step === 'review' ? (
                        <button
                            onClick={handleComplete}
                            style={{
                                padding: '10px 24px',
                                background: 'linear-gradient(135deg, var(--accent-green), #059669)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            ✓ Complete Setup
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                const nextStep = steps[currentStepIndex + 1];
                                if (nextStep) setStep(nextStep.id);
                            }}
                            style={{
                                padding: '10px 24px',
                                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Next →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GuidedOnboarding;
