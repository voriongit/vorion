import Layout from '../components/Layout'
import { useState } from 'react'
import {
    BOOTSTRAP_AGENTS,
    BMAD_CORE_AGENTS,
    BMAD_BMB_AGENTS,
    BMAD_BMM_AGENTS,
    BMAD_CIS_AGENTS,
    type AgentDefinition,
    type AgentArchetype,
} from '../lib/agents'

// Archetype colors
const ARCHETYPE_COLORS: Record<AgentArchetype, string> = {
    advisor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    chronicler: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    validator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    executor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    builder: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    orchestrator: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

function AgentCard({ agent }: { agent: AgentDefinition }) {
    return (
        <div className={`bg-white/5 border ${agent.borderColor} rounded-xl p-4 hover:bg-white/10 transition-colors`}>
            <div className="flex items-start gap-3">
                {agent.icon && (
                    <span className="text-2xl">{agent.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-semibold ${agent.textColor}`}>
                            {agent.name}
                        </h3>
                        {agent.persona && (
                            <span className="text-xs text-slate-500">
                                ({agent.persona})
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                        {agent.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <span className={`text-xs px-2 py-0.5 rounded border ${ARCHETYPE_COLORS[agent.archetype]}`}>
                            {agent.archetype}
                        </span>
                        <span className="text-xs text-slate-600">
                            {agent.id}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AgentSection({
    title,
    description,
    agents,
    color,
}: {
    title: string;
    description: string;
    agents: Record<string, AgentDefinition>;
    color: string;
}) {
    const agentList = Object.values(agents);

    return (
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-1 h-8 rounded ${color}`}></div>
                <div>
                    <h2 className="text-xl font-bold text-slate-200">{title}</h2>
                    <p className="text-sm text-slate-500">{description}</p>
                </div>
                <span className="ml-auto text-sm text-slate-600">
                    {agentList.length} agents
                </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agentList.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                ))}
            </div>
        </div>
    );
}

export default function Agents() {
    const [searchQuery, setSearchQuery] = useState('');
    const [archetypeFilter, setArchetypeFilter] = useState<string>('');

    // Get total counts
    const vorionCount = Object.keys(BOOTSTRAP_AGENTS).length;
    const bmadCount =
        Object.keys(BMAD_CORE_AGENTS).length +
        Object.keys(BMAD_BMB_AGENTS).length +
        Object.keys(BMAD_BMM_AGENTS).length +
        Object.keys(BMAD_CIS_AGENTS).length;

    // Filter agents
    const filterAgents = (agents: Record<string, AgentDefinition>) => {
        return Object.fromEntries(
            Object.entries(agents).filter(([_, agent]) => {
                const matchesSearch =
                    !searchQuery ||
                    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (agent.persona || '').toLowerCase().includes(searchQuery.toLowerCase());

                const matchesArchetype =
                    !archetypeFilter || agent.archetype === archetypeFilter;

                return matchesSearch && matchesArchetype;
            })
        );
    };

    const archetypes: AgentArchetype[] = ['advisor', 'chronicler', 'validator', 'executor', 'builder', 'orchestrator'];

    return (
        <Layout title="Agents">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-600">
                        Agent Registry
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {vorionCount + bmadCount} agents across Vorion and BMAD frameworks
                    </p>
                </div>

                {/* Stats */}
                <div className="flex gap-4">
                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg px-4 py-2">
                        <div className="text-2xl font-bold text-cyan-400">{vorionCount}</div>
                        <div className="text-xs text-slate-500">Vorion</div>
                    </div>
                    <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-lg px-4 py-2">
                        <div className="text-2xl font-bold text-violet-400">{bmadCount}</div>
                        <div className="text-xs text-slate-500">BMAD</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search agents..."
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-64"
                />

                <select
                    value={archetypeFilter}
                    onChange={(e) => setArchetypeFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                >
                    <option value="" className="bg-[#0a0a0a]">All Archetypes</option>
                    {archetypes.map((archetype) => (
                        <option key={archetype} value={archetype} className="bg-[#0a0a0a]">
                            {archetype.charAt(0).toUpperCase() + archetype.slice(1)}
                        </option>
                    ))}
                </select>

                {(searchQuery || archetypeFilter) && (
                    <button
                        onClick={() => {
                            setSearchQuery('');
                            setArchetypeFilter('');
                        }}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Vorion Section */}
            <AgentSection
                title="Vorion Bootstrap"
                description="Core autonomous agent infrastructure"
                agents={filterAgents(BOOTSTRAP_AGENTS)}
                color="bg-cyan-500"
            />

            {/* BMAD Sections */}
            <AgentSection
                title="BMAD Core"
                description="Orchestration and knowledge management"
                agents={filterAgents(BMAD_CORE_AGENTS)}
                color="bg-violet-500"
            />

            <AgentSection
                title="BMAD BMB (Building Module)"
                description="Agent, module, and workflow creation"
                agents={filterAgents(BMAD_BMB_AGENTS)}
                color="bg-rose-500"
            />

            <AgentSection
                title="BMAD BMM (Modern Method)"
                description="Software development workflow agents"
                agents={filterAgents(BMAD_BMM_AGENTS)}
                color="bg-emerald-500"
            />

            <AgentSection
                title="BMAD CIS (Creative Innovation)"
                description="Innovation, strategy, and creative agents"
                agents={filterAgents(BMAD_CIS_AGENTS)}
                color="bg-amber-500"
            />
        </Layout>
    );
}
