/**
 * EvidencePackageCard Component Tests
 * Story 5.2
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    EvidencePackageCard,
    EvidencePackageList,
    HashIntegrityBadge,
    PackageRequestForm,
    getStatusColor,
    getStatusIcon,
    getFormatIcon,
} from './EvidencePackageCard';
import type { EvidencePackage, HashIntegrityReport } from '../../../types';

const mockHashReport: HashIntegrityReport = {
    totalEntries: 47,
    verifiedCount: 45,
    unverifiedCount: 2,
    invalidCount: 0,
    chainIntact: true,
    firstEntryHash: 'a1b2c3d4',
    lastEntryHash: 'z9y8x7w6',
    verificationTimestamp: new Date().toISOString(),
};

const mockPackage: EvidencePackage = {
    id: 'pkg-001',
    orgId: 'org-123',
    customerId: 'CUST-001234',
    status: 'ready',
    format: 'pdf',
    requestedAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
    downloadUrl: '/api/download/pkg-001',
    requestedBy: 'user-001',
    reason: 'Regulatory inquiry',
    period: {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
    },
    summary: {
        totalActions: 47,
        agentsInvolved: 5,
        dataCategories: ['personal_info', 'financial_records'],
        hitlDecisions: 12,
    },
    hashIntegrity: mockHashReport,
};

const mockGeneratingPackage: EvidencePackage = {
    ...mockPackage,
    id: 'pkg-002',
    status: 'generating',
    generatedAt: undefined,
    downloadUrl: undefined,
};

const mockFailedPackage: EvidencePackage = {
    ...mockPackage,
    id: 'pkg-003',
    status: 'failed',
    error: 'Failed to generate package due to timeout',
};

describe('EvidencePackageCard Helper Functions', () => {
    describe('getStatusColor', () => {
        it('returns correct color for each status', () => {
            expect(getStatusColor('generating')).toBe('#3b82f6');
            expect(getStatusColor('ready')).toBe('#10b981');
            expect(getStatusColor('expired')).toBe('#6b7280');
            expect(getStatusColor('failed')).toBe('#ef4444');
        });
    });

    describe('getStatusIcon', () => {
        it('returns correct icon for each status', () => {
            expect(getStatusIcon('generating')).toBe('⏳');
            expect(getStatusIcon('ready')).toBe('✅');
            expect(getStatusIcon('expired')).toBe('⏰');
            expect(getStatusIcon('failed')).toBe('❌');
        });
    });

    describe('getFormatIcon', () => {
        it('returns correct icon for each format', () => {
            expect(getFormatIcon('pdf')).toBe('📄');
            expect(getFormatIcon('json')).toBe('📋');
            expect(getFormatIcon('csv')).toBe('📊');
        });
    });
});

describe('HashIntegrityBadge Component', () => {
    it('renders verification stats', () => {
        render(<HashIntegrityBadge report={mockHashReport} />);

        expect(screen.getByText('Hash Integrity')).toBeInTheDocument();
        expect(screen.getByText(/45\/47 verified/)).toBeInTheDocument();
    });

    it('shows chain intact status', () => {
        render(<HashIntegrityBadge report={mockHashReport} />);
        expect(screen.getByText(/Chain: Intact/)).toBeInTheDocument();
    });

    it('shows warning when chain is broken', () => {
        const brokenReport = { ...mockHashReport, chainIntact: false };
        render(<HashIntegrityBadge report={brokenReport} />);
        expect(screen.getByText(/Chain: Broken/)).toBeInTheDocument();
    });

    it('shows invalid count when present', () => {
        const reportWithInvalid = { ...mockHashReport, invalidCount: 3 };
        render(<HashIntegrityBadge report={reportWithInvalid} />);
        expect(screen.getByText(/3 invalid/)).toBeInTheDocument();
    });
});

describe('PackageRequestForm Component', () => {
    it('renders all form fields', () => {
        render(<PackageRequestForm onSubmit={() => {}} />);

        expect(screen.getByLabelText(/Customer ID/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Format/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Reason/i)).toBeInTheDocument();
    });

    it('pre-fills customer ID when provided', () => {
        render(<PackageRequestForm onSubmit={() => {}} customerId="CUST-001234" />);

        expect(screen.getByLabelText(/Customer ID/i)).toHaveValue('CUST-001234');
    });

    it('calls onSubmit with form data', () => {
        const onSubmit = vi.fn();
        render(<PackageRequestForm onSubmit={onSubmit} />);

        fireEvent.change(screen.getByLabelText(/Customer ID/i), {
            target: { value: 'CUST-001234' },
        });
        fireEvent.change(screen.getByLabelText(/Start Date/i), {
            target: { value: '2024-01-01' },
        });
        fireEvent.change(screen.getByLabelText(/End Date/i), {
            target: { value: '2024-03-31' },
        });
        fireEvent.change(screen.getByLabelText(/Reason/i), {
            target: { value: 'Test reason' },
        });
        fireEvent.click(screen.getByText('Request Package'));

        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'CUST-001234',
                startDate: '2024-01-01',
                endDate: '2024-03-31',
                reason: 'Test reason',
                format: 'pdf',
            })
        );
    });

    it('disables submit when required fields are empty', () => {
        render(<PackageRequestForm onSubmit={() => {}} />);
        expect(screen.getByText('Request Package')).toBeDisabled();
    });

    it('shows Requesting text when submitting', () => {
        render(<PackageRequestForm onSubmit={() => {}} isSubmitting={true} />);
        expect(screen.getByText('Requesting...')).toBeInTheDocument();
    });
});

describe('EvidencePackageCard Component', () => {
    it('renders ready package with all details', () => {
        render(<EvidencePackageCard package={mockPackage} />);

        expect(screen.getByText(/READY/)).toBeInTheDocument();
        expect(screen.getByText(/PDF/)).toBeInTheDocument();
        expect(screen.getByText('CUST-001234')).toBeInTheDocument();
        expect(screen.getByText('Regulatory inquiry')).toBeInTheDocument();
    });

    it('renders summary stats for ready package', () => {
        render(<EvidencePackageCard package={mockPackage} />);

        expect(screen.getByText('47')).toBeInTheDocument(); // totalActions
        expect(screen.getByText('5')).toBeInTheDocument(); // agentsInvolved
        expect(screen.getByText('12')).toBeInTheDocument(); // hitlDecisions
    });

    it('shows download button for ready package', () => {
        const onDownload = vi.fn();
        render(<EvidencePackageCard package={mockPackage} onDownload={onDownload} />);

        expect(screen.getByText('Download')).toBeInTheDocument();
    });

    it('calls onDownload when download clicked', () => {
        const onDownload = vi.fn();
        render(<EvidencePackageCard package={mockPackage} onDownload={onDownload} />);

        fireEvent.click(screen.getByText('Download'));
        expect(onDownload).toHaveBeenCalledWith('pkg-001');
    });

    it('shows generating state with spinner', () => {
        render(<EvidencePackageCard package={mockGeneratingPackage} />);

        expect(screen.getByText(/GENERATING/)).toBeInTheDocument();
        expect(screen.getByText('Generating package...')).toBeInTheDocument();
    });

    it('shows Check Status button for generating package', () => {
        const onRefresh = vi.fn();
        render(<EvidencePackageCard package={mockGeneratingPackage} onRefresh={onRefresh} />);

        expect(screen.getByText('Check Status')).toBeInTheDocument();
    });

    it('shows error for failed package', () => {
        render(<EvidencePackageCard package={mockFailedPackage} />);

        expect(screen.getByText(/FAILED/)).toBeInTheDocument();
        expect(screen.getByText(/Failed to generate package/)).toBeInTheDocument();
    });

    it('hides download button for non-ready packages', () => {
        render(<EvidencePackageCard package={mockGeneratingPackage} onDownload={() => {}} />);
        expect(screen.queryByText('Download')).not.toBeInTheDocument();
    });

    it('shows Downloading text when downloading', () => {
        render(
            <EvidencePackageCard package={mockPackage} onDownload={() => {}} isDownloading={true} />
        );
        expect(screen.getByText('Downloading...')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(
            <EvidencePackageCard package={mockPackage} className="custom-class" />
        );
        expect(container.firstChild).toHaveClass('custom-class');
    });
});

describe('EvidencePackageList Component', () => {
    const mockPackages = [mockPackage, mockGeneratingPackage, mockFailedPackage];

    it('renders list title', () => {
        render(<EvidencePackageList packages={mockPackages} />);
        expect(screen.getByText('Evidence Packages')).toBeInTheDocument();
    });

    it('renders all packages', () => {
        render(<EvidencePackageList packages={mockPackages} />);

        // All packages have the same customer, so use getAllByText for customer
        expect(screen.getAllByText('CUST-001234')).toHaveLength(3);
        // Check unique identifiers for each package type
        expect(screen.getByText(/pkg-001/)).toBeInTheDocument();
        expect(screen.getByText(/pkg-002/)).toBeInTheDocument();
        expect(screen.getByText(/pkg-003/)).toBeInTheDocument();
    });

    it('shows empty state when no packages', () => {
        render(<EvidencePackageList packages={[]} />);
        expect(screen.getByText(/No evidence packages generated yet/)).toBeInTheDocument();
    });

    it('passes downloadingId to correct package', () => {
        render(
            <EvidencePackageList
                packages={[mockPackage]}
                onDownload={() => {}}
                downloadingId="pkg-001"
            />
        );
        expect(screen.getByText('Downloading...')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(
            <EvidencePackageList packages={mockPackages} className="custom-class" />
        );
        expect(container.firstChild).toHaveClass('custom-class');
    });
});
