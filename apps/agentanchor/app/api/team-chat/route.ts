import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  try {
    const { teamId, message, conversationId, messages, teamBots } = await req.json()

    // Verify authentication
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Prepare messages for Claude
    const claudeMessages = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }))

    // Add current message
    claudeMessages.push({
      role: 'user',
      content: message,
    })

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Determine which bots should respond and in what order
          const respondingBots = await selectRespondingBots(
            teamBots,
            message,
            claudeMessages
          )

          for (const bot of respondingBots) {
            // Signal which bot is starting
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'bot_start',
                  bot: { id: bot.id, name: bot.name },
                })}\n\n`
              )
            )

            // Get bot's response
            const botSystemPrompt = `${bot.system_prompt}\n\nYou are ${bot.name}, working as part of a team. Other team members may also respond. Keep your response focused and concise. Build upon what others have said when appropriate.`

            const messageStream = await anthropic.messages.create({
              model: bot.model,
              max_tokens: Math.min(bot.max_tokens, 2048), // Limit for team chat
              temperature: bot.temperature,
              system: botSystemPrompt,
              messages: claudeMessages,
              stream: true,
            })

            let botResponse = ''

            for await (const event of messageStream) {
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                botResponse += event.delta.text
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'content',
                      content: event.delta.text,
                    })}\n\n`
                  )
                )
              }
            }

            // Add bot's response to conversation history for next bot
            claudeMessages.push({
              role: 'assistant',
              content: `[${bot.name}]: ${botResponse}`,
            })
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error: any) {
          console.error('Team chat streaming error:', error)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: error.message })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Team chat API error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}

// Intelligent bot selection based on message content
async function selectRespondingBots(
  teamBots: any[],
  message: string,
  conversationHistory: any[]
): Promise<any[]> {
  // For now, let 1-2 most relevant bots respond
  // In future, this could use AI to determine relevance

  const messageLower = message.toLowerCase()

  // Score each bot based on relevance
  const scoredBots = teamBots.map((bot) => {
    let score = 0
    const botPromptLower = bot.system_prompt.toLowerCase()
    const botNameLower = bot.name.toLowerCase()

    // Check for keywords
    if (messageLower.includes('code') || messageLower.includes('program')) {
      if (botPromptLower.includes('code') || botPromptLower.includes('programming')) {
        score += 10
      }
    }

    if (messageLower.includes('write') || messageLower.includes('content')) {
      if (botPromptLower.includes('writ') || botPromptLower.includes('content')) {
        score += 10
      }
    }

    if (messageLower.includes('data') || messageLower.includes('analyz')) {
      if (botPromptLower.includes('data') || botPromptLower.includes('analyz')) {
        score += 10
      }
    }

    if (messageLower.includes('research') || messageLower.includes('find')) {
      if (botPromptLower.includes('research') || botPromptLower.includes('search')) {
        score += 10
      }
    }

    // Mention bot by name
    if (messageLower.includes(botNameLower)) {
      score += 20
    }

    // Base score so everyone has a chance
    score += 1

    return { bot, score }
  })

  // Sort by score and take top 1-2 bots
  scoredBots.sort((a, b) => b.score - a.score)

  // If one bot is clearly more relevant, just use that one
  if (scoredBots[0].score > scoredBots[1]?.score * 2) {
    return [scoredBots[0].bot]
  }

  // Otherwise use top 2 bots
  return scoredBots.slice(0, 2).map((sb) => sb.bot)
}
