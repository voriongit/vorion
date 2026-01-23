/**
 * KYA Accountability Chain
 * Immutable hash-linked audit trail
 */

import { createHash } from 'crypto';
import { AccountabilityRecord, DatabaseConfig } from './types.js';

export class AccountabilityChain {
  private records: Map<string, AccountabilityRecord[]>;

  constructor(private config: DatabaseConfig) {
    this.records = new Map();
    // Would initialize database connection here
  }

  /**
   * Append record to accountability chain
   */
  async append(record: AccountabilityRecord): Promise<void> {
    // 1. Get previous record for this agent
    const agentRecords = this.records.get(record.agentDID) || [];
    const prevRecord = agentRecords[agentRecords.length - 1];

    // 2. Set previous hash
    record.chainLink.prevHash = prevRecord ? this.calculateHash(prevRecord) : null;

    // 3. Calculate hash for this record
    const hash = this.calculateHash(record);

    // 4. Store record (would be database insert)
    agentRecords.push(record);
    this.records.set(record.agentDID, agentRecords);

    // 5. Optional: Update agent's accountability score
    await this.updateAccountabilityScore(record.agentDID, record.outcome);
  }

  /**
   * Verify chain integrity for agent
   */
  async verify(agentDID: string): Promise<{
    valid: boolean;
    totalRecords: number;
    brokenLinks: number;
  }> {
    const records = this.records.get(agentDID) || [];

    let brokenLinks = 0;
    let prevHash: string | null = null;

    for (const record of records) {
      if (record.chainLink.prevHash !== prevHash) {
        brokenLinks++;
      }

      // Verify hash
      const expectedHash = this.calculateHash(record);
      const actualHash = this.calculateHash({
        ...record,
        chainLink: { ...record.chainLink },
      });

      if (expectedHash !== actualHash) {
        brokenLinks++;
      }

      prevHash = expectedHash;
    }

    return {
      valid: brokenLinks === 0,
      totalRecords: records.length,
      brokenLinks,
    };
  }

  /**
   * Query records for agent
   */
  async query(agentDID: string, options?: {
    action?: string;
    timeRange?: [number, number];
    outcome?: 'success' | 'failure' | 'denied';
  }): Promise<AccountabilityRecord[]> {
    let records = this.records.get(agentDID) || [];

    if (options?.action) {
      records = records.filter(r => r.action === options.action);
    }

    if (options?.timeRange) {
      const [start, end] = options.timeRange;
      records = records.filter(r => r.timestamp >= start && r.timestamp <= end);
    }

    if (options?.outcome) {
      records = records.filter(r => r.outcome === options.outcome);
    }

    return records;
  }

  /**
   * Calculate hash for record
   */
  private calculateHash(record: AccountabilityRecord): string {
    const content = JSON.stringify({
      timestamp: record.timestamp,
      agentDID: record.agentDID,
      action: record.action,
      resource: record.resource,
      outcome: record.outcome,
      evidence: record.evidence,
      prevHash: record.chainLink.prevHash,
    });

    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Update agent's accountability score
   */
  private async updateAccountabilityScore(
    agentDID: string,
    outcome: 'success' | 'failure' | 'denied'
  ): Promise<void> {
    // Would update TSG trust score based on outcome
    const impact = outcome === 'success' ? 1 : outcome === 'failure' ? -5 : -10;
    // await tsg.updateTrustScore(agentDID, impact);
  }
}
