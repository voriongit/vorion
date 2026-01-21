/**
 * Key Manager - Secure Key Management for Audit Signing
 *
 * Provides secure key generation, storage, loading, and rotation
 * for Ed25519 cryptographic signing of audit records.
 *
 * Supports multiple storage backends:
 * - Memory (development/testing)
 * - File (with optional encryption)
 * - Environment variables
 * - HSM (Hardware Security Module) - interface only
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type {
  AuditKeyPair,
  PublicKeyInfo,
  KeyStorageConfig,
  HSMProvider,
  KeyRotationRequest,
  KeyRotationResult,
} from './audit-types.js';

const logger = createLogger({ component: 'key-manager' });

/**
 * Generate a new Ed25519 key pair using jose library
 * Note: This uses the jose library which is available in AgentAnchor
 */
export async function generateKeyPair(keyId?: string): Promise<AuditKeyPair> {
  // Dynamic import of jose to allow this module to work standalone
  const jose = await import('jose');

  const { publicKey, privateKey } = await jose.generateKeyPair('EdDSA', {
    crv: 'Ed25519',
    extractable: true, // Required to export keys as JWK
  });

  // Export keys to JWK format, then to base64
  const publicJwk = await jose.exportJWK(publicKey);
  const privateJwk = await jose.exportJWK(privateKey);

  const now = new Date().toISOString();
  const generatedKeyId = keyId ?? `key-${crypto.randomUUID()}`;

  return {
    keyId: generatedKeyId,
    publicKey: Buffer.from(JSON.stringify(publicJwk)).toString('base64'),
    privateKey: Buffer.from(JSON.stringify(privateJwk)).toString('base64'),
    algorithm: 'Ed25519',
    createdAt: now,
    rotationSequence: 0,
    active: true,
  };
}

/**
 * Extract public key info from a key pair
 */
export function extractPublicKeyInfo(keyPair: AuditKeyPair): PublicKeyInfo {
  return {
    keyId: keyPair.keyId,
    publicKey: keyPair.publicKey,
    algorithm: keyPair.algorithm,
    createdAt: keyPair.createdAt,
    expiresAt: keyPair.expiresAt,
    rotationSequence: keyPair.rotationSequence,
  };
}

/**
 * Key Manager for secure key operations
 */
export class KeyManager {
  private keys: Map<string, AuditKeyPair> = new Map();
  private activeKeyId: string | null = null;
  private config: KeyStorageConfig;
  private hsmProvider: HSMProvider | null = null;

  constructor(config: KeyStorageConfig = { type: 'memory' }) {
    this.config = config;
    if (config.hsmProvider) {
      this.hsmProvider = config.hsmProvider;
    }
  }

  /**
   * Initialize the key manager
   */
  async initialize(): Promise<void> {
    switch (this.config.type) {
      case 'memory':
        // Nothing to load for memory storage
        logger.info('Key manager initialized with memory storage');
        break;

      case 'file':
        await this.loadFromFile();
        break;

      case 'env':
        await this.loadFromEnv();
        break;

      case 'hsm':
        await this.initializeHSM();
        break;

      default:
        throw new Error(`Unknown storage type: ${this.config.type}`);
    }
  }

  /**
   * Generate and store a new key pair
   */
  async generateKey(keyId?: string): Promise<AuditKeyPair> {
    if (this.config.type === 'hsm' && this.hsmProvider) {
      return this.generateKeyInHSM(keyId);
    }

    const keyPair = await generateKeyPair(keyId);
    await this.storeKey(keyPair);

    if (!this.activeKeyId) {
      this.activeKeyId = keyPair.keyId;
    }

    logger.info({ keyId: keyPair.keyId }, 'Generated new key pair');
    return keyPair;
  }

  /**
   * Store a key pair
   */
  async storeKey(keyPair: AuditKeyPair): Promise<void> {
    this.keys.set(keyPair.keyId, keyPair);

    switch (this.config.type) {
      case 'file':
        await this.saveToFile();
        break;
      // env storage is read-only
      // hsm storage is handled separately
    }

    logger.debug({ keyId: keyPair.keyId }, 'Key stored');
  }

  /**
   * Get a key pair by ID
   */
  async getKey(keyId: string): Promise<AuditKeyPair | null> {
    if (this.config.type === 'hsm' && this.hsmProvider) {
      // HSM keys don't expose private keys, so we return null
      // Use sign/verify methods directly with HSM
      return null;
    }

    return this.keys.get(keyId) ?? null;
  }

  /**
   * Get public key info by ID
   */
  async getPublicKey(keyId: string): Promise<PublicKeyInfo | null> {
    if (this.config.type === 'hsm' && this.hsmProvider) {
      return this.hsmProvider.getPublicKey(keyId);
    }

    const keyPair = this.keys.get(keyId);
    if (!keyPair) return null;

    return extractPublicKeyInfo(keyPair);
  }

  /**
   * Get the active key pair
   */
  async getActiveKey(): Promise<AuditKeyPair | null> {
    if (!this.activeKeyId) return null;
    return this.getKey(this.activeKeyId);
  }

  /**
   * Get the active key ID
   */
  getActiveKeyId(): string | null {
    return this.activeKeyId;
  }

  /**
   * Set the active key
   */
  setActiveKey(keyId: string): void {
    if (!this.keys.has(keyId)) {
      throw new Error(`Key not found: ${keyId}`);
    }
    this.activeKeyId = keyId;
    logger.info({ keyId }, 'Active key changed');
  }

  /**
   * Rotate keys - generate new key and deactivate old
   */
  async rotateKey(request: KeyRotationRequest): Promise<KeyRotationResult> {
    const previousKeyId = this.activeKeyId;
    if (!previousKeyId) {
      return {
        success: false,
        chainId: request.chainId,
        previousKeyId: '',
        newKeyId: '',
        rotationSequence: 0,
        rotatedAt: new Date().toISOString(),
        issues: ['No active key to rotate'],
      };
    }

    const previousKey = await this.getKey(previousKeyId);
    const previousSequence = previousKey?.rotationSequence ?? 0;

    // Generate or use provided new key
    let newKeyPair: AuditKeyPair;
    if (request.newKeyPair) {
      newKeyPair = {
        ...request.newKeyPair,
        rotationSequence: previousSequence + 1,
        active: true,
      };
    } else {
      newKeyPair = await generateKeyPair();
      newKeyPair.rotationSequence = previousSequence + 1;
    }

    // Deactivate old key
    if (previousKey) {
      previousKey.active = false;
      await this.storeKey(previousKey);
    }

    // Store and activate new key
    await this.storeKey(newKeyPair);
    this.activeKeyId = newKeyPair.keyId;

    logger.info(
      {
        previousKeyId,
        newKeyId: newKeyPair.keyId,
        rotationSequence: newKeyPair.rotationSequence,
        reason: request.reason,
      },
      'Key rotated'
    );

    return {
      success: true,
      chainId: request.chainId,
      previousKeyId,
      newKeyId: newKeyPair.keyId,
      rotationSequence: newKeyPair.rotationSequence,
      rotatedAt: new Date().toISOString(),
    };
  }

  /**
   * List all key IDs
   */
  async listKeys(): Promise<string[]> {
    if (this.config.type === 'hsm' && this.hsmProvider) {
      return this.hsmProvider.listKeys();
    }
    return Array.from(this.keys.keys());
  }

  /**
   * List all public keys
   */
  async listPublicKeys(): Promise<PublicKeyInfo[]> {
    const keyIds = await this.listKeys();
    const publicKeys: PublicKeyInfo[] = [];

    for (const keyId of keyIds) {
      const pubKey = await this.getPublicKey(keyId);
      if (pubKey) {
        publicKeys.push(pubKey);
      }
    }

    return publicKeys;
  }

  /**
   * Delete a key
   */
  async deleteKey(keyId: string): Promise<boolean> {
    if (this.config.type === 'hsm' && this.hsmProvider) {
      return this.hsmProvider.deleteKey(keyId);
    }

    const deleted = this.keys.delete(keyId);
    if (deleted && this.activeKeyId === keyId) {
      this.activeKeyId = null;
    }

    if (this.config.type === 'file') {
      await this.saveToFile();
    }

    logger.info({ keyId, deleted }, 'Key deletion attempted');
    return deleted;
  }

  /**
   * Check if a key exists
   */
  async hasKey(keyId: string): Promise<boolean> {
    if (this.config.type === 'hsm' && this.hsmProvider) {
      const keys = await this.hsmProvider.listKeys();
      return keys.includes(keyId);
    }
    return this.keys.has(keyId);
  }

  /**
   * Sign data with the active key (or specified key)
   */
  async sign(data: Uint8Array, keyId?: string): Promise<Uint8Array> {
    const targetKeyId = keyId ?? this.activeKeyId;
    if (!targetKeyId) {
      throw new Error('No key available for signing');
    }

    if (this.config.type === 'hsm' && this.hsmProvider) {
      return this.hsmProvider.sign(targetKeyId, data);
    }

    const keyPair = await this.getKey(targetKeyId);
    if (!keyPair) {
      throw new Error(`Key not found: ${targetKeyId}`);
    }

    const jose = await import('jose');
    const privateJwk = JSON.parse(Buffer.from(keyPair.privateKey, 'base64').toString());
    const privateKey = await jose.importJWK(privateJwk, 'EdDSA');

    // Create a compact JWS
    const jws = await new jose.CompactSign(data)
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(privateKey);

    // Extract just the signature part
    const parts = jws.split('.');
    const signature = parts[2];

    return Buffer.from(signature!, 'base64url');
  }

  /**
   * Verify a signature
   */
  async verify(data: Uint8Array, signature: Uint8Array, keyId: string): Promise<boolean> {
    if (this.config.type === 'hsm' && this.hsmProvider) {
      return this.hsmProvider.verify(keyId, data, signature);
    }

    const keyPair = await this.getKey(keyId);
    if (!keyPair) {
      throw new Error(`Key not found: ${keyId}`);
    }

    try {
      const jose = await import('jose');
      const publicJwk = JSON.parse(Buffer.from(keyPair.publicKey, 'base64').toString());
      const publicKey = await jose.importJWK(publicJwk, 'EdDSA');

      // Reconstruct the JWS for verification
      const header = Buffer.from(JSON.stringify({ alg: 'EdDSA' })).toString('base64url');
      const payload = Buffer.from(data).toString('base64url');
      const sig = Buffer.from(signature).toString('base64url');
      const jws = `${header}.${payload}.${sig}`;

      await jose.compactVerify(jws, publicKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage configuration
   */
  getConfig(): KeyStorageConfig {
    return { ...this.config };
  }

  /**
   * Check if using HSM
   */
  isUsingHSM(): boolean {
    return this.config.type === 'hsm' && this.hsmProvider !== null;
  }

  // Private methods for file storage

  private async loadFromFile(): Promise<void> {
    if (!this.config.filePath) {
      throw new Error('File path not configured');
    }

    try {
      const fs = await import('node:fs/promises');
      const exists = await fs.access(this.config.filePath).then(() => true).catch(() => false);

      if (!exists) {
        logger.info({ filePath: this.config.filePath }, 'Key file does not exist, starting fresh');
        return;
      }

      let content = await fs.readFile(this.config.filePath, 'utf-8');

      // Decrypt if encryption is enabled
      if (this.config.encryptAtRest && this.config.encryptionKey) {
        content = await this.decrypt(content);
      }

      const data = JSON.parse(content) as {
        activeKeyId: string | null;
        keys: AuditKeyPair[];
      };

      this.activeKeyId = data.activeKeyId;
      for (const key of data.keys) {
        this.keys.set(key.keyId, key);
      }

      logger.info(
        { filePath: this.config.filePath, keyCount: this.keys.size },
        'Keys loaded from file'
      );
    } catch (error) {
      logger.error({ error, filePath: this.config.filePath }, 'Failed to load keys from file');
      throw error;
    }
  }

  private async saveToFile(): Promise<void> {
    if (!this.config.filePath) {
      throw new Error('File path not configured');
    }

    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      const data = {
        activeKeyId: this.activeKeyId,
        keys: Array.from(this.keys.values()),
      };

      let content = JSON.stringify(data, null, 2);

      // Encrypt if encryption is enabled
      if (this.config.encryptAtRest && this.config.encryptionKey) {
        content = await this.encrypt(content);
      }

      // Ensure directory exists
      const dir = path.dirname(this.config.filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(this.config.filePath, content, 'utf-8');

      logger.debug({ filePath: this.config.filePath }, 'Keys saved to file');
    } catch (error) {
      logger.error({ error, filePath: this.config.filePath }, 'Failed to save keys to file');
      throw error;
    }
  }

  private async loadFromEnv(): Promise<void> {
    const prefix = this.config.envPrefix ?? 'AUDIT_KEY';

    // Look for AUDIT_KEY_PRIVATE and AUDIT_KEY_PUBLIC
    const privateKeyEnv = process.env[`${prefix}_PRIVATE`];
    const publicKeyEnv = process.env[`${prefix}_PUBLIC`];
    const keyIdEnv = process.env[`${prefix}_ID`] ?? 'env-key';

    if (privateKeyEnv && publicKeyEnv) {
      const keyPair: AuditKeyPair = {
        keyId: keyIdEnv,
        publicKey: publicKeyEnv,
        privateKey: privateKeyEnv,
        algorithm: 'Ed25519',
        createdAt: new Date().toISOString(),
        rotationSequence: 0,
        active: true,
      };

      this.keys.set(keyPair.keyId, keyPair);
      this.activeKeyId = keyPair.keyId;

      logger.info({ keyId: keyPair.keyId }, 'Key loaded from environment');
    } else {
      logger.warn({ prefix }, 'No keys found in environment variables');
    }
  }

  private async initializeHSM(): Promise<void> {
    if (!this.hsmProvider) {
      throw new Error('HSM provider not configured');
    }

    const connected = await this.hsmProvider.isConnected();
    if (!connected) {
      throw new Error('HSM is not connected');
    }

    const keys = await this.hsmProvider.listKeys();
    if (keys.length > 0) {
      this.activeKeyId = keys[0] ?? null;
    }

    logger.info(
      { provider: this.hsmProvider.name, keyCount: keys.length },
      'HSM initialized'
    );
  }

  private async generateKeyInHSM(keyId?: string): Promise<AuditKeyPair> {
    if (!this.hsmProvider) {
      throw new Error('HSM provider not configured');
    }

    const generatedKeyId = keyId ?? `hsm-key-${crypto.randomUUID()}`;
    const publicKeyInfo = await this.hsmProvider.generateKeyPair(generatedKeyId);

    // For HSM, we don't have direct access to private key
    const keyPair: AuditKeyPair = {
      keyId: publicKeyInfo.keyId,
      publicKey: publicKeyInfo.publicKey,
      privateKey: '', // HSM-managed, not exposed
      algorithm: 'Ed25519',
      createdAt: publicKeyInfo.createdAt,
      expiresAt: publicKeyInfo.expiresAt,
      rotationSequence: publicKeyInfo.rotationSequence,
      active: true,
    };

    if (!this.activeKeyId) {
      this.activeKeyId = keyPair.keyId;
    }

    logger.info({ keyId: keyPair.keyId }, 'Generated key in HSM');
    return keyPair;
  }

  // Simple encryption/decryption for file storage (uses AES-256-GCM)
  private async encrypt(data: string): Promise<string> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    // Derive a key from the encryption key
    const keyMaterial = new TextEncoder().encode(this.config.encryptionKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);
    const key = await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(data)
    );

    // Combine IV and ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return Buffer.from(combined).toString('base64');
  }

  private async decrypt(data: string): Promise<string> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    // Derive a key from the encryption key
    const keyMaterial = new TextEncoder().encode(this.config.encryptionKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);
    const key = await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const combined = Buffer.from(data, 'base64');
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }
}

/**
 * Create a new key manager instance
 */
export function createKeyManager(config?: KeyStorageConfig): KeyManager {
  return new KeyManager(config);
}

/**
 * Create a mock HSM provider for testing
 */
export function createMockHSMProvider(): HSMProvider {
  const keys = new Map<string, { public: string; private: string }>();

  return {
    name: 'MockHSM',

    async isConnected(): Promise<boolean> {
      return true;
    },

    async generateKeyPair(keyId: string): Promise<PublicKeyInfo> {
      const keyPair = await generateKeyPair(keyId);
      keys.set(keyId, {
        public: keyPair.publicKey,
        private: keyPair.privateKey,
      });
      return extractPublicKeyInfo(keyPair);
    },

    async sign(keyId: string, data: Uint8Array): Promise<Uint8Array> {
      const keyData = keys.get(keyId);
      if (!keyData) {
        throw new Error(`Key not found in HSM: ${keyId}`);
      }

      const jose = await import('jose');
      const privateJwk = JSON.parse(Buffer.from(keyData.private, 'base64').toString());
      const privateKey = await jose.importJWK(privateJwk, 'EdDSA');

      const jws = await new jose.CompactSign(data)
        .setProtectedHeader({ alg: 'EdDSA' })
        .sign(privateKey);

      const parts = jws.split('.');
      return Buffer.from(parts[2]!, 'base64url');
    },

    async verify(keyId: string, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
      const keyData = keys.get(keyId);
      if (!keyData) {
        throw new Error(`Key not found in HSM: ${keyId}`);
      }

      try {
        const jose = await import('jose');
        const publicJwk = JSON.parse(Buffer.from(keyData.public, 'base64').toString());
        const publicKey = await jose.importJWK(publicJwk, 'EdDSA');

        const header = Buffer.from(JSON.stringify({ alg: 'EdDSA' })).toString('base64url');
        const payload = Buffer.from(data).toString('base64url');
        const sig = Buffer.from(signature).toString('base64url');
        const jws = `${header}.${payload}.${sig}`;

        await jose.compactVerify(jws, publicKey);
        return true;
      } catch {
        return false;
      }
    },

    async getPublicKey(keyId: string): Promise<PublicKeyInfo | null> {
      const keyData = keys.get(keyId);
      if (!keyData) return null;

      return {
        keyId,
        publicKey: keyData.public,
        algorithm: 'Ed25519',
        createdAt: new Date().toISOString(),
        rotationSequence: 0,
      };
    },

    async deleteKey(keyId: string): Promise<boolean> {
      return keys.delete(keyId);
    },

    async listKeys(): Promise<string[]> {
      return Array.from(keys.keys());
    },
  };
}
