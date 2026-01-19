/**
 * BiasAlertCard Component Tests
 * Story 4.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    BiasAlertCard,
    BiasAlertList,
    SeverityBadge,
    StatusBadge,
    MetricsDisplay,
    getSeverityColor,
    getSeverityIcon,
    getStatusColor,
    formatAlertTime,
    formatRelativeAlertTime,
} from './BiasAlertCard';
import type { AutomationBiasAlert } from '../../../types';

const mockAlert: AutomationBiasAlert = {
    id: 'alert-001',
    orgId: 'org-123',
    userId: 'user-001',
    userName: 'John Doe',
    severity: 'high',
    status: 'active',
    reason: 'Consistently approving decisions in under 5 seconds without viewing details',
    metrics: {
        avgReviewTimeMs: 3200,
        decisionCount: 47,
        detailViewRate: 0.12,
    },
    detectedAt: new Date().toISOString(),
};

const mockAcknowledgedAlert: AutomationBiasAlert = {
    ...mockAlert,
    id: 'alert-002',
    status: 'acknowledged',
};

describe('BiasAlertCard Helper Functions', () => {
    describe('getSeverityColor', () => {
        it('returns correct colors for each severity', () => {
            expect(getSeverityColor('low')).toBe('#f59e0b');
            expect(getSeverityColor('medium')).toBe('#f97316');
            expect(getSeverityColor('high')).toBe('#ef4444');
            expect(getSeverityColor('critical')).toBe('#dc2626');
        });
    });

    describe('getSeverityIcon', () => {
        it('returns correct icons for each severity', () => {
            expect(getSeverityIcon('low')).toBe('⚠️');
            expect(getSeverityIcon('medium')).toBe('🔶');
            expect(getSeverityIcon('high')).toBe('🔴');
            expect(getSeverityIcon('critical')).toBe('⛔');
        });
    });

    describe('getStatusColor', () => {
        it('returns correct colors for each status', () => {
            expect(getStatusColor('active')).toBe('#ef4444');
            expect(getStatusColor('acknowledged')).toBe('#f59e0b');
            expect(getStatusColor('resolved')).toBe('#10b981');
            expect(getStatusColor('dismissed')).toBe('#6b7280');
        });
    });

    describe('formatAlertTime', () => {
        it('formats timestamp to locale string', () => {
            const timestamp = '2024-01-15T10:30:00Z';
            const formatted = formatAlertTime(timestamp);
            expect(formatted).toContain('2024');
        });
    });

    describe('formatRelativeAlertTime', () => {
        it('returns "Just now" for recent timestamps', () => {
            const now = new Date().toISOString();
            expect(formatRelativeAlertTime(now)).toBe('Just now');
        });

        it('returns minutes ago for timestamps within the hour', () => {
            const twentyMinsAgo = new Date(Date.now() - 20 * 60000).toISOString();
            expect(formatRelativeAlertTime(twentyMinsAgo)).toBe('20 min ago');
        });

        it('returns hours ago for timestamps within the day', () => {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString();
            expect(formatRelativeAlertTime(twoHoursAgo)).toBe('2 hr ago');
        });
    });
});

describe('SeverityBadge Component', () => {
    it('renders severity label correctly', () => {
        render(<SeverityBadge severity="high" />);
        expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<SeverityBadge severity="critical" />);
        expect(screen.getByLabelText('Severity: critical')).toBeInTheDocument();
    });
});

describe('StatusBadge Component', () => {
    it('renders status text', () => {
        render(<StatusBadge status="active" />);
        expect(screen.getByText('active')).toBeInTheDocument();
    });
});

describe('MetricsDisplay Component', () => {
    const metrics = {
        avgReviewTimeMs: 3200,
        decisionCount: 47,
        detailViewRate: 0.12,
    };

    it('renders review time in seconds', () => {
        render(<MetricsDisplay metrics={metrics} />);
        expect(screen.getByText('3.2s')).toBeInTheDocument();
    });

    it('renders decision count', () => {
        render(<MetricsDisplay metrics={metrics} />);
        expect(screen.getByText('47')).toBeInTheDocument();
    });

    it('renders detail view rate as percentage', () => {
        render(<MetricsDisplay metrics={metrics} />);
        expect(screen.getByText('12%')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<MetricsDisplay metrics={metrics} />);
        expect(screen.getByLabelText('Alert metrics')).toBeInTheDocument();
    });
});

describe('BiasAlertCard Component', () => {
    it('renders alert with user name', () => {
        render(<BiasAlertCard alert={mockAlert} />);
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders aria-label with user name', () => {
        render(<BiasAlertCard alert={mockAlert} />);
        expect(screen.getByLabelText('Automation bias alert for John Doe')).toBeInTheDocument();
    });

    it('renders severity badge', () => {
        render(<BiasAlertCard alert={mockAlert} />);
        expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('renders status badge', () => {
        render(<BiasAlertCard alert={mockAlert} />);
        expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('renders reason text', () => {
        render(<BiasAlertCard alert={mockAlert} />);
        expect(screen.getByText(/Consistently approving decisions/)).toBeInTheDocument();
    });

    it('renders metrics display', () => {
        render(<BiasAlertCard alert={mockAlert} />);
        expect(screen.getByLabelText('Alert metrics')).toBeInTheDocument();
    });

    it('shows Acknowledge button for active alerts', () => {
        const onAcknowledge = vi.fn();
        render(<BiasAlertCard alert={mockAlert} onAcknowledge={onAcknowledge} />);
        expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });

    it('calls onAcknowledge when button clicked', () => {
        const onAcknowledge = vi.fn();
        render(<BiasAlertCard alert={mockAlert} onAcknowledge={onAcknowledge} />);

        fireEvent.click(screen.getByText('Acknowledge'));
        expect(onAcknowledge).toHaveBeenCalledWith('alert-001');
    });

    it('shows Dismiss button when handler provided', () => {
        const onDismiss = vi.fn();
        render(<BiasAlertCard alert={mockAlert} onDismiss={onDismiss} />);
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('calls onDismiss when button clicked', () => {
        const onDismiss = vi.fn();
        render(<BiasAlertCard alert={mockAlert} onDismiss={onDismiss} />);

        fireEvent.click(screen.getByText('Dismiss'));
        expect(onDismiss).toHaveBeenCalledWith('alert-001');
    });

    it('calls onViewUser when user name clicked', () => {
        const onViewUser = vi.fn();
        render(<BiasAlertCard alert={mockAlert} onViewUser={onViewUser} />);

        fireEvent.click(screen.getByText('John Doe'));
        expect(onViewUser).toHaveBeenCalledWith('user-001');
    });

    it('shows "Acknowledging..." when isAcknowledging is true', () => {
        render(<BiasAlertCard alert={mockAlert} onAcknowledge={() => {}} isAcknowledging={true} />);
        expect(screen.getByText('Acknowledging...')).toBeInTheDocument();
    });

    it('disables Acknowledge button when acknowledging', () => {
        render(<BiasAlertCard alert={mockAlert} onAcknowledge={() => {}} isAcknowledging={true} />);
        expect(screen.getByText('Acknowledging...')).toBeDisabled();
    });

    it('hides action buttons for non-active alerts', () => {
        render(<BiasAlertCard alert={mockAcknowledgedAlert} onAcknowledge={() => {}} />);
        expect(screen.queryByText('Acknowledge')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(
            <BiasAlertCard alert={mockAlert} className="custom-class" />
        );
        expect(container.firstChild).toHaveClass('custom-class');
    });
});

describe('BiasAlertList Component', () => {
    const mockAlerts: AutomationBiasAlert[] = [
        mockAlert,
        mockAcknowledgedAlert,
        { ...mockAlert, id: 'alert-003', status: 'resolved', severity: 'low' },
    ];

    it('renders list title', () => {
        render(<BiasAlertList alerts={mockAlerts} />);
        expect(screen.getByText('Automation Bias Alerts')).toBeInTheDocument();
    });

    it('renders aria-label', () => {
        render(<BiasAlertList alerts={mockAlerts} />);
        expect(screen.getByLabelText('Automation bias alerts')).toBeInTheDocument();
    });

    it('shows active count badge', () => {
        render(<BiasAlertList alerts={mockAlerts} />);
        expect(screen.getByText('1 active')).toBeInTheDocument();
    });

    it('renders all alerts', () => {
        render(<BiasAlertList alerts={mockAlerts} />);
        // There are 3 alerts, all with John Doe as user
        const userNames = screen.getAllByText('John Doe');
        expect(userNames).toHaveLength(3);
    });

    it('shows empty state when no alerts', () => {
        render(<BiasAlertList alerts={[]} />);
        expect(screen.getByText('No bias alerts detected')).toBeInTheDocument();
    });

    it('shows "Past Alerts" divider when both active and past alerts exist', () => {
        render(<BiasAlertList alerts={mockAlerts} />);
        expect(screen.getByText('Past Alerts')).toBeInTheDocument();
    });

    it('passes acknowledgingId to correct alert', () => {
        render(
            <BiasAlertList
                alerts={[mockAlert]}
                onAcknowledge={() => {}}
                acknowledgingId="alert-001"
            />
        );
        expect(screen.getByText('Acknowledging...')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(
            <BiasAlertList alerts={mockAlerts} className="custom-class" />
        );
        expect(container.firstChild).toHaveClass('custom-class');
    });
});
