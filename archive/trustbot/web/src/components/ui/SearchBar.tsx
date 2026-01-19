import { useState, useRef, useEffect, useId } from 'react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    onSubmit?: (value: string) => void;
    autoFocus?: boolean;
    debounceMs?: number;
    showClear?: boolean;
    showCount?: boolean;
    resultCount?: number;
    size?: 'small' | 'medium' | 'large';
}

export function SearchBar({
    value,
    onChange,
    placeholder = 'Search...',
    onSubmit,
    autoFocus = false,
    debounceMs = 0,
    showClear = true,
    showCount = false,
    resultCount = 0,
    size = 'medium',
}: SearchBarProps) {
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [localValue, setLocalValue] = useState(value);
    const debounceRef = useRef<NodeJS.Timeout>();

    const sizes = {
        small: { height: '36px', fontSize: '0.85rem', iconSize: '14px', padding: '8px 12px' },
        medium: { height: '44px', fontSize: '0.9rem', iconSize: '16px', padding: '10px 14px' },
        large: { height: '52px', fontSize: '1rem', iconSize: '18px', padding: '12px 16px' },
    };

    const s = sizes[size];

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const handleChange = (newValue: string) => {
        setLocalValue(newValue);

        if (debounceMs > 0) {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            debounceRef.current = setTimeout(() => {
                onChange(newValue);
            }, debounceMs);
        } else {
            onChange(newValue);
        }
    };

    const handleClear = () => {
        setLocalValue('');
        onChange('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && onSubmit) {
            onSubmit(localValue);
        }
        if (e.key === 'Escape') {
            handleClear();
        }
    };

    return (
        <div
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
            }}
        >
            {/* Search icon */}
            <span
                style={{
                    position: 'absolute',
                    left: '14px',
                    fontSize: s.iconSize,
                    color: 'var(--text-muted, #6b7280)',
                    pointerEvents: 'none',
                }}
                aria-hidden="true"
            >
                🔍
            </span>

            {/* Input */}
            <input
                ref={inputRef}
                id={id}
                type="search"
                value={localValue}
                onChange={e => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label={placeholder}
                style={{
                    width: '100%',
                    height: s.height,
                    padding: s.padding,
                    paddingLeft: '42px',
                    paddingRight: showClear && localValue ? '80px' : '14px',
                    fontSize: s.fontSize,
                    background: 'var(--bg-primary, #0a0e17)',
                    border: '2px solid var(--border-color, #374151)',
                    borderRadius: '10px',
                    color: 'var(--text-primary, #f9fafb)',
                    outline: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-blue, #3b82f6)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                }}
                onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--border-color, #374151)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            />

            {/* Right side controls */}
            <div
                style={{
                    position: 'absolute',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}
            >
                {/* Result count */}
                {showCount && localValue && (
                    <span
                        style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted, #6b7280)',
                            background: 'var(--bg-card, #1a2234)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                        }}
                    >
                        {resultCount} result{resultCount !== 1 ? 's' : ''}
                    </span>
                )}

                {/* Clear button */}
                {showClear && localValue && (
                    <button
                        onClick={handleClear}
                        aria-label="Clear search"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            padding: 0,
                            background: 'var(--bg-card, #1a2234)',
                            border: 'none',
                            borderRadius: '50%',
                            color: 'var(--text-muted, #6b7280)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease, color 0.15s ease',
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'var(--accent-red, #ef4444)';
                            e.currentTarget.style.color = 'white';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'var(--bg-card, #1a2234)';
                            e.currentTarget.style.color = 'var(--text-muted, #6b7280)';
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}

// Filter bar variant with category pills
interface FilterBarProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    filters: Array<{ id: string; label: string; icon?: string; count?: number }>;
    activeFilter: string;
    onFilterChange: (id: string) => void;
    placeholder?: string;
}

export function FilterBar({
    searchValue,
    onSearchChange,
    filters,
    activeFilter,
    onFilterChange,
    placeholder = 'Search...',
}: FilterBarProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SearchBar
                value={searchValue}
                onChange={onSearchChange}
                placeholder={placeholder}
                debounceMs={150}
            />

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                }}
            >
                {filters.map(filter => (
                    <button
                        key={filter.id}
                        onClick={() => onFilterChange(filter.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            background: activeFilter === filter.id
                                ? 'var(--accent-blue, #3b82f6)'
                                : 'var(--bg-card, #1a2234)',
                            color: activeFilter === filter.id
                                ? 'white'
                                : 'var(--text-secondary, #9ca3af)',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseOver={e => {
                            if (activeFilter !== filter.id) {
                                e.currentTarget.style.background = 'var(--bg-card-hover, #232d42)';
                            }
                        }}
                        onMouseOut={e => {
                            if (activeFilter !== filter.id) {
                                e.currentTarget.style.background = 'var(--bg-card, #1a2234)';
                            }
                        }}
                    >
                        {filter.icon && <span aria-hidden="true">{filter.icon}</span>}
                        {filter.label}
                        {filter.count !== undefined && (
                            <span
                                style={{
                                    background: activeFilter === filter.id
                                        ? 'rgba(255,255,255,0.2)'
                                        : 'var(--bg-secondary, #111827)',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    fontSize: '0.7rem',
                                }}
                            >
                                {filter.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
