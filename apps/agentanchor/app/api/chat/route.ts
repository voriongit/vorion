/**
 * Chat API - Streaming chat with AI bots
 *
 * Phase 1 Enhanced: Error handling, validation, rate limiting, metrics
 * Phase 2: MCP Tool Integration
 */

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Phase 1 imports
import { catchErrors, AuthError, NotFoundError } from '@/lib/errors'
import { ChatRequestSchema, validateRequest } from '@/lib/schemas'
import { enforceRateLimit, chatRateLimit } from '@/lib/rate-limit'
import { logger, logError, logPerformance } from '@/lib/logger'
import { trackChatMessage, calculateClaudeCost } from '@/lib/metrics'
import { anthropicCircuitBreaker } from '@/lib/circuit-breaker'
import { withTimeout } from '@/lib/retry'
import { config } from '@/lib/config'

// Phase 2: MCP imports
import { MCPRuntime, MCPServerConfig } from '@/lib/mcp'

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
})

// Maximum tool use iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 10

export const POST = catchErrors(async (req: NextRequest) => {
  const startTime = Date.now()
  const encoder = new TextEncoder()

  // 1. Validate request body
  const data = await validateRequest(req, ChatRequestSchema)

  logger.info({
    type: 'chat_request',
    botId: data.botId,
    conversationId: data.conversationId,
    messageLength: data.message.length,
    historyLength: data.messages.length,
  })

  // 2. Authenticate user
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new AuthError('Authentication required for chat')
  }

  // 3. Enforce rate limiting (throws if limit exceeded)
  await enforceRateLimit(
    session.user.id,
    chatRateLimit,
    '/api/chat'
  )

  // 4. Get bot configuration with error handling
  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('*')
    .eq('id', data.botId)
    .eq('user_id', session.user.id)
    .single()

  if (botError || !bot) {
    logger.warn({
      type: 'bot_not_found',
      botId: data.botId,
      userId: session.user.id,
      error: botError?.message,
    })
    throw new NotFoundError('Bot')
  }

  // 5. Get MCP servers for this bot
  const { data: mcpServers } = await supabase
    .from('bot_mcp_servers')
    .select(`
      mcp_servers (
        id,
        name,
        type,
        config
      )
    `)
    .eq('bot_id', data.botId)

  // 6. Initialize MCP runtime if servers are configured
  let mcpRuntime: MCPRuntime | null = null
  let mcpTools: Anthropic.Tool[] = []

  if (mcpServers && mcpServers.length > 0) {
    const serverConfigs: MCPServerConfig[] = mcpServers
      .map((ms: any) => ms.mcp_servers)
      .filter(Boolean)

    if (serverConfigs.length > 0) {
      mcpRuntime = new MCPRuntime()
      try {
        await mcpRuntime.initialize(serverConfigs)
        mcpTools = mcpRuntime.getAllTools()

        logger.info({
          type: 'mcp_runtime_ready',
          serverCount: serverConfigs.length,
          toolCount: mcpTools.length,
        })
      } catch (error) {
        logger.error({
          type: 'mcp_runtime_init_error',
          error: error instanceof Error ? error.message : String(error),
        })
        // Continue without MCP tools
        mcpRuntime = null
      }
    }
  }

  // 7. Prepare messages for Claude
  const claudeMessages: Anthropic.MessageParam[] = data.messages.map((msg) => ({
    role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: msg.content,
  }))

  // Add current message
  claudeMessages.push({
    role: 'user',
    content: data.message,
  })

  // 8. Build system prompt with MCP context
  let systemPrompt = bot.system_prompt
  if (mcpTools.length > 0) {
    systemPrompt += `\n\n## Available Tools\nYou have access to ${mcpTools.length} tools from connected MCP servers. Use them when they would help answer the user's question.`
  }

  // 9. Track token usage
  let inputTokens = 0
  let outputTokens = 0
  let fullResponse = ''

  // 10. Create streaming response with MCP tool support
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...claudeMessages]
        let toolIterations = 0

        // Tool use loop - continues until Claude responds without tool use
        while (toolIterations < MAX_TOOL_ITERATIONS) {
          // Call Claude API with circuit breaker protection
          const response = await anthropicCircuitBreaker.execute(async () => {
            return withTimeout(
              anthropic.messages.create({
                model: bot.model,
                max_tokens: bot.max_tokens,
                temperature: bot.temperature,
                system: systemPrompt,
                messages: currentMessages,
                tools: mcpTools.length > 0 ? mcpTools : undefined,
                stream: true,
              }),
              60000, // 60 second timeout
              'Claude API request timeout'
            )
          })

          // Collect the full response to check for tool use
          let currentContent: Anthropic.ContentBlock[] = []
          let hasToolUse = false
          let currentToolUseBlock: {
            id: string
            name: string
            input: Record<string, unknown>
          } | null = null

          // Process streaming events
          for await (const event of response) {
            switch (event.type) {
              case 'message_start':
                inputTokens += event.message.usage.input_tokens
                logger.debug({
                  type: 'stream_start',
                  messageId: event.message.id,
                  inputTokens: event.message.usage.input_tokens,
                  iteration: toolIterations,
                })
                break

              case 'content_block_start':
                if (event.content_block.type === 'tool_use') {
                  hasToolUse = true
                  currentToolUseBlock = {
                    id: event.content_block.id,
                    name: event.content_block.name,
                    input: {},
                  }
                  // Notify client that tool is being used
                  const toolNotice = JSON.stringify({
                    type: 'tool_use',
                    tool: event.content_block.name,
                  })
                  controller.enqueue(encoder.encode(`data: ${toolNotice}\n\n`))
                }
                break

              case 'content_block_delta':
                if (event.delta.type === 'text_delta') {
                  const chunk = event.delta.text
                  fullResponse += chunk

                  // Send chunk to client
                  const payload = JSON.stringify({ content: chunk })
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
                } else if (event.delta.type === 'input_json_delta' && currentToolUseBlock) {
                  // Accumulate tool input JSON
                  // Note: We need to parse the accumulated JSON at the end
                }
                break

              case 'content_block_stop':
                if (currentToolUseBlock) {
                  currentContent.push({
                    type: 'tool_use',
                    id: currentToolUseBlock.id,
                    name: currentToolUseBlock.name,
                    input: currentToolUseBlock.input,
                  })
                  currentToolUseBlock = null
                }
                break

              case 'message_delta':
                if (event.usage) {
                  outputTokens += event.usage.output_tokens
                }
                break

              case 'message_stop':
                logger.debug({
                  type: 'stream_iteration_complete',
                  iteration: toolIterations,
                  hasToolUse,
                })
                break
            }
          }

          // If no tool use, we're done
          if (!hasToolUse) {
            break
          }

          // Execute tool calls and prepare tool results
          if (mcpRuntime && currentContent.length > 0) {
            const toolResults: Anthropic.ToolResultBlockParam[] = []

            for (const block of currentContent) {
              if (block.type === 'tool_use') {
                logger.info({
                  type: 'tool_execution',
                  toolName: block.name,
                  toolId: block.id,
                })

                const result = await mcpRuntime.executeTool(
                  block.name,
                  block.input as Record<string, unknown>
                )

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: result.success
                    ? JSON.stringify(result.result, null, 2)
                    : `Error: ${result.error}`,
                  is_error: !result.success,
                })

                // Notify client of tool result
                const resultNotice = JSON.stringify({
                  type: 'tool_result',
                  tool: block.name,
                  success: result.success,
                })
                controller.enqueue(encoder.encode(`data: ${resultNotice}\n\n`))
              }
            }

            // Add assistant message with tool use and tool results
            currentMessages.push({
              role: 'assistant',
              content: currentContent,
            })

            currentMessages.push({
              role: 'user',
              content: toolResults,
            })
          }

          toolIterations++
        }

        if (toolIterations >= MAX_TOOL_ITERATIONS) {
          logger.warn({
            type: 'max_tool_iterations',
            botId: data.botId,
            iterations: toolIterations,
          })
        }

        // Stream complete
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

        // 11. Track metrics and costs
        const duration = Date.now() - startTime
        const cost = calculateClaudeCost(bot.model, inputTokens, outputTokens)

        await trackChatMessage({
          userId: session.user.id,
          botId: data.botId,
          conversationId: data.conversationId,
          model: bot.model,
          inputTokens,
          outputTokens,
          duration,
          cost,
        })

        logPerformance('chat_request', duration, {
          botId: data.botId,
          inputTokens,
          outputTokens,
          cost: cost.toFixed(4),
          toolIterations,
        })

        // Cleanup MCP runtime
        if (mcpRuntime) {
          await mcpRuntime.shutdown()
        }
      } catch (error) {
        // Enhanced error handling in stream
        const err = error as Error

        logError(err, {
          type: 'stream_error',
          botId: data.botId,
          userId: session.user.id,
          conversationId: data.conversationId,
        })

        // Cleanup MCP runtime on error
        if (mcpRuntime) {
          await mcpRuntime.shutdown()
        }

        // Send error to client
        const errorPayload = JSON.stringify({
          error: err.message || 'An error occurred during streaming',
        })
        controller.enqueue(encoder.encode(`data: ${errorPayload}\n\n`))
        controller.close()

        // Re-throw to be caught by outer handler
        throw error
      }
    },
  })

  // 12. Create streaming response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})
