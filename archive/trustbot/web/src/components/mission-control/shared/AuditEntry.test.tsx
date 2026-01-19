/**
 * AuditEntry Component Tests
 * Story 4.1, 4.2, 4.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    AuditEntry,
    HashBadge,
    TamperProofIndicator,
    getActionTypeLabel,
    getActionTypeIcon,
    getOutcomeColor,
    getHashStatusColor,
    getHashStatusIcon,
    formatTimestamp,
    formatRelativeTime,
} from './AuditEntry';
import type { AuditEntry as AuditEntryType } from '../../../types';

const mockEntry: AuditEntryType = {
    id: 'audit-001',
    orgId: 'org-123',
    timestamp: new Date().toISOString(),
    agentId: 'agent-001',
    agentName: 'DataProcessor',
    actionType: 'decision_approved',
    actionDetails: 'Approved data processing request for customer records',
    outcome: 'success',
    hashStatus: 'verified',
    currentHash: 'abc123def456',
    previousHash: '789ghi012jkl',
    hashAlgorithm: 'sha256',
    actingAgentId: 'agent-001',
    supervisingAgentId: 'agent-002',
    hitlReviewerId: 'user-001',
    governanceOwnerId: 'user-admin',
};

describe('AuditEntry Helper Functions', () => {
    describe('getActionTypeLabel', () => {
        it('returns correct label for each action type', () => {
            expect(getActionTypeLabel('decision_approved')).toBe('Decision Approved');
            expect(getActionTypeLabel('decision_denied')).toBe('Decision Denied');
            expect(getActionTypeLabel('task_started')).toBe('Task Started');
            expect(getActionTypeLabel('task_completed')).toBe('Task Completed');
            expect(getActionTypeLabel('task_failed')).toBe('Task Failed');
            expect(getActionTypeLabel('agent_spawned')).toBe('Agent Spawned');
            expect(getActionTypeLabel('agent_terminated')).toBe('Agent Terminated');
            expect(getActionTypeLabel('trust_changed')).toBe('Trust Changed');
            expect(getActionTypeLabel('override_applied')).toBe('Override Applied');
            expect(getActionTypeLabel('investigation_started')).toBe('Investigation Started');
        });
    });

    describe('getActionTypeIcon', () => {
        it('returns icons for all action types', () => {
            expect(getActionTypeIcon('decision_approved')).toBe('✅');
            expect(getActionTypeIcon('task_failed')).toBe('⚠️');
            expect(getActionTypeIcon('agent_spawned')).toBe('🤖');
        });
    });

    describe('getOutcomeColor', () => {
        it('returns correct colors for outcomes', () => {
            expect(getOutcomeColor('success')).toBe('#10b981');
            expect(getOutcomeColor('failure')).toBe('#ef4444');
            expect(getOutcomeColor('pending')).toBe('#f59e0b');
            expect(getOutcomeColor('cancelled')).toBe('#6b7280');
        });
    });

    describe('getHashStatusColor', () => {
        it('returns correct colors for hash statuses', () => {
            expect(getHashStatusColor('verified')).toBe('#10b981');
            expect(getHashStatusColor('unverified')).toBe('#6b7280');
            expect(getHashStatusColor('invalid')).toBe('#ef4444');
            expect(getHashStatusColor('checking')).toBe('#3b82f6');
        });
    });

    describe('getHashStatusIcon', () => {
        it('returns icons for hash statuses', () => {
            expect(getHashStatusIcon('verified')).toBe('🔒✓');
            expect(getHashStatusIcon('invalid')).toBe('🔓⚠');
        });
    });

    describe('formatTimestamp', () => {
        it('formats timestamp correctly', () => {
            const timestamp = '2024-01-15T10:30:00Z';
            const formatted = formatTimestamp(timestamp);
            expect(formatted).toContain('2024');
        });
    });

    describe('formatRelativeTime', () => {
        it('returns "Just now" for recent timestamps', () => {
            const now = new Date().toISOString();
            expect(formatRelativeTime(now)).toBe('Just now');
        });

        it('returns minutes ago for timestamps within the hour', () => {
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();
            expect(formatRelativeTime(thirtyMinsAgo)).toBe('30m ago');
        });
    });
});

describe('HashBadge Component', () => {
    it('renders hash status correctly', () => {
        render(<HashBadge status="verified" />);
        expect(screen.getByText('verified')).toBeInTheDocument();
    });

    it('calls onVerify when clicked', () => {
        const onVerify = vi.fn();
        render(<HashBadge status="unverified" onVerify={onVerify} />);
        fireEvent.click(screen.getByRole('button'));
        expect(onVerify).toHaveBeenCalled();
    });

    it('is disabled when verifying', () => {
        render(<HashBadge status="checking" isVerifying={true} />);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});

describe('TamperProofIndicator Component', () => {
    it('shows secure state when verified and chain intact', () => {
        render(<TamperProofIndicator verified={true} chainIntact={true} />);
        expect(screen.getByLabelText('Entry is tamper-proof')).toBeInTheDocument();
    });

    it('shows warning state when not verified', () => {
        render(<TamperProofIndicator verified={false} chainIntact={true} />);
        expect(screen.getByLabelText('Entry requires verification')).toBeInTheDocument();
    });

    it('shows warning state when chain not intact', () => {
        render(<TamperProofIndicator verified={true} chainIntact={false} />);
        expect(screen.getByLabelText('Entry requires verification')).toBeInTheDocument();
    });
});

describe('AuditEntry Component', () => {
    it('renders entry with all required fields', () => {
        render(<AuditEntry entry={mockEntry} />);

        expect(screen.getByText('Decision Approved')).toBeInTheDocument();
        expect(screen.getByText('DataProcessor')).toBeInTheDocument();
        expect(screen.getByText(/Approved data processing request/)).toBeInTheDocument();
        expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    });

    it('displays hash badge with correct status', () => {
        render(<AuditEntry entry={mockEntry} />);
        expect(screen.getByText('verified')).toBeInTheDocument();
    });

    it('calls onVerifyHash when hash badge clicked', () => {
        const onVerifyHash = vi.fn();
        render(<AuditEntry entry={mockEntry} onVerifyHash={onVerifyHash} />);

        fireEvent.click(screen.getByLabelText(/Hash verified/));
        expect(onVerifyHash).toHaveBeenCalledWith('audit-001');
    });

    it('calls onAgentClick when agent name clicked', () => {
        const onAgentClick = vi.fn();
        render(<AuditEntry entry={mockEntry} onAgentClick={onAgentClick} />);

        fireEvent.click(screen.getByText('DataProcessor'));
        expect(onAgentClick).toHaveBeenCalledWith('agent-001');
    });

    it('calls onViewAccountability when View Chain clicked', () => {
        const onViewAccountability = vi.fn();
        render(<AuditEntry entry={mockEntry} onViewAccountability={onViewAccountability} />);

        fireEvent.click(screen.getByText('View Chain'));
        expect(onViewAccountability).toHaveBeenCalledWith('audit-001');
    });

    it('shows tamper-proof indicator', () => {
        render(<AuditEntry entry={mockEntry} />);
        expect(screen.getByLabelText('Entry is tamper-proof')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<AuditEntry entry={mockEntry} className="custom-class" />);
        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('shows different icons for different action types', () => {
        const failedEntry = { ...mockEntry, actionType: 'task_failed' as const };
        render(<AuditEntry entry={failedEntry} />);
        expect(screen.getByText('Task Failed')).toBeInTheDocument();
    });
});
