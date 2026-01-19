/**
 * Console Page - Aria Chat Interface
 * Wraps the existing Console component
 */
import { useOutletContext } from 'react-router-dom';
import { Console } from '../components/Console';
import type { Agent, BlackboardEntry, ApprovalRequest } from '../types';

interface PageContext {
    agents: Agent[];
    blackboardEntries: BlackboardEntry[];
    approvals: ApprovalRequest[];
    hitlLevel: number;
    currentUser: { email: string; name: string; picture?: string } | null;
    refresh: () => Promise<void>;
    openAgentDetail: (id: string) => void;
    autoTickEnabled: boolean;
    setAutoTickEnabled: (enabled: boolean) => void;
}

export function ConsolePage() {
    const ctx = useOutletContext<PageContext>();

    return (
        <Console
            agents={ctx.agents}
            blackboardEntries={ctx.blackboardEntries}
            approvals={ctx.approvals}
            hitlLevel={ctx.hitlLevel}
            user={ctx.currentUser}
            onSelectAgent={ctx.openAgentDetail}
            autoTickEnabled={ctx.autoTickEnabled}
            onToggleAutoTick={() => ctx.setAutoTickEnabled(!ctx.autoTickEnabled)}
        />
    );
}
