/**
 * Agent Overview Module Tests
 *
 * Story 1.3: Agent Overview Module - List View
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentOverviewModule, STATUS_CONFIG } from './AgentOverviewModule';
import { useMissionControlStore } from '../../../stores/missionControlStore';
import type { Agent } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockAgents: Agent[] = [
    {
        id: 'agent-1',
        structuredId: '05-MC-EX-01',
        name: 'T5-EXECUTOR',
        type: 'EXECUTOR',
        tier: 5,
        status: 'WORKING',
        location: { floor: 'EXECUTIVE', room: 'OFFICE_A' },
        trustScore: 1000,
        capabilities: ['execute', 'plan'],
        parentId: null,
    },
    {
        id: 'agent-2',
        structuredId: '02-MC-SP-01',
        name: 'SecurityAnalyst',
        type: 'SPECIALIST',
        tier: 3,  // Matches trustScore 550 → T3 TACTICAL
        status: 'IDLE',
        location: { floor: 'OPERATIONS', room: 'OFFICE_B' },
        trustScore: 550,
        capabilities: ['analyze'],
        parentId: 'agent-1',
    },
    {
        id: 'agent-3',
        structuredId: '01-MC-WK-01',
        name: 'DataWorker',
        type: 'WORKER',
        tier: 1,
        status: 'ERROR',
        location: { floor: 'OPERATIONS', room: 'STATION_A' },
        trustScore: 200,
        capabilities: ['process'],
        parentId: 'agent-1',
    },
];

// ============================================================================
// Test Helpers
// ============================================================================

function renderWithStore(agents: Agent[] = mockAgents, connectionStatus: 'connected' | 'disconnected' | 'reconnecting' = 'connected') {
    // Set store state
    useMissionControlStore.setState({
        agents,
        connectionStatus,
        lastSync: new Date(),
        pendingDecisions: [],
        activeTasks: [],
        reconnectAttempts: 0,
        orgId: 'demo-org',
        userRole: 'operator',
    });
}

// ============================================================================
// Tests
// ============================================================================

describe('AgentOverviewModule', () => {
    beforeEach(() => {
        useMissionControlStore.getState().reset();
    });

    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders the module with header and list', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.Header />
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByRole('region', { name: 'Agent Overview' })).toBeInTheDocument();
            expect(screen.getByText('Agent Fleet')).toBeInTheDocument();
        });

        it('displays agent count in header', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.Header />
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByLabelText('3 agents')).toBeInTheDocument();
        });

        it('renders all agents in the list', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByText('T5-EXECUTOR')).toBeInTheDocument();
            expect(screen.getByText('SecurityAnalyst')).toBeInTheDocument();
            expect(screen.getByText('DataWorker')).toBeInTheDocument();
        });

        it('displays agent trust scores', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByText('1000')).toBeInTheDocument();
            expect(screen.getByText('550')).toBeInTheDocument();
            expect(screen.getByText('200')).toBeInTheDocument();
        });

        it('displays agent tier badges', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            // TrustBadge calculates tier from score:
            // 1000 → T5, 550 → T3, 200 → T1
            expect(screen.getByText('T5')).toBeInTheDocument();
            expect(screen.getByText('T3')).toBeInTheDocument();
            expect(screen.getByText('T1')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Status Indicators
    // ========================================================================

    describe('Status Indicators', () => {
        it('shows correct status labels', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('Idle')).toBeInTheDocument();
            expect(screen.getByText('Error')).toBeInTheDocument();
        });

        it('has accessible status icons with ARIA labels', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByLabelText('Agent is actively working')).toBeInTheDocument();
            expect(screen.getByLabelText('Agent is idle and available')).toBeInTheDocument();
            expect(screen.getByLabelText('Agent has encountered an error')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Footer Stats
    // ========================================================================

    describe('Footer Stats', () => {
        it('shows footer with active/idle counts', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                    <AgentOverviewModule.Footer />
                </AgentOverviewModule>
            );

            // 1 active (WORKING), 1 idle
            expect(screen.getByText('active')).toBeInTheDocument();
            expect(screen.getByText('idle')).toBeInTheDocument();
        });

        it('shows error count when agents have errors', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                    <AgentOverviewModule.Footer />
                </AgentOverviewModule>
            );

            expect(screen.getByText('error')).toBeInTheDocument();
        });

        it('shows average trust score', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.Footer />
                </AgentOverviewModule>
            );

            expect(screen.getByText('avg trust')).toBeInTheDocument();
            // Average of 1000 + 550 + 200 = 583
            expect(screen.getByText('583')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Click Handling
    // ========================================================================

    describe('Click Handling', () => {
        it('calls onAgentClick when agent is clicked', () => {
            renderWithStore();
            const handleClick = vi.fn();

            render(
                <AgentOverviewModule onAgentClick={handleClick}>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            fireEvent.click(screen.getByText('T5-EXECUTOR'));

            expect(handleClick).toHaveBeenCalledTimes(1);
            expect(handleClick).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'agent-1', name: 'T5-EXECUTOR' })
            );
        });

        it('makes items keyboard accessible when onClick provided', () => {
            renderWithStore();
            const handleClick = vi.fn();

            render(
                <AgentOverviewModule onAgentClick={handleClick}>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            const item = screen.getByRole('button', { name: /T5-EXECUTOR/i });
            expect(item).toHaveAttribute('tabIndex', '0');

            fireEvent.keyDown(item, { key: 'Enter' });
            expect(handleClick).toHaveBeenCalled();
        });
    });

    // ========================================================================
    // Empty & Loading States
    // ========================================================================

    describe('Empty & Loading States', () => {
        it('shows empty message when no agents', () => {
            renderWithStore([]);

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByText('No agents found')).toBeInTheDocument();
        });

        it('shows loading skeleton when reconnecting with no agents', () => {
            renderWithStore([], 'reconnecting');

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByLabelText('Loading agents')).toBeInTheDocument();
        });

        it('shows error message when disconnected', () => {
            renderWithStore([], 'disconnected');

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
        });
    });

    // ========================================================================
    // Custom Title
    // ========================================================================

    describe('Custom Configuration', () => {
        it('allows custom title in header', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.Header title="My Custom Fleet" />
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByText('My Custom Fleet')).toBeInTheDocument();
        });

        it('allows custom count override in header', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.Header count={10} />
                    <AgentOverviewModule.List />
                </AgentOverviewModule>
            );

            expect(screen.getByLabelText('10 agents')).toBeInTheDocument();
        });

        it('allows custom footer content', () => {
            renderWithStore();

            render(
                <AgentOverviewModule>
                    <AgentOverviewModule.Footer>
                        <span>Custom Footer Content</span>
                    </AgentOverviewModule.Footer>
                </AgentOverviewModule>
            );

            expect(screen.getByText('Custom Footer Content')).toBeInTheDocument();
        });
    });
});

// ============================================================================
// Status Config Tests
// ============================================================================

describe('STATUS_CONFIG', () => {
    it('has all required status types', () => {
        expect(STATUS_CONFIG.WORKING).toBeDefined();
        expect(STATUS_CONFIG.IDLE).toBeDefined();
        expect(STATUS_CONFIG.WAITING_APPROVAL).toBeDefined();
        expect(STATUS_CONFIG.IN_MEETING).toBeDefined();
        expect(STATUS_CONFIG.ERROR).toBeDefined();
        expect(STATUS_CONFIG.TERMINATED).toBeDefined();
        expect(STATUS_CONFIG.INITIALIZING).toBeDefined();
    });

    it('has color, label, icon, and ariaLabel for each status', () => {
        for (const [key, config] of Object.entries(STATUS_CONFIG)) {
            expect(config.color).toBeDefined();
            expect(config.label).toBeDefined();
            expect(config.icon).toBeDefined();
            expect(config.ariaLabel).toBeDefined();
        }
    });
});
