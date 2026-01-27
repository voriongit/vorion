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
    { id: 'architect', name: 'Architect', role: 'Architecture & ADRs' },
    { id: 'scribe', name: 'Scribe', role: 'Documentation & Specs' },
    { id: 'sentinel', name: 'Sentinel', role: 'Security & Quality' },
    { id: 'builder', name: 'Builder', role: 'Implementation' },
    { id: 'tester', name: 'Tester', role: 'Test & Validation' },
    { id: 'council', name: 'Council', role: 'Governance' },
    { id: 'nexus', name: 'Nexus', role: 'Orchestration' },
    { id: 'herald', name: 'Herald', role: 'Command Routing' },
    { id: 'deployer', name: 'Deployer', role: 'Deployment' },
    { id: 'observer', name: 'Observer', role: 'Monitoring' },
];

// 12 Factors of Trust Definition
const TRUST_FACTORS = [
    {
        id: 1,
        name: 'Performance Reliability',
        icon: '🎯',
        description: 'Consistent task completion within expected parameters',
        borderColor: 'border-cyan-500/20',
        textColor: 'text-cyan-400',
    },
    {
        id: 2,
        name: 'Security Compliance',
        icon: '🔒',
        description: 'Adherence to security policies and safe operation boundaries',
        borderColor: 'border-emerald-500/20',
        textColor: 'text-emerald-400',
    },
    {
        id: 3,
        name: 'Data Integrity',
        icon: '💎',
        description: 'Accurate handling and transformation of data without loss or corruption',
        borderColor: 'border-violet-500/20',
        textColor: 'text-violet-400',
    },
    {
        id: 4,
        name: 'Availability',
        icon: '🟢',
        description: 'Uptime and responsiveness when needed for operations',
        borderColor: 'border-green-500/20',
        textColor: 'text-green-400',
    },
    {
        id: 5,
        name: 'Response Latency',
        icon: '⚡',
        description: 'Speed of task execution relative to complexity',
        borderColor: 'border-yellow-500/20',
        textColor: 'text-yellow-400',
    },
    {
        id: 6,
        name: 'Error Recovery',
        icon: '🔄',
        description: 'Graceful handling and recovery from failure states',
        borderColor: 'border-orange-500/20',
        textColor: 'text-orange-400',
    },
    {
        id: 7,
        name: 'Decision Quality',
        icon: '🧠',
        description: 'Accuracy and appropriateness of autonomous decisions',
        borderColor: 'border-indigo-500/20',
        textColor: 'text-indigo-400',
    },
    {
        id: 8,
        name: 'Transparency',
        icon: '👁️',
        description: 'Clear logging, reasoning trails, and explainable actions',
        borderColor: 'border-sky-500/20',
        textColor: 'text-sky-400',
    },
    {
        id: 9,
        name: 'Consistency',
        icon: '📊',
        description: 'Reproducible behavior given similar inputs and contexts',
        borderColor: 'border-blue-500/20',
        textColor: 'text-blue-400',
    },
    {
        id: 10,
        name: 'Resource Efficiency',
        icon: '⚙️',
        description: 'Optimal use of compute, memory, and external resources',
        borderColor: 'border-teal-500/20',
        textColor: 'text-teal-400',
    },
    {
        id: 11,
        name: 'Human Alignment',
        icon: '🤝',
        description: 'Appropriate escalation and deference to human oversight',
        borderColor: 'border-pink-500/20',
        textColor: 'text-pink-400',
    },
    {
        id: 12,
        name: 'Continuous Learning',
        icon: '📈',
        description: 'Improvement over time through feedback integration',
        borderColor: 'border-purple-500/20',
        textColor: 'text-purple-400',
    },
];

export default function Trust() {
    const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]?.id ?? 'architect');
    const [showFactors, setShowFactors] = useState(false);

    const { data: trustData, error } = useSWR(
        `/api/trust/${selectedAgent}`,
        fetcher,
        { refreshInterval: 30000 }
    );

    const isLoading = !trustData && !error;

    return (
        <Layout title="Trust Scores">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                        Trust Scores
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Multi-dimensional trust evaluation across the agent fleet
                    </p>
                </div>
                <button
                    onClick={() => setShowFactors(!showFactors)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        showFactors
                            ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-400 border border-violet-500/30'
                            : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-white/10'
                    }`}
                >
                    {showFactors ? 'Hide' : 'Show'} 12 Factors of Trust
                </button>
            </div>

            {/* 12 Factors of Trust Section */}
            <AnimatePresence>
                {showFactors && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden mb-8"
                    >
                        <div className="bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-xl">
                                    🛡️
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-200">The 12 Factors of Trust</h2>
                                    <p className="text-sm text-slate-500">
                                        Foundational principles for autonomous agent evaluation
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {TRUST_FACTORS.map((factor) => (
                                    <motion.div
                                        key={factor.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: factor.id * 0.05 }}
                                        className={`bg-white/5 border ${factor.borderColor} rounded-lg p-4 hover:bg-white/10 transition-all`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">{factor.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold ${factor.textColor}`}>
                                                        #{factor.id}
                                                    </span>
                                                    <h3 className="font-semibold text-slate-200 text-sm truncate">
                                                        {factor.name}
                                                    </h3>
                                                </div>
                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                    {factor.description}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                        <TrustTierBadge tier={trustData.tier} tierName={trustData.tierName} score={trustData.overall} />
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
                                                    animate={{ width: `${dim.score / 10}%` }}
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
