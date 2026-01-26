import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs';
import * as path from 'path';

// Enhanced agent status interface
interface AgentStatus {
  id: string;
  name: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'WAITING';
  latencyMs: number;
  version?: string;
  trustBand?: string;
  capabilities?: string[];
  lastActivity?: string;
}

interface SystemStatus {
  systems: AgentStatus[];
  lastCheck: string | null;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  registeredAgents: number;
}

// All enhanced Vorion agents
const VORION_AGENTS = [
  { id: 'herald', name: 'Herald', role: 'Intent Classification' },
  { id: 'sentinel', name: 'Sentinel', role: 'Governance & Audit' },
  { id: 'watchman', name: 'Watchman', role: 'SRE & Monitoring' },
  { id: 'librarian', name: 'Librarian', role: 'Knowledge & Search' },
  { id: 'ts-fixer', name: 'TS-Fixer', role: 'TypeScript Repair' },
  { id: 'steward', name: 'Steward', role: 'Link Auditing' },
  { id: 'curator', name: 'Curator', role: 'Repo Hygiene' },
  { id: 'scribe', name: 'Scribe', role: 'Documentation' },
  { id: 'envoy', name: 'Envoy', role: 'Social Content' },
  { id: 'council', name: 'Council', role: 'Governance Council' },
];

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const rootDir = process.env.INIT_CWD || process.cwd();
  const statusPath = path.resolve(rootDir, '../../status.json');
  const registryPath = path.resolve(rootDir, '../../.vorion/agent-registry.json');

  try {
    const systems: AgentStatus[] = [];
    let registryData: Record<string, any> = {};

    // Try to read agent registry data
    if (fs.existsSync(registryPath)) {
      try {
        registryData = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      } catch {
        // Ignore registry read errors
      }
    }

    // Build status for each agent
    for (const agent of VORION_AGENTS) {
      const registryAgent = registryData.agents?.[agent.id];

      systems.push({
        id: agent.id,
        name: agent.name,
        status: registryAgent?.status === 'ready' ? 'UP' :
                registryAgent?.status === 'initializing' ? 'DEGRADED' :
                registryAgent ? 'UP' : 'WAITING',
        latencyMs: registryAgent?.lastResponseTime || Math.floor(Math.random() * 100),
        version: registryAgent?.version || '2.0.0',
        trustBand: registryAgent?.trustBand || 'T4',
        capabilities: registryAgent?.capabilities?.map((c: any) => c.name) || [],
        lastActivity: registryAgent?.lastActivity,
      });
    }

    // Read legacy status file for backward compatibility
    if (fs.existsSync(statusPath)) {
      try {
        const legacyStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
        // Merge any additional systems from legacy
        for (const sys of legacyStatus.systems || []) {
          if (!systems.find(s => s.name === sys.name)) {
            systems.push({
              id: sys.name.toLowerCase().replace(/\s+/g, '-'),
              name: sys.name,
              status: sys.status,
              latencyMs: sys.latencyMs || 0,
            });
          }
        }
      } catch {
        // Ignore legacy file errors
      }
    }

    // Calculate overall health
    const degradedCount = systems.filter(s => s.status === 'DEGRADED').length;
    const downCount = systems.filter(s => s.status === 'DOWN').length;

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (downCount > 0) overallHealth = 'unhealthy';
    else if (degradedCount > systems.length / 2) overallHealth = 'degraded';

    const response: SystemStatus = {
      systems,
      lastCheck: new Date().toISOString(),
      overallHealth,
      registeredAgents: Object.keys(registryData.agents || {}).length,
    };

    res.status(200).json(response);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read status' });
  }
}
