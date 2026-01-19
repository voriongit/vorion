/**
 * Sample Data Viewer Component
 *
 * Displays masked sample data from pending action requests.
 * Shows data with PII masking and field type indicators.
 *
 * Story 2.6: Sample Data Viewing
 * FRs: FR18
 */

import { memo, useMemo, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface MaskedField {
    field: string;
    type: string;
    reason: string;
}

export interface SampleDataResponse {
    decisionId: string;
    actionType: string;
    sampleData: Record<string, unknown>[];
    maskedFields: MaskedField[];
    totalRecords: number;
    sampleSize: number;
}

export interface SampleDataViewerProps {
    data: SampleDataResponse;
    isLoading?: boolean;
    error?: string | null;
    onClose?: () => void;
    className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon for masked field type
 */
export function getMaskTypeIcon(type: string): string {
    const icons: Record<string, string> = {
        email: '@',
        name: 'N',
        phone: '#',
        ssn: 'S',
        hostname: 'H',
        mixed: '*',
    };
    return icons[type] || '*';
}

/**
 * Get color for masked field type
 */
export function getMaskTypeColor(type: string): string {
    const colors: Record<string, string> = {
        email: '#3b82f6', // blue
        name: '#8b5cf6', // purple
        phone: '#10b981', // green
        ssn: '#ef4444', // red
        hostname: '#f59e0b', // amber
        mixed: '#6b7280', // gray
    };
    return colors[type] || '#6b7280';
}

/**
 * Check if a value appears masked (contains asterisks)
 */
export function isMaskedValue(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return value.includes('*');
}

/**
 * Format column header from field name
 */
export function formatColumnHeader(field: string): string {
    return field
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// ============================================================================
// Sub-Components
// ============================================================================

interface MaskLegendProps {
    maskedFields: MaskedField[];
}

const MaskLegend = memo(function MaskLegend({ maskedFields }: MaskLegendProps) {
    if (maskedFields.length === 0) return null;

    return (
        <div className="sample-data-viewer__legend" aria-label="Masking legend">
            <span className="sample-data-viewer__legend-title">Masked Fields:</span>
            <ul className="sample-data-viewer__legend-list">
                {maskedFields.map((field) => (
                    <li key={field.field} className="sample-data-viewer__legend-item">
                        <span
                            className="sample-data-viewer__legend-icon"
                            style={{ backgroundColor: getMaskTypeColor(field.type) }}
                            aria-hidden="true"
                        >
                            {getMaskTypeIcon(field.type)}
                        </span>
                        <span className="sample-data-viewer__legend-field">
                            {formatColumnHeader(field.field)}
                        </span>
                        <span className="sample-data-viewer__legend-reason">{field.reason}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
});

interface DataTableProps {
    data: Record<string, unknown>[];
    maskedFields: MaskedField[];
}

const DataTable = memo(function DataTable({ data, maskedFields }: DataTableProps) {
    if (data.length === 0) {
        return (
            <div className="sample-data-viewer__empty">
                No sample data available
            </div>
        );
    }

    // Get all unique columns from the data
    const columns = useMemo(() => {
        const allKeys = new Set<string>();
        for (const row of data) {
            for (const key of Object.keys(row)) {
                allKeys.add(key);
            }
        }
        return Array.from(allKeys);
    }, [data]);

    // Create a lookup for masked field types
    const maskedFieldMap = useMemo(() => {
        const map = new Map<string, MaskedField>();
        for (const field of maskedFields) {
            map.set(field.field, field);
        }
        return map;
    }, [maskedFields]);

    return (
        <div className="sample-data-viewer__table-wrapper">
            <table className="sample-data-viewer__table" role="table">
                <thead>
                    <tr>
                        {columns.map((col) => {
                            const maskedField = maskedFieldMap.get(col);
                            return (
                                <th key={col} scope="col">
                                    <div className="sample-data-viewer__header-cell">
                                        {maskedField && (
                                            <span
                                                className="sample-data-viewer__mask-indicator"
                                                style={{ backgroundColor: getMaskTypeColor(maskedField.type) }}
                                                title={maskedField.reason}
                                                aria-label={`Masked: ${maskedField.reason}`}
                                            >
                                                {getMaskTypeIcon(maskedField.type)}
                                            </span>
                                        )}
                                        <span>{formatColumnHeader(col)}</span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                            {columns.map((col) => {
                                const value = row[col];
                                const isMasked = isMaskedValue(value);
                                const displayValue = value === null || value === undefined
                                    ? '-'
                                    : String(value);

                                return (
                                    <td
                                        key={col}
                                        className={isMasked ? 'sample-data-viewer__cell--masked' : ''}
                                    >
                                        {displayValue}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export const SampleDataViewer = memo(function SampleDataViewer({
    data,
    isLoading = false,
    error = null,
    onClose,
    className = '',
}: SampleDataViewerProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (isLoading) {
        return (
            <div
                className={`sample-data-viewer sample-data-viewer--loading ${className}`}
                aria-busy="true"
                aria-label="Loading sample data"
            >
                <div className="sample-data-viewer__skeleton" />
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`sample-data-viewer sample-data-viewer--error ${className}`}
                role="alert"
            >
                <span className="sample-data-viewer__error-icon" aria-hidden="true">!</span>
                <span className="sample-data-viewer__error-text">{error}</span>
            </div>
        );
    }

    return (
        <div className={`sample-data-viewer ${className}`}>
            {/* Header */}
            <div className="sample-data-viewer__header">
                <div className="sample-data-viewer__title-row">
                    <button
                        type="button"
                        className="sample-data-viewer__toggle"
                        onClick={() => setIsExpanded(!isExpanded)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse sample data' : 'Expand sample data'}
                    >
                        <span className="sample-data-viewer__toggle-icon" aria-hidden="true">
                            {isExpanded ? '−' : '+'}
                        </span>
                        <span className="sample-data-viewer__title">Sample Data</span>
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            className="sample-data-viewer__close"
                            onClick={onClose}
                            aria-label="Close sample data viewer"
                        >
                            ×
                        </button>
                    )}
                </div>
                <div className="sample-data-viewer__meta">
                    <span className="sample-data-viewer__meta-item">
                        Showing {data.sampleSize} of {data.totalRecords.toLocaleString()} records
                    </span>
                    <span className="sample-data-viewer__meta-item">
                        Action: {data.actionType.replace(/_/g, ' ')}
                    </span>
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="sample-data-viewer__content">
                    <MaskLegend maskedFields={data.maskedFields} />
                    <DataTable data={data.sampleData} maskedFields={data.maskedFields} />
                </div>
            )}
        </div>
    );
});

// ============================================================================
// Styles
// ============================================================================

export const sampleDataViewerStyles = `
.sample-data-viewer {
    display: flex;
    flex-direction: column;
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-border, #333);
    border-radius: 8px;
    overflow: hidden;
    font-size: 13px;
}

.sample-data-viewer--loading {
    min-height: 200px;
    padding: 16px;
}

.sample-data-viewer__skeleton {
    width: 100%;
    height: 150px;
    background: linear-gradient(90deg, #1a1a2e 25%, #252545 50%, #1a1a2e 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.sample-data-viewer--error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
}

.sample-data-viewer__error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    font-weight: bold;
}

.sample-data-viewer__header {
    padding: 12px 16px;
    background: var(--color-surface-alt, #151525);
    border-bottom: 1px solid var(--color-border, #333);
}

.sample-data-viewer__title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.sample-data-viewer__toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: var(--color-text, #fff);
    cursor: pointer;
    padding: 0;
    font-size: 14px;
}

.sample-data-viewer__toggle:hover {
    color: var(--color-primary, #6366f1);
}

.sample-data-viewer__toggle-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface, #1a1a2e);
    border-radius: 4px;
    font-weight: bold;
}

.sample-data-viewer__title {
    font-weight: 600;
}

.sample-data-viewer__close {
    background: none;
    border: none;
    color: var(--color-muted, #6b7280);
    cursor: pointer;
    font-size: 20px;
    padding: 4px 8px;
    line-height: 1;
}

.sample-data-viewer__close:hover {
    color: var(--color-text, #fff);
}

.sample-data-viewer__meta {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    color: var(--color-muted, #6b7280);
    font-size: 12px;
}

.sample-data-viewer__content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.sample-data-viewer__legend {
    padding: 12px;
    background: var(--color-surface-alt, #151525);
    border-radius: 6px;
}

.sample-data-viewer__legend-title {
    font-weight: 600;
    color: var(--color-text, #fff);
    margin-bottom: 8px;
    display: block;
}

.sample-data-viewer__legend-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.sample-data-viewer__legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
}

.sample-data-viewer__legend-icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: white;
    font-size: 10px;
    font-weight: bold;
}

.sample-data-viewer__legend-field {
    color: var(--color-text, #fff);
    font-weight: 500;
}

.sample-data-viewer__legend-reason {
    color: var(--color-muted, #6b7280);
}

.sample-data-viewer__table-wrapper {
    overflow-x: auto;
}

.sample-data-viewer__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.sample-data-viewer__table th,
.sample-data-viewer__table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #333);
}

.sample-data-viewer__table th {
    background: var(--color-surface-alt, #151525);
    color: var(--color-text, #fff);
    font-weight: 600;
    white-space: nowrap;
}

.sample-data-viewer__header-cell {
    display: flex;
    align-items: center;
    gap: 6px;
}

.sample-data-viewer__mask-indicator {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    color: white;
    font-size: 9px;
    font-weight: bold;
    flex-shrink: 0;
}

.sample-data-viewer__table td {
    color: var(--color-text, #fff);
}

.sample-data-viewer__cell--masked {
    font-family: monospace;
    color: var(--color-muted, #6b7280);
}

.sample-data-viewer__empty {
    padding: 32px;
    text-align: center;
    color: var(--color-muted, #6b7280);
}
`;

export default SampleDataViewer;
