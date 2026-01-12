/**
 * Agent Dependencies API
 *
 * GET /api/v1/agents/[agentId]/dependencies - Get agent dependencies
 * POST /api/v1/agents/[agentId]/dependencies - Add a dependency
 * DELETE /api/v1/agents/[agentId]/dependencies - Remove a dependency
 *
 * Story 16-3: Cascade Halt Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// GET - Get agent dependencies
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = await params;

    // Get dependencies (agents this agent depends on)
    const { data: dependsOn, error: dependsOnError } = await supabase
      .from('agent_dependencies')
      .select(`
        id,
        depends_on_agent_id,
        dependency_type,
        created_at,
        depends_on:bots!agent_dependencies_depends_on_agent_id_fkey(id, name, is_paused)
      `)
      .eq('agent_id', agentId);

    // Get dependents (agents that depend on this agent)
    const { data: dependents, error: dependentsError } = await supabase
      .from('agent_dependencies')
      .select(`
        id,
        agent_id,
        dependency_type,
        created_at,
        dependent:bots!agent_dependencies_agent_id_fkey(id, name, is_paused)
      `)
      .eq('depends_on_agent_id', agentId);

    return NextResponse.json({
      success: true,
      agentId,
      dependsOn: dependsOn || [],
      dependents: dependents || [],
      cascadeRisk: (dependents || []).length, // Number of agents that would be affected by cascade
    });
  } catch (error) {
    console.error('Get dependencies error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Add a dependency
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = await params;
    const body = await request.json();

    if (!body.dependsOnAgentId) {
      return NextResponse.json(
        { error: 'dependsOnAgentId is required' },
        { status: 400 }
      );
    }

    // Verify user owns the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, user_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to modify this agent' },
        { status: 403 }
      );
    }

    // Prevent self-dependency
    if (agentId === body.dependsOnAgentId) {
      return NextResponse.json(
        { error: 'Agent cannot depend on itself' },
        { status: 400 }
      );
    }

    // Check for circular dependency
    const hasCircular = await checkCircularDependency(
      supabase,
      body.dependsOnAgentId,
      agentId
    );

    if (hasCircular) {
      return NextResponse.json(
        { error: 'This would create a circular dependency' },
        { status: 400 }
      );
    }

    // Create dependency
    const { data: dependency, error: insertError } = await supabase
      .from('agent_dependencies')
      .insert({
        agent_id: agentId,
        depends_on_agent_id: body.dependsOnAgentId,
        dependency_type: body.dependencyType || 'operational',
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Dependency already exists' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      dependency,
    });
  } catch (error) {
    console.error('Add dependency error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove a dependency
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { agentId } = await params;
    const dependsOnAgentId = request.nextUrl.searchParams.get('dependsOnAgentId');

    if (!dependsOnAgentId) {
      return NextResponse.json(
        { error: 'dependsOnAgentId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify user owns the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, user_id')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to modify this agent' },
        { status: 403 }
      );
    }

    // Delete dependency
    const { error: deleteError } = await supabase
      .from('agent_dependencies')
      .delete()
      .eq('agent_id', agentId)
      .eq('depends_on_agent_id', dependsOnAgentId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Dependency removed',
    });
  } catch (error) {
    console.error('Remove dependency error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper: Check for circular dependency
// =============================================================================

async function checkCircularDependency(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startAgentId: string,
  targetAgentId: string,
  visited: Set<string> = new Set()
): Promise<boolean> {
  if (startAgentId === targetAgentId) {
    return true;
  }

  if (visited.has(startAgentId)) {
    return false;
  }

  visited.add(startAgentId);

  const { data: dependencies } = await supabase
    .from('agent_dependencies')
    .select('depends_on_agent_id')
    .eq('agent_id', startAgentId);

  if (!dependencies) {
    return false;
  }

  for (const dep of dependencies) {
    if (await checkCircularDependency(supabase, dep.depends_on_agent_id, targetAgentId, visited)) {
      return true;
    }
  }

  return false;
}
