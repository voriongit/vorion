import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Plus, MessageSquare } from 'lucide-react'

export default async function TeamsPage() {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const { data: teams } = await supabase
    .from('teams')
    .select(`
      *,
      team_bots (
        id,
        bots (
          id,
          name,
          avatar_url
        )
      )
    `)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Teams
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Organize your bots into collaborative teams
          </p>
        </div>
        <Link href="/teams/new" className="btn-primary">
          <Plus className="h-4 w-4 inline mr-2" />
          Create Team
        </Link>
      </div>

      {teams && teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div key={team.id} className="card hover:shadow-xl transition-shadow">
              <Link href={`/teams/${team.id}`} className="block">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {team.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {team.team_bots?.length || 0} bots
                    </p>
                  </div>
                </div>
              </div>

              {team.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {team.description}
                </p>
              )}

              {team.team_bots && team.team_bots.length > 0 && (
                <div className="flex -space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {team.team_bots.slice(0, 5).map((teamBot: any) => (
                    <div
                      key={teamBot.id}
                      className="h-8 w-8 rounded-full bg-blue-600 dark:bg-blue-500 border-2 border-white dark:border-gray-800 flex items-center justify-center"
                      title={teamBot.bots?.name}
                    >
                      <span className="text-xs text-white font-medium">
                        {teamBot.bots?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {team.team_bots.length > 5 && (
                    <div className="h-8 w-8 rounded-full bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                      <span className="text-xs text-white font-medium">
                        +{team.team_bots.length - 5}
                      </span>
                    </div>
                  )}
                </div>
              )}
              </Link>

              {/* Action Buttons */}
              {team.team_bots && team.team_bots.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href={`/teams/${team.id}/chat`}
                    className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Team Chat
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No teams yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first team to organize your bots
          </p>
          <Link href="/teams/new" className="btn-primary">
            <Plus className="h-4 w-4 inline mr-2" />
            Create Your First Team
          </Link>
        </div>
      )}
    </div>
  )
}
