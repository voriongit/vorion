import { useState, useEffect } from 'react';
import { api, useSystemState } from '../api';
import type { ChatMessage, Agent } from '../types';

export const CommsDashboard = ({ onClose }: { onClose: () => void }) => {
    const { state } = useSystemState();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<string>('general');
    const [outgoingMsg, setOutgoingMsg] = useState('');
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'graph'>('chat');

    // Auto-refresh chat
    useEffect(() => {
        const fetch = () => {
            api.getChatMessages(selectedChannel)
                .then(msgs => setMessages(msgs))
                .catch(console.error);
        };
        fetch();
        const interval = setInterval(fetch, 2000);
        return () => clearInterval(interval);
    }, [selectedChannel]);

    const handleSend = async () => {
        if (!outgoingMsg.trim()) return;
        setSending(true);
        try {
            await api.sendChatMessage({
                channelId: selectedChannel,
                senderId: 'admin', // Simulation
                content: outgoingMsg,
                type: 'TEXT'
            });
            setOutgoingMsg('');
            // Optimistic update
            setMessages(prev => [...prev, {
                id: 'temp-' + Date.now(),
                channelId: selectedChannel,
                senderId: 'admin',
                content: outgoingMsg,
                timestamp: new Date().toISOString(),
                type: 'TEXT'
            }]);
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const agents = state?.agents || [];

    const getAgentName = (id: string) => {
        if (id === 'admin') return 'ADMIN (You)';
        return agents.find(a => a.id === id)?.name || id;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', height: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                {/* Header */}
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h2>💬 Neural Link</h2>
                        <div className="tab-group" style={{ display: 'flex', gap: '8px' }}>
                            <button className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('chat')}>
                                Secure Channels
                            </button>
                            <button className={`btn ${activeTab === 'graph' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('graph')}>
                                Trust Network 🕸️
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>

                {activeTab === 'chat' ? (
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                        {/* Sidebar */}
                        <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', overflowY: 'auto' }}>
                            <div style={{ padding: '16px' }}>
                                <small style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Channels</small>
                                <div
                                    onClick={() => setSelectedChannel('general')}
                                    style={{
                                        padding: '8px', cursor: 'pointer', borderRadius: '4px', marginTop: '8px',
                                        background: selectedChannel === 'general' ? 'var(--bg-selection)' : 'transparent',
                                        color: selectedChannel === 'general' ? 'var(--accent-blue)' : 'var(--text-primary)'
                                    }}
                                >
                                    # general
                                </div>
                                <div
                                    onClick={() => setSelectedChannel('alerts')}
                                    style={{
                                        padding: '8px', cursor: 'pointer', borderRadius: '4px',
                                        background: selectedChannel === 'alerts' ? 'var(--bg-selection)' : 'transparent',
                                        color: selectedChannel === 'alerts' ? 'var(--accent-red)' : 'var(--text-primary)'
                                    }}
                                >
                                    # system-alerts
                                </div>
                            </div>

                            <div style={{ padding: '16px', paddingTop: 0 }}>
                                <small style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Direct Messages</small>
                                {agents.map(agent => (
                                    <div
                                        key={agent.id}
                                        onClick={() => setSelectedChannel(`dm-${agent.id}`)}
                                        style={{
                                            padding: '8px', cursor: 'pointer', borderRadius: '4px', marginTop: '4px',
                                            background: selectedChannel === `dm-${agent.id}` ? 'var(--bg-selection)' : 'transparent',
                                            display: 'flex', alignItems: 'center', gap: '8px'
                                        }}
                                    >
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: agent.status === 'WORKING' ? 'var(--accent-green)' : 'var(--text-muted)' }} />
                                        {agent.name}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
                            <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
                                {selectedChannel.startsWith('dm-') ? `DM: ${getAgentName(selectedChannel.replace('dm-', ''))}` : `# ${selectedChannel}`}
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {messages.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20%' }}>No messages yet. Start the conversation.</div>}
                                {messages.map((msg, i) => {
                                    const isMe = msg.senderId === 'admin';
                                    return (
                                        <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                                            <div style={{ fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-muted)', textAlign: isMe ? 'right' : 'left' }}>
                                                {getAgentName(msg.senderId)} • {new Date(msg.timestamp).toLocaleTimeString()}
                                            </div>
                                            <div style={{
                                                padding: '10px 14px',
                                                borderRadius: '12px',
                                                borderTopRightRadius: isMe ? 0 : '12px',
                                                borderTopLeftRadius: isMe ? '12px' : 0,
                                                background: isMe ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                                                color: isMe ? 'white' : 'var(--text-primary)',
                                                border: isMe ? 'none' : '1px solid var(--border-color)'
                                            }}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px' }}>
                                <input
                                    type="text"
                                    value={outgoingMsg}
                                    onChange={e => setOutgoingMsg(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder={`Message ${selectedChannel}...`}
                                    style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'white' }}
                                />
                                <button onClick={handleSend} disabled={sending} className="btn btn-primary">
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
                        <TrustGraph agents={agents} />
                    </div>
                )}
            </div>
        </div>
    );
};

const TrustGraph = ({ agents }: { agents: Agent[] }) => {
    // Simple Circular Layout
    const width = 800;
    const height = 600;
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) / 3;

    const nodes = agents.map((agent, i) => {
        const angle = (i / agents.length) * 2 * Math.PI - (Math.PI / 2); // Start top
        return {
            ...agent,
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle)
        };
    });

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: '1000px' }}>
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="var(--border-color)" opacity="0.5" />
                    </marker>
                </defs>

                {/* Links (Mesh for now, showing potential comma) */}
                {nodes.map((source, i) => (
                    nodes.map((target, j) => {
                        if (i < j && (Math.abs(source.tier - target.tier) <= 1)) { // Link similar tiers
                            return (
                                <line
                                    key={`${source.id}-${target.id}`}
                                    x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                                    stroke="var(--border-color)"
                                    strokeWidth="1"
                                    opacity="0.2"
                                />
                            );
                        }
                        return null;
                    })
                ))}

                {/* Nodes */}
                {nodes.map(node => (
                    <g key={node.id} style={{ cursor: 'pointer' }}>
                        {/* Glow for high trust */}
                        {node.trustScore > 900 && <circle cx={node.x} cy={node.y} r="25" fill="var(--accent-gold)" opacity="0.2" filter="blur(4px)" />}

                        <circle
                            cx={node.x} cy={node.y} r="20"
                            fill="var(--bg-secondary)"
                            stroke={node.status === 'WORKING' ? 'var(--accent-green)' : 'var(--accent-blue)'}
                            strokeWidth="2"
                        />
                        <text
                            x={node.x} y={node.y} dy="5"
                            textAnchor="middle"
                            fill="var(--text-primary)"
                            fontSize="14"
                            fontWeight="bold"
                            pointerEvents="none"
                        >
                            {node.tier}
                        </text>
                        <text
                            x={node.x} y={node.y + 35}
                            textAnchor="middle"
                            fill="var(--text-primary)"
                            fontSize="12"
                            fontWeight="600"
                        >
                            {node.name.split('-')[1] || node.name}
                        </text>
                        <text
                            x={node.x} y={node.y + 50}
                            textAnchor="middle"
                            fill="var(--text-muted)"
                            fontSize="10"
                        >
                            Trust: {node.trustScore}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
};
