import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET - List all presets for user
export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: presets, error } = await supabase
      .from('collaboration_presets')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    // Load bot details for each preset
    const presetsWithBots = await Promise.all(
      (presets || []).map(async (preset) => {
        const { data: bots } = await supabase
          .from('bots')
          .select('id, name, avatar_url, description')
          .in('id', preset.bot_ids)

        return {
          ...preset,
          bots: bots || [],
        }
      })
    )

    return NextResponse.json({ presets: presetsWithBots })
  } catch (error: any) {
    console.error('Error loading presets:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new preset
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, bot_ids, is_favorite } = await req.json()

    if (!name || !bot_ids || bot_ids.length < 2) {
      return NextResponse.json(
        { error: 'Name and at least 2 bot IDs required' },
        { status: 400 }
      )
    }

    const { data: preset, error } = await supabase
      .from('collaboration_presets')
      .insert([
        {
          user_id: session.user.id,
          name,
          description,
          bot_ids,
          is_favorite: is_favorite || false,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ preset })
  } catch (error: any) {
    console.error('Error creating preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update a preset
export async function PUT(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, name, description, bot_ids, is_favorite } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'Preset ID required' }, { status: 400 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (bot_ids !== undefined) updateData.bot_ids = bot_ids
    if (is_favorite !== undefined) updateData.is_favorite = is_favorite

    const { data: preset, error } = await supabase
      .from('collaboration_presets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ preset })
  } catch (error: any) {
    console.error('Error updating preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a preset
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Preset ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('collaboration_presets')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
