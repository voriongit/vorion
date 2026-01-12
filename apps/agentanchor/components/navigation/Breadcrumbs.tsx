'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { generateBreadcrumbs } from '@/lib/navigation/breadcrumb-utils'

export default function Breadcrumbs() {
  const pathname = usePathname()
  const breadcrumbs = generateBreadcrumbs(pathname || '')

  // Don't show breadcrumbs on dashboard (root)
  if (!pathname || pathname === '/dashboard' || pathname === '/') {
    return (
      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
        <Home className="h-4 w-4" />
        <span className="ml-2 font-medium text-gray-900 dark:text-white">Dashboard</span>
      </div>
    )
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center">
      <ol className="flex items-center space-x-1 text-sm">
        {/* Home link */}
        <li>
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {/* Breadcrumb items */}
        {breadcrumbs.map((item, index) => (
          <li key={item.href} className="flex items-center">
            <ChevronRight className="h-4 w-4 text-gray-400" />
            {item.isCurrentPage ? (
              <span
                className="ml-1 font-medium text-gray-900 dark:text-white"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
