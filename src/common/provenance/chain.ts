/**
 * Provenance Chain
 *
 * Hash chain implementation for provenance records.
 * Each record links to the previous via hash for tamper detection.
 *
 * @packageDocumentation
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '../logger.js';
import { sha256 } from '../crypto.js';
import type {
  ProvenanceRecord,
  ChainVerificationResult,
  TamperDetectionResult,
} from './types.js';

const logger = createLogger({ component: 'provenance-chain' });
const tracer = trace.getTracer('provenance-chain');

/**
 * ProvenanceChain class for managing hash-linked records
 */
export class ProvenanceChain {
  /**
   * Verify the integrity of a chain of provenance records
   *
   * @param chain - Array of provenance records ordered by chain position
   * @returns Verification result
   */
  async verify(chain: ProvenanceRecord[]): Promise<ChainVerificationResult> {
    return tracer.startActiveSpan('provenance.chain.verify', async (span) => {
      try {
        span.setAttribute('chain.length', chain.length);

        if (chain.length === 0) {
          span.setStatus({ code: SpanStatusCode.OK });
          return {
            valid: true,
            recordsVerified: 0,
            verifiedAt: new Date().toISOString(),
          };
        }

        // Sort by chain position to ensure proper order
        const sortedChain = [...chain].sort((a, b) => a.chainPosition - b.chainPosition);

        // Verify first record has empty previous hash
        if (sortedChain[0].chainPosition === 1 && sortedChain[0].previousHash !== '') {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'First record has non-empty previous hash' });
          return {
            valid: false,
            recordsVerified: 0,
            invalidAtPosition: 1,
            error: 'First record in chain must have empty previous hash',
            verifiedAt: new Date().toISOString(),
          };
        }

        // Verify each record's hash and chain linkage
        for (let i = 0; i < sortedChain.length; i++) {
          const record = sortedChain[i];
          const expectedHash = await this.calculateHash(record);

          // Verify record hash
          if (record.hash !== expectedHash) {
            logger.warn(
              {
                position: record.chainPosition,
                expectedHash,
                actualHash: record.hash,
              },
              'Hash mismatch detected in chain'
            );
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Hash mismatch' });
            return {
              valid: false,
              recordsVerified: i,
              invalidAtPosition: record.chainPosition,
              error: `Hash mismatch at position ${record.chainPosition}`,
              verifiedAt: new Date().toISOString(),
            };
          }

          // Verify chain linkage (skip first record)
          if (i > 0) {
            const previousRecord = sortedChain[i - 1];
            if (record.previousHash !== previousRecord.hash) {
              logger.warn(
                {
                  position: record.chainPosition,
                  expectedPreviousHash: previousRecord.hash,
                  actualPreviousHash: record.previousHash,
                },
                'Chain linkage broken'
              );
              span.setStatus({ code: SpanStatusCode.ERROR, message: 'Chain linkage broken' });
              return {
                valid: false,
                recordsVerified: i,
                invalidAtPosition: record.chainPosition,
                error: `Chain linkage broken at position ${record.chainPosition}`,
                verifiedAt: new Date().toISOString(),
              };
            }
          }

          // Verify chain position continuity
          if (i > 0 && record.chainPosition !== sortedChain[i - 1].chainPosition + 1) {
            logger.warn(
              {
                expectedPosition: sortedChain[i - 1].chainPosition + 1,
                actualPosition: record.chainPosition,
              },
              'Chain position gap detected'
            );
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Chain position gap' });
            return {
              valid: false,
              recordsVerified: i,
              invalidAtPosition: record.chainPosition,
              error: `Chain position gap at position ${record.chainPosition}`,
              verifiedAt: new Date().toISOString(),
            };
          }
        }

        logger.debug(
          { recordsVerified: sortedChain.length },
          'Chain verification successful'
        );

        span.setStatus({ code: SpanStatusCode.OK });
        return {
          valid: true,
          recordsVerified: sortedChain.length,
          verifiedAt: new Date().toISOString(),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Chain verification failed');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Detect tampering in a chain of provenance records
   *
   * @param chain - Array of provenance records to check
   * @returns Tamper detection result
   */
  async detectTampering(chain: ProvenanceRecord[]): Promise<TamperDetectionResult> {
    return tracer.startActiveSpan('provenance.chain.detectTampering', async (span) => {
      try {
        span.setAttribute('chain.length', chain.length);

        const details: TamperDetectionResult['details'] = [];

        if (chain.length === 0) {
          span.setStatus({ code: SpanStatusCode.OK });
          return {
            tampered: false,
            detectedAt: new Date().toISOString(),
          };
        }

        // Sort by chain position
        const sortedChain = [...chain].sort((a, b) => a.chainPosition - b.chainPosition);

        for (let i = 0; i < sortedChain.length; i++) {
          const record = sortedChain[i];
          const expectedHash = await this.calculateHash(record);

          // Check for hash tampering
          if (record.hash !== expectedHash) {
            details.push({
              position: record.chainPosition,
              expectedHash,
              actualHash: record.hash,
              reason: 'Record content has been modified (hash mismatch)',
            });
          }

          // Check for chain linkage tampering (skip first record)
          if (i > 0) {
            const previousRecord = sortedChain[i - 1];
            if (record.previousHash !== previousRecord.hash) {
              details.push({
                position: record.chainPosition,
                expectedHash: previousRecord.hash,
                actualHash: record.previousHash,
                reason: 'Chain linkage has been broken (previous hash mismatch)',
              });
            }
          }

          // Check first record special case
          if (i === 0 && record.chainPosition === 1 && record.previousHash !== '') {
            details.push({
              position: record.chainPosition,
              expectedHash: '',
              actualHash: record.previousHash,
              reason: 'First record has been tampered (should have empty previous hash)',
            });
          }
        }

        const tampered = details.length > 0;

        if (tampered) {
          logger.warn(
            { tamperedRecords: details.length },
            'Tampering detected in provenance chain'
          );
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return {
          tampered,
          details: tampered ? details : undefined,
          detectedAt: new Date().toISOString(),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        logger.error({ error }, 'Tamper detection failed');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Calculate the expected hash for a provenance record
   *
   * @param record - Provenance record
   * @returns Expected hash
   */
  async calculateHash(record: ProvenanceRecord): Promise<string> {
    const content = {
      entityId: record.entityId,
      entityType: record.entityType,
      action: record.action,
      data: record.data,
      actor: record.actor,
      tenantId: record.tenantId,
      previousHash: record.previousHash,
      chainPosition: record.chainPosition,
      timestamp: record.createdAt,
    };

    return sha256(JSON.stringify(content));
  }

  /**
   * Get the last hash in a chain
   *
   * @param chain - Array of provenance records
   * @returns Last hash or empty string if chain is empty
   */
  getLastHash(chain: ProvenanceRecord[]): string {
    if (chain.length === 0) {
      return '';
    }

    const sortedChain = [...chain].sort((a, b) => b.chainPosition - a.chainPosition);
    return sortedChain[0].hash;
  }

  /**
   * Get the next chain position
   *
   * @param chain - Array of provenance records
   * @returns Next chain position
   */
  getNextPosition(chain: ProvenanceRecord[]): number {
    if (chain.length === 0) {
      return 1;
    }

    const sortedChain = [...chain].sort((a, b) => b.chainPosition - a.chainPosition);
    return sortedChain[0].chainPosition + 1;
  }
}

/**
 * Create a new ProvenanceChain instance
 */
export function createProvenanceChain(): ProvenanceChain {
  return new ProvenanceChain();
}
