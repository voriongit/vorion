/**
 * InvestigationCard Component Tests
 *
 * Epic 6: Investigation Management
 * Stories 6.1-6.5: Full coverage for investigation UI
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    InvestigationCard,
    InvestigationList,
    PriorityBadge,
    StatusBadge,
    AnomalyCard,
    RollbackCard,
    LinkedEventCard,
    getStatusColor,
    getStatusIcon,
    getPriorityColor,
    getTypeLabel,
    formatTimeAgo,
} from './InvestigationCard';
import type { Investigation, PatternAnomaly, RollbackRecord, LinkedEvent } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockAnomaly: PatternAnomaly = {
    id: 'anomaly-001',
    investigationId: 'inv-001',
    pattern: 'Approval Rate Spike',
    severity: 'high',
    status: 'detected',
    description: 'Unusual spike in approval rate detected',
    detectedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    baseline: {
        metric: 'approval_rate',
        expectedValue: 0.75,
        actualValue: 0.95,
        deviationPercent: 26.7,
    },
};

const mockRollback: RollbackRecord = {
    id: 'rollback-001',
    investigationId: 'inv-001',
    decisionId: 'dec-123',
    rolledBackAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    rolledBackBy: 'operator-001',
    reason: 'Incorrect data processing',
    affectedRecords: 156,
    status: 'completed',
};

const mockLinkedEvent: LinkedEvent = {
    id: 'link-001',
    investigationId: 'inv-001',
    eventId: 'evt-456',
    eventType: 'decision',
    relationship: 'cause',
    linkedAt: new Date().toISOString(),
    linkedBy: 'operator-001',
    notes: 'Related to the initial trigger',
};

const mockInvestigation: Investigation = {
    id: 'inv-001',
    orgId: 'org-001',
    title: 'Suspicious Activity Investigation',
    description: 'Investigating unusual agent behavior patterns',
    type: 'suspicious_activity',
    status: 'in_progress',
    priority: 'high',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date().toISOString(),
    createdBy: 'operator-001',
    assignedTo: 'analyst-001',
    triggerEventId: 'evt-trigger-001',
    scope: {
        agentIds: ['agent-001', 'agent-002'],
        timeRange: {
            start: new Date(Date.now() - 604800000).toISOString(),
            end: new Date().toISOString(),
        },
        expanded: false,
        expansions: [],
    },
    linkedEvents: [mockLinkedEvent],
    findings: [
        {
            id: 'finding-001',
            investigationId: 'inv-001',
            title: 'Pattern Match Found',
            description: 'Similar behavior observed in past incidents',
            severity: 'medium',
            evidence: ['Hash: abc123', 'Timestamp: ...'],
            createdAt: new Date().toISOString(),
            createdBy: 'analyst-001',
        },
    ],
    rollbacks: [mockRollback],
    anomalies: [mockAnomaly],
};

const closedInvestigation: Investigation = {
    ...mockInvestigation,
    id: 'inv-002',
    status: 'closed',
    title: 'Closed Investigation',
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Helper Functions', () => {
    describe('getStatusColor', () => {
        it('returns correct color for each status', () => {
            expect(getStatusColor('open')).toBe('#3b82f6');
            expect(getStatusColor('in_progress')).toBe('#f59e0b');
            expect(getStatusColor('pending_review')).toBe('#8b5cf6');
            expect(getStatusColor('closed')).toBe('#10b981');
            expect(getStatusColor('merged')).toBe('#6b7280');
        });
    });

    describe('getStatusIcon', () => {
        it('returns correct icon for each status', () => {
            expect(getStatusIcon('open')).toBe('📂');
            expect(getStatusIcon('in_progress')).toBe('🔍');
            expect(getStatusIcon('pending_review')).toBe('⏳');
            expect(getStatusIcon('closed')).toBe('✅');
            expect(getStatusIcon('merged')).toBe('🔗');
        });
    });

    describe('getPriorityColor', () => {
        it('returns correct color for each priority', () => {
            expect(getPriorityColor('low')).toBe('#10b981');
            expect(getPriorityColor('medium')).toBe('#f59e0b');
            expect(getPriorityColor('high')).toBe('#f97316');
            expect(getPriorityColor('critical')).toBe('#ef4444');
        });
    });

    describe('getTypeLabel', () => {
        it('returns correct label for each type', () => {
            expect(getTypeLabel('suspicious_activity')).toBe('Suspicious Activity');
            expect(getTypeLabel('trust_violation')).toBe('Trust Violation');
            expect(getTypeLabel('data_anomaly')).toBe('Data Anomaly');
            expect(getTypeLabel('pattern_alert')).toBe('Pattern Alert');
            expect(getTypeLabel('manual')).toBe('Manual Investigation');
        });
    });

    describe('formatTimeAgo', () => {
        it('returns "Just now" for recent timestamps', () => {
            expect(formatTimeAgo(new Date().toISOString())).toBe('Just now');
        });

        it('returns hours ago for timestamps within 24h', () => {
            const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
            expect(formatTimeAgo(twoHoursAgo)).toBe('2h ago');
        });

        it('returns days ago for timestamps within 7 days', () => {
            const threeDaysAgo = new Date(Date.now() - 259200000).toISOString();
            expect(formatTimeAgo(threeDaysAgo)).toBe('3d ago');
        });

        it('returns formatted date for older timestamps', () => {
            const oldDate = new Date(Date.now() - 1209600000).toISOString(); // 14 days
            expect(formatTimeAgo(oldDate)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
        });
    });
});

// ============================================================================
// Sub-Component Tests
// ============================================================================

describe('PriorityBadge', () => {
    it('renders priority text in uppercase', () => {
        render(<PriorityBadge priority="high" />);
        expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('applies correct aria-label', () => {
        render(<PriorityBadge priority="critical" />);
        expect(screen.getByLabelText('Priority: critical')).toBeInTheDocument();
    });

    it('applies priority color as background', () => {
        render(<PriorityBadge priority="high" />);
        const badge = screen.getByText('HIGH');
        expect(badge).toHaveStyle({ backgroundColor: '#f97316' });
    });
});

describe('StatusBadge', () => {
    it('renders status with icon', () => {
        render(<StatusBadge status="in_progress" />);
        expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    });

    it('renders open status', () => {
        render(<StatusBadge status="open" />);
        expect(screen.getByText(/open/i)).toBeInTheDocument();
    });

    it('renders closed status with checkmark icon', () => {
        render(<StatusBadge status="closed" />);
        expect(screen.getByText(/closed/i)).toBeInTheDocument();
    });
});

describe('AnomalyCard', () => {
    it('renders anomaly description', () => {
        render(<AnomalyCard anomaly={mockAnomaly} />);
        expect(screen.getByText(mockAnomaly.description)).toBeInTheDocument();
    });

    it('renders severity badge in uppercase', () => {
        render(<AnomalyCard anomaly={mockAnomaly} />);
        expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('renders baseline metrics', () => {
        render(<AnomalyCard anomaly={mockAnomaly} />);
        expect(screen.getByText(/Expected: 75%/)).toBeInTheDocument();
        expect(screen.getByText(/Actual: 95%/)).toBeInTheDocument();
        expect(screen.getByText(/\+26\.7%/)).toBeInTheDocument();
    });

    it('renders action buttons when onUpdateStatus provided and status is detected', () => {
        const handleUpdate = vi.fn();
        render(<AnomalyCard anomaly={mockAnomaly} onUpdateStatus={handleUpdate} />);
        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('does not render action buttons for confirmed anomaly', () => {
        const confirmedAnomaly = { ...mockAnomaly, status: 'confirmed' as const };
        const handleUpdate = vi.fn();
        render(<AnomalyCard anomaly={confirmedAnomaly} onUpdateStatus={handleUpdate} />);
        expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    });

    it('calls onUpdateStatus with correct params when Confirm clicked', () => {
        const handleUpdate = vi.fn();
        render(<AnomalyCard anomaly={mockAnomaly} onUpdateStatus={handleUpdate} />);
        fireEvent.click(screen.getByText('Confirm'));
        expect(handleUpdate).toHaveBeenCalledWith(mockAnomaly.id, 'confirmed');
    });

    it('calls onUpdateStatus with correct params when Dismiss clicked', () => {
        const handleUpdate = vi.fn();
        render(<AnomalyCard anomaly={mockAnomaly} onUpdateStatus={handleUpdate} />);
        fireEvent.click(screen.getByText('Dismiss'));
        expect(handleUpdate).toHaveBeenCalledWith(mockAnomaly.id, 'dismissed');
    });

    it('has correct aria-label', () => {
        render(<AnomalyCard anomaly={mockAnomaly} />);
        expect(screen.getByLabelText(`Anomaly: ${mockAnomaly.pattern}`)).toBeInTheDocument();
    });
});

describe('RollbackCard', () => {
    it('renders rollback reason', () => {
        render(<RollbackCard rollback={mockRollback} />);
        expect(screen.getByText(mockRollback.reason)).toBeInTheDocument();
    });

    it('renders rollback status in uppercase', () => {
        render(<RollbackCard rollback={mockRollback} />);
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    it('renders affected records count', () => {
        render(<RollbackCard rollback={mockRollback} />);
        expect(screen.getByText(/Affected: 156 records/)).toBeInTheDocument();
    });

    it('renders decision ID', () => {
        render(<RollbackCard rollback={mockRollback} />);
        expect(screen.getByText(/Decision: dec-123/)).toBeInTheDocument();
    });

    it('renders pending status with amber color', () => {
        const pendingRollback = { ...mockRollback, status: 'pending' as const };
        render(<RollbackCard rollback={pendingRollback} />);
        expect(screen.getByText('PENDING')).toBeInTheDocument();
    });

    it('renders failed status with red color', () => {
        const failedRollback = { ...mockRollback, status: 'failed' as const };
        render(<RollbackCard rollback={failedRollback} />);
        expect(screen.getByText('FAILED')).toBeInTheDocument();
    });
});

describe('LinkedEventCard', () => {
    it('renders relationship badge', () => {
        render(<LinkedEventCard event={mockLinkedEvent} />);
        expect(screen.getByText('cause')).toBeInTheDocument();
    });

    it('renders event type', () => {
        render(<LinkedEventCard event={mockLinkedEvent} />);
        expect(screen.getByText('decision')).toBeInTheDocument();
    });

    it('renders event ID', () => {
        render(<LinkedEventCard event={mockLinkedEvent} />);
        expect(screen.getByText('evt-456')).toBeInTheDocument();
    });

    it('renders notes when provided', () => {
        render(<LinkedEventCard event={mockLinkedEvent} />);
        expect(screen.getByText(mockLinkedEvent.notes!)).toBeInTheDocument();
    });

    it('does not render notes when not provided', () => {
        const eventWithoutNotes = { ...mockLinkedEvent, notes: undefined };
        render(<LinkedEventCard event={eventWithoutNotes} />);
        expect(screen.queryByText('Related to the initial trigger')).not.toBeInTheDocument();
    });

    it('renders related relationship', () => {
        const relatedEvent = { ...mockLinkedEvent, relationship: 'related' as const };
        render(<LinkedEventCard event={relatedEvent} />);
        expect(screen.getByText('related')).toBeInTheDocument();
    });

    it('renders effect relationship', () => {
        const effectEvent = { ...mockLinkedEvent, relationship: 'effect' as const };
        render(<LinkedEventCard event={effectEvent} />);
        expect(screen.getByText('effect')).toBeInTheDocument();
    });

    it('renders duplicate relationship', () => {
        const duplicateEvent = { ...mockLinkedEvent, relationship: 'duplicate' as const };
        render(<LinkedEventCard event={duplicateEvent} />);
        expect(screen.getByText('duplicate')).toBeInTheDocument();
    });
});

// ============================================================================
// InvestigationCard Tests
// ============================================================================

describe('InvestigationCard', () => {
    it('renders investigation title', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText(mockInvestigation.title)).toBeInTheDocument();
    });

    it('renders investigation description', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText(mockInvestigation.description)).toBeInTheDocument();
    });

    it('renders priority badge', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('renders status badge', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    });

    it('renders type label', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText('Suspicious Activity')).toBeInTheDocument();
    });

    it('renders assignee when provided', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText(/Assigned to: analyst-001/)).toBeInTheDocument();
    });

    it('renders scope agent count', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText('2 agent(s)')).toBeInTheDocument();
    });

    it('renders stats summary', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText('Linked Events')).toBeInTheDocument();
        expect(screen.getByText('Findings')).toBeInTheDocument();
        expect(screen.getByText('Rollbacks')).toBeInTheDocument();
        expect(screen.getByText('Anomalies')).toBeInTheDocument();
    });

    it('renders Expand button when collapsed', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByText('Expand')).toBeInTheDocument();
    });

    it('shows Collapse button after expanding', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        fireEvent.click(screen.getByText('Expand'));
        expect(screen.getByText('Collapse')).toBeInTheDocument();
    });

    it('shows anomaly details when expanded', () => {
        render(<InvestigationCard investigation={mockInvestigation} expanded />);
        expect(screen.getByText('Pattern Anomalies')).toBeInTheDocument();
        expect(screen.getByText(mockAnomaly.description)).toBeInTheDocument();
    });

    it('shows rollback details when expanded', () => {
        render(<InvestigationCard investigation={mockInvestigation} expanded />);
        expect(screen.getByRole('heading', { name: 'Rollbacks' })).toBeInTheDocument();
        expect(screen.getByText(mockRollback.reason)).toBeInTheDocument();
    });

    it('shows linked events when expanded', () => {
        render(<InvestigationCard investigation={mockInvestigation} expanded />);
        expect(screen.getByRole('heading', { name: 'Linked Events' })).toBeInTheDocument();
        expect(screen.getByText('evt-456')).toBeInTheDocument();
    });

    it('calls onViewDetails when View Details clicked', () => {
        const handleViewDetails = vi.fn();
        render(<InvestigationCard investigation={mockInvestigation} onViewDetails={handleViewDetails} />);
        fireEvent.click(screen.getByText('View Details'));
        expect(handleViewDetails).toHaveBeenCalledWith(mockInvestigation.id);
    });

    it('calls onExpandScope when Expand Scope clicked', () => {
        const handleExpandScope = vi.fn();
        render(<InvestigationCard investigation={mockInvestigation} onExpandScope={handleExpandScope} />);
        fireEvent.click(screen.getByText('Expand Scope'));
        expect(handleExpandScope).toHaveBeenCalledWith(mockInvestigation.id);
    });

    it('calls onLinkEvent when Link Event clicked', () => {
        const handleLinkEvent = vi.fn();
        render(<InvestigationCard investigation={mockInvestigation} onLinkEvent={handleLinkEvent} />);
        fireEvent.click(screen.getByText('Link Event'));
        expect(handleLinkEvent).toHaveBeenCalledWith(mockInvestigation.id);
    });

    it('calls onRequestRollback when Request Rollback clicked', () => {
        const handleRollback = vi.fn();
        render(<InvestigationCard investigation={mockInvestigation} onRequestRollback={handleRollback} />);
        fireEvent.click(screen.getByText('Request Rollback'));
        expect(handleRollback).toHaveBeenCalledWith(mockInvestigation.id);
    });

    it('does not show action buttons for closed investigation', () => {
        render(<InvestigationCard investigation={closedInvestigation} onExpandScope={vi.fn()} />);
        expect(screen.queryByText('Expand Scope')).not.toBeInTheDocument();
        expect(screen.queryByText('Link Event')).not.toBeInTheDocument();
        expect(screen.queryByText('Request Rollback')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<InvestigationCard investigation={mockInvestigation} className="custom-class" />);
        expect(container.querySelector('.investigation.custom-class')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<InvestigationCard investigation={mockInvestigation} />);
        expect(screen.getByLabelText(`Investigation: ${mockInvestigation.title}`)).toBeInTheDocument();
    });

    it('shows expanded scope indicator when scope is expanded', () => {
        const expandedInvestigation = {
            ...mockInvestigation,
            scope: { ...mockInvestigation.scope, expanded: true },
        };
        render(<InvestigationCard investigation={expandedInvestigation} />);
        expect(screen.getByText(/Expanded/)).toBeInTheDocument();
    });

    it('calls onUpdateAnomalyStatus with all required params', () => {
        const handleUpdate = vi.fn();
        render(
            <InvestigationCard
                investigation={mockInvestigation}
                onUpdateAnomalyStatus={handleUpdate}
                expanded
            />
        );
        fireEvent.click(screen.getByText('Confirm'));
        expect(handleUpdate).toHaveBeenCalledWith(mockInvestigation.id, mockAnomaly.id, 'confirmed');
    });
});

// ============================================================================
// InvestigationList Tests
// ============================================================================

describe('InvestigationList', () => {
    it('renders list title', () => {
        render(<InvestigationList investigations={[mockInvestigation]} />);
        expect(screen.getByText('Investigations')).toBeInTheDocument();
    });

    it('renders open count', () => {
        render(<InvestigationList investigations={[mockInvestigation]} />);
        expect(screen.getByText('1 open')).toBeInTheDocument();
    });

    it('renders empty state when no investigations', () => {
        render(<InvestigationList investigations={[]} />);
        expect(screen.getByText('No investigations found')).toBeInTheDocument();
    });

    it('renders all investigation cards', () => {
        render(<InvestigationList investigations={[mockInvestigation, closedInvestigation]} />);
        expect(screen.getByText(mockInvestigation.title)).toBeInTheDocument();
        expect(screen.getByText(closedInvestigation.title)).toBeInTheDocument();
    });

    it('shows divider between open and closed investigations', () => {
        render(<InvestigationList investigations={[mockInvestigation, closedInvestigation]} />);
        expect(screen.getByText('Closed Investigations')).toBeInTheDocument();
    });

    it('does not show divider when only open investigations', () => {
        render(<InvestigationList investigations={[mockInvestigation]} />);
        expect(screen.queryByText('Closed Investigations')).not.toBeInTheDocument();
    });

    it('does not show divider when only closed investigations', () => {
        render(<InvestigationList investigations={[closedInvestigation]} />);
        expect(screen.queryByText('Closed Investigations')).not.toBeInTheDocument();
    });

    it('passes callbacks to investigation cards', () => {
        const handleViewDetails = vi.fn();
        render(
            <InvestigationList
                investigations={[mockInvestigation]}
                onViewDetails={handleViewDetails}
            />
        );
        fireEvent.click(screen.getByText('View Details'));
        expect(handleViewDetails).toHaveBeenCalled();
    });

    it('applies custom className', () => {
        const { container } = render(
            <InvestigationList investigations={[]} className="custom-list" />
        );
        expect(container.querySelector('.investigation-list.custom-list')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<InvestigationList investigations={[]} />);
        expect(screen.getByLabelText('Investigations')).toBeInTheDocument();
    });

    it('counts merged investigations as closed', () => {
        const mergedInvestigation = { ...mockInvestigation, id: 'inv-003', status: 'merged' as const };
        render(<InvestigationList investigations={[mergedInvestigation]} />);
        expect(screen.getByText('0 open')).toBeInTheDocument();
    });

    it('correctly counts multiple open investigations', () => {
        const openInv1 = { ...mockInvestigation, id: 'inv-001' };
        const openInv2 = { ...mockInvestigation, id: 'inv-002', status: 'open' as const };
        const openInv3 = { ...mockInvestigation, id: 'inv-003', status: 'pending_review' as const };
        render(<InvestigationList investigations={[openInv1, openInv2, openInv3, closedInvestigation]} />);
        expect(screen.getByText('3 open')).toBeInTheDocument();
    });
});
