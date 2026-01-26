import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ClassifiedIntent {
    intent: string;
    confidence: number;
    agent: string;
    command: string;
    isHighRisk: boolean;
    reasoning: string;
}

interface IntentPreviewProps {
    input: string;
    onSelectIntent?: (intent: ClassifiedIntent) => void;
}

const DEFAULT_COLORS = { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' };

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    herald: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    sentinel: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    watchman: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    envoy: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
    scribe: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
    librarian: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    curator: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    'ts-fixer': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
};

const INTENT_ICONS: Record<string, string> = {
    'social.plan': '📅',
    'social.draft': '✍️',
    'code.fix': '🔧',
    'code.audit': '🛡️',
    'code.review': '👀',
    'docs.map': '🗺️',
    'docs.index': '📚',
    'hygiene.scan': '🧹',
    'status.check': '📊',
    'ui.improve': '🎨',
    'unknown': '❓',
};

function formatIntent(intent: string): string {
    return intent
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' → ');
}

function ConfidenceBar({ confidence }: { confidence: number }) {
    const percentage = Math.round(confidence * 100);
    let colorClass = 'bg-emerald-500';
    if (confidence < 0.5) colorClass = 'bg-red-500';
    else if (confidence < 0.7) colorClass = 'bg-yellow-500';

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`h-full ${colorClass} rounded-full`}
                />
            </div>
            <span className={`text-xs font-mono ${confidence >= 0.7 ? 'text-emerald-400' : confidence >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                {percentage}%
            </span>
        </div>
    );
}

export function IntentPreview({ input, onSelectIntent }: IntentPreviewProps) {
    const [preview, setPreview] = useState<{
        primary: ClassifiedIntent | null;
        alternatives: ClassifiedIntent[];
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAlternatives, setShowAlternatives] = useState(false);

    // Debounce the input
    const [debouncedInput, setDebouncedInput] = useState(input);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedInput(input), 150);
        return () => clearTimeout(timer);
    }, [input]);

    // Fetch intent preview
    useEffect(() => {
        if (!debouncedInput || debouncedInput.length < 3) {
            setPreview(null);
            return;
        }

        const fetchPreview = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/preview-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: debouncedInput }),
                });
                const data = await res.json();
                setPreview(data);
            } catch (e) {
                console.error('Failed to fetch intent preview:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchPreview();
    }, [debouncedInput]);

    // Don't show if no input or no preview
    if (!input || input.length < 3 || (!preview?.primary && !loading)) {
        return null;
    }

    const primary = preview?.primary;
    const alternatives = preview?.alternatives?.slice(1) || [];
    const agentColors = primary ? (AGENT_COLORS[primary.agent] ?? DEFAULT_COLORS) : DEFAULT_COLORS;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-0 right-0 mb-2 z-10"
            >
                <div className={`bg-[#0a0a0a] border ${primary?.isHighRisk ? 'border-red-500/50' : 'border-white/10'} rounded-xl shadow-2xl overflow-hidden`}>
                    {loading ? (
                        <div className="px-4 py-3 flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                            <span className="text-sm text-slate-500">Analyzing intent...</span>
                        </div>
                    ) : primary ? (
                        <div>
                            {/* Primary Intent */}
                            <div className={`px-4 py-3 ${agentColors.bg}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{INTENT_ICONS[primary.intent] || '🤖'}</span>
                                        <span className={`font-bold ${agentColors.text}`}>
                                            {formatIntent(primary.intent)}
                                        </span>
                                        {primary.isHighRisk && (
                                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded font-bold">
                                                HIGH RISK
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs uppercase font-bold ${agentColors.text}`}>
                                            {primary.agent}
                                        </span>
                                    </div>
                                </div>

                                <ConfidenceBar confidence={primary.confidence} />

                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs text-slate-500">{primary.reasoning}</span>
                                    {alternatives.length > 0 && (
                                        <button
                                            onClick={() => setShowAlternatives(!showAlternatives)}
                                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                        >
                                            {showAlternatives ? 'Hide' : 'Show'} alternatives
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Alternatives */}
                            <AnimatePresence>
                                {showAlternatives && alternatives.length > 0 && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-white/5"
                                    >
                                        {alternatives.map((alt, i) => {
                                            const altColors = AGENT_COLORS[alt.agent] ?? DEFAULT_COLORS;
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => onSelectIntent?.(alt)}
                                                    className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>{INTENT_ICONS[alt.intent] || '🤖'}</span>
                                                        <span className={`text-sm ${altColors.text}`}>
                                                            {formatIntent(alt.intent)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-600 font-mono">
                                                            {Math.round(alt.confidence * 100)}%
                                                        </span>
                                                        <span className={`text-xs ${altColors.text}`}>
                                                            {alt.agent}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Low confidence warning */}
                            {primary.confidence < 0.5 && (
                                <div className="px-4 py-2 bg-yellow-500/10 border-t border-yellow-500/20">
                                    <div className="flex items-center gap-2 text-xs text-yellow-400">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Low confidence - try being more specific
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="px-4 py-3 text-sm text-slate-500">
                            No intent detected
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
