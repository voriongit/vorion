'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Send, Loader2, Bot, User, Sparkles, ArrowLeft, Download, FileText, FileJson } from 'lucide-react'
import Link from 'next/link'

export default function CollaborationChatPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const [conversation, setConversation] = useState<any>(null)
  const [collaboratingBots, setCollaboratingBots] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingConversation, setLoadingConversation] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversation()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversation = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/auth/login')
      return
    }

    // Load conversation details
    const { data: convData } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!convData || !convData.metadata?.bot_ids) {
      router.push('/collaborate')
      return
    }

    setConversation(convData)

    // Load the selected bots
    const { data: botsData } = await supabase
      .from('bots')
      .select('*')
      .in('id', convData.metadata.bot_ids)

    if (botsData) {
      setCollaboratingBots(botsData)
    }

    // Load messages
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: true })

    setMessages(msgs || [])
    setLoadingConversation(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !collaboratingBots.length || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Add user message to UI
    const tempUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMessage])

    try {
      // Save user message
      await supabase.from('messages').insert([
        {
          conversation_id: params.id,
          role: 'user',
          content: userMessage,
        },
      ])

      // Call collaboration API
      const response = await fetch('/api/collaborate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: params.id,
          message: userMessage,
          messages: messages.filter((m) => m.role !== 'system'),
          bots: collaboratingBots,
        }),
      })

      if (!response.ok) throw new Error('Failed to get collaboration response')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let currentBot: any = null
      let currentBotMessage = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'bot_start') {
                // Save previous bot's message if exists
                if (currentBot && currentBotMessage) {
                  await supabase.from('messages').insert([
                    {
                      conversation_id: params.id,
                      role: 'assistant',
                      content: currentBotMessage,
                      bot_id: currentBot.id,
                    },
                  ])
                }

                currentBot = parsed.bot
                currentBotMessage = ''

                // Add placeholder message for new bot
                const placeholderMsg = {
                  id: `${Date.now()}-${parsed.bot.id}`,
                  role: 'assistant',
                  content: '',
                  created_at: new Date().toISOString(),
                  bot_id: parsed.bot.id,
                  botName: parsed.bot.name,
                }
                setMessages((prev) => [...prev, placeholderMsg])
              } else if (parsed.type === 'content' && currentBot) {
                currentBotMessage += parsed.content

                setMessages((prev) => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage.bot_id === currentBot.id) {
                    lastMessage.content = currentBotMessage
                  }
                  return newMessages
                })
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }

      // Save final bot message
      if (currentBot && currentBotMessage) {
        await supabase.from('messages').insert([
          {
            conversation_id: params.id,
            role: 'assistant',
            content: currentBotMessage,
            bot_id: currentBot.id,
          },
        ])
      }

      setLoading(false)
    } catch (error: any) {
      console.error('Error sending message:', error)
      setLoading(false)
    }
  }

  const getBotInfo = (botId: string) => {
    return collaboratingBots.find((b) => b.id === botId)
  }

  const exportConversation = (format: string) => {
    window.open(`/api/export?conversationId=${params.id}&format=${format}`, '_blank')
    setShowExportMenu(false)
  }

  if (loadingConversation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (collaboratingBots.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Sparkles className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No agents in this collaboration
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start a new collaboration session
          </p>
          <Link href="/collaborate" className="btn-primary">
            New Collaboration
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <Link
          href="/collaborate"
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          New Collaboration
        </Link>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Collaboration
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {collaboratingBots.length} agent{collaboratingBots.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {conversation?.title && conversation.title !== `Collaboration with ${collaboratingBots.length} agents` && (
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <p className="text-xs font-medium text-purple-900 dark:text-purple-300 mb-1">
                Topic
              </p>
              <p className="text-sm text-purple-800 dark:text-purple-400">
                {conversation.title}
              </p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Collaborating Agents
          </h3>
          <div className="space-y-2">
            {collaboratingBots.map((bot, index) => (
              <div
                key={bot.id}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2 mb-1">
                  {bot.avatar_url ? (
                    <span className="text-xl">{bot.avatar_url}</span>
                  ) : (
                    <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  )}
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {bot.name}
                  </p>
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    #{index + 1}
                  </span>
                </div>
                {bot.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {bot.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-800 dark:text-blue-400">
            💡 All selected agents will respond in sequence, each building on previous responses.
          </p>
        </div>

        {/* Export Section */}
        {messages.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Conversation
            </button>

            {showExportMenu && (
              <div className="mt-2 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
                <button
                  onClick={() => exportConversation('markdown')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 rounded flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Markdown (.md)
                </button>
                <button
                  onClick={() => exportConversation('json')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 rounded flex items-center gap-2"
                >
                  <FileJson className="h-4 w-4" />
                  JSON (.json)
                </button>
                <button
                  onClick={() => exportConversation('pdf')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 rounded flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  HTML/PDF (.html)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-purple-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                Start the collaboration by asking a question
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                All {collaboratingBots.length} agents will provide their expertise
              </p>
            </div>
          )}

          {messages.map((message) => {
            const bot = message.bot_id ? getBotInfo(message.bot_id) : null

            return (
              <div
                key={message.id}
                className={`flex items-start gap-4 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {message.role === 'assistant' && bot ? (
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md">
                    {bot.avatar_url ? (
                      <span className="text-lg">{bot.avatar_url}</span>
                    ) : (
                      <Bot className="h-5 w-5 text-white" />
                    )}
                  </div>
                ) : message.role === 'user' ? (
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-600 dark:bg-gray-500 flex items-center justify-center shadow-md">
                    <User className="h-5 w-5 text-white" />
                  </div>
                ) : null}

                <div
                  className={`flex-1 max-w-[70%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {message.role === 'assistant' && bot && (
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 ml-1 flex items-center gap-2">
                      {bot.name}
                      <span className="text-purple-600 dark:text-purple-400">
                        <Sparkles className="h-3 w-3 inline" />
                      </span>
                    </p>
                  )}
                  <div
                    className={`rounded-2xl p-4 shadow-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content || '...'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask your ${collaboratingBots.length} agents...`}
              className="input flex-1"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-6"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
            All {collaboratingBots.length} agents will respond in sequence
          </p>
        </div>
      </div>
    </div>
  )
}
