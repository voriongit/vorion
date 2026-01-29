'use client';

import { useState } from 'react';
import {
  Settings,
  Globe,
  Mail,
  Bell,
  Shield,
  Database,
  Zap,
  Save,
  RefreshCw,
} from 'lucide-react';

const tabs = [
  { id: 'general', name: 'General', icon: Settings },
  { id: 'email', name: 'Email', icon: Mail },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'integrations', name: 'Integrations', icon: Zap },
  { id: 'database', name: 'Database', icon: Database },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-gray-500">Configure global platform settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full nav-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 glass-card rounded-xl p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">General Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Platform Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Vorion AI Governance"
                    className="admin-input max-w-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Support Email
                  </label>
                  <input
                    type="email"
                    defaultValue="support@vorion.org"
                    className="admin-input max-w-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default Timezone
                  </label>
                  <select className="admin-input max-w-md">
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date Format
                  </label>
                  <select className="admin-input max-w-md">
                    <option value="YYYY-MM-DD">2024-04-02</option>
                    <option value="MM/DD/YYYY">04/02/2024</option>
                    <option value="DD/MM/YYYY">02/04/2024</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-gray-700/50">
                  <div>
                    <p className="font-medium">Maintenance Mode</p>
                    <p className="text-sm text-gray-500">Temporarily disable public access</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:ring-4 peer-focus:ring-admin-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-admin-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-gray-700/50">
                  <div>
                    <p className="font-medium">Debug Mode</p>
                    <p className="text-sm text-gray-500">Enable verbose logging</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:ring-4 peer-focus:ring-admin-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-admin-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Security Settings</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">Require 2FA for Admins</p>
                    <p className="text-sm text-gray-500">Force two-factor authentication for admin users</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:ring-4 peer-focus:ring-admin-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-admin-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-gray-700/50">
                  <div>
                    <p className="font-medium">IP Allowlisting</p>
                    <p className="text-sm text-gray-500">Restrict admin access to specific IPs</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:ring-4 peer-focus:ring-admin-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-admin-primary"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    defaultValue="30"
                    className="admin-input max-w-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    defaultValue="5"
                    className="admin-input max-w-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password Policy
                  </label>
                  <select className="admin-input max-w-md">
                    <option value="strong">Strong (12+ chars, mixed case, numbers, symbols)</option>
                    <option value="medium">Medium (8+ chars, mixed case, numbers)</option>
                    <option value="basic">Basic (8+ characters)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Email Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    defaultValue="smtp.sendgrid.net"
                    className="admin-input max-w-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    defaultValue="587"
                    className="admin-input max-w-xs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    From Address
                  </label>
                  <input
                    type="email"
                    defaultValue="noreply@vorion.org"
                    className="admin-input max-w-md"
                  />
                </div>
                <button className="btn-secondary">Send Test Email</button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Notification Settings</h2>
              <p className="text-gray-500">Configure admin notification preferences</p>
              <div className="space-y-4">
                {[
                  'New user registrations',
                  'Failed login attempts',
                  'Security alerts',
                  'Agent tier changes',
                  'Billing events',
                  'System errors',
                ].map((item) => (
                  <div key={item} className="flex items-center justify-between py-2">
                    <span>{item}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:ring-4 peer-focus:ring-admin-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-admin-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeTab === 'integrations' || activeTab === 'database') && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold capitalize">{activeTab} Settings</h2>
              <p className="text-gray-500">Configure {activeTab} settings and connections.</p>
              <div className="p-8 text-center text-gray-500 border border-dashed border-gray-700 rounded-lg">
                Settings panel coming soon
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
