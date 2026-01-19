/**
 * HelpPanel Component Tests
 *
 * Epic 8: Onboarding & Education
 * Stories 8.5-8.6: Help Panel and Urgency Config tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    HelpPanel,
    ExplanationCard,
    FAQItem,
    UrgencyRuleCard,
    UrgencyConfigPanel,
    getUrgencyColor,
} from './HelpPanel';
import type { TrustExplanation, HelpPanelContent, UrgencyRule, UrgencyRuleConfig } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockExplanation: TrustExplanation = {
    topic: 'trust-tiers',
    title: 'Understanding Trust Tiers',
    summary: 'Trust tiers determine autonomy.',
    details: 'Agents progress through 6 tiers.',
    relatedTopics: ['trust-score', 'tier-promotion'],
    examples: [
        { scenario: 'Newly created agent', explanation: 'Starts at Untrusted tier' },
    ],
};

const mockHelpContent: HelpPanelContent = {
    contextId: 'decision-queue',
    explanations: [mockExplanation],
    faqs: [
        { question: 'What happens when I deny?', answer: 'Trust score may decrease.' },
        { question: 'How do agents gain trust?', answer: 'Through successful tasks.' },
    ],
};

const mockUrgencyRule: UrgencyRule = {
    id: 'rule-1',
    name: 'High Impact Actions',
    description: 'Actions affecting more than 100 records',
    condition: {
        field: 'affected_records',
        operator: 'greater_than',
        value: 100,
    },
    urgencyLevel: 'high',
    enabled: true,
    priority: 1,
};

const mockUrgencyConfig: UrgencyRuleConfig = {
    orgId: 'demo-org',
    defaultUrgency: 'medium',
    rules: [mockUrgencyRule],
    escalationTimeouts: {
        low: 3600000,
        medium: 1800000,
        high: 900000,
    },
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getUrgencyColor', () => {
    it('returns correct colors for each level', () => {
        expect(getUrgencyColor('low')).toBe('#10b981');
        expect(getUrgencyColor('medium')).toBe('#f59e0b');
        expect(getUrgencyColor('high')).toBe('#f97316');
        expect(getUrgencyColor('immediate')).toBe('#ef4444');
    });

    it('returns gray for unknown levels', () => {
        expect(getUrgencyColor('unknown')).toBe('#6b7280');
    });
});

// ============================================================================
// ExplanationCard Tests
// ============================================================================

describe('ExplanationCard', () => {
    it('renders explanation title', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={false} onToggle={vi.fn()} />);
        expect(screen.getByText('Understanding Trust Tiers')).toBeInTheDocument();
    });

    it('renders summary', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={false} onToggle={vi.fn()} />);
        expect(screen.getByText('Trust tiers determine autonomy.')).toBeInTheDocument();
    });

    it('shows + when collapsed', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={false} onToggle={vi.fn()} />);
        expect(screen.getByText('+')).toBeInTheDocument();
    });

    it('shows - when expanded', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={true} onToggle={vi.fn()} />);
        expect(screen.getByText('−')).toBeInTheDocument();
    });

    it('shows details when expanded', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={true} onToggle={vi.fn()} />);
        expect(screen.getByText('Agents progress through 6 tiers.')).toBeInTheDocument();
    });

    it('hides details when collapsed', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={false} onToggle={vi.fn()} />);
        expect(screen.queryByText('Agents progress through 6 tiers.')).not.toBeInTheDocument();
    });

    it('shows examples when expanded', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={true} onToggle={vi.fn()} />);
        expect(screen.getByText('Newly created agent')).toBeInTheDocument();
        expect(screen.getByText('Starts at Untrusted tier')).toBeInTheDocument();
    });

    it('shows related topics when expanded', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={true} onToggle={vi.fn()} />);
        expect(screen.getByText('trust score')).toBeInTheDocument();
        expect(screen.getByText('tier promotion')).toBeInTheDocument();
    });

    it('calls onToggle when header clicked', () => {
        const onToggle = vi.fn();
        render(<ExplanationCard explanation={mockExplanation} expanded={false} onToggle={onToggle} />);
        fireEvent.click(screen.getByText('Understanding Trust Tiers'));
        expect(onToggle).toHaveBeenCalled();
    });

    it('calls onTopicClick when related topic clicked', () => {
        const onTopicClick = vi.fn();
        render(<ExplanationCard explanation={mockExplanation} expanded={true} onToggle={vi.fn()} onTopicClick={onTopicClick} />);
        fireEvent.click(screen.getByText('trust score'));
        expect(onTopicClick).toHaveBeenCalledWith('trust-score');
    });

    it('has correct aria-label', () => {
        render(<ExplanationCard explanation={mockExplanation} expanded={false} onToggle={vi.fn()} />);
        expect(screen.getByLabelText('Explanation: Understanding Trust Tiers')).toBeInTheDocument();
    });
});

// ============================================================================
// FAQItem Tests
// ============================================================================

describe('FAQItem', () => {
    it('renders question', () => {
        render(<FAQItem question="What happens?" answer="Something." />);
        expect(screen.getByText('What happens?')).toBeInTheDocument();
    });

    it('hides answer initially', () => {
        render(<FAQItem question="What happens?" answer="Something." />);
        expect(screen.queryByText('Something.')).not.toBeInTheDocument();
    });

    it('shows answer when clicked', () => {
        render(<FAQItem question="What happens?" answer="Something." />);
        fireEvent.click(screen.getByText('What happens?'));
        expect(screen.getByText('Something.')).toBeInTheDocument();
    });

    it('hides answer when clicked again', () => {
        render(<FAQItem question="What happens?" answer="Something." />);
        fireEvent.click(screen.getByText('What happens?'));
        fireEvent.click(screen.getByText('What happens?'));
        expect(screen.queryByText('Something.')).not.toBeInTheDocument();
    });
});

// ============================================================================
// UrgencyRuleCard Tests
// ============================================================================

describe('UrgencyRuleCard', () => {
    it('renders rule name', () => {
        render(<UrgencyRuleCard rule={mockUrgencyRule} />);
        expect(screen.getByText('High Impact Actions')).toBeInTheDocument();
    });

    it('renders rule description', () => {
        render(<UrgencyRuleCard rule={mockUrgencyRule} />);
        expect(screen.getByText('Actions affecting more than 100 records')).toBeInTheDocument();
    });

    it('renders urgency level badge', () => {
        render(<UrgencyRuleCard rule={mockUrgencyRule} />);
        expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('renders condition', () => {
        render(<UrgencyRuleCard rule={mockUrgencyRule} />);
        expect(screen.getByText('affected_records greater than 100')).toBeInTheDocument();
    });

    it('shows checkbox as checked when enabled', () => {
        render(<UrgencyRuleCard rule={mockUrgencyRule} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('shows checkbox as unchecked when disabled', () => {
        const disabledRule = { ...mockUrgencyRule, enabled: false };
        render(<UrgencyRuleCard rule={disabledRule} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
    });

    it('calls onToggle when checkbox changed', () => {
        const onToggle = vi.fn();
        render(<UrgencyRuleCard rule={mockUrgencyRule} onToggle={onToggle} />);
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onToggle).toHaveBeenCalledWith('rule-1', false);
    });

    it('shows Edit button when onEdit provided', () => {
        render(<UrgencyRuleCard rule={mockUrgencyRule} onEdit={vi.fn()} />);
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('hides Edit button when onEdit not provided', () => {
        render(<UrgencyRuleCard rule={mockUrgencyRule} />);
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    it('calls onEdit when Edit clicked', () => {
        const onEdit = vi.fn();
        render(<UrgencyRuleCard rule={mockUrgencyRule} onEdit={onEdit} />);
        fireEvent.click(screen.getByText('Edit'));
        expect(onEdit).toHaveBeenCalledWith('rule-1');
    });

    it('has correct aria-label', () => {
        render(<UrgencyRuleCard rule={mockUrgencyRule} />);
        expect(screen.getByLabelText('Rule: High Impact Actions')).toBeInTheDocument();
    });
});

// ============================================================================
// HelpPanel Tests
// ============================================================================

describe('HelpPanel', () => {
    it('does not render when closed', () => {
        render(<HelpPanel content={mockHelpContent} isOpen={false} onClose={vi.fn()} />);
        expect(screen.queryByLabelText('Help Panel')).not.toBeInTheDocument();
    });

    it('renders when open', () => {
        render(<HelpPanel content={mockHelpContent} isOpen={true} onClose={vi.fn()} />);
        expect(screen.getByLabelText('Help Panel')).toBeInTheDocument();
    });

    it('renders title', () => {
        render(<HelpPanel content={mockHelpContent} isOpen={true} onClose={vi.fn()} />);
        expect(screen.getByText('Help & Explanations')).toBeInTheDocument();
    });

    it('renders explanations', () => {
        render(<HelpPanel content={mockHelpContent} isOpen={true} onClose={vi.fn()} />);
        expect(screen.getByText('Understanding Trust Tiers')).toBeInTheDocument();
    });

    it('renders FAQs', () => {
        render(<HelpPanel content={mockHelpContent} isOpen={true} onClose={vi.fn()} />);
        expect(screen.getByText('What happens when I deny?')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
        const onClose = vi.fn();
        render(<HelpPanel content={mockHelpContent} isOpen={true} onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('Close help panel'));
        expect(onClose).toHaveBeenCalled();
    });

    it('expands/collapses explanations on click', () => {
        render(<HelpPanel content={mockHelpContent} isOpen={true} onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Understanding Trust Tiers'));
        expect(screen.getByText('Agents progress through 6 tiers.')).toBeInTheDocument();
    });

    it('calls onTopicClick when related topic clicked', () => {
        const onTopicClick = vi.fn();
        render(<HelpPanel content={mockHelpContent} isOpen={true} onClose={vi.fn()} onTopicClick={onTopicClick} />);
        fireEvent.click(screen.getByText('Understanding Trust Tiers'));
        fireEvent.click(screen.getByText('trust score'));
        expect(onTopicClick).toHaveBeenCalledWith('trust-score');
    });

    it('applies custom className', () => {
        const { container } = render(<HelpPanel content={mockHelpContent} isOpen={true} onClose={vi.fn()} className="custom-panel" />);
        expect(container.querySelector('.help__panel.custom-panel')).toBeInTheDocument();
    });
});

// ============================================================================
// UrgencyConfigPanel Tests
// ============================================================================

describe('UrgencyConfigPanel', () => {
    it('renders title', () => {
        render(<UrgencyConfigPanel config={mockUrgencyConfig} />);
        expect(screen.getByText('Urgency Rules')).toBeInTheDocument();
    });

    it('renders default urgency selector', () => {
        render(<UrgencyConfigPanel config={mockUrgencyConfig} />);
        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('medium');
    });

    it('renders escalation timeouts', () => {
        render(<UrgencyConfigPanel config={mockUrgencyConfig} />);
        expect(screen.getByText('Escalation Timeouts')).toBeInTheDocument();
        expect(screen.getByText('60 min')).toBeInTheDocument(); // Low
        expect(screen.getByText('30 min')).toBeInTheDocument(); // Medium
        expect(screen.getByText('15 min')).toBeInTheDocument(); // High
    });

    it('renders all rules', () => {
        render(<UrgencyConfigPanel config={mockUrgencyConfig} />);
        expect(screen.getByText('High Impact Actions')).toBeInTheDocument();
    });

    it('calls onDefaultChange when default changed', () => {
        const onDefaultChange = vi.fn();
        render(<UrgencyConfigPanel config={mockUrgencyConfig} onDefaultChange={onDefaultChange} />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'high' } });
        expect(onDefaultChange).toHaveBeenCalledWith('high');
    });

    it('calls onRuleToggle when rule toggled', () => {
        const onRuleToggle = vi.fn();
        render(<UrgencyConfigPanel config={mockUrgencyConfig} onRuleToggle={onRuleToggle} />);
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onRuleToggle).toHaveBeenCalledWith('rule-1', false);
    });

    it('applies custom className', () => {
        const { container } = render(<UrgencyConfigPanel config={mockUrgencyConfig} className="custom-config" />);
        expect(container.querySelector('.help__urgency-config.custom-config')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<UrgencyConfigPanel config={mockUrgencyConfig} />);
        expect(screen.getByLabelText('Urgency Configuration')).toBeInTheDocument();
    });
});
