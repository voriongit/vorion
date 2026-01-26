/**
 * Q4: Federated Weight Presets with Derivation Chains
 *
 * Implements 3-Tier Federation:
 * - Tier 1: ACI Canonical (immutable, spec-defined)
 * - Tier 2: Vorion Reference (platform defaults)
 * - Tier 3: Axiom Deployment (org-specific derivations)
 *
 * Key Features:
 * - Cryptographic derivation chains
 * - Delta tracking (what changed from parent)
 * - Regulator-verifiable lineage
 * - Weight normalization (sum to 1.0)
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import {
  type TrustPreset,
  type TrustWeights,
  type PresetLineage,
  type PresetSource,
  ACI_CANONICAL_PRESETS,
  trustPresetSchema,
  presetLineageSchema,
  trustWeightsSchema,
} from './types.js';

const logger = createLogger({ component: 'phase6:presets' });

// =============================================================================
// HASH UTILITIES
// =============================================================================

/**
 * Calculate SHA-256 hash for preset integrity
 */
async function calculateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash preset data deterministically
 */
async function hashPresetData(preset: Omit<TrustPreset, 'presetHash'>): Promise<string> {
  const data = {
    presetId: preset.presetId,
    name: preset.name,
    source: preset.source,
    version: preset.version,
    weights: preset.weights,
    parentPresetId: preset.parentPresetId,
    createdAt: preset.createdAt.toISOString(),
    createdBy: preset.createdBy,
  };
  return calculateHash(JSON.stringify(data));
}

// =============================================================================
// WEIGHT UTILITIES
// =============================================================================

/**
 * Normalize weights to sum to 1.0
 */
export function normalizeWeights(weights: TrustWeights): TrustWeights {
  const sum = weights.observability + weights.capability + weights.behavior + weights.governance + weights.context;

  if (Math.abs(sum - 1.0) < 0.001) {
    return weights; // Already normalized
  }

  return {
    observability: weights.observability / sum,
    capability: weights.capability / sum,
    behavior: weights.behavior / sum,
    governance: weights.governance / sum,
    context: weights.context / sum,
  };
}

/**
 * Validate weights sum to 1.0
 */
export function validateWeights(weights: TrustWeights): { valid: boolean; reason?: string } {
  const result = trustWeightsSchema.safeParse(weights);
  if (!result.success) {
    return { valid: false, reason: result.error.message };
  }
  return { valid: true };
}

/**
 * Calculate delta between two weight sets
 */
export function calculateWeightsDelta(
  parent: TrustWeights,
  child: TrustWeights
): Partial<TrustWeights> {
  const delta: Partial<TrustWeights> = {};

  if (Math.abs(child.observability - parent.observability) > 0.001) {
    delta.observability = child.observability - parent.observability;
  }
  if (Math.abs(child.capability - parent.capability) > 0.001) {
    delta.capability = child.capability - parent.capability;
  }
  if (Math.abs(child.behavior - parent.behavior) > 0.001) {
    delta.behavior = child.behavior - parent.behavior;
  }
  if (Math.abs(child.governance - parent.governance) > 0.001) {
    delta.governance = child.governance - parent.governance;
  }
  if (Math.abs(child.context - parent.context) > 0.001) {
    delta.context = child.context - parent.context;
  }

  return delta;
}

/**
 * Apply delta to weights
 */
export function applyWeightsDelta(
  base: TrustWeights,
  delta: Partial<TrustWeights>
): TrustWeights {
  return normalizeWeights({
    observability: base.observability + (delta.observability ?? 0),
    capability: base.capability + (delta.capability ?? 0),
    behavior: base.behavior + (delta.behavior ?? 0),
    governance: base.governance + (delta.governance ?? 0),
    context: base.context + (delta.context ?? 0),
  });
}

// =============================================================================
// TIER 1: ACI CANONICAL PRESETS (IMMUTABLE)
// =============================================================================

/**
 * Get an ACI canonical preset by ID
 */
export function getACIPreset(presetId: string): TrustPreset | undefined {
  return ACI_CANONICAL_PRESETS[presetId];
}

/**
 * Get all ACI canonical presets
 */
export function getAllACIPresets(): readonly TrustPreset[] {
  return Object.values(ACI_CANONICAL_PRESETS);
}

/**
 * Verify ACI preset is authentic (hash matches known value)
 */
export function verifyACIPreset(preset: TrustPreset): boolean {
  const canonical = ACI_CANONICAL_PRESETS[preset.presetId];
  if (!canonical) return false;
  return preset.presetHash === canonical.presetHash;
}

// =============================================================================
// TIER 2 & 3: DERIVED PRESETS
// =============================================================================

/**
 * Input for deriving a new preset
 */
export interface DerivePresetInput {
  presetId: string;
  name: string;
  description: string;
  source: PresetSource;
  parentPreset: TrustPreset;
  weightOverrides?: Partial<TrustWeights>;
  comment?: string;
  createdBy: string;
}

/**
 * Derive a new preset from a parent
 * Maintains cryptographic link to parent for lineage tracking.
 */
export async function derivePreset(input: DerivePresetInput): Promise<TrustPreset> {
  const { parentPreset, weightOverrides, ...rest } = input;

  // Calculate new weights
  let newWeights: TrustWeights;
  let delta: Partial<TrustWeights> | undefined;

  if (weightOverrides) {
    // Apply overrides and normalize
    newWeights = normalizeWeights({
      observability: weightOverrides.observability ?? parentPreset.weights.observability,
      capability: weightOverrides.capability ?? parentPreset.weights.capability,
      behavior: weightOverrides.behavior ?? parentPreset.weights.behavior,
      governance: weightOverrides.governance ?? parentPreset.weights.governance,
      context: weightOverrides.context ?? parentPreset.weights.context,
    });
    delta = calculateWeightsDelta(parentPreset.weights, newWeights);
  } else {
    // Copy parent weights exactly
    newWeights = { ...parentPreset.weights };
  }

  // Validate weights
  const weightResult = validateWeights(newWeights);
  if (!weightResult.valid) {
    throw new Error(`Invalid weights: ${weightResult.reason}`);
  }

  // Validate source hierarchy
  const sourceOrder: PresetSource[] = ['aci', 'vorion', 'axiom'];
  const parentSourceIdx = sourceOrder.indexOf(parentPreset.source);
  const childSourceIdx = sourceOrder.indexOf(input.source);

  if (childSourceIdx < parentSourceIdx) {
    throw new Error(
      `Cannot derive ${input.source} preset from ${parentPreset.source} - must be same level or lower in hierarchy`
    );
  }

  const now = new Date();

  const presetData: Omit<TrustPreset, 'presetHash'> = {
    presetId: rest.presetId,
    name: rest.name,
    description: rest.description,
    source: rest.source,
    version: 1,
    weights: newWeights,
    parentPresetId: parentPreset.presetId,
    parentHash: parentPreset.presetHash,
    derivationDelta: delta,
    createdAt: now,
    createdBy: rest.createdBy,
    comment: rest.comment,
  };

  const presetHash = await hashPresetData(presetData);

  const preset: TrustPreset = {
    ...presetData,
    presetHash,
  };

  // Validate with Zod
  const parsed = trustPresetSchema.safeParse(preset);
  if (!parsed.success) {
    throw new Error(`Invalid preset: ${parsed.error.message}`);
  }

  logger.info(
    {
      presetId: preset.presetId,
      source: preset.source,
      parentPresetId: parentPreset.presetId,
    },
    'Preset derived'
  );

  return Object.freeze(preset);
}

/**
 * Create a Vorion reference preset from ACI canonical
 */
export async function createVorionPreset(
  presetId: string,
  name: string,
  description: string,
  aciPresetId: string,
  weightOverrides: Partial<TrustWeights> | undefined,
  comment: string,
  createdBy: string
): Promise<TrustPreset> {
  const aciPreset = getACIPreset(aciPresetId);
  if (!aciPreset) {
    throw new Error(`ACI preset ${aciPresetId} not found`);
  }

  return derivePreset({
    presetId,
    name,
    description,
    source: 'vorion',
    parentPreset: aciPreset,
    weightOverrides,
    comment,
    createdBy,
  });
}

/**
 * Create an Axiom deployment preset from Vorion reference
 */
export async function createAxiomPreset(
  presetId: string,
  name: string,
  description: string,
  vorionPreset: TrustPreset,
  weightOverrides: Partial<TrustWeights> | undefined,
  comment: string,
  createdBy: string
): Promise<TrustPreset> {
  if (vorionPreset.source !== 'vorion' && vorionPreset.source !== 'aci') {
    throw new Error(`Axiom preset must derive from Vorion or ACI preset, got ${vorionPreset.source}`);
  }

  return derivePreset({
    presetId,
    name,
    description,
    source: 'axiom',
    parentPreset: vorionPreset,
    weightOverrides,
    comment,
    createdBy,
  });
}

// =============================================================================
// LINEAGE TRACKING
// =============================================================================

/**
 * Build complete lineage for a preset
 */
export async function buildPresetLineage(
  preset: TrustPreset,
  presetRegistry: Map<string, TrustPreset>
): Promise<PresetLineage> {
  const chain: string[] = [];
  const hashes: string[] = [];

  let current: TrustPreset | undefined = preset;

  while (current) {
    chain.unshift(current.presetId);
    hashes.unshift(current.presetHash);

    if (current.parentPresetId) {
      // Check ACI presets first
      current = ACI_CANONICAL_PRESETS[current.parentPresetId] ?? presetRegistry.get(current.parentPresetId);
    } else {
      current = undefined;
    }
  }

  const lineage: PresetLineage = {
    leafPresetId: preset.presetId,
    chain,
    hashes,
    verified: false, // Needs regulator verification
  };

  // Validate with Zod
  const parsed = presetLineageSchema.safeParse(lineage);
  if (!parsed.success) {
    throw new Error(`Invalid lineage: ${parsed.error.message}`);
  }

  return lineage;
}

/**
 * Verify preset lineage integrity
 */
export async function verifyPresetLineage(
  lineage: PresetLineage,
  presetRegistry: Map<string, TrustPreset>
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  if (lineage.chain.length !== lineage.hashes.length) {
    issues.push('Chain and hash lengths mismatch');
    return { valid: false, issues };
  }

  // Verify each link in the chain
  for (let i = 0; i < lineage.chain.length; i++) {
    const presetId = lineage.chain[i];
    const expectedHash = lineage.hashes[i];

    // Find preset
    const preset = ACI_CANONICAL_PRESETS[presetId] ?? presetRegistry.get(presetId);

    if (!preset) {
      issues.push(`Preset ${presetId} not found in registry`);
      continue;
    }

    if (preset.presetHash !== expectedHash) {
      issues.push(`Hash mismatch for ${presetId} - expected ${expectedHash}, got ${preset.presetHash}`);
    }

    // Verify parent link (except for root)
    if (i > 0) {
      const expectedParentId = lineage.chain[i - 1];
      if (preset.parentPresetId !== expectedParentId) {
        issues.push(`Parent link broken: ${presetId} should reference ${expectedParentId}, references ${preset.parentPresetId}`);
      }

      const expectedParentHash = lineage.hashes[i - 1];
      if (preset.parentHash !== expectedParentHash) {
        issues.push(`Parent hash mismatch for ${presetId}`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Mark lineage as verified by regulator
 */
export function markLineageVerified(
  lineage: PresetLineage,
  verifiedBy: string
): PresetLineage {
  return {
    ...lineage,
    verified: true,
    verifiedAt: new Date(),
    verifiedBy,
  };
}

// =============================================================================
// PRESET SERVICE
// =============================================================================

/**
 * Service for managing federated weight presets
 */
export class PresetService {
  private vorionPresets: Map<string, TrustPreset> = new Map();
  private axiomPresets: Map<string, TrustPreset> = new Map();
  private lineages: Map<string, PresetLineage> = new Map();

  /**
   * Get all presets (combined)
   */
  getAllPresets(): Map<string, TrustPreset> {
    const all = new Map<string, TrustPreset>();

    // Add ACI canonical
    for (const [id, preset] of Object.entries(ACI_CANONICAL_PRESETS)) {
      all.set(id, preset);
    }

    // Add Vorion reference
    for (const [id, preset] of this.vorionPresets) {
      all.set(id, preset);
    }

    // Add Axiom deployment
    for (const [id, preset] of this.axiomPresets) {
      all.set(id, preset);
    }

    return all;
  }

  /**
   * Get preset by ID (searches all tiers)
   */
  getPreset(presetId: string): TrustPreset | undefined {
    return (
      ACI_CANONICAL_PRESETS[presetId] ??
      this.vorionPresets.get(presetId) ??
      this.axiomPresets.get(presetId)
    );
  }

  /**
   * Create and register a Vorion reference preset
   */
  async createVorionPreset(
    presetId: string,
    name: string,
    description: string,
    aciPresetId: string,
    weightOverrides?: Partial<TrustWeights>,
    comment?: string,
    createdBy: string = 'system'
  ): Promise<TrustPreset> {
    const preset = await createVorionPreset(
      presetId,
      name,
      description,
      aciPresetId,
      weightOverrides,
      comment ?? '',
      createdBy
    );

    this.vorionPresets.set(presetId, preset);

    // Build and store lineage
    const lineage = await buildPresetLineage(preset, this.getAllPresets());
    this.lineages.set(presetId, lineage);

    return preset;
  }

  /**
   * Create and register an Axiom deployment preset
   */
  async createAxiomPreset(
    presetId: string,
    name: string,
    description: string,
    parentPresetId: string,
    weightOverrides?: Partial<TrustWeights>,
    comment?: string,
    createdBy: string = 'system'
  ): Promise<TrustPreset> {
    const parentPreset = this.getPreset(parentPresetId);
    if (!parentPreset) {
      throw new Error(`Parent preset ${parentPresetId} not found`);
    }

    const preset = await createAxiomPreset(
      presetId,
      name,
      description,
      parentPreset,
      weightOverrides,
      comment ?? '',
      createdBy
    );

    this.axiomPresets.set(presetId, preset);

    // Build and store lineage
    const lineage = await buildPresetLineage(preset, this.getAllPresets());
    this.lineages.set(presetId, lineage);

    return preset;
  }

  /**
   * Get lineage for a preset
   */
  getLineage(presetId: string): PresetLineage | undefined {
    return this.lineages.get(presetId);
  }

  /**
   * Verify a preset's lineage
   */
  async verifyLineage(presetId: string): Promise<{ valid: boolean; issues: string[] }> {
    const lineage = this.lineages.get(presetId);
    if (!lineage) {
      return { valid: false, issues: ['Lineage not found'] };
    }

    return verifyPresetLineage(lineage, this.getAllPresets());
  }

  /**
   * Mark lineage as regulator-verified
   */
  markVerified(presetId: string, verifiedBy: string): void {
    const lineage = this.lineages.get(presetId);
    if (!lineage) {
      throw new Error(`Lineage for ${presetId} not found`);
    }

    this.lineages.set(presetId, markLineageVerified(lineage, verifiedBy));
    logger.info({ presetId, verifiedBy }, 'Lineage marked as verified');
  }

  /**
   * Get statistics
   */
  getStats(): {
    aciPresets: number;
    vorionPresets: number;
    axiomPresets: number;
    verifiedLineages: number;
  } {
    const verifiedCount = Array.from(this.lineages.values()).filter((l) => l.verified).length;

    return {
      aciPresets: Object.keys(ACI_CANONICAL_PRESETS).length,
      vorionPresets: this.vorionPresets.size,
      axiomPresets: this.axiomPresets.size,
      verifiedLineages: verifiedCount,
    };
  }
}

/**
 * Create a new preset service instance
 */
export function createPresetService(): PresetService {
  return new PresetService();
}

// =============================================================================
// VORION REFERENCE PRESETS (Built-in)
// =============================================================================

/**
 * Initialize Vorion reference presets
 * These are the platform defaults derived from ACI canonical.
 */
export async function initializeVorionPresets(service: PresetService): Promise<void> {
  // High-security preset (emphasizes observability + governance)
  await service.createVorionPreset(
    'vorion:preset:high-security',
    'High Security',
    'For high-risk operations requiring maximum visibility',
    'aci:preset:conservative',
    {
      observability: 0.35,
      governance: 0.30,
      behavior: 0.20,
      capability: 0.10,
      context: 0.05,
    },
    'Vorion platform default for T4+ agents in regulated environments',
    '@vorion/platform'
  );

  // Balanced autonomy preset (for general use)
  await service.createVorionPreset(
    'vorion:preset:balanced-autonomy',
    'Balanced Autonomy',
    'Default preset for most agents',
    'aci:preset:balanced',
    undefined, // Use ACI balanced weights exactly
    'Vorion platform default for general-purpose agents',
    '@vorion/platform'
  );

  // Performance-focused preset (emphasizes capability)
  await service.createVorionPreset(
    'vorion:preset:performance',
    'Performance Focused',
    'For agents where capability is primary concern',
    'aci:preset:capability-focused',
    {
      capability: 0.40,
      behavior: 0.25,
      observability: 0.15,
      governance: 0.10,
      context: 0.10,
    },
    'Vorion platform default for compute-intensive agents',
    '@vorion/platform'
  );

  logger.info('Vorion reference presets initialized');
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  type TrustPreset,
  type TrustWeights,
  type PresetLineage,
  type PresetSource,
  ACI_CANONICAL_PRESETS,
} from './types.js';
