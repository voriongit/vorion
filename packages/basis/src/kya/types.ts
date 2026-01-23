/**
 * KYA Framework Type Definitions
 */

// ============================================================================
// Configuration
// ============================================================================

export interface KYAConfig {
  didResolver: DIDResolverConfig;
  policyEngine: PolicyEngineConfig;
  database: DatabaseConfig;
}

export interface DIDResolverConfig {
  networks: string[];  // e.g., ['vorion', 'ethereum', 'polygon']
  resolverUrl?: string;
  cacheEnabled?: boolean;
}

export interface PolicyEngineConfig {
  policyBundlesPath: string;
  defaultJurisdiction: string;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  connectionString: string;
}

// ============================================================================
// Identity
// ============================================================================

export interface DIDDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
  service?: ServiceEndpoint[];
  kya?: KYAMetadata;
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface KYAMetadata {
  trustScore: number;
  tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  certified: boolean;
  certifier?: string;
  certificationDate?: string;
  capabilities: string[];
  restrictions: string[];
}

export interface IdentityProof {
  did: string;
  timestamp: number;
  challenge: string;
  signature: string;
  publicKey: string;
}

// ============================================================================
// Authorization
// ============================================================================

export interface AuthorizationRequest {
  agentDID: string;
  action: string;
  resource: string;
  context: {
    timestamp: number;
    sourceIP?: string;
    trustScore?: number;
  };
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
  conditions?: Record<string, unknown>;
  trustImpact?: number;
}

export interface CapabilityToken {
  id: string;
  issuer: string;
  subject: string;
  capabilities: Capability[];
  notBefore: string;
  notAfter: string;
  signature: string;
}

export interface Capability {
  action: string;
  resource: string;
  conditions?: Record<string, unknown>;
}

export interface PolicyBundle {
  id: string;
  version: string;
  jurisdiction: 'US' | 'EU' | 'CA' | 'SG' | 'Global';
  industry?: 'finance' | 'healthcare' | 'government' | 'enterprise';
  constraints: Constraint[];
  obligations: Obligation[];
  permissions: Permission[];
}

export interface Constraint {
  id: string;
  description: string;
  rule: string;  // CEL expression or JSON Logic
  severity: 'low' | 'medium' | 'high' | 'critical';
  enforcement: 'block' | 'warn' | 'log';
}

export interface Obligation {
  id: string;
  description: string;
  rule: string;
  action: string;
}

export interface Permission {
  id: string;
  description: string;
  action: string;
  resource: string;
  minTrustScore: number;
}

// ============================================================================
// Accountability
// ============================================================================

export interface AccountabilityRecord {
  id: string;
  timestamp: number;
  agentDID: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'denied';
  evidence: {
    intentHash: string;
    authorizationDecision: AuthorizationDecision;
    executionResult?: unknown;
  };
  signature: string;
  witnessSignature?: string;
  chainLink: {
    prevHash: string | null;
    merkleRoot?: string;
  };
}

export interface AccountabilityVerification {
  valid: boolean;
  totalRecords: number;
  brokenLinks: number;
  issues?: string[];
}

// ============================================================================
// Behavior Monitoring
// ============================================================================

export interface BehaviorProfile {
  agentDID: string;
  baseline: {
    actionsPerHour: { mean: number; stddev: number };
    successRate: { mean: number; stddev: number };
    topActions: Array<{ action: string; frequency: number }>;
    topResources: Array<{ resource: string; frequency: number }>;
  };
  recentWindow: {
    actionsInLastHour: number;
    successRateLastHour: number;
    newActionsInLastHour: string[];
    newResourcesInLastHour: string[];
  };
}

export interface AnomalyAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  evidence: unknown;
  recommendedAction: 'log' | 'warn' | 'throttle' | 'suspend';
  trustImpact: number;
}

// ============================================================================
// Trust Scoring
// ============================================================================

export interface TrustScoreComponents {
  runtimeFactors: {
    impact: number;       // 0-1 (blast radius)
    confidence: number;   // 0-1 (parsing certainty)
    precedent: number;    // 0-1 (history match)
    context: number;      // 0-1 (environmental safety)
  };
  cumulativeTrust: {
    CT: number;           // Cumulative earned
    BT: number;           // Burned (negative)
    GT: number;           // Granted (certifications)
    XT: number;           // Exceptional (peer-awarded)
    AC: number;           // Agent class base
  };
  developmentLineage?: {
    governanceCoverage: number;  // 0-1
    testCoverage: number;        // 0-1
    reviewDepth: number;         // 0-1
    patternCompliance: number;   // 0-1
  };
}

export interface TrustScoreUpdate {
  agentDID: string;
  oldScore: number;
  newScore: number;
  oldTier: string;
  newTier: string;
  reason: string;
  timestamp: number;
}
