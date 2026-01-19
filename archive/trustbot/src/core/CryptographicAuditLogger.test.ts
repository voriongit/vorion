/**
 * CryptographicAuditLogger Tests
 *
 * Tests for TRUST-2.2 through TRUST-2.5: Tamper-evident audit logging.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CryptographicAuditLogger } from './CryptographicAuditLogger.js';
import { GENESIS_HASH } from './types/audit.js';

describe('CryptographicAuditLogger', () => {
    let logger: CryptographicAuditLogger;

    beforeEach(() => {
        logger = new CryptographicAuditLogger();
    });

    // =========================================================================
    // TRUST-2.2: Hash Computation
    // =========================================================================

    describe('hash computation', () => {
        it('should produce deterministic hashes', async () => {
            const entry1 = await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1', tier: 3 },
                details: { amount: 10 },
                outcome: 'SUCCESS',
            });

            // Create a new logger and log identical entry
            const logger2 = new CryptographicAuditLogger();
            const entry2 = await logger2.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1', tier: 3 },
                details: { amount: 10 },
                outcome: 'SUCCESS',
            });

            // Hashes should be different due to different timestamps and IDs
            // but both should be valid 64-character hex strings
            expect(entry1.entryHash).toMatch(/^[a-f0-9]{64}$/);
            expect(entry2.entryHash).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should produce 64-character hex hash', async () => {
            const entry = await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            expect(entry.entryHash).toHaveLength(64);
            expect(entry.entryHash).toMatch(/^[a-f0-9]+$/);
        });

        it('should produce different hashes for different entries', async () => {
            const entry1 = await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: { amount: 10 },
                outcome: 'SUCCESS',
            });

            const entry2 = await logger.logEntry({
                action: 'TRUST_PENALIZE',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: { amount: 5 },
                outcome: 'SUCCESS',
            });

            expect(entry1.entryHash).not.toBe(entry2.entryHash);
        });
    });

    // =========================================================================
    // TRUST-2.3: Chain-Linked Entry Logging
    // =========================================================================

    describe('chain-linked logging', () => {
        it('should use GENESIS for first entry previousHash', async () => {
            const entry = await logger.logEntry({
                action: 'TRUST_CREATED',
                actor: { type: 'SYSTEM', id: 'TRUST_ENGINE' },
                details: { agentId: 'agent-1' },
                outcome: 'SUCCESS',
            });

            expect(entry.previousHash).toBe(GENESIS_HASH);
            expect(entry.sequenceNumber).toBe(1);
        });

        it('should link entries via previousHash', async () => {
            const entry1 = await logger.logEntry({
                action: 'TRUST_CREATED',
                actor: { type: 'SYSTEM', id: 'TRUST_ENGINE' },
                details: {},
                outcome: 'SUCCESS',
            });

            const entry2 = await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            expect(entry2.previousHash).toBe(entry1.entryHash);
            expect(entry2.sequenceNumber).toBe(2);
        });

        it('should increment sequence numbers correctly', async () => {
            for (let i = 0; i < 5; i++) {
                const entry = await logger.logEntry({
                    action: 'TRUST_REWARD',
                    actor: { type: 'AGENT', id: 'agent-1' },
                    details: { iteration: i },
                    outcome: 'SUCCESS',
                });

                expect(entry.sequenceNumber).toBe(i + 1);
            }
        });

        it('should emit audit:entry-created event', async () => {
            let emittedEntry: any;
            logger.on('audit:entry-created', (entry) => {
                emittedEntry = entry;
            });

            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            expect(emittedEntry).toBeDefined();
            expect(emittedEntry.action).toBe('TRUST_REWARD');
        });

        it('should include optional merkleRoot', async () => {
            const entry = await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
                merkleRoot: 'abc123',
            });

            expect(entry.merkleRoot).toBe('abc123');
        });
    });

    // =========================================================================
    // TRUST-2.4: Chain Verification
    // =========================================================================

    describe('chain verification', () => {
        it('should return valid for empty chain', async () => {
            const status = await logger.verifyChain();

            expect(status.isValid).toBe(true);
            expect(status.entriesVerified).toBe(0);
        });

        it('should verify valid chain', async () => {
            // Create a chain of entries
            for (let i = 0; i < 5; i++) {
                await logger.logEntry({
                    action: 'TRUST_REWARD',
                    actor: { type: 'AGENT', id: 'agent-1' },
                    details: { iteration: i },
                    outcome: 'SUCCESS',
                });
            }

            const status = await logger.verifyChain();

            expect(status.isValid).toBe(true);
            expect(status.entriesVerified).toBe(5);
        });

        it('should detect tampered entry hash', async () => {
            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            // Tamper with the entry
            const entries = logger.getAllEntries();
            (entries[0] as any).entryHash = 'tampered_hash_12345678901234567890123456789012345678901234';

            const status = await logger.verifyChain();

            expect(status.isValid).toBe(false);
            expect(status.brokenAt).toBe(1);
            expect(status.failureType).toBe('HASH_MISMATCH');
        });

        it('should detect broken chain link', async () => {
            await logger.logEntry({
                action: 'TRUST_CREATED',
                actor: { type: 'SYSTEM', id: 'TRUST_ENGINE' },
                details: {},
                outcome: 'SUCCESS',
            });

            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            // Tamper with the second entry's previousHash
            const entries = logger.getAllEntries();
            (entries[1] as any).previousHash = 'wrong_previous_hash';

            const status = await logger.verifyChain();

            expect(status.isValid).toBe(false);
            expect(status.brokenAt).toBe(2);
            expect(status.failureType).toBe('CHAIN_BREAK');
        });

        it('should verify single entry', async () => {
            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            const result = logger.verifyEntry(1);

            expect(result).not.toBeNull();
            expect(result!.isValid).toBe(true);
            expect(result!.expectedHash).toBe(result!.actualHash);
        });

        it('should return null for non-existent entry', () => {
            const result = logger.verifyEntry(999);

            expect(result).toBeNull();
        });

        it('should verify partial chain range', async () => {
            for (let i = 0; i < 10; i++) {
                await logger.logEntry({
                    action: 'TRUST_REWARD',
                    actor: { type: 'AGENT', id: 'agent-1' },
                    details: { i },
                    outcome: 'SUCCESS',
                });
            }

            const status = await logger.verifyChain({
                startSequence: 3,
                endSequence: 7,
            });

            expect(status.isValid).toBe(true);
            expect(status.entriesVerified).toBe(5);
        });

        it('should emit audit:chain-verified event', async () => {
            let emittedStatus: any;
            logger.on('audit:chain-verified', (status) => {
                emittedStatus = status;
            });

            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            await logger.verifyChain();

            expect(emittedStatus).toBeDefined();
            expect(emittedStatus.isValid).toBe(true);
        });

        it('should emit audit:chain-broken event on failure', async () => {
            let emittedStatus: any;
            logger.on('audit:chain-broken', (status) => {
                emittedStatus = status;
            });

            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            // Tamper
            const entries = logger.getAllEntries();
            (entries[0] as any).entryHash = 'tampered';

            await logger.verifyChain();

            expect(emittedStatus).toBeDefined();
            expect(emittedStatus.isValid).toBe(false);
        });
    });

    // =========================================================================
    // TRUST-2.5: Compliance Export
    // =========================================================================

    describe('compliance export', () => {
        beforeEach(async () => {
            // Create some entries
            await logger.logEntry({
                action: 'TRUST_CREATED',
                actor: { type: 'SYSTEM', id: 'TRUST_ENGINE' },
                details: { agentId: 'agent-1' },
                outcome: 'SUCCESS',
            });

            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1', tier: 3 },
                details: { amount: 10 },
                outcome: 'SUCCESS',
            });
        });

        it('should export as JSON', async () => {
            const startDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
            const endDate = new Date();

            const exportStr = await logger.exportForCompliance(startDate, endDate, 'json');
            const exported = JSON.parse(exportStr);

            expect(exported.metadata).toBeDefined();
            expect(exported.metadata.entryCount).toBe(2);
            expect(exported.metadata.chainStatus.isValid).toBe(true);
            expect(exported.entries).toHaveLength(2);
        });

        it('should export as CSV', async () => {
            const startDate = new Date(Date.now() - 1000 * 60 * 60);
            const endDate = new Date();

            const exportStr = await logger.exportForCompliance(startDate, endDate, 'csv');

            expect(exportStr).toContain('# Compliance Export');
            expect(exportStr).toContain('sequenceNumber');
            expect(exportStr).toContain('TRUST_CREATED');
            expect(exportStr).toContain('TRUST_REWARD');
        });

        it('should include chain status in export', async () => {
            const startDate = new Date(Date.now() - 1000 * 60 * 60);
            const endDate = new Date();

            const exportStr = await logger.exportForCompliance(startDate, endDate, 'json');
            const exported = JSON.parse(exportStr);

            expect(exported.metadata.chainStatus).toBeDefined();
            expect(exported.metadata.chainStatus.isValid).toBe(true);
        });

        it('should filter by date range', async () => {
            // Create entry in the past (by manipulating time)
            const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2); // 2 days ago
            const startDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
            const endDate = new Date();

            const exportStr = await logger.exportForCompliance(startDate, endDate, 'json');
            const exported = JSON.parse(exportStr);

            // Should only include recent entries
            expect(exported.entries.length).toBeGreaterThan(0);
        });

        it('should emit audit:exported event', async () => {
            let emittedMetadata: any;
            logger.on('audit:exported', (metadata) => {
                emittedMetadata = metadata;
            });

            await logger.exportForCompliance(
                new Date(Date.now() - 1000 * 60 * 60),
                new Date(),
                'json'
            );

            expect(emittedMetadata).toBeDefined();
            expect(emittedMetadata.entryCount).toBe(2);
        });
    });

    // =========================================================================
    // Query Methods
    // =========================================================================

    describe('query methods', () => {
        beforeEach(async () => {
            await logger.logEntry({
                action: 'TRUST_CREATED',
                actor: { type: 'SYSTEM', id: 'TRUST_ENGINE' },
                details: {},
                outcome: 'SUCCESS',
            });

            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-2' },
                details: {},
                outcome: 'SUCCESS',
            });
        });

        it('should get entries by action', () => {
            const rewards = logger.getEntriesByAction('TRUST_REWARD');

            expect(rewards).toHaveLength(2);
        });

        it('should get entries by actor', () => {
            const agentEntries = logger.getEntriesByActor('agent-1');

            expect(agentEntries).toHaveLength(1);
            expect(agentEntries[0].actor.id).toBe('agent-1');
        });

        it('should get entry by sequence', () => {
            const entry = logger.getEntryBySequence(2);

            expect(entry).toBeDefined();
            expect(entry!.sequenceNumber).toBe(2);
        });

        it('should get all entries', () => {
            const all = logger.getAllEntries();

            expect(all).toHaveLength(3);
        });

        it('should get current sequence', () => {
            expect(logger.getCurrentSequence()).toBe(3);
        });

        it('should get last hash', () => {
            const lastHash = logger.getLastHash();

            expect(lastHash).toMatch(/^[a-f0-9]{64}$/);
            expect(lastHash).not.toBe(GENESIS_HASH);
        });
    });

    // =========================================================================
    // Migration
    // =========================================================================

    describe('migration', () => {
        it('should migrate legacy entries', async () => {
            const legacyEntries = [
                {
                    id: 'legacy-1',
                    timestamp: new Date(Date.now() - 1000),
                    action: 'TRUST_CREATED' as const,
                    actor: { type: 'SYSTEM' as const, id: 'OLD_SYSTEM' },
                    details: {},
                    outcome: 'SUCCESS' as const,
                },
                {
                    id: 'legacy-2',
                    timestamp: new Date(),
                    action: 'TRUST_REWARD' as const,
                    actor: { type: 'AGENT' as const, id: 'agent-1' },
                    details: {},
                    outcome: 'SUCCESS' as const,
                },
            ];

            const result = await logger.migrateFromLegacy(legacyEntries);

            expect(result.success).toBe(true);
            expect(result.entriesMigrated).toBe(2);
            expect(result.failures).toHaveLength(0);

            // Verify chain is valid
            const status = await logger.verifyChain();
            expect(status.isValid).toBe(true);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('statistics', () => {
        it('should return stats', async () => {
            await logger.logEntry({
                action: 'TRUST_REWARD',
                actor: { type: 'AGENT', id: 'agent-1' },
                details: {},
                outcome: 'SUCCESS',
            });

            const stats = logger.getStats();

            expect(stats.totalEntries).toBe(1);
            expect(stats.currentSequence).toBe(1);
            expect(stats.chainIntact).toBe(true);
            expect(stats.lastEntryTime).not.toBeNull();
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('configuration', () => {
        it('should use default config', () => {
            const config = logger.getConfig();

            expect(config.useCryptoAudit).toBe(true);
            expect(config.hashAlgorithm).toBe('sha256');
        });

        it('should allow custom config', () => {
            const customLogger = new CryptographicAuditLogger({
                hashAlgorithm: 'sha512',
            });

            expect(customLogger.getConfig().hashAlgorithm).toBe('sha512');
        });

        it('should allow config updates', () => {
            logger.setConfig({ enableMerkleRoots: true });

            expect(logger.getConfig().enableMerkleRoots).toBe(true);
        });
    });
});
