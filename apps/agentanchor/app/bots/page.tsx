import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Bot, Plus, Trash2, Edit } from 'lucide-react'

export default async function BotsPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const { data: bots } = await supabase
    .from('bots')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Bots
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your custom AI assistants
          </p>
        </div>
        <Link href="/bots/new" className="btn-primary">
          <Plus className="h-4 w-4 inline mr-2" />
          Create Bot
        </Link>
      </div>

      {bots && bots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <div key={bot.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  {bot.avatar_url ? (
                    <img
                      src={bot.avatar_url}
                      alt={bot.name}
                      className="h-12 w-12 rounded-full"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {bot.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {bot.model}
                    </p>
                  </div>
                </div>
              </div>

              {bot.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {bot.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  href={`/bots/${bot.id}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Link>
                <Link
                  href={`/chat?bot=${bot.id}`}
                  className="btn-primary text-sm py-1 px-3"
                >
                  Chat
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Bot className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No bots yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first AI assistant to get started
          </p>
          <Link href="/bots/new" className="btn-primary">
            <Plus className="h-4 w-4 inline mr-2" />
            Create Your First Bot
          </Link>
        </div>
      )}
    </div>
  )
}
