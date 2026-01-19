import React from 'react';

/**
 * Breadcrumb Component
 *
 * Navigation breadcrumb for Mission Control pages.
 * Supports back navigation and displays current location.
 *
 * Story 1.5: Agent Profile Navigation with AgentLink
 * FR: FR2
 */

export interface BreadcrumbItem {
    /** Display label for the breadcrumb item */
    label: string;
    /** Navigation path (optional - if not provided, item is not clickable) */
    path?: string;
    /** Click handler (alternative to path) */
    onClick?: () => void;
}

export interface BreadcrumbProps {
    /** Array of breadcrumb items */
    items: BreadcrumbItem[];
    /** Navigation handler for router integration */
    onNavigate?: (path: string) => void;
    /** Separator between items */
    separator?: string;
    /** Additional CSS class */
    className?: string;
    /** Test ID for testing */
    testId?: string;
}

/**
 * Breadcrumb Component
 *
 * @example
 * ```tsx
 * <Breadcrumb
 *   items={[
 *     { label: 'Dashboard', path: '/dashboard' },
 *     { label: 'Agent: DataProcessor', path: undefined },
 *   ]}
 *   onNavigate={navigate}
 * />
 * ```
 */
export function Breadcrumb({
    items,
    onNavigate,
    separator = '›',
    className = '',
    testId = 'breadcrumb',
}: BreadcrumbProps): React.ReactElement {
    const handleClick = (item: BreadcrumbItem) => {
        if (item.onClick) {
            item.onClick();
        } else if (item.path && onNavigate) {
            onNavigate(item.path);
        }
    };

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        fontSize: '13px',
        fontFamily: 'inherit',
    };

    const separatorStyle: React.CSSProperties = {
        color: 'var(--color-muted, #6b7280)',
        fontSize: '14px',
        userSelect: 'none',
    };

    const itemStyle = (isClickable: boolean, isLast: boolean): React.CSSProperties => ({
        color: isLast
            ? 'var(--color-text, #fff)'
            : 'var(--color-muted, #6b7280)',
        cursor: isClickable && !isLast ? 'pointer' : 'default',
        textDecoration: 'none',
        transition: 'color 0.15s ease',
        fontWeight: isLast ? 500 : 400,
    });

    const backButtonStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        background: 'var(--color-surface, rgba(0,0,0,0.1))',
        border: 'none',
        borderRadius: '4px',
        color: 'var(--color-muted, #6b7280)',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease',
    };

    // Get the first clickable item for back navigation
    const backItem = items.length > 1 ? items[0] : null;

    return (
        <nav
            className={`breadcrumb ${className}`}
            style={containerStyle}
            aria-label="Breadcrumb navigation"
            data-testid={testId}
        >
            {/* Back Button */}
            {backItem && (backItem.path || backItem.onClick) && (
                <button
                    style={backButtonStyle}
                    onClick={() => handleClick(backItem)}
                    aria-label={`Go back to ${backItem.label}`}
                    data-testid={`${testId}-back`}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = 'var(--color-surface-hover, rgba(255,255,255,0.1))';
                        e.currentTarget.style.color = 'var(--color-text, #fff)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = 'var(--color-surface, rgba(0,0,0,0.1))';
                        e.currentTarget.style.color = 'var(--color-muted, #6b7280)';
                    }}
                >
                    ← Back
                </button>
            )}

            {/* Breadcrumb Items */}
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                const isClickable = !!(item.path || item.onClick);

                return (
                    <React.Fragment key={index}>
                        {index > 0 && (
                            <span style={separatorStyle} aria-hidden="true">
                                {separator}
                            </span>
                        )}
                        {isClickable && !isLast ? (
                            <button
                                style={{
                                    ...itemStyle(isClickable, isLast),
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    font: 'inherit',
                                }}
                                onClick={() => handleClick(item)}
                                data-testid={`${testId}-item-${index}`}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.color = 'var(--color-primary, #3b82f6)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.color = 'var(--color-muted, #6b7280)';
                                }}
                            >
                                {item.label}
                            </button>
                        ) : (
                            <span
                                style={itemStyle(isClickable, isLast)}
                                aria-current={isLast ? 'page' : undefined}
                                data-testid={`${testId}-item-${index}`}
                            >
                                {item.label}
                            </span>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
}

export default Breadcrumb;
