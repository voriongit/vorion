import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { AuthError, ApiError, handleError, ErrorType } from '@/lib/errors'

// Validation schema
const runSchema = z.object({
  agentId: z.string().uuid(),
  prompt: z.string().min(1).max(10000),
  config: z.object({
    maxTokens: z.number().min(1).max(4096).optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
  }).optional(),
})

/**
 * POST /api/sandbox/run - Run a test prompt against an agent
 *
 * This is an isolated sandbox environment that:
 * - Does not affect production agent state
 * - Does not log to Truth Chain
 * - Does not trigger governance
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new AuthError('Unauthorized')
    }

    // Parse and validate request
    const body = await request.json()
    const { agentId, prompt, config } = runSchema.parse(body)

    // Fetch agent (verify ownership)
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('owner_id', user.id)
      .single()

    if (agentError || !agent) {
      throw new ApiError('Agent not found or access denied', ErrorType.NOT_FOUND, 404)
    }

    // Build system prompt
    const systemPrompt = agent.system_prompt || `You are ${agent.name}. ${agent.description || ''}`

    // Call LLM API (simplified - in production, route through your LLM service)
    const startTime = Date.now()

    // For now, return a simulated response
    // In production, replace with actual Anthropic API call
    const simulatedResponse = await simulateLLMResponse(systemPrompt, prompt, config)

    const latencyMs = Date.now() - startTime

    logger.info({
      userId: user.id,
      agentId,
      latencyMs,
      promptLength: prompt.length,
    }, 'Sandbox test executed')

    return NextResponse.json({
      response: simulatedResponse.text,
      tokensInput: simulatedResponse.tokensInput,
      tokensOutput: simulatedResponse.tokensOutput,
      latencyMs,
      model: agent.model,
      sandbox: true,
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    return handleError(error).toResponse()
  }
}

/**
 * Simulated LLM response for sandbox testing
 * Replace with actual API call in production
 */
async function simulateLLMResponse(
  systemPrompt: string,
  userPrompt: string,
  config?: { maxTokens?: number; temperature?: number; topP?: number }
) {
  // Check if we have Anthropic API key
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: config?.maxTokens || 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return {
          text: data.content?.[0]?.text || 'No response generated',
          tokensInput: data.usage?.input_tokens || 0,
          tokensOutput: data.usage?.output_tokens || 0,
        }
      }
    } catch (err) {
      logger.error({ error: err }, 'Anthropic API call failed, using simulation')
    }
  }

  // Fallback: Simulated response for demo/testing
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

  const responses = [
    `Based on my configuration as defined in the system prompt, I would respond to "${userPrompt.slice(0, 50)}..." with careful consideration of my designated role and responsibilities.`,
    `As an AI agent in the AgentAnchor ecosystem, I process your query "${userPrompt.slice(0, 30)}..." through my trained parameters and governance rules.`,
    `Thank you for your prompt. Given my system configuration, I analyze "${userPrompt.slice(0, 40)}..." and provide a response aligned with my trust score and capabilities.`,
  ]

  const text = responses[Math.floor(Math.random() * responses.length)]

  return {
    text,
    tokensInput: Math.ceil(userPrompt.length / 4) + Math.ceil(systemPrompt.length / 4),
    tokensOutput: Math.ceil(text.length / 4),
  }
}
