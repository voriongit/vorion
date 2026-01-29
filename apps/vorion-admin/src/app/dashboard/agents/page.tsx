'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  Bot,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  Pause,
  Play,
  Eye,
} from 'lucide-react';

const tierColors: Record<string, string> = {
  T0: '#ef4444',
  T1: '#f97316',
  T2: '#eab308',
  T3: '#84cc16',
  T4: '#22c55e',
  T5: '#14b8a6',
  T6: '#3b82f6',
  T7: '#8b5cf6',
};

const tierNames: Record<string, string> = {
  T0: 'Sandbox',
  T1: 'Observed',
  T2: 'Provisional',
  T3: 'Verified',
  T4: 'Operational',
  T5: 'Trusted',
  T6: 'Certified',
  T7: 'Autonomous',
};

const agents = [
  {
    id: '1',
    name: 'DataProcessor-Alpha',
    organization: 'Acme Corp',
    tier: 'T4',
    score: 712,
    status: 'active',
    actions24h: 1247,
    successRate: 99.2,
    trend: 'up',
  },
  {
    id: '2',
    name: 'AnalyticsBot-v3',
    organization: 'TechStart Inc',
    tier: 'T3',
    score: 548,
    status: 'active',
    actions24h: 892,
    successRate: 97.8,
    trend: 'up',
  },
  {
    id: '3',
    name: 'ReportGenerator',
    organization: 'GlobalBank',
    tier: 'T6',
    score: 891,
    status: 'active',
    actions24h: 3421,
    successRate: 99.9,
    trend: 'up',
  },
  {
    id: '4',
    name: 'TaskAutomator',
    organization: 'CloudNine Solutions',
    tier: 'T1',
    score: 287,
    status: 'paused',
    actions24h: 0,
    successRate: 94.2,
    trend: 'down',
  },
  {
    id: '5',
    name: 'ComplianceChecker',
    organization: 'FinServ Pro',
    tier: 'T5',
    score: 834,
    status: 'suspended',
    actions24h: 0,
    successRate: 98.7,
    trend: 'down',
  },
  {
    id: '6',
    name: 'CustomerSupport-AI',
    organization: 'Acme Corp',
    tier: 'T7',
    score: 967,
    status: 'active',
    actions24h: 8934,
    successRate: 99.8,
    trend: 'up',
  },
];

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.organization.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'all' || agent.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-gray-500">Monitor all AI agents across the platform</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Active</span>
          </div>
          <p className="text-2xl font-bold mt-1">7,234</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-amber-400">
            <Pause className="w-4 h-4" />
            <span className="text-sm">Paused</span>
          </div>
          <p className="text-2xl font-bold mt-1">892</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Suspended</span>
          </div>
          <p className="text-2xl font-bold mt-1">295</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-blue-400">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Actions/hr</span>
          </div>
          <p className="text-2xl font-bold mt-1">124K</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-input pl-10"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="admin-input w-auto"
        >
          <option value="all">All Tiers</option>
          {Object.entries(tierNames).map(([tier, name]) => (
            <option key={tier} value={tier}>{tier} - {name}</option>
          ))}
        </select>
        <button className="btn-secondary flex items-center gap-2">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Agents table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Organization</th>
              <th>Trust Tier</th>
              <th>Score</th>
              <th>Status</th>
              <th>Actions (24h)</th>
              <th>Success Rate</th>
              <th>Trend</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-gray-400" />
                    </div>
                    <span className="font-medium">{agent.name}</span>
                  </div>
                </td>
                <td className="text-gray-400">{agent.organization}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tierColors[agent.tier] }}
                    />
                    <span style={{ color: tierColors[agent.tier] }}>{agent.tier}</span>
                    <span className="text-gray-500 text-sm">
                      {tierNames[agent.tier]}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${agent.score / 10}%`,
                          backgroundColor: tierColors[agent.tier],
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">{agent.score}</span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${
                    agent.status === 'active' ? 'badge-success' :
                    agent.status === 'paused' ? 'badge-warning' :
                    'badge-error'
                  }`}>
                    {agent.status}
                  </span>
                </td>
                <td className="text-gray-300">{agent.actions24h.toLocaleString()}</td>
                <td>
                  <span className={agent.successRate >= 99 ? 'text-green-400' : agent.successRate >= 95 ? 'text-amber-400' : 'text-red-400'}>
                    {agent.successRate}%
                  </span>
                </td>
                <td>
                  {agent.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button className="p-2 rounded-lg hover:bg-gray-700/50 transition" title="View">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                    {agent.status === 'active' ? (
                      <button className="p-2 rounded-lg hover:bg-gray-700/50 transition" title="Pause">
                        <Pause className="w-4 h-4 text-amber-400" />
                      </button>
                    ) : (
                      <button className="p-2 rounded-lg hover:bg-gray-700/50 transition" title="Resume">
                        <Play className="w-4 h-4 text-green-400" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
