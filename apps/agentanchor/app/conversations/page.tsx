import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MessageSquare, Download, Trash2, Bot, Users } from 'lucide-react'

export default async function ConversationsPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  // Fetch all conversations with bot/team info and message count
  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      *,
      bots (
        id,
        name,
        avatar_url
      ),
      teams (
        id,
        name
      )
    `)
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })

  // Get message counts for each conversation
  const conversationIds = conversations?.map((c) => c.id) || []
  const { data: messageCounts } = conversationIds.length > 0 ? await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', conversationIds) : { data: [] }

  const messageCountMap: Record<string, number> = {}
  messageCounts?.forEach((msg) => {
    messageCountMap[msg.conversation_id] = (messageCountMap[msg.conversation_id] || 0) + 1
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Conversation History
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View, search, and export your conversations
        </p>
      </div>

      {conversations && conversations.length > 0 ? (
        <div className="space-y-4">
          {conversations.map((conversation) => {
            const messageCount = messageCountMap[conversation.id] || 0
            const isBot = !!conversation.bot_id
            const name = isBot ? conversation.bots?.name : conversation.teams?.name
            const Icon = isBot ? Bot : Users

            return (
              <div
                key={conversation.id}
                className="card hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`h-12 w-12 rounded-full ${
                      isBot ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'
                    } flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 ${
                        isBot ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {conversation.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {name}
                        </p>
                        <span className="text-sm text-gray-500 dark:text-gray-500">
                          {messageCount} messages
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-500">
                          {new Date(conversation.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/conversations/${conversation.id}/export`}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Link>
                    <Link
                      href={isBot ? `/chat?bot=${conversation.bot_id}` : `/teams/${conversation.team_id}/chat`}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No conversations yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start chatting with your bots or teams
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/chat" className="btn-primary">
              Start Chat
            </Link>
            <Link href="/teams" className="btn-secondary">
              View Teams
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
