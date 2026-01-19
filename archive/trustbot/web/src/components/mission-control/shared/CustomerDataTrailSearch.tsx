/**
 * CustomerDataTrailSearch Component
 *
 * Story 5.1: Customer Data Trail Search
 * FRs: FR26
 */

import { memo, useState, useCallback } from 'react';
import type { CustomerDataTrailEntry, CustomerDataTrailFilters } from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getOperationIcon(operation: CustomerDataTrailEntry['operation']): string {
    const icons = {
        read: '📖',
        write: '✏️',
        delete: '🗑️',
        export: '📤',
    };
    return icons[operation];
}

export function getOperationColor(operation: CustomerDataTrailEntry['operation']): string {
    const colors = {
        read: '#3b82f6',
        write: '#10b981',
        delete: '#ef4444',
        export: '#f59e0b',
    };
    return colors[operation];
}

export function formatDataCategory(category: string): string {
    return category
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SearchFormProps {
    onSearch: (filters: CustomerDataTrailFilters) => void;
    isSearching: boolean;
}

export const SearchForm = memo(function SearchForm({ onSearch, isSearching }: SearchFormProps) {
    const [customerId, setCustomerId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dataCategory, setDataCategory] = useState('');
    const [operation, setOperation] = useState<'' | 'read' | 'write' | 'delete' | 'export'>('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId.trim()) return;

        onSearch({
            customerId: customerId.trim(),
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            dataCategory: dataCategory || undefined,
            operation: operation || undefined,
        });
    };

    return (
        <form className="data-trail-search__form" onSubmit={handleSubmit}>
            <div className="data-trail-search__field">
                <label htmlFor="customerId">Customer ID *</label>
                <input
                    id="customerId"
                    type="text"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="e.g., CUST-001234"
                    required
                />
            </div>

            <div className="data-trail-search__row">
                <div className="data-trail-search__field">
                    <label htmlFor="startDate">Start Date</label>
                    <input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="data-trail-search__field">
                    <label htmlFor="endDate">End Date</label>
                    <input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
            </div>

            <div className="data-trail-search__row">
                <div className="data-trail-search__field">
                    <label htmlFor="dataCategory">Data Category</label>
                    <select
                        id="dataCategory"
                        value={dataCategory}
                        onChange={(e) => setDataCategory(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        <option value="personal_info">Personal Info</option>
                        <option value="financial_records">Financial Records</option>
                        <option value="transaction_history">Transaction History</option>
                        <option value="preferences">Preferences</option>
                        <option value="communications">Communications</option>
                    </select>
                </div>
                <div className="data-trail-search__field">
                    <label htmlFor="operation">Operation</label>
                    <select
                        id="operation"
                        value={operation}
                        onChange={(e) => setOperation(e.target.value as typeof operation)}
                    >
                        <option value="">All Operations</option>
                        <option value="read">Read</option>
                        <option value="write">Write</option>
                        <option value="delete">Delete</option>
                        <option value="export">Export</option>
                    </select>
                </div>
            </div>

            <button
                type="submit"
                className="data-trail-search__submit"
                disabled={isSearching || !customerId.trim()}
            >
                {isSearching ? 'Searching...' : 'Search'}
            </button>
        </form>
    );
});

interface TrailEntryCardProps {
    entry: CustomerDataTrailEntry;
    onViewChain?: (chainId: string) => void;
}

export const TrailEntryCard = memo(function TrailEntryCard({
    entry,
    onViewChain,
}: TrailEntryCardProps) {
    return (
        <article className="data-trail-entry" aria-label={`Data access: ${entry.operation}`}>
            <div className="data-trail-entry__header">
                <span
                    className="data-trail-entry__operation"
                    style={{ backgroundColor: getOperationColor(entry.operation) }}
                >
                    {getOperationIcon(entry.operation)} {entry.operation.toUpperCase()}
                </span>
                <span className="data-trail-entry__time">
                    {new Date(entry.timestamp).toLocaleString()}
                </span>
            </div>

            <div className="data-trail-entry__content">
                <div className="data-trail-entry__agent">
                    <span className="data-trail-entry__label">Agent:</span>
                    <span className="data-trail-entry__value">{entry.agentName}</span>
                </div>
                <div className="data-trail-entry__category">
                    <span className="data-trail-entry__label">Category:</span>
                    <span className="data-trail-entry__value">
                        {formatDataCategory(entry.dataCategory)}
                    </span>
                </div>
                <div className="data-trail-entry__records">
                    <span className="data-trail-entry__label">Records:</span>
                    <span className="data-trail-entry__value">{entry.recordCount}</span>
                </div>
            </div>

            <div className="data-trail-entry__footer">
                <span
                    className={`data-trail-entry__hash data-trail-entry__hash--${entry.hashStatus}`}
                >
                    {entry.hashStatus === 'verified' ? '🔒' : '⚠️'} {entry.hashStatus}
                </span>
                {onViewChain && (
                    <button
                        className="data-trail-entry__chain-btn"
                        onClick={() => onViewChain(entry.accountabilityChainId)}
                    >
                        View Chain
                    </button>
                )}
            </div>
        </article>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface CustomerDataTrailSearchProps {
    onSearch: (filters: CustomerDataTrailFilters) => Promise<void>;
    entries: CustomerDataTrailEntry[];
    isSearching?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    onViewChain?: (chainId: string) => void;
    onGenerateEvidence?: (customerId: string) => void;
    className?: string;
}

export const CustomerDataTrailSearch = memo(function CustomerDataTrailSearch({
    onSearch,
    entries,
    isSearching = false,
    hasMore = false,
    onLoadMore,
    onViewChain,
    onGenerateEvidence,
    className = '',
}: CustomerDataTrailSearchProps) {
    const [searchedCustomerId, setSearchedCustomerId] = useState<string | null>(null);

    const handleSearch = useCallback(
        async (filters: CustomerDataTrailFilters) => {
            setSearchedCustomerId(filters.customerId);
            await onSearch(filters);
        },
        [onSearch]
    );

    return (
        <section
            className={`data-trail-search ${className}`}
            aria-label="Customer data trail search"
        >
            <div className="data-trail-search__header">
                <h2 className="data-trail-search__title">Customer Data Trail Search</h2>
                <p className="data-trail-search__subtitle">
                    Search for all data access events related to a customer
                </p>
            </div>

            <SearchForm onSearch={handleSearch} isSearching={isSearching} />

            {entries.length > 0 && (
                <div className="data-trail-search__results">
                    <div className="data-trail-search__results-header">
                        <span className="data-trail-search__results-count">
                            {entries.length} entries found
                        </span>
                        {searchedCustomerId && onGenerateEvidence && (
                            <button
                                className="data-trail-search__evidence-btn"
                                onClick={() => onGenerateEvidence(searchedCustomerId)}
                            >
                                Generate Evidence Package
                            </button>
                        )}
                    </div>

                    <div className="data-trail-search__entries">
                        {entries.map((entry) => (
                            <TrailEntryCard
                                key={entry.id}
                                entry={entry}
                                onViewChain={onViewChain}
                            />
                        ))}
                    </div>

                    {hasMore && onLoadMore && (
                        <button
                            className="data-trail-search__load-more"
                            onClick={onLoadMore}
                            disabled={isSearching}
                        >
                            {isSearching ? 'Loading...' : 'Load More'}
                        </button>
                    )}
                </div>
            )}

            {!isSearching && searchedCustomerId && entries.length === 0 && (
                <div className="data-trail-search__empty">
                    <span className="data-trail-search__empty-icon">🔍</span>
                    <p>No data trail entries found for this customer</p>
                </div>
            )}
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.data-trail-search {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 24px;
    color: #e2e8f0;
}

.data-trail-search__header {
    margin-bottom: 20px;
}

.data-trail-search__title {
    margin: 0 0 4px;
    font-size: 1.25rem;
    font-weight: 600;
    color: #f8fafc;
}

.data-trail-search__subtitle {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
}

.data-trail-search__form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    margin-bottom: 20px;
}

.data-trail-search__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.data-trail-search__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.data-trail-search__field label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #94a3b8;
}

.data-trail-search__field input,
.data-trail-search__field select {
    padding: 10px 12px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 0.9375rem;
}

.data-trail-search__field input:focus,
.data-trail-search__field select:focus {
    outline: none;
    border-color: #3b82f6;
}

.data-trail-search__submit {
    padding: 12px 24px;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.data-trail-search__submit:hover:not(:disabled) {
    background: #2563eb;
}

.data-trail-search__submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.data-trail-search__results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.data-trail-search__results-count {
    font-size: 0.875rem;
    color: #64748b;
}

.data-trail-search__evidence-btn {
    padding: 8px 16px;
    background: #10b981;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.data-trail-search__evidence-btn:hover {
    background: #059669;
}

.data-trail-search__entries {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.data-trail-entry {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 16px;
}

.data-trail-entry__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.data-trail-entry__operation {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
}

.data-trail-entry__time {
    font-size: 0.8125rem;
    color: #64748b;
}

.data-trail-entry__content {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 12px;
}

.data-trail-entry__label {
    font-size: 0.75rem;
    color: #64748b;
    display: block;
}

.data-trail-entry__value {
    font-size: 0.875rem;
    color: #e2e8f0;
    font-weight: 500;
}

.data-trail-entry__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #334155;
}

.data-trail-entry__hash {
    font-size: 0.75rem;
    font-weight: 500;
}

.data-trail-entry__hash--verified {
    color: #10b981;
}

.data-trail-entry__hash--unverified {
    color: #f59e0b;
}

.data-trail-entry__hash--invalid {
    color: #ef4444;
}

.data-trail-entry__chain-btn {
    padding: 6px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background 0.2s;
}

.data-trail-entry__chain-btn:hover {
    background: #475569;
}

.data-trail-search__load-more {
    display: block;
    width: 100%;
    padding: 12px;
    margin-top: 16px;
    background: #334155;
    border: none;
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
}

.data-trail-search__load-more:hover:not(:disabled) {
    background: #475569;
}

.data-trail-search__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px;
    text-align: center;
}

.data-trail-search__empty-icon {
    font-size: 3rem;
    margin-bottom: 12px;
}

.data-trail-search__empty p {
    margin: 0;
    color: #64748b;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'customer-data-trail-search-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default CustomerDataTrailSearch;
