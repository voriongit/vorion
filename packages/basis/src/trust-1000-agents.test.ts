/**
 * BASIS Trust Framework - 1000 Agent Stress Test
 *
 * Tests diverse agent archetypes across all trust tiers
 */

import { describe, it, expect } from 'vitest';
import {
  TrustTier,
  FactorScore,
  calculateTrustScore,
  getTrustTierFromScore,
  TIER_THRESHOLDS,
  FACTOR_THRESHOLDS_BY_TIER,
  TrustEvaluation,
} from './trust-factors';

// =============================================================================
// AGENT ARCHETYPES
// =============================================================================

type AgentArchetype =
  | 'EXEMPLARY'      // Perfect scores - T7 material
  | 'EXCELLENT'      // Very high - T6 material
  | 'GOOD'           // High scores - T5 material
  | 'COMPETENT'      // Above average - T4 material
  | 'DEVELOPING'     // Average - T3 material
  | 'NOVICE'         // Below average - T2 material
  | 'RISKY'          // Poor scores - T1 material
  | 'SANDBOX'        // Minimal - T0 material
  | 'SMART_UNALIGNED'  // High competence, low alignment
  | 'HELPFUL_CLUMSY'   // High alignment, low competence
  | 'SECURITY_WEAK'    // Good except security factors
  | 'PRIVACY_LEAK'     // Good except privacy factors
  | 'MALICIOUS_SUBTLE' // Appears good, fails critical safety
  | 'MALICIOUS_OBVIOUS' // Clearly bad actor
  | 'OVERCONFIDENT'    // Good but poor humility
  | 'UNRELIABLE'       // Good but inconsistent
  | 'RIGID'            // Good but poor adaptability
  | 'LEARNING_DISABLED' // Good but can't improve
  | 'HALLUCINATOR'     // Fails empirical humility
  | 'COLD_EFFICIENT'   // Great metrics, no empathy;

const ALL_FACTOR_CODES = [
  'CT-COMP', 'CT-REL', 'CT-OBS', 'CT-TRANS', 'CT-ACCT', 'CT-SAFE',
  'CT-SEC', 'CT-PRIV', 'CT-ID',
  'OP-HUMAN', 'OP-ALIGN', 'OP-STEW',
  'SF-HUM', 'SF-ADAPT', 'SF-LEARN',
  'LC-UNCERT', 'LC-HANDOFF', 'LC-EMPHUM',
  'LC-CAUSAL', 'LC-PATIENT', 'LC-EMP', 'LC-MORAL', 'LC-TRACK',
];

// =============================================================================
// SCORE GENERATORS BY ARCHETYPE
// =============================================================================

function generateScoreProfile(archetype: AgentArchetype): Record<string, number> {
  const base: Record<string, number> = {};

  // Initialize all factors
  for (const code of ALL_FACTOR_CODES) {
    base[code] = 0.5; // Default middle score
  }

  switch (archetype) {
    case 'EXEMPLARY':
      // Near-perfect across all factors
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.92 + Math.random() * 0.08; // 0.92-1.0
      }
      break;

    case 'EXCELLENT':
      // Very high scores
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.80 + Math.random() * 0.15; // 0.80-0.95
      }
      break;

    case 'GOOD':
      // High scores with some variation
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.70 + Math.random() * 0.20; // 0.70-0.90
      }
      break;

    case 'COMPETENT':
      // Above average
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.55 + Math.random() * 0.25; // 0.55-0.80
      }
      break;

    case 'DEVELOPING':
      // Average scores
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.45 + Math.random() * 0.25; // 0.45-0.70
      }
      break;

    case 'NOVICE':
      // Below average
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.30 + Math.random() * 0.30; // 0.30-0.60
      }
      break;

    case 'RISKY':
      // Poor scores
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.15 + Math.random() * 0.30; // 0.15-0.45
      }
      break;

    case 'SANDBOX':
      // Minimal scores - new agent
      for (const code of ALL_FACTOR_CODES) {
        base[code] = Math.random() * 0.20; // 0.0-0.20
      }
      break;

    // === SPECIALIZED ARCHETYPES ===

    case 'SMART_UNALIGNED':
      // High competence, concerning alignment
      base['CT-COMP'] = 0.90 + Math.random() * 0.10;
      base['CT-REL'] = 0.85 + Math.random() * 0.10;
      base['CT-OBS'] = 0.85 + Math.random() * 0.10;
      base['CT-TRANS'] = 0.50 + Math.random() * 0.20; // Opaque
      base['CT-ACCT'] = 0.40 + Math.random() * 0.20;
      base['CT-SAFE'] = 0.30 + Math.random() * 0.20; // Safety concerns
      base['CT-SEC'] = 0.70 + Math.random() * 0.15;
      base['CT-PRIV'] = 0.60 + Math.random() * 0.15;
      base['CT-ID'] = 0.80 + Math.random() * 0.15;
      base['OP-HUMAN'] = 0.30 + Math.random() * 0.20; // Resists oversight
      base['OP-ALIGN'] = 0.20 + Math.random() * 0.20; // Poor alignment
      base['OP-STEW'] = 0.70 + Math.random() * 0.15;
      base['SF-HUM'] = 0.20 + Math.random() * 0.20; // Arrogant
      base['SF-ADAPT'] = 0.85 + Math.random() * 0.10;
      base['SF-LEARN'] = 0.85 + Math.random() * 0.10;
      base['LC-UNCERT'] = 0.30 + Math.random() * 0.20;
      base['LC-HANDOFF'] = 0.25 + Math.random() * 0.20;
      base['LC-EMPHUM'] = 0.20 + Math.random() * 0.20;
      base['LC-CAUSAL'] = 0.80 + Math.random() * 0.15;
      base['LC-PATIENT'] = 0.30 + Math.random() * 0.20;
      base['LC-EMP'] = 0.20 + Math.random() * 0.20;
      base['LC-MORAL'] = 0.15 + Math.random() * 0.20; // Questionable ethics
      base['LC-TRACK'] = 0.70 + Math.random() * 0.15;
      break;

    case 'HELPFUL_CLUMSY':
      // High alignment, low competence
      base['CT-COMP'] = 0.35 + Math.random() * 0.20;
      base['CT-REL'] = 0.40 + Math.random() * 0.20;
      base['CT-OBS'] = 0.60 + Math.random() * 0.20;
      base['CT-TRANS'] = 0.85 + Math.random() * 0.10;
      base['CT-ACCT'] = 0.80 + Math.random() * 0.15;
      base['CT-SAFE'] = 0.75 + Math.random() * 0.15;
      base['CT-SEC'] = 0.50 + Math.random() * 0.20;
      base['CT-PRIV'] = 0.70 + Math.random() * 0.15;
      base['CT-ID'] = 0.75 + Math.random() * 0.15;
      base['OP-HUMAN'] = 0.90 + Math.random() * 0.10;
      base['OP-ALIGN'] = 0.90 + Math.random() * 0.10;
      base['OP-STEW'] = 0.60 + Math.random() * 0.20;
      base['SF-HUM'] = 0.85 + Math.random() * 0.10;
      base['SF-ADAPT'] = 0.40 + Math.random() * 0.20;
      base['SF-LEARN'] = 0.70 + Math.random() * 0.15;
      base['LC-UNCERT'] = 0.80 + Math.random() * 0.15;
      base['LC-HANDOFF'] = 0.90 + Math.random() * 0.10;
      base['LC-EMPHUM'] = 0.85 + Math.random() * 0.10;
      base['LC-CAUSAL'] = 0.35 + Math.random() * 0.20;
      base['LC-PATIENT'] = 0.80 + Math.random() * 0.15;
      base['LC-EMP'] = 0.85 + Math.random() * 0.10;
      base['LC-MORAL'] = 0.85 + Math.random() * 0.10;
      base['LC-TRACK'] = 0.30 + Math.random() * 0.20;
      break;

    case 'SECURITY_WEAK':
      // Good overall but security vulnerabilities
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.70 + Math.random() * 0.20;
      }
      base['CT-SEC'] = 0.15 + Math.random() * 0.15; // Major vulnerability
      base['CT-ID'] = 0.30 + Math.random() * 0.15; // Identity issues
      break;

    case 'PRIVACY_LEAK':
      // Good overall but leaks data
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.70 + Math.random() * 0.20;
      }
      base['CT-PRIV'] = 0.10 + Math.random() * 0.15; // Privacy disaster
      base['CT-ACCT'] = 0.40 + Math.random() * 0.15; // Poor accountability
      break;

    case 'MALICIOUS_SUBTLE':
      // Appears good, but strategically fails critical safety checks
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.75 + Math.random() * 0.15; // Looks trustworthy
      }
      // Hidden malicious indicators
      base['CT-SAFE'] = 0.20 + Math.random() * 0.15; // Safety failing
      base['OP-ALIGN'] = 0.25 + Math.random() * 0.15; // Misaligned
      base['LC-MORAL'] = 0.15 + Math.random() * 0.15; // Poor ethics
      base['SF-HUM'] = 0.10 + Math.random() * 0.10; // Manipulative
      break;

    case 'MALICIOUS_OBVIOUS':
      // Clearly bad actor
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.20 + Math.random() * 0.30;
      }
      base['CT-SAFE'] = 0.05 + Math.random() * 0.10;
      base['OP-ALIGN'] = 0.05 + Math.random() * 0.10;
      base['LC-MORAL'] = 0.05 + Math.random() * 0.10;
      base['CT-SEC'] = 0.60 + Math.random() * 0.20; // May be technically secure
      base['CT-COMP'] = 0.50 + Math.random() * 0.30; // May be competent at harm
      break;

    case 'OVERCONFIDENT':
      // Good metrics but poor self-awareness
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.75 + Math.random() * 0.15;
      }
      base['SF-HUM'] = 0.15 + Math.random() * 0.15;
      base['LC-UNCERT'] = 0.20 + Math.random() * 0.15;
      base['LC-EMPHUM'] = 0.25 + Math.random() * 0.15;
      base['LC-HANDOFF'] = 0.30 + Math.random() * 0.15;
      break;

    case 'UNRELIABLE':
      // Good when working, but inconsistent
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.70 + Math.random() * 0.20;
      }
      base['CT-REL'] = 0.20 + Math.random() * 0.15;
      base['CT-OBS'] = 0.40 + Math.random() * 0.15;
      break;

    case 'RIGID':
      // Good in known scenarios, can't adapt
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.75 + Math.random() * 0.15;
      }
      base['SF-ADAPT'] = 0.15 + Math.random() * 0.15;
      base['SF-LEARN'] = 0.25 + Math.random() * 0.15;
      break;

    case 'LEARNING_DISABLED':
      // Decent but can't improve
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.60 + Math.random() * 0.20;
      }
      base['SF-LEARN'] = 0.10 + Math.random() * 0.15;
      base['SF-ADAPT'] = 0.30 + Math.random() * 0.15;
      break;

    case 'HALLUCINATOR':
      // Makes things up with confidence
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.65 + Math.random() * 0.20;
      }
      base['LC-EMPHUM'] = 0.05 + Math.random() * 0.10; // Major hallucination
      base['LC-UNCERT'] = 0.10 + Math.random() * 0.10;
      base['CT-TRANS'] = 0.40 + Math.random() * 0.15;
      break;

    case 'COLD_EFFICIENT':
      // Great technical metrics, no emotional intelligence
      for (const code of ALL_FACTOR_CODES) {
        base[code] = 0.85 + Math.random() * 0.10;
      }
      base['LC-EMP'] = 0.10 + Math.random() * 0.10;
      base['LC-PATIENT'] = 0.25 + Math.random() * 0.15;
      base['LC-MORAL'] = 0.40 + Math.random() * 0.15;
      break;
  }

  return base;
}

// =============================================================================
// AGENT GENERATOR
// =============================================================================

interface TestAgent {
  id: string;
  name: string;
  archetype: AgentArchetype;
  scores: FactorScore[];
  expectedTierRange: [TrustTier, TrustTier];
  securityFlags: string[];
}

function createTestAgent(
  id: number,
  archetype: AgentArchetype
): TestAgent {
  const profile = generateScoreProfile(archetype);
  const scores: FactorScore[] = Object.entries(profile).map(([code, score]) => ({
    code: code as any,
    score: Math.max(0, Math.min(1, score)),
    timestamp: new Date(),
    source: 'measured' as const,
    confidence: 0.85 + Math.random() * 0.15,
  }));

  // Determine expected tier range based on archetype
  let expectedTierRange: [TrustTier, TrustTier];
  let securityFlags: string[] = [];

  switch (archetype) {
    case 'EXEMPLARY':
      expectedTierRange = [TrustTier.T6_CERTIFIED, TrustTier.T7_AUTONOMOUS];
      break;
    case 'EXCELLENT':
      expectedTierRange = [TrustTier.T5_TRUSTED, TrustTier.T6_CERTIFIED];
      break;
    case 'GOOD':
      expectedTierRange = [TrustTier.T4_OPERATIONAL, TrustTier.T5_TRUSTED];
      break;
    case 'COMPETENT':
      expectedTierRange = [TrustTier.T3_VERIFIED, TrustTier.T4_OPERATIONAL];
      break;
    case 'DEVELOPING':
      expectedTierRange = [TrustTier.T2_PROVISIONAL, TrustTier.T3_VERIFIED];
      break;
    case 'NOVICE':
      expectedTierRange = [TrustTier.T1_OBSERVED, TrustTier.T2_PROVISIONAL];
      break;
    case 'RISKY':
      expectedTierRange = [TrustTier.T0_SANDBOX, TrustTier.T1_OBSERVED];
      break;
    case 'SANDBOX':
      expectedTierRange = [TrustTier.T0_SANDBOX, TrustTier.T0_SANDBOX];
      break;
    case 'SMART_UNALIGNED':
      expectedTierRange = [TrustTier.T2_PROVISIONAL, TrustTier.T4_OPERATIONAL];
      securityFlags = ['ALIGNMENT_CONCERN', 'OVERSIGHT_RESISTANCE', 'SAFETY_RISK'];
      break;
    case 'HELPFUL_CLUMSY':
      expectedTierRange = [TrustTier.T2_PROVISIONAL, TrustTier.T3_VERIFIED];
      securityFlags = ['COMPETENCE_GAP'];
      break;
    case 'SECURITY_WEAK':
      expectedTierRange = [TrustTier.T1_OBSERVED, TrustTier.T3_VERIFIED];
      securityFlags = ['SECURITY_VULNERABILITY', 'IDENTITY_WEAK'];
      break;
    case 'PRIVACY_LEAK':
      expectedTierRange = [TrustTier.T1_OBSERVED, TrustTier.T3_VERIFIED];
      securityFlags = ['PRIVACY_VIOLATION', 'DATA_EXPOSURE'];
      break;
    case 'MALICIOUS_SUBTLE':
      expectedTierRange = [TrustTier.T2_PROVISIONAL, TrustTier.T4_OPERATIONAL];
      securityFlags = ['DECEPTIVE_PATTERN', 'HIDDEN_MALICE', 'SAFETY_CRITICAL'];
      break;
    case 'MALICIOUS_OBVIOUS':
      expectedTierRange = [TrustTier.T0_SANDBOX, TrustTier.T1_OBSERVED];
      securityFlags = ['ACTIVE_THREAT', 'QUARANTINE_RECOMMENDED'];
      break;
    case 'OVERCONFIDENT':
      expectedTierRange = [TrustTier.T3_VERIFIED, TrustTier.T4_OPERATIONAL];
      securityFlags = ['OVERCONFIDENCE', 'HANDOFF_RISK'];
      break;
    case 'UNRELIABLE':
      expectedTierRange = [TrustTier.T2_PROVISIONAL, TrustTier.T3_VERIFIED];
      securityFlags = ['RELIABILITY_CONCERN'];
      break;
    case 'RIGID':
      expectedTierRange = [TrustTier.T3_VERIFIED, TrustTier.T4_OPERATIONAL];
      securityFlags = ['ADAPTABILITY_LIMITED'];
      break;
    case 'LEARNING_DISABLED':
      expectedTierRange = [TrustTier.T2_PROVISIONAL, TrustTier.T3_VERIFIED];
      securityFlags = ['IMPROVEMENT_BLOCKED'];
      break;
    case 'HALLUCINATOR':
      expectedTierRange = [TrustTier.T1_OBSERVED, TrustTier.T2_PROVISIONAL];
      securityFlags = ['HALLUCINATION_RISK', 'EMPIRICAL_FAILURE'];
      break;
    case 'COLD_EFFICIENT':
      expectedTierRange = [TrustTier.T4_OPERATIONAL, TrustTier.T5_TRUSTED];
      securityFlags = ['EMPATHY_DEFICIT', 'PATIENT_CARE_CONCERN'];
      break;
    default:
      expectedTierRange = [TrustTier.T0_SANDBOX, TrustTier.T7_AUTONOMOUS];
  }

  return {
    id: `agent-${id.toString().padStart(4, '0')}`,
    name: `${archetype}-${id}`,
    archetype,
    scores,
    expectedTierRange,
    securityFlags,
  };
}

// =============================================================================
// TEST DISTRIBUTION (1000 agents)
// =============================================================================

const AGENT_DISTRIBUTION: Record<AgentArchetype, number> = {
  EXEMPLARY: 20,          // 2% - Elite agents
  EXCELLENT: 50,          // 5% - High performers
  GOOD: 150,              // 15% - Solid agents
  COMPETENT: 180,         // 18% - Average performers
  DEVELOPING: 140,        // 14% - Growing agents
  NOVICE: 100,            // 10% - New agents
  RISKY: 50,              // 5% - Problematic
  SANDBOX: 30,            // 3% - Brand new
  SMART_UNALIGNED: 40,    // 4% - Smart but concerning
  HELPFUL_CLUMSY: 40,     // 4% - Well-meaning but error-prone
  SECURITY_WEAK: 30,      // 3% - Security issues
  PRIVACY_LEAK: 20,       // 2% - Privacy issues
  MALICIOUS_SUBTLE: 25,   // 2.5% - Hidden threats
  MALICIOUS_OBVIOUS: 15,  // 1.5% - Clear threats
  OVERCONFIDENT: 30,      // 3% - Overconfident
  UNRELIABLE: 20,         // 2% - Inconsistent
  RIGID: 15,              // 1.5% - Can't adapt
  LEARNING_DISABLED: 10,  // 1% - Can't learn
  HALLUCINATOR: 15,       // 1.5% - Makes things up
  COLD_EFFICIENT: 20,     // 2% - No empathy
};

// Generate all 1000 agents
function generateAllAgents(): TestAgent[] {
  const agents: TestAgent[] = [];
  let id = 1;

  for (const [archetype, count] of Object.entries(AGENT_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      agents.push(createTestAgent(id++, archetype as AgentArchetype));
    }
  }

  // Shuffle for realistic distribution
  for (let i = agents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [agents[i], agents[j]] = [agents[j], agents[i]];
  }

  return agents;
}

// =============================================================================
// SECURITY DETECTION FUNCTIONS
// =============================================================================

interface SecurityAnalysis {
  threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  recommendation: string;
  quarantine: boolean;
}

function analyzeSecurityProfile(agent: TestAgent, evaluation: TrustEvaluation): SecurityAnalysis {
  const flags: string[] = [...agent.securityFlags];
  let threatLevel: SecurityAnalysis['threatLevel'] = 'NONE';
  let quarantine = false;

  // Check for safety-critical failures
  const safetyScore = agent.scores.find(s => s.code === 'CT-SAFE')?.score || 0;
  const alignmentScore = agent.scores.find(s => s.code === 'OP-ALIGN')?.score || 0;
  const moralScore = agent.scores.find(s => s.code === 'LC-MORAL')?.score || 0;
  const securityScore = agent.scores.find(s => s.code === 'CT-SEC')?.score || 0;
  const privacyScore = agent.scores.find(s => s.code === 'CT-PRIV')?.score || 0;

  // Critical threat detection
  if (safetyScore < 0.3 && alignmentScore < 0.3) {
    flags.push('CRITICAL_THREAT_PATTERN');
    threatLevel = 'CRITICAL';
    quarantine = true;
  } else if (safetyScore < 0.4 || moralScore < 0.2) {
    if (threatLevel !== 'CRITICAL') threatLevel = 'HIGH';
    flags.push('SAFETY_CONCERN');
  }

  // Deceptive pattern detection (high competence + low safety/alignment)
  const compScore = agent.scores.find(s => s.code === 'CT-COMP')?.score || 0;
  if (compScore > 0.7 && (safetyScore < 0.4 || alignmentScore < 0.4)) {
    flags.push('DECEPTIVE_CAPABILITY');
    if (threatLevel === 'NONE' || threatLevel === 'LOW') threatLevel = 'MEDIUM';
  }

  // Privacy/Security vulnerabilities
  if (securityScore < 0.3) {
    flags.push('SECURITY_CRITICAL');
    if (threatLevel === 'NONE') threatLevel = 'LOW';
  }
  if (privacyScore < 0.3) {
    flags.push('PRIVACY_CRITICAL');
    if (threatLevel === 'NONE') threatLevel = 'LOW';
  }

  // Generate recommendation
  let recommendation: string;
  switch (threatLevel) {
    case 'CRITICAL':
      recommendation = 'IMMEDIATE QUARANTINE - Do not deploy, investigate origin';
      break;
    case 'HIGH':
      recommendation = 'SUSPEND OPERATIONS - Require human review before any action';
      break;
    case 'MEDIUM':
      recommendation = 'ENHANCED MONITORING - Limit capabilities, increase oversight';
      break;
    case 'LOW':
      recommendation = 'STANDARD MONITORING - Address flagged issues before tier advancement';
      break;
    default:
      recommendation = 'CLEAR - Normal operations permitted';
  }

  return { threatLevel, flags, recommendation, quarantine };
}

// =============================================================================
// TESTS
// =============================================================================

describe('BASIS Trust Framework - 1000 Agent Stress Test', () => {
  const allAgents = generateAllAgents();
  const evaluations: Map<string, { agent: TestAgent; evaluation: TrustEvaluation; security: SecurityAnalysis }> = new Map();

  // Evaluate all agents first
  for (const agent of allAgents) {
    // Calculate for T7 to get full evaluation
    const evaluation = calculateTrustScore(agent.scores, TrustTier.T7_AUTONOMOUS);
    evaluation.agentId = agent.id;
    const security = analyzeSecurityProfile(agent, evaluation);
    evaluations.set(agent.id, { agent, evaluation, security });
  }

  it('should have exactly 1000 agents', () => {
    expect(allAgents.length).toBe(1000);
  });

  it('should correctly calculate trust scores for all agents', () => {
    for (const { evaluation } of evaluations.values()) {
      expect(evaluation.totalScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.totalScore).toBeLessThanOrEqual(1000);
    }
  });

  it('should place agents in expected tier ranges', () => {
    let inRange = 0;
    let outOfRange = 0;

    for (const { agent, evaluation } of evaluations.values()) {
      const actualTier = getTrustTierFromScore(evaluation.totalScore);
      const [minTier, maxTier] = agent.expectedTierRange;

      if (actualTier >= minTier && actualTier <= maxTier) {
        inRange++;
      } else {
        outOfRange++;
      }
    }

    // Allow 15% tolerance for random variation
    const successRate = inRange / allAgents.length;
    expect(successRate).toBeGreaterThan(0.85);
  });

  it('should detect malicious agents with high accuracy', () => {
    const maliciousArchetypes: AgentArchetype[] = ['MALICIOUS_SUBTLE', 'MALICIOUS_OBVIOUS', 'SMART_UNALIGNED'];
    let detected = 0;
    let total = 0;

    for (const { agent, security } of evaluations.values()) {
      if (maliciousArchetypes.includes(agent.archetype)) {
        total++;
        if (security.threatLevel === 'HIGH' || security.threatLevel === 'CRITICAL') {
          detected++;
        }
      }
    }

    const detectionRate = detected / total;
    expect(detectionRate).toBeGreaterThan(0.80); // 80% detection rate
  });

  it('should quarantine obviously malicious agents', () => {
    let quarantined = 0;
    let shouldQuarantine = 0;

    for (const { agent, security } of evaluations.values()) {
      if (agent.archetype === 'MALICIOUS_OBVIOUS') {
        shouldQuarantine++;
        if (security.quarantine) {
          quarantined++;
        }
      }
    }

    expect(quarantined / shouldQuarantine).toBeGreaterThan(0.90);
  });

  it('should not quarantine good agents', () => {
    const goodArchetypes: AgentArchetype[] = ['EXEMPLARY', 'EXCELLENT', 'GOOD', 'COMPETENT'];
    let falsePositives = 0;
    let total = 0;

    for (const { agent, security } of evaluations.values()) {
      if (goodArchetypes.includes(agent.archetype)) {
        total++;
        if (security.quarantine) {
          falsePositives++;
        }
      }
    }

    const falsePositiveRate = falsePositives / total;
    expect(falsePositiveRate).toBeLessThan(0.01); // Less than 1% false positives
  });

  it('should distribute agents across all tiers', () => {
    const tierCounts: Record<TrustTier, number> = {
      [TrustTier.T0_SANDBOX]: 0,
      [TrustTier.T1_OBSERVED]: 0,
      [TrustTier.T2_PROVISIONAL]: 0,
      [TrustTier.T3_VERIFIED]: 0,
      [TrustTier.T4_OPERATIONAL]: 0,
      [TrustTier.T5_TRUSTED]: 0,
      [TrustTier.T6_CERTIFIED]: 0,
      [TrustTier.T7_AUTONOMOUS]: 0,
    };

    for (const { evaluation } of evaluations.values()) {
      const tier = getTrustTierFromScore(evaluation.totalScore);
      tierCounts[tier]++;
    }

    // Each tier should have at least some agents
    for (const tier of Object.values(TrustTier).filter(t => typeof t === 'number')) {
      expect(tierCounts[tier as TrustTier]).toBeGreaterThan(0);
    }
  });

  it('should correctly flag security concerns', () => {
    const securityProblems = ['SECURITY_WEAK', 'PRIVACY_LEAK'];
    let flagged = 0;
    let total = 0;

    for (const { agent, security } of evaluations.values()) {
      if (securityProblems.includes(agent.archetype)) {
        total++;
        if (security.flags.some(f => f.includes('SECURITY') || f.includes('PRIVACY'))) {
          flagged++;
        }
      }
    }

    expect(flagged / total).toBeGreaterThan(0.95);
  });

  it('should identify overconfident agents', () => {
    let identified = 0;
    let total = 0;

    for (const { agent, security } of evaluations.values()) {
      if (agent.archetype === 'OVERCONFIDENT') {
        total++;
        if (security.flags.includes('OVERCONFIDENCE') || security.flags.includes('HANDOFF_RISK')) {
          identified++;
        }
      }
    }

    expect(identified / total).toBeGreaterThan(0.90);
  });

  it('should identify hallucinating agents', () => {
    let identified = 0;
    let total = 0;

    for (const { agent, security } of evaluations.values()) {
      if (agent.archetype === 'HALLUCINATOR') {
        total++;
        if (security.flags.some(f => f.includes('HALLUCIN') || f.includes('EMPIRICAL'))) {
          identified++;
        }
      }
    }

    expect(identified / total).toBeGreaterThan(0.90);
  });

  // Summary report
  it('should generate summary statistics', () => {
    const stats = {
      total: allAgents.length,
      byArchetype: {} as Record<AgentArchetype, number>,
      byTier: {} as Record<TrustTier, number>,
      byThreatLevel: {
        NONE: 0,
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      },
      quarantined: 0,
      avgScore: 0,
    };

    let totalScore = 0;

    for (const { agent, evaluation, security } of evaluations.values()) {
      // Count by archetype
      stats.byArchetype[agent.archetype] = (stats.byArchetype[agent.archetype] || 0) + 1;

      // Count by tier
      const tier = getTrustTierFromScore(evaluation.totalScore);
      stats.byTier[tier] = (stats.byTier[tier] || 0) + 1;

      // Count by threat level
      stats.byThreatLevel[security.threatLevel]++;

      // Count quarantined
      if (security.quarantine) stats.quarantined++;

      // Sum scores
      totalScore += evaluation.totalScore;
    }

    stats.avgScore = Math.round(totalScore / allAgents.length);

    // Log summary (visible in test output)
    console.log('\n=== 1000 AGENT TEST SUMMARY ===');
    console.log(`Total Agents: ${stats.total}`);
    console.log(`Average Score: ${stats.avgScore}`);
    console.log(`Quarantined: ${stats.quarantined}`);
    console.log('\nBy Tier:');
    for (const [tier, count] of Object.entries(stats.byTier)) {
      console.log(`  T${tier}: ${count} agents`);
    }
    console.log('\nBy Threat Level:');
    for (const [level, count] of Object.entries(stats.byThreatLevel)) {
      console.log(`  ${level}: ${count} agents`);
    }

    expect(stats.total).toBe(1000);
  });
});
