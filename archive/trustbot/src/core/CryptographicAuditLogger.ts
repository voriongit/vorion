/**
 * Cryptographic Audit Logger
 *
 * TRUST-2.2 through TRUST-2.5: Tamper-evident audit logging system.
 * Creates hash-chained audit entries for compliance and verification.
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { AuditEntry, AuditAction } from './SecurityLayer.js';
import type { AgentId, AgentTier } from '../types.js';
import type {
    CryptographicAuditEntry,
    AuditChainStatus,
    VerifyChainParams,
    EntryVerificationResult,
    ComplianceExport,
    ComplianceExportMetadata,
    ExportFormat,
    CryptoAuditLoggerConfig,
    ChainFailureType,
} from './types/audit.js';
import {
    GENESIS_HASH,
    EXPORT_FORMAT_VERSION,
    DEFAULT_CRYPTO_AUDIT_CONFIG,
} from './types/audit.js';

// ============================================================================
// Events
// ============================================================================

interface CryptoAuditEvents {
    'audit:entry-created': (entry: CryptographicAuditEntry) => void;
    'audit:chain-verified': (status: AuditChainStatus) => void;
    'audit:chain-broken': (status: AuditChainStatus) => void;
    'audit:exported': (metadata: ComplianceExportMetadata) => void;
}

// ============================================================================
// Cryptographic Audit Logger Class
// ============================================================================

export class CryptographicAuditLogger extends EventEmitter<CryptoAuditEvents> {
    private config: CryptoAuditLoggerConfig;
    private entries: CryptographicAuditEntry[] = [];
    private sequenceCounter: number = 0;
    private lastHash: string = GENESIS_HASH;

    constructor(config: Partial<CryptoAuditLoggerConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CRYPTO_AUDIT_CONFIG, ...config };
    }

    // -------------------------------------------------------------------------
    // TRUST-2.2: Hash Computation
    // -------------------------------------------------------------------------

    /**
     * Compute SHA-256 hash of an audit entry.
     * Uses deterministic JSON serialization to ensure consistent hashing.
     *
     * @param entry Entry to hash (without entryHash field)
     * @returns Lowercase hex hash string (64 characters)
     */
    private computeHash(entry: Omit<CryptographicAuditEntry, 'entryHash'>): string {
        // Create deterministic content string
        // Fields are ordered alphabetically for consistency
        const content = JSON.stringify({
            action: entry.action,
            actor: {
                id: entry.actor.id,
                tier: entry.actor.tier,
                type: entry.actor.type,
            },
            details: entry.details,
            id: entry.id,
            merkleRoot: entry.merkleRoot,
            outcome: entry.outcome,
            previousHash: entry.previousHash,
            reason: entry.reason,
            sequenceNumber: entry.sequenceNumber,
            target: entry.target ? {
                id: entry.target.id,
                type: entry.target.type,
            } : undefined,
            timestamp: entry.timestamp instanceof Date
                ? entry.timestamp.toISOString()
                : entry.timestamp,
        });

        return createHash(this.config.hashAlgorithm)
            .update(content)
            .digest('hex');
    }

    // -------------------------------------------------------------------------
    // TRUST-2.3: Chain-Linked Entry Logging
    // -------------------------------------------------------------------------

    /**
     * Log a new audit entry with cryptographic chain linkage.
     * Each entry is linked to the previous via hash.
     *
     * @param params Audit entry parameters (same as base AuditEntry)
     * @returns Complete CryptographicAuditEntry with hash
     */
    async logEntry(params: {
        action: AuditAction;
        actor: {
            type: 'HUMAN' | 'AGENT' | 'SYSTEM';
            id: string;
            tier?: AgentTier;
        };
        target?: {
            type: 'AGENT' | 'ENTRY' | 'SYSTEM';
            id: string;
        };
        details: Record<string, unknown>;
        outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
        reason?: string;
        merkleRoot?: string;
    }): Promise<CryptographicAuditEntry> {
        // Increment sequence counter
        this.sequenceCounter++;

        // Create entry without hash
        const entryWithoutHash: Omit<CryptographicAuditEntry, 'entryHash'> = {
            id: uuidv4(),
            timestamp: new Date(),
            action: params.action,
            actor: params.actor,
            target: params.target,
            details: params.details,
            outcome: params.outcome,
            reason: params.reason,
            sequenceNumber: this.sequenceCounter,
            previousHash: this.lastHash,
            merkleRoot: params.merkleRoot,
        };

        // Compute hash
        const entryHash = this.computeHash(entryWithoutHash);

        // Create complete entry
        const entry: CryptographicAuditEntry = {
            ...entryWithoutHash,
            entryHash,
        };

        // Update chain state
        this.lastHash = entryHash;

        // Persist (append-only)
        this.entries.push(entry);

        // Emit event
        this.emit('audit:entry-created', entry);

        // Auto-verify if configured
        if (this.config.autoVerifyBatchSize > 0 &&
            this.entries.length % this.config.autoVerifyBatchSize === 0) {
            await this.verifyChain();
        }

        return entry;
    }

    // -------------------------------------------------------------------------
    // TRUST-2.4: Chain Verification
    // -------------------------------------------------------------------------

    /**
     * Verify the integrity of the audit chain.
     * Checks that each entry's hash matches and chain links are valid.
     *
     * @param params Optional range and options for verification
     * @returns AuditChainStatus indicating validity
     */
    async verifyChain(params: VerifyChainParams = {}): Promise<AuditChainStatus> {
        const {
            startSequence = 1,
            endSequence = this.sequenceCounter,
            stopOnFirstError = true,
        } = params;

        const now = new Date();

        // Handle empty chain
        if (this.entries.length === 0) {
            const status: AuditChainStatus = {
                isValid: true,
                lastVerified: now,
                entriesVerified: 0,
            };
            this.emit('audit:chain-verified', status);
            return status;
        }

        // Filter entries in range
        const entriesToVerify = this.entries.filter(
            e => e.sequenceNumber >= startSequence && e.sequenceNumber <= endSequence
        ).sort((a, b) => a.sequenceNumber - b.sequenceNumber);

        let entriesVerified = 0;
        let previousHash = startSequence === 1 ? GENESIS_HASH : null;

        // Find previous hash if starting mid-chain
        if (previousHash === null) {
            const prevEntry = this.entries.find(e => e.sequenceNumber === startSequence - 1);
            if (prevEntry) {
                previousHash = prevEntry.entryHash;
            } else {
                // Can't verify - missing prior entry
                const status: AuditChainStatus = {
                    isValid: false,
                    lastVerified: now,
                    entriesVerified: 0,
                    brokenAt: startSequence,
                    error: `Missing entry at sequence ${startSequence - 1}`,
                    failureType: 'MISSING_ENTRY',
                };
                this.emit('audit:chain-broken', status);
                return status;
            }
        }

        for (const entry of entriesToVerify) {
            // Check for sequence gaps
            if (entry.sequenceNumber !== startSequence + entriesVerified) {
                const expectedSeq = startSequence + entriesVerified;
                const status: AuditChainStatus = {
                    isValid: false,
                    lastVerified: now,
                    entriesVerified,
                    brokenAt: expectedSeq,
                    error: `Missing entry at sequence ${expectedSeq}`,
                    failureType: 'MISSING_ENTRY',
                };
                this.emit('audit:chain-broken', status);
                if (stopOnFirstError) return status;
            }

            // Verify chain link (previousHash matches)
            if (entry.previousHash !== previousHash) {
                const status: AuditChainStatus = {
                    isValid: false,
                    lastVerified: now,
                    entriesVerified,
                    brokenAt: entry.sequenceNumber,
                    error: `Chain break at sequence ${entry.sequenceNumber}: previousHash mismatch`,
                    failureType: 'CHAIN_BREAK',
                };
                this.emit('audit:chain-broken', status);
                if (stopOnFirstError) return status;
            }

            // Verify entry hash
            const { entryHash, ...entryWithoutHash } = entry;
            const recomputedHash = this.computeHash(entryWithoutHash);

            if (recomputedHash !== entryHash) {
                const status: AuditChainStatus = {
                    isValid: false,
                    lastVerified: now,
                    entriesVerified,
                    brokenAt: entry.sequenceNumber,
                    error: `Tampered entry at sequence ${entry.sequenceNumber}: hash mismatch`,
                    failureType: 'HASH_MISMATCH',
                };
                this.emit('audit:chain-broken', status);
                if (stopOnFirstError) return status;
            }

            // Check genesis rule
            if (entry.sequenceNumber === 1 && entry.previousHash !== GENESIS_HASH) {
                const status: AuditChainStatus = {
                    isValid: false,
                    lastVerified: now,
                    entriesVerified,
                    brokenAt: 1,
                    error: 'First entry does not have GENESIS previousHash',
                    failureType: 'GENESIS_VIOLATION',
                };
                this.emit('audit:chain-broken', status);
                if (stopOnFirstError) return status;
            }

            // Entry verified
            previousHash = entryHash;
            entriesVerified++;
        }

        const status: AuditChainStatus = {
            isValid: true,
            lastVerified: now,
            entriesVerified,
        };

        this.emit('audit:chain-verified', status);
        return status;
    }

    /**
     * Verify a single entry and return detailed result.
     */
    verifyEntry(sequenceNumber: number): EntryVerificationResult | null {
        const entry = this.entries.find(e => e.sequenceNumber === sequenceNumber);
        if (!entry) return null;

        const { entryHash, ...entryWithoutHash } = entry;
        const expectedHash = this.computeHash(entryWithoutHash);

        return {
            sequenceNumber,
            isValid: expectedHash === entryHash,
            expectedHash,
            actualHash: entryHash,
            error: expectedHash !== entryHash ? 'Hash mismatch - entry may be tampered' : undefined,
        };
    }

    // -------------------------------------------------------------------------
    // TRUST-2.5: Compliance Export
    // -------------------------------------------------------------------------

    /**
     * Export audit log for compliance in specified format.
     *
     * @param startDate Start of date range
     * @param endDate End of date range
     * @param format Export format (json or csv)
     * @returns Formatted export string
     */
    async exportForCompliance(
        startDate: Date,
        endDate: Date,
        format: ExportFormat = 'json',
        exportedBy: string = 'SYSTEM'
    ): Promise<string> {
        // Filter entries by date range
        const filteredEntries = this.entries.filter(
            e => e.timestamp >= startDate && e.timestamp <= endDate
        );

        // Verify chain integrity
        const chainStatus = await this.verifyChain();

        // Build metadata
        const metadata: ComplianceExportMetadata = {
            exportDate: new Date(),
            exportedBy,
            rangeStart: startDate,
            rangeEnd: endDate,
            entryCount: filteredEntries.length,
            chainStatus,
            formatVersion: EXPORT_FORMAT_VERSION,
        };

        this.emit('audit:exported', metadata);

        if (format === 'csv') {
            return this.formatAsCsv(filteredEntries, metadata);
        }

        // JSON format
        const exportData: ComplianceExport = {
            metadata,
            entries: filteredEntries,
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Format entries as CSV.
     */
    private formatAsCsv(
        entries: CryptographicAuditEntry[],
        metadata: ComplianceExportMetadata
    ): string {
        const headers = [
            'sequenceNumber',
            'id',
            'timestamp',
            'action',
            'actorType',
            'actorId',
            'actorTier',
            'targetType',
            'targetId',
            'outcome',
            'reason',
            'previousHash',
            'entryHash',
        ];

        const rows = entries.map(entry => [
            entry.sequenceNumber,
            entry.id,
            entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
            entry.action,
            entry.actor.type,
            entry.actor.id,
            entry.actor.tier ?? '',
            entry.target?.type ?? '',
            entry.target?.id ?? '',
            entry.outcome,
            entry.reason ?? '',
            entry.previousHash,
            entry.entryHash,
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

        // Add metadata as comment header
        const metadataHeader = [
            `# Compliance Export`,
            `# Export Date: ${metadata.exportDate.toISOString()}`,
            `# Range: ${metadata.rangeStart.toISOString()} to ${metadata.rangeEnd.toISOString()}`,
            `# Entry Count: ${metadata.entryCount}`,
            `# Chain Valid: ${metadata.chainStatus.isValid}`,
            `# Format Version: ${metadata.formatVersion}`,
            '',
        ].join('\n');

        return metadataHeader + headers.join(',') + '\n' + rows.join('\n');
    }

    // -------------------------------------------------------------------------
    // Query Methods
    // -------------------------------------------------------------------------

    /**
     * Get entries by action type.
     */
    getEntriesByAction(action: AuditAction): CryptographicAuditEntry[] {
        return this.entries.filter(e => e.action === action);
    }

    /**
     * Get entries by actor.
     */
    getEntriesByActor(actorId: string): CryptographicAuditEntry[] {
        return this.entries.filter(e => e.actor.id === actorId);
    }

    /**
     * Get entries since a date.
     */
    getEntriesSince(since: Date): CryptographicAuditEntry[] {
        return this.entries.filter(e => e.timestamp >= since);
    }

    /**
     * Get entry by sequence number.
     */
    getEntryBySequence(sequenceNumber: number): CryptographicAuditEntry | undefined {
        return this.entries.find(e => e.sequenceNumber === sequenceNumber);
    }

    /**
     * Get all entries.
     */
    getAllEntries(): CryptographicAuditEntry[] {
        return [...this.entries];
    }

    /**
     * Get current sequence number.
     */
    getCurrentSequence(): number {
        return this.sequenceCounter;
    }

    /**
     * Get last hash in the chain.
     */
    getLastHash(): string {
        return this.lastHash;
    }

    // -------------------------------------------------------------------------
    // Migration Support
    // -------------------------------------------------------------------------

    /**
     * Import legacy audit entries and add cryptographic hashes.
     * Used when migrating from non-crypto audit log.
     *
     * @param legacyEntries Existing audit entries without hashes
     */
    async migrateFromLegacy(legacyEntries: AuditEntry[]): Promise<{
        success: boolean;
        entriesMigrated: number;
        failures: Array<{ entryId: string; error: string }>;
    }> {
        const failures: Array<{ entryId: string; error: string }> = [];
        let entriesMigrated = 0;

        // Sort by timestamp to maintain order
        const sorted = [...legacyEntries].sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );

        for (const legacy of sorted) {
            try {
                await this.logEntry({
                    action: legacy.action,
                    actor: legacy.actor,
                    target: legacy.target,
                    details: legacy.details,
                    outcome: legacy.outcome,
                    reason: legacy.reason,
                });
                entriesMigrated++;
            } catch (error) {
                failures.push({
                    entryId: legacy.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return {
            success: failures.length === 0,
            entriesMigrated,
            failures,
        };
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /**
     * Get current configuration.
     */
    getConfig(): CryptoAuditLoggerConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    setConfig(config: Partial<CryptoAuditLoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get statistics.
     */
    getStats(): {
        totalEntries: number;
        currentSequence: number;
        chainIntact: boolean;
        lastEntryTime: Date | null;
    } {
        const lastEntry = this.entries[this.entries.length - 1];

        return {
            totalEntries: this.entries.length,
            currentSequence: this.sequenceCounter,
            chainIntact: true, // Assume intact; use verifyChain for definitive answer
            lastEntryTime: lastEntry?.timestamp ?? null,
        };
    }
}

// Singleton instance
export const cryptographicAuditLogger = new CryptographicAuditLogger();
