interface BreadcrumbItem {
    label: string;
    icon?: string;
    onClick?: () => void;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    separator?: string;
    maxItems?: number;
}

export function Breadcrumb({
    items,
    separator = '›',
    maxItems = 4,
}: BreadcrumbProps) {
    // Collapse middle items if too many
    const displayItems = items.length > maxItems
        ? [
            items[0],
            { label: '...', icon: undefined, onClick: undefined },
            ...items.slice(-2),
        ]
        : items;

    return (
        <nav aria-label="Breadcrumb" style={{ marginBottom: '16px' }}>
            <ol
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                }}
            >
                {displayItems.map((item, index) => {
                    const isLast = index === displayItems.length - 1;
                    const isClickable = !!item.onClick && !isLast;

                    return (
                        <li
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            {isClickable ? (
                                <button
                                    onClick={item.onClick}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 8px',
                                        fontSize: '0.85rem',
                                        fontWeight: 500,
                                        background: 'transparent',
                                        color: 'var(--accent-blue, #3b82f6)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s ease',
                                    }}
                                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card, #1a2234)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {item.icon && <span aria-hidden="true">{item.icon}</span>}
                                    {item.label}
                                </button>
                            ) : (
                                <span
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 8px',
                                        fontSize: '0.85rem',
                                        fontWeight: isLast ? 600 : 500,
                                        color: isLast ? 'var(--text-primary, #f9fafb)' : 'var(--text-muted, #6b7280)',
                                    }}
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {item.icon && <span aria-hidden="true">{item.icon}</span>}
                                    {item.label}
                                </span>
                            )}

                            {/* Separator */}
                            {!isLast && (
                                <span
                                    style={{
                                        color: 'var(--text-muted, #6b7280)',
                                        fontSize: '0.9rem',
                                    }}
                                    aria-hidden="true"
                                >
                                    {separator}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

// Compact back button variant for modals
interface BackButtonProps {
    label?: string;
    onClick: () => void;
}

export function BackButton({ label = 'Back', onClick }: BackButtonProps) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                marginBottom: '12px',
                fontSize: '0.85rem',
                fontWeight: 500,
                background: 'var(--bg-card, #1a2234)',
                color: 'var(--text-secondary, #9ca3af)',
                border: '1px solid var(--border-color, #374151)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
            }}
            onMouseOver={e => {
                e.currentTarget.style.background = 'var(--bg-card-hover, #232d42)';
                e.currentTarget.style.color = 'var(--text-primary, #f9fafb)';
            }}
            onMouseOut={e => {
                e.currentTarget.style.background = 'var(--bg-card, #1a2234)';
                e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
            }}
        >
            <span aria-hidden="true">←</span>
            {label}
        </button>
    );
}

// Modal header with breadcrumb built-in
interface ModalHeaderProps {
    title: string;
    icon?: string;
    breadcrumb?: BreadcrumbItem[];
    onClose: () => void;
    onBack?: () => void;
}

export function ModalHeader({
    title,
    icon,
    breadcrumb,
    onClose,
    onBack,
}: ModalHeaderProps) {
    return (
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {/* Breadcrumb row */}
            {breadcrumb && breadcrumb.length > 1 && (
                <Breadcrumb items={breadcrumb} />
            )}

            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {onBack && (
                        <button
                            onClick={onBack}
                            aria-label="Go back"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                padding: 0,
                                background: 'var(--bg-card, #1a2234)',
                                border: '1px solid var(--border-color, #374151)',
                                borderRadius: '6px',
                                color: 'var(--text-secondary, #9ca3af)',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'var(--bg-card-hover, #232d42)';
                                e.currentTarget.style.color = 'var(--text-primary, #f9fafb)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = 'var(--bg-card, #1a2234)';
                                e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
                            }}
                        >
                            ←
                        </button>
                    )}
                    <h2 id="modal-title" style={{ margin: 0 }}>
                        {icon && <span style={{ marginRight: '8px' }}>{icon}</span>}
                        {title}
                    </h2>
                </div>
                <button className="close-btn" onClick={onClose} aria-label="Close">
                    ✕
                </button>
            </div>
        </div>
    );
}
