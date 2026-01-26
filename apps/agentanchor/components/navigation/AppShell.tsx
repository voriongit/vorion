'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import MobileSidebar from './MobileSidebar'
import Header from './Header'
import { useSidebar } from '@/hooks/useSidebar'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { type UserRole } from '@/lib/navigation/menu-items'
import {
  MiniMap,
  QuickTravelProvider,
  FloorMemoryProvider,
} from '@/components/building'

interface AppShellProps {
  children: React.ReactNode
  userRole?: UserRole
}

/**
 * Skip link component for keyboard accessibility
 */
function SkipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
    >
      {children}
    </a>
  )
}

export default function AppShell({ children, userRole = 'consumer' }: AppShellProps) {
  const { isCollapsed, isMobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebar()
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobile()
  }, [pathname, closeMobile])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileOpen])

  // Announce route changes to screen readers
  useEffect(() => {
    const pageTitle = document.title
    const announcement = document.getElementById('route-announcement')
    if (announcement) {
      announcement.textContent = `Navigated to ${pageTitle}`
    }
  }, [pathname])

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900" role="status" aria-label="Loading application">
        <div className="flex items-center justify-center h-screen">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
            aria-hidden="true"
          />
          <span className="sr-only">Loading AgentAnchor...</span>
        </div>
      </div>
    )
  }

  return (
    <FloorMemoryProvider>
      <QuickTravelProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Skip Links for keyboard navigation */}
          <SkipLink href="#main-content">Skip to main content</SkipLink>
          <SkipLink href="#main-navigation">Skip to navigation</SkipLink>

          {/* Screen reader announcements */}
          <div
            id="route-announcement"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          />

          {/* Desktop Sidebar - hidden on mobile via CSS */}
          <Sidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={toggleCollapse}
            userRole={userRole}
          />

          {/* Mobile Sidebar */}
          <MobileSidebar
            isOpen={isMobileOpen}
            onClose={closeMobile}
            userRole={userRole}
          />

          {/* Header */}
          <Header
            onMenuClick={toggleMobile}
            sidebarCollapsed={isCollapsed}
          />

          {/* Main Content */}
          <main
            id="main-content"
            role="main"
            aria-label="Main content"
            tabIndex={-1}
            className={`pt-16 min-h-screen transition-all duration-300 focus:outline-none ${
              isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
            }`}
          >
            <div className="p-4 sm:p-6">
              {children}
            </div>
          </main>

          {/* Building Navigation - MiniMap (bottom-right corner) */}
          {!isMobile && <MiniMap position="bottom-right" showActivity />}
        </div>
      </QuickTravelProvider>
    </FloorMemoryProvider>
  )
}
