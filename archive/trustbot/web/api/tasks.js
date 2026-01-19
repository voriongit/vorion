import { getTasks, saveTask, initStorage } from './lib/storage.js';

/**
 * Task Queue API
 * 
 * Manages task creation, routing, and assignment.
 * Uses Storage Adapter for persistence.
 */

// Capability mapping
const CAPABILITY_MAP = {
    research: ['WORKER', 'LISTENER'],
    analysis: ['PLANNER', 'WORKER'],
    validation: ['VALIDATOR'],
    execution: ['EXECUTOR', 'WORKER'],
    monitoring: ['LISTENER'],
    optimization: ['EVOLVER'],
    creation: ['SPAWNER'],
    communication: ['LISTENER', 'WORKER'],
    strategy: ['PLANNER', 'EXECUTOR'],
    review: ['VALIDATOR', 'EXECUTOR'],
};

// Task status flow
const TASK_STATUS = {
    PENDING: 'PENDING',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    BLOCKED: 'BLOCKED',
};

// Trust requirements
const TRUST_REQUIREMENTS = {
    strategy: 800,
    execution: 600,
    validation: 500,
    analysis: 400,
    research: 200,
    monitoring: 100,
};

function detectTaskType(description) {
    const desc = description.toLowerCase();
    if (desc.includes('research') || desc.includes('find') || desc.includes('search')) return 'research';
    if (desc.includes('analyze') || desc.includes('review') || desc.includes('assess')) return 'analysis';
    if (desc.includes('validate') || desc.includes('verify') || desc.includes('check')) return 'validation';
    if (desc.includes('execute') || desc.includes('run') || desc.includes('perform')) return 'execution';
    if (desc.includes('monitor') || desc.includes('watch') || desc.includes('track')) return 'monitoring';
    if (desc.includes('optimize') || desc.includes('improve') || desc.includes('enhance')) return 'optimization';
    if (desc.includes('create') || desc.includes('spawn') || desc.includes('build')) return 'creation';
    if (desc.includes('strategy') || desc.includes('plan') || desc.includes('design')) return 'strategy';
    return 'research';
}

function findCapableAgents(taskType, agents = []) {
    const capableTypes = CAPABILITY_MAP[taskType] || ['WORKER'];
    const minTrust = TRUST_REQUIREMENTS[taskType] || 200;

    return agents
        .filter(a => capableTypes.includes(a.type) && a.trustScore >= minTrust)
        .sort((a, b) => b.trustScore - a.trustScore);
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Initialize Storage
    await initStorage();
    const tasks = await getTasks();

    // GET - List tasks
    if (req.method === 'GET') {
        const { status, assignee } = req.query;
        let filteredTasks = [...tasks];

        if (status) {
            filteredTasks = filteredTasks.filter(t => t.status === status.toUpperCase());
        }
        if (assignee) {
            filteredTasks = filteredTasks.filter(t => t.assignee === assignee);
        }

        return res.status(200).json({
            tasks: filteredTasks, // Storage already limits to 50
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'PENDING').length,
            inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
            completed: tasks.filter(t => t.status === 'COMPLETED').length,
        });
    }

    // POST - Create/Update task
    if (req.method === 'POST') {
        const { action, taskId, description, creator, priority, agents } = req.body;

        // CREATE
        if (action === 'create') {
            if (!description || !creator) {
                return res.status(400).json({ error: 'Description and creator required' });
            }

            const taskType = detectTaskType(description);
            const capableAgents = findCapableAgents(taskType, agents || []);
            const newId = `task-${Date.now()}`;

            const newTask = {
                id: newId,
                description,
                type: taskType,
                creator,
                priority: priority || 'NORMAL',
                status: TASK_STATUS.PENDING,
                assignee: null,
                capableAgents: capableAgents.map(a => ({ id: a.id, name: a.name, type: a.type, trust: a.trustScore })),
                suggestedAssignee: capableAgents[0] || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completedAt: null,
                result: null,
                progress: 0,
                nextSteps: 'Waiting for agent assignment',
            };

            await saveTask(newTask);

            return res.status(201).json({
                success: true,
                task: newTask,
                message: capableAgents.length > 0
                    ? `Task created. ${capableAgents.length} capable agent(s) identified.`
                    : 'Task created. No capable agents found.',
                // Return blackboard entry hint for frontend to display (not saved here, saved via State API usually)
                blackboardEntry: {
                    type: 'TASK',
                    title: description.slice(0, 50),
                    content: `Task ${newId}: ${description}`,
                    author: creator,
                    priority: priority || 'NORMAL',
                    status: 'OPEN',
                },
            });
        }

        // FIND TASK for updates
        const task = tasks.find(t => t.id === taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // ASSIGN
        if (action === 'assign') {
            const { assigneeId, assigneeName } = req.body;
            task.assignee = assigneeId;
            task.assigneeName = assigneeName;
            task.status = TASK_STATUS.ASSIGNED;
            task.updatedAt = new Date().toISOString();
            await saveTask(task);

            return res.status(200).json({ success: true, task, message: `Assigned to ${assigneeName}` });
        }

        // START
        if (action === 'start') {
            task.status = TASK_STATUS.IN_PROGRESS;
            task.startedAt = new Date().toISOString();
            task.updatedAt = new Date().toISOString();
            await saveTask(task);

            return res.status(200).json({ success: true, task, message: 'Task started' });
        }

        // COMPLETE
        if (action === 'complete') {
            const { result } = req.body;
            task.status = TASK_STATUS.COMPLETED;
            task.result = result || 'Success';
            task.completedAt = new Date().toISOString();
            task.updatedAt = new Date().toISOString();
            task.progress = 100;
            task.nextSteps = 'Completed';
            await saveTask(task);

            return res.status(200).json({ success: true, task, message: 'Task completed' });
        }

        // CLAIM
        if (action === 'claim') {
            if (task.status !== TASK_STATUS.PENDING) {
                return res.status(400).json({ error: 'Task already assigned' });
            }
            const { claimerId, claimerName } = req.body;
            task.assignee = claimerId;
            task.assigneeName = claimerName;
            task.status = TASK_STATUS.IN_PROGRESS;
            task.startedAt = new Date().toISOString();
            task.updatedAt = new Date().toISOString();
            await saveTask(task);

            return res.status(200).json({ success: true, task, message: 'Task claimed' });
        }

        // PROGRESS
        if (action === 'progress') {
            const { progress, nextSteps } = req.body;
            if (progress !== undefined) task.progress = progress;
            if (nextSteps !== undefined) task.nextSteps = nextSteps;
            task.updatedAt = new Date().toISOString();
            await saveTask(task);

            return res.status(200).json({ success: true, task, message: 'Progress updated' });
        }
    }
}
