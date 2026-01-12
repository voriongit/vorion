'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Loader2, Bot, User } from 'lucide-react'

export default function ChatPage() {
  const supabase = createClient()
  const [bots, setBots] = useState<any[]>([])
  const [selectedBot, setSelectedBot] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadBots()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadBots = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const { data } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    setBots(data || [])
    if (data && data.length > 0) {
      setSelectedBot(data[0])
      await createConversation(data[0].id)
    }
  }

  const createConversation = async (botId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const { data, error } = await supabase
      .from('conversations')
      .insert([
        {
          user_id: session.user.id,
          bot_id: botId,
          title: 'New Conversation',
        },
      ])
      .select()
      .single()

    if (!error && data) {
      setConversationId(data.id)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !selectedBot || !conversationId || loading) return

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
      // Save user message to database
      await supabase.from('messages').insert([
        {
          conversation_id: conversationId,
          role: 'user',
          content: userMessage,
        },
      ])

      // Call API to get bot response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId: selectedBot.id,
          message: userMessage,
          conversationId,
          messages: messages.filter((m) => m.role !== 'system'),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      // Add assistant message placeholder
      const tempAssistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        bot_id: selectedBot.id,
      }
      setMessages((prev) => [...prev, tempAssistantMessage])

      // Stream the response
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
              // Ignore parsing errors
            }
          }
        }
      }

      // Save assistant message to database
      await supabase.from('messages').insert([
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantMessage,
          bot_id: selectedBot.id,
        },
      ])

      setLoading(false)
    } catch (error: any) {
      console.error('Error sending message:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: 'assistant',
          content: 'Sorry, there was an error processing your message.',
          created_at: new Date().toISOString(),
        },
      ])
      setLoading(false)
    }
  }

  const handleBotChange = async (bot: any) => {
    setSelectedBot(bot)
    setMessages([])
    await createConversation(bot.id)
  }

  if (bots.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <Bot className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No bots available
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create a bot first to start chatting
          </p>
          <a href="/bots/new" className="btn-primary">
            Create Bot
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Bot Selector Sidebar */}
      <div className="w-64 card p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Select Bot
        </h3>
        <div className="space-y-2">
          {bots.map((bot) => (
            <button
              key={bot.id}
              onClick={() => handleBotChange(bot)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedBot?.id === bot.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bot.name}</p>
                  <p className="text-xs opacity-75 truncate">{bot.model}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 card flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedBot?.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedBot?.model}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                Start a conversation with {selectedBot?.name}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-gray-600 dark:bg-gray-500 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="input flex-1"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
