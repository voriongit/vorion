'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Loader2, Sparkles, User, Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface SetupStep {
  id: string
  title: string
  description: string
  completed: boolean
}

export default function OrchestratorPage() {
  const supabase = createClient()
  const [orchestratorBot, setOrchestratorBot] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([
    {
      id: 'understand',
      title: 'Understand the Platform',
      description: 'Learn what you can build',
      completed: false,
    },
    {
      id: 'mcp',
      title: 'Set Up MCP Servers',
      description: 'Connect external tools and data',
      completed: false,
    },
    {
      id: 'bots',
      title: 'Create Specialized Bots',
      description: 'Build your AI assistants',
      completed: false,
    },
    {
      id: 'teams',
      title: 'Organize into Teams',
      description: 'Group bots by function',
      completed: false,
    },
  ])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadOrchestrator()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    checkSetupProgress()
  }, [])

  const checkSetupProgress = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return

    // Check what the user has completed
    const [{ data: bots }, { data: teams }, { data: mcpServers }] = await Promise.all([
      supabase.from('bots').select('id').eq('user_id', session.user.id),
      supabase.from('teams').select('id').eq('user_id', session.user.id),
      supabase.from('mcp_servers').select('id').eq('user_id', session.user.id),
    ])

    setSetupSteps((prev) =>
      prev.map((step) => {
        if (step.id === 'understand') {
          return { ...step, completed: messages.length > 2 }
        }
        if (step.id === 'mcp') {
          return { ...step, completed: (mcpServers?.length || 0) > 0 }
        }
        if (step.id === 'bots') {
          // Count non-orchestrator bots
          return { ...step, completed: (bots?.length || 0) > 1 }
        }
        if (step.id === 'teams') {
          return { ...step, completed: (teams?.length || 0) > 0 }
        }
        return step
      })
    )
  }

  const loadOrchestrator = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    // Get Master Orchestrator bot
    const { data: bot } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('name', '🎯 Master Orchestrator')
      .single()

    if (bot) {
      setOrchestratorBot(bot)
      await loadConversation(bot.id)
    }
  }

  const loadConversation = async (botId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    // Get or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('bot_id', botId)
      .single()

    if (!conversation) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert([
          {
            user_id: session.user.id,
            bot_id: botId,
            title: 'Welcome to AgentAnchor',
          },
        ])
        .select()
        .single()
      conversation = newConv
    }

    if (conversation) {
      setConversationId(conversation.id)

      // Load existing messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      if (msgs && msgs.length > 0) {
        setMessages(msgs)
      } else {
        // Send initial welcome message
        await sendInitialMessage(conversation.id)
      }
    }
  }

  const sendInitialMessage = async (convId: string) => {
    const welcomeMessage = "Welcome! 🎉 I'm your Master Orchestrator, here to help you build your custom AI assistant ecosystem.\n\nLet's get started! What would you like to accomplish with AI assistants? Are you interested in:\n\n1. 🔧 Development & Code assistance\n2. ✍️ Content creation & writing\n3. 📊 Data analysis & insights\n4. 🔍 Research & information gathering\n5. 💡 Something else entirely\n\nTell me about your goals, and I'll help you set up the perfect team of AI assistants!"

    const tempMessage = {
      id: Date.now(),
      role: 'assistant',
      content: welcomeMessage,
      created_at: new Date().toISOString(),
      bot_id: orchestratorBot?.id,
    }

    setMessages([tempMessage])

    await supabase.from('messages').insert([
      {
        conversation_id: convId,
        role: 'assistant',
        content: welcomeMessage,
        bot_id: orchestratorBot?.id,
      },
    ])
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !orchestratorBot || !conversationId || loading) return

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
          conversation_id: conversationId,
          role: 'user',
          content: userMessage,
        },
      ])

      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId: orchestratorBot.id,
          message: userMessage,
          conversationId,
          messages: messages.filter((m) => m.role !== 'system'),
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      const tempAssistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        bot_id: orchestratorBot.id,
      }
      setMessages((prev) => [...prev, tempAssistantMessage])

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
              if (parsed.content) {
                assistantMessage += parsed.content
                setMessages((prev) => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage.role === 'assistant') {
                    lastMessage.content = assistantMessage
                  }
                  return newMessages
                })
              }
            } catch (e) {
              // Ignore
            }
          }
        }
      }

      await supabase.from('messages').insert([
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantMessage,
          bot_id: orchestratorBot.id,
        },
      ])

      // Parse intent and auto-create resources
      await checkAndCreateResources(userMessage, assistantMessage)

      setLoading(false)
      checkSetupProgress()
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  const checkAndCreateResources = async (userMessage: string, assistantResponse: string) => {
    try {
      // Parse user intent
      const intentResponse = await fetch('/api/orchestrator/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      const { intent } = await intentResponse.json()

      if (intent.action === 'create_bot') {
        // Create bot automatically
        const createResponse = await fetch('/api/orchestrator/create-bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: intent.params.name,
            description: intent.params.description,
            type: intent.params.type,
            systemPrompt: intent.params.systemPrompt,
          }),
        })

        const { bot } = await createResponse.json()

        if (bot) {
          // Add system message about creation
          const successMsg = {
            id: Date.now() + 100,
            role: 'system',
            content: `✅ Successfully created bot "${bot.name}"! You can find it in your Bots page.`,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, successMsg])

          await supabase.from('messages').insert([
            {
              conversation_id: conversationId,
              role: 'system',
              content: successMsg.content,
            },
          ])
        }
      } else if (intent.action === 'create_team') {
        const createResponse = await fetch('/api/orchestrator/create-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: intent.params.name,
            description: intent.params.description,
            botIds: intent.params.botIds || [],
          }),
        })

        const { team } = await createResponse.json()

        if (team) {
          const successMsg = {
            id: Date.now() + 100,
            role: 'system',
            content: `✅ Successfully created team "${team.name}"! You can find it in your Teams page.`,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, successMsg])

          await supabase.from('messages').insert([
            {
              conversation_id: conversationId,
              role: 'system',
              content: successMsg.content,
            },
          ])
        }
      } else if (intent.action === 'create_mcp') {
        const createResponse = await fetch('/api/orchestrator/create-mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: intent.params.name,
            type: intent.params.type,
            description: intent.params.description,
          }),
        })

        const { mcpServer } = await createResponse.json()

        if (mcpServer) {
          const successMsg = {
            id: Date.now() + 100,
            role: 'system',
            content: `✅ Successfully created MCP server "${mcpServer.name}"! You can configure it in your MCP Servers page.`,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, successMsg])

          await supabase.from('messages').insert([
            {
              conversation_id: conversationId,
              role: 'system',
              content: successMsg.content,
            },
          ])
        }
      }

      // Refresh progress after any creation
      await checkSetupProgress()
    } catch (error) {
      console.error('Resource creation error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Master Orchestrator
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Your AI guide to building a custom assistant ecosystem
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Setup Progress Sidebar */}
          <div className="lg:col-span-1">
            <div className="card sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Setup Progress
              </h3>
              <div className="space-y-4">
                {setupSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                        step.completed
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {step.completed ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          step.completed
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Quick Links
                </h4>
                <div className="space-y-2">
                  <Link
                    href="/bots/new"
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Create Bot
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </Link>
                  <Link
                    href="/teams/new"
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Create Team
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </Link>
                  <Link
                    href="/mcp"
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Add MCP Server
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2">
            <div className="card flex flex-col h-[calc(100vh-16rem)]">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-4 ${
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-md">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-600 dark:bg-gray-500 flex items-center justify-center shadow-md">
                        <User className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <div
                      className={`flex-1 max-w-[80%] ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`rounded-2xl p-4 shadow-sm ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : message.role === 'system'
                            ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-600 text-green-900 dark:text-green-100'
                            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="bg-white dark:bg-gray-700 rounded-2xl p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-400" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything about setting up your AI assistants..."
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
