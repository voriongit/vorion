/**
 * Agent Table Row - Spreadsheet-style row for agent list
 * Shows all agent data in a compact, scannable format
 */
import { Agent, getAgentCapabilities, SKILLS } from '../types';

interface AgentTableRowProps {
    agent: Agent;
    onClick: () => void;
}

export function AgentTableRow({ agent, onClick }: AgentTableRowProps) {
    const capabilities = getAgentCapabilities(agent.tier, agent.trustScore);
    
    const getStatusIcon = () => {
        switch (agent.status) {
            case 'WORKING': return '🟢';
            case 'IDLE': return '🟡';
            case 'IN_MEETING': return '🟠';
            case 'ERROR': return '🔴';
            case 'TERMINATED': return '⚫';
            default: return '⚪';
        }
    };

    // Get agent's skills (from their skills array)
    const agentSkills = (agent.skills || [])
        .map(id => SKILLS[id])
        .filter(Boolean)
        .slice(0, 3); // Show max 3 in table

    return (
        <tr className="agent-table-row" onClick={onClick}>
            <td className="agent-table-row__status">
                <span title={agent.status}>{getStatusIcon()}</span>
            </td>
            <td className="agent-table-row__name">
                <strong>{agent.name}</strong>
            </td>
            <td className="agent-table-row__type">{agent.type}</td>
            <td className="agent-table-row__tier">T{agent.tier}</td>
            <td className="agent-table-row__trust">
                <span className="trust-badge" style={{
                    background: agent.trustScore >= 70 ? 'var(--accent-green)' :
                               agent.trustScore >= 40 ? 'var(--accent-gold)' : 'var(--accent-red)'
                }}>
                    {agent.trustScore}
                </span>
            </td>
            {/* 8 Capability columns */}
            {capabilities.map(cap => (
                <td key={cap.id} className="agent-table-row__cap" title={cap.name}>
                    <span className={cap.enabled ? 'cap-yes' : 'cap-no'}>
                        {cap.enabled ? '✓' : '✗'}
                    </span>
                </td>
            ))}
            <td className="agent-table-row__skills">
                {agentSkills.length > 0 
                    ? agentSkills.map(s => s.icon).join(' ')
                    : <span className="no-skills">—</span>
                }
            </td>
            <td className="agent-table-row__actions">
                <button className="view-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>
                    👁️
                </button>
            </td>
        </tr>
    );
}
