import { CSSProperties } from 'react';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    style?: CSSProperties;
}

export function Skeleton({
    width = '100%',
    height = '20px',
    borderRadius = '6px',
    style,
}: SkeletonProps) {
    return (
        <div
            style={{
                width,
                height,
                borderRadius,
                background: 'linear-gradient(90deg, var(--bg-card, #1a2234) 25%, var(--bg-card-hover, #232d42) 50%, var(--bg-card, #1a2234) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                ...style,
            }}
            aria-hidden="true"
        />
    );
}

// Text skeleton
interface SkeletonTextProps {
    lines?: number;
    lineHeight?: string;
    lastLineWidth?: string;
}

export function SkeletonText({
    lines = 3,
    lineHeight = '16px',
    lastLineWidth = '60%',
}: SkeletonTextProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    height={lineHeight}
                    width={i === lines - 1 ? lastLineWidth : '100%'}
                />
            ))}
        </div>
    );
}

// Avatar skeleton
interface SkeletonAvatarProps {
    size?: number;
}

export function SkeletonAvatar({ size = 40 }: SkeletonAvatarProps) {
    return (
        <Skeleton
            width={size}
            height={size}
            borderRadius="50%"
        />
    );
}

// Card skeleton
export function SkeletonCard() {
    return (
        <div
            style={{
                padding: '16px',
                background: 'var(--bg-card, #1a2234)',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #374151)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <SkeletonAvatar />
                <div style={{ flex: 1 }}>
                    <Skeleton height="18px" width="60%" style={{ marginBottom: '8px' }} />
                    <Skeleton height="14px" width="40%" />
                </div>
            </div>
            <SkeletonText lines={2} />
        </div>
    );
}

// Agent card skeleton
export function SkeletonAgentCard() {
    return (
        <div
            style={{
                padding: '16px',
                background: 'var(--bg-card, #1a2234)',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #374151)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton width={48} height={48} borderRadius="50%" />
                <div style={{ flex: 1 }}>
                    <Skeleton height="16px" width="70%" style={{ marginBottom: '6px' }} />
                    <Skeleton height="12px" width="50%" />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <Skeleton height="24px" width="60px" borderRadius="12px" />
                <Skeleton height="24px" width="80px" borderRadius="12px" />
            </div>
            <Skeleton height="8px" width="100%" borderRadius="4px" />
        </div>
    );
}

// Blackboard entry skeleton
export function SkeletonEntry() {
    return (
        <div
            style={{
                padding: '12px',
                background: 'var(--bg-card, #1a2234)',
                borderRadius: '8px',
                borderLeft: '4px solid var(--bg-lighter, #374151)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Skeleton width={24} height={24} borderRadius="4px" />
                <div style={{ flex: 1 }}>
                    <Skeleton height="16px" width="80%" style={{ marginBottom: '8px' }} />
                    <Skeleton height="12px" width="50%" />
                </div>
            </div>
        </div>
    );
}

// Stats card skeleton
export function SkeletonStats() {
    return (
        <div
            style={{
                padding: '20px',
                background: 'var(--bg-card, #1a2234)',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #374151)',
            }}
        >
            <Skeleton height="12px" width="80px" style={{ marginBottom: '12px' }} />
            <Skeleton height="32px" width="60px" style={{ marginBottom: '8px' }} />
            <Skeleton height="10px" width="100%" borderRadius="4px" />
        </div>
    );
}

// Table skeleton
interface SkeletonTableProps {
    rows?: number;
    columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Header */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'var(--bg-secondary, #111827)',
                    borderRadius: '8px 8px 0 0',
                }}
            >
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} height="14px" width="80%" />
                ))}
            </div>

            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div
                    key={rowIndex}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        gap: '12px',
                        padding: '12px 16px',
                        background: 'var(--bg-card, #1a2234)',
                        borderRadius: rowIndex === rows - 1 ? '0 0 8px 8px' : 0,
                    }}
                >
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <Skeleton
                            key={colIndex}
                            height="16px"
                            width={colIndex === 0 ? '90%' : `${50 + Math.random() * 40}%`}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

// Grid skeleton for agent list, etc.
interface SkeletonGridProps {
    count?: number;
    columns?: number;
    CardComponent?: React.ComponentType;
}

export function SkeletonGrid({
    count = 6,
    columns = 3,
    CardComponent = SkeletonAgentCard,
}: SkeletonGridProps) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${100 / columns}%, 1fr))`,
                gap: '16px',
            }}
        >
            {Array.from({ length: count }).map((_, i) => (
                <CardComponent key={i} />
            ))}
        </div>
    );
}

// Add shimmer animation to global CSS
export const skeletonStyles = `
@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
`;
