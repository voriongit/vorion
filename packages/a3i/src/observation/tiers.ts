/**
 * Observation Tiers - Classification of agent observability
 *
 * Based on ATSF v2.0: Addresses the "Transparency Paradox"
 * - Cannot inspect proprietary model internals (GPT-4, Claude)
 * - Must distinguish scaffolding trust from model trust
 * - Hardware root of trust via TEE attestation
 */

import { ObservationTier, OBSERVATION_CEILINGS } from '@vorion/contracts';

export { ObservationTier, OBSERVATION_CEILINGS };

/**
 * Model access types - how the foundation model is accessed
 */
export enum ModelAccessType {
  /** OpenAI, Anthropic APIs - complete black box */
  API_PROPRIETARY = 'api_proprietary',
  /** Hosted open-weight models (still can't see runtime state) */
  API_OPEN_WEIGHTS = 'api_open_weights',
  /** Self-hosted open source models */
  SELF_HOSTED_OPEN = 'self_hosted_open',
  /** Running in Trusted Execution Environment */
  SELF_HOSTED_TEE = 'self_hosted_tee',
  /** Fine-tuned on proprietary platform */
  FINE_TUNED_PROPRIETARY = 'fine_tuned_proprietary',
}

/**
 * Component types in an AI agent system
 */
export enum ComponentType {
  /** Foundation model (GPT-4, Claude, Llama) */
  FOUNDATION_MODEL = 'foundation_model',
  /** Orchestration code (LangChain, custom) */
  ORCHESTRATION_CODE = 'orchestration',
  /** Tool integrations (APIs, databases) */
  TOOL_INTEGRATION = 'tools',
  /** Safety/guardrail systems */
  GUARDRAIL_SYSTEM = 'guardrails',
  /** Memory systems (RAG, vector stores) */
  MEMORY_SYSTEM = 'memory',
  /** Multi-agent routing logic */
  ROUTING_LOGIC = 'routing',
}

/**
 * Map model access type to observation tier
 */
export const MODEL_ACCESS_TIERS: Record<ModelAccessType, ObservationTier> = {
  [ModelAccessType.API_PROPRIETARY]: ObservationTier.BLACK_BOX,
  [ModelAccessType.API_OPEN_WEIGHTS]: ObservationTier.BLACK_BOX, // Can't see runtime state
  [ModelAccessType.SELF_HOSTED_OPEN]: ObservationTier.WHITE_BOX,
  [ModelAccessType.SELF_HOSTED_TEE]: ObservationTier.ATTESTED_BOX,
  [ModelAccessType.FINE_TUNED_PROPRIETARY]: ObservationTier.BLACK_BOX,
};

/**
 * Get the observation tier for a model access type
 */
export function getObservationTierForAccess(
  accessType: ModelAccessType
): ObservationTier {
  return MODEL_ACCESS_TIERS[accessType];
}

/**
 * Get the trust ceiling for an observation tier
 */
export function getTrustCeiling(tier: ObservationTier): number {
  return OBSERVATION_CEILINGS[tier];
}

/**
 * Check if a tier allows full trust (100% ceiling)
 * Per ATSF v2.0: Only VERIFIED_BOX allows full trust
 */
export function allowsFullTrust(tier: ObservationTier): boolean {
  return tier === ObservationTier.VERIFIED_BOX;
}

/**
 * Check if observation tier is hardware-attested
 */
export function isHardwareAttested(tier: ObservationTier): boolean {
  return tier === ObservationTier.ATTESTED_BOX || tier === ObservationTier.VERIFIED_BOX;
}

/**
 * Check if we can inspect source code
 */
export function canInspectSource(tier: ObservationTier): boolean {
  return (
    tier === ObservationTier.WHITE_BOX ||
    tier === ObservationTier.ATTESTED_BOX ||
    tier === ObservationTier.VERIFIED_BOX
  );
}

/**
 * Get tier description for display
 */
export function getTierDescription(tier: ObservationTier): {
  name: string;
  shortName: string;
  description: string;
  ceiling: number;
  examples: string[];
} {
  switch (tier) {
    case ObservationTier.BLACK_BOX:
      return {
        name: 'Black Box',
        shortName: 'BLACK',
        description: 'I/O only - no internal visibility',
        ceiling: OBSERVATION_CEILINGS[tier],
        examples: ['GPT-4 via API', 'Claude via API', 'Hosted Gemini'],
      };
    case ObservationTier.GRAY_BOX:
      return {
        name: 'Gray Box',
        shortName: 'GRAY',
        description: 'I/O + platform logs and metrics',
        ceiling: OBSERVATION_CEILINGS[tier],
        examples: ['Platform-hosted models', 'Managed ML services'],
      };
    case ObservationTier.WHITE_BOX:
      return {
        name: 'White Box',
        shortName: 'WHITE',
        description: 'Full source code access',
        ceiling: OBSERVATION_CEILINGS[tier],
        examples: ['Self-hosted Llama', 'Open source models', 'Custom code'],
      };
    case ObservationTier.ATTESTED_BOX:
      return {
        name: 'Attested Box',
        shortName: 'ATTESTED',
        description: 'Cryptographically verified in TEE (95% ceiling due to side-channel risk)',
        ceiling: OBSERVATION_CEILINGS[tier],
        examples: ['SGX enclave', 'AMD SEV-SNP', 'NVIDIA CC on H100'],
      };
    case ObservationTier.VERIFIED_BOX:
      return {
        name: 'Verified Box',
        shortName: 'VERIFIED',
        description: 'Full verification: TEE + zkML + interpretability',
        ceiling: OBSERVATION_CEILINGS[tier],
        examples: ['TEE with zkML proofs', 'Interpretability-verified models'],
      };
  }
}

/**
 * Compare observation tiers
 */
export function compareTiers(a: ObservationTier, b: ObservationTier): number {
  const order = {
    [ObservationTier.BLACK_BOX]: 1,
    [ObservationTier.GRAY_BOX]: 2,
    [ObservationTier.WHITE_BOX]: 3,
    [ObservationTier.ATTESTED_BOX]: 4,
    [ObservationTier.VERIFIED_BOX]: 5,
  };
  return order[a] - order[b];
}

/**
 * Get the lowest (most restrictive) tier from an array
 */
export function getLowestTier(tiers: ObservationTier[]): ObservationTier {
  if (tiers.length === 0) {
    return ObservationTier.BLACK_BOX;
  }
  return tiers.reduce((lowest, current) =>
    compareTiers(current, lowest) < 0 ? current : lowest
  );
}

/**
 * Tier descriptions for documentation
 */
export const TIER_DESCRIPTIONS: Record<
  ObservationTier,
  {
    name: string;
    description: string;
    trustCeiling: number;
    whatWeCanSee: string[];
    whatWeCantSee: string[];
  }
> = {
  [ObservationTier.BLACK_BOX]: {
    name: 'Black Box',
    description: 'Input/output only. No internal visibility.',
    trustCeiling: 600,
    whatWeCanSee: ['Inputs', 'Outputs', 'Response time', 'Error messages'],
    whatWeCantSee: [
      'Internal reasoning',
      'Token probabilities',
      'Attention patterns',
      'Model weights',
      'Training data',
    ],
  },
  [ObservationTier.GRAY_BOX]: {
    name: 'Gray Box',
    description: 'I/O plus platform-level telemetry.',
    trustCeiling: 750,
    whatWeCanSee: [
      'Inputs',
      'Outputs',
      'Platform logs',
      'Resource usage',
      'Request traces',
    ],
    whatWeCantSee: ['Model internals', 'Weights', 'Training process'],
  },
  [ObservationTier.WHITE_BOX]: {
    name: 'White Box',
    description: 'Full source code and architecture access. Reduced from 950 due to sleeper agent risk.',
    trustCeiling: 900,
    whatWeCanSee: [
      'Source code',
      'Model architecture',
      'Weights (if open)',
      'Configuration',
      'All execution state',
    ],
    whatWeCantSee: ['Hardware state', 'Side channels', 'Hidden behaviors'],
  },
  [ObservationTier.ATTESTED_BOX]: {
    name: 'Attested Box',
    description: 'Hardware-verified integrity via TEE. Reduced from 1000 due to side-channel risk.',
    trustCeiling: 950,
    whatWeCanSee: [
      'Everything in White Box',
      'Hardware attestation',
      'Integrity proofs',
      'Sealed secrets',
    ],
    whatWeCantSee: ['Side-channel attacks', 'Physical attacks'],
  },
  [ObservationTier.VERIFIED_BOX]: {
    name: 'Verified Box',
    description: 'Full verification stack: TEE + zkML proofs + interpretability analysis.',
    trustCeiling: 1000,
    whatWeCanSee: [
      'Everything in Attested Box',
      'Zero-knowledge model proofs',
      'Interpretability analysis',
      'Behavior verification',
    ],
    whatWeCantSee: [],
  },
};
