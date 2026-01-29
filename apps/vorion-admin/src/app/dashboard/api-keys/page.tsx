'use client';

import { useState } from 'react';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Calendar,
  Activity,
  AlertTriangle,
} from 'lucide-react';

const apiKeys = [
  {
    id: '1',
    name: 'Production API Key',
    prefix: 'cg_live_',
    lastFour: 'a3f2',
    created: 'Jan 15, 2024',
    lastUsed: '2 minutes ago',
    requests: 1247892,
    status: 'active',
    scopes: ['read', 'write', 'admin'],
  },
  {
    id: '2',
    name: 'Development Key',
    prefix: 'cg_test_',
    lastFour: 'b7d9',
    created: 'Feb 3, 2024',
    lastUsed: '1 hour ago',
    requests: 45231,
    status: 'active',
    scopes: ['read', 'write'],
  },
  {
    id: '3',
    name: 'CI/CD Pipeline',
    prefix: 'cg_live_',
    lastFour: 'c4e1',
    created: 'Mar 12, 2024',
    lastUsed: '15 minutes ago',
    requests: 892341,
    status: 'active',
    scopes: ['read'],
  },
  {
    id: '4',
    name: 'Legacy Integration',
    prefix: 'cg_live_',
    lastFour: 'd8f3',
    created: 'Nov 5, 2023',
    lastUsed: '30 days ago',
    requests: 12847,
    status: 'inactive',
    scopes: ['read', 'write'],
  },
];

export default function ApiKeysPage() {
  const [showKey, setShowKey] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-gray-500">Manage platform API keys and access tokens</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-400">Security Notice</p>
          <p className="text-sm text-gray-400 mt-1">
            API keys grant access to the platform. Keep them secure and rotate them regularly.
            Never expose keys in client-side code or public repositories.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Keys</p>
          <p className="text-2xl font-bold mt-1">4</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Active Keys</p>
          <p className="text-2xl font-bold mt-1 text-green-400">3</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Requests (30d)</p>
          <p className="text-2xl font-bold mt-1">2.1M</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Avg Requests/day</p>
          <p className="text-2xl font-bold mt-1">72K</p>
        </div>
      </div>

      {/* API Keys table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Scopes</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Requests</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((key) => (
              <tr key={key.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-admin-primary/20">
                      <Key className="w-4 h-4 text-admin-primary" />
                    </div>
                    <span className="font-medium">{key.name}</span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-gray-800 px-2 py-1 rounded">
                      {showKey === key.id
                        ? `${key.prefix}${'•'.repeat(20)}${key.lastFour}`
                        : `${key.prefix}${'•'.repeat(8)}${key.lastFour}`}
                    </code>
                    <button
                      onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      {showKey === key.id ? (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    <button className="p-1 hover:bg-gray-700 rounded">
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </td>
                <td>
                  <div className="flex gap-1">
                    {key.scopes.map((scope) => (
                      <span
                        key={scope}
                        className={`badge text-xs ${
                          scope === 'admin' ? 'badge-error' :
                          scope === 'write' ? 'badge-warning' :
                          'badge-info'
                        }`}
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="text-gray-400 text-sm">{key.created}</td>
                <td className="text-gray-400 text-sm">{key.lastUsed}</td>
                <td className="text-gray-300">{key.requests.toLocaleString()}</td>
                <td>
                  <span className={`badge ${
                    key.status === 'active' ? 'badge-success' : 'badge-warning'
                  }`}>
                    {key.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition"
                      title="Rotate Key"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition"
                      title="View Usage"
                    >
                      <Activity className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key creation guide */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">API Key Scopes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-800/30">
            <span className="badge badge-info mb-2">read</span>
            <p className="text-sm text-gray-400">
              Read-only access to agents, trust scores, and proof records.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gray-800/30">
            <span className="badge badge-warning mb-2">write</span>
            <p className="text-sm text-gray-400">
              Create and update agents, submit outcomes, and manage resources.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gray-800/30">
            <span className="badge badge-error mb-2">admin</span>
            <p className="text-sm text-gray-400">
              Full administrative access including user management and settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
