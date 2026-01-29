'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  Shield,
  Activity,
  Settings,
  LogOut,
  BarChart3,
  Users,
  User,
  Bell,
  Key,
  CreditCard,
  Globe,
  Moon,
  Save,
  Mail,
  Building,
} from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'billing'>('profile')
  const [profileData, setProfileData] = useState({
    name: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Corp',
    timezone: 'America/New_York',
  })

  const [notifications, setNotifications] = useState({
    email: true,
    agentAlerts: true,
    weeklyReport: true,
    marketing: false,
  })

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">Aurais</span>
        </div>

        <nav className="flex-1 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link href="/dashboard/agents" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Bot className="w-5 h-5" />
            <span>My Agents</span>
          </Link>
          <Link href="/marketplace" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Users className="w-5 h-5" />
            <span>Marketplace</span>
          </Link>
          <Link href="/dashboard/activity" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Activity className="w-5 h-5" />
            <span>Activity</span>
          </Link>
          <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-aurais-primary/10 text-white">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="pt-4 border-t border-white/10">
          <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition w-full">
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-400">Manage your account and preferences</p>
        </div>

        <div className="flex gap-6">
          {/* Settings Nav */}
          <div className="w-48 space-y-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                activeTab === 'profile' ? 'bg-aurais-primary/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <User className="w-5 h-5" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                activeTab === 'notifications' ? 'bg-aurais-primary/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bell className="w-5 h-5" />
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                activeTab === 'security' ? 'bg-aurais-primary/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Key className="w-5 h-5" />
              Security
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                activeTab === 'billing' ? 'bg-aurais-primary/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Billing
            </button>
          </div>

          {/* Settings Content */}
          <div className="flex-1 max-w-2xl">
            {activeTab === 'profile' && (
              <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">Profile Settings</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <User className="w-4 h-4 inline mr-2" />
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <Building className="w-4 h-4 inline mr-2" />
                      Company
                    </label>
                    <input
                      type="text"
                      value={profileData.company}
                      onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <Globe className="w-4 h-4 inline mr-2" />
                      Timezone
                    </label>
                    <select
                      value={profileData.timezone}
                      onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
                    >
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                    </select>
                  </div>
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { key: 'email', label: 'Email Notifications', desc: 'Receive important updates via email' },
                    { key: 'agentAlerts', label: 'Agent Alerts', desc: 'Get notified about agent status changes' },
                    { key: 'weeklyReport', label: 'Weekly Report', desc: 'Summary of agent activity and trust scores' },
                    { key: 'marketing', label: 'Marketing', desc: 'Product updates and announcements' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition">
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-gray-400">{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifications[item.key as keyof typeof notifications]}
                        onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                        className="w-5 h-5 rounded border-white/20 bg-white/5 text-aurais-primary focus:ring-aurais-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">Security Settings</h2>
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-white/5">
                    <h3 className="font-medium mb-2">Change Password</h3>
                    <p className="text-sm text-gray-400 mb-4">Update your password to keep your account secure</p>
                    <button className="px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition">
                      Change Password
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <h3 className="font-medium mb-2">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-400 mb-4">Add an extra layer of security to your account</p>
                    <button className="px-4 py-2 rounded-lg glass glass-hover transition">
                      Enable 2FA
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <h3 className="font-medium mb-2">API Keys</h3>
                    <p className="text-sm text-gray-400 mb-4">Manage API keys for programmatic access</p>
                    <button className="px-4 py-2 rounded-lg glass glass-hover transition">
                      Manage API Keys
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">Billing & Subscription</h2>
                <div className="p-4 rounded-xl bg-aurais-primary/10 border border-aurais-primary/20 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Current Plan</span>
                    <span className="px-2 py-1 rounded-full bg-aurais-primary text-xs font-medium">Core</span>
                  </div>
                  <p className="text-sm text-gray-400">Free tier with basic features</p>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-medium">Pro Plan</h3>
                        <p className="text-sm text-gray-400">Unlimited agents, advanced analytics</p>
                      </div>
                      <span className="text-xl font-bold">$49/mo</span>
                    </div>
                    <button className="w-full px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition mt-2">
                      Upgrade to Pro
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
