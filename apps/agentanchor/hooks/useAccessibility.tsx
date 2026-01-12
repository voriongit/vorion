'use client'

/**
 * Accessibility Hooks
 *
 * Hooks for building accessible components.
 * Part of Frontend Architecture Section 7.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useMediaQuery } from './useMediaQuery'

/**
 * Respect user's reduced motion preference
 *
 * @example
 * const prefersReducedMotion = useReducedMotion()
 *
 * <motion.div
 *   animate={{ opacity: 1 }}
 *   transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
 * />
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * Detect high contrast mode
 *
 * @example
 * const isHighContrast = useHighContrast()
 * const borderColor = isHighContrast ? 'border-black' : 'border-gray-200'
 */
export function useHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: high)')
}

/**
 * Focus trap for modals and dialogs
 *
 * @example
 * const { containerRef } = useFocusTrap(isOpen)
 *
 * <div ref={containerRef}>
 *   <button>First focusable</button>
 *   <button>Last focusable</button>
 * </div>
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    // Store the currently focused element to restore later
    previousActiveElement.current = document.activeElement as HTMLElement

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element
    firstElement.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      // Restore focus to previous element
      previousActiveElement.current?.focus()
    }
  }, [isActive])

  return { containerRef }
}

/**
 * Announce content to screen readers via ARIA live region
 *
 * @example
 * const { announce } = useAnnounce()
 *
 * // When trust score changes
 * announce(`Trust score updated to ${newScore}`)
 */
export function useAnnounce() {
  const [message, setMessage] = useState('')

  const announce = useCallback((text: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Clear and reset to trigger announcement
    setMessage('')
    requestAnimationFrame(() => {
      setMessage(text)
    })
  }, [])

  // Render this in your component tree
  const Announcer = () => (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )

  return { announce, Announcer, message }
}

/**
 * Skip link management for keyboard navigation
 *
 * @example
 * const { SkipLink, mainRef } = useSkipLink()
 *
 * <SkipLink />
 * <nav>...</nav>
 * <main ref={mainRef}>...</main>
 */
export function useSkipLink() {
  const mainRef = useRef<HTMLElement>(null)

  const handleSkip = useCallback(() => {
    mainRef.current?.focus()
    mainRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const SkipLink = () => (
    <a
      href="#main-content"
      onClick={(e) => {
        e.preventDefault()
        handleSkip()
      }}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-gray-900 focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-blue-500"
    >
      Skip to main content
    </a>
  )

  return { SkipLink, mainRef }
}

/**
 * Keyboard shortcut handler
 *
 * @example
 * useKeyboardShortcut('Escape', () => closeModal())
 * useKeyboardShortcut('k', () => openSearch(), { meta: true })
 */
interface ShortcutOptions {
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  preventDefault?: boolean
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: ShortcutOptions = {}
) {
  const { meta, ctrl, shift, alt, preventDefault = true } = options

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const matchesKey = e.key.toLowerCase() === key.toLowerCase()
      const matchesMeta = meta ? e.metaKey : !e.metaKey || meta === undefined
      const matchesCtrl = ctrl ? e.ctrlKey : !e.ctrlKey || ctrl === undefined
      const matchesShift = shift ? e.shiftKey : !e.shiftKey || shift === undefined
      const matchesAlt = alt ? e.altKey : !e.altKey || alt === undefined

      // For modifier shortcuts, check that ONLY the specified modifiers are pressed
      if (meta || ctrl || shift || alt) {
        if (
          matchesKey &&
          (meta ? e.metaKey : true) &&
          (ctrl ? e.ctrlKey : true) &&
          (shift ? e.shiftKey : true) &&
          (alt ? e.altKey : true)
        ) {
          if (preventDefault) e.preventDefault()
          callback()
        }
      } else if (matchesKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // For non-modifier shortcuts, ensure no modifiers are pressed
        // (except shift which may be needed for capital letters)
        if (preventDefault) e.preventDefault()
        callback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, callback, meta, ctrl, shift, alt, preventDefault])
}

/**
 * Escape key handler - common pattern for closing dialogs
 *
 * @example
 * useEscapeKey(() => setIsOpen(false))
 */
export function useEscapeKey(callback: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        callback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [callback, enabled])
}
