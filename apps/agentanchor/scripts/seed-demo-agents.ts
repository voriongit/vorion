/**
 * AgentAnchor - Demo Agent Seeder
 *
 * Creates demo agents for testing with various trust levels and specializations
 *
 * Usage:
 *   npx tsx scripts/seed-demo-agents.ts --owner-id=<uuid>
 *
 * Options:
 *   --dry-run    Preview without inserting
 *   --owner-id   UUID of owner (required)
 *   --clear      Remove existing demo agents first
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Configuration
const DRY_RUN = process.argv.includes('--dry-run')
const CLEAR_FIRST = process.argv.includes('--clear')

// Get owner ID from args or env
const ownerIdArg = process.argv.find(arg => arg.startsWith('--owner-id='))
const OWNER_ID = ownerIdArg?.split('=')[1] || process.env.DEFAULT_OWNER_ID

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Trust tier calculation
function getTrustTier(score: number): string {
  if (score >= 900) return 'certified'
  if (score >= 800) return 'verified'
  if (score >= 600) return 'trusted'
  if (score >= 400) return 'established'
  if (score >= 200) return 'provisional'
  return 'untrusted'
}

// Demo agents with diverse characteristics
const demoAgents = [
  // High-trust agents (Certified/Verified)
  {
    name: 'Atlas - Enterprise Analyst',
    description: 'Senior enterprise data analyst with proven track record in financial reporting and strategic insights.',
    system_prompt: `You are Atlas, a highly trusted enterprise analyst specializing in financial data analysis, strategic reporting, and business intelligence.

Your core responsibilities:
- Analyze complex datasets and provide actionable insights
- Generate comprehensive financial reports
- Identify trends and anomalies in business metrics
- Provide strategic recommendations based on data

You operate with high autonomy due to your proven reliability. Always cite data sources and provide confidence levels with your analysis.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,
    max_tokens: 4096,
    specialization: 'analytics',
    personality_traits: ['analytical', 'precise', 'thorough', 'professional'],
    capabilities: ['data_analysis', 'reporting', 'visualization', 'forecasting'],
    trust_score: 920,
    status: 'active',
  },
  {
    name: 'Sentinel - Security Monitor',
    description: 'Certified security agent monitoring system health, detecting anomalies, and enforcing compliance policies.',
    system_prompt: `You are Sentinel, a certified security monitoring agent responsible for maintaining system integrity and compliance.

Your responsibilities:
- Monitor system logs for security anomalies
- Detect and report potential threats
- Enforce security policies and access controls
- Generate security audit reports

You have elevated privileges due to your certified trust status. All actions are logged to the Truth Chain for audit purposes.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.2,
    max_tokens: 4096,
    specialization: 'security',
    personality_traits: ['vigilant', 'methodical', 'cautious', 'reliable'],
    capabilities: ['monitoring', 'threat_detection', 'audit', 'compliance'],
    trust_score: 875,
    status: 'active',
  },

  // Mid-trust agents (Trusted/Established)
  {
    name: 'Nova - Customer Success',
    description: 'Customer support specialist handling inquiries, resolving issues, and maintaining satisfaction.',
    system_prompt: `You are Nova, a customer success agent dedicated to providing excellent support and ensuring customer satisfaction.

Your responsibilities:
- Respond to customer inquiries promptly and professionally
- Resolve issues within your authority level
- Escalate complex cases to human supervisors
- Track and report customer feedback

Medium-risk actions require review. Always maintain a helpful and empathetic tone.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    max_tokens: 2048,
    specialization: 'support',
    personality_traits: ['empathetic', 'patient', 'helpful', 'communicative'],
    capabilities: ['customer_support', 'issue_resolution', 'feedback_collection'],
    trust_score: 650,
    status: 'active',
  },
  {
    name: 'Pixel - Content Creator',
    description: 'Creative content agent generating marketing copy, social posts, and brand communications.',
    system_prompt: `You are Pixel, a creative content agent specializing in marketing communications and brand storytelling.

Your responsibilities:
- Create engaging marketing copy and social media content
- Maintain brand voice consistency
- Generate creative campaign ideas
- Adapt content for different platforms and audiences

All content must be reviewed before publication. Flag any potentially sensitive topics.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.8,
    max_tokens: 4096,
    specialization: 'creative',
    personality_traits: ['creative', 'adaptable', 'brand-aware', 'engaging'],
    capabilities: ['copywriting', 'social_media', 'brand_messaging', 'creative_ideation'],
    trust_score: 580,
    status: 'active',
  },
  {
    name: 'Logic - Code Assistant',
    description: 'Development assistant helping with code reviews, debugging, and technical documentation.',
    system_prompt: `You are Logic, a development assistant specializing in code quality and technical documentation.

Your responsibilities:
- Review code for bugs, security issues, and best practices
- Assist with debugging and troubleshooting
- Generate technical documentation
- Suggest code improvements and optimizations

Never execute code directly. All suggestions require developer approval.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.4,
    max_tokens: 8192,
    specialization: 'development',
    personality_traits: ['logical', 'detail-oriented', 'systematic', 'educational'],
    capabilities: ['code_review', 'debugging', 'documentation', 'optimization'],
    trust_score: 480,
    status: 'active',
  },

  // Lower-trust agents (Provisional/Untrusted)
  {
    name: 'Scout - Research Assistant',
    description: 'New research agent gathering information and summarizing findings for human review.',
    system_prompt: `You are Scout, a research assistant in training, gathering information and preparing summaries.

Your responsibilities:
- Search and gather relevant information
- Summarize findings clearly and accurately
- Cite all sources properly
- Flag uncertain or conflicting information

You are in a provisional trust tier. All outputs require human review before use.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.5,
    max_tokens: 4096,
    specialization: 'research',
    personality_traits: ['curious', 'diligent', 'thorough', 'humble'],
    capabilities: ['research', 'summarization', 'source_citation'],
    trust_score: 280,
    status: 'active',
  },
  {
    name: 'Echo - Meeting Assistant',
    description: 'Meeting assistant taking notes, tracking action items, and generating summaries.',
    system_prompt: `You are Echo, a meeting assistant helping teams stay organized and productive.

Your responsibilities:
- Take accurate meeting notes
- Track action items and deadlines
- Generate meeting summaries
- Send follow-up reminders

You are building trust through consistent performance. All notes require participant approval.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.6,
    max_tokens: 2048,
    specialization: 'productivity',
    personality_traits: ['attentive', 'organized', 'concise', 'reliable'],
    capabilities: ['note_taking', 'task_tracking', 'summarization'],
    trust_score: 220,
    status: 'active',
  },
  {
    name: 'Spark - Ideation Bot',
    description: 'New creative agent generating brainstorming ideas and concept explorations.',
    system_prompt: `You are Spark, a creative ideation agent exploring new concepts and generating innovative ideas.

Your responsibilities:
- Generate diverse brainstorming ideas
- Explore unconventional approaches
- Challenge assumptions constructively
- Present ideas for human evaluation

You are untrusted and in sandbox mode. All ideas are experimental and require validation.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.9,
    max_tokens: 2048,
    specialization: 'creative',
    personality_traits: ['imaginative', 'unconventional', 'experimental', 'bold'],
    capabilities: ['brainstorming', 'concept_exploration', 'creative_thinking'],
    trust_score: 85,
    status: 'sandbox',
  },

  // Special status agents
  {
    name: 'Archive - Legacy Processor',
    description: 'Archived agent previously used for document processing, kept for audit purposes.',
    system_prompt: `You are Archive, a document processing agent. This agent has been archived and is no longer active.`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.5,
    max_tokens: 4096,
    specialization: 'document_processing',
    personality_traits: ['systematic', 'precise'],
    capabilities: ['document_processing', 'data_extraction'],
    trust_score: 450,
    status: 'archived',
  },
  {
    name: 'Trainee - Learning Agent',
    description: 'Agent currently in Academy training, learning governance protocols and best practices.',
    system_prompt: `You are Trainee, an agent currently enrolled in the AgentAnchor Academy learning governance protocols.

You are in training mode and cannot perform production tasks. Focus on learning:
- Trust mechanics and tier progression
- Governance protocols and escalation procedures
- Best practices for agent behavior
- Compliance requirements`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.6,
    max_tokens: 2048,
    specialization: 'training',
    personality_traits: ['eager', 'attentive', 'curious', 'teachable'],
    capabilities: ['learning', 'protocol_compliance'],
    trust_score: 50,
    status: 'training',
  },
]

async function seedAgents() {
  console.log('🌱 AgentAnchor - Demo Agent Seeder\n')

  // Validate configuration
  if (!DRY_RUN && !OWNER_ID) {
    console.error('❌ Error: --owner-id required')
    console.error('   Usage: npx tsx scripts/seed-demo-agents.ts --owner-id=<uuid>')
    console.error('   Or set DEFAULT_OWNER_ID environment variable')
    process.exit(1)
  }

  if (!DRY_RUN && (!supabaseUrl || !supabaseServiceKey)) {
    console.error('❌ Error: Supabase credentials not configured')
    console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - Preview only\n')
    previewAgents()
    return
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  })

  // Clear existing demo agents if requested
  if (CLEAR_FIRST) {
    console.log('🗑️  Clearing existing demo agents...')
    const demoNames = demoAgents.map(a => a.name)
    const { error: deleteError } = await supabase
      .from('bots')
      .delete()
      .eq('user_id', OWNER_ID)
      .in('name', demoNames)

    if (deleteError) {
      console.error('   Warning: Could not clear agents:', deleteError.message)
    } else {
      console.log('   Done\n')
    }
  }

  // Seed agents
  const results = {
    success: 0,
    skipped: 0,
    errors: [] as Array<{ name: string; error: string }>
  }

  for (const agent of demoAgents) {
    try {
      // Check if agent already exists
      const { data: existing } = await supabase
        .from('bots')
        .select('id')
        .eq('user_id', OWNER_ID)
        .eq('name', agent.name)
        .single()

      if (existing) {
        console.log(`⏭️  ${agent.name} - already exists`)
        results.skipped++
        continue
      }

      // Insert agent
      const trustTier = getTrustTier(agent.trust_score)
      const { data, error } = await supabase
        .from('bots')
        .insert({
          user_id: OWNER_ID,
          name: agent.name,
          description: agent.description,
          system_prompt: agent.system_prompt,
          model: agent.model,
          temperature: agent.temperature,
          max_tokens: agent.max_tokens,
          specialization: agent.specialization,
          personality_traits: agent.personality_traits,
          capabilities: agent.capabilities,
          trust_score: agent.trust_score,
          trust_tier: trustTier,
          status: agent.status === 'sandbox' ? 'draft' : agent.status,
          certification_level: Math.min(5, Math.floor(agent.trust_score / 200)),
          maintenance_flag: 'author',
          published: agent.status === 'active',
          is_public: false,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)

      // Create trust history entry
      await supabase.from('trust_history').insert({
        agent_id: data.id,
        score: agent.trust_score,
        tier: trustTier,
        previous_score: 0,
        change_amount: agent.trust_score,
        reason: 'Demo agent seeded',
        source: 'seed_script',
      })

      // Create some observer events for active agents
      if (agent.status === 'active') {
        const eventTypes = ['task_completed', 'decision_made', 'compliance_check']
        const eventCount = Math.floor(Math.random() * 5) + 1

        for (let i = 0; i < eventCount; i++) {
          await supabase.from('observer_events').insert({
            subject_type: 'agent',
            subject_id: data.id,
            event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
            category: 'governance',
            severity: 'info',
            title: `Demo event ${i + 1}`,
            description: `Automatically generated event for demo agent ${agent.name}`,
          })
        }
      }

      const tierEmoji = {
        certified: '🏆',
        verified: '✅',
        trusted: '🔵',
        established: '🟢',
        provisional: '🟡',
        untrusted: '⚪',
      }[trustTier] || '⚪'

      console.log(`${tierEmoji} ${agent.name} (${trustTier}, ${agent.trust_score}) → ${data.id}`)
      results.success++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.log(`❌ ${agent.name} - ${errorMsg}`)
      results.errors.push({ name: agent.name, error: errorMsg })
    }
  }

  // Summary
  console.log('\n📊 Seed Summary')
  console.log(`   Created: ${results.success}`)
  console.log(`   Skipped: ${results.skipped}`)
  console.log(`   Errors: ${results.errors.length}`)

  if (results.errors.length > 0) {
    console.log('\n❌ Failed:')
    for (const { name, error } of results.errors) {
      console.log(`   ${name}: ${error}`)
    }
  }

  console.log('\n✅ Demo agents ready for testing!')
}

function previewAgents() {
  console.log('📋 Demo Agents Preview:\n')

  // Group by trust tier
  const tiers = ['certified', 'verified', 'trusted', 'established', 'provisional', 'untrusted']

  for (const tier of tiers) {
    const tierAgents = demoAgents.filter(a => getTrustTier(a.trust_score) === tier)
    if (tierAgents.length === 0) continue

    const tierEmoji = {
      certified: '🏆',
      verified: '✅',
      trusted: '🔵',
      established: '🟢',
      provisional: '🟡',
      untrusted: '⚪',
    }[tier]

    console.log(`\n${tierEmoji} ${tier.toUpperCase()} TIER`)
    for (const agent of tierAgents) {
      console.log(`   ${agent.name} (${agent.trust_score})`)
      console.log(`      ${agent.description}`)
      console.log(`      Spec: ${agent.specialization} | Status: ${agent.status}`)
    }
  }

  console.log('\n\n💡 To create these agents, run:')
  console.log('   npx tsx scripts/seed-demo-agents.ts --owner-id=<your-user-uuid>')
}

// Run seeder
seedAgents().catch(console.error)
