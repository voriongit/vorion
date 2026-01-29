'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Building2,
  Users,
  Bot,
  Calendar,
  CreditCard,
  Settings,
  Trash2,
  Eye,
  Ban,
} from 'lucide-react';

const organizations = [
  {
    id: '1',
    name: 'Acme Corp',
    domain: 'acme.com',
    plan: 'Enterprise',
    users: 156,
    agents: 423,
    status: 'active',
    mrr: '$4,999',
    createdAt: 'Jan 10, 2024',
  },
  {
    id: '2',
    name: 'TechStart Inc',
    domain: 'techstart.io',
    plan: 'Pro',
    users: 42,
    agents: 87,
    status: 'active',
    mrr: '$499',
    createdAt: 'Feb 14, 2024',
  },
  {
    id: '3',
    name: 'GlobalBank',
    domain: 'globalbank.com',
    plan: 'Enterprise',
    users: 312,
    agents: 1245,
    status: 'active',
    mrr: '$12,999',
    createdAt: 'Nov 5, 2023',
  },
  {
    id: '4',
    name: 'CloudNine Solutions',
    domain: 'cloudnine.io',
    plan: 'Core',
    users: 8,
    agents: 12,
    status: 'trial',
    mrr: '$0',
    createdAt: 'Apr 1, 2024',
  },
  {
    id: '5',
    name: 'FinServ Pro',
    domain: 'finserv.com',
    plan: 'Enterprise',
    users: 89,
    agents: 567,
    status: 'past_due',
    mrr: '$7,999',
    createdAt: 'Dec 12, 2023',
  },
];

export default function OrganizationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-gray-500">Manage customer organizations and subscriptions</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Organization
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Organizations</p>
          <p className="text-2xl font-bold mt-1">342</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Active Subscriptions</p>
          <p className="text-2xl font-bold mt-1">298</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Monthly Revenue</p>
          <p className="text-2xl font-bold mt-1">$847,234</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Avg Agents/Org</p>
          <p className="text-2xl font-bold mt-1">24.6</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-input pl-10"
          />
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Organizations grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrgs.map((org) => (
          <div key={org.id} className="glass-card rounded-xl p-6 hover:border-admin-primary/30 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-admin-primary/20 to-admin-secondary/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-admin-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{org.name}</h3>
                  <p className="text-sm text-gray-500">{org.domain}</p>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === org.id ? null : org.id)}
                  className="p-2 rounded-lg hover:bg-gray-700/50 transition"
                >
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>
                {activeMenu === org.id && (
                  <div className="absolute right-0 top-full mt-1 w-48 py-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-10">
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2">
                      <Eye className="w-4 h-4" /> View Details
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Billing
                    </button>
                    <hr className="my-2 border-gray-700" />
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2 text-amber-400">
                      <Ban className="w-4 h-4" /> Suspend
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2 text-red-400">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <span className={`badge ${
                org.plan === 'Enterprise' ? 'badge-info' :
                org.plan === 'Pro' ? 'bg-violet-500/20 text-violet-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {org.plan}
              </span>
              <span className={`badge ${
                org.status === 'active' ? 'badge-success' :
                org.status === 'trial' ? 'badge-warning' :
                'badge-error'
              }`}>
                {org.status === 'past_due' ? 'Past Due' : org.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-700/50">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-500">
                  <Users className="w-3 h-3" />
                </div>
                <p className="font-semibold">{org.users}</p>
                <p className="text-xs text-gray-500">Users</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-500">
                  <Bot className="w-3 h-3" />
                </div>
                <p className="font-semibold">{org.agents}</p>
                <p className="text-xs text-gray-500">Agents</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-500">
                  <CreditCard className="w-3 h-3" />
                </div>
                <p className="font-semibold">{org.mrr}</p>
                <p className="text-xs text-gray-500">MRR</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              Created {org.createdAt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
