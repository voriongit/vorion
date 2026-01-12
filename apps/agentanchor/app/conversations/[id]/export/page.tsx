'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Download, FileText, FileJson, File, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function ExportConversationPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const [conversation, setConversation] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadConversation()
  }, [])

  const loadConversation = async () => {
    const { data: conv } = await supabase
      .from('conversations')
      .select(`
        *,
        bots (name),
        teams (name)
      `)
      .eq('id', params.id)
      .single()

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: true })

    setConversation(conv)
    setMessages(msgs || [])
    setLoading(false)
  }

  const exportAsText = () => {
    setExporting(true)
    const text = messages
      .map((msg) => `[${msg.role.toUpperCase()}]: ${msg.content}`)
      .join('\n\n---\n\n')

    const blob = new Blob([text], { type: 'text/plain' })
    downloadBlob(blob, `conversation-${conversation.title}.txt`)
    setExporting(false)
  }

  const exportAsJSON = () => {
    setExporting(true)
    const data = {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        bot: conversation.bots?.name,
        team: conversation.teams?.name,
      },
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
      })),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    downloadBlob(blob, `conversation-${conversation.title}.json`)
    setExporting(false)
  }

  const exportAsMarkdown = () => {
    setExporting(true)
    let markdown = `# ${conversation.title}\n\n`
    markdown += `**Created:** ${new Date(conversation.created_at).toLocaleString()}\n`
    markdown += `**Updated:** ${new Date(conversation.updated_at).toLocaleString()}\n\n`
    markdown += `---\n\n`

    messages.forEach((msg) => {
      markdown += `## ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n\n`
      markdown += `${msg.content}\n\n`
    })

    const blob = new Blob([markdown], { type: 'text/markdown' })
    downloadBlob(blob, `conversation-${conversation.title}.md`)
    setExporting(false)
  }

  const exportAsHTML = () => {
    setExporting(true)
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${conversation.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #333; }
        .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
        .user { background: #e3f2fd; }
        .assistant { background: #f5f5f5; }
        .role { font-weight: bold; margin-bottom: 8px; color: #666; }
        .content { white-space: pre-wrap; }
        .meta { color: #999; font-size: 0.9em; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>${conversation.title}</h1>
    <div class="meta">
        <p><strong>Created:</strong> ${new Date(conversation.created_at).toLocaleString()}</p>
        <p><strong>Updated:</strong> ${new Date(conversation.updated_at).toLocaleString()}</p>
    </div>
    <hr>
`

    messages.forEach((msg) => {
      html += `
    <div class="message ${msg.role}">
        <div class="role">${msg.role.toUpperCase()}</div>
        <div class="content">${msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
`
    })

    html += `
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    downloadBlob(blob, `conversation-${conversation.title}.html`)
    setExporting(false)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Conversation not found</p>
      </div>
    )
  }

  const exportOptions = [
    {
      id: 'text',
      name: 'Plain Text',
      description: 'Simple text format, easy to read',
      icon: FileText,
      action: exportAsText,
    },
    {
      id: 'json',
      name: 'JSON',
      description: 'Structured data format',
      icon: FileJson,
      action: exportAsJSON,
    },
    {
      id: 'markdown',
      name: 'Markdown',
      description: 'Formatted text with headers',
      icon: File,
      action: exportAsMarkdown,
    },
    {
      id: 'html',
      name: 'HTML',
      description: 'Styled web page',
      icon: File,
      action: exportAsHTML,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/conversations"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Export Conversation
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {conversation.title} • {messages.length} messages
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Select Export Format
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exportOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={option.action}
                disabled={exporting}
                className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-600 dark:hover:border-blue-400 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-8 w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {option.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Export Tips
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Use <strong>Plain Text</strong> for simple archiving</li>
              <li>• Use <strong>JSON</strong> for programmatic access</li>
              <li>• Use <strong>Markdown</strong> for documentation</li>
              <li>• Use <strong>HTML</strong> for sharing via web</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
