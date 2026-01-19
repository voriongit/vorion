/**
 * Supabase Persistence Layer
 *
 * Production-ready persistence using Supabase (Postgres + Realtime)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export interface Agent {
    id: string;
    name: string;
    type: string;
    tier: number;
    status: string;
    trust_score: number;
    floor: string;
    room: string;
    capabilities: string[];
    skills: string[];
    parent_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: string;
    description: string;
    status: string;
    priority: string;
    requester: string;
    assigned_to: string | null;
    delegation_chain: string[];
    result: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
}

export interface BlackboardEntry {
    id: string;
    type: string;
    title: string;
    content: string | null;
    author: string;
    priority: string;
    status: string;
    parent_id: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
}

export interface Approval {
    id: string;
    task_id: string | null;
    agent_id: string;
    action: string;
    reason: string | null;
    priority: string;
    status: string;
    approved_by: string | null;
    approved_at: string | null;
    created_at: string;
    expires_at: string | null;
}

interface SupabaseEvents {
    'connected': () => void;
    'disconnected': () => void;
    'error': (error: Error) => void;
    'agent:insert': (agent: Agent) => void;
    'agent:update': (agent: Agent) => void;
    'agent:delete': (agent: Agent) => void;
    'task:insert': (task: Task) => void;
    'task:update': (task: Task) => void;
    'approval:insert': (approval: Approval) => void;
    'approval:update': (approval: Approval) => void;
}

// ============================================================================
// Supabase Persistence Layer
// ============================================================================

export class SupabasePersistence extends EventEmitter<SupabaseEvents> {
    private client: SupabaseClient;
    private isConnected: boolean = false;

    constructor(supabaseUrl: string, supabaseKey: string) {
        super();

        this.client = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
            },
            db: {
                schema: 'public',
            },
        });
    }

    /**
     * Get the underlying Supabase client for health checks
     */
    getClient(): SupabaseClient {
        return this.client;
    }

    // -------------------------------------------------------------------------
    // Connection & Realtime
    // -------------------------------------------------------------------------

    async connect(): Promise<boolean> {
        try {
            // Test connection with a simple query to artifacts table
            const { error } = await this.client.from('artifacts').select('id').limit(1);

            // PGRST116 means table exists but no rows - that's fine
            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            this.isConnected = true;
            this.emit('connected');

            // Set up realtime subscriptions
            this.setupRealtimeSubscriptions();

            return true;
        } catch (error) {
            this.emit('error', error as Error);
            return false;
        }
    }

    private setupRealtimeSubscriptions(): void {
        // Subscribe to agents changes
        this.client
            .channel('agents-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, (payload) => {
                const agent = payload.new as Agent;
                if (payload.eventType === 'INSERT') this.emit('agent:insert', agent);
                if (payload.eventType === 'UPDATE') this.emit('agent:update', agent);
                if (payload.eventType === 'DELETE') this.emit('agent:delete', payload.old as Agent);
            })
            .subscribe();

        // Subscribe to tasks changes
        this.client
            .channel('tasks-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
                const task = payload.new as Task;
                if (payload.eventType === 'INSERT') this.emit('task:insert', task);
                if (payload.eventType === 'UPDATE') this.emit('task:update', task);
            })
            .subscribe();

        // Subscribe to approvals changes
        this.client
            .channel('approvals-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, (payload) => {
                const approval = payload.new as Approval;
                if (payload.eventType === 'INSERT') this.emit('approval:insert', approval);
                if (payload.eventType === 'UPDATE') this.emit('approval:update', approval);
            })
            .subscribe();
    }

    disconnect(): void {
        this.client.removeAllChannels();
        this.isConnected = false;
        this.emit('disconnected');
    }

    // -------------------------------------------------------------------------
    // Agents
    // -------------------------------------------------------------------------

    async getAgents(): Promise<Agent[]> {
        const { data, error } = await this.client
            .from('agents')
            .select('*')
            .order('tier', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async getAgent(id: string): Promise<Agent | null> {
        const { data, error } = await this.client
            .from('agents')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async createAgent(agent: Omit<Agent, 'created_at' | 'updated_at'>): Promise<Agent> {
        const { data, error } = await this.client
            .from('agents')
            .insert(agent)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
        const { data, error } = await this.client
            .from('agents')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async deleteAgent(id: string, deletedBy: string = '9901'): Promise<{ success: boolean; archived: boolean }> {
        // Get agent data before deletion for archiving
        const agent = await this.getAgent(id);
        if (!agent) {
            throw new Error(`Agent ${id} not found`);
        }

        // Archive to deleted_agents table
        try {
            await this.client
                .from('deleted_agents')
                .insert({
                    ...agent,
                    deleted_at: new Date().toISOString(),
                    deleted_by: deletedBy,
                });
        } catch (archiveError) {
            // Table might not exist, log but continue with deletion
            console.warn('Could not archive agent (table may not exist):', archiveError);
        }

        // Delete from active agents
        const { error } = await this.client
            .from('agents')
            .delete()
            .eq('id', id);

        if (error) throw error;

        console.log(`🗑️ Agent ${agent.name} (${id}) archived and deleted by ${deletedBy}`);
        return { success: true, archived: true };
    }

    async updateTrustScore(id: string, score: number, reason?: string): Promise<void> {
        const agent = await this.getAgent(id);
        if (!agent) throw new Error(`Agent ${id} not found`);

        const tier = this.calculateTier(score);
        const delta = score - agent.trust_score;

        // Update agent
        await this.client
            .from('agents')
            .update({ trust_score: score, tier, updated_at: new Date().toISOString() })
            .eq('id', id);

        // Record history
        await this.client
            .from('trust_scores')
            .insert({
                agent_id: id,
                score,
                tier,
                reason,
                delta,
            });
    }

    private calculateTier(score: number): number {
        if (score >= 900) return 5;
        if (score >= 750) return 4;
        if (score >= 550) return 3;
        if (score >= 350) return 2;
        if (score >= 150) return 1;
        return 0;
    }

    // -------------------------------------------------------------------------
    // Tasks
    // -------------------------------------------------------------------------

    async getTasks(status?: string): Promise<Task[]> {
        let query = this.client.from('tasks').select('*').order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async getTask(id: string): Promise<Task | null> {
        const { data, error } = await this.client
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async createTask(task: Omit<Task, 'created_at' | 'started_at' | 'completed_at'>): Promise<Task> {
        const { data, error } = await this.client
            .from('tasks')
            .insert(task)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
        const { data, error } = await this.client
            .from('tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async assignTask(taskId: string, agentId: string): Promise<Task> {
        return this.updateTask(taskId, {
            assigned_to: agentId,
            status: 'IN_PROGRESS',
            started_at: new Date().toISOString(),
        });
    }

    async completeTask(taskId: string, result: string): Promise<Task> {
        return this.updateTask(taskId, {
            status: 'COMPLETED',
            result,
            completed_at: new Date().toISOString(),
        });
    }

    async getCompletedToday(): Promise<Task[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await this.client
            .from('tasks')
            .select('*')
            .in('status', ['COMPLETED', 'FAILED'])
            .gte('completed_at', today.toISOString())
            .order('completed_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    // -------------------------------------------------------------------------
    // Blackboard
    // -------------------------------------------------------------------------

    async getBlackboardEntries(type?: string): Promise<BlackboardEntry[]> {
        let query = this.client.from('blackboard_entries').select('*').order('created_at', { ascending: false });

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async createBlackboardEntry(entry: Omit<BlackboardEntry, 'created_at' | 'updated_at' | 'resolved_at'>): Promise<BlackboardEntry> {
        const { data, error } = await this.client
            .from('blackboard_entries')
            .insert(entry)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateBlackboardEntry(id: string, updates: Partial<BlackboardEntry>): Promise<BlackboardEntry> {
        const { data, error } = await this.client
            .from('blackboard_entries')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // -------------------------------------------------------------------------
    // Approvals (HITL)
    // -------------------------------------------------------------------------

    async getPendingApprovals(): Promise<Approval[]> {
        const { data, error } = await this.client
            .from('approvals')
            .select('*')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async createApproval(approval: Omit<Approval, 'created_at' | 'approved_at'>): Promise<Approval> {
        const { data, error } = await this.client
            .from('approvals')
            .insert(approval)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async resolveApproval(id: string, approved: boolean, approvedBy: string): Promise<Approval> {
        const { data, error } = await this.client
            .from('approvals')
            .update({
                status: approved ? 'APPROVED' : 'REJECTED',
                approved_by: approvedBy,
                approved_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // -------------------------------------------------------------------------
    // System Config
    // -------------------------------------------------------------------------

    async getConfig<T>(key: string): Promise<T | null> {
        const { data, error } = await this.client
            .from('system_config')
            .select('value')
            .eq('key', key)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data?.value ?? null;
    }

    async setConfig<T>(key: string, value: T): Promise<void> {
        const { error } = await this.client
            .from('system_config')
            .upsert({ key, value, updated_at: new Date().toISOString() });

        if (error) throw error;
    }

    async getHITLLevel(): Promise<number> {
        const level = await this.getConfig<number>('hitl_level');
        return level ?? 100;
    }

    async setHITLLevel(level: number): Promise<void> {
        await this.setConfig('hitl_level', level);
    }

    // -------------------------------------------------------------------------
    // Audit Log
    // -------------------------------------------------------------------------

    async logAudit(entry: {
        event_type: string;
        actor: string;
        target?: string;
        action: string;
        details?: Record<string, unknown>;
        ip_address?: string;
    }): Promise<void> {
        const { error } = await this.client.from('audit_log').insert(entry);
        if (error) throw error;
    }

    async getAuditLog(limit: number = 100): Promise<unknown[]> {
        const { data, error } = await this.client
            .from('audit_log')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------

    async getStats(): Promise<{
        totalAgents: number;
        avgTrust: number;
        pendingTasks: number;
        completedToday: number;
    }> {
        const [agents, tasks, completed] = await Promise.all([
            this.getAgents(),
            this.getTasks('PENDING'),
            this.getCompletedToday(),
        ]);

        const avgTrust = agents.length > 0
            ? Math.round(agents.reduce((sum, a) => sum + a.trust_score, 0) / agents.length)
            : 0;

        return {
            totalAgents: agents.length,
            avgTrust,
            pendingTasks: tasks.length,
            completedToday: completed.length,
        };
    }
}

// ============================================================================
// Factory function
// ============================================================================

let instance: SupabasePersistence | null = null;

export function getSupabasePersistence(): SupabasePersistence {
    if (!instance) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
        }

        instance = new SupabasePersistence(url, key);
    }
    return instance;
}

export function hasSupabaseConfig(): boolean {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
