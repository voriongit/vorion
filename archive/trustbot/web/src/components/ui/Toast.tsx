/**
 * Toast Notification System
 *
 * Provides accessible, animated toast notifications with:
 * - Multiple toast types (success, error, warning, info)
 * - Auto-dismiss with configurable duration
 * - Manual dismiss
 * - Stacking support
 * - Screen reader announcements
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number;
    dismissible?: boolean;
}

export interface ToastOptions {
    title?: string;
    duration?: number;
    dismissible?: boolean;
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (type: ToastType, message: string, options?: ToastOptions) => string;
    removeToast: (id: string) => void;
    success: (message: string, options?: ToastOptions) => string;
    error: (message: string, options?: ToastOptions) => string;
    warning: (message: string, options?: ToastOptions) => string;
    info: (message: string, options?: ToastOptions) => string;
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// ============================================================================
// Toast Provider
// ============================================================================

interface ToastProviderProps {
    children: ReactNode;
    maxToasts?: number;
    defaultDuration?: number;
}

export function ToastProvider({
    children,
    maxToasts = 5,
    defaultDuration = 5000,
}: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((
        type: ToastType,
        message: string,
        options?: ToastOptions
    ): string => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const toast: Toast = {
            id,
            type,
            message,
            title: options?.title,
            duration: options?.duration ?? defaultDuration,
            dismissible: options?.dismissible ?? true,
        };

        setToasts(prev => {
            const newToasts = [...prev, toast];
            // Remove oldest if exceeding max
            if (newToasts.length > maxToasts) {
                return newToasts.slice(-maxToasts);
            }
            return newToasts;
        });

        return id;
    }, [defaultDuration, maxToasts]);

    const success = useCallback((message: string, options?: ToastOptions) =>
        addToast('success', message, options), [addToast]);

    const error = useCallback((message: string, options?: ToastOptions) =>
        addToast('error', message, { duration: 8000, ...options }), [addToast]);

    const warning = useCallback((message: string, options?: ToastOptions) =>
        addToast('warning', message, options), [addToast]);

    const info = useCallback((message: string, options?: ToastOptions) =>
        addToast('info', message, options), [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

// ============================================================================
// Toast Container
// ============================================================================

interface ToastContainerProps {
    toasts: Toast[];
    removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    return (
        <div
            className="toast-container"
            role="region"
            aria-label="Notifications"
            style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxWidth: 400,
                pointerEvents: 'none',
            }}
        >
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

// ============================================================================
// Toast Item
// ============================================================================

interface ToastItemProps {
    toast: Toast;
    onDismiss: () => void;
}

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', icon: '✓' },
    error: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', icon: '✕' },
    warning: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', icon: '⚠' },
    info: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', icon: 'ℹ' },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const style = TOAST_STYLES[toast.type];

    useEffect(() => {
        // Animate in
        const showTimer = setTimeout(() => setIsVisible(true), 10);

        // Auto dismiss
        let dismissTimer: ReturnType<typeof setTimeout>;
        if (toast.duration && toast.duration > 0) {
            dismissTimer = setTimeout(() => {
                setIsLeaving(true);
                setTimeout(onDismiss, 300);
            }, toast.duration);
        }

        return () => {
            clearTimeout(showTimer);
            if (dismissTimer) clearTimeout(dismissTimer);
        };
    }, [toast.duration, onDismiss]);

    const handleDismiss = () => {
        setIsLeaving(true);
        setTimeout(onDismiss, 300);
    };

    return (
        <div
            role="alert"
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 16px',
                background: style.bg,
                border: `1px solid ${style.border}`,
                borderRadius: 8,
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                pointerEvents: 'auto',
                opacity: isVisible && !isLeaving ? 1 : 0,
                transform: isVisible && !isLeaving ? 'translateX(0)' : 'translateX(100%)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
            }}
        >
            {/* Icon */}
            <span
                style={{
                    fontSize: 18,
                    color: style.border,
                    fontWeight: 600,
                    lineHeight: 1,
                    marginTop: 2,
                }}
            >
                {style.icon}
            </span>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {toast.title && (
                    <div
                        style={{
                            fontWeight: 600,
                            fontSize: 14,
                            marginBottom: 4,
                            color: 'white',
                        }}
                    >
                        {toast.title}
                    </div>
                )}
                <div
                    style={{
                        fontSize: 13,
                        color: 'rgba(255, 255, 255, 0.9)',
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                    }}
                >
                    {toast.message}
                </div>
            </div>

            {/* Dismiss button */}
            {toast.dismissible && (
                <button
                    onClick={handleDismiss}
                    aria-label="Dismiss notification"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        padding: 4,
                        fontSize: 16,
                        lineHeight: 1,
                        borderRadius: 4,
                        transition: 'color 0.2s',
                    }}
                    onMouseOver={e => (e.currentTarget.style.color = 'white')}
                    onMouseOut={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
                >
                    ×
                </button>
            )}
        </div>
    );
}

export default ToastProvider;
