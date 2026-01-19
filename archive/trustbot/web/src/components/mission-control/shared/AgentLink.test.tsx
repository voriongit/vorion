import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentLink, parseStructuredId, ID_SEGMENT_INFO, ROLE_CODES } from './AgentLink';

describe('parseStructuredId', () => {
    it('correctly parses valid structured ID', () => {
        const result = parseStructuredId('01-MC-OP-42');
        expect(result.isValid).toBe(true);
        expect(result.segments).toHaveLength(4);
        expect(result.segments[0]).toEqual({
            code: 'HH',
            value: '01',
            label: 'Hierarchy Level 1',
            description: ID_SEGMENT_INFO.HH.description,
        });
        expect(result.segments[1]).toEqual({
            code: 'OO',
            value: 'MC',
            label: 'Org: MC',
            description: ID_SEGMENT_INFO.OO.description,
        });
        expect(result.segments[2]).toEqual({
            code: 'RR',
            value: 'OP',
            label: 'Operator',
            description: ID_SEGMENT_INFO.RR.description,
        });
        expect(result.segments[3]).toEqual({
            code: 'II',
            value: '42',
            label: 'Instance 42',
            description: ID_SEGMENT_INFO.II.description,
        });
    });

    it('returns invalid for UUID-style IDs', () => {
        const result = parseStructuredId('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        expect(result.isValid).toBe(false);
        expect(result.segments).toHaveLength(0);
    });

    it('returns invalid for malformed IDs', () => {
        expect(parseStructuredId('01-MC-OP').isValid).toBe(false);
        expect(parseStructuredId('01-mc-op-42').isValid).toBe(false);
        expect(parseStructuredId('1-MC-OP-42').isValid).toBe(false);
        expect(parseStructuredId('01-M-OP-42').isValid).toBe(false);
    });

    it('handles different role codes', () => {
        const roles = ['EX', 'SP', 'SV', 'WK', 'PL', 'VA'];
        roles.forEach((role) => {
            const result = parseStructuredId(`03-AB-${role}-01`);
            expect(result.isValid).toBe(true);
            expect(result.segments[2].value).toBe(role);
        });
    });
});

describe('ID_SEGMENT_INFO', () => {
    it('has info for all segment types', () => {
        expect(ID_SEGMENT_INFO.HH).toBeDefined();
        expect(ID_SEGMENT_INFO.OO).toBeDefined();
        expect(ID_SEGMENT_INFO.RR).toBeDefined();
        expect(ID_SEGMENT_INFO.II).toBeDefined();
    });

    it('has name and description for each segment', () => {
        Object.values(ID_SEGMENT_INFO).forEach((info) => {
            expect(info.name).toBeDefined();
            expect(info.description).toBeDefined();
        });
    });
});

describe('ROLE_CODES', () => {
    it('has mappings for common roles', () => {
        expect(ROLE_CODES.OP).toBe('Operator');
        expect(ROLE_CODES.EX).toBe('Executor');
        expect(ROLE_CODES.SP).toBe('Specialist');
        expect(ROLE_CODES.SV).toBe('Supervisor');
        expect(ROLE_CODES.WK).toBe('Worker');
    });
});

describe('AgentLink', () => {
    describe('Rendering', () => {
        it('renders with agent ID only', () => {
            render(<AgentLink agentId="01-MC-OP-42" />);
            expect(screen.getByTestId('agent-link')).toBeInTheDocument();
            expect(screen.getByTestId('agent-link-id')).toHaveTextContent('01-MC-OP-42');
        });

        it('renders with agent name', () => {
            render(<AgentLink agentId="01-MC-OP-42" agentName="DataProcessor" />);
            expect(screen.getByTestId('agent-link-name')).toHaveTextContent('DataProcessor');
            expect(screen.queryByTestId('agent-link-id')).not.toBeInTheDocument();
        });

        it('renders with name and ID when showId is true', () => {
            render(<AgentLink agentId="01-MC-OP-42" agentName="DataProcessor" showId />);
            expect(screen.getByTestId('agent-link-name')).toBeInTheDocument();
            expect(screen.getByTestId('agent-link-id')).toBeInTheDocument();
        });

        it('truncates long UUID-style IDs', () => {
            render(<AgentLink agentId="a1b2c3d4-e5f6-7890-abcd-ef1234567890" />);
            expect(screen.getByTestId('agent-link-id')).toHaveTextContent('a1b2c3d4...');
        });

        it('applies custom className', () => {
            render(<AgentLink agentId="01-MC-OP-42" className="custom-class" />);
            expect(screen.getByTestId('agent-link')).toHaveClass('custom-class');
        });

        it('uses custom testId', () => {
            render(<AgentLink agentId="01-MC-OP-42" testId="my-agent" />);
            expect(screen.getByTestId('my-agent')).toBeInTheDocument();
        });
    });

    describe('Size variants', () => {
        it('renders sm size', () => {
            render(<AgentLink agentId="01-MC-OP-42" size="sm" />);
            expect(screen.getByTestId('agent-link')).toBeInTheDocument();
        });

        it('renders lg size', () => {
            render(<AgentLink agentId="01-MC-OP-42" size="lg" />);
            expect(screen.getByTestId('agent-link')).toBeInTheDocument();
        });
    });

    describe('Click handling', () => {
        it('calls onClick with agentId when clicked', () => {
            const handleClick = vi.fn();
            render(<AgentLink agentId="01-MC-OP-42" onClick={handleClick} />);

            fireEvent.click(screen.getByTestId('agent-link'));

            expect(handleClick).toHaveBeenCalledTimes(1);
            expect(handleClick).toHaveBeenCalledWith('01-MC-OP-42');
        });

        it('calls onNavigate with path when clicked', () => {
            const handleNavigate = vi.fn();
            render(<AgentLink agentId="01-MC-OP-42" onNavigate={handleNavigate} />);

            fireEvent.click(screen.getByTestId('agent-link'));

            expect(handleNavigate).toHaveBeenCalledTimes(1);
            expect(handleNavigate).toHaveBeenCalledWith('/agents/01-MC-OP-42');
        });

        it('prefers onClick over onNavigate', () => {
            const handleClick = vi.fn();
            const handleNavigate = vi.fn();
            render(
                <AgentLink
                    agentId="01-MC-OP-42"
                    onClick={handleClick}
                    onNavigate={handleNavigate}
                />
            );

            fireEvent.click(screen.getByTestId('agent-link'));

            expect(handleClick).toHaveBeenCalled();
            expect(handleNavigate).not.toHaveBeenCalled();
        });

        it('does not call handlers when disabled', () => {
            const handleClick = vi.fn();
            render(<AgentLink agentId="01-MC-OP-42" onClick={handleClick} disabled />);

            fireEvent.click(screen.getByTestId('agent-link'));

            expect(handleClick).not.toHaveBeenCalled();
        });
    });

    describe('Keyboard navigation', () => {
        it('responds to Enter key', () => {
            const handleClick = vi.fn();
            render(<AgentLink agentId="01-MC-OP-42" onClick={handleClick} />);

            fireEvent.keyDown(screen.getByTestId('agent-link'), { key: 'Enter' });

            expect(handleClick).toHaveBeenCalled();
        });

        it('responds to Space key', () => {
            const handleClick = vi.fn();
            render(<AgentLink agentId="01-MC-OP-42" onClick={handleClick} />);

            fireEvent.keyDown(screen.getByTestId('agent-link'), { key: ' ' });

            expect(handleClick).toHaveBeenCalled();
        });

        it('has tabIndex of 0 when not disabled', () => {
            render(<AgentLink agentId="01-MC-OP-42" />);
            expect(screen.getByTestId('agent-link')).toHaveAttribute('tabIndex', '0');
        });

        it('has tabIndex of -1 when disabled', () => {
            render(<AgentLink agentId="01-MC-OP-42" disabled />);
            expect(screen.getByTestId('agent-link')).toHaveAttribute('tabIndex', '-1');
        });
    });

    describe('Accessibility', () => {
        it('has role="link"', () => {
            render(<AgentLink agentId="01-MC-OP-42" />);
            expect(screen.getByRole('link')).toBeInTheDocument();
        });

        it('has aria-label with agent name', () => {
            render(<AgentLink agentId="01-MC-OP-42" agentName="DataProcessor" />);
            expect(screen.getByTestId('agent-link')).toHaveAttribute(
                'aria-label',
                'View agent DataProcessor'
            );
        });

        it('has aria-label with agent ID when no name', () => {
            render(<AgentLink agentId="01-MC-OP-42" />);
            expect(screen.getByTestId('agent-link')).toHaveAttribute(
                'aria-label',
                'View agent 01-MC-OP-42'
            );
        });
    });

    describe('Tooltip', () => {
        it('shows tooltip on hover for structured IDs', async () => {
            render(<AgentLink agentId="01-MC-OP-42" showTooltip />);

            fireEvent.mouseEnter(screen.getByTestId('agent-link'));

            expect(screen.getByTestId('agent-link-tooltip')).toBeInTheDocument();
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        it('hides tooltip on mouse leave', () => {
            render(<AgentLink agentId="01-MC-OP-42" showTooltip />);

            fireEvent.mouseEnter(screen.getByTestId('agent-link'));
            expect(screen.getByTestId('agent-link-tooltip')).toBeInTheDocument();

            fireEvent.mouseLeave(screen.getByTestId('agent-link'));
            expect(screen.queryByTestId('agent-link-tooltip')).not.toBeInTheDocument();
        });

        it('does not show tooltip for non-structured IDs', () => {
            render(<AgentLink agentId="some-random-id" showTooltip />);

            fireEvent.mouseEnter(screen.getByTestId('agent-link'));

            expect(screen.queryByTestId('agent-link-tooltip')).not.toBeInTheDocument();
        });

        it('does not show tooltip when showTooltip is false', () => {
            render(<AgentLink agentId="01-MC-OP-42" showTooltip={false} />);

            fireEvent.mouseEnter(screen.getByTestId('agent-link'));

            expect(screen.queryByTestId('agent-link-tooltip')).not.toBeInTheDocument();
        });
    });
});
