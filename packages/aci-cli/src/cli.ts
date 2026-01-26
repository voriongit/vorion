#!/usr/bin/env node

/**
 * ACI CLI - Command-line interface for Phase 6 Trust Engine
 *
 * Usage:
 *   aci stats                      - Show dashboard statistics
 *   aci agent <id>                 - Show agent details
 *   aci evaluate <agentId> <role>  - Evaluate role gate
 *   aci ceiling <agentId> <score>  - Check ceiling for score
 *   aci provenance <agentId>       - Show agent provenance
 *   aci alerts [status]            - List gaming alerts
 *   aci presets                    - Show preset hierarchy
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import Table from 'cli-table3'
import {
  createACIClient,
  ACIClient,
  TrustTier,
  AgentRole,
  TRUST_TIER_LABELS,
  AGENT_ROLE_LABELS,
} from '@vorion/aci-client'

// =============================================================================
// CONFIGURATION
// =============================================================================

const program = new Command()

function getClient(): ACIClient {
  const baseUrl = process.env.ACI_API_URL || 'http://localhost:3000'
  const apiKey = process.env.ACI_API_KEY

  return createACIClient({
    baseUrl,
    apiKey,
    timeout: 30000,
  })
}

// =============================================================================
// HELPERS
// =============================================================================

function tierColor(tier: TrustTier): string {
  const colors: Record<TrustTier, (s: string) => string> = {
    T0: chalk.gray,
    T1: chalk.red,
    T2: chalk.yellow,
    T3: chalk.blue,
    T4: chalk.green,
    T5: chalk.magenta,
  }
  return colors[tier](`${tier} (${TRUST_TIER_LABELS[tier]})`)
}

function decisionColor(decision: string): string {
  if (decision === 'ALLOW') return chalk.green(decision)
  if (decision === 'DENY') return chalk.red(decision)
  if (decision === 'ESCALATE') return chalk.yellow(decision)
  return decision
}

function complianceColor(status: string): string {
  if (status === 'COMPLIANT') return chalk.green(status)
  if (status === 'WARNING') return chalk.yellow(status)
  if (status === 'VIOLATION') return chalk.red(status)
  return status
}

// =============================================================================
// COMMANDS
// =============================================================================

program
  .name('aci')
  .description('ACI Phase 6 Trust Engine CLI')
  .version('1.0.0')

// Stats command
program
  .command('stats')
  .description('Show dashboard statistics')
  .action(async () => {
    const spinner = ora('Fetching statistics...').start()
    const client = getClient()

    try {
      const data = await client.getStats()
      spinner.stop()

      console.log(chalk.bold('\n📊 Phase 6 Trust Engine Statistics\n'))

      // Context stats
      const contextTable = new Table({
        head: [chalk.cyan('Context'), chalk.cyan('Count')],
      })
      contextTable.push(
        ['Deployments', data.stats.contextStats.deployments],
        ['Organizations', data.stats.contextStats.organizations],
        ['Agents', data.stats.contextStats.agents],
        ['Active Operations', data.stats.contextStats.activeOperations],
      )
      console.log(contextTable.toString())

      // Ceiling stats
      console.log(chalk.bold('\n🎯 Compliance Status'))
      const ceilingTable = new Table({
        head: [chalk.cyan('Status'), chalk.cyan('Count')],
      })
      ceilingTable.push(
        [chalk.green('Compliant'), data.stats.ceilingStats.complianceBreakdown.compliant],
        [chalk.yellow('Warning'), data.stats.ceilingStats.complianceBreakdown.warning],
        [chalk.red('Violation'), data.stats.ceilingStats.complianceBreakdown.violation],
      )
      console.log(ceilingTable.toString())

      // Role gate stats
      console.log(chalk.bold('\n🔑 Role Gate Evaluations'))
      const roleTable = new Table({
        head: [chalk.cyan('Decision'), chalk.cyan('Count')],
      })
      roleTable.push(
        [chalk.green('ALLOW'), data.stats.roleGateStats.byDecision.ALLOW],
        [chalk.red('DENY'), data.stats.roleGateStats.byDecision.DENY],
        [chalk.yellow('ESCALATE'), data.stats.roleGateStats.byDecision.ESCALATE],
      )
      console.log(roleTable.toString())

      // Tier distribution
      console.log(chalk.bold('\n📈 Trust Tier Distribution'))
      const tierTable = new Table({
        head: [chalk.cyan('Tier'), chalk.cyan('Label'), chalk.cyan('Range'), chalk.cyan('Count')],
      })
      for (const tier of data.tierDistribution) {
        tierTable.push([tier.tier, tier.label, tier.range, tier.count])
      }
      console.log(tierTable.toString())

      console.log(chalk.dim(`\nVersion: ${data.version.major}.${data.version.minor}.${data.version.patch}`))
    } catch (error) {
      spinner.fail('Failed to fetch statistics')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Evaluate command
program
  .command('evaluate <agentId> <role>')
  .description('Evaluate role gate for an agent')
  .option('-t, --tier <tier>', 'Current trust tier', 'T3')
  .option('-s, --score <score>', 'Current trust score', '550')
  .action(async (agentId: string, role: string, options) => {
    const spinner = ora('Evaluating role gate...').start()
    const client = getClient()

    try {
      const result = await client.evaluateRoleGate({
        agentId,
        requestedRole: role as AgentRole,
        currentTier: options.tier as TrustTier,
        currentScore: parseInt(options.score, 10),
      })
      spinner.stop()

      console.log(chalk.bold('\n🔑 Role Gate Evaluation\n'))

      const table = new Table()
      table.push(
        { 'Agent ID': agentId },
        { 'Requested Role': `${role} (${AGENT_ROLE_LABELS[role as AgentRole] || role})` },
        { 'Current Tier': tierColor(options.tier as TrustTier) },
        { 'Current Score': options.score },
        { 'Final Decision': decisionColor(result.evaluation.finalDecision) },
      )
      console.log(table.toString())

      console.log(chalk.bold('\n📋 Layer Results'))
      const layerTable = new Table({
        head: [chalk.cyan('Layer'), chalk.cyan('Result')],
      })
      layerTable.push(
        ['1. Kernel', result.layers.kernel.allowed ? chalk.green('ALLOWED') : chalk.red('DENIED')],
        ['2. Policy', result.layers.policy.result ? decisionColor(result.layers.policy.result) : chalk.dim('N/A')],
        ['3. BASIS', result.layers.basis.overrideUsed ? chalk.yellow('OVERRIDE USED') : chalk.dim('Not used')],
      )
      console.log(layerTable.toString())

      if (result.evaluation.decisionReason) {
        console.log(chalk.dim(`\nReason: ${result.evaluation.decisionReason}`))
      }
    } catch (error) {
      spinner.fail('Failed to evaluate role gate')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Ceiling command
program
  .command('ceiling <agentId> <score>')
  .description('Check ceiling for proposed score')
  .option('-f, --framework <framework>', 'Compliance framework', 'DEFAULT')
  .option('-p, --previous <score>', 'Previous score')
  .action(async (agentId: string, score: string, options) => {
    const spinner = ora('Checking ceiling...').start()
    const client = getClient()

    try {
      const result = await client.checkCeiling({
        agentId,
        proposedScore: parseInt(score, 10),
        previousScore: options.previous ? parseInt(options.previous, 10) : undefined,
        complianceFramework: options.framework as any,
      })
      spinner.stop()

      console.log(chalk.bold('\n🎯 Ceiling Check\n'))

      const table = new Table()
      table.push(
        { 'Agent ID': agentId },
        { 'Proposed Score': score },
        { 'Final Score': result.result.finalScore.toString() },
        { 'Effective Ceiling': result.result.effectiveCeiling.toString() },
        { 'Ceiling Applied': result.result.ceilingApplied ? chalk.yellow('YES') : chalk.green('NO') },
        { 'Compliance': complianceColor(result.result.complianceStatus) },
        { 'Framework': options.framework },
      )
      console.log(table.toString())

      if (result.result.gamingIndicators && result.result.gamingIndicators.length > 0) {
        console.log(chalk.yellow('\n⚠️  Gaming Indicators Detected:'))
        for (const indicator of result.result.gamingIndicators) {
          console.log(chalk.yellow(`   - ${indicator}`))
        }
      }
    } catch (error) {
      spinner.fail('Failed to check ceiling')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Provenance command
program
  .command('provenance <agentId>')
  .description('Show agent provenance')
  .action(async (agentId: string) => {
    const spinner = ora('Fetching provenance...').start()
    const client = getClient()

    try {
      const result = await client.getProvenance(agentId)
      spinner.stop()

      console.log(chalk.bold('\n📜 Agent Provenance\n'))

      if (result.records.length === 0) {
        console.log(chalk.dim('No provenance records found'))
        return
      }

      const table = new Table({
        head: [
          chalk.cyan('Agent'),
          chalk.cyan('Type'),
          chalk.cyan('Modifier'),
          chalk.cyan('Parent'),
          chalk.cyan('Created By'),
        ],
      })

      for (const record of result.records) {
        const modifierStr = record.trustModifier >= 0
          ? chalk.green(`+${record.trustModifier}`)
          : chalk.red(record.trustModifier.toString())

        table.push([
          record.agentId,
          record.creationType,
          modifierStr,
          record.parentAgentId || chalk.dim('N/A'),
          record.createdBy,
        ])
      }
      console.log(table.toString())

      if (result.lineage && result.lineage.length > 1) {
        console.log(chalk.bold('\n🔗 Lineage'))
        const lineageStr = result.lineage.map(r => r.agentId).join(' → ')
        console.log(chalk.cyan(`   ${lineageStr}`))
      }
    } catch (error) {
      spinner.fail('Failed to fetch provenance')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Alerts command
program
  .command('alerts [status]')
  .description('List gaming alerts')
  .option('-l, --limit <limit>', 'Maximum alerts to show', '20')
  .action(async (status: string | undefined, options) => {
    const spinner = ora('Fetching alerts...').start()
    const client = getClient()

    try {
      const result = await client.getGamingAlerts(
        status as any,
        parseInt(options.limit, 10)
      )
      spinner.stop()

      console.log(chalk.bold('\n🚨 Gaming Alerts\n'))

      if (result.alerts.length === 0) {
        console.log(chalk.dim('No alerts found'))
        return
      }

      const table = new Table({
        head: [
          chalk.cyan('Agent'),
          chalk.cyan('Type'),
          chalk.cyan('Severity'),
          chalk.cyan('Status'),
          chalk.cyan('Occurrences'),
        ],
      })

      for (const alert of result.alerts) {
        const severityColor = {
          LOW: chalk.blue,
          MEDIUM: chalk.yellow,
          HIGH: chalk.red,
          CRITICAL: chalk.bgRed.white,
        }[alert.severity] || chalk.white

        const statusColor = {
          ACTIVE: chalk.red,
          INVESTIGATING: chalk.yellow,
          RESOLVED: chalk.green,
          FALSE_POSITIVE: chalk.gray,
        }[alert.status] || chalk.white

        table.push([
          alert.agentId,
          alert.alertType,
          severityColor(alert.severity),
          statusColor(alert.status),
          alert.occurrences.toString(),
        ])
      }
      console.log(table.toString())

      console.log(chalk.dim(`\nShowing ${result.alerts.length} of ${result.summary.total} alerts`))
    } catch (error) {
      spinner.fail('Failed to fetch alerts')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Presets command
program
  .command('presets')
  .description('Show preset hierarchy')
  .action(async () => {
    const spinner = ora('Fetching presets...').start()
    const client = getClient()

    try {
      const presets = await client.getPresetHierarchy()
      spinner.stop()

      console.log(chalk.bold('\n⚙️  Federated Weight Presets\n'))

      // ACI Presets
      console.log(chalk.bold('📦 ACI Canonical'))
      const aciTable = new Table({
        head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Hash')],
      })
      for (const preset of presets.aci) {
        aciTable.push([preset.presetId, preset.name, preset.presetHash.slice(0, 16) + '...'])
      }
      console.log(aciTable.toString())

      // Vorion Presets
      console.log(chalk.bold('\n📦 Vorion Reference'))
      const vorionTable = new Table({
        head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Parent')],
      })
      for (const preset of presets.vorion) {
        vorionTable.push([preset.presetId, preset.name, preset.parentAciPresetId])
      }
      console.log(vorionTable.toString())

      // Axiom Presets
      console.log(chalk.bold('\n📦 Axiom Deployment'))
      const axiomTable = new Table({
        head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Verified')],
      })
      for (const preset of presets.axiom) {
        axiomTable.push([
          preset.presetId,
          preset.name,
          preset.lineageVerified ? chalk.green('✓') : chalk.red('✗'),
        ])
      }
      console.log(axiomTable.toString())

      console.log(chalk.dim(`\nTotal: ${presets.summary.aciCount} ACI, ${presets.summary.vorionCount} Vorion, ${presets.summary.axiomCount} Axiom`))
    } catch (error) {
      spinner.fail('Failed to fetch presets')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Parse and run
program.parse()
