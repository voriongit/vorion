'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Mail,
  Calendar,
  Shield,
  Ban,
  Trash2,
  Edit,
  Eye,
} from 'lucide-react';

const users = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john@acme.com',
    role: 'Admin',
    organization: 'Acme Corp',
    status: 'active',
    lastActive: '2 minutes ago',
    createdAt: 'Jan 15, 2024',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah@techstart.io',
    role: 'Developer',
    organization: 'TechStart Inc',
    status: 'active',
    lastActive: '15 minutes ago',
    createdAt: 'Feb 3, 2024',
  },
  {
    id: '3',
    name: 'Michael Chen',
    email: 'mchen@globalbank.com',
    role: 'Viewer',
    organization: 'GlobalBank',
    status: 'suspended',
    lastActive: '3 days ago',
    createdAt: 'Dec 8, 2023',
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily@cloudnine.io',
    role: 'Admin',
    organization: 'CloudNine Solutions',
    status: 'active',
    lastActive: '1 hour ago',
    createdAt: 'Mar 22, 2024',
  },
  {
    id: '5',
    name: 'Robert Williams',
    email: 'rwilliams@finserv.com',
    role: 'Developer',
    organization: 'FinServ Pro',
    status: 'pending',
    lastActive: 'Never',
    createdAt: 'Apr 1, 2024',
  },
];

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.organization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-500">Manage platform users across all organizations</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search users..."
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

      {/* Bulk actions */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-admin-primary/10 border border-admin-primary/20">
          <span className="text-sm">{selectedUsers.length} users selected</span>
          <button className="btn-secondary text-sm py-1">Export</button>
          <button className="btn-secondary text-sm py-1">Suspend</button>
          <button className="btn-danger text-sm py-1">Delete</button>
        </div>
      )}

      {/* Users table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="w-12">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-600 bg-gray-800"
                />
              </th>
              <th>User</th>
              <th>Organization</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Active</th>
              <th>Created</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => toggleSelect(user.id)}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-admin-primary to-admin-accent flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="text-gray-300">{user.organization}</td>
                <td>
                  <span className={`badge ${
                    user.role === 'Admin' ? 'badge-info' :
                    user.role === 'Developer' ? 'bg-violet-500/20 text-violet-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${
                    user.status === 'active' ? 'badge-success' :
                    user.status === 'suspended' ? 'badge-error' :
                    'badge-warning'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="text-gray-400 text-sm">{user.lastActive}</td>
                <td className="text-gray-400 text-sm">{user.createdAt}</td>
                <td>
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                    {activeMenu === user.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 py-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-10">
                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2">
                          <Eye className="w-4 h-4" /> View Details
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2">
                          <Edit className="w-4 h-4" /> Edit User
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Send Email
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2">
                          <Shield className="w-4 h-4" /> Reset Password
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {filteredUsers.length} of {users.length} users
        </p>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-sm py-1 px-3">Previous</button>
          <button className="btn-secondary text-sm py-1 px-3 bg-admin-primary/20 border-admin-primary/30">1</button>
          <button className="btn-secondary text-sm py-1 px-3">2</button>
          <button className="btn-secondary text-sm py-1 px-3">3</button>
          <button className="btn-secondary text-sm py-1 px-3">Next</button>
        </div>
      </div>
    </div>
  );
}
