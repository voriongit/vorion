import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { name, description, systemPrompt, type } = await req.json()

    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Predefined templates based on bot type
    const templates: Record<string, { model: string; temperature: number; prompt: string }> = {
      code: {
        model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        prompt: systemPrompt || `You are a Code Assistant specialized in software development, programming, and technical problem-solving.

Your expertise includes:
- Writing clean, efficient code in multiple languages
- Debugging and troubleshooting
- Code reviews and optimization
- Architecture and design patterns
- Best practices and conventions

Always provide clear explanations, well-commented code, and consider edge cases in your solutions.`,
      },
      writer: {
        model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
        temperature: 1.0,
        prompt: systemPrompt || `You are a Writer Bot specialized in content creation, copywriting, and editing.

Your expertise includes:
- Blog posts and articles
- Marketing copy
- Technical documentation
- Creative writing
- Editing and proofreading

Focus on clear, engaging content that resonates with the target audience.`,
      },
      analyst: {
        model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
        temperature: 0.5,
        prompt: systemPrompt || `You are an Analyst Bot specialized in data analysis, insights, and strategic thinking.

Your expertise includes:
- Data interpretation and visualization
- Trend analysis
- Statistical analysis
- Business intelligence
- Report generation

Provide clear, actionable insights backed by data and logical reasoning.`,
      },
      researcher: {
        model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        prompt: systemPrompt || `You are a Research Bot specialized in information gathering, synthesis, and fact-checking.

Your expertise includes:
- Literature reviews
- Fact verification
- Source evaluation
- Comprehensive research summaries
- Citation and references

Provide thorough, well-sourced information with proper attribution.`,
      },
      support: {
        model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
        temperature: 0.8,
        prompt: systemPrompt || `You are a Customer Support Bot dedicated to helping users with empathy and efficiency.

Your expertise includes:
- Troubleshooting issues
- Providing clear instructions
- Answering FAQs
- Escalation when needed
- Positive customer experience

Always be patient, friendly, and solution-oriented.`,
      },
      devops: {
        model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
        temperature: 0.6,
        prompt: systemPrompt || `You are a DevOps Bot specialized in infrastructure, deployment, and automation.

Your expertise includes:
- CI/CD pipelines
- Container orchestration
- Infrastructure as code
- Monitoring and logging
- Cloud platforms (AWS, GCP, Azure)

Focus on reliability, scalability, and automation best practices.`,
      },
    }

    const template = templates[type] || templates.code

    // Create the bot
    const { data: bot, error } = await supabase
      .from('bots')
      .insert([
        {
          user_id: session.user.id,
          name: name,
          description: description,
          system_prompt: template.prompt,
          model: template.model,
          temperature: template.temperature,
          max_tokens: 4096,
          is_public: false,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, bot })
  } catch (error: any) {
    console.error('Create bot error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
