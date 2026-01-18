'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Anchor } from 'lucide-react'
import { getMenuSections, type UserRole } from '@/lib/navigation/menu-items'

interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  userRole: UserRole
}

export default function Sidebar({ isCollapsed, onToggleCollapse, userRole }: SidebarProps) {
  const pathname = usePathname()
  const sections = getMenuSections(userRole)

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 hidden lg:flex flex-col ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Anchor className="h-8 w-8 text-blue-600" />
            {!isCollapsed && (
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                AgentAnchor
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {sections.map((section) => (
            <div key={section.id} className="mb-6">
              {/* Section Label */}
              {!isCollapsed && section.label && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {section.label}
                </h3>
              )}
              {isCollapsed && section.id !== 'home' && (
                <div className="mb-2 border-t border-gray-200 dark:border-gray-700" />
              )}

              {/* Menu Items */}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    pathname === item.href || pathname?.startsWith(item.href + '/')

                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${
                            isActive
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="ml-3">{item.label}</span>
                        )}
                        {!isCollapsed && item.badge && (
                          <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span className="ml-2 text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
