'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Bot,
  ScrollText,
  Settings,
  Shield,
  Activity,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  Key,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/dashboard/users', icon: Users },
  { name: 'Organizations', href: '/dashboard/organizations', icon: Building2 },
  { name: 'Agents', href: '/dashboard/agents', icon: Bot },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
  { name: 'Audit Logs', href: '/dashboard/audit-logs', icon: ScrollText },
  { name: 'Monitoring', href: '/dashboard/monitoring', icon: Activity },
  { name: 'Security', href: '/dashboard/security', icon: Shield },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-admin-dark flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-admin-border bg-admin-surface/50 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-admin-border">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-admin-primary to-admin-secondary flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">Vorion Admin</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="p-4 border-t border-admin-border">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-admin-primary to-admin-accent flex items-center justify-center">
              <span className="text-white font-medium text-sm">SA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Super Admin</p>
              <p className="text-xs text-gray-500 truncate">admin@vorion.org</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 border-b border-admin-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search users, orgs, agents..."
                className="admin-input pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-gray-800/50 transition">
              <Bell className="w-5 h-5 text-gray-400" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/50 transition text-gray-400">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
