/**
 * Secure Token Service
 *
 * Provides cryptographically signed tokens with HMAC verification.
 * Replaces simple UUID tokens with signed, verifiable tokens.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { AgentId, AgentTier } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface SecureToken {
    id: string;
    type: 'HUMAN' | 'AGENT' | 'SYSTEM';
    agentId?: AgentId;
    tier?: AgentTier;
    permissions: string[];
    issuedAt: number;      // Unix timestamp
    expiresAt: number;     // Unix timestamp
    signature: string;     // HMAC signature
}

export interface TokenPayload {
    id: string;
    type: 'HUMAN' | 'AGENT' | 'SYSTEM';
    agentId?: string;
    tier?: number;
    permissions: string[];
    iat: number;
    exp: number;
}

export interface TokenVerificationResult {
    valid: boolean;
    expired?: boolean;
    invalidSignature?: boolean;
    revoked?: boolean;
    token?: SecureToken;
}

// ============================================================================
// Secure Token Service
// ============================================================================

export class SecureTokenService {
    private secretKey: Buffer;
    private revokedTokens: Set<string> = new Set();
    private tokenStore: Map<string, SecureToken> = new Map();

    constructor(secretKey?: string) {
        // Priority: constructor arg > env var > generated
        const key = secretKey ?? process.env.TOKEN_SECRET;

        if (key) {
            this.secretKey = Buffer.from(key, 'hex');
            if (this.secretKey.length < 32) {
                throw new Error('Secret key must be at least 256 bits (32 bytes / 64 hex chars)');
            }
        } else {
            this.secretKey = randomBytes(32);

            // Warn if using generated key in production
            if (process.env.NODE_ENV === 'production') {
                console.warn('⚠️  TOKEN_SECRET not set - generating random key. Set TOKEN_SECRET env var for persistence.');
            }
        }
    }

    // -------------------------------------------------------------------------
    // Token Generation
    // -------------------------------------------------------------------------

    /**
     * Generate a cryptographically secure token ID
     */
    private generateTokenId(): string {
        return randomBytes(16).toString('hex');
    }

    /**
     * Create HMAC signature for token payload
     */
    private signPayload(payload: TokenPayload): string {
        const data = JSON.stringify(payload);
        return createHmac('sha256', this.secretKey)
            .update(data)
            .digest('hex');
    }

    /**
     * Issue a new secure token
     */
    issueToken(params: {
        type: 'HUMAN' | 'AGENT' | 'SYSTEM';
        agentId?: AgentId;
        tier?: AgentTier;
        permissions: string[];
        expiryMs?: number;
    }): SecureToken {
        const now = Date.now();
        const defaultExpiry = params.type === 'HUMAN' ? 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
        const expiryMs = params.expiryMs ?? defaultExpiry;

        const payload: TokenPayload = {
            id: this.generateTokenId(),
            type: params.type,
            agentId: params.agentId,
            tier: params.tier,
            permissions: params.permissions,
            iat: now,
            exp: now + expiryMs,
        };

        const signature = this.signPayload(payload);

        const token: SecureToken = {
            id: payload.id,
            type: payload.type,
            agentId: params.agentId,
            tier: params.tier,
            permissions: params.permissions,
            issuedAt: payload.iat,
            expiresAt: payload.exp,
            signature,
        };

        this.tokenStore.set(token.id, token);
        return token;
    }

    /**
     * Encode token for transmission
     */
    encodeToken(token: SecureToken): string {
        const payload: TokenPayload = {
            id: token.id,
            type: token.type,
            agentId: token.agentId,
            tier: token.tier,
            permissions: token.permissions,
            iat: token.issuedAt,
            exp: token.expiresAt,
        };

        const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signatureBase64 = Buffer.from(token.signature, 'hex').toString('base64url');

        return `${payloadBase64}.${signatureBase64}`;
    }

    /**
     * Decode and verify a token string
     */
    decodeToken(tokenString: string): TokenVerificationResult {
        try {
            const parts = tokenString.split('.');
            if (parts.length !== 2) {
                return { valid: false, invalidSignature: true };
            }

            const [payloadBase64, signatureBase64] = parts;
            const payload: TokenPayload = JSON.parse(
                Buffer.from(payloadBase64!, 'base64url').toString()
            );
            const providedSignature = Buffer.from(signatureBase64!, 'base64url').toString('hex');

            // Verify signature
            const expectedSignature = this.signPayload(payload);
            const sigBuffer1 = Buffer.from(providedSignature);
            const sigBuffer2 = Buffer.from(expectedSignature);

            if (sigBuffer1.length !== sigBuffer2.length || !timingSafeEqual(sigBuffer1, sigBuffer2)) {
                return { valid: false, invalidSignature: true };
            }

            // Check revocation
            if (this.revokedTokens.has(payload.id)) {
                return { valid: false, revoked: true };
            }

            // Check expiration
            if (payload.exp < Date.now()) {
                return { valid: false, expired: true };
            }

            const token: SecureToken = {
                id: payload.id,
                type: payload.type,
                agentId: payload.agentId as AgentId | undefined,
                tier: payload.tier as AgentTier | undefined,
                permissions: payload.permissions,
                issuedAt: payload.iat,
                expiresAt: payload.exp,
                signature: providedSignature,
            };

            return { valid: true, token };
        } catch {
            return { valid: false, invalidSignature: true };
        }
    }

    // -------------------------------------------------------------------------
    // Token Verification
    // -------------------------------------------------------------------------

    /**
     * Verify a token by ID (from store)
     */
    verifyTokenById(tokenId: string): TokenVerificationResult {
        if (this.revokedTokens.has(tokenId)) {
            return { valid: false, revoked: true };
        }

        const token = this.tokenStore.get(tokenId);
        if (!token) {
            return { valid: false };
        }

        if (token.expiresAt < Date.now()) {
            this.revokeToken(tokenId);
            return { valid: false, expired: true };
        }

        // Re-verify signature
        const payload: TokenPayload = {
            id: token.id,
            type: token.type,
            agentId: token.agentId,
            tier: token.tier,
            permissions: token.permissions,
            iat: token.issuedAt,
            exp: token.expiresAt,
        };

        const expectedSignature = this.signPayload(payload);
        if (token.signature !== expectedSignature) {
            return { valid: false, invalidSignature: true };
        }

        return { valid: true, token };
    }

    /**
     * Check if token has specific permission
     */
    hasPermission(tokenId: string, permission: string): boolean {
        const result = this.verifyTokenById(tokenId);
        if (!result.valid || !result.token) {
            return false;
        }
        return result.token.permissions.includes(permission);
    }

    // -------------------------------------------------------------------------
    // Token Revocation
    // -------------------------------------------------------------------------

    /**
     * Revoke a token
     */
    revokeToken(tokenId: string): void {
        this.revokedTokens.add(tokenId);
        this.tokenStore.delete(tokenId);
    }

    /**
     * Revoke all tokens for an agent
     */
    revokeAgentTokens(agentId: AgentId): number {
        let count = 0;
        for (const [id, token] of this.tokenStore.entries()) {
            if (token.agentId === agentId) {
                this.revokeToken(id);
                count++;
            }
        }
        return count;
    }

    /**
     * Clean up expired tokens
     */
    cleanupExpired(): number {
        const now = Date.now();
        let count = 0;

        for (const [id, token] of this.tokenStore.entries()) {
            if (token.expiresAt < now) {
                this.tokenStore.delete(id);
                count++;
            }
        }

        return count;
    }

    // -------------------------------------------------------------------------
    // Master Key Management
    // -------------------------------------------------------------------------

    /**
     * Generate a secure master key
     */
    static generateMasterKey(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const segments: string[] = [];

        for (let i = 0; i < 4; i++) {
            const bytes = randomBytes(4);
            const segment = Array.from(bytes)
                .map(b => chars[b % chars.length])
                .join('');
            segments.push(segment);
        }

        return segments.join('-');
    }

    /**
     * Verify master key using timing-safe comparison
     */
    static verifyMasterKey(provided: string, expected: string): boolean {
        if (typeof provided !== 'string' || typeof expected !== 'string') {
            return false;
        }

        const providedBuffer = Buffer.from(provided);
        const expectedBuffer = Buffer.from(expected);

        if (providedBuffer.length !== expectedBuffer.length) {
            // Still do comparison to prevent timing attacks
            timingSafeEqual(providedBuffer, providedBuffer);
            return false;
        }

        return timingSafeEqual(providedBuffer, expectedBuffer);
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    getStats(): {
        activeTokens: number;
        revokedTokens: number;
        humanTokens: number;
        agentTokens: number;
    } {
        let humanTokens = 0;
        let agentTokens = 0;

        for (const token of this.tokenStore.values()) {
            if (token.type === 'HUMAN') humanTokens++;
            if (token.type === 'AGENT') agentTokens++;
        }

        return {
            activeTokens: this.tokenStore.size,
            revokedTokens: this.revokedTokens.size,
            humanTokens,
            agentTokens,
        };
    }

    /**
     * Get secret key hex (for persistence/sharing between instances)
     */
    getSecretKeyHex(): string {
        return this.secretKey.toString('hex');
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let tokenServiceInstance: SecureTokenService | null = null;

export function getTokenService(secretKey?: string): SecureTokenService {
    if (!tokenServiceInstance) {
        tokenServiceInstance = new SecureTokenService(secretKey);
    }
    return tokenServiceInstance;
}

export function resetTokenService(): void {
    tokenServiceInstance = null;
}
