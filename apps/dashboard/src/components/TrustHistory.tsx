/**
 * Trust History Component
 * Shows trust score trends over time with interactive chart
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

export interface TrustSnapshot {
    timestamp: number;
    overall: number;
    dimensions: Record<string, number>;
    event?: string;
}

interface TrustHistoryProps {
    history: TrustSnapshot[];
    height?: number;
    showDimensions?: boolean;
    className?: string;
}

// ACI-spec 4-dimension model colors
const DIMENSION_COLORS: Record<string, string> = {
    Observability: '#10b981',  // emerald - transparency & auditability
    Capability: '#3b82f6',     // blue - skill demonstration
    Behavior: '#8b5cf6',       // violet - policy adherence
    Context: '#f59e0b',        // amber - environment adaptation
};

export function TrustHistory({
    history,
    height = 200,
    showDimensions = false,
    className = '',
}: TrustHistoryProps) {
    const [hoveredPoint, setHoveredPoint] = useState<TrustSnapshot | null>(null);
    const [selectedDimension, setSelectedDimension] = useState<string | null>(null);

    if (history.length === 0) {
        return (
            <div className={`flex items-center justify-center h-[${height}px] text-slate-500 ${className}`}>
                No history data available
            </div>
        );
    }

    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 600;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const scores = history.map(h => h.overall);
    const minScore = Math.min(...scores) - 5;
    const maxScore = Math.max(...scores) + 5;
    const scoreRange = maxScore - minScore;

    const xScale = (index: number) => padding.left + (index / (history.length - 1)) * chartWidth;
    const yScale = (score: number) => padding.top + chartHeight - ((score - minScore) / scoreRange) * chartHeight;

    // Generate path
    const linePath = history
        .map((h, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(h.overall)}`)
        .join(' ');

    // Area path for gradient fill
    const areaPath = linePath +
        ` L ${xScale(history.length - 1)} ${padding.top + chartHeight}` +
        ` L ${xScale(0)} ${padding.top + chartHeight} Z`;

    // Dimension paths
    const dimensionPaths: Record<string, string> = {};
    const firstEntry = history[0];
    if (showDimensions && firstEntry?.dimensions) {
        const dims = Object.keys(firstEntry.dimensions);
        for (const dim of dims) {
            dimensionPaths[dim] = history
                .map((h, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(h.dimensions?.[dim] ?? 0)}`)
                .join(' ');
        }
    }

    // Y-axis labels
    const yLabels = Array.from({ length: 5 }, (_, i) => {
        const score = minScore + (scoreRange * i) / 4;
        return { score: Math.round(score), y: yScale(score) };
    });

    // X-axis labels (dates)
    const xLabels = [0, Math.floor(history.length / 2), history.length - 1]
        .filter(i => history[i] !== undefined)
        .map(i => ({
            date: new Date(history[i]!.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            x: xScale(i),
        }));

    // Events markers
    const events = history
        .map((h, i) => ({ ...h, index: i }))
        .filter(h => h.event);

    return (
        <div className={className}>
            {/* Dimension toggles */}
            {showDimensions && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setSelectedDimension(null)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                            !selectedDimension
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'bg-white/5 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Overall
                    </button>
                    {Object.keys(DIMENSION_COLORS).map(dim => (
                        <button
                            key={dim}
                            onClick={() => setSelectedDimension(selectedDimension === dim ? null : dim)}
                            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                                selectedDimension === dim
                                    ? 'bg-white/10 text-white'
                                    : 'bg-white/5 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: DIMENSION_COLORS[dim] }}
                            />
                            {dim}
                        </button>
                    ))}
                </div>
            )}

            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(6, 182, 212, 0.3)" />
                        <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {yLabels.map((label, i) => (
                    <line
                        key={i}
                        x1={padding.left}
                        y1={label.y}
                        x2={width - padding.right}
                        y2={label.y}
                        stroke="rgba(255,255,255,0.05)"
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Area fill */}
                {!selectedDimension && (
                    <motion.path
                        d={areaPath}
                        fill="url(#areaGradient)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    />
                )}

                {/* Dimension lines (if showing) */}
                {showDimensions && selectedDimension && dimensionPaths[selectedDimension] && (
                    <motion.path
                        d={dimensionPaths[selectedDimension]}
                        fill="none"
                        stroke={DIMENSION_COLORS[selectedDimension]}
                        strokeWidth={2}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8 }}
                    />
                )}

                {/* Main line */}
                {!selectedDimension && (
                    <motion.path
                        d={linePath}
                        fill="none"
                        stroke="rgb(6, 182, 212)"
                        strokeWidth={2}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8 }}
                    />
                )}

                {/* Data points */}
                {history.map((h, i) => (
                    <circle
                        key={i}
                        cx={xScale(i)}
                        cy={yScale(selectedDimension && h.dimensions[selectedDimension] ? h.dimensions[selectedDimension] : h.overall)}
                        r={hoveredPoint === h ? 6 : 3}
                        fill={selectedDimension ? DIMENSION_COLORS[selectedDimension] : 'rgb(6, 182, 212)'}
                        stroke="white"
                        strokeWidth={hoveredPoint === h ? 2 : 0}
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPoint(h)}
                        onMouseLeave={() => setHoveredPoint(null)}
                    />
                ))}

                {/* Event markers */}
                {events.map((e, i) => (
                    <g key={i}>
                        <line
                            x1={xScale(e.index)}
                            y1={padding.top}
                            x2={xScale(e.index)}
                            y2={padding.top + chartHeight}
                            stroke="rgba(251, 191, 36, 0.3)"
                            strokeDasharray="4 4"
                        />
                        <circle
                            cx={xScale(e.index)}
                            cy={padding.top + 10}
                            r={4}
                            fill="rgb(251, 191, 36)"
                        />
                    </g>
                ))}

                {/* Y-axis labels */}
                {yLabels.map((label, i) => (
                    <text
                        key={i}
                        x={padding.left - 8}
                        y={label.y + 4}
                        textAnchor="end"
                        className="fill-slate-500 text-xs"
                    >
                        {label.score}
                    </text>
                ))}

                {/* X-axis labels */}
                {xLabels.map((label, i) => (
                    <text
                        key={i}
                        x={label.x}
                        y={height - 8}
                        textAnchor="middle"
                        className="fill-slate-500 text-xs"
                    >
                        {label.date}
                    </text>
                ))}

                {/* Hover tooltip */}
                {hoveredPoint && (
                    <g>
                        <rect
                            x={xScale(history.indexOf(hoveredPoint)) - 60}
                            y={yScale(hoveredPoint.overall) - 50}
                            width={120}
                            height={40}
                            rx={4}
                            fill="rgba(0,0,0,0.9)"
                            stroke="rgba(255,255,255,0.1)"
                        />
                        <text
                            x={xScale(history.indexOf(hoveredPoint))}
                            y={yScale(hoveredPoint.overall) - 32}
                            textAnchor="middle"
                            className="fill-white text-xs font-bold"
                        >
                            Score: {hoveredPoint.overall}
                        </text>
                        <text
                            x={xScale(history.indexOf(hoveredPoint))}
                            y={yScale(hoveredPoint.overall) - 18}
                            textAnchor="middle"
                            className="fill-slate-400 text-xs"
                        >
                            {new Date(hoveredPoint.timestamp).toLocaleDateString()}
                        </text>
                    </g>
                )}
            </svg>

            {/* Event legend */}
            {events.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Events: {events.map(e => e.event).join(', ')}</span>
                </div>
            )}
        </div>
    );
}

// Summary stats component
export function TrustSummary({
    history,
    className = '',
}: {
    history: TrustSnapshot[];
    className?: string;
}) {
    if (history.length < 2) return null;

    const currentEntry = history[history.length - 1];
    const previousEntry = history[0];
    if (!currentEntry || !previousEntry) return null;

    const current = currentEntry.overall;
    const previous = previousEntry.overall;
    const change = current - previous;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

    const max = Math.max(...history.map(h => h.overall));
    const avg = Math.round(history.reduce((s, h) => s + h.overall, 0) / history.length);

    return (
        <div className={`grid grid-cols-4 gap-4 ${className}`}>
            <div className="text-center">
                <div className="text-2xl font-bold text-white">{current}</div>
                <div className="text-xs text-slate-500">Current</div>
            </div>
            <div className="text-center">
                <div className={`text-2xl font-bold ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
                    {change > 0 ? '+' : ''}{change}
                </div>
                <div className="text-xs text-slate-500">30d Change</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">{max}</div>
                <div className="text-xs text-slate-500">Peak</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-slate-400">{avg}</div>
                <div className="text-xs text-slate-500">Average</div>
            </div>
        </div>
    );
}

export default TrustHistory;
