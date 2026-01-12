'use client';

import { staticLexicon } from '@/lib/lexicon-data';
import { providerStatus } from '@/lib/ai-providers';

interface StatCardProps {
  value: string | number;
  label: string;
  color: 'cyan' | 'purple' | 'orange' | 'green';
}

function StatCard({ value, label, color }: StatCardProps) {
  const borderColors = {
    cyan: 'border-cyan-500',
    purple: 'border-purple-500',
    orange: 'border-orange-500',
    green: 'border-green-500',
  };

  const textColors = {
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
  };

  return (
    <div className={`glass p-4 rounded text-center border-t-2 ${borderColors[color]}`}>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className={`text-[10px] uppercase tracking-wider ${textColors[color]}`}>
        {label}
      </div>
    </div>
  );
}

export function HeroSection() {
  const localNodeCount = staticLexicon.length;
  const activeProviders = Object.values(providerStatus).filter(s => s.available).length;

  return (
    <div className="text-center py-12 mb-8 fade-in">
      {/* Badge */}
      <div className="inline-block p-1 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-orange-500 mb-6">
        <div className="bg-gray-900 rounded-full px-6 py-2">
          <span className="text-xs font-mono uppercase tracking-widest text-white">
            Tri-Model Synthesis Engine
          </span>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white">
        The Cognitive Router
      </h1>

      {/* Description */}
      <p className="max-w-2xl mx-auto text-lg text-gray-400 mb-8">
        A hybrid intelligence system. It checks local memory first. If unknown, it consults the Triad:{' '}
        <span className="text-cyan-400">Gemini</span>,{' '}
        <span className="text-purple-400">Claude</span>, and{' '}
        <span className="text-orange-400">Grok</span> perspectives synthesized into one.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
        <StatCard value={localNodeCount} label="Local Nodes" color="cyan" />
        <StatCard value="3" label="AI Personas" color="purple" />
        <StatCard value="Sim" label="Mode Active" color="orange" />
        <StatCard value="On" label="Local First" color="green" />
      </div>

      {/* Subtitle */}
      <div className="mt-12 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          Omniscience — The Agentic AI Knowledge Base
        </h2>
        <p className="text-gray-400 text-sm">
          Comprehensive documentation covering autonomous AI agents, multi-agent systems,
          governance protocols, and the Vorion ecosystem including BASIS Standard,
          AgentAnchor, and Cognigate.
        </p>
      </div>
    </div>
  );
}
