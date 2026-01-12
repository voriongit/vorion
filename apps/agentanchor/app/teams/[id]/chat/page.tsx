'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Send, Loader2, Bot, User, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TeamChatPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const [team, setTeam] = useState<any>(null)
  const [teamBots, setTeamBots] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTeam()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadTeam = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    // Load team details
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!teamData) {
      router.push('/teams')
      return
    }

    setTeam(teamData)

    // Load team bots
    const { data: teamBotsData } = await supabase
      .from('team_bots')
      .select(`
        id,
        role,
        bots (
          id,
          name,
          description,
          avatar_url,
          system_prompt,
          model,
          temperature,
          max_tokens
        )
      `)
      .eq('team_id', params.id)

    if (teamBotsData) {
      const bots = teamBotsData.map((tb: any) => ({
        ...tb.bots,
        teamRole: tb.role,
      }))
      setTeamBots(bots)
      await createConversation(teamData.id)
    }
  }

  const createConversation = async (teamId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    // Check for existing conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!conversation) {
      const { data, error } = await supabase
        .from('conversations')
        .insert([
          {
            user_id: session.user.id,
            team_id: teamId,
            title: `${team?.name || 'Team'} Conversation`,
          },
        ])
        .select()
        .single()

      conversation = data
    }

    if (conversation) {
      setConversationId(conversation.id)

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      setMessages(msgs || [])
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !teamBots.length || !conversationId || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    // Add user message
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

      // Call team chat API
      const response = await fetch('/api/team-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: params.id,
          message: userMessage,
          conversationId,
          messages: messages.filter((m) => m.role !== 'system'),
          teamBots,
        }),
      })

      if (!response.ok) throw new Error('Failed to get team response')

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
                // New bot starting to respond
                if (currentBot && currentBotMessage) {
                  // Save previous bot's message
                  await supabase.from('messages').insert([
                    {
                      conversation_id: conversationId,
                      role: 'assistant',
                      content: currentBotMessage,
                      bot_id: currentBot.id,
                    },
                  ])
                }

                currentBot = parsed.bot
                currentBotMessage = ''

                // Add placeholder message
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
            conversation_id: conversationId,
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
    return teamBots.find((b) => b.id === botId)
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (teamBots.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No bots in this team
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add some bots to start team chat
          </p>
          <Link href={`/teams/${params.id}`} className="btn-primary">
            Edit Team
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Team Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <Link
          href="/teams"
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Teams
        </Link>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {team.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {teamBots.length} bot{teamBots.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {team.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {team.description}
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Team Members
          </h3>
          <div className="space-y-2">
            {teamBots.map((bot) => (
              <div
                key={bot.id}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {bot.name}
                  </p>
                </div>
                {bot.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {bot.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                Start a conversation with your team
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Team members will collaborate to answer your questions
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
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                    <Bot className="h-5 w-5 text-white" />
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
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 ml-1">
                      {bot.name}
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
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-400" />
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
              placeholder={`Ask your team (${teamBots.length} bots will collaborate)...`}
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
  )
}
