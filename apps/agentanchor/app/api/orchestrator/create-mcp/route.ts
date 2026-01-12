import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { name, type, description, config } = await req.json()

    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Default configs for common MCP server types
    const defaultConfigs: Record<string, any> = {
      filesystem: {
        basePath: '/workspace',
        permissions: ['read', 'write'],
      },
      github: {
        repositories: [],
        permissions: ['read', 'write', 'pr'],
      },
      database: {
        type: 'postgresql',
        connectionString: '',
        readOnly: false,
      },
      websearch: {
        engine: 'google',
        maxResults: 10,
      },
      custom: config || {},
    }

    // Create the MCP server
    const { data: mcpServer, error } = await supabase
      .from('mcp_servers')
      .insert([
        {
          user_id: session.user.id,
          name: name,
          type: type,
          description: description,
          config: config || defaultConfigs[type] || {},
        },
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, mcpServer })
  } catch (error: any) {
    console.error('Create MCP server error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
