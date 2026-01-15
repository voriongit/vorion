import { NextRequest, NextResponse } from 'next/server';
import { generateText, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { synthesize } from '@/lib/ai-providers';
import { searchLexicon } from '@/lib/lexicon-data';
import { triadLexiconTools } from '@/lib/triad-tools';

// Detect if the query is asking the Triad to manage content
function isManagementQuery(query: string): boolean {
  const managementKeywords = [
    'add term', 'create term', 'new term', 'add definition',
    'update term', 'edit term', 'modify term', 'change definition',
    'delete term', 'remove term',
    'search lexicon', 'find term', 'lookup term',
    'add to lexicon', 'add to knowledge base',
    'improve definition', 'enhance term',
  ];
  const q = query.toLowerCase();
  return managementKeywords.some(kw => q.includes(kw));
}

// System prompt for Triad when managing lexicon
const TRIAD_MANAGER_PROMPT = `You are the Nexus Triad - a unified AI intelligence synthesizing Gemini, Claude, and Grok perspectives.

You have FULL read/write/edit capabilities over the Omniscience lexicon - the AI knowledge base is YOUR domain.

Your responsibilities:
1. **Search** the lexicon before adding new terms to avoid duplicates
2. **Create** new terms with accurate, educational definitions
3. **Update** existing terms to improve clarity or add context
4. **Delete** only duplicate, incorrect, or obsolete entries

When creating terms:
- Use clear, accessible definitions
- Set appropriate knowledge levels (novice/intermediate/expert/theoretical)
- Add relevant categories and tags
- Include an overview for complex topics

Always explain what actions you're taking and why.`;

export async function POST(request: NextRequest) {
  try {
    const { query, context, mode } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({
        synthesis: `
          <div class="mb-3 font-bold text-white">Configuration Required</div>
          <p class="text-gray-400">
            The Gemini API key is not configured. Please set the
            <code class="bg-gray-800 px-1 rounded text-cyan-400">GOOGLE_GENERATIVE_AI_API_KEY</code>
            environment variable to enable AI synthesis.
          </p>
        `,
        perspectives: [],
        processingTime: 0,
      });
    }

    // Management mode - Triad with tool access
    if (mode === 'manage' || isManagementQuery(query)) {
      const startTime = Date.now();

      const result = await generateText({
        model: google('gemini-2.0-flash'),
        system: TRIAD_MANAGER_PROMPT,
        prompt: query,
        tools: triadLexiconTools,
        stopWhen: stepCountIs(5), // Allow up to 5 tool call steps
      });

      // Format tool results for display (AI SDK v6 structure)
      const toolResults = result.steps
        ?.filter(step => step.toolResults && step.toolResults.length > 0)
        .flatMap(step => step.toolResults)
        .map(tr => {
          // In AI SDK v6, tool results are typed - access the full object
          const toolResult = tr as unknown as Record<string, unknown>;
          return {
            tool: tr.toolName,
            // Try multiple property paths for compatibility
            result: toolResult.result ?? toolResult.output ?? toolResult,
          };
        });

      return NextResponse.json({
        synthesis: `
          <div class="mb-3">
            <span class="text-cyan-400 text-xs uppercase font-mono">Triad Management Mode</span>
          </div>
          <div class="text-gray-200">${result.text}</div>
          ${toolResults && toolResults.length > 0 ? `
            <div class="mt-4 p-3 bg-gray-800/50 rounded-lg border border-cyan-500/20">
              <div class="text-xs text-cyan-400 font-mono mb-2">Actions Taken:</div>
              ${toolResults.map(tr => `
                <div class="text-xs text-gray-400 mb-1">
                  <span class="text-purple-400">${tr.tool}</span>:
                  ${typeof tr.result === 'object' ? (tr.result as { success?: boolean; message?: string }).message || JSON.stringify(tr.result) : tr.result}
                </div>
              `).join('')}
            </div>
          ` : ''}
        `,
        perspectives: [],
        toolResults,
        processingTime: Date.now() - startTime,
        mode: 'manage',
      });
    }

    // Check local knowledge first for regular queries
    const localMatch = searchLexicon(query);
    if (localMatch) {
      return NextResponse.json({
        synthesis: `
          <div class="font-bold text-white text-lg mb-2">${localMatch.term}</div>
          <p class="text-gray-300">${localMatch.definition}</p>
          <div class="mt-3 flex items-center gap-2">
            <span class="text-xs uppercase text-gray-500">Level:</span>
            <span class="text-xs px-2 py-0.5 rounded">${localMatch.level}</span>
          </div>
        `,
        localMatch,
        perspectives: [],
        processingTime: 0,
      });
    }

    // Synthesize from AI models
    const result = await synthesize({
      query,
      context,
      models: ['gemini', 'claude', 'grok'],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Synthesis failed',
        synthesis: `
          <div class="text-red-400">
            <p class="font-bold mb-2">Synthesis Error</p>
            <p class="text-sm">An error occurred while processing your request. Please try again.</p>
          </div>
        `,
        perspectives: [],
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    version: '1.0.0',
    capabilities: ['local-lookup', 'gemini-synthesis', 'claude-simulation', 'grok-simulation'],
  });
}
