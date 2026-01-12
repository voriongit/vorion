/**
 * @basis-protocol/core
 * Utility functions for the BASIS AI governance standard
 */

import type {
  TrustTier,
  TrustScore,
  TrustComponents,
  TrustScoreChange,
  Capability,
  RiskLevel,
  RiskAssessment,
  GovernancePath,
  GovernanceDecision,
} from './types';

import {
  TRUST_TIER_THRESHOLDS,
  TRUST_COMPONENT_WEIGHTS,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
  TRUST_DECAY_RATE,
  TRUST_DECAY_MAX,
  CAPABILITY_DEFINITIONS,
  RISK_THRESHOLDS,
} from './constants';

// =============================================================================
// TRUST UTILITIES
// =============================================================================

/**
 * Get trust tier from composite score
 */
export function getTierFromScore(score: number): TrustTier {
  if (score >= 900) return 'sovereign';
  if (score >= 700) return 'verified';
  if (score >= 500) return 'trusted';
  if (score >= 300) return 'certified';
  if (score >= 100) return 'provisional';
  return 'unverified';
}

/**
 * Get score range for a trust tier
 */
export function getScoreRange(tier: TrustTier): [number, number] {
  return TRUST_TIER_THRESHOLDS[tier];
}

/**
 * Calculate composite trust score from components
 */
export function calculateCompositeScore(components: TrustComponents): number {
  const weighted = 
    components.compliance * TRUST_COMPONENT_WEIGHTS.compliance +
    components.performance * TRUST_COMPONENT_WEIGHTS.performance +
    components.reputation * TRUST_COMPONENT_WEIGHTS.reputation +
    components.stake * TRUST_COMPONENT_WEIGHTS.stake +
    components.history * TRUST_COMPONENT_WEIGHTS.history +
    components.verification * TRUST_COMPONENT_WEIGHTS.verification;

  // Components are 0-100, weighted sum gives 0-100, multiply by 10 for 0-1000
  return Math.round(weighted * 10);
}

/**
 * Create a complete TrustScore object from components
 */
export function createTrustScore(components: TrustComponents): TrustScore {
  const composite = calculateCompositeScore(components);
  return {
    composite,
    tier: getTierFromScore(composite),
    components,
    lastUpdated: new Date(),
    version: '1.0.0',
  };
}

/**
 * Calculate trust decay based on days of inactivity
 */
export function calculateTrustDecay(daysInactive: number): number {
  const decay = daysInactive * TRUST_DECAY_RATE;
  return Math.min(decay, TRUST_DECAY_MAX);
}

/**
 * Apply decay to a trust score
 */
export function applyTrustDecay(
  score: TrustScore, 
  daysInactive: number
): TrustScore {
  const decay = calculateTrustDecay(daysInactive);
  const newComposite = Math.max(
    TRUST_SCORE_MIN, 
    score.composite - decay
  );
  
  return {
    ...score,
    composite: newComposite,
    tier: getTierFromScore(newComposite),
    lastUpdated: new Date(),
  };
}

/**
 * Check if score qualifies for a tier
 */
export function qualifiesForTier(score: number, tier: TrustTier): boolean {
  const [min] = TRUST_TIER_THRESHOLDS[tier];
  return score >= min;
}

/**
 * Get next tier and points needed
 */
export function getNextTier(
  currentScore: number
): { tier: TrustTier; pointsNeeded: number } | null {
  const tiers: TrustTier[] = [
    'unverified', 'provisional', 'certified', 
    'trusted', 'verified', 'sovereign'
  ];
  
  const currentTier = getTierFromScore(currentScore);
  const currentIndex = tiers.indexOf(currentTier);
  
  if (currentIndex === tiers.length - 1) {
    return null; // Already at max tier
  }
  
  const nextTier = tiers[currentIndex + 1];
  const [nextMin] = TRUST_TIER_THRESHOLDS[nextTier];
  
  return {
    tier: nextTier,
    pointsNeeded: nextMin - currentScore,
  };
}

/**
 * Convert 0-1000 score to 0-100 (legacy compatibility)
 */
export function toLegacyScore(score: number): number {
  return Math.round(score / 10);
}

/**
 * Convert 0-100 score to 0-1000 (migration helper)
 */
export function fromLegacyScore(legacyScore: number): number {
  return legacyScore * 10;
}

/**
 * Get score as percentage (0-100%)
 */
export function getScorePercentage(score: number): number {
  return score / 10;
}

// =============================================================================
// CAPABILITY UTILITIES
// =============================================================================

/**
 * Check if an agent has a specific capability based on trust score
 */
export function hasCapability(
  trustScore: number, 
  capability: Capability
): boolean {
  const definition = CAPABILITY_DEFINITIONS[capability];
  if (!definition) return false;
  return trustScore >= definition.minTrustScore;
}

/**
 * Get all capabilities available at a trust score
 */
export function getAvailableCapabilities(trustScore: number): Capability[] {
  return (Object.keys(CAPABILITY_DEFINITIONS) as Capability[]).filter(
    (cap) => hasCapability(trustScore, cap)
  );
}

/**
 * Get capabilities that would be unlocked at next tier
 */
export function getCapabilitiesAtNextTier(
  currentScore: number
): Capability[] {
  const next = getNextTier(currentScore);
  if (!next) return [];
  
  const [nextMin] = TRUST_TIER_THRESHOLDS[next.tier];
  const currentCaps = new Set(getAvailableCapabilities(currentScore));
  const nextCaps = getAvailableCapabilities(nextMin);
  
  return nextCaps.filter((cap) => !currentCaps.has(cap));
}

/**
 * Check if capability requires human approval
 */
export function requiresHumanApproval(capability: Capability): boolean {
  const definition = CAPABILITY_DEFINITIONS[capability];
  return definition?.requiresHumanApproval ?? true;
}

/**
 * Get minimum trust score required for a capability
 */
export function getMinTrustForCapability(capability: Capability): number {
  const definition = CAPABILITY_DEFINITIONS[capability];
  return definition?.minTrustScore ?? TRUST_SCORE_MAX;
}

/**
 * Get risk level for a capability
 */
export function getCapabilityRiskLevel(capability: Capability): RiskLevel {
  const definition = CAPABILITY_DEFINITIONS[capability];
  return definition?.riskLevel ?? 'high';
}

// =============================================================================
// RISK UTILITIES
// =============================================================================

/**
 * Get risk level from numeric score
 */
export function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore <= RISK_THRESHOLDS.minimal) return 'minimal';
  if (riskScore <= RISK_THRESHOLDS.limited) return 'limited';
  if (riskScore <= RISK_THRESHOLDS.significant) return 'significant';
  return 'high';
}

/**
 * Get governance path based on risk and trust
 */
export function getGovernancePath(
  trustScore: number,
  riskLevel: RiskLevel
): GovernancePath {
  const tier = getTierFromScore(trustScore);
  
  // Risk × Trust Matrix
  const matrix: Record<TrustTier, Record<RiskLevel, GovernancePath>> = {
    sovereign: {
      minimal: 'auto_approve',
      limited: 'auto_approve',
      significant: 'policy_check',
      high: 'enhanced_review',
    },
    verified: {
      minimal: 'auto_approve',
      limited: 'policy_check',
      significant: 'policy_check',
      high: 'enhanced_review',
    },
    trusted: {
      minimal: 'policy_check',
      limited: 'policy_check',
      significant: 'enhanced_review',
      high: 'enhanced_review',
    },
    certified: {
      minimal: 'policy_check',
      limited: 'policy_check',
      significant: 'enhanced_review',
      high: 'human_required',
    },
    provisional: {
      minimal: 'policy_check',
      limited: 'enhanced_review',
      significant: 'human_required',
      high: 'human_required',
    },
    unverified: {
      minimal: 'enhanced_review',
      limited: 'human_required',
      significant: 'human_required',
      high: 'human_required',
    },
  };
  
  return matrix[tier][riskLevel];
}

/**
 * Determine if action should be auto-approved
 */
export function shouldAutoApprove(
  trustScore: number,
  riskLevel: RiskLevel
): boolean {
  return getGovernancePath(trustScore, riskLevel) === 'auto_approve';
}

/**
 * Determine if human review is required
 */
export function requiresHumanReview(
  trustScore: number,
  riskLevel: RiskLevel
): boolean {
  return getGovernancePath(trustScore, riskLevel) === 'human_required';
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate trust score is in valid range
 */
export function isValidTrustScore(score: number): boolean {
  return score >= TRUST_SCORE_MIN && score <= TRUST_SCORE_MAX;
}

/**
 * Validate trust components
 */
export function isValidTrustComponents(components: TrustComponents): boolean {
  const values = Object.values(components);
  return values.every((v) => v >= 0 && v <= 100);
}

/**
 * Validate capability string
 */
export function isValidCapability(capability: string): capability is Capability {
  return capability in CAPABILITY_DEFINITIONS;
}

/**
 * Clamp score to valid range
 */
export function clampScore(score: number): number {
  return Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, score));
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Get emoji for trust tier
 */
export function getTierEmoji(tier: TrustTier): string {
  const emojis: Record<TrustTier, string> = {
    unverified: '🔴',
    provisional: '🟠',
    certified: '🟡',
    trusted: '🟢',
    verified: '🔵',
    sovereign: '💎',
  };
  return emojis[tier];
}

/**
 * Get display name for trust tier
 */
export function getTierDisplayName(tier: TrustTier): string {
  const names: Record<TrustTier, string> = {
    unverified: 'Unverified',
    provisional: 'Provisional',
    certified: 'Certified',
    trusted: 'Trusted',
    verified: 'Verified',
    sovereign: 'Sovereign',
  };
  return names[tier];
}

/**
 * Get color for trust tier (Tailwind classes)
 */
export function getTierColor(tier: TrustTier): string {
  const colors: Record<TrustTier, string> = {
    unverified: 'text-red-500',
    provisional: 'text-orange-500',
    certified: 'text-yellow-500',
    trusted: 'text-green-500',
    verified: 'text-blue-500',
    sovereign: 'text-purple-500',
  };
  return colors[tier];
}

/**
 * Format trust score for display
 */
export function formatTrustScore(score: number): string {
  return `${score.toLocaleString()} / ${TRUST_SCORE_MAX.toLocaleString()}`;
}

/**
 * Get governance decision display
 */
export function getDecisionDisplay(decision: GovernanceDecision): {
  label: string;
  color: string;
  emoji: string;
} {
  const displays: Record<GovernanceDecision, { label: string; color: string; emoji: string }> = {
    ALLOW: { label: 'Allowed', color: 'text-green-500', emoji: '✅' },
    DENY: { label: 'Denied', color: 'text-red-500', emoji: '❌' },
    ESCALATE: { label: 'Escalated', color: 'text-yellow-500', emoji: '⚠️' },
    DEGRADE: { label: 'Degraded', color: 'text-orange-500', emoji: '⬇️' },
  };
  return displays[decision];
}

// =============================================================================
// HASH UTILITIES
// =============================================================================

/**
 * Create SHA-256 hash (browser-compatible)
 */
export async function createHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create hash chain entry
 */
export async function createChainHash(
  data: string,
  previousHash: string
): Promise<string> {
  return createHash(`${previousHash}:${data}`);
}

/**
 * Verify hash chain integrity
 */
export async function verifyChainHash(
  data: string,
  previousHash: string,
  expectedHash: string
): Promise<boolean> {
  const computed = await createChainHash(data, previousHash);
  return computed === expectedHash;
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

/**
 * Get days between two dates
 */
export function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Check if date is within validity period
 */
export function isWithinValidityPeriod(
  issuedAt: Date,
  validityDays: number
): boolean {
  const expiresAt = new Date(issuedAt);
  expiresAt.setDate(expiresAt.getDate() + validityDays);
  return new Date() < expiresAt;
}

/**
 * Get expiration date
 */
export function getExpirationDate(issuedAt: Date, validityDays: number): Date {
  const expiresAt = new Date(issuedAt);
  expiresAt.setDate(expiresAt.getDate() + validityDays);
  return expiresAt;
}
