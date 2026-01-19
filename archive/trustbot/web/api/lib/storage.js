import { sql } from '@vercel/postgres';

/**
 * Storage Adapter
 * Handles persistence for Agents, Blackboard, Tasks, Skills, and Chat.
 * Adapters:
 * 1. Memory (Default/Fallback)
 * 2. Postgres (Vercel Postgres)
 */

// Feature Flag
const USE_POSTGRES = process.env.POSTGRES_URL && process.env.STORAGE_PROVIDER !== 'memory';

// ============================================================================
// In-Memory Fallback Store
// ============================================================================
let memoryState = {
    agents: [],
    blackboard: [],
    hitlLevel: 100,
    avgTrust: 500,
    startedAt: new Date().toISOString(),
    events: [],
    initialized: false
};

let memoryTasks = [];

let memorySkills = [
    { id: 'skill-financial-v1', name: 'Wall St Sentiment', tier: 1, category: 'FINANCE', capabilities: ['analyze_stocks'], price: 50, description: 'Analyzes market sentiment from news.' },
    { id: 'skill-legal-v1', name: 'Compliance Audit', tier: 5, category: 'LEGAL', capabilities: ['audit_compliance'], price: 200, description: 'Checks actions against regulatory framework.' },
    { id: 'skill-react-v1', name: 'React Expert', tier: 2, category: 'TECH', capabilities: ['write_react', 'debug_react'], price: 100, description: 'Writes and optimizes React components.' },
    { id: 'skill-growth-v1', name: 'Viral Marketing', tier: 3, category: 'GROWTH', capabilities: ['generate_hooks'], price: 150, description: 'Optimizes content for engagement.' }
];

let memoryChat = [];

// ============================================================================
// Postgres Adapter
// ============================================================================
const PostgresAdapter = {
    async init() {
        try {
            await sql`CREATE TABLE IF NOT EXISTS system_state (key TEXT PRIMARY KEY, data JSONB);`;
            await sql`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data JSONB, status TEXT, created_at TIMESTAMP);`;
            await sql`CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, data JSONB);`;
            await sql`CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, data JSONB, channel_id TEXT, created_at TIMESTAMP);`;
            return true;
        } catch (err) {
            console.error('Postgres init failed:', err);
            return false;
        }
    },

    async getState() {
        try {
            const { rows } = await sql`SELECT data FROM system_state WHERE key = 'main'`;
            return rows.length > 0 ? rows[0].data : null;
        } catch (err) {
            console.error('Postgres getState failed:', err);
            return null;
        }
    },

    async saveState(state) {
        try {
            await sql`
                INSERT INTO system_state (key, data)
                VALUES ('main', ${JSON.stringify(state)})
                ON CONFLICT (key) DO UPDATE SET data = ${JSON.stringify(state)};
            `;
        } catch (err) {
            console.error('Postgres saveState failed:', err);
        }
    },

    async getTasks() {
        try {
            const { rows } = await sql`SELECT data FROM tasks ORDER BY created_at DESC LIMIT 50`;
            return rows.map(r => r.data);
        } catch (err) {
            console.error('Postgres getTasks failed:', err);
            return [];
        }
    },

    async saveTask(task) {
        try {
            await sql`
                INSERT INTO tasks (id, data, status, created_at)
                VALUES (${task.id}, ${JSON.stringify(task)}, ${task.status}, ${task.createdAt})
                ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(task)}, status = ${task.status};
            `;
        } catch (err) {
            console.error('Postgres saveTask failed:', err);
        }
    },

    async getSkills() {
        try {
            const { rows } = await sql`SELECT data FROM skills`;
            return rows.length > 0 ? rows.map(r => r.data) : null;
        } catch (err) {
            console.error('Postgres getSkills failed:', err);
            return null;
        }
    },

    async saveSkill(skill) {
        try {
            await sql`
                INSERT INTO skills (id, data)
                VALUES (${skill.id}, ${JSON.stringify(skill)})
                ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(skill)};
            `;
        } catch (err) {
            console.error('Postgres saveSkill failed:', err);
        }
    },

    async getChatMessages(channelId) {
        try {
            let query = sql`SELECT data FROM chat_messages`;
            if (channelId) {
                query = sql`SELECT data FROM chat_messages WHERE channel_id = ${channelId} ORDER BY created_at ASC LIMIT 100`;
            } else {
                query = sql`SELECT data FROM chat_messages ORDER BY created_at DESC LIMIT 100`;
            }
            const { rows } = await query;
            return rows.map(r => r.data);
        } catch (err) {
            console.error('Postgres getChatMessages failed:', err);
            return [];
        }
    },

    async saveChatMessage(msg) {
        try {
            await sql`
                INSERT INTO chat_messages (id, data, channel_id, created_at)
                VALUES (${msg.id}, ${JSON.stringify(msg)}, ${msg.channelId}, ${msg.timestamp})
                ON CONFLICT (id) DO NOTHING;
            `;
        } catch (err) {
            console.error('Postgres saveChatMessage failed:', err);
        }
    }
};

// ============================================================================
// Public API
// ============================================================================
export async function getSystemState() {
    if (USE_POSTGRES) {
        const dbState = await PostgresAdapter.getState();
        if (dbState) return dbState;
    }
    return memoryState.initialized ? memoryState : null;
}

export async function saveSystemState(newState) {
    if (USE_POSTGRES) await PostgresAdapter.saveState(newState);
    memoryState = { ...newState, initialized: true };
}

export async function getTasks() {
    if (USE_POSTGRES) return await PostgresAdapter.getTasks();
    return memoryTasks;
}

export async function saveTask(task) {
    if (USE_POSTGRES) await PostgresAdapter.saveTask(task);
    const idx = memoryTasks.findIndex(t => t.id === task.id);
    if (idx >= 0) memoryTasks[idx] = task;
    else memoryTasks.push(task);
}

export async function getSkills() {
    if (USE_POSTGRES) {
        const dbSkills = await PostgresAdapter.getSkills();
        if (dbSkills) return dbSkills;
        if (memorySkills.length > 0) {
            for (const s of memorySkills) await PostgresAdapter.saveSkill(s);
            return memorySkills;
        }
    }
    return memorySkills;
}

export async function saveSkill(skill) {
    if (USE_POSTGRES) await PostgresAdapter.saveSkill(skill);
    const idx = memorySkills.findIndex(s => s.id === skill.id);
    if (idx >= 0) memorySkills[idx] = skill;
    else memorySkills.push(skill);
}

export async function getChatMessages(channelId) {
    if (USE_POSTGRES) return await PostgresAdapter.getChatMessages(channelId);
    if (channelId) return memoryChat.filter(m => m.channelId === channelId);
    return memoryChat;
}

export async function saveChatMessage(msg) {
    if (USE_POSTGRES) await PostgresAdapter.saveChatMessage(msg);
    memoryChat.push(msg);
}

export async function initStorage() {
    if (USE_POSTGRES) {
        await PostgresAdapter.init();
    }
}

export const isPersistent = !!USE_POSTGRES;
