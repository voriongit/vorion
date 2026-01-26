import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface AuditEvent {
    id: string;
    timestamp: number;
    eventType: 'action' | 'decision' | 'escalation' | 'approval' | 'rejection' | 'error' | 'system';
    agentId: string;
    action: string;
    details: string;
    input?: any;
    output?: any;
    success: boolean;
    duration?: number;
    risk?: 'HIGH' | 'MEDIUM' | 'LOW';
    hash: string;          // Hash of this event
    prevHash: string;      // Hash of previous event (chain)
    verified?: boolean;    // Hash chain verified
}

interface AuditLog {
    events: AuditEvent[];
    lastHash: string;
}

function getAuditPath(): string {
    const rootDir = process.env.INIT_CWD || process.cwd();
    return path.resolve(rootDir, '../../.vorion/audit-log.json');
}

function calculateHash(event: Omit<AuditEvent, 'hash' | 'verified'>, prevHash: string): string {
    const data = JSON.stringify({
        ...event,
        prevHash,
    });
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

function loadAuditLog(): AuditLog {
    const auditPath = getAuditPath();
    try {
        if (fs.existsSync(auditPath)) {
            return JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
        }
    } catch {
        // Start fresh
    }
    return { events: [], lastHash: '0000000000000000' };
}

function saveAuditLog(log: AuditLog): void {
    const auditPath = getAuditPath();
    const dir = path.dirname(auditPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(auditPath, JSON.stringify(log, null, 2));
}

function verifyChain(events: AuditEvent[]): boolean {
    if (events.length === 0) return true;

    let prevHash = '0000000000000000';
    for (const event of events) {
        const expectedHash = calculateHash(
            { ...event, hash: undefined, verified: undefined } as any,
            prevHash
        );
        if (event.hash !== expectedHash || event.prevHash !== prevHash) {
            return false;
        }
        prevHash = event.hash;
    }
    return true;
}

function generateMockEvents(): AuditEvent[] {
    const agents = ['herald', 'sentinel', 'watchman', 'envoy', 'scribe', 'curator', 'ts-fixer'];
    const actions = [
        { action: 'intent_classified', type: 'action' as const, details: 'Classified user intent' },
        { action: 'policy_audit', type: 'action' as const, details: 'Audited codebase against policies' },
        { action: 'health_check', type: 'action' as const, details: 'System health check completed' },
        { action: 'content_drafted', type: 'action' as const, details: 'Social media content drafted' },
        { action: 'docs_generated', type: 'action' as const, details: 'Documentation generated' },
        { action: 'proposal_submitted', type: 'escalation' as const, details: 'High-risk action submitted for approval' },
        { action: 'proposal_approved', type: 'approval' as const, details: 'Proposal approved by council' },
        { action: 'proposal_rejected', type: 'rejection' as const, details: 'Proposal rejected by council' },
        { action: 'type_error_fixed', type: 'action' as const, details: 'TypeScript error resolved' },
        { action: 'workspace_cleaned', type: 'action' as const, details: 'Workspace hygiene completed' },
    ];

    const events: AuditEvent[] = [];
    let prevHash = '0000000000000000';
    const now = Date.now();

    // Generate 50 mock events over the last 24 hours
    for (let i = 0; i < 50; i++) {
        const actionData = actions[Math.floor(Math.random() * actions.length)]!;
        const agent = agents[Math.floor(Math.random() * agents.length)]!;
        const timestamp = now - (50 - i) * (24 * 60 * 60 * 1000 / 50); // Spread over 24h

        const eventBase = {
            id: `audit_${timestamp}_${Math.random().toString(36).slice(2, 9)}`,
            timestamp,
            eventType: actionData.type,
            agentId: agent,
            action: actionData.action,
            details: actionData.details,
            success: Math.random() > 0.1, // 90% success rate
            duration: Math.floor(100 + Math.random() * 2000),
            risk: (Math.random() > 0.7 ? 'HIGH' : Math.random() > 0.4 ? 'MEDIUM' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
            prevHash,
        };

        const hash = calculateHash(eventBase as any, prevHash);
        const event: AuditEvent = {
            ...eventBase,
            hash,
            verified: true,
        };

        events.push(event);
        prevHash = hash;
    }

    return events;
}

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'GET') {
        const { agent, type, since, until, limit = '100', verify } = req.query;

        let log = loadAuditLog();

        // Generate mock data if empty
        if (log.events.length === 0) {
            log.events = generateMockEvents();
            log.lastHash = log.events[log.events.length - 1]?.hash || '0000000000000000';
            saveAuditLog(log);
        }

        let events = [...log.events];

        // Filter by agent
        if (agent && typeof agent === 'string') {
            events = events.filter(e => e.agentId === agent);
        }

        // Filter by type
        if (type && typeof type === 'string') {
            events = events.filter(e => e.eventType === type);
        }

        // Filter by time range
        if (since) {
            const sinceTime = parseInt(since as string, 10);
            events = events.filter(e => e.timestamp >= sinceTime);
        }
        if (until) {
            const untilTime = parseInt(until as string, 10);
            events = events.filter(e => e.timestamp <= untilTime);
        }

        // Sort by timestamp descending
        events.sort((a, b) => b.timestamp - a.timestamp);

        // Apply limit
        const limitNum = parseInt(limit as string, 10);
        events = events.slice(0, limitNum);

        // Verify chain if requested
        let chainValid = true;
        if (verify === 'true') {
            chainValid = verifyChain(log.events);
        }

        res.status(200).json({
            events,
            total: log.events.length,
            chainValid,
            lastHash: log.lastHash,
        });

    } else if (req.method === 'POST') {
        // Add new audit event
        const { eventType, agentId, action, details, input, output, success, duration, risk } = req.body;

        if (!agentId || !action) {
            return res.status(400).json({ error: 'agentId and action are required' });
        }

        const log = loadAuditLog();

        const eventBase = {
            id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            timestamp: Date.now(),
            eventType: eventType || 'action',
            agentId,
            action,
            details: details || '',
            input,
            output,
            success: success !== false,
            duration,
            risk,
            prevHash: log.lastHash,
        };

        const hash = calculateHash(eventBase as any, log.lastHash);
        const event: AuditEvent = {
            ...eventBase,
            hash,
            verified: true,
        };

        log.events.push(event);
        log.lastHash = hash;

        // Keep last 10000 events
        if (log.events.length > 10000) {
            log.events = log.events.slice(-10000);
        }

        saveAuditLog(log);

        res.status(201).json(event);

    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
