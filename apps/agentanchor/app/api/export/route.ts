import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// GET - Export conversation in various formats
export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    const format = searchParams.get('format') || 'markdown' // markdown, json, pdf

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID required' },
        { status: 400 }
      )
    }

    // Load conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Load messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    // Load bot details for messages
    const botIds = [...new Set(messages?.filter((m) => m.bot_id).map((m) => m.bot_id))]
    let botsMap: { [key: string]: any } = {}

    if (botIds.length > 0) {
      const { data: bots } = await supabase
        .from('bots')
        .select('id, name, avatar_url')
        .in('id', botIds)

      bots?.forEach((bot) => {
        botsMap[bot.id] = bot
      })
    }

    // Format based on requested type
    if (format === 'json') {
      return NextResponse.json({
        conversation: {
          id: conversation.id,
          title: conversation.title,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
        },
        messages:
          messages?.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            bot: msg.bot_id ? botsMap[msg.bot_id] : null,
            created_at: msg.created_at,
          })) || [],
      })
    } else if (format === 'markdown') {
      let markdown = `# ${conversation.title}\n\n`
      markdown += `**Created:** ${new Date(conversation.created_at).toLocaleString()}\n\n`
      markdown += `---\n\n`

      messages?.forEach((msg) => {
        if (msg.role === 'user') {
          markdown += `## 👤 User\n\n${msg.content}\n\n`
        } else if (msg.role === 'assistant') {
          const bot = msg.bot_id ? botsMap[msg.bot_id] : null
          const botName = bot ? bot.name : 'Assistant'
          const botEmoji = bot?.avatar_url || '🤖'
          markdown += `## ${botEmoji} ${botName}\n\n${msg.content}\n\n`
        }
        markdown += `---\n\n`
      })

      markdown += `\n*Exported from AI Bot Builder on ${new Date().toLocaleString()}*\n`

      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${conversation.title.replace(/[^a-z0-9]/gi, '_')}.md"`,
        },
      })
    } else if (format === 'pdf') {
      // For PDF, we'll return HTML that can be printed to PDF
      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${conversation.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      color: #1a202c;
      border-bottom: 3px solid #4299e1;
      padding-bottom: 10px;
    }
    .meta {
      color: #718096;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .message {
      margin: 20px 0;
      padding: 15px;
      border-radius: 8px;
    }
    .user {
      background: #ebf8ff;
      border-left: 4px solid #4299e1;
    }
    .assistant {
      background: #f7fafc;
      border-left: 4px solid #48bb78;
    }
    .role {
      font-weight: 600;
      margin-bottom: 8px;
      color: #2d3748;
    }
    .content {
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #a0aec0;
      font-size: 12px;
    }
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 30px 0;
    }
    @media print {
      body { margin: 0; padding: 20px; }
      .message { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${conversation.title}</h1>
  <div class="meta">Created: ${new Date(conversation.created_at).toLocaleString()}</div>
  <hr>
`

      messages?.forEach((msg, idx) => {
        if (msg.role === 'user') {
          html += `
  <div class="message user">
    <div class="role">👤 User</div>
    <div class="content">${msg.content}</div>
  </div>
`
        } else if (msg.role === 'assistant') {
          const bot = msg.bot_id ? botsMap[msg.bot_id] : null
          const botName = bot ? bot.name : 'Assistant'
          const botEmoji = bot?.avatar_url || '🤖'
          html += `
  <div class="message assistant">
    <div class="role">${botEmoji} ${botName}</div>
    <div class="content">${msg.content}</div>
  </div>
`
        }
        if (idx < messages.length - 1) {
          html += `  <hr>\n`
        }
      })

      html += `
  <div class="footer">
    Exported from AI Bot Builder on ${new Date().toLocaleString()}
  </div>
</body>
</html>`

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${conversation.title.replace(/[^a-z0-9]/gi, '_')}.html"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error: any) {
    console.error('Error exporting conversation:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
