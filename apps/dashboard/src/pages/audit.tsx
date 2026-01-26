import Layout from '../components/Layout'
import { AuditTimeline } from '../components/AuditTimeline'
import { GroupedAgentSelect } from '../components/GroupedAgentSelect'
import { useState } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

const EVENT_TYPES = [
    { value: '', label: 'All Types' },
    { value: 'action', label: 'Actions' },
    { value: 'decision', label: 'Decisions' },
    { value: 'escalation', label: 'Escalations' },
    { value: 'approval', label: 'Approvals' },
    { value: 'rejection', label: 'Rejections' },
    { value: 'error', label: 'Errors' },
];

const FRAMEWORKS = [
    { value: '', label: 'All Frameworks' },
    { value: 'vorion', label: 'Vorion' },
    { value: 'bmad', label: 'BMAD' },
];

export default function Audit() {
    const [agentFilter, setAgentFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [frameworkFilter, setFrameworkFilter] = useState('');

    const { data: stats } = useSWR('/api/audit/events?limit=1000', fetcher, { refreshInterval: 30000 });

    // Calculate stats
    const events = stats?.events || [];
    const successCount = events.filter((e: any) => e.success).length;
    const errorCount = events.filter((e: any) => !e.success).length;
    const escalationCount = events.filter((e: any) => e.eventType === 'escalation').length;

    // Calculate framework stats
    const vorionCount = events.filter((e: any) => {
        const agent = (e.agentId || '').toLowerCase();
        return agent.startsWith('vorion') || ['architect', 'scribe', 'sentinel', 'builder', 'tester', 'council'].includes(agent);
    }).length;
    const bmadCount = events.filter((e: any) => {
        const agent = (e.agentId || '').toLowerCase();
        return agent.startsWith('bmad') || agent.includes('bmm') || agent.includes('bmb') || agent.includes('cis');
    }).length;

    return (
        <Layout title="Audit Trail">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                        Audit Trail
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Immutable event log with hash chain verification
                    </p>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-3">
                    <div className="bg-white/5 rounded-lg px-4 py-2 text-center">
                        <div className="text-2xl font-bold text-slate-200">{events.length}</div>
                        <div className="text-xs text-slate-500">Total</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg px-4 py-2 text-center">
                        <div className="text-2xl font-bold text-emerald-400">{successCount}</div>
                        <div className="text-xs text-slate-500">Success</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg px-4 py-2 text-center">
                        <div className="text-2xl font-bold text-red-400">{errorCount}</div>
                        <div className="text-xs text-slate-500">Errors</div>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg px-4 py-2 text-center">
                        <div className="text-2xl font-bold text-amber-400">{escalationCount}</div>
                        <div className="text-xs text-slate-500">Escalations</div>
                    </div>
                </div>
            </div>

            {/* Framework Stats */}
            <div className="flex gap-4 mb-6">
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                    <div>
                        <div className="text-lg font-bold text-cyan-400">{vorionCount}</div>
                        <div className="text-xs text-slate-500">Vorion Events</div>
                    </div>
                </div>
                <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                    <div>
                        <div className="text-lg font-bold text-violet-400">{bmadCount}</div>
                        <div className="text-xs text-slate-500">BMAD Events</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                <GroupedAgentSelect
                    value={agentFilter}
                    onChange={setAgentFilter}
                    placeholder="All Agents"
                    showIcons={true}
                />

                <select
                    value={frameworkFilter}
                    onChange={(e) => setFrameworkFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                >
                    {FRAMEWORKS.map(fw => (
                        <option key={fw.value} value={fw.value} className="bg-[#0a0a0a]">
                            {fw.label}
                        </option>
                    ))}
                </select>

                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                >
                    {EVENT_TYPES.map(type => (
                        <option key={type.value} value={type.value} className="bg-[#0a0a0a]">
                            {type.label}
                        </option>
                    ))}
                </select>

                {(agentFilter || typeFilter || frameworkFilter) && (
                    <button
                        onClick={() => {
                            setAgentFilter('');
                            setTypeFilter('');
                            setFrameworkFilter('');
                        }}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Timeline */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
                <AuditTimeline
                    agentFilter={agentFilter || undefined}
                    typeFilter={typeFilter || undefined}
                    limit={100}
                />
            </div>
        </Layout>
    )
}
