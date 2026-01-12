import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    // Use Claude to parse the user's intent
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      temperature: 0,
      system: `You are an intent parser for an AI bot building platform. Analyze user messages and determine if they want to create a bot, team, or MCP server.

Return a JSON object with this structure:
{
  "action": "create_bot" | "create_team" | "create_mcp" | "none",
  "params": {
    // For create_bot:
    "name": string,
    "description": string,
    "type": "code" | "writer" | "analyst" | "researcher" | "support" | "devops",
    "systemPrompt": string (optional, will use template if not provided)

    // For create_team:
    "name": string,
    "description": string,
    "botIds": string[] (empty if creating new team)

    // For create_mcp:
    "name": string,
    "type": "filesystem" | "github" | "database" | "websearch" | "custom",
    "description": string
  }
}

Examples:
User: "Create a code assistant bot named CodeHelper"
Response: {"action":"create_bot","params":{"name":"CodeHelper","type":"code","description":"A code assistant bot"}}

User: "I need a writer bot for blog posts"
Response: {"action":"create_bot","params":{"name":"Blog Writer","type":"writer","description":"AI assistant for writing blog posts"}}

User: "Set up a development team"
Response: {"action":"create_team","params":{"name":"Development Team","description":"Team for software development tasks","botIds":[]}}

User: "Add a GitHub MCP server"
Response: {"action":"create_mcp","params":{"name":"GitHub Integration","type":"github","description":"GitHub MCP server"}}

If the message is not about creating resources, return {"action":"none"}`,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      try {
        const intent = JSON.parse(content.text)
        return NextResponse.json({ success: true, intent })
      } catch (e) {
        return NextResponse.json({ success: true, intent: { action: 'none' } })
      }
    }

    return NextResponse.json({ success: true, intent: { action: 'none' } })
  } catch (error: any) {
    console.error('Parse intent error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
