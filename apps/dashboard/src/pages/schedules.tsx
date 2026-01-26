import Layout from '../components/Layout'
import { useState, useEffect } from 'react'

export default function Schedules() {
    const [schedules, setSchedules] = useState<any[]>([]);
    const [objective, setObjective] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/schedules').then(res => res.json()).then(data => {
            setSchedules(data.schedules);
            setObjective(data.objective);
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedules, objective })
        });
        setTimeout(() => setSaving(false), 500); // Visual feedback
    }

    const updateInterval = (index: number, val: string) => {
        const newSched = [...schedules];
        newSched[index].intervalHours = parseFloat(val);
        setSchedules(newSched);
    }

    return (
        <Layout title="Schedules">
            <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
                Operations & Objectives
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Section 1: Daily Objective */}
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">🎯</div>
                        <h2 className="text-xl font-bold">Daily Mission</h2>
                    </div>
                    <p className="text-slate-500 text-sm mb-4">
                        Specific instructions for the swarm today. All agents will prioritize this context.
                    </p>
                    <textarea 
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        className="w-full h-40 bg-[#111] border border-[#222] rounded-lg p-4 text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="e.g. Focus on improving the mobile responsive layout today..."
                    />
                </div>

                {/* Section 2: Shift Schedules */}
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                         <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">⏱️</div>
                         <h2 className="text-xl font-bold">Agent Shifts</h2>
                    </div>
                    <div className="space-y-4">
                        {schedules.map((job, i) => (
                            <div key={job.agent} className="flex items-center justify-between p-3 bg-[#111] rounded-lg border border-[#222]">
                                <div>
                                    <div className="font-bold uppercase text-xs tracking-wider text-slate-400 mb-1">{job.agent}</div>
                                    <div className="text-sm font-medium">{job.description}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Every</span>
                                    <input 
                                        type="number" 
                                        value={job.intervalHours} 
                                        onChange={(e) => updateInterval(i, e.target.value)}
                                        className="w-16 bg-[#050505] border border-[#333] rounded px-2 py-1 text-center font-mono text-sm focus:border-blue-500 outline-none"
                                    />
                                    <span className="text-xs text-slate-500">hours</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Save Action */}
            <div className="mt-8 flex justify-end">
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? 'Syncing...' : 'Save Configuration'}
                </button>
            </div>
        </Layout>
    )
}
