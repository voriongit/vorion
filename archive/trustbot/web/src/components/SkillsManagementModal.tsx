import { useState, useEffect } from 'react';
import { api } from '../api';

interface Skill {
    id: string;
    name: string;
    description: string;
    tier: number;
    price: number;
    capabilities: string[];
    category: string;
}

export const SkillsManagementModal = ({ onClose }: { onClose: () => void }) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [form, setForm] = useState({ name: '', description: '', tier: 1, price: 50, capabilities: '', category: 'TECH' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.getSkills().then(data => {
            if (Array.isArray(data)) setSkills(data);
        }).catch(console.error);
    }, []);

    const handleCreate = async () => {
        if (!form.name) return;
        setLoading(true);
        try {
            const newSkill = {
                ...form,
                capabilities: form.capabilities.split(',').map(s => s.trim()).filter(Boolean)
            };
            const created = await api.createSkill(newSkill);
            setSkills([...skills, created]);
            setForm({ name: '', description: '', tier: 1, price: 50, capabilities: '', category: 'TECH' });
        } catch (err) {
            console.error(err);
            alert('Failed to create skill. Check console.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>🔐 Skills Library (Admin Panel)</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>

                <div className="modal-content" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', flex: 1, overflow: 'hidden' }}>

                    {/* List */}
                    <div style={{ overflowY: 'auto', paddingRight: '8px' }}>
                        <h3 style={{ marginTop: 0 }}>Available Cartridges</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                            {skills.map(skill => (
                                <div key={skill.id} style={{
                                    background: 'var(--bg-secondary)',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ color: 'var(--accent-blue)' }}>{skill.name}</strong>
                                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Tier {skill.tier}</span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {skill.description}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {skill.capabilities.map(cap => (
                                            <span key={cap} style={{
                                                fontSize: '0.7rem',
                                                background: 'var(--bg-tertiary)',
                                                padding: '2px 6px',
                                                borderRadius: '4px'
                                            }}>
                                                {cap}
                                            </span>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 'auto', fontSize: '0.8rem', textAlign: 'right', fontWeight: 600 }}>
                                        💎 {skill.price} Trust
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Create Form */}
                    <div style={{
                        background: 'var(--bg-tertiary)',
                        padding: '20px',
                        borderRadius: '8px',
                        overflowY: 'auto'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Create New Skill</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Skill Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Quantitative Analysis"
                                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', height: '80px' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Tier Req.</label>
                                    <input type="number" value={form.tier} onChange={e => setForm({ ...form, tier: parseInt(e.target.value) })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Price (Trust)</label>
                                    <input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Category</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value })}
                                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                >
                                    <option value="TECH">TECH</option>
                                    <option value="FINANCE">FINANCE</option>
                                    <option value="LEGAL">LEGAL</option>
                                    <option value="GROWTH">GROWTH</option>
                                    <option value="OTHER">OTHER</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Capabilities (comma sep)</label>
                                <input
                                    type="text"
                                    value={form.capabilities}
                                    onChange={e => setForm({ ...form, capabilities: e.target.value })}
                                    placeholder="analyze, generate, audit"
                                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                />
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={loading || !form.name}
                                style={{
                                    background: 'var(--accent-blue)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    marginTop: '12px',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                {loading ? 'Creating...' : 'Create Cartridge'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
