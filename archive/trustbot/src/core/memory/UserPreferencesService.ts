/**
 * User Preferences Service
 *
 * Manages HITL user preferences including learned behaviors from Shadow Bot.
 * Supports both explicit preferences and auto-learned patterns.
 *
 * Epic: Aria Memory & Knowledge System
 * Phase 2: User Preferences
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
    UserPreferences,
    UserPreferencesInput,
    NotificationPreferences,
    LearnedPreferences,
    VerbosityLevel,
} from './types.js';

// ============================================================================
// User Preferences Service
// ============================================================================

export class UserPreferencesService {
    private supabase: SupabaseClient;
    private cache: Map<string, { prefs: UserPreferences; cachedAt: Date }> = new Map();
    private cacheMaxAgeMs = 5 * 60 * 1000; // 5 minutes

    constructor(supabaseUrl?: string, supabaseKey?: string) {
        const url = supabaseUrl || process.env.SUPABASE_URL;
        const key = supabaseKey || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error('Supabase URL and key are required');
        }

        this.supabase = createClient(url, key);
    }

    /**
     * Get or create user preferences
     */
    async getOrCreate(userId: string, orgId?: string): Promise<UserPreferences> {
        // Check cache first
        const cacheKey = `${userId}:${orgId || 'default'}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt.getTime() < this.cacheMaxAgeMs) {
            return cached.prefs;
        }

        // Use Supabase RPC function
        const { data, error } = await this.supabase.rpc('get_or_create_user_preferences', {
            p_user_id: userId,
            p_org_id: orgId || null,
        });

        if (error) {
            throw new Error(`Failed to get user preferences: ${error.message}`);
        }

        const prefs = this.mapToUserPreferences(data);

        // Update cache
        this.cache.set(cacheKey, { prefs, cachedAt: new Date() });

        return prefs;
    }

    /**
     * Get user preferences by ID
     */
    async getById(id: string): Promise<UserPreferences | null> {
        const { data, error } = await this.supabase
            .from('aria_user_preferences')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to get user preferences: ${error.message}`);
        }

        return this.mapToUserPreferences(data);
    }

    /**
     * Update user preferences
     */
    async update(
        userId: string,
        updates: Partial<UserPreferencesInput>
    ): Promise<UserPreferences> {
        const updateData: Record<string, any> = {};

        if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
        if (updates.preferredProvider !== undefined) updateData.preferred_provider = updates.preferredProvider;
        if (updates.voiceEnabled !== undefined) updateData.voice_enabled = updates.voiceEnabled;
        if (updates.verbosityLevel !== undefined) updateData.verbosity_level = updates.verbosityLevel;
        if (updates.notificationPreferences !== undefined) {
            updateData.notification_preferences = updates.notificationPreferences;
        }

        const { data, error } = await this.supabase
            .from('aria_user_preferences')
            .update(updateData)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update preferences: ${error.message}`);
        }

        const prefs = this.mapToUserPreferences(data);

        // Invalidate cache
        this.invalidateCache(userId);

        return prefs;
    }

    /**
     * Update notification preferences
     */
    async updateNotifications(
        userId: string,
        notifications: Partial<NotificationPreferences>
    ): Promise<UserPreferences> {
        // Get current preferences
        const current = await this.getOrCreate(userId);

        const updatedNotifications = {
            ...current.notificationPreferences,
            ...notifications,
        };

        const { data, error } = await this.supabase
            .from('aria_user_preferences')
            .update({ notification_preferences: updatedNotifications })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update notifications: ${error.message}`);
        }

        const prefs = this.mapToUserPreferences(data);
        this.invalidateCache(userId);

        return prefs;
    }

    /**
     * Update a learned preference (from Shadow Bot observation)
     */
    async updateLearnedPreference(
        userId: string,
        key: keyof LearnedPreferences | string,
        value: any
    ): Promise<void> {
        const { error } = await this.supabase.rpc('update_learned_preferences', {
            p_user_id: userId,
            p_key: key,
            p_value: JSON.stringify(value),
        });

        if (error) {
            throw new Error(`Failed to update learned preference: ${error.message}`);
        }

        this.invalidateCache(userId);
    }

    /**
     * Bulk update learned preferences
     */
    async updateLearnedPreferences(
        userId: string,
        preferences: Partial<LearnedPreferences>
    ): Promise<UserPreferences> {
        const current = await this.getOrCreate(userId);

        const updatedLearned = {
            ...current.learnedPreferences,
            ...preferences,
        };

        const { data, error } = await this.supabase
            .from('aria_user_preferences')
            .update({ learned_preferences: updatedLearned })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update learned preferences: ${error.message}`);
        }

        const prefs = this.mapToUserPreferences(data);
        this.invalidateCache(userId);

        return prefs;
    }

    /**
     * Record a user interaction
     */
    async recordInteraction(userId: string, sessionId: string): Promise<void> {
        const { error } = await this.supabase.rpc('increment_user_interaction', {
            p_user_id: userId,
            p_session_id: sessionId,
        });

        if (error) {
            throw new Error(`Failed to record interaction: ${error.message}`);
        }

        this.invalidateCache(userId);
    }

    /**
     * Record an approval/denial decision
     */
    async recordDecision(
        userId: string,
        approved: boolean
    ): Promise<void> {
        const column = approved ? 'total_approvals' : 'total_denials';

        const { error } = await this.supabase.rpc('exec', {
            sql: `
                UPDATE aria_user_preferences
                SET ${column} = ${column} + 1
                WHERE user_id = $1
            `,
            params: [userId],
        });

        // Fallback if RPC doesn't exist
        if (error) {
            const current = await this.getOrCreate(userId);
            const newCount = approved
                ? current.totalApprovals + 1
                : current.totalDenials + 1;

            await this.supabase
                .from('aria_user_preferences')
                .update({ [column]: newCount })
                .eq('user_id', userId);
        }

        this.invalidateCache(userId);
    }

    /**
     * Analyze user's approval tendency
     */
    async analyzeApprovalTendency(userId: string): Promise<{
        tendency: 'cautious' | 'moderate' | 'permissive';
        approvalRate: number;
        totalDecisions: number;
    }> {
        const prefs = await this.getOrCreate(userId);
        const totalDecisions = prefs.totalApprovals + prefs.totalDenials;

        if (totalDecisions === 0) {
            return {
                tendency: 'moderate',
                approvalRate: 0.5,
                totalDecisions: 0,
            };
        }

        const approvalRate = prefs.totalApprovals / totalDecisions;

        let tendency: 'cautious' | 'moderate' | 'permissive';
        if (approvalRate < 0.4) {
            tendency = 'cautious';
        } else if (approvalRate > 0.7) {
            tendency = 'permissive';
        } else {
            tendency = 'moderate';
        }

        return {
            tendency,
            approvalRate,
            totalDecisions,
        };
    }

    /**
     * Get all users for an organization
     */
    async getOrgUsers(orgId: string): Promise<UserPreferences[]> {
        const { data, error } = await this.supabase
            .from('aria_user_preferences')
            .select('*')
            .eq('org_id', orgId)
            .order('last_active_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get org users: ${error.message}`);
        }

        return data.map(this.mapToUserPreferences);
    }

    /**
     * Get most active users
     */
    async getMostActiveUsers(limit: number = 10): Promise<UserPreferences[]> {
        const { data, error } = await this.supabase
            .from('aria_user_preferences')
            .select('*')
            .order('total_interactions', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to get active users: ${error.message}`);
        }

        return data.map(this.mapToUserPreferences);
    }

    /**
     * Clear cache for a user
     */
    invalidateCache(userId: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear entire cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private mapToUserPreferences(row: any): UserPreferences {
        return {
            id: row.id,
            userId: row.user_id,
            orgId: row.org_id,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            preferredProvider: row.preferred_provider || 'claude',
            voiceEnabled: row.voice_enabled || false,
            voiceName: row.voice_name,
            verbosityLevel: row.verbosity_level || 'normal',
            notificationPreferences: row.notification_preferences || {
                approvals: true,
                alerts: true,
                agentUpdates: false,
                dailySummary: true,
            },
            learnedPreferences: row.learned_preferences || {},
            lastSessionId: row.last_session_id,
            lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
            totalInteractions: row.total_interactions || 0,
            totalApprovals: row.total_approvals || 0,
            totalDenials: row.total_denials || 0,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let userPreferencesInstance: UserPreferencesService | null = null;

export function getUserPreferencesService(): UserPreferencesService {
    if (!userPreferencesInstance) {
        userPreferencesInstance = new UserPreferencesService();
    }
    return userPreferencesInstance;
}

export function resetUserPreferencesService(): void {
    userPreferencesInstance = null;
}
