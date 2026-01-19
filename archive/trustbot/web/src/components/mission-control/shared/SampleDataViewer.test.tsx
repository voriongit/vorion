/**
 * SampleDataViewer Component Tests
 *
 * Story 2.6: Sample Data Viewing
 * FRs: FR18
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    SampleDataViewer,
    getMaskTypeIcon,
    getMaskTypeColor,
    isMaskedValue,
    formatColumnHeader,
} from './SampleDataViewer';
import type { SampleDataResponse } from './SampleDataViewer';

// ============================================================================
// Test Data
// ============================================================================

const mockSampleData: SampleDataResponse = {
    decisionId: 'ar-001',
    actionType: 'data_export',
    sampleData: [
        {
            id: 'REC-001',
            customer_name: 'J*** D**',
            email: 'j***@***.com',
            phone: '***-***-4567',
            amount: 1250.0,
            status: 'active',
        },
        {
            id: 'REC-002',
            customer_name: 'J*** S****',
            email: 'j***@***.org',
            phone: '***-***-6543',
            amount: 3400.5,
            status: 'pending',
        },
    ],
    maskedFields: [
        { field: 'customer_name', type: 'name', reason: 'PII - Personal Name' },
        { field: 'email', type: 'email', reason: 'PII - Contact Information' },
        { field: 'phone', type: 'phone', reason: 'PII - Contact Information' },
    ],
    totalRecords: 15000,
    sampleSize: 2,
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getMaskTypeIcon', () => {
    it('returns @ for email type', () => {
        expect(getMaskTypeIcon('email')).toBe('@');
    });

    it('returns N for name type', () => {
        expect(getMaskTypeIcon('name')).toBe('N');
    });

    it('returns # for phone type', () => {
        expect(getMaskTypeIcon('phone')).toBe('#');
    });

    it('returns S for ssn type', () => {
        expect(getMaskTypeIcon('ssn')).toBe('S');
    });

    it('returns * for unknown type', () => {
        expect(getMaskTypeIcon('unknown')).toBe('*');
    });
});

describe('getMaskTypeColor', () => {
    it('returns blue for email', () => {
        expect(getMaskTypeColor('email')).toContain('3b82f6');
    });

    it('returns purple for name', () => {
        expect(getMaskTypeColor('name')).toContain('8b5cf6');
    });

    it('returns red for ssn', () => {
        expect(getMaskTypeColor('ssn')).toContain('ef4444');
    });

    it('returns gray for unknown type', () => {
        expect(getMaskTypeColor('unknown')).toContain('6b7280');
    });
});

describe('isMaskedValue', () => {
    it('returns true for values containing asterisks', () => {
        expect(isMaskedValue('j***@***.com')).toBe(true);
        expect(isMaskedValue('***-***-4567')).toBe(true);
    });

    it('returns false for unmasked values', () => {
        expect(isMaskedValue('active')).toBe(false);
        expect(isMaskedValue(1250.0)).toBe(false);
    });

    it('returns false for non-string values', () => {
        expect(isMaskedValue(123)).toBe(false);
        expect(isMaskedValue(null)).toBe(false);
        expect(isMaskedValue(undefined)).toBe(false);
    });
});

describe('formatColumnHeader', () => {
    it('converts snake_case to Title Case', () => {
        expect(formatColumnHeader('customer_name')).toBe('Customer Name');
    });

    it('converts camelCase to Title Case', () => {
        expect(formatColumnHeader('customerName')).toBe('Customer Name');
    });

    it('handles single words', () => {
        expect(formatColumnHeader('status')).toBe('Status');
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('SampleDataViewer', () => {
    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders with sample data', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText('Sample Data')).toBeInTheDocument();
        });

        it('displays record count', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText(/Showing 2 of 15,000 records/)).toBeInTheDocument();
        });

        it('displays action type', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText(/Action: data export/)).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <SampleDataViewer data={mockSampleData} className="custom-class" />
            );

            expect(container.querySelector('.sample-data-viewer')).toHaveClass('custom-class');
        });
    });

    // ========================================================================
    // Data Table
    // ========================================================================

    describe('Data Table', () => {
        it('displays table headers', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText('Id')).toBeInTheDocument();
            // These headers may appear in both table and legend
            expect(screen.getAllByText('Customer Name').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('Status')).toBeInTheDocument();
        });

        it('displays sample data rows', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText('REC-001')).toBeInTheDocument();
            expect(screen.getByText('REC-002')).toBeInTheDocument();
        });

        it('displays masked values', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText('j***@***.com')).toBeInTheDocument();
            expect(screen.getByText('***-***-4567')).toBeInTheDocument();
        });

        it('displays unmasked values normally', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText('active')).toBeInTheDocument();
            expect(screen.getByText('1250')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Mask Legend
    // ========================================================================

    describe('Mask Legend', () => {
        it('displays masked fields legend', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText('Masked Fields:')).toBeInTheDocument();
        });

        it('shows field names in legend', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            // Field names appear in both legend and table headers
            expect(screen.getAllByText('Customer Name').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('Phone').length).toBeGreaterThanOrEqual(1);
        });

        it('shows masking reasons', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByText('PII - Personal Name')).toBeInTheDocument();
            expect(screen.getAllByText('PII - Contact Information')).toHaveLength(2);
        });

        it('has accessible legend label', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByLabelText('Masking legend')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Mask Indicators in Headers
    // ========================================================================

    describe('Mask Indicators', () => {
        it('shows mask indicator on masked column headers', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            // Check for mask indicators by their accessible labels
            expect(screen.getByLabelText('Masked: PII - Personal Name')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Expand/Collapse
    // ========================================================================

    describe('Expand/Collapse', () => {
        it('starts expanded by default', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByRole('table')).toBeInTheDocument();
        });

        it('collapses when toggle clicked', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            const toggle = screen.getByLabelText('Collapse sample data');
            fireEvent.click(toggle);

            expect(screen.queryByRole('table')).not.toBeInTheDocument();
        });

        it('expands when toggle clicked again', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            const toggle = screen.getByLabelText('Collapse sample data');
            fireEvent.click(toggle);
            fireEvent.click(screen.getByLabelText('Expand sample data'));

            expect(screen.getByRole('table')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Close Button
    // ========================================================================

    describe('Close Button', () => {
        it('shows close button when onClose provided', () => {
            const handleClose = vi.fn();
            render(<SampleDataViewer data={mockSampleData} onClose={handleClose} />);

            expect(screen.getByLabelText('Close sample data viewer')).toBeInTheDocument();
        });

        it('calls onClose when close button clicked', () => {
            const handleClose = vi.fn();
            render(<SampleDataViewer data={mockSampleData} onClose={handleClose} />);

            fireEvent.click(screen.getByLabelText('Close sample data viewer'));

            expect(handleClose).toHaveBeenCalled();
        });

        it('hides close button when onClose not provided', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.queryByLabelText('Close sample data viewer')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Loading State
    // ========================================================================

    describe('Loading State', () => {
        it('shows loading state when isLoading is true', () => {
            render(<SampleDataViewer data={mockSampleData} isLoading={true} />);

            const loading = screen.getByLabelText('Loading sample data');
            expect(loading).toBeInTheDocument();
            expect(loading).toHaveAttribute('aria-busy', 'true');
        });

        it('hides content when loading', () => {
            render(<SampleDataViewer data={mockSampleData} isLoading={true} />);

            expect(screen.queryByRole('table')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Error State
    // ========================================================================

    describe('Error State', () => {
        it('shows error message when error prop is set', () => {
            render(
                <SampleDataViewer
                    data={mockSampleData}
                    error="Failed to load sample data"
                />
            );

            const alert = screen.getByRole('alert');
            expect(alert).toBeInTheDocument();
            expect(alert).toHaveTextContent('Failed to load sample data');
        });

        it('hides content when error', () => {
            render(<SampleDataViewer data={mockSampleData} error="Error" />);

            expect(screen.queryByRole('table')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Empty State
    // ========================================================================

    describe('Empty State', () => {
        it('shows empty message when no sample data', () => {
            const emptyData: SampleDataResponse = {
                ...mockSampleData,
                sampleData: [],
                sampleSize: 0,
            };

            render(<SampleDataViewer data={emptyData} />);

            expect(screen.getByText('No sample data available')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility
    // ========================================================================

    describe('Accessibility', () => {
        it('table has role="table"', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            expect(screen.getByRole('table')).toBeInTheDocument();
        });

        it('toggle button has aria-expanded', () => {
            render(<SampleDataViewer data={mockSampleData} />);

            const toggle = screen.getByLabelText('Collapse sample data');
            expect(toggle).toHaveAttribute('aria-expanded', 'true');
        });

        it('loading state has aria-busy', () => {
            render(<SampleDataViewer data={mockSampleData} isLoading={true} />);

            expect(screen.getByLabelText('Loading sample data')).toHaveAttribute(
                'aria-busy',
                'true'
            );
        });

        it('error state has role alert', () => {
            render(<SampleDataViewer data={mockSampleData} error="Error" />);

            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});
