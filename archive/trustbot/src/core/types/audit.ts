/**
 * Cryptographic Audit Trail Type Definitions
 *
 * TRUST-2.1: Type definitions for the tamper-evident audit system.
 * These types support hash-chained audit entries for compliance.
 */

import type { AuditEntry, AuditAction } from '../SecurityLayer.js';

// ============================================================================
// Cryptographic Audit Entry
// ============================================================================

/**
 * Enhanced audit entry with cryptographic chain linkage.
 * Each entry is linked to the previous via hash, creating a tamper-evident chain.
 */
export interface CryptographicAuditEntry extends AuditEntry {
    /**
     * Monotonically increasing sequence number.
     * First entry is 1, increments by 1 for each subsequent entry.
     */
    sequenceNumber: number;

    /**
     * SHA-256 hash of the previous entry.
     * First entry uses 'GENESIS' as the previous hash.
     */
    previousHash: string;

    /**
     * SHA-256 hash of this entry's content.
     * Computed from all fields except entryHash itself.
     */
    entryHash: string;

    /**
     * Optional Merkle root for batch operations.
     * Used when multiple entries are created as part of a single transaction.
     */
    merkleRoot?: string;
}

// ============================================================================
// Chain Verification Status
// ============================================================================

/**
 * Result of verifying the audit chain integrity.
 */
export interface AuditChainStatus {
    /**
     * Whether the chain is valid (no tampering detected).
     */
    isValid: boolean;

    /**
     * When the verification was performed.
     */
    lastVerified: Date;

    /**
     * Number of entries verified in this check.
     */
    entriesVerified: number;

    /**
     * If invalid, the sequence number where the chain broke.
     */
    brokenAt?: number;

    /**
     * Description of what caused the verification failure.
     */
    error?: string;

    /**
     * Type of failure detected.
     */
    failureType?: ChainFailureType;
}

/**
 * Types of chain verification failures.
 */
export type ChainFailureType =
    | 'HASH_MISMATCH'      // Entry hash doesn't match recomputed hash
    | 'CHAIN_BREAK'        // Previous hash doesn't match prior entry
    | 'MISSING_ENTRY'      // Gap in sequence numbers
    | 'DUPLICATE_SEQUENCE' // Same sequence number used twice
    | 'GENESIS_VIOLATION'; // First entry doesn't have GENESIS previousHash

// ============================================================================
// Compliance Export Types
// ============================================================================

/**
 * Format options for compliance exports.
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Metadata included in compliance exports.
 */
export interface ComplianceExportMetadata {
    /** When the export was generated */
    exportDate: Date;

    /** Entity that performed the export */
    exportedBy: string;

    /** Start of the date range included */
    rangeStart: Date;

    /** End of the date range included */
    rangeEnd: Date;

    /** Total entries in the export */
    entryCount: number;

    /** Chain verification status at time of export */
    chainStatus: AuditChainStatus;

    /** Version of the export format */
    formatVersion: string;
}

/**
 * Complete compliance export structure.
 */
export interface ComplianceExport {
    /** Export metadata */
    metadata: ComplianceExportMetadata;

    /** The audit entries */
    entries: CryptographicAuditEntry[];

    /** Optional signature of the export (for future use) */
    signature?: string;
}

// ============================================================================
// Logger Configuration
// ============================================================================

/**
 * Configuration for the cryptographic audit logger.
 */
export interface CryptoAuditLoggerConfig {
    /** Whether to use cryptographic hashing (feature flag) */
    useCryptoAudit: boolean;

    /** Hash algorithm to use (default: 'sha256') */
    hashAlgorithm: 'sha256' | 'sha384' | 'sha512';

    /** Whether to compute Merkle roots for batch operations */
    enableMerkleRoots: boolean;

    /** Batch size before auto-verification (0 = disabled) */
    autoVerifyBatchSize: number;
}

/**
 * Default logger configuration.
 */
export const DEFAULT_CRYPTO_AUDIT_CONFIG: CryptoAuditLoggerConfig = {
    useCryptoAudit: true,
    hashAlgorithm: 'sha256',
    enableMerkleRoots: false,
    autoVerifyBatchSize: 0,
};

// ============================================================================
// Genesis Constants
// ============================================================================

/**
 * Special value for the first entry's previousHash.
 */
export const GENESIS_HASH = 'GENESIS';

/**
 * Format version for exports.
 */
export const EXPORT_FORMAT_VERSION = '1.0.0';

// ============================================================================
// Verification Request Types
// ============================================================================

/**
 * Parameters for chain verification.
 */
export interface VerifyChainParams {
    /** Starting sequence number (default: 1) */
    startSequence?: number;

    /** Ending sequence number (default: latest) */
    endSequence?: number;

    /** Whether to stop on first error or collect all */
    stopOnFirstError?: boolean;
}

/**
 * Detailed verification result for a single entry.
 */
export interface EntryVerificationResult {
    /** Sequence number of the verified entry */
    sequenceNumber: number;

    /** Whether this entry passed verification */
    isValid: boolean;

    /** Expected hash (recomputed) */
    expectedHash: string;

    /** Actual hash stored in entry */
    actualHash: string;

    /** If invalid, the specific error */
    error?: string;
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Result of migrating legacy audit entries to cryptographic format.
 */
export interface MigrationResult {
    /** Whether migration completed successfully */
    success: boolean;

    /** Number of entries migrated */
    entriesMigrated: number;

    /** Any entries that failed to migrate */
    failures: Array<{
        entryId: string;
        error: string;
    }>;

    /** When migration was performed */
    migratedAt: Date;

    /** Hash of the last migrated entry */
    lastHash: string;
}

// ============================================================================
// Re-export base types for convenience
// ============================================================================

export type { AuditEntry, AuditAction };
