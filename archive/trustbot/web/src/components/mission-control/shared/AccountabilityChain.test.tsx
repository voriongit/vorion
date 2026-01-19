/**
 * AccountabilityChain Component Tests
 * Story 4.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    AccountabilityChain,
    getLevelIcon,
    getLevelColor,
} from './AccountabilityChain';
import type { AccountabilityChain as AccountabilityChainType } from '../../../types';

const mockChain: AccountabilityChainType = {
    entryId: 'audit-001',
    levels: [
        {
            level: 1,
            title: 'Acting Agent',
            entityId: 'agent-001',
            entityName: 'DataProcessor',
            entityType: 'agent',
            applicable: true,
        },
        {
            level: 2,
            title: 'Supervising Agent',
            entityId: 'agent-002',
            entityName: 'AgentSupervisor',
            entityType: 'agent',
            applicable: true,
        },
        {
            level: 3,
            title: 'HITL Reviewer',
            entityId: 'user-001',
            entityName: 'John Doe',
            entityType: 'hitl',
            applicable: true,
        },
        {
            level: 4,
            title: 'Tribunal Members',
            entityType: 'na',
            applicable: false,
            reason: 'No tribunal review required for this action',
        },
        {
            level: 5,
            title: 'Governance Owner',
            entityId: 'user-admin',
            entityName: 'Admin User',
            entityType: 'governance',
            applicable: true,
        },
    ],
};

describe('AccountabilityChain Helper Functions', () => {
    describe('getLevelIcon', () => {
        it('returns correct icon for each entity type', () => {
            expect(getLevelIcon('agent')).toBe('🤖');
            expect(getLevelIcon('hitl')).toBe('👤');
            expect(getLevelIcon('tribunal')).toBe('⚖️');
            expect(getLevelIcon('governance')).toBe('🏛️');
            expect(getLevelIcon('na')).toBe('—');
        });
    });

    describe('getLevelColor', () => {
        it('returns distinct colors for each level when applicable', () => {
            expect(getLevelColor(1, true)).toBe('#3b82f6');
            expect(getLevelColor(2, true)).toBe('#8b5cf6');
            expect(getLevelColor(3, true)).toBe('#10b981');
            expect(getLevelColor(4, true)).toBe('#f59e0b');
            expect(getLevelColor(5, true)).toBe('#ef4444');
        });

        it('returns gray color for non-applicable levels', () => {
            expect(getLevelColor(1, false)).toBe('#64748b');
            expect(getLevelColor(3, false)).toBe('#64748b');
        });
    });
});

describe('AccountabilityChain Component', () => {
    it('renders section with correct aria-label', () => {
        render(<AccountabilityChain chain={mockChain} />);
        expect(screen.getByLabelText('Accountability chain')).toBeInTheDocument();
    });

    it('renders title and subtitle', () => {
        render(<AccountabilityChain chain={mockChain} />);
        expect(screen.getByText('Accountability Chain')).toBeInTheDocument();
        expect(screen.getByText('5-level responsibility hierarchy for this action')).toBeInTheDocument();
    });

    it('renders all 5 levels', () => {
        render(<AccountabilityChain chain={mockChain} />);
        expect(screen.getByText('Acting Agent')).toBeInTheDocument();
        expect(screen.getByText('Supervising Agent')).toBeInTheDocument();
        expect(screen.getByText('HITL Reviewer')).toBeInTheDocument();
        expect(screen.getByText('Tribunal Members')).toBeInTheDocument();
        expect(screen.getByText('Governance Owner')).toBeInTheDocument();
    });

    it('renders entity names for applicable levels', () => {
        render(<AccountabilityChain chain={mockChain} />);
        expect(screen.getByText('DataProcessor')).toBeInTheDocument();
        expect(screen.getByText('AgentSupervisor')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    it('shows N/A for non-applicable levels', () => {
        render(<AccountabilityChain chain={mockChain} />);
        expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('shows reason for non-applicable levels', () => {
        render(<AccountabilityChain chain={mockChain} />);
        expect(screen.getByText('No tribunal review required for this action')).toBeInTheDocument();
    });

    it('calls onEntityClick when entity button clicked', () => {
        const onEntityClick = vi.fn();
        render(<AccountabilityChain chain={mockChain} onEntityClick={onEntityClick} />);

        fireEvent.click(screen.getByText('DataProcessor'));
        expect(onEntityClick).toHaveBeenCalledWith('agent-001', 'agent');
    });

    it('calls onEntityClick with correct params for HITL', () => {
        const onEntityClick = vi.fn();
        render(<AccountabilityChain chain={mockChain} onEntityClick={onEntityClick} />);

        fireEvent.click(screen.getByText('John Doe'));
        expect(onEntityClick).toHaveBeenCalledWith('user-001', 'hitl');
    });

    it('applies custom className', () => {
        const { container } = render(
            <AccountabilityChain chain={mockChain} className="custom-class" />
        );
        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('renders level numbers in badges', () => {
        render(<AccountabilityChain chain={mockChain} />);
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
    });
});
