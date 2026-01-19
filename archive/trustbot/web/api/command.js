import { saveTask, initStorage } from './lib/storage.js';

/**
 * Command API Endpoint
 * 
 * Processes commands sent to agents with:
 * - Simulated responses for common commands
 * - Agent-type-specific rule-based handlers
 * - Persistent Task Creation (PLANNER)
 */

// Helper to get random ID
const uuid = () => Math.random().toString(36).substring(2, 9);

// Task creation logic (Persistent)
const createTask = async (description, creator) => {
    await initStorage();
    const isResearch = description.toLowerCase().includes('research');
    const isAnalysis = description.toLowerCase().includes('analy');

    const taskType = isResearch ? 'research' : (isAnalysis ? 'analysis' : 'execution');
    const taskId = `task-${Date.now()}`;

    const newTask = {
        id: taskId,
        description,
        type: taskType,
        creator: creator || 'CommandAPI',
        priority: 'NORMAL',
        status: 'PENDING',
        assignee: null,
        capableAgents: [], // Will be filled by Task API routing if called directly, but we mock for now
        suggestedAssignee: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        result: null,
        progress: 0,
        nextSteps: 'Waiting for routing',
    };

    await saveTask(newTask);

    return `📝 Task created: [${taskType.toUpperCase()}] "${description}"\n(ID: ${taskId}) - Queued for assignment.`;
};

// Agent type capabilities and command handlers
const AGENT_HANDLERS = {
    EXECUTOR: {
        capabilities: ['approve', 'reject', 'execute', 'delegate'],
        responses: {
            status: (agent) => `🎖️ ${agent.name} is ${agent.status.toLowerCase()}. Ready to execute approved operations.`,
            report: (agent) => `📊 Execution Report for ${agent.name}:\n• Approved operations today: 12\n• Rejected: 2\n• Pending review: 3\n• Trust score: ${agent.trustScore}/1000`,
            pause: () => '⏸️ Execution queue paused. No new operations will be processed.',
            resume: () => '▶️ Execution queue resumed. Processing pending operations.',
            help: () => 'EXECUTOR commands: status, report, pause, resume, approve <id>, reject <id>, delegate <agent>',
        },
        custom: async (cmd, agent) => {
            if (cmd.startsWith('approve')) return '✅ Operation approved and queued for execution.';
            if (cmd.startsWith('reject')) return '❌ Operation rejected. Reason logged to blackboard.';
            if (cmd.startsWith('delegate')) return '📤 Task delegated to specified agent.';
            return null;
        }
    },
    PLANNER: {
        capabilities: ['plan', 'schedule', 'strategize', 'analyze'],
        responses: {
            status: (agent) => `🧠 ${agent.name} is ${agent.status.toLowerCase()}. Current strategy cycle: Day ${Math.floor(Math.random() * 30) + 1}.`,
            report: (agent) => `📊 Planning Report for ${agent.name}:\n• Active strategies: 3\n• Completed plans: 47\n• Success rate: 94%\n• Next planning cycle: 2 hours`,
            pause: () => '⏸️ Strategic planning paused. Existing plans continue execution.',
            resume: () => '▶️ Strategic planning resumed. Analyzing current objectives.',
            help: () => 'PLANNER commands: status, report, pause, resume, plan <goal>, schedule <task>, analyze <topic>',
        },
        custom: async (cmd, agent) => {
            if (cmd.startsWith('plan')) {
                const goal = cmd.replace('plan', '').trim() || 'General Optimization';
                return await createTask(goal, agent.name);
            }
            if (cmd.startsWith('schedule')) return '📅 Task scheduled for optimal execution window.';
            if (cmd.startsWith('analyze')) return '🔍 Analysis started. Results will be posted to blackboard.';
            return null;
        }
    },
    VALIDATOR: {
        capabilities: ['validate', 'audit', 'review', 'certify'],
        responses: {
            status: (agent) => `⚖️ ${agent.name} is ${agent.status.toLowerCase()}. Compliance checks active.`,
            report: (agent) => `📊 Validation Report for ${agent.name}:\n• Audits passed: 8\n• Flagged issues: 0\n• Risk mitigation: Active`,
            pause: () => '⏸️ Validation queue paused.',
            resume: () => '▶️ Validation queue resumed.',
            help: () => 'VALIDATOR commands: status, report, pause, resume, validate <id>, audit <target>',
        },
        custom: async (cmd, agent) => {
            if (cmd.startsWith('validate')) return '✅ Entity validated. Trust score updated.';
            if (cmd.startsWith('audit')) return '🔍 Audit initiated. Generating compliance report...';
            return null;
        }
    },
    SPAWNER: {
        capabilities: ['spawn', 'kill', 'monitor', 'scale'],
        responses: {
            status: (agent) => `🧬 ${agent.name} is ${agent.status.toLowerCase()}. Fleet health: 100%.`,
            report: (agent) => `📊 Spawner Report for ${agent.name}:\n• Total agents: ${Math.floor(Math.random() * 20) + 5}\n• Available slots: 3\n• Resource usage: 45%`,
            pause: () => '⏸️ Auto-scaling paused.',
            resume: () => '▶️ Auto-scaling resumed.',
            help: () => 'SPAWNER commands: status, report, pause, resume, spawn <type>, kill <id>',
        },
        custom: async (cmd, agent) => {
            if (cmd.startsWith('spawn')) return '✨ Spawning process initiated. Checking blueprints...';
            if (cmd.startsWith('kill')) return '💀 Termination sequence authorized. Spinning down instance.';
            return null;
        }
    },
    WORKER: {
        capabilities: ['work', 'process', 'fetch', 'compute'],
        responses: {
            status: (agent) => `🛠️ ${agent.name} is ${agent.status.toLowerCase()}. Task queue: Empty.`,
            report: (agent) => `📊 Work Report for ${agent.name}:\n• Tasks completed: 152\n• Efficiency: 98%\n• Errors: 0`,
            pause: () => '⏸️ Worker paused.',
            resume: () => '▶️ Worker resumed.',
            help: () => 'WORKER commands: status, report, pause, resume',
        },
        custom: async (cmd, agent) => {
            return null;
        }
    },
    LISTENER: {
        capabilities: ['listen', 'record', 'buffer', 'stream'],
        responses: {
            status: (agent) => `👂 ${agent.name} is ${agent.status.toLowerCase()}. Signals detected: Low.`,
            report: (agent) => `📊 Listener Report for ${agent.name}:\n• Uptime: 48h\n• Events logged: 8,432\n• Anomalies: 1`,
            pause: () => '⏸️ Signal processing paused.',
            resume: () => '▶️ Signal processing resumed.',
            help: () => 'LISTENER commands: status, report, pause, resume',
        },
        custom: async (cmd, agent) => {
            return null;
        }
    },
    EVOLVER: {
        capabilities: ['evolve', 'learn', 'optimize', 'patch'],
        responses: {
            status: (agent) => `🧬 ${agent.name} is ${agent.status.toLowerCase()}. Evolution cycle: Generation 4.`,
            report: (agent) => `📊 Evolution Report for ${agent.name}:\n• Patterns optimized: 14\n• New heuristics: 3\n• Performance gain: +12%`,
            pause: () => '⏸️ Evolution paused.',
            resume: () => '▶️ Evolution resumed.',
            help: () => 'EVOLVER commands: status, report, pause, resume',
        },
        custom: async (cmd, agent) => {
            return null;
        }
    }
};

// Default handler for unknown agent types
const DEFAULT_HANDLER = {
    responses: {
        status: (agent) => `${agent.name} is ${agent.status.toLowerCase()}.`,
        report: (agent) => `Activity report for ${agent.name}: Trust score ${agent.trustScore}/1000.`,
        pause: () => 'Agent paused.',
        resume: () => 'Agent resumed.',
        help: () => 'Available commands: status, report, pause, resume, help',
    },
    custom: async () => null
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { target, command, agent } = req.body;

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        const cmd = command.toLowerCase().trim();
        const agentType = agent?.type || 'WORKER';
        const handler = AGENT_HANDLERS[agentType] || DEFAULT_HANDLER;

        // Try standard commands first (sync)
        const baseCmd = cmd.split(' ')[0];
        if (handler.responses[baseCmd]) {
            const response = handler.responses[baseCmd](agent || { name: target, status: 'IDLE', trustScore: 500 });
            return res.status(200).json({
                success: true,
                command: cmd,
                response,
                agent: target,
                agentType,
                timestamp: new Date().toISOString(),
            });
        }

        // Try custom command handler (async)
        const customResponse = await handler.custom(cmd, agent || { name: target });
        if (customResponse) {
            return res.status(200).json({
                success: true,
                command: cmd,
                response: customResponse,
                agent: target,
                agentType,
                timestamp: new Date().toISOString(),
            });
        }

        // Unknown command
        return res.status(200).json({
            success: true,
            command: cmd,
            response: `❓ Unknown command: "${cmd}". Type "help" for available commands.`,
            agent: target,
            agentType,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Command API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
