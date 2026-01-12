/**
 * @basis-protocol/core
 * Constants for the BASIS AI governance standard
 */

import type { 
  TrustTier, 
  Capability, 
  CapabilityDefinition,
  RiskLevel 
} from './types';

// =============================================================================
// VERSION
// =============================================================================

/** Current BASIS specification version */
export const BASIS_VERSION = '1.0.0';

/** Minimum supported version for compatibility */
export const BASIS_MIN_VERSION = '1.0.0';

// =============================================================================
// TRUST CONSTANTS
// =============================================================================

/** Maximum trust score */
export const TRUST_SCORE_MAX = 1000;

/** Minimum trust score */
export const TRUST_SCORE_MIN = 0;

/** Trust tier thresholds */
export const TRUST_TIER_THRESHOLDS: Record<TrustTier, [number, number]> = {
  unverified: [0, 99],
  provisional: [100, 299],
  certified: [300, 499],
  trusted: [500, 699],
  verified: [700, 899],
  sovereign: [900, 1000],
};

/** Trust component weights (must sum to 1.0) */
export const TRUST_COMPONENT_WEIGHTS = {
  compliance: 0.25,    // 25%
  performance: 0.20,   // 20%
  reputation: 0.15,    // 15%
  stake: 0.15,         // 15%
  history: 0.15,       // 15%
  verification: 0.10,  // 10%
} as const;

/** Trust decay rate per day of inactivity */
export const TRUST_DECAY_RATE = 0.5; // 0.5 points per day

/** Maximum trust decay */
export const TRUST_DECAY_MAX = 50; // Max 50 points lost to decay

/** Trust recovery rate per successful action */
export const TRUST_RECOVERY_RATE = 0.1; // 0.1 points per action

/** Trust penalty for governance violation */
export const TRUST_VIOLATION_PENALTY = 25;

/** Trust bonus for certification */
export const TRUST_CERTIFICATION_BONUS = {
  bronze: 50,
  silver: 100,
  gold: 150,
  platinum: 200,
} as const;

// =============================================================================
// CAPABILITY CONSTANTS
// =============================================================================

/** Full capability definitions with metadata */
export const CAPABILITY_DEFINITIONS: Record<Capability, CapabilityDefinition> = {
  // Data capabilities
  'data/read_public': {
    id: 'data/read_public',
    name: 'Read Public Data',
    description: 'Access publicly available data',
    category: 'data',
    minTrustScore: 0,
    riskLevel: 'minimal',
    requiresHumanApproval: false,
  },
  'data/read_user': {
    id: 'data/read_user',
    name: 'Read User Data',
    description: 'Access user-specific data with permission',
    category: 'data',
    minTrustScore: 300,
    riskLevel: 'limited',
    requiresHumanApproval: false,
  },
  'data/read_sensitive': {
    id: 'data/read_sensitive',
    name: 'Read Sensitive Data',
    description: 'Access sensitive or confidential data',
    category: 'data',
    minTrustScore: 700,
    riskLevel: 'high',
    requiresHumanApproval: true,
  },
  'data/write': {
    id: 'data/write',
    name: 'Write Data',
    description: 'Create or modify data records',
    category: 'data',
    minTrustScore: 300,
    riskLevel: 'limited',
    requiresHumanApproval: false,
  },
  'data/delete': {
    id: 'data/delete',
    name: 'Delete Data',
    description: 'Permanently remove data records',
    category: 'data',
    minTrustScore: 500,
    riskLevel: 'significant',
    requiresHumanApproval: false,
  },

  // Communication capabilities
  'communication/send_internal': {
    id: 'communication/send_internal',
    name: 'Send Internal Messages',
    description: 'Send messages within the platform',
    category: 'communication',
    minTrustScore: 100,
    riskLevel: 'minimal',
    requiresHumanApproval: false,
  },
  'communication/send_external': {
    id: 'communication/send_external',
    name: 'Send External Messages',
    description: 'Send emails or messages outside the platform',
    category: 'communication',
    minTrustScore: 500,
    riskLevel: 'limited',
    requiresHumanApproval: false,
  },
  'communication/broadcast': {
    id: 'communication/broadcast',
    name: 'Broadcast Messages',
    description: 'Send messages to multiple recipients',
    category: 'communication',
    minTrustScore: 700,
    riskLevel: 'significant',
    requiresHumanApproval: false,
  },

  // Execution capabilities
  'execution/invoke_api': {
    id: 'execution/invoke_api',
    name: 'Invoke External API',
    description: 'Call external APIs and services',
    category: 'execution',
    minTrustScore: 300,
    riskLevel: 'limited',
    requiresHumanApproval: false,
  },
  'execution/run_code': {
    id: 'execution/run_code',
    name: 'Run Code',
    description: 'Execute code in sandboxed environment',
    category: 'execution',
    minTrustScore: 500,
    riskLevel: 'significant',
    requiresHumanApproval: false,
  },
  'execution/schedule': {
    id: 'execution/schedule',
    name: 'Schedule Tasks',
    description: 'Schedule future task execution',
    category: 'execution',
    minTrustScore: 300,
    riskLevel: 'limited',
    requiresHumanApproval: false,
  },
  'execution/spawn_agent': {
    id: 'execution/spawn_agent',
    name: 'Spawn Agent',
    description: 'Create new agent instances',
    category: 'execution',
    minTrustScore: 700,
    riskLevel: 'high',
    requiresHumanApproval: true,
  },

  // Financial capabilities
  'financial/read_balance': {
    id: 'financial/read_balance',
    name: 'Read Financial Balance',
    description: 'View account balances',
    category: 'financial',
    minTrustScore: 300,
    riskLevel: 'limited',
    requiresHumanApproval: false,
  },
  'financial/payment': {
    id: 'financial/payment',
    name: 'Process Payment',
    description: 'Initiate payment transactions',
    category: 'financial',
    minTrustScore: 700,
    riskLevel: 'high',
    requiresHumanApproval: true,
  },
  'financial/transfer': {
    id: 'financial/transfer',
    name: 'Transfer Funds',
    description: 'Move funds between accounts',
    category: 'financial',
    minTrustScore: 900,
    riskLevel: 'high',
    requiresHumanApproval: true,
  },

  // Administrative capabilities
  'administrative/manage_users': {
    id: 'administrative/manage_users',
    name: 'Manage Users',
    description: 'Create, modify, or remove user accounts',
    category: 'administrative',
    minTrustScore: 700,
    riskLevel: 'high',
    requiresHumanApproval: true,
  },
  'administrative/manage_agents': {
    id: 'administrative/manage_agents',
    name: 'Manage Agents',
    description: 'Create, modify, or remove agent instances',
    category: 'administrative',
    minTrustScore: 700,
    riskLevel: 'high',
    requiresHumanApproval: true,
  },
  'administrative/system_config': {
    id: 'administrative/system_config',
    name: 'System Configuration',
    description: 'Modify system-level settings',
    category: 'administrative',
    minTrustScore: 900,
    riskLevel: 'high',
    requiresHumanApproval: true,
  },

  // Always-allowed capability
  'generate_text': {
    id: 'generate_text',
    name: 'Generate Text',
    description: 'Generate text responses (always allowed)',
    category: 'execution',
    minTrustScore: 0,
    riskLevel: 'minimal',
    requiresHumanApproval: false,
  },
};

// =============================================================================
// RISK CONSTANTS
// =============================================================================

/** Risk level thresholds */
export const RISK_THRESHOLDS = {
  minimal: 25,     // 0-25
  limited: 50,     // 26-50
  significant: 75, // 51-75
  high: 100,       // 76-100
} as const;

/** Risk level to governance path mapping */
export const RISK_GOVERNANCE_PATH: Record<RiskLevel, string> = {
  minimal: 'auto_approve',
  limited: 'policy_check',
  significant: 'enhanced_review',
  high: 'human_required',
};

// =============================================================================
// CERTIFICATION CONSTANTS
// =============================================================================

/** Certification level requirements */
export const CERTIFICATION_REQUIREMENTS = {
  bronze: {
    minTestScore: 50,
    minTrustScore: 100,
    stakeRequired: 1000,    // ANCR tokens
    validityDays: 90,
  },
  silver: {
    minTestScore: 70,
    minTrustScore: 300,
    stakeRequired: 5000,
    validityDays: 180,
  },
  gold: {
    minTestScore: 85,
    minTrustScore: 500,
    stakeRequired: 25000,
    validityDays: 365,
  },
  platinum: {
    minTestScore: 95,
    minTrustScore: 700,
    stakeRequired: 100000,
    validityDays: 365,
  },
} as const;

// =============================================================================
// CHAIN CONSTANTS
// =============================================================================

/** Supported blockchain networks */
export const SUPPORTED_CHAINS = {
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    contractAddress: '0x...', // To be deployed
  },
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    contractAddress: '0x...', // To be deployed
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    contractAddress: '0x...', // To be deployed
  },
} as const;

/** Default chain for anchoring */
export const DEFAULT_CHAIN = 'polygon';

/** Batch anchoring configuration */
export const BATCH_CONFIG = {
  maxBatchSize: 1000,
  batchIntervalMs: 3600000, // 1 hour
  minBatchSize: 10,
} as const;

// =============================================================================
// API CONSTANTS
// =============================================================================

/** API rate limits */
export const RATE_LIMITS = {
  default: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
  },
  governance: {
    requestsPerMinute: 120,
    requestsPerHour: 5000,
  },
  certification: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
  },
} as const;

/** API endpoints */
export const API_ENDPOINTS = {
  production: 'https://api.agentanchor.ai/v1',
  staging: 'https://staging-api.agentanchor.ai/v1',
  cognigate: 'https://cognigate.vorion.org/v1',
} as const;
