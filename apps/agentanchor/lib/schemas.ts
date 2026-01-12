/**
 * Request/Response Validation Schemas
 *
 * Zod schemas for validating API requests and responses.
 * Provides type-safe validation with detailed error messages.
 */

import { z } from 'zod'

/**
 * Common schemas
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format')

export const EmailSchema = z.string().email('Invalid email address')

export const TimestampSchema = z.string().datetime('Invalid ISO 8601 timestamp')

/**
 * Chat API schemas
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system'], {
    errorMap: () => ({ message: 'Role must be user, assistant, or system' }),
  }),
  content: z.string().min(1, 'Message content cannot be empty'),
})

export const ChatRequestSchema = z.object({
  botId: UUIDSchema,
  message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long (max 10000 characters)'),
  conversationId: UUIDSchema,
  messages: z.array(ChatMessageSchema).max(100, 'Too many messages in history (max 100)'),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

/**
 * Bot creation/update schemas
 */
export const BotTypeSchema = z.enum([
  'code',
  'writer',
  'analyst',
  'researcher',
  'support',
  'devops',
  'custom',
])

export const ClaudeModelSchema = z.enum([
  'claude-3-5-sonnet-20241022',
  'claude-sonnet-4-5-20250514',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
])

export const CreateBotRequestSchema = z.object({
  name: z.string().min(1, 'Bot name is required').max(100, 'Bot name too long (max 100 characters)'),
  description: z.string().max(500, 'Description too long (max 500 characters)').optional(),
  system_prompt: z.string().min(10, 'System prompt must be at least 10 characters').max(5000, 'System prompt too long (max 5000 characters)'),
  type: BotTypeSchema.optional(),
  model: ClaudeModelSchema.default('claude-3-5-sonnet-20241022'),
  temperature: z.number().min(0, 'Temperature must be >= 0').max(2, 'Temperature must be <= 2').default(1.0),
  max_tokens: z.number().min(1, 'Max tokens must be >= 1').max(200000, 'Max tokens must be <= 200000').default(4096),
  is_public: z.boolean().default(false),
  avatar_url: z.string().optional(),
})

export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>

export const UpdateBotRequestSchema = CreateBotRequestSchema.partial()

export type UpdateBotRequest = z.infer<typeof UpdateBotRequestSchema>

/**
 * Team schemas
 */
export const CreateTeamRequestSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  botIds: z.array(UUIDSchema).max(10, 'Too many bots (max 10 per team)').optional(),
})

export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>

export const AddBotToTeamRequestSchema = z.object({
  botId: UUIDSchema,
  role: z.string().max(50, 'Role too long').optional(),
})

export type AddBotToTeamRequest = z.infer<typeof AddBotToTeamRequestSchema>

/**
 * MCP Server schemas
 */
export const MCPServerTypeSchema = z.enum([
  'filesystem',
  'github',
  'database',
  'websearch',
  'custom',
])

export const CreateMCPServerRequestSchema = z.object({
  name: z.string().min(1, 'MCP server name is required').max(100, 'Name too long'),
  type: MCPServerTypeSchema,
  description: z.string().max(500, 'Description too long').optional(),
  config: z.record(z.any()),
})

export type CreateMCPServerRequest = z.infer<typeof CreateMCPServerRequestSchema>

export const AttachMCPServerRequestSchema = z.object({
  mcpServerId: UUIDSchema,
  permissions: z.record(z.any()).optional(),
})

export type AttachMCPServerRequest = z.infer<typeof AttachMCPServerRequestSchema>

/**
 * Conversation schemas
 */
export const CreateConversationRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  botId: UUIDSchema.optional(),
  teamId: UUIDSchema.optional(),
}).refine(
  (data) => (data.botId && !data.teamId) || (!data.botId && data.teamId),
  'Conversation must have either botId or teamId, not both'
)

export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>

/**
 * Orchestrator intent parsing schemas
 */
export const ParseIntentRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(1000, 'Message too long for intent parsing'),
})

export type ParseIntentRequest = z.infer<typeof ParseIntentRequestSchema>

export const IntentActionSchema = z.enum(['create_bot', 'create_team', 'create_mcp', 'none'])

export const IntentResponseSchema = z.object({
  action: IntentActionSchema,
  params: z.record(z.any()).optional(),
})

export type IntentResponse = z.infer<typeof IntentResponseSchema>

/**
 * Profile update schema
 */
export const UpdateProfileRequestSchema = z.object({
  full_name: z.string().max(100, 'Name too long').optional(),
  avatar_url: z.string().url('Invalid URL').optional(),
})

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>

/**
 * Query parameter schemas
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type PaginationParams = z.infer<typeof PaginationSchema>

export const SortOrderSchema = z.enum(['asc', 'desc']).default('desc')

export const BotFiltersSchema = z.object({
  is_public: z.coerce.boolean().optional(),
  type: BotTypeSchema.optional(),
  search: z.string().max(100).optional(),
  ...PaginationSchema.shape,
  sort_by: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  sort_order: SortOrderSchema,
})

export type BotFilters = z.infer<typeof BotFiltersSchema>

/**
 * Validation helper functions
 */

/**
 * Validate request body against schema
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }))

      throw new Error(`Validation failed: ${JSON.stringify(errors)}`)
    }
    throw error
  }
}

/**
 * Validate query parameters against schema
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  try {
    const params = Object.fromEntries(searchParams.entries())
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }))

      throw new Error(`Query validation failed: ${JSON.stringify(errors)}`)
    }
    throw error
  }
}

/**
 * Safe parse with default value
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown, defaultValue: T): T {
  const result = schema.safeParse(data)
  return result.success ? result.data : defaultValue
}
