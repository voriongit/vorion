/**
 * API Key Manager Service
 *
 * Epic 10: Agent Connection Layer
 * Story 10.4: Agent Authentication
 *
 * Manages API keys for agent authentication:
 * - Key generation and issuance
 * - Key rotation with grace period
 * - Immediate revocation
 * - Usage tracking and rate limiting
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { EventEmitter } from 'eventemitter3';
import { getSupabasePersistence, hasSupabaseConfig } from '../core/SupabasePersistence.js';

// ============================================================================
// Types
// ============================================================================

export interface ApiKey {
    id: string;
    keyHash: string;
    agentId: string;
    name: string;
    permissions: string[];
    createdAt: Date;
    expiresAt: Date;
    lastUsedAt?: Date;
    rotatedFromId?: string;
    revokedAt?: Date;
    revokedReason?: string;
    usageCount: number;
    metadata?: Record<string, unknown>;
}

export interface ApiKeyCreateRequest {
    agentId: string;
    name: string;
    permissions?: string[];
    expiresInDays?: number;
    metadata?: Record<string, unknown>;
}

export interface ApiKeyCreateResult {
    id: string;
    key: string;
    keyPrefix: string;
    expiresAt: Date;
}

export interface ApiKeyRotateResult {
    newKey: ApiKeyCreateResult;
    oldKeyExpiresAt: Date;
    gracePeriodMs: number;
}

export interface ApiKeyVerifyResult {
    valid: boolean;
    keyId?: string;
    agentId?: string;
    permissions?: string[];
    expired?: boolean;
    revoked?: boolean;
    error?: string;
}

export interface ApiKeyManagerConfig {
    defaultExpiryDays: number;
    rotationGracePeriodMs: number;
    keyPrefix: string;
    keyLength: number;
    maxKeysPerAgent: number;
    trackUsage: boolean;
}

interface ManagerEvents {
    'key:created': (keyId: string, agentId: string) => void;
    'key:rotated': (oldKeyId: string, newKeyId: string, agentId: string) => void;
    'key:revoked': (keyId: string, agentId: string, reason: string) => void;
    'key:expired': (keyId: string, agentId: string) => void;
    'key:used': (keyId: string, agentId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: ApiKeyManagerConfig = {
    defaultExpiryDays: 30,
    rotationGracePeriodMs: 24 * 60 * 60 * 1000, // 24 hours
    keyPrefix: 'tb_',
    keyLength: 32,
    maxKeysPerAgent: 5,
    trackUsage: true,
};

const DEFAULT_PERMISSIONS = [
    'agent:read',
    'agent:write',
    'task:read',
    'task:execute',
    'ws:connect',
];

// ============================================================================
// API Key Manager
// ============================================================================

export class ApiKeyManager extends EventEmitter<ManagerEvents> {
    private keys: Map<string, ApiKey> = new Map(); // keyHash -> ApiKey
    private agentKeys: Map<string, Set<string>> = new Map(); // agentId -> Set<keyHash>
    private revokedKeys: Set<string> = new Set(); // Immediate revocation cache
    private config: ApiKeyManagerConfig;

    constructor(config: Partial<ApiKeyManagerConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // -------------------------------------------------------------------------
    // Key Generation
    // -------------------------------------------------------------------------

    /**
     * Create a new API key
     */
    async createKey(request: ApiKeyCreateRequest): Promise<ApiKeyCreateResult> {
        const { agentId, name, permissions, expiresInDays, metadata } = request;

        // Check max keys per agent
        const existingKeys = this.agentKeys.get(agentId);
        if (existingKeys && existingKeys.size >= this.config.maxKeysPerAgent) {
            throw new Error(`Maximum keys (${this.config.maxKeysPerAgent}) reached for agent`);
        }

        // Generate key
        const keyBytes = randomBytes(this.config.keyLength);
        const key = this.config.keyPrefix + keyBytes.toString('base64url');
        const keyHash = this.hashKey(key);
        const keyId = `key_${randomBytes(8).toString('hex')}`;

        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (expiresInDays ?? this.config.defaultExpiryDays));

        // Create key record
        const apiKey: ApiKey = {
            id: keyId,
            keyHash,
            agentId,
            name,
            permissions: permissions ?? DEFAULT_PERMISSIONS,
            createdAt: new Date(),
            expiresAt,
            usageCount: 0,
            metadata,
        };

        // Store
        this.keys.set(keyHash, apiKey);
        if (!this.agentKeys.has(agentId)) {
            this.agentKeys.set(agentId, new Set());
        }
        this.agentKeys.get(agentId)!.add(keyHash);

        // Persist
        await this.persistKey(apiKey);

        this.emit('key:created', keyId, agentId);

        return {
            id: keyId,
            key,
            keyPrefix: key.substring(0, 10) + '...',
            expiresAt,
        };
    }

    // -------------------------------------------------------------------------
    // Key Rotation
    // -------------------------------------------------------------------------

    /**
     * Rotate an API key with grace period
     */
    async rotateKey(oldKey: string): Promise<ApiKeyRotateResult> {
        const oldKeyHash = this.hashKey(oldKey);
        const existingKey = this.keys.get(oldKeyHash);

        if (!existingKey) {
            throw new Error('Key not found');
        }

        if (existingKey.revokedAt) {
            throw new Error('Cannot rotate revoked key');
        }

        // Create new key
        const newKeyResult = await this.createKey({
            agentId: existingKey.agentId,
            name: `${existingKey.name} (rotated)`,
            permissions: existingKey.permissions,
            metadata: existingKey.metadata,
        });

        // Update new key to reference old
        const newKeyHash = this.hashKey(newKeyResult.key.substring(0, this.config.keyPrefix.length) === this.config.keyPrefix
            ? newKeyResult.key
            : this.config.keyPrefix + newKeyResult.key);

        // Set grace period expiry for old key
        const gracePeriodExpiry = new Date(Date.now() + this.config.rotationGracePeriodMs);
        existingKey.expiresAt = gracePeriodExpiry;

        this.emit('key:rotated', existingKey.id, newKeyResult.id, existingKey.agentId);

        return {
            newKey: newKeyResult,
            oldKeyExpiresAt: gracePeriodExpiry,
            gracePeriodMs: this.config.rotationGracePeriodMs,
        };
    }

    // -------------------------------------------------------------------------
    // Key Revocation
    // -------------------------------------------------------------------------

    /**
     * Revoke a key immediately
     */
    async revokeKey(key: string, reason: string = 'Manual revocation'): Promise<boolean> {
        const keyHash = this.hashKey(key);
        const existingKey = this.keys.get(keyHash);

        if (!existingKey) {
            return false;
        }

        // Mark as revoked
        existingKey.revokedAt = new Date();
        existingKey.revokedReason = reason;

        // Add to immediate revocation cache
        this.revokedKeys.add(keyHash);

        // Persist
        await this.persistRevocation(existingKey.id, reason);

        this.emit('key:revoked', existingKey.id, existingKey.agentId, reason);

        return true;
    }

    /**
     * Revoke all keys for an agent
     */
    async revokeAllAgentKeys(agentId: string, reason: string = 'Agent keys revoked'): Promise<number> {
        const agentKeyHashes = this.agentKeys.get(agentId);
        if (!agentKeyHashes) return 0;

        let revoked = 0;
        for (const keyHash of agentKeyHashes) {
            const key = this.keys.get(keyHash);
            if (key && !key.revokedAt) {
                key.revokedAt = new Date();
                key.revokedReason = reason;
                this.revokedKeys.add(keyHash);
                this.emit('key:revoked', key.id, agentId, reason);
                revoked++;
            }
        }

        return revoked;
    }

    // -------------------------------------------------------------------------
    // Key Verification
    // -------------------------------------------------------------------------

    /**
     * Verify an API key
     */
    async verifyKey(key: string): Promise<ApiKeyVerifyResult> {
        const keyHash = this.hashKey(key);

        // Check immediate revocation cache first
        if (this.revokedKeys.has(keyHash)) {
            return { valid: false, revoked: true };
        }

        // Look up key
        let apiKey = this.keys.get(keyHash);

        // If not in memory, try database
        if (!apiKey && hasSupabaseConfig()) {
            apiKey = await this.loadKeyFromDB(keyHash) ?? undefined;
        }

        if (!apiKey) {
            return { valid: false, error: 'Key not found' };
        }

        // Check revocation
        if (apiKey.revokedAt) {
            this.revokedKeys.add(keyHash); // Cache for future
            return { valid: false, revoked: true };
        }

        // Check expiry
        if (new Date() > apiKey.expiresAt) {
            this.emit('key:expired', apiKey.id, apiKey.agentId);
            return { valid: false, expired: true };
        }

        // Track usage
        if (this.config.trackUsage) {
            apiKey.usageCount++;
            apiKey.lastUsedAt = new Date();
            this.emit('key:used', apiKey.id, apiKey.agentId);
        }

        return {
            valid: true,
            keyId: apiKey.id,
            agentId: apiKey.agentId,
            permissions: apiKey.permissions,
        };
    }

    /**
     * Verify key using timing-safe comparison
     */
    verifyKeyHash(providedKey: string, storedHash: string): boolean {
        const providedHash = this.hashKey(providedKey);
        const providedBuffer = Buffer.from(providedHash, 'hex');
        const storedBuffer = Buffer.from(storedHash, 'hex');

        if (providedBuffer.length !== storedBuffer.length) {
            return false;
        }

        return timingSafeEqual(providedBuffer, storedBuffer);
    }

    // -------------------------------------------------------------------------
    // Key Queries
    // -------------------------------------------------------------------------

    /**
     * Get all keys for an agent
     */
    getAgentKeys(agentId: string): ApiKey[] {
        const keyHashes = this.agentKeys.get(agentId);
        if (!keyHashes) return [];

        return Array.from(keyHashes)
            .map(hash => this.keys.get(hash))
            .filter((k): k is ApiKey => k !== undefined)
            .filter(k => !k.revokedAt);
    }

    /**
     * Get key by ID
     */
    getKeyById(keyId: string): ApiKey | null {
        for (const key of this.keys.values()) {
            if (key.id === keyId) {
                return key;
            }
        }
        return null;
    }

    /**
     * Check if agent has valid keys
     */
    hasValidKeys(agentId: string): boolean {
        const keys = this.getAgentKeys(agentId);
        const now = new Date();
        return keys.some(k => !k.revokedAt && k.expiresAt > now);
    }

    /**
     * Get key statistics
     */
    getStats(): {
        totalKeys: number;
        activeKeys: number;
        revokedKeys: number;
        expiredKeys: number;
    } {
        const now = new Date();
        const allKeys = Array.from(this.keys.values());

        return {
            totalKeys: allKeys.length,
            activeKeys: allKeys.filter(k => !k.revokedAt && k.expiresAt > now).length,
            revokedKeys: allKeys.filter(k => k.revokedAt).length,
            expiredKeys: allKeys.filter(k => !k.revokedAt && k.expiresAt <= now).length,
        };
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    /**
     * Hash an API key
     */
    hashKey(key: string): string {
        return createHash('sha256').update(key).digest('hex');
    }

    /**
     * Extract key prefix for display
     */
    getKeyPrefix(key: string): string {
        return key.substring(0, 10) + '...';
    }

    /**
     * Clean up expired keys
     */
    async cleanupExpiredKeys(): Promise<number> {
        const now = new Date();
        let cleaned = 0;

        for (const [hash, key] of this.keys) {
            if (key.expiresAt < now || key.revokedAt) {
                // Remove from agent tracking
                const agentKeys = this.agentKeys.get(key.agentId);
                if (agentKeys) {
                    agentKeys.delete(hash);
                }

                // Remove from main map
                this.keys.delete(hash);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * Clear all keys (for testing)
     */
    clear(): void {
        this.keys.clear();
        this.agentKeys.clear();
        this.revokedKeys.clear();
    }

    // -------------------------------------------------------------------------
    // Persistence
    // -------------------------------------------------------------------------

    private async persistKey(key: ApiKey): Promise<void> {
        // Future: Store in database
    }

    private async persistRevocation(keyId: string, reason: string): Promise<void> {
        // Future: Update in database
    }

    private async loadKeyFromDB(keyHash: string): Promise<ApiKey | null> {
        // Future: Load from database
        return null;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: ApiKeyManager | null = null;

export function getApiKeyManager(config?: Partial<ApiKeyManagerConfig>): ApiKeyManager {
    if (!managerInstance) {
        managerInstance = new ApiKeyManager(config);
    }
    return managerInstance;
}

export function resetApiKeyManager(): void {
    managerInstance = null;
}
