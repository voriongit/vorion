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

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-screen">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <FloorMemoryProvider>
      <QuickTravelProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Desktop Sidebar */}
          {!isMobile && (
            <Sidebar
              isCollapsed={isCollapsed}
              onToggleCollapse={toggleCollapse}
              userRole={userRole}
            />
          )}

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
            className={`pt-16 transition-all duration-300 ${
              !isMobile ? (isCollapsed ? 'lg:ml-16' : 'lg:ml-64') : ''
            }`}
          >
            <div className="p-6">
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
