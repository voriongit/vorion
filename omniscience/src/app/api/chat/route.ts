import { NextRequest, NextResponse } from 'next/server';
import { synthesize } from '@/lib/ai-providers';
import { searchLexicon } from '@/lib/lexicon-data';

export async function POST(request: NextRequest) {
  try {
    const { query, context } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Check local knowledge first
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
          <div class="mt-4 p-2 bg-gray-800 rounded text-xs text-gray-500">
            For now, queries are limited to the local knowledge base.
          </div>
        `,
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
