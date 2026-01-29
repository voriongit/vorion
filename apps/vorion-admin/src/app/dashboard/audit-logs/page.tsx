'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Bot,
  Building2,
  Shield,
  Key,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';

const logs = [
  {
    id: '1',
    timestamp: '2024-04-02 14:32:15 UTC',
    actor: { type: 'user', name: 'john@acme.com' },
    action: 'agent.create',
    resource: 'Agent: DataProcessor-Alpha',
    org: 'Acme Corp',
    status: 'success',
    ip: '192.168.1.100',
    details: 'Created new agent with template: data-processor',
  },
  {
    id: '2',
    timestamp: '2024-04-02 14:28:42 UTC',
    actor: { type: 'agent', name: 'AnalyticsBot-v3' },
    action: 'governance.enforce',
    resource: 'Intent: database_read',
    org: 'TechStart Inc',
    status: 'success',
    ip: 'internal',
    details: 'Governance check passed. Decision: ALLOW',
  },
  {
    id: '3',
    timestamp: '2024-04-02 14:25:18 UTC',
    actor: { type: 'system', name: 'cognigate-api' },
    action: 'trust.update',
    resource: 'Agent: ReportGenerator',
    org: 'GlobalBank',
    status: 'success',
    ip: 'internal',
    details: 'Trust score updated: 887 -> 891 (+4)',
  },
  {
    id: '4',
    timestamp: '2024-04-02 14:21:33 UTC',
    actor: { type: 'user', name: 'admin@cloudnine.io' },
    action: 'user.invite',
    resource: 'User: dev@cloudnine.io',
    org: 'CloudNine Solutions',
    status: 'success',
    ip: '10.0.0.54',
    details: 'Invited new user with role: Developer',
  },
  {
    id: '5',
    timestamp: '2024-04-02 14:18:07 UTC',
    actor: { type: 'agent', name: 'ComplianceChecker' },
    action: 'governance.enforce',
    resource: 'Intent: external_api_call',
    org: 'FinServ Pro',
    status: 'denied',
    ip: 'internal',
    details: 'Governance check failed. Decision: DENY. Reason: Insufficient trust level for external API access',
  },
  {
    id: '6',
    timestamp: '2024-04-02 14:15:52 UTC',
    actor: { type: 'user', name: 'security@vorion.org' },
    action: 'agent.suspend',
    resource: 'Agent: TaskAutomator',
    org: 'CloudNine Solutions',
    status: 'success',
    ip: '172.16.0.1',
    details: 'Agent suspended due to repeated governance violations',
  },
  {
    id: '7',
    timestamp: '2024-04-02 14:10:29 UTC',
    actor: { type: 'system', name: 'auth-service' },
    action: 'auth.login',
    resource: 'User: sarah@techstart.io',
    org: 'TechStart Inc',
    status: 'success',
    ip: '203.0.113.45',
    details: 'Successful login via SSO',
  },
  {
    id: '8',
    timestamp: '2024-04-02 14:05:11 UTC',
    actor: { type: 'user', name: 'unknown' },
    action: 'auth.login',
    resource: 'User: admin@acme.com',
    org: 'Acme Corp',
    status: 'failure',
    ip: '198.51.100.23',
    details: 'Failed login attempt. Invalid password (attempt 3/5)',
  },
];

const actionColors: Record<string, string> = {
  'agent.create': 'text-green-400',
  'agent.suspend': 'text-red-400',
  'governance.enforce': 'text-blue-400',
  'trust.update': 'text-violet-400',
  'user.invite': 'text-cyan-400',
  'auth.login': 'text-amber-400',
};

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-gray-500">Complete activity history across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-input pl-10"
          />
        </div>
        <select className="admin-input w-auto">
          <option value="all">All Actions</option>
          <option value="agent">Agent Actions</option>
          <option value="user">User Actions</option>
          <option value="auth">Authentication</option>
          <option value="governance">Governance</option>
        </select>
        <select className="admin-input w-auto">
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="denied">Denied</option>
        </select>
        <button className="btn-secondary flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Date Range
        </button>
        <button className="btn-secondary flex items-center gap-2">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Logs list */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-800">
          {logs.map((log) => (
            <div key={log.id} className="hover:bg-gray-800/30 transition">
              <div
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                {/* Status indicator */}
                <div className="flex-shrink-0">
                  {log.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : log.status === 'denied' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>

                {/* Actor */}
                <div className="w-48 flex items-center gap-2">
                  {log.actor.type === 'user' ? (
                    <User className="w-4 h-4 text-blue-400" />
                  ) : log.actor.type === 'agent' ? (
                    <Bot className="w-4 h-4 text-violet-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="truncate text-sm">{log.actor.name}</span>
                </div>

                {/* Action */}
                <div className="w-40">
                  <span className={`text-sm font-mono ${actionColors[log.action] || 'text-gray-400'}`}>
                    {log.action}
                  </span>
                </div>

                {/* Resource */}
                <div className="flex-1 truncate text-sm text-gray-300">
                  {log.resource}
                </div>

                {/* Org */}
                <div className="w-32 flex items-center gap-2 text-sm text-gray-500">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate">{log.org}</span>
                </div>

                {/* Timestamp */}
                <div className="w-44 text-sm text-gray-500">
                  {log.timestamp}
                </div>

                {/* Expand */}
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition ${
                    expandedLog === log.id ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {/* Expanded details */}
              {expandedLog === log.id && (
                <div className="px-4 pb-4 pt-0">
                  <div className="p-4 rounded-lg bg-gray-900/50 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">IP Address:</span>
                        <span className="ml-2 font-mono">{log.ip}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 ${
                          log.status === 'success' ? 'text-green-400' :
                          log.status === 'denied' ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Details:</span>
                      <p className="mt-1 text-gray-300">{log.details}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing 8 of 12,847 logs
        </p>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-sm py-1 px-3">Previous</button>
          <button className="btn-secondary text-sm py-1 px-3 bg-admin-primary/20 border-admin-primary/30">1</button>
          <button className="btn-secondary text-sm py-1 px-3">2</button>
          <button className="btn-secondary text-sm py-1 px-3">3</button>
          <span className="text-gray-500">...</span>
          <button className="btn-secondary text-sm py-1 px-3">1606</button>
          <button className="btn-secondary text-sm py-1 px-3">Next</button>
        </div>
      </div>
    </div>
  );
}
