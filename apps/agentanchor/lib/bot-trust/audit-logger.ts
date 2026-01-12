/**
 * Audit Logger - Immutable audit trail with cryptographic hash chain
 *
 * Each audit entry is cryptographically linked to the previous entry,
 * creating a tamper-evident chain similar to blockchain.
 */

import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';
import logger from '@/lib/logger';

export enum AuditEventType {
  DECISION_MADE = 'decision_made',
  DECISION_APPROVED = 'decision_approved',
  DECISION_REJECTED = 'decision_rejected',
  DECISION_MODIFIED = 'decision_modified',
  AUTONOMY_PROGRESSED = 'autonomy_progressed',
  AUTONOMY_DEMOTED = 'autonomy_demoted',
  TRUST_SCORE_CALCULATED = 'trust_score_calculated',
  POLICY_VIOLATION = 'policy_violation',
  ESCALATION = 'escalation',
  BOT_CREATED = 'bot_created',
  BOT_DELETED = 'bot_deleted',
  TRAINING_COMPLETED = 'training_completed',
}

interface AuditEntry {
  id?: string;
  bot_id: string;
  event_type: AuditEventType;
  event_data: Record<string, any>;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  previous_hash?: string;
  hash?: string;
  created_at?: Date;
}

export class AuditLogger {
  private supabase;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Generate SHA-256 hash for an audit entry
   */
  private generateHash(entry: AuditEntry): string {
    const dataString = JSON.stringify({
      bot_id: entry.bot_id,
      event_type: entry.event_type,
      event_data: entry.event_data,
      user_id: entry.user_id,
      timestamp: entry.created_at?.toISOString() || new Date().toISOString(),
      previous_hash: entry.previous_hash || '',
    });

    return CryptoJS.SHA256(dataString).toString();
  }

  /**
   * Get the last audit entry hash for a bot
   */
  private async getLastHash(botId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('bot_audit_log')
        .select('hash')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return data.hash;
    } catch (error) {
      return null;
    }
  }

  /**
   * Log an audit event with cryptographic chaining
   */
  async logEvent(
    botId: string,
    eventType: AuditEventType,
    eventData: Record<string, any>,
    context?: {
      user_id?: string;
      ip_address?: string;
      user_agent?: string;
    }
  ): Promise<void> {
    try {
      // Get previous hash for chaining
      const previousHash = await this.getLastHash(botId);

      // Create entry with timestamp
      const entry: AuditEntry = {
        bot_id: botId,
        event_type: eventType,
        event_data: eventData,
        user_id: context?.user_id,
        ip_address: context?.ip_address,
        user_agent: context?.user_agent,
        previous_hash: previousHash || undefined,
        created_at: new Date(),
      };

      // Generate hash
      entry.hash = this.generateHash(entry);

      // Store in database
      const { error } = await this.supabase.from('bot_audit_log').insert({
        bot_id: entry.bot_id,
        event_type: entry.event_type,
        event_data: entry.event_data,
        user_id: entry.user_id,
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        previous_hash: entry.previous_hash,
        hash: entry.hash,
      });

      if (error) throw error;

      logger.info('audit_event_logged', {
        bot_id: botId,
        event_type: eventType,
        hash: entry.hash,
      });
    } catch (error) {
      logger.error('audit_event_failed', { error, botId, eventType });
      throw new Error(`Failed to log audit event: ${error}`);
    }
  }

  /**
   * Verify the integrity of the audit chain
   */
  async verifyChain(botId: string): Promise<{
    valid: boolean;
    total_entries: number;
    first_invalid_entry?: string;
    error?: string;
  }> {
    try {
      // Get all audit entries for bot in chronological order
      const { data: entries, error } = await this.supabase
        .from('bot_audit_log')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!entries || entries.length === 0) {
        return {
          valid: true,
          total_entries: 0,
        };
      }

      // Verify each entry's hash and chain
      let previousHash: string | null = null;

      for (const entry of entries) {
        // Check if previous_hash matches
        if (entry.previous_hash !== previousHash) {
          return {
            valid: false,
            total_entries: entries.length,
            first_invalid_entry: entry.id,
            error: 'Chain broken: previous_hash mismatch',
          };
        }

        // Verify the entry's hash
        const calculatedHash = this.generateHash({
          bot_id: entry.bot_id,
          event_type: entry.event_type,
          event_data: entry.event_data,
          user_id: entry.user_id,
          previous_hash: entry.previous_hash,
          created_at: new Date(entry.created_at),
        });

        if (calculatedHash !== entry.hash) {
          return {
            valid: false,
            total_entries: entries.length,
            first_invalid_entry: entry.id,
            error: 'Hash verification failed: entry has been tampered',
          };
        }

        previousHash = entry.hash;
      }

      return {
        valid: true,
        total_entries: entries.length,
      };
    } catch (error) {
      logger.error('verify_chain_failed', { error, botId });
      return {
        valid: false,
        total_entries: 0,
        error: `Verification failed: ${error}`,
      };
    }
  }

  /**
   * Get audit history for a bot
   */
  async getAuditHistory(
    botId: string,
    options?: {
      limit?: number;
      offset?: number;
      event_type?: AuditEventType;
      start_date?: Date;
      end_date?: Date;
    }
  ): Promise<AuditEntry[]> {
    try {
      let query = this.supabase
        .from('bot_audit_log')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false });

      if (options?.event_type) {
        query = query.eq('event_type', options.event_type);
      }

      if (options?.start_date) {
        query = query.gte('created_at', options.start_date.toISOString());
      }

      if (options?.end_date) {
        query = query.lte('created_at', options.end_date.toISOString());
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 10) - 1
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('get_audit_history_failed', { error, botId });
      throw new Error(`Failed to get audit history: ${error}`);
    }
  }

  /**
   * Get audit statistics for a bot
   */
  async getAuditStats(
    botId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total_events: number;
    events_by_type: Record<AuditEventType, number>;
    timeline: Array<{ date: string; count: number }>;
  }> {
    try {
      let query = this.supabase
        .from('bot_audit_log')
        .select('event_type, created_at')
        .eq('bot_id', botId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats = {
        total_events: data?.length || 0,
        events_by_type: {} as Record<AuditEventType, number>,
        timeline: [] as Array<{ date: string; count: number }>,
      };

      // Count by event type
      data?.forEach((entry) => {
        const type = entry.event_type as AuditEventType;
        stats.events_by_type[type] = (stats.events_by_type[type] || 0) + 1;
      });

      // Build timeline (group by date)
      const timelineMap: Record<string, number> = {};
      data?.forEach((entry) => {
        const date = new Date(entry.created_at).toISOString().split('T')[0];
        timelineMap[date] = (timelineMap[date] || 0) + 1;
      });

      stats.timeline = Object.entries(timelineMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return stats;
    } catch (error) {
      logger.error('get_audit_stats_failed', { error, botId });
      throw new Error(`Failed to get audit stats: ${error}`);
    }
  }

  /**
   * Export audit log to JSON (for compliance/archival)
   */
  async exportAuditLog(
    botId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    try {
      const entries = await this.getAuditHistory(botId, {
        start_date: startDate,
        end_date: endDate,
        limit: 10000, // Large limit for export
      });

      const verification = await this.verifyChain(botId);

      const exportData = {
        bot_id: botId,
        exported_at: new Date().toISOString(),
        total_entries: entries.length,
        chain_verified: verification.valid,
        verification_details: verification,
        entries: entries,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      logger.error('export_audit_log_failed', { error, botId });
      throw new Error(`Failed to export audit log: ${error}`);
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
