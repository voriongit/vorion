/**
 * Phase 6 Q5: Creation Modifiers - Type & Migration Layer
 * 
 * Core responsibility: Track agent creation type immutably
 * - Type set at instantiation, never changes
 * - Modifiers applied to initial trust score
 * - Migration events for lifecycle transitions
 * - Cryptographic proof of origin facts
 */

/**
 * Agent creation types with assigned modifiers
 * These determine initial trust score adjustments
 */
export enum CreationType {
  FRESH = 'fresh',       // +0 modifier: New agent, baseline
  CLONED = 'cloned',     // -50 modifier: Cloned from existing (uncertainty)
  EVOLVED = 'evolved',   // +25 modifier: Evolved from existing (proven)
  PROMOTED = 'promoted', // +50 modifier: Promoted from lower tier
  IMPORTED = 'imported', // -100 modifier: Imported from external (untrusted)
}

/**
 * Modifiers applied based on creation type
 * These adjust the initial trust score
 */
export const CREATION_MODIFIERS: Record<CreationType, number> = {
  [CreationType.FRESH]: 0,       // Start at baseline
  [CreationType.CLONED]: -50,    // Discount for uncertainty
  [CreationType.EVOLVED]: 25,    // Bonus for proven evolution
  [CreationType.PROMOTED]: 50,   // Bonus for promotion
  [CreationType.IMPORTED]: -100, // Heavy discount for external origin
};

/**
 * Immutable creation information
 */
export interface CreationInfo {
  readonly creationType: CreationType;
  readonly parentAgentId?: string; // For cloned/evolved
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly creationHash: string; // Cryptographic proof of origin
}

/**
 * Migration event for creation type changes (rare, tracked)
 */
export interface CreationMigrationEvent {
  timestamp: Date;
  agentId: string;
  fromType: CreationType;
  toType: CreationType;
  reason: string;
  approvedBy: string;
  migrationHash: string;
}

/**
 * Validate that a creation type is valid
 */
export function validateCreationType(value: unknown): value is CreationType {
  return Object.values(CreationType).includes(value as CreationType);
}

/**
 * Get modifier for a creation type
 */
export function getCreationModifier(creationType: CreationType): number {
  if (!validateCreationType(creationType)) {
    throw new Error(`Invalid creation type: ${creationType}`);
  }
  return CREATION_MODIFIERS[creationType];
}

/**
 * Compute cryptographic hash of creation info for immutability proof
 */
export function computeCreationHash(
  creationType: CreationType,
  parentAgentId: string | undefined,
  createdAt: Date,
  createdBy: string
): string {
  const data = `${creationType}|${parentAgentId || 'none'}|${createdAt.toISOString()}|${createdBy}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Create immutable creation info at instantiation
 * This is the ONLY place creation type can be set
 */
export function createCreationInfo(
  creationType: CreationType,
  parentAgentId: string | undefined,
  createdBy: string
): CreationInfo {
  if (!validateCreationType(creationType)) {
    throw new Error(`Invalid creation type: ${creationType}`);
  }

  const createdAt = new Date();
  const creationHash = computeCreationHash(
    creationType,
    parentAgentId,
    createdAt,
    createdBy
  );

  return Object.freeze({
    creationType,
    parentAgentId,
    createdAt,
    createdBy,
    creationHash,
  });
}

/**
 * Verify creation info hasn't been tampered with
 */
export function verifyCreationIntegrity(creation: CreationInfo): boolean {
  const expectedHash = computeCreationHash(
    creation.creationType,
    creation.parentAgentId,
    creation.createdAt,
    creation.createdBy
  );
  return creation.creationHash === expectedHash;
}

/**
 * Apply creation modifier to base trust score
 * Clamps result to [0, 1000]
 */
export function applyCreationModifier(
  baseScore: number,
  creationType: CreationType
): number {
  const modifier = getCreationModifier(creationType);
  const adjusted = baseScore + modifier;
  return Math.max(0, Math.min(1000, adjusted));
}

/**
 * Compute initial trust score based on creation type
 * FRESH agents start at 250 (T1 monitored)
 * Modifiers adjust from there
 */
export function computeInitialTrustScore(
  creationType: CreationType,
  baselineScore: number = 250 // T1 (monitored) baseline
): number {
  return applyCreationModifier(baselineScore, creationType);
}

/**
 * Migration tracker for creation type transitions (rare)
 */
export class CreationMigrationTracker {
  private migrations: CreationMigrationEvent[] = [];

  /**
   * Record a creation type migration
   * These are exceptional and require explicit approval
   */
  recordMigration(
    agentId: string,
    fromType: CreationType,
    toType: CreationType,
    reason: string,
    approvedBy: string
  ): CreationMigrationEvent {
    const event: CreationMigrationEvent = {
      timestamp: new Date(),
      agentId,
      fromType,
      toType,
      reason,
      approvedBy,
      migrationHash: this.computeMigrationHash(
        agentId,
        fromType,
        toType,
        reason
      ),
    };

    this.migrations.push(event);
    return event;
  }

  /**
   * Get all migrations for an agent
   */
  getMigrationsForAgent(agentId: string): CreationMigrationEvent[] {
    return this.migrations.filter((m) => m.agentId === agentId);
  }

  /**
   * Get all migrations
   */
  getAllMigrations(): CreationMigrationEvent[] {
    return [...this.migrations];
  }

  /**
   * Verify migration integrity
   */
  verifyMigrationIntegrity(event: CreationMigrationEvent): boolean {
    const expectedHash = this.computeMigrationHash(
      event.agentId,
      event.fromType,
      event.toType,
      event.reason
    );
    return event.migrationHash === expectedHash;
  }

  private computeMigrationHash(
    agentId: string,
    fromType: CreationType,
    toType: CreationType,
    reason: string
  ): string {
    const data = `${agentId}|${fromType}→${toType}|${reason}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Clear migrations (for testing)
   */
  clear(): void {
    this.migrations = [];
  }
}

/**
 * Global migration tracker instance
 */
export const globalMigrationTracker = new CreationMigrationTracker();
