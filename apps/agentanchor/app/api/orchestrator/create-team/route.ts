import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { name, description, botIds } = await req.json()

    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert([
        {
          user_id: session.user.id,
          name: name,
          description: description,
        },
      ])
      .select()
      .single()

    if (teamError) throw teamError

    // Add bots to team if specified
    if (botIds && botIds.length > 0) {
      const teamBots = botIds.map((botId: string) => ({
        team_id: team.id,
        bot_id: botId,
      }))

      const { error: teamBotsError } = await supabase
        .from('team_bots')
        .insert(teamBots)

      if (teamBotsError) throw teamBotsError
    }

    return NextResponse.json({ success: true, team })
  } catch (error: any) {
    console.error('Create team error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
