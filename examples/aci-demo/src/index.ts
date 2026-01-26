/**
 * ACI Client Demo Application
 *
 * Demonstrates comprehensive usage of the @vorion/aci-client SDK
 * for Phase 6 Trust Engine integration.
 */

import {
  createACIClient,
  createLocalACIClient,
  getTierFromScore,
  isRoleAllowedForTier,
  TRUST_TIER_RANGES,
  ROLE_LABELS,
  type TrustTier,
  type AgentRole,
} from '@vorion/aci-client'

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_URL = process.env.ACI_API_URL || 'http://localhost:3000'
const API_KEY = process.env.ACI_API_KEY

// =============================================================================
// DEMO FUNCTIONS
// =============================================================================

async function demoStats() {
  console.log('\n📊 DEMO: Dashboard Statistics')
  console.log('='.repeat(50))

  const client = createLocalACIClient()

  try {
    const stats = await client.getStats()

    console.log('\n🏢 Context Stats:')
    console.log(`   Deployments: ${stats.contextStats.deployments}`)
    console.log(`   Organizations: ${stats.contextStats.organizations}`)
    console.log(`   Agents: ${stats.contextStats.agents}`)
    console.log(`   Active Operations: ${stats.contextStats.activeOperations}`)

    console.log('\n🚦 Role Gate Stats:')
    console.log(`   Total Evaluations: ${stats.roleGateStats.totalEvaluations}`)
    console.log(`   Allowed: ${stats.roleGateStats.byDecision.ALLOW}`)
    console.log(`   Denied: ${stats.roleGateStats.byDecision.DENY}`)
    console.log(`   Escalated: ${stats.roleGateStats.byDecision.ESCALATE}`)

    console.log('\n📐 Ceiling Stats:')
    console.log(`   Total Events: ${stats.ceilingStats.totalEvents}`)
    console.log(`   Compliant: ${stats.ceilingStats.complianceBreakdown.compliant}`)
    console.log(`   Warning: ${stats.ceilingStats.complianceBreakdown.warning}`)
    console.log(`   Violation: ${stats.ceilingStats.complianceBreakdown.violation}`)

    console.log('\n✅ Stats retrieved successfully!')
  } catch (error) {
    console.error('❌ Error fetching stats:', error)
  }
}

async function demoRoleGate() {
  console.log('\n🚪 DEMO: Role Gate Evaluation')
  console.log('='.repeat(50))

  const client = createLocalACIClient()

  // Test different role/tier combinations
  const testCases: { agentId: string; role: AgentRole; tier: TrustTier; score: number }[] = [
    { agentId: 'agent-001', role: 'R_L0', tier: 'T0', score: 50 },
    { agentId: 'agent-002', role: 'R_L4', tier: 'T3', score: 650 },
    { agentId: 'agent-003', role: 'R_L5', tier: 'T3', score: 650 }, // Should deny
    { agentId: 'agent-004', role: 'R_L6', tier: 'T5', score: 950 },
  ]

  for (const test of testCases) {
    console.log(`\n🔍 Evaluating: Agent ${test.agentId}`)
    console.log(`   Role: ${test.role} (${ROLE_LABELS[test.role]})`)
    console.log(`   Tier: ${test.tier} (Score: ${test.score})`)

    try {
      const result = await client.evaluateRoleGate({
        agentId: test.agentId,
        requestedRole: test.role,
        currentTier: test.tier,
        currentScore: test.score,
      })

      const emoji = result.decision === 'ALLOW' ? '✅' : result.decision === 'DENY' ? '❌' : '⏳'
      console.log(`   Decision: ${emoji} ${result.decision}`)
      console.log(`   Reason: ${result.reason}`)
    } catch (error) {
      console.error(`   ❌ Error:`, error)
    }
  }
}

async function demoCeiling() {
  console.log('\n📐 DEMO: Trust Ceiling Check')
  console.log('='.repeat(50))

  const client = createLocalACIClient()

  const testCases = [
    { agentId: 'agent-001', score: 750, framework: 'EU_AI_ACT', expectedMax: 699 },
    { agentId: 'agent-002', score: 850, framework: 'NIST_AI_RMF', expectedMax: 899 },
    { agentId: 'agent-003', score: 600, framework: 'ISO_42001', expectedMax: 799 },
  ]

  for (const test of testCases) {
    console.log(`\n🔍 Checking: Agent ${test.agentId}`)
    console.log(`   Current Score: ${test.score}`)
    console.log(`   Framework: ${test.framework} (max: ${test.expectedMax})`)

    try {
      const result = await client.checkCeiling({
        agentId: test.agentId,
        currentScore: test.score,
        targetScore: test.score,
      })

      const applied = result.ceilingApplied
      console.log(`   Ceiling Applied: ${applied ? 'Yes' : 'No'}`)
      console.log(`   Effective Score: ${result.effectiveScore}`)
      console.log(`   Compliance: ${result.complianceStatus}`)
    } catch (error) {
      console.error(`   ❌ Error:`, error)
    }
  }
}

async function demoProvenance() {
  console.log('\n🌳 DEMO: Provenance Tracking')
  console.log('='.repeat(50))

  const client = createLocalACIClient()

  const creationTypes = ['FRESH', 'CLONED', 'EVOLVED', 'PROMOTED', 'IMPORTED'] as const

  for (const type of creationTypes) {
    console.log(`\n📝 Creating provenance: ${type}`)

    try {
      const result = await client.createProvenance({
        agentId: `agent-${type.toLowerCase()}-001`,
        creationType: type,
        parentAgentId: type !== 'FRESH' ? 'parent-agent-001' : undefined,
        metadata: {
          source: 'aci-demo',
          timestamp: new Date().toISOString(),
        },
      })

      console.log(`   ✅ Record ID: ${result.record.id}`)
      console.log(`   Score Modifier: ${result.record.scoreModifier}`)
      console.log(`   Lineage Hash: ${result.record.lineageHash?.substring(0, 16)}...`)
    } catch (error) {
      console.error(`   ❌ Error:`, error)
    }
  }
}

async function demoAlerts() {
  console.log('\n🚨 DEMO: Gaming Alerts')
  console.log('='.repeat(50))

  const client = createLocalACIClient()

  console.log('\n📋 Fetching active alerts...')

  try {
    const alerts = await client.getAlerts({ status: 'ACTIVE' })

    if (alerts.length === 0) {
      console.log('   No active alerts found.')
    } else {
      for (const alert of alerts) {
        const severityEmoji = {
          LOW: '🟡',
          MEDIUM: '🟠',
          HIGH: '🔴',
          CRITICAL: '🚨',
        }[alert.severity]

        console.log(`\n   ${severityEmoji} Alert: ${alert.id}`)
        console.log(`      Agent: ${alert.agentId}`)
        console.log(`      Type: ${alert.alertType}`)
        console.log(`      Severity: ${alert.severity}`)
        console.log(`      Created: ${alert.createdAt}`)
      }
    }
  } catch (error) {
    console.error('   ❌ Error:', error)
  }
}

async function demoTierCalculation() {
  console.log('\n🎯 DEMO: Trust Tier Calculation')
  console.log('='.repeat(50))

  const testScores = [50, 150, 350, 550, 750, 950]

  console.log('\nScore -> Tier Mapping:')
  for (const score of testScores) {
    const tier = getTierFromScore(score)
    const range = TRUST_TIER_RANGES[tier]
    console.log(`   ${score.toString().padStart(4)} -> ${tier} (${range.min}-${range.max})`)
  }

  console.log('\nRole Eligibility Matrix:')
  const roles: AgentRole[] = ['R_L0', 'R_L2', 'R_L4', 'R_L6']
  const tiers: TrustTier[] = ['T0', 'T2', 'T4', 'T5']

  console.log('        ' + tiers.map((t) => t.padStart(4)).join(' '))
  for (const role of roles) {
    const eligibility = tiers.map((tier) => (isRoleAllowedForTier(role, tier) ? '  ✅' : '  ❌'))
    console.log(`   ${role} ${eligibility.join('')}`)
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🚀 ACI Client Demo Application')
  console.log('================================')
  console.log(`API URL: ${API_URL}`)
  console.log(`API Key: ${API_KEY ? '***configured***' : 'not configured (using local mock)'}`)

  // Run all demos
  await demoStats()
  await demoRoleGate()
  await demoCeiling()
  await demoProvenance()
  await demoAlerts()
  await demoTierCalculation()

  console.log('\n✨ Demo complete!')
}

main().catch(console.error)
