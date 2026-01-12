import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import fs from 'fs'
import path from 'path'

// Icon mapping for BMAD agents
const AGENT_ICONS: Record<string, string> = {
  'pm': '📋',
  'architect': '🏗️',
  'dev': '💻',
  'analyst': '📊',
  'sm': '🎯',
  'tech-writer': '📝',
  'ux-designer': '🎨',
  'tea': '🔬',
  'frame-expert': '⚙️',
  'brainstorming-coach': '💡',
  'creative-problem-solver': '🧩',
  'design-thinking-coach': '🎭',
  'innovation-strategist': '🚀',
  'storyteller': '📚',
  'bmad-builder': '🔧',
}

interface BMADAgent {
  name: string
  title: string
  description: string
  persona: string
  icon: string
  filePath: string
}

function parseBMADAgent(filePath: string): BMADAgent | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Extract metadata from frontmatter
    const nameMatch = content.match(/name:\s*"(.+?)"/)
    const descMatch = content.match(/description:\s*"(.+?)"/)

    // Extract from XML
    const titleMatch = content.match(/title="(.+?)"/)
    const iconMatch = content.match(/icon="(.+?)"/)
    const personaMatch = content.match(/<persona>([\s\S]*?)<\/persona>/)

    const fileName = path.basename(filePath, '.md')

    return {
      name: nameMatch?.[1] || fileName,
      title: titleMatch?.[1] || fileName,
      description: descMatch?.[1] || '',
      persona: personaMatch?.[1] || content.substring(0, 2000),
      icon: iconMatch?.[1] || AGENT_ICONS[fileName] || '🤖',
      filePath,
    }
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error)
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bmadPath = path.join(process.cwd(), '.bmad')

    if (!fs.existsSync(bmadPath)) {
      return NextResponse.json({
        error: 'BMAD not installed',
        message: 'Run: npx bmad-method@alpha install'
      }, { status: 404 })
    }

    const agents: BMADAgent[] = []

    // Scan BMM agents
    const bmmAgentsPath = path.join(bmadPath, 'bmm', 'agents')
    if (fs.existsSync(bmmAgentsPath)) {
      const files = fs.readdirSync(bmmAgentsPath).filter(f => f.endsWith('.md'))
      files.forEach(file => {
        const agent = parseBMADAgent(path.join(bmmAgentsPath, file))
        if (agent) agents.push(agent)
      })
    }

    // Scan CIS agents
    const cisAgentsPath = path.join(bmadPath, 'cis', 'agents')
    if (fs.existsSync(cisAgentsPath)) {
      const files = fs.readdirSync(cisAgentsPath).filter(f => f.endsWith('.md') && f !== 'README.md')
      files.forEach(file => {
        const agent = parseBMADAgent(path.join(cisAgentsPath, file))
        if (agent) agents.push(agent)
      })
    }

    // Scan BMB agents
    const bmbAgentsPath = path.join(bmadPath, 'bmb', 'agents')
    if (fs.existsSync(bmbAgentsPath)) {
      const files = fs.readdirSync(bmbAgentsPath).filter(f => f.endsWith('.md'))
      files.forEach(file => {
        const agent = parseBMADAgent(path.join(bmbAgentsPath, file))
        if (agent) agents.push(agent)
      })
    }

    return NextResponse.json({ agents, count: agents.length })
  } catch (error: any) {
    console.error('Error loading BMAD agents:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agentNames } = await req.json()

    if (!agentNames || !Array.isArray(agentNames)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const bmadPath = path.join(process.cwd(), '.bmad')
    const imported = []

    for (const agentName of agentNames) {
      // Find agent file
      let agentPath = null
      const possiblePaths = [
        path.join(bmadPath, 'bmm', 'agents', `${agentName}.md`),
        path.join(bmadPath, 'cis', 'agents', `${agentName}.md`),
        path.join(bmadPath, 'bmb', 'agents', `${agentName}.md`),
      ]

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          agentPath = p
          break
        }
      }

      if (!agentPath) continue

      const agent = parseBMADAgent(agentPath)
      if (!agent) continue

      // Create bot from BMAD agent
      const { data, error } = await supabase
        .from('bots')
        .insert([
          {
            user_id: session.user.id,
            name: `${agent.icon} ${agent.title}`,
            description: agent.description,
            system_prompt: agent.persona,
            model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
            temperature: 0.7,
            max_tokens: 4096,
            avatar_url: agent.icon,
            is_public: false,
          },
        ])
        .select()
        .single()

      if (!error) {
        imported.push(data)
      }
    }

    return NextResponse.json({ imported, count: imported.length })
  } catch (error: any) {
    console.error('Error importing BMAD agents:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
