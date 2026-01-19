/**
 * CustomerDataTrailSearch Component Tests
 * Story 5.1
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
    CustomerDataTrailSearch,
    SearchForm,
    TrailEntryCard,
    getOperationIcon,
    getOperationColor,
    formatDataCategory,
} from './CustomerDataTrailSearch';
import type { CustomerDataTrailEntry } from '../../../types';

const mockEntry: CustomerDataTrailEntry = {
    id: 'trail-001',
    timestamp: new Date().toISOString(),
    actionType: 'task_completed',
    agentId: 'agent-001',
    agentName: 'DataProcessor',
    customerId: 'CUST-001234',
    dataCategory: 'personal_info',
    operation: 'read',
    recordCount: 42,
    hashStatus: 'verified',
    accountabilityChainId: 'chain-001',
};

const mockEntries: CustomerDataTrailEntry[] = [
    mockEntry,
    { ...mockEntry, id: 'trail-002', operation: 'write', dataCategory: 'financial_records' },
    { ...mockEntry, id: 'trail-003', operation: 'delete', dataCategory: 'preferences' },
];

describe('CustomerDataTrailSearch Helper Functions', () => {
    describe('getOperationIcon', () => {
        it('returns correct icon for each operation', () => {
            expect(getOperationIcon('read')).toBe('📖');
            expect(getOperationIcon('write')).toBe('✏️');
            expect(getOperationIcon('delete')).toBe('🗑️');
            expect(getOperationIcon('export')).toBe('📤');
        });
    });

    describe('getOperationColor', () => {
        it('returns correct color for each operation', () => {
            expect(getOperationColor('read')).toBe('#3b82f6');
            expect(getOperationColor('write')).toBe('#10b981');
            expect(getOperationColor('delete')).toBe('#ef4444');
            expect(getOperationColor('export')).toBe('#f59e0b');
        });
    });

    describe('formatDataCategory', () => {
        it('formats snake_case to Title Case', () => {
            expect(formatDataCategory('personal_info')).toBe('Personal Info');
            expect(formatDataCategory('financial_records')).toBe('Financial Records');
            expect(formatDataCategory('transaction_history')).toBe('Transaction History');
        });
    });
});

describe('SearchForm Component', () => {
    it('renders all form fields', () => {
        render(<SearchForm onSearch={() => {}} isSearching={false} />);

        expect(screen.getByLabelText(/Customer ID/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Data Category/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Operation/i)).toBeInTheDocument();
    });

    it('calls onSearch with filters when form submitted', async () => {
        const onSearch = vi.fn();
        render(<SearchForm onSearch={onSearch} isSearching={false} />);

        fireEvent.change(screen.getByLabelText(/Customer ID/i), {
            target: { value: 'CUST-001234' },
        });
        fireEvent.click(screen.getByText('Search'));

        expect(onSearch).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'CUST-001234',
            })
        );
    });

    it('disables submit button when searching', () => {
        render(<SearchForm onSearch={() => {}} isSearching={true} />);
        expect(screen.getByText('Searching...')).toBeDisabled();
    });

    it('disables submit button when customer ID is empty', () => {
        render(<SearchForm onSearch={() => {}} isSearching={false} />);
        expect(screen.getByText('Search')).toBeDisabled();
    });
});

describe('TrailEntryCard Component', () => {
    it('renders entry details', () => {
        render(<TrailEntryCard entry={mockEntry} />);

        expect(screen.getByText(/READ/)).toBeInTheDocument();
        expect(screen.getByText('DataProcessor')).toBeInTheDocument();
        expect(screen.getByText('Personal Info')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('shows verified hash status', () => {
        render(<TrailEntryCard entry={mockEntry} />);
        expect(screen.getByText(/verified/i)).toBeInTheDocument();
    });

    it('calls onViewChain when View Chain clicked', () => {
        const onViewChain = vi.fn();
        render(<TrailEntryCard entry={mockEntry} onViewChain={onViewChain} />);

        fireEvent.click(screen.getByText('View Chain'));
        expect(onViewChain).toHaveBeenCalledWith('chain-001');
    });

    it('hides View Chain button when no handler', () => {
        render(<TrailEntryCard entry={mockEntry} />);
        expect(screen.queryByText('View Chain')).not.toBeInTheDocument();
    });
});

describe('CustomerDataTrailSearch Component', () => {
    it('renders search form and title', () => {
        render(<CustomerDataTrailSearch onSearch={async () => {}} entries={[]} />);

        expect(screen.getByText('Customer Data Trail Search')).toBeInTheDocument();
        expect(screen.getByLabelText(/Customer ID/i)).toBeInTheDocument();
    });

    it('renders entries when provided', () => {
        render(<CustomerDataTrailSearch onSearch={async () => {}} entries={mockEntries} />);

        expect(screen.getByText('3 entries found')).toBeInTheDocument();
    });

    it('shows empty state after search with no results', async () => {
        const onSearch = vi.fn().mockResolvedValue(undefined);
        render(<CustomerDataTrailSearch onSearch={onSearch} entries={[]} />);

        // Enter customer ID and search
        fireEvent.change(screen.getByLabelText(/Customer ID/i), {
            target: { value: 'CUST-NONE' },
        });
        fireEvent.click(screen.getByText('Search'));

        await waitFor(() => {
            expect(screen.getByText(/No data trail entries found/i)).toBeInTheDocument();
        });
    });

    it('shows Generate Evidence Package button when entries exist', () => {
        const onGenerateEvidence = vi.fn();
        render(
            <CustomerDataTrailSearch
                onSearch={async () => {}}
                entries={mockEntries}
                onGenerateEvidence={onGenerateEvidence}
            />
        );

        // Need to trigger a search first to set the customer ID
        fireEvent.change(screen.getByLabelText(/Customer ID/i), {
            target: { value: 'CUST-001234' },
        });
        fireEvent.click(screen.getByText('Search'));

        // Then check for button
        expect(screen.getByText('Generate Evidence Package')).toBeInTheDocument();
    });

    it('shows Load More button when hasMore is true', () => {
        const onLoadMore = vi.fn();
        render(
            <CustomerDataTrailSearch
                onSearch={async () => {}}
                entries={mockEntries}
                hasMore={true}
                onLoadMore={onLoadMore}
            />
        );

        expect(screen.getByText('Load More')).toBeInTheDocument();
    });

    it('calls onLoadMore when Load More clicked', () => {
        const onLoadMore = vi.fn();
        render(
            <CustomerDataTrailSearch
                onSearch={async () => {}}
                entries={mockEntries}
                hasMore={true}
                onLoadMore={onLoadMore}
            />
        );

        fireEvent.click(screen.getByText('Load More'));
        expect(onLoadMore).toHaveBeenCalled();
    });

    it('applies custom className', () => {
        const { container } = render(
            <CustomerDataTrailSearch
                onSearch={async () => {}}
                entries={[]}
                className="custom-class"
            />
        );
        expect(container.firstChild).toHaveClass('custom-class');
    });
});
