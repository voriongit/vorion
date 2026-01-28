/**
 * KYA Identity Verification
 * W3C DID resolution + Ed25519 signature verification
 */

import * as ed from '@noble/ed25519';
import { Resolver } from 'did-resolver';
import {
  DIDDocument,
  DIDResolverConfig,
  IdentityProof,
  VerificationMethod,
} from './types.js';

export class IdentityVerifier {
  private resolver: Resolver;
  private cache: Map<string, DIDDocument>;

  constructor(config: DIDResolverConfig) {
    // Initialize DID resolver (would integrate with did-resolver library)
    this.resolver = new Resolver({
      // Custom resolver for did:vorion:
      vorion: async (did: string) => {
        return this.resolveVorionDID(did);
      },
    });

    this.cache = new Map();
  }

  /**
   * Verify agent identity using DID + signature
   */
  async verify(proof: IdentityProof): Promise<boolean> {
    try {
      // 1. Resolve DID document
      const didDoc = await this.resolveDID(proof.did);

      // 2. Extract verification method
      const verificationMethod = didDoc.verificationMethod?.find(
        (vm: VerificationMethod) => vm.type === 'Ed25519VerificationKey2020'
      );

      if (!verificationMethod) {
        throw new Error('No Ed25519 verification method found');
      }

      // 3. Verify signature
      const message = `${proof.challenge}:${proof.timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = this.hexToBytes(proof.signature);
      const publicKeyBytes = this.multibaseToBytes(verificationMethod.publicKeyMultibase);

      const isValid = await ed.verify(signatureBytes, messageBytes, publicKeyBytes);

      // 4. Check timestamp freshness (prevent replay attacks)
      const age = Date.now() - proof.timestamp;
      if (age > 60000) { // 1 minute max
        throw new Error('Proof too old (replay attack prevention)');
      }

      return isValid;
    } catch (error) {
      console.error('Identity verification failed:', error);
      return false;
    }
  }

  /**
   * Resolve DID to DID Document
   */
  async resolveDID(did: string): Promise<DIDDocument> {
    // Check cache first
    if (this.cache.has(did)) {
      return this.cache.get(did)!;
    }

    // Resolve from network
    const result = await this.resolver.resolve(did);

    if (!result.didDocument) {
      throw new Error(`Failed to resolve DID: ${did}`);
    }

    const didDoc = result.didDocument as DIDDocument;

    // Cache for future lookups
    this.cache.set(did, didDoc);

    return didDoc;
  }

  /**
   * Custom Vorion DID resolver
   * Format: did:vorion:<method>:<identifier>
   */
  private async resolveVorionDID(did: string): Promise<any> {
    // Parse DID
    const parts = did.split(':');
    if (parts.length < 4) {
      throw new Error('Invalid Vorion DID format');
    }

    const method = parts[2];  // e.g., 'ed25519'
    const identifier = parts[3];  // e.g., '5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk'

    // Fetch from Vorion DID registry (would be actual API call)
    // For now, return mock structure
    return {
      didDocument: {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://vorion.org/ns/kya/v1',
        ],
        id: did,
        controller: did,
        verificationMethod: [
          {
            id: `${did}#keys-1`,
            type: 'Ed25519VerificationKey2020',
            controller: did,
            publicKeyMultibase: `z${identifier}`,
          },
        ],
        authentication: [`${did}#keys-1`],
        assertionMethod: [`${did}#keys-1`],
        service: [
          {
            id: `${did}#agentcard`,
            type: 'AgentCard',
            serviceEndpoint: `https://agentanchorai.com/cards/${identifier}`,
          },
        ],
        kya: {
          trustScore: 0,
          tier: 'T0' as const,
          certified: false,
          capabilities: [],
          restrictions: [],
        },
      },
    };
  }

  /**
   * Generate challenge for identity proof
   */
  generateChallenge(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return this.bytesToHex(bytes);
  }

  /**
   * Sign challenge with private key (for agents to use)
   */
  async signChallenge(challenge: string, privateKey: Uint8Array): Promise<string> {
    const timestamp = Date.now();
    const message = `${challenge}:${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);

    const signature = await ed.sign(messageBytes, privateKey);

    return this.bytesToHex(signature);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private multibaseToBytes(multibase: string): Uint8Array {
    // Remove 'z' prefix (base58btc encoding)
    const base58 = multibase.substring(1);

    // Decode base58 (simplified, would use actual base58 library)
    // For now, assume hex encoding
    return this.hexToBytes(base58);
  }
}

// ============================================================================
// Example Usage
// ============================================================================

/*
import { IdentityVerifier } from './identity';

async function example() {
  const verifier = new IdentityVerifier({
    networks: ['vorion', 'ethereum'],
    cacheEnabled: true,
  });

  // Agent generates proof
  const challenge = verifier.generateChallenge();
  const privateKey = ed.utils.randomPrivateKey();
  const signature = await verifier.signChallenge(challenge, privateKey);

  // Verify identity
  const isValid = await verifier.verify({
    did: 'did:vorion:ed25519:5Z8K3q2YvU8pVzNxF9sT7bQw6JhR1XmDcL4nVk',
    timestamp: Date.now(),
    challenge,
    signature,
    publicKey: ed.utils.bytesToHex(await ed.getPublicKey(privateKey)),
  });

  console.log('Identity valid:', isValid);
}
*/
