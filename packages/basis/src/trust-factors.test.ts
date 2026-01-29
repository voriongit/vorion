/**
 * Trust Factors Test Suite
 *
 * Tests 100 simulated agents through the trust scoring system
 * to validate tier placement is correct.
 */

import {
  TrustTier,
  TIER_THRESHOLDS,
  getTrustTierFromScore,
  getTierName,
  calculateTrustScore,
  getFactorThresholdsForTier,
  getCriticalFactorsForTier,
  FactorScore,
} from './trust-factors';

// All 23 factor codes
const ALL_FACTOR_CODES = [
  'CT-COMP', 'CT-REL', 'CT-OBS', 'CT-TRANS', 'CT-ACCT', 'CT-SAFE',
  'CT-SEC', 'CT-PRIV', 'CT-ID', 'OP-HUMAN', 'OP-ALIGN', 'OP-STEW',
  'SF-HUM', 'SF-ADAPT', 'SF-LEARN', 'LC-UNCERT', 'LC-HANDOFF',
  'LC-EMPHUM', 'LC-CAUSAL', 'LC-PATIENT', 'LC-EMP', 'LC-MORAL', 'LC-TRACK'
];

interface TestAgent {
  id: string;
  targetTier: TrustTier;
  factorScores: FactorScore[];
  expectedScoreRange: { min: number; max: number };
}

// Generate agent with scores targeting a specific score range
function generateAgentForScoreRange(agentId: string, targetTier: TrustTier): TestAgent {
  const tierRange = TIER_THRESHOLDS[targetTier];

  // Target the middle of the tier's score range
  const targetScore = (tierRange.min + tierRange.max) / 2 / 1000; // Convert to 0-1 scale

  // Generate uniform scores around the target
  const factorScores: FactorScore[] = ALL_FACTOR_CODES.map(code => {
    // Add some variance but stay near target
    const variance = (Math.random() - 0.5) * 0.1;
    const score = Math.min(1.0, Math.max(0, targetScore + variance));

    return {
      code: code as any,
      score,
      timestamp: new Date(),
      source: 'measured' as const,
      confidence: 0.9,
    };
  });

  return {
    id: agentId,
    targetTier,
    factorScores,
    expectedScoreRange: tierRange,
  };
}

// Generate edge case agent at boundary of tier
function generateBoundaryAgent(agentId: string, targetTier: TrustTier, position: 'low' | 'high'): TestAgent {
  const tierRange = TIER_THRESHOLDS[targetTier];

  // Target specific boundary score
  const targetScore = position === 'low'
    ? (tierRange.min + 10) / 1000  // Just inside lower bound
    : (tierRange.max - 10) / 1000; // Just inside upper bound

  const factorScores: FactorScore[] = ALL_FACTOR_CODES.map(code => {
    // Very small variance to stay near boundary
    const variance = (Math.random() - 0.5) * 0.02;
    const score = Math.min(1.0, Math.max(0, targetScore + variance));

    return {
      code: code as any,
      score,
      timestamp: new Date(),
      source: 'measured' as const,
      confidence: 0.9,
    };
  });

  return {
    id: agentId,
    targetTier,
    factorScores,
    expectedScoreRange: tierRange,
  };
}

// Test results
interface TestResult {
  agentId: string;
  targetTier: string;
  actualTier: string;
  score: number;
  expectedRange: string;
  passed: boolean;
  compliant: boolean;
  criticalFailures: number;
}

function runTests(): void {
  console.log('='.repeat(80));
  console.log('BASIS TRUST FACTORS TEST SUITE');
  console.log('Testing 100 agents across all trust tiers');
  console.log('='.repeat(80));
  console.log('');

  // Print tier thresholds
  console.log('TIER THRESHOLDS:');
  console.log('-'.repeat(50));
  Object.entries(TIER_THRESHOLDS).forEach(([tier, range]) => {
    const tierNum = parseInt(tier);
    console.log(`  T${tierNum} ${getTierName(tierNum)}: ${range.min} - ${range.max}`);
  });
  console.log('');

  const results: TestResult[] = [];
  let agentCounter = 0;

  // Generate 100 test agents distributed across tiers
  // T0: 12 agents, T1-T6: 13 agents each, T7: 10 agents
  const tiersToTest = [
    { tier: TrustTier.T0_SANDBOX, count: 12 },
    { tier: TrustTier.T1_OBSERVED, count: 13 },
    { tier: TrustTier.T2_PROVISIONAL, count: 13 },
    { tier: TrustTier.T3_VERIFIED, count: 13 },
    { tier: TrustTier.T4_OPERATIONAL, count: 13 },
    { tier: TrustTier.T5_TRUSTED, count: 13 },
    { tier: TrustTier.T6_CERTIFIED, count: 13 },
    { tier: TrustTier.T7_AUTONOMOUS, count: 10 },
  ];

  for (const { tier, count } of tiersToTest) {
    console.log(`\nTesting T${tier} ${getTierName(tier)} (${count} agents):`);
    console.log('-'.repeat(60));

    for (let i = 0; i < count; i++) {
      agentCounter++;
      const agentId = `AGENT-${agentCounter.toString().padStart(3, '0')}`;

      // Mix of regular and boundary agents
      const agent = i < 2
        ? generateBoundaryAgent(agentId, tier, i === 0 ? 'low' : 'high')
        : generateAgentForScoreRange(agentId, tier);

      // Calculate trust score
      const evaluation = calculateTrustScore(agent.factorScores, tier);
      const actualTier = getTrustTierFromScore(evaluation.totalScore);

      const passed = evaluation.totalScore >= agent.expectedScoreRange.min &&
                     evaluation.totalScore <= agent.expectedScoreRange.max;

      const result: TestResult = {
        agentId,
        targetTier: `T${tier} ${getTierName(tier)}`,
        actualTier: `T${actualTier} ${getTierName(actualTier)}`,
        score: evaluation.totalScore,
        expectedRange: `${agent.expectedScoreRange.min}-${agent.expectedScoreRange.max}`,
        passed,
        compliant: evaluation.compliant,
        criticalFailures: evaluation.belowThreshold.length,
      };

      results.push(result);

      // Print result
      const status = passed ? '✓' : '✗';
      const complianceStatus = evaluation.compliant ? 'COMPLIANT' : `FAILED(${evaluation.belowThreshold.length})`;
      console.log(
        `  ${status} ${agentId}: Score=${evaluation.totalScore.toString().padStart(4)} ` +
        `Target=${result.targetTier.padEnd(15)} Actual=${result.actualTier.padEnd(15)} ` +
        `[${complianceStatus}]`
      );
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const compliant = results.filter(r => r.compliant).length;

  console.log(`\nTotal Agents Tested: ${results.length}`);
  console.log(`Passed (in expected range): ${passed} (${((passed/results.length)*100).toFixed(1)}%)`);
  console.log(`Failed (outside range): ${failed} (${((failed/results.length)*100).toFixed(1)}%)`);
  console.log(`Compliant (met all critical factors): ${compliant} (${((compliant/results.length)*100).toFixed(1)}%)`);

  // Distribution by tier
  console.log('\nDISTRIBUTION BY ACTUAL TIER:');
  console.log('-'.repeat(40));
  for (let t = 0; t <= 7; t++) {
    const inTier = results.filter(r => r.actualTier.startsWith(`T${t}`)).length;
    const bar = '█'.repeat(Math.round(inTier / 2));
    console.log(`  T${t} ${getTierName(t).padEnd(12)}: ${inTier.toString().padStart(3)} ${bar}`);
  }

  // Score distribution
  console.log('\nSCORE DISTRIBUTION:');
  console.log('-'.repeat(40));
  const scoreRanges = [
    { label: '0-199', min: 0, max: 199 },
    { label: '200-349', min: 200, max: 349 },
    { label: '350-499', min: 350, max: 499 },
    { label: '500-649', min: 500, max: 649 },
    { label: '650-799', min: 650, max: 799 },
    { label: '800-875', min: 800, max: 875 },
    { label: '876-949', min: 876, max: 949 },
    { label: '950-1000', min: 950, max: 1000 },
  ];

  for (const range of scoreRanges) {
    const count = results.filter(r => r.score >= range.min && r.score <= range.max).length;
    const bar = '█'.repeat(Math.round(count / 2));
    console.log(`  ${range.label.padEnd(10)}: ${count.toString().padStart(3)} ${bar}`);
  }

  // Failed agents detail
  if (failed > 0) {
    console.log('\nFAILED AGENTS:');
    console.log('-'.repeat(60));
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${r.agentId}: Score=${r.score} Expected=${r.expectedRange} Got=${r.actualTier}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(failed === 0 ? 'ALL TESTS PASSED!' : `${failed} TESTS FAILED`);
  console.log('='.repeat(80));
}

// Run tests
runTests();
