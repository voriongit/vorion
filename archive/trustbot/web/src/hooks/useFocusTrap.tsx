/**
 * Focus Trap Hook
 *
 * Traps focus within a container element for accessibility.
 * Used in modals, dialogs, and other overlay components.
 */

import { useEffect, useRef, useCallback, RefObject } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UseFocusTrapOptions {
    enabled?: boolean;
    initialFocus?: RefObject<HTMLElement>;
    returnFocus?: boolean;
    escapeDeactivates?: boolean;
    onEscape?: () => void;
}

export interface UseFocusTrapReturn {
    containerRef: RefObject<HTMLDivElement>;
    firstFocusableRef: RefObject<HTMLElement>;
    lastFocusableRef: RefObject<HTMLElement>;
}

// ============================================================================
// Focusable Selectors
// ============================================================================

const FOCUSABLE_SELECTORS = [
    'a[href]',
    'area[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    'audio[controls]',
    'video[controls]',
    'details > summary:first-of-type',
].join(',');

// ============================================================================
// Hook
// ============================================================================

export function useFocusTrap(options: UseFocusTrapOptions = {}): UseFocusTrapReturn {
    const {
        enabled = true,
        initialFocus,
        returnFocus = true,
        escapeDeactivates = true,
        onEscape,
    } = options;

    const containerRef = useRef<HTMLDivElement>(null);
    const firstFocusableRef = useRef<HTMLElement>(null);
    const lastFocusableRef = useRef<HTMLElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    // Get all focusable elements in container
    const getFocusableElements = useCallback((): HTMLElement[] => {
        if (!containerRef.current) return [];
        const elements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
        return Array.from(elements).filter(el => {
            // Check visibility
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && !el.hasAttribute('inert');
        });
    }, []);

    // Handle Tab key navigation
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled || !containerRef.current) return;

        // Handle Escape
        if (event.key === 'Escape' && escapeDeactivates) {
            event.preventDefault();
            onEscape?.();
            return;
        }

        // Handle Tab
        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        // Shift + Tab at first element -> go to last
        if (event.shiftKey && activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
            return;
        }

        // Tab at last element -> go to first
        if (!event.shiftKey && activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
            return;
        }

        // If focus is outside container, bring it back
        if (!containerRef.current.contains(activeElement as Node)) {
            event.preventDefault();
            (event.shiftKey ? lastElement : firstElement)?.focus();
        }
    }, [enabled, escapeDeactivates, onEscape, getFocusableElements]);

    // Set initial focus
    useEffect(() => {
        if (!enabled) return;

        // Store previous active element
        previousActiveElement.current = document.activeElement as HTMLElement;

        // Set initial focus
        const setInitialFocus = () => {
            if (initialFocus?.current) {
                initialFocus.current.focus();
            } else {
                const focusableElements = getFocusableElements();
                if (focusableElements.length > 0) {
                    focusableElements[0]?.focus();
                } else {
                    containerRef.current?.focus();
                }
            }
        };

        // Delay to ensure DOM is ready
        const timer = setTimeout(setInitialFocus, 50);

        return () => {
            clearTimeout(timer);
            // Return focus to previous element
            if (returnFocus && previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        };
    }, [enabled, initialFocus, returnFocus, getFocusableElements]);

    // Add/remove keyboard listener
    useEffect(() => {
        if (!enabled) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);

    // Prevent focus from leaving container
    useEffect(() => {
        if (!enabled || !containerRef.current) return;

        const handleFocusIn = (event: FocusEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                const focusableElements = getFocusableElements();
                focusableElements[0]?.focus();
            }
        };

        document.addEventListener('focusin', handleFocusIn);
        return () => document.removeEventListener('focusin', handleFocusIn);
    }, [enabled, getFocusableElements]);

    return {
        containerRef,
        firstFocusableRef,
        lastFocusableRef,
    };
}

// ============================================================================
// Focus Lock Component
// ============================================================================

import { ReactNode } from 'react';

interface FocusLockProps {
    children: ReactNode;
    enabled?: boolean;
    onEscape?: () => void;
    className?: string;
    style?: React.CSSProperties;
}

export function FocusLock({
    children,
    enabled = true,
    onEscape,
    className,
    style,
}: FocusLockProps) {
    const { containerRef } = useFocusTrap({
        enabled,
        escapeDeactivates: !!onEscape,
        onEscape,
    });

    return (
        <div
            ref={containerRef}
            className={className}
            style={style}
            tabIndex={-1}
        >
            {children}
        </div>
    );
}

export default useFocusTrap;
