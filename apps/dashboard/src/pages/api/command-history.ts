import type { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs';
import * as path from 'path';

interface CommandEntry {
    id: string;
    command: string;
    response: string;
    agent: string;
    success: boolean;
    timestamp: number;
    duration?: number;
    tags?: string[];
}

interface CommandHistory {
    entries: CommandEntry[];
    lastUpdated: number;
}

const MAX_ENTRIES = 500;

function getHistoryPath(): string {
    const rootDir = process.env.INIT_CWD || process.cwd();
    return path.resolve(rootDir, '../../.vorion/command-history.json');
}

function loadHistory(): CommandHistory {
    const historyPath = getHistoryPath();
    try {
        if (fs.existsSync(historyPath)) {
            return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        }
    } catch {
        // Start fresh
    }
    return { entries: [], lastUpdated: Date.now() };
}

function saveHistory(history: CommandHistory): void {
    const historyPath = getHistoryPath();
    const dir = path.dirname(historyPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'GET') {
        // Get history with optional filtering
        const { search, agent, limit = '50', offset = '0' } = req.query;
        const history = loadHistory();

        let entries = [...history.entries];

        // Filter by search term
        if (search && typeof search === 'string') {
            const searchLower = search.toLowerCase();
            entries = entries.filter(e =>
                e.command.toLowerCase().includes(searchLower) ||
                e.response.toLowerCase().includes(searchLower)
            );
        }

        // Filter by agent
        if (agent && typeof agent === 'string') {
            entries = entries.filter(e => e.agent === agent);
        }

        // Sort by timestamp descending (most recent first)
        entries.sort((a, b) => b.timestamp - a.timestamp);

        // Apply pagination
        const offsetNum = parseInt(offset as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const paginatedEntries = entries.slice(offsetNum, offsetNum + limitNum);

        res.status(200).json({
            entries: paginatedEntries,
            total: entries.length,
            hasMore: offsetNum + limitNum < entries.length,
        });

    } else if (req.method === 'POST') {
        // Add new entry
        const { command, response, agent, success, duration, tags } = req.body;

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        const history = loadHistory();

        const entry: CommandEntry = {
            id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            command,
            response: response || '',
            agent: agent || 'herald',
            success: success !== false,
            timestamp: Date.now(),
            duration,
            tags,
        };

        history.entries.push(entry);
        history.lastUpdated = Date.now();

        // Trim old entries if exceeding max
        if (history.entries.length > MAX_ENTRIES) {
            history.entries = history.entries.slice(-MAX_ENTRIES);
        }

        saveHistory(history);

        res.status(201).json(entry);

    } else if (req.method === 'DELETE') {
        // Clear history or delete specific entry
        const { id } = req.query;

        const history = loadHistory();

        if (id && typeof id === 'string') {
            // Delete specific entry
            history.entries = history.entries.filter(e => e.id !== id);
        } else {
            // Clear all
            history.entries = [];
        }

        history.lastUpdated = Date.now();
        saveHistory(history);

        res.status(200).json({ success: true });

    } else {
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
