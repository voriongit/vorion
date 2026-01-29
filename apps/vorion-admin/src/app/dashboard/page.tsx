'use client';

import {
  Users,
  Building2,
  Bot,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Shield,
} from 'lucide-react';

const stats = [
  {
    name: 'Total Users',
    value: '12,847',
    change: '+12%',
    trend: 'up',
    icon: Users,
    color: 'blue',
  },
  {
    name: 'Organizations',
    value: '342',
    change: '+8%',
    trend: 'up',
    icon: Building2,
    color: 'violet',
  },
  {
    name: 'Active Agents',
    value: '8,421',
    change: '+23%',
    trend: 'up',
    icon: Bot,
    color: 'green',
  },
  {
    name: 'API Calls (24h)',
    value: '2.4M',
    change: '-3%',
    trend: 'down',
    icon: Activity,
    color: 'amber',
  },
];

const recentActivity = [
  {
    id: 1,
    type: 'user_created',
    description: 'New user registered: john@acme.com',
    org: 'Acme Corp',
    time: '2 minutes ago',
    icon: Users,
    color: 'blue',
  },
  {
    id: 2,
    type: 'agent_escalation',
    description: 'Agent "DataProcessor-7" escalated to T4',
    org: 'TechStart Inc',
    time: '15 minutes ago',
    icon: TrendingUp,
    color: 'green',
  },
  {
    id: 3,
    type: 'security_alert',
    description: 'Suspicious API activity detected',
    org: 'GlobalBank',
    time: '32 minutes ago',
    icon: AlertTriangle,
    color: 'amber',
  },
  {
    id: 4,
    type: 'org_created',
    description: 'New organization: CloudNine Solutions',
    org: 'CloudNine Solutions',
    time: '1 hour ago',
    icon: Building2,
    color: 'violet',
  },
  {
    id: 5,
    type: 'compliance_passed',
    description: 'SOC2 compliance check passed',
    org: 'FinServ Pro',
    time: '2 hours ago',
    icon: CheckCircle,
    color: 'green',
  },
];

const tierDistribution = [
  { tier: 'T0', name: 'Sandbox', count: 1247, color: '#ef4444' },
  { tier: 'T1', name: 'Observed', count: 2341, color: '#f97316' },
  { tier: 'T2', name: 'Provisional', count: 1892, color: '#eab308' },
  { tier: 'T3', name: 'Verified', count: 1456, color: '#84cc16' },
  { tier: 'T4', name: 'Operational', count: 987, color: '#22c55e' },
  { tier: 'T5', name: 'Trusted', count: 342, color: '#14b8a6' },
  { tier: 'T6', name: 'Certified', count: 134, color: '#3b82f6' },
  { tier: 'T7', name: 'Autonomous', count: 22, color: '#8b5cf6' },
];

const pendingApprovals = [
  { id: 1, type: 'tier_upgrade', entity: 'Agent "AnalyticsBot"', from: 'T3', to: 'T4', org: 'DataCorp' },
  { id: 2, type: 'api_access', entity: 'CloudNine Solutions', scope: 'write_agents', org: 'CloudNine' },
  { id: 3, type: 'tier_upgrade', entity: 'Agent "ReportGen"', from: 'T5', to: 'T6', org: 'FinServ Pro' },
];

export default function DashboardPage() {
  const totalAgents = tierDistribution.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">Platform overview and key metrics</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Last updated: Just now
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="stat-card">
            <div className="flex items-start justify-between">
              <div
                className={`p-2 rounded-lg ${
                  stat.color === 'blue' ? 'bg-blue-500/20' :
                  stat.color === 'violet' ? 'bg-violet-500/20' :
                  stat.color === 'green' ? 'bg-green-500/20' :
                  'bg-amber-500/20'
                }`}
              >
                <stat.icon
                  className={`w-5 h-5 ${
                    stat.color === 'blue' ? 'text-blue-400' :
                    stat.color === 'violet' ? 'text-violet-400' :
                    stat.color === 'green' ? 'text-green-400' :
                    'text-amber-400'
                  }`}
                />
              </div>
              <span
                className={`flex items-center text-sm ${
                  stat.trend === 'up' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {stat.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.name}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trust Tier Distribution */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Agent Trust Distribution</h2>
            <span className="text-sm text-gray-500">{totalAgents.toLocaleString()} total agents</span>
          </div>
          <div className="space-y-3">
            {tierDistribution.map((tier) => {
              const percentage = (tier.count / totalAgents) * 100;
              return (
                <div key={tier.tier} className="flex items-center gap-4">
                  <div className="w-12 text-sm font-medium" style={{ color: tier.color }}>
                    {tier.tier}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: tier.color,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <span className="text-sm font-medium">{tier.count.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 ml-1">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Pending Approvals</h2>
            <span className="badge badge-warning">{pendingApprovals.length}</span>
          </div>
          <div className="space-y-4">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="p-3 rounded-lg bg-gray-800/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.entity}</span>
                  {item.type === 'tier_upgrade' && (
                    <span className="text-xs text-gray-500">
                      {item.from} → {item.to}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{item.org}</p>
                <div className="flex gap-2 pt-1">
                  <button className="btn-primary text-xs py-1 px-3">Approve</button>
                  <button className="btn-secondary text-xs py-1 px-3">Review</button>
                </div>
              </div>
            ))}
          </div>
          <a
            href="/dashboard/approvals"
            className="flex items-center justify-center gap-1 mt-4 text-sm text-admin-primary hover:underline"
          >
            View all approvals
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <a href="/dashboard/audit-logs" className="text-sm text-admin-primary hover:underline">
            View all
          </a>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-800/30 transition"
            >
              <div
                className={`p-2 rounded-lg ${
                  activity.color === 'blue' ? 'bg-blue-500/20' :
                  activity.color === 'green' ? 'bg-green-500/20' :
                  activity.color === 'amber' ? 'bg-amber-500/20' :
                  'bg-violet-500/20'
                }`}
              >
                <activity.icon
                  className={`w-5 h-5 ${
                    activity.color === 'blue' ? 'text-blue-400' :
                    activity.color === 'green' ? 'text-green-400' :
                    activity.color === 'amber' ? 'text-amber-400' :
                    'text-violet-400'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{activity.description}</p>
                <p className="text-xs text-gray-500 mt-1">{activity.org}</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
