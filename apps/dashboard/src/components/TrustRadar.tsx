/**
 * Trust Radar Component
 * 5-dimension radar chart for visualizing agent trust scores
 */

import { motion } from 'framer-motion';

export interface TrustDimension {
    name: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
    description: string;
}

interface TrustRadarProps {
    dimensions: TrustDimension[];
    size?: number;
    showLabels?: boolean;
    animated?: boolean;
    className?: string;
}

export function TrustRadar({
    dimensions,
    size = 300,
    showLabels = true,
    animated = true,
    className = '',
}: TrustRadarProps) {
    const center = size / 2;
    const radius = (size - 80) / 2; // Leave room for labels
    const levels = 5; // Concentric circles

    // Calculate points for each dimension
    const angleStep = (2 * Math.PI) / dimensions.length;
    const startAngle = -Math.PI / 2; // Start from top

    const getPoint = (index: number, value: number) => {
        const angle = startAngle + index * angleStep;
        const r = (value / 100) * radius;
        return {
            x: center + r * Math.cos(angle),
            y: center + r * Math.sin(angle),
        };
    };

    const getLabelPoint = (index: number) => {
        const angle = startAngle + index * angleStep;
        const r = radius + 35;
        return {
            x: center + r * Math.cos(angle),
            y: center + r * Math.sin(angle),
        };
    };

    // Generate path for the data polygon
    const dataPath = dimensions
        .map((d, i) => {
            const point = getPoint(i, d.score);
            return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
        })
        .join(' ') + ' Z';

    // Generate concentric level paths
    const levelPaths = Array.from({ length: levels }, (_, level) => {
        const levelValue = ((level + 1) / levels) * 100;
        return dimensions
            .map((_, i) => {
                const point = getPoint(i, levelValue);
                return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
            })
            .join(' ') + ' Z';
    });

    // Axis lines
    const axisLines = dimensions.map((_, i) => {
        const end = getPoint(i, 100);
        return { x1: center, y1: center, x2: end.x, y2: end.y };
    });

    const trendIcon = (trend: TrustDimension['trend']) => {
        switch (trend) {
            case 'up':
                return '↑';
            case 'down':
                return '↓';
            default:
                return '→';
        }
    };

    const trendColor = (trend: TrustDimension['trend']) => {
        switch (trend) {
            case 'up':
                return 'text-emerald-400';
            case 'down':
                return 'text-red-400';
            default:
                return 'text-slate-400';
        }
    };

    return (
        <div className={`relative ${className}`}>
            <svg width={size} height={size} className="overflow-visible">
                {/* Background levels */}
                {levelPaths.map((path, i) => (
                    <path
                        key={i}
                        d={path}
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth={1}
                    />
                ))}

                {/* Axis lines */}
                {axisLines.map((line, i) => (
                    <line
                        key={i}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth={1}
                    />
                ))}

                {/* Data polygon - gradient fill */}
                <defs>
                    <linearGradient id="trustGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(6, 182, 212, 0.4)" />
                        <stop offset="100%" stopColor="rgba(59, 130, 246, 0.4)" />
                    </linearGradient>
                </defs>

                {animated ? (
                    <motion.path
                        d={dataPath}
                        fill="url(#trustGradient)"
                        stroke="rgba(6, 182, 212, 0.8)"
                        strokeWidth={2}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        style={{ transformOrigin: `${center}px ${center}px` }}
                    />
                ) : (
                    <path
                        d={dataPath}
                        fill="url(#trustGradient)"
                        stroke="rgba(6, 182, 212, 0.8)"
                        strokeWidth={2}
                    />
                )}

                {/* Data points */}
                {dimensions.map((dim, i) => {
                    const point = getPoint(i, dim.score);
                    return animated ? (
                        <motion.circle
                            key={i}
                            cx={point.x}
                            cy={point.y}
                            r={5}
                            fill="rgb(6, 182, 212)"
                            stroke="white"
                            strokeWidth={2}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3 + i * 0.1 }}
                        />
                    ) : (
                        <circle
                            key={i}
                            cx={point.x}
                            cy={point.y}
                            r={5}
                            fill="rgb(6, 182, 212)"
                            stroke="white"
                            strokeWidth={2}
                        />
                    );
                })}

                {/* Labels */}
                {showLabels &&
                    dimensions.map((dim, i) => {
                        const labelPoint = getLabelPoint(i);

                        return (
                            <g key={i}>
                                <text
                                    x={labelPoint.x}
                                    y={labelPoint.y - 8}
                                    textAnchor="middle"
                                    className="fill-slate-300 text-xs font-medium"
                                >
                                    {dim.name}
                                </text>
                                <text
                                    x={labelPoint.x}
                                    y={labelPoint.y + 8}
                                    textAnchor="middle"
                                    className="fill-cyan-400 text-sm font-bold"
                                >
                                    {dim.score}
                                </text>
                            </g>
                        );
                    })}

                {/* Center score */}
                <text
                    x={center}
                    y={center - 8}
                    textAnchor="middle"
                    className="fill-slate-400 text-xs"
                >
                    AVG
                </text>
                <text
                    x={center}
                    y={center + 12}
                    textAnchor="middle"
                    className="fill-white text-lg font-bold"
                >
                    {Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)}
                </text>
            </svg>

            {/* Legend */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {dimensions.map((dim, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className={trendColor(dim.trend)}>{trendIcon(dim.trend)}</span>
                        <span className="text-slate-400">{dim.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Compact version for cards
export function TrustRadarMini({
    dimensions,
    size = 120,
}: {
    dimensions: TrustDimension[];
    size?: number;
}) {
    return <TrustRadar dimensions={dimensions} size={size} showLabels={false} animated={false} />;
}

// Trust tier badge
export function TrustTierBadge({
    tier,
    score,
}: {
    tier: string;
    score: number;
}) {
    const tierColors: Record<string, string> = {
        UNTRUSTED: 'bg-red-500/20 text-red-400 border-red-500/30',
        PROBATION: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        SUPERVISED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        TRUSTED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        PRIVILEGED: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        AUTONOMOUS: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    };

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${tierColors[tier] || tierColors.UNTRUSTED}`}>
            <span className="font-semibold text-sm">{tier}</span>
            <span className="text-xs opacity-70">{score}/100</span>
        </div>
    );
}

export default TrustRadar;
