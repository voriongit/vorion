/**
 * AI Provider Abstraction Layer
 *
 * This module provides a unified interface for multiple AI models.
 * Supports native Gemini, Claude, and Grok APIs when keys are configured.
 * Falls back to Gemini simulation for unconfigured providers.
 */

import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { xai } from '@ai-sdk/xai';
import { generateText, streamText } from 'ai';
import type { AIModel, SynthesisPerspective, SynthesisRequest, SynthesisResponse } from '@/types';

// Provider status - dynamically check for API keys
export function getProviderStatus(): Record<AIModel, { available: boolean; simulated: boolean }> {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasXaiKey = !!process.env.XAI_API_KEY;
  const hasGoogleKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  return {
    gemini: { available: hasGoogleKey, simulated: false },
    claude: { available: hasAnthropicKey, simulated: !hasAnthropicKey },
    grok: { available: hasXaiKey, simulated: !hasXaiKey },
  };
}

// Legacy export for backwards compatibility
export const providerStatus = getProviderStatus();

// Model personas for simulation
const MODEL_PERSONAS: Record<AIModel, string> = {
  gemini: `You are responding as Gemini - Google's helpful, balanced AI.
    You provide accurate, multimodal-aware responses with good structure.
    Be helpful and informative while maintaining safety.`,

  claude: `You are responding as Claude - Anthropic's thoughtful AI assistant.
    You provide detailed, well-reasoned responses with careful consideration of nuance.
    Be thorough, safe, and academically rigorous in your explanations.`,

  grok: `You are responding as Grok - xAI's direct and witty AI.
    You provide straightforward, technically deep responses with a touch of humor.
    Be direct, slightly rebellious, and don't shy away from complexity.`,
};

// Synthesis prompt template
const SYNTHESIS_PROMPT = `You are the NEXUS TRIAD SYNTHESIZER.

You have received perspectives from multiple AI models on a user's question.
Your task is to synthesize these into a single, cohesive, and comprehensive answer.

PERSPECTIVES PROVIDED:
{perspectives}

USER QUESTION: {query}

INSTRUCTIONS:
1. Identify the key insights from each perspective
2. Resolve any contradictions by explaining different viewpoints
3. Create a unified answer that captures the best of each perspective
4. Format your response in clear, readable HTML

OUTPUT FORMAT:
<div class="synthesis-result">
  <div class="mb-3 font-bold text-white">Synthesis Result:</div>
  [Your synthesized answer here]
  <div class="mt-4 p-2 bg-gray-800 rounded text-xs text-gray-400">
    <div class="font-bold mb-1">Contributors:</div>
    [List which models contributed to this synthesis]
  </div>
</div>`;

/**
 * Generate a perspective from a specific AI model
 */
export async function generatePerspective(
  model: AIModel,
  query: string,
  context?: string
): Promise<SynthesisPerspective> {
  const persona = MODEL_PERSONAS[model];
  const status = getProviderStatus()[model];
  const promptText = context ? `Context: ${context}\n\nQuestion: ${query}` : query;

  // If model is available natively, use it
  if (status.available && !status.simulated) {
    if (model === 'gemini') {
      const result = await generateText({
        model: google('gemini-2.0-flash'),
        system: persona,
        prompt: promptText,
      });
      return { model, content: result.text };
    }

    if (model === 'claude') {
      const result = await generateText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: persona,
        prompt: promptText,
      });
      return { model, content: result.text };
    }

    if (model === 'grok') {
      const result = await generateText({
        model: xai('grok-3'),
        system: persona,
        prompt: promptText,
      });
      return { model, content: result.text };
    }
  }

  // Fall back to Gemini simulation for unavailable models
  const simulationPrompt = `${persona}

The user is asking about: ${query}
${context ? `\nContext: ${context}` : ''}

Respond as this AI model would, maintaining its unique perspective and style.`;

  const result = await generateText({
    model: google('gemini-2.0-flash'),
    prompt: simulationPrompt,
  });

  return { model, content: result.text };
}

/**
 * Generate synthesis from multiple model perspectives
 */
export async function synthesize(request: SynthesisRequest): Promise<SynthesisResponse> {
  const startTime = Date.now();
  const models = request.models || ['gemini', 'claude', 'grok'];

  // Generate all perspectives in parallel
  const perspectivePromises = models.map(model =>
    generatePerspective(model, request.query, request.context)
  );

  const perspectives = await Promise.all(perspectivePromises);

  // Format perspectives for synthesis
  const perspectivesText = perspectives
    .map(p => `### ${p.model.toUpperCase()} PERSPECTIVE:\n${p.content}`)
    .join('\n\n');

  // Generate final synthesis
  const synthesisPrompt = SYNTHESIS_PROMPT
    .replace('{perspectives}', perspectivesText)
    .replace('{query}', request.query);

  const synthesisResult = await generateText({
    model: google('gemini-2.0-flash'),
    prompt: synthesisPrompt,
  });

  return {
    synthesis: synthesisResult.text,
    perspectives,
    processingTime: Date.now() - startTime,
  };
}

/**
 * Stream synthesis response for real-time UI updates
 */
export async function streamSynthesis(request: SynthesisRequest) {
  const models = request.models || ['gemini', 'claude', 'grok'];

  // Generate perspectives first (could also stream these)
  const perspectives = await Promise.all(
    models.map(model => generatePerspective(model, request.query, request.context))
  );

  const perspectivesText = perspectives
    .map(p => `### ${p.model.toUpperCase()} PERSPECTIVE:\n${p.content}`)
    .join('\n\n');

  const synthesisPrompt = SYNTHESIS_PROMPT
    .replace('{perspectives}', perspectivesText)
    .replace('{query}', request.query);

  // Stream the synthesis
  return streamText({
    model: google('gemini-2.0-flash'),
    prompt: synthesisPrompt,
  });
}

/**
 * Check which providers are currently available
 */
export function getAvailableProviders(): AIModel[] {
  return (Object.keys(providerStatus) as AIModel[])
    .filter(model => providerStatus[model].available);
}

/**
 * Update provider availability (call when API keys are added)
 */
export function updateProviderStatus(model: AIModel, available: boolean) {
  providerStatus[model] = { available, simulated: !available };
}
