'use client';

import {
  Shield,
  AlertTriangle,
  Lock,
  Key,
  Globe,
  UserX,
  Activity,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';

const securityEvents = [
  {
    id: '1',
    type: 'suspicious_login',
    severity: 'high',
    description: 'Multiple failed login attempts from unusual location',
    user: 'admin@acme.com',
    ip: '198.51.100.23',
    location: 'Moscow, Russia',
    time: '15 minutes ago',
    status: 'investigating',
  },
  {
    id: '2',
    type: 'rate_limit',
    severity: 'medium',
    description: 'API rate limit exceeded',
    user: 'api-key-xyz123',
    ip: '203.0.113.45',
    location: 'Singapore',
    time: '1 hour ago',
    status: 'resolved',
  },
  {
    id: '3',
    type: 'permission_escalation',
    severity: 'high',
    description: 'Attempted unauthorized tier upgrade',
    user: 'Agent: TaskAutomator',
    ip: 'internal',
    location: 'CloudNine Solutions',
    time: '2 hours ago',
    status: 'blocked',
  },
  {
    id: '4',
    type: 'new_device',
    severity: 'low',
    description: 'Login from new device',
    user: 'sarah@techstart.io',
    ip: '10.0.0.54',
    location: 'San Francisco, USA',
    time: '3 hours ago',
    status: 'verified',
  },
];

const blockedIPs = [
  { ip: '198.51.100.0/24', reason: 'Known malicious network', blocked: '2024-03-15', requests: 12847 },
  { ip: '203.0.113.100', reason: 'Brute force attempt', blocked: '2024-03-28', requests: 5234 },
  { ip: '192.0.2.50', reason: 'API abuse', blocked: '2024-04-01', requests: 89421 },
];

const securityMetrics = [
  { name: 'Blocked Requests (24h)', value: '12,847', icon: Shield, color: 'blue' },
  { name: 'Failed Logins (24h)', value: '342', icon: UserX, color: 'amber' },
  { name: 'Active Threats', value: '3', icon: AlertTriangle, color: 'red' },
  { name: 'Security Score', value: '94/100', icon: CheckCircle, color: 'green' },
];

export default function SecurityPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Center</h1>
          <p className="text-gray-500">Monitor and manage platform security</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Security Scan
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {securityMetrics.map((metric) => (
          <div key={metric.name} className="stat-card">
            <div className={`p-2 rounded-lg w-fit ${
              metric.color === 'blue' ? 'bg-blue-500/20' :
              metric.color === 'amber' ? 'bg-amber-500/20' :
              metric.color === 'red' ? 'bg-red-500/20' :
              'bg-green-500/20'
            }`}>
              <metric.icon className={`w-5 h-5 ${
                metric.color === 'blue' ? 'text-blue-400' :
                metric.color === 'amber' ? 'text-amber-400' :
                metric.color === 'red' ? 'text-red-400' :
                'text-green-400'
              }`} />
            </div>
            <p className="text-2xl font-bold mt-2">{metric.value}</p>
            <p className="text-sm text-gray-500">{metric.name}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Events */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Security Events</h2>
          <div className="space-y-3">
            {securityEvents.map((event) => (
              <div key={event.id} className="p-4 rounded-lg bg-gray-800/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      event.severity === 'high' ? 'bg-red-500/20' :
                      event.severity === 'medium' ? 'bg-amber-500/20' :
                      'bg-blue-500/20'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        event.severity === 'high' ? 'text-red-400' :
                        event.severity === 'medium' ? 'text-amber-400' :
                        'text-blue-400'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{event.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          {event.user}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {event.ip}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${
                      event.status === 'investigating' ? 'badge-warning' :
                      event.status === 'blocked' ? 'badge-error' :
                      event.status === 'resolved' ? 'badge-success' :
                      'badge-info'
                    }`}>
                      {event.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{event.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button className="w-full btn-secondary flex items-center gap-2 justify-start">
                <Lock className="w-4 h-4" />
                Force Password Reset
              </button>
              <button className="w-full btn-secondary flex items-center gap-2 justify-start">
                <UserX className="w-4 h-4" />
                Revoke All Sessions
              </button>
              <button className="w-full btn-secondary flex items-center gap-2 justify-start">
                <Key className="w-4 h-4" />
                Rotate API Keys
              </button>
              <button className="w-full btn-secondary flex items-center gap-2 justify-start">
                <Shield className="w-4 h-4" />
                Enable Lockdown
              </button>
            </div>
          </div>

          {/* Blocked IPs */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Blocked IPs</h2>
            <div className="space-y-3">
              {blockedIPs.map((ip, i) => (
                <div key={i} className="p-3 rounded-lg bg-gray-800/30">
                  <div className="flex items-center justify-between">
                    <code className="text-sm text-red-400">{ip.ip}</code>
                    <button className="text-xs text-gray-500 hover:text-white">
                      Unblock
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{ip.reason}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {ip.requests.toLocaleString()} blocked requests
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
