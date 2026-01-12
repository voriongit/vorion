'use client'

import { useState, useEffect, useCallback } from 'react'

const SIDEBAR_STORAGE_KEY = 'agentanchor-sidebar-collapsed'

export function useSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored !== null) {
      setIsCollapsed(stored === 'true')
    }
  }, [])

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed))
  }, [isCollapsed])

  // Toggle sidebar collapse
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  // Toggle mobile sidebar
  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev)
  }, [])

  // Close mobile sidebar
  const closeMobile = useCallback(() => {
    setIsMobileOpen(false)
  }, [])

  // Open mobile sidebar
  const openMobile = useCallback(() => {
    setIsMobileOpen(true)
  }, [])

  // Keyboard shortcut: Cmd/Ctrl + B to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggleCollapse()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleCollapse])

  // Close mobile sidebar on route change (handled by component)
  // Close mobile sidebar on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        closeMobile()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobileOpen, closeMobile])

  return {
    isCollapsed,
    isMobileOpen,
    toggleCollapse,
    toggleMobile,
    closeMobile,
    openMobile,
    setIsCollapsed,
  }
}
