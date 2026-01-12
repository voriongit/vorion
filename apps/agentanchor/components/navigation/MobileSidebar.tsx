'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, Anchor } from 'lucide-react'
import { getMenuSections, type UserRole } from '@/lib/navigation/menu-items'

interface MobileSidebarProps {
  isOpen: boolean
  onClose: () => void
  userRole: UserRole
}

export default function MobileSidebar({ isOpen, onClose, userRole }: MobileSidebarProps) {
  const pathname = usePathname()
  const sections = getMenuSections(userRole)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 shadow-xl lg:hidden">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
            <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
              <Anchor className="h-8 w-8 text-blue-600" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                AgentAnchor
              </span>
            </Link>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close sidebar</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {sections.map((section) => (
              <div key={section.id} className="mb-6">
                {section.label && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {section.label}
                  </h3>
                )}

                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive =
                      pathname === item.href || pathname?.startsWith(item.href + '/')

                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={`flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              isActive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
                          />
                          <span className="ml-3">{item.label}</span>
                          {item.badge && (
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
        </div>
      </aside>
    </>
  )
}
