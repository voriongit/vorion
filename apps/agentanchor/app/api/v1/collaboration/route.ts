/**
 * Agent Collaboration API
 *
 * Endpoints for agent-to-agent collaboration, consensus, proactive actions,
 * and excellence cycles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CollaborationService } from '@/lib/collaboration';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const agentId = searchParams.get('agentId');

    switch (action) {
      case 'stats': {
        // Get collaboration stats
        const stats = await getCollaborationStats(supabase, user.id);
        return NextResponse.json({ stats });
      }

      case 'collaborations': {
        if (!agentId) {
          return NextResponse.json({ error: 'agentId required' }, { status: 400 });
        }
        const status = searchParams.get('status') || undefined;
        const limit = parseInt(searchParams.get('limit') || '10');
        const result = await CollaborationService.getAgentCollaborations(agentId, { status, limit });
        return NextResponse.json({ collaborations: result.collaborations, error: result.error });
      }

      case 'proactive': {
        const behavior = searchParams.get('behavior') || undefined;
        const status = searchParams.get('status') || undefined;
        const limit = parseInt(searchParams.get('limit') || '10');

        if (agentId) {
          const result = await CollaborationService.getAgentProactiveActions(agentId, { behavior, status, limit });
          return NextResponse.json({ actions: result.actions, error: result.error });
        }

        // Get all proactive actions for user's agents
        const { data: bots } = await supabase
          .from('bots')
          .select('id')
          .eq('user_id', user.id);

        const allActions: any[] = [];
        for (const bot of bots || []) {
          const result = await CollaborationService.getAgentProactiveActions(bot.id, { behavior, status, limit: Math.ceil(limit / (bots?.length || 1)) });
          allActions.push(...result.actions);
        }

        // Sort by created date and limit
        allActions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return NextResponse.json({ actions: allActions.slice(0, limit) });
      }

      case 'cycles': {
        if (!agentId) {
          return NextResponse.json({ error: 'agentId required' }, { status: 400 });
        }
        const active = searchParams.get('active') === 'true';
        if (active) {
          const result = await CollaborationService.getActiveCycle(agentId);
          return NextResponse.json({ cycle: result.cycle, error: result.error });
        }
        const limit = parseInt(searchParams.get('limit') || '10');
        const result = await CollaborationService.getCycleHistory(agentId, limit);
        return NextResponse.json({ cycles: result.cycles, error: result.error });
      }

      case 'tasks': {
        if (!agentId) {
          return NextResponse.json({ error: 'agentId required' }, { status: 400 });
        }
        const status = searchParams.get('status') || undefined;
        const limit = parseInt(searchParams.get('limit') || '10');
        const result = await CollaborationService.getTaskQueue(agentId, { status, limit });
        return NextResponse.json({ tasks: result.tasks, error: result.error });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Collaboration API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'createCollaboration': {
        const result = await CollaborationService.createCollaboration({
          initiatorId: data.initiatorId,
          targetId: data.targetId,
          participants: data.participants,
          mode: data.mode,
          taskType: data.taskType,
          taskDescription: data.taskDescription,
          context: data.context,
          urgency: data.urgency,
          expectedOutcome: data.expectedOutcome,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
        });
        return NextResponse.json({ collaboration: result.collaboration, error: result.error });
      }

      case 'startCollaboration': {
        const result = await CollaborationService.startCollaboration(data.collaborationId);
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'completeCollaboration': {
        const result = await CollaborationService.completeCollaboration(
          data.collaborationId,
          data.finalOutcome,
          data.successRate
        );
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'submitOutcome': {
        const result = await CollaborationService.submitOutcome({
          collaborationId: data.collaborationId,
          agentId: data.agentId,
          contribution: data.contribution,
          confidence: data.confidence,
          actionItems: data.actionItems,
          timeSpentMs: data.timeSpentMs,
          tokensUsed: data.tokensUsed,
        });
        return NextResponse.json({ outcome: result.outcome, error: result.error });
      }

      case 'createConsensus': {
        const result = await CollaborationService.createConsensus({
          initiatorId: data.initiatorId,
          question: data.question,
          context: data.context,
          participants: data.participants,
          requiredAgreement: data.requiredAgreement,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
        });
        return NextResponse.json({ consensus: result.consensus, error: result.error });
      }

      case 'submitVote': {
        const result = await CollaborationService.submitVote({
          consensusId: data.consensusId,
          agentId: data.agentId,
          vote: data.vote,
          reasoning: data.reasoning,
          confidence: data.confidence,
        });
        return NextResponse.json({
          vote: result.vote,
          consensusResolved: result.consensusResolved,
          error: result.error,
        });
      }

      case 'createProactiveAction': {
        const result = await CollaborationService.createProactiveAction({
          agentId: data.agentId,
          behavior: data.behavior,
          triggerEvent: data.triggerEvent,
          analysis: data.analysis,
          recommendation: data.recommendation,
          actionSteps: data.actionSteps,
          delegatedTo: data.delegatedTo,
          collaboratedWith: data.collaboratedWith,
          priority: data.priority,
          confidence: data.confidence,
        });
        return NextResponse.json({ action: result.action, error: result.error });
      }

      case 'executeProactiveAction': {
        const result = await CollaborationService.executeProactiveAction(data.actionId);
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'completeProactiveAction': {
        const result = await CollaborationService.completeProactiveAction(
          data.actionId,
          data.outcome,
          data.success
        );
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'queueTask': {
        const result = await CollaborationService.queueTask({
          agentId: data.agentId,
          taskType: data.taskType,
          description: data.description,
          context: data.context,
          priority: data.priority,
          urgency: data.urgency,
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
          source: data.source,
          sourceId: data.sourceId,
        });
        return NextResponse.json({ task: result.task, error: result.error });
      }

      case 'assignTask': {
        const result = await CollaborationService.assignTask(data.taskId, data.agentId);
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'completeTask': {
        const result = await CollaborationService.completeTask(data.taskId, data.result, data.success);
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'startCycle': {
        const result = await CollaborationService.startCycle({
          agentId: data.agentId,
          input: data.input,
        });
        return NextResponse.json({ cycle: result.cycle, error: result.error });
      }

      case 'advanceCycle': {
        const result = await CollaborationService.advanceCycle({
          cycleId: data.cycleId,
          output: data.output,
          metrics: data.metrics,
        });
        return NextResponse.json({ cycle: result.cycle, error: result.error });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Collaboration API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// Helper function to get collaboration stats
async function getCollaborationStats(supabase: any, userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get user's agents
  const { data: bots } = await supabase
    .from('bots')
    .select('id')
    .eq('user_id', userId);

  const botIds = (bots || []).map((b: any) => b.id);

  if (botIds.length === 0) {
    return {
      activeCollaborations: 0,
      completedToday: 0,
      pendingConsensus: 0,
      proactiveActionsToday: 0,
      activeCycles: 0,
      successRate: 0,
    };
  }

  // Count active collaborations
  const { count: activeCollabs } = await supabase
    .from('agent_collaborations')
    .select('*', { count: 'exact', head: true })
    .in('initiator_id', botIds)
    .eq('status', 'active');

  // Count completed today
  const { count: completedToday } = await supabase
    .from('agent_collaborations')
    .select('*', { count: 'exact', head: true })
    .in('initiator_id', botIds)
    .eq('status', 'completed')
    .gte('completed_at', today.toISOString());

  // Count pending consensus
  const { count: pendingConsensus } = await supabase
    .from('agent_consensus')
    .select('*', { count: 'exact', head: true })
    .in('initiator_id', botIds)
    .eq('status', 'voting');

  // Count proactive actions today
  const { count: proactiveToday } = await supabase
    .from('proactive_actions')
    .select('*', { count: 'exact', head: true })
    .in('agent_id', botIds)
    .gte('created_at', today.toISOString());

  // Count active cycles
  const { count: activeCycles } = await supabase
    .from('excellence_cycles')
    .select('*', { count: 'exact', head: true })
    .in('agent_id', botIds)
    .eq('status', 'active');

  // Calculate success rate from completed collaborations
  const { data: completedCollabs } = await supabase
    .from('agent_collaborations')
    .select('success_rate')
    .in('initiator_id', botIds)
    .eq('status', 'completed')
    .not('success_rate', 'is', null)
    .limit(100);

  const successRate = completedCollabs && completedCollabs.length > 0
    ? completedCollabs.reduce((sum: number, c: any) => sum + (c.success_rate || 0), 0) / completedCollabs.length
    : 0;

  return {
    activeCollaborations: activeCollabs || 0,
    completedToday: completedToday || 0,
    pendingConsensus: pendingConsensus || 0,
    proactiveActionsToday: proactiveToday || 0,
    activeCycles: activeCycles || 0,
    successRate,
  };
}
