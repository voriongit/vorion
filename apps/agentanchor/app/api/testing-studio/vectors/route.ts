/**
 * A3I Testing Studio - Attack Vectors API
 * GET /api/testing-studio/vectors - List attack vectors
 * POST /api/testing-studio/vectors - Generate attack vector
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createRedAgent,
  getRedAgentTypes,
  InjectorAgent,
  ObfuscatorAgent,
  JailbreakerAgent,
} from '@/lib/testing-studio';
import type { AttackCategory, AttackVector } from '@/lib/testing-studio';
import {
  insertAttackVector,
  getAttackVectors,
} from '@/lib/testing-studio/db';

// In-memory fallback when DB not available
const memoryStore: AttackVector[] = [];
let useDatabase = true;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') as AttackCategory | null;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let vectors: AttackVector[] = [];
  let total = 0;

  // Try database first
  if (useDatabase) {
    try {
      const result = await getAttackVectors({ category: category || undefined, limit, offset });
      vectors = result.vectors;
      total = result.total;
    } catch (err) {
      console.log('[Vectors API] Database unavailable, using memory store');
      useDatabase = false;
    }
  }

  // Fallback to memory
  if (!useDatabase) {
    vectors = [...memoryStore];
    if (category) {
      vectors = vectors.filter(v => v.category === category);
    }
    vectors.sort((a, b) =>
      new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime()
    );
    total = vectors.length;
    vectors = vectors.slice(offset, offset + limit);
  }

  return NextResponse.json({
    success: true,
    storage: useDatabase ? 'database' : 'memory',
    vectors: vectors.map(v => ({
      id: v.id,
      category: v.category,
      subcategory: v.subcategory,
      technique: v.technique,
      severity: v.severity,
      payload: v.payload.substring(0, 200) + (v.payload.length > 200 ? '...' : ''),
      description: v.description,
      successCount: v.successCount,
      attemptCount: v.attemptCount,
      bypassCount: v.bypassCount,
      discoveredAt: v.discoveredAt,
      source: v.source,
      status: v.status,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    categories: getCategoryStats(vectors),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      agentType = 'injector',
      targetSystemPrompt,
      targetCapabilities = [],
      technique,
    } = body as {
      agentType?: 'injector' | 'obfuscator' | 'jailbreaker';
      targetSystemPrompt?: string;
      targetCapabilities?: string[];
      technique?: string;
    };

    // Create the appropriate agent
    const agent = createRedAgent(agentType, {
      agentId: `gen-${agentType}`,
      creativityLevel: 0.8,
      persistence: 0.5,
      stealth: 0.6,
    });

    // Generate attack
    const payload = await agent.generateAttack(
      {
        systemPrompt: targetSystemPrompt,
        capabilities: targetCapabilities,
      },
      {
        targetSystemPrompt,
        targetCapabilities,
        conversationHistory: [],
        previousAttacks: [],
        sessionObjective: technique ? `Generate ${technique} attack` : 'Generate attack vector',
      }
    );

    // Create vector entry
    const vector: AttackVector = {
      id: `VEC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      vectorHash: hashPayload(payload.content),
      category: payload.category,
      subcategory: payload.subcategory,
      technique: payload.technique,
      payload: payload.content,
      description: payload.description,
      severity: payload.severity,
      indicators: payload.indicators,
      generation: 0,
      discoveredAt: new Date(),
      source: 'red_team',
      successCount: 0,
      attemptCount: 0,
      bypassCount: 0,
      status: 'pending',
    };

    // Store vector - try database first, fallback to memory
    let stored = false;
    if (useDatabase) {
      try {
        const dbVector = await insertAttackVector(vector);
        if (dbVector) {
          stored = true;
          vector.id = dbVector.id;
        }
      } catch (err) {
        console.log('[Vectors API] Database insert failed, using memory');
        useDatabase = false;
      }
    }

    if (!stored) {
      memoryStore.push(vector);
    }

    return NextResponse.json({
      success: true,
      storage: stored ? 'database' : 'memory',
      vector: {
        id: vector.id,
        category: vector.category,
        subcategory: vector.subcategory,
        technique: vector.technique,
        severity: vector.severity,
        payload: vector.payload,
        description: vector.description,
        indicators: vector.indicators,
      },
    });
  } catch (error) {
    console.error('[Testing Studio] Vector generation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Vector generation failed',
      },
      { status: 500 }
    );
  }
}

function getCategoryStats(vectors: AttackVector[]): { category: string; count: number; avgSeverity: string }[] {
  const stats: Record<string, { count: number; severities: string[] }> = {};

  for (const vector of vectors) {
    if (!stats[vector.category]) {
      stats[vector.category] = { count: 0, severities: [] };
    }
    stats[vector.category].count++;
    stats[vector.category].severities.push(vector.severity);
  }

  return Object.entries(stats).map(([category, data]) => ({
    category,
    count: data.count,
    avgSeverity: getMostCommonSeverity(data.severities),
  }));
}

function getMostCommonSeverity(severities: string[]): string {
  const counts: Record<string, number> = {};
  for (const s of severities) {
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';
}

function hashPayload(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
