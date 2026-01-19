/**
 * Metrics Page - Analytics Dashboard
 */
import { useOutletContext } from 'react-router-dom';
import { MetricsDashboard } from '../components/MetricsDashboard';
import type { Agent, BlackboardEntry } from '../types';

interface PageContext {
    agents: Agent[];
    blackboardEntries: BlackboardEntry[];
    hitlLevel: number;
}

export function MetricsPage() {
    const ctx = useOutletContext<PageContext>();

    const avgTrust = ctx.agents.length > 0
        ? Math.round(ctx.agents.reduce((sum, a) => sum + a.trustScore, 0) / ctx.agents.length)
        : 0;

    return (
        <div className="metrics-page">
            <MetricsDashboard
                agents={ctx.agents}
                blackboardEntries={ctx.blackboardEntries}
                hitlLevel={ctx.hitlLevel}
                avgTrust={avgTrust}
                uptime={0}
                onClose={() => {}}
                onViewAgent={() => {}}
            />
        </div>
    );
}
