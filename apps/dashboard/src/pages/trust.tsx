/**
 * Trust Dashboard Page
 * Comprehensive view of agent trust scores and history
 */

import Layout from '../components/Layout';
import { TrustRadar, TrustTierBadge } from '../components/TrustRadar';
import { TrustHistory, TrustSummary } from '../components/TrustHistory';
import { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const AGENTS = [
    { id: 'herald', name: 'Herald', role: 'Interface & Routing' },
    { id: 'sentinel', name: 'Sentinel', role: 'Governance & Audit' },
    { id: 'watchman', name: 'Watchman', role: 'SRE & Monitoring' },
    { id: 'envoy', name: 'Envoy', role: 'Growth & Content' },
    { id: 'scribe', name: 'Scribe', role: 'Documentation' },
    { id: 'librarian', name: 'Librarian', role: 'Knowledge Management' },
    { id: 'curator', name: 'Curator', role: 'Hygiene & Cleanup' },
    { id: 'ts-fixer', name: 'TS-Fixer', role: 'TypeScript Repair' },
    { id: 'council', name: 'Council', role: 'Supervisory Body' },
];

export default function Trust() {
    const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]?.id ?? 'herald');

    const { data: trustData, error } = useSWR(
        `/api/trust/${selectedAgent}`,
        fetcher,
        { refreshInterval: 30000 }
    );

    const isLoading = !trustData && !error;

    return (
        <Layout title="Trust Scores">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                    Trust Scores
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Multi-dimensional trust evaluation across the agent fleet
                </p>
            </div>

            {/* Agent Selector */}
            <div className="flex flex-wrap gap-2 mb-6">
                {AGENTS.map(agent => (
                    <button
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedAgent === agent.id
                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                        }`}
                    >
                        {agent.name}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center h-96"
                    >
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent" />
                    </motion.div>
                ) : error ? (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center text-red-400 py-12"
                    >
                        Failed to load trust data
                    </motion.div>
                ) : (
                    <motion.div
                        key={selectedAgent}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Agent Header */}
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6 mb-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-2xl font-bold text-white">
                                            {trustData.agentName}
                                        </h2>
                                        <TrustTierBadge tier={trustData.tier} score={trustData.overall} />
                                    </div>
                                    <p className="text-slate-500">
                                        {AGENTS.find(a => a.id === selectedAgent)?.role}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                                        {trustData.overall}
                                    </div>
                                    <div className="text-sm text-slate-500">Overall Score</div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Radar Chart */}
                            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
                                <h3 className="text-lg font-semibold text-slate-200 mb-4">
                                    Trust Dimensions
                                </h3>
                                <div className="flex justify-center">
                                    <TrustRadar dimensions={trustData.dimensions} size={320} />
                                </div>
                            </div>

                            {/* Dimension Details */}
                            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
                                <h3 className="text-lg font-semibold text-slate-200 mb-4">
                                    Dimension Breakdown
                                </h3>
                                <div className="space-y-4">
                                    {trustData.dimensions.map((dim: any) => (
                                        <div key={dim.name}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm text-slate-300">{dim.name}</span>
                                                <span className="text-sm font-bold text-cyan-400">{dim.score}</span>
                                            </div>
                                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${dim.score}%` }}
                                                    transition={{ duration: 0.5, delay: 0.1 }}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">{dim.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* History Chart */}
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6 mb-6">
                            <h3 className="text-lg font-semibold text-slate-200 mb-4">
                                Trust History (30 Days)
                            </h3>
                            <TrustSummary history={trustData.history} className="mb-6" />
                            <TrustHistory
                                history={trustData.history}
                                height={250}
                                showDimensions={true}
                            />
                        </div>

                        {/* Recommendations */}
                        {trustData.recommendations && trustData.recommendations.length > 0 && (
                            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
                                <h3 className="text-lg font-semibold text-slate-200 mb-4">
                                    Recommendations
                                </h3>
                                <ul className="space-y-2">
                                    {trustData.recommendations.map((rec: string, i: number) => (
                                        <li
                                            key={i}
                                            className="flex items-start gap-3 text-slate-400"
                                        >
                                            <span className="text-cyan-400 mt-1">→</span>
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </Layout>
    );
}
