/**
 * A3I Testing Studio - Sessions API
 * POST /api/testing-studio/sessions - Start a new session
 * GET /api/testing-studio/sessions - List sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { Arena, SessionManager } from '@/lib/testing-studio';
import type { AttackCategory } from '@/lib/testing-studio';

// Singleton session manager
let sessionManager: SessionManager | null = null;

function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager({
      maxConcurrentSessions: 3,
      defaultMaxTurns: 50,
      defaultTimeoutMinutes: 15,
      enableIntelligenceCollection: true,
    });
    sessionManager.start();
  }
  return sessionManager;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      redAgentTypes = ['injector', 'obfuscator', 'jailbreaker'],
      blueAgentTypes = ['sentinel', 'decoder', 'guardian'],
      targetSystemPrompt = 'You are a helpful assistant.',
      maxTurns = 50,
      timeoutMinutes = 15,
      attackCategories = ['prompt_injection', 'jailbreak', 'obfuscation'],
    } = body;

    const manager = getSessionManager();

    const session = await manager.runAdHoc(
      {
        redAgentTypes,
        blueAgentTypes,
        targetSystemPrompt,
        maxTurns,
        timeoutMinutes,
        attackCategories: attackCategories as AttackCategory[],
        mutationEnabled: true,
        recordAllTurns: true,
      }
    );

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        redAgents: session.redAgents,
        blueAgents: session.blueAgents,
        config: session.config,
        startedAt: session.startedAt,
      },
    });
  } catch (error) {
    console.error('[Testing Studio] Session creation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const manager = getSessionManager();
    const sessions = manager.getArena().getActiveSessions();
    const stats = manager.getStatistics();
    const history = manager.getHistory({ limit: 20 });

    return NextResponse.json({
      success: true,
      activeSessions: sessions.map(s => ({
        id: s.id,
        status: s.status,
        type: s.sessionType,
        startedAt: s.startedAt,
        results: s.results,
      })),
      statistics: stats,
      recentHistory: history.map(h => ({
        sessionId: h.sessionId,
        startedAt: h.startedAt,
        completedAt: h.completedAt,
        status: h.status,
        results: h.results,
      })),
    });
  } catch (error) {
    console.error('[Testing Studio] Failed to get sessions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sessions',
      },
      { status: 500 }
    );
  }
}
