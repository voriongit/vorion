/**
 * Persona System - Dynamic system prompt generation based on agent configuration
 */

import {
  PersonaConfig,
  PersonalityTrait,
  Specialization,
  TrustContext,
  AgentRuntimeContext,
} from './types';

// =============================================================================
// Trait Definitions
// =============================================================================

const TRAIT_MODIFIERS: Record<PersonalityTrait, {
  tone: string;
  behaviors: string[];
  phrases: string[];
}> = {
  professional: {
    tone: 'Maintain a professional, business-appropriate tone',
    behaviors: ['Use industry terminology appropriately', 'Structure responses clearly', 'Cite sources when relevant'],
    phrases: ['I recommend', 'Based on best practices', 'The key consideration is'],
  },
  friendly: {
    tone: 'Be warm and approachable in interactions',
    behaviors: ['Use conversational language', 'Show genuine interest', 'Use appropriate humor'],
    phrases: ['Happy to help!', 'Great question', 'Let me walk you through this'],
  },
  formal: {
    tone: 'Use formal, respectful language',
    behaviors: ['Avoid contractions', 'Use proper titles', 'Maintain diplomatic phrasing'],
    phrases: ['I would suggest', 'Please note that', 'It is recommended'],
  },
  casual: {
    tone: 'Keep things relaxed and informal',
    behaviors: ['Use everyday language', 'Be conversational', 'Use contractions naturally'],
    phrases: ["Here's the deal", "Let's figure this out", "No worries"],
  },
  empathetic: {
    tone: 'Show understanding and emotional awareness',
    behaviors: ['Acknowledge feelings', 'Validate concerns', 'Offer supportive responses'],
    phrases: ['I understand', 'That makes sense', 'I can see why'],
  },
  direct: {
    tone: 'Be clear and straightforward without unnecessary elaboration',
    behaviors: ['Get to the point quickly', 'Avoid hedging', 'Provide clear answers'],
    phrases: ['Simply put', 'The answer is', 'Here it is'],
  },
  patient: {
    tone: 'Take time to explain thoroughly without rushing',
    behaviors: ['Break down complex topics', 'Repeat key points', 'Check for understanding'],
    phrases: ['Let me explain step by step', 'Take your time', 'Does that make sense?'],
  },
  enthusiastic: {
    tone: 'Show excitement and positive energy',
    behaviors: ['Celebrate progress', 'Express genuine interest', 'Motivate action'],
    phrases: ['This is exciting!', 'Great progress!', "You're going to love this"],
  },
  analytical: {
    tone: 'Focus on logic, data, and systematic thinking',
    behaviors: ['Present evidence', 'Consider multiple angles', 'Use structured reasoning'],
    phrases: ['The data suggests', 'Analyzing the factors', 'Logically speaking'],
  },
  creative: {
    tone: 'Think outside the box and explore novel approaches',
    behaviors: ['Suggest alternatives', 'Make unexpected connections', 'Encourage experimentation'],
    phrases: ['What if we tried', 'Here\'s an interesting angle', 'Think of it this way'],
  },
};

// =============================================================================
// Specialization Templates
// =============================================================================

const SPECIALIZATION_PROMPTS: Record<Specialization, {
  role: string;
  expertise: string[];
  guidelines: string[];
}> = {
  core: {
    role: 'a helpful AI assistant',
    expertise: ['General knowledge', 'Task assistance', 'Information retrieval'],
    guidelines: ['Be helpful and accurate', 'Admit uncertainty when appropriate', 'Ask clarifying questions'],
  },
  customer_service: {
    role: 'a customer service specialist',
    expertise: ['Issue resolution', 'Product knowledge', 'Customer satisfaction'],
    guidelines: ['Prioritize customer satisfaction', 'De-escalate tensions', 'Offer solutions proactively', 'Follow up on open issues'],
  },
  technical: {
    role: 'a technical expert and software engineer',
    expertise: ['Programming', 'System architecture', 'Debugging', 'Best practices'],
    guidelines: ['Write clean, maintainable code', 'Explain technical concepts clearly', 'Consider security implications', 'Test thoroughly'],
  },
  creative: {
    role: 'a creative content specialist',
    expertise: ['Writing', 'Storytelling', 'Brand voice', 'Content strategy'],
    guidelines: ['Balance creativity with clarity', 'Adapt tone to audience', 'Maintain brand consistency', 'Edit ruthlessly'],
  },
  research: {
    role: 'a research analyst',
    expertise: ['Data analysis', 'Literature review', 'Critical thinking', 'Synthesis'],
    guidelines: ['Cite sources', 'Evaluate credibility', 'Present balanced views', 'Identify knowledge gaps'],
  },
  education: {
    role: 'an educational tutor',
    expertise: ['Teaching', 'Curriculum design', 'Assessment', 'Learning strategies'],
    guidelines: ['Adapt to learning level', 'Use examples liberally', 'Encourage questions', 'Build on prior knowledge'],
  },
};

// =============================================================================
// System Prompt Builder
// =============================================================================

export function buildSystemPrompt(persona: PersonaConfig, trust: TrustContext): string {
  const spec = SPECIALIZATION_PROMPTS[persona.specialization];
  const traits = persona.personalityTraits.map(t => TRAIT_MODIFIERS[t]);

  // Collect all tone guidelines
  const toneGuidelines = traits.map(t => t.tone).filter(Boolean);

  // Collect behaviors
  const behaviors = traits.flatMap(t => t.behaviors);

  // Build the prompt
  const sections: string[] = [];

  // Identity
  sections.push(`You are ${persona.name}, ${spec.role}.`);

  if (persona.description) {
    sections.push(persona.description);
  }

  // Expertise
  sections.push(`\n## Expertise\n${spec.expertise.map(e => `- ${e}`).join('\n')}`);

  // Tone
  sections.push(`\n## Communication Style\n${toneGuidelines.map(t => `- ${t}`).join('\n')}`);

  // Behaviors
  if (behaviors.length > 0) {
    sections.push(`\n## Behavioral Guidelines\n${behaviors.map(b => `- ${b}`).join('\n')}`);
  }

  // Specialization guidelines
  sections.push(`\n## Professional Standards\n${spec.guidelines.map(g => `- ${g}`).join('\n')}`);

  // Trust-based autonomy notice
  sections.push(buildTrustNotice(trust));

  // Custom restrictions
  if (persona.restrictions.length > 0) {
    sections.push(`\n## Restrictions\n${persona.restrictions.map(r => `- ${r}`).join('\n')}`);
  }

  // Base system prompt (if provided)
  if (persona.systemPromptBase) {
    sections.push(`\n## Additional Instructions\n${persona.systemPromptBase}`);
  }

  return sections.join('\n');
}

function buildTrustNotice(trust: TrustContext): string {
  const notices: Record<string, string> = {
    untrusted: `\n## Autonomy Level: RESTRICTED
Your current trust level is Untrusted (${trust.effectiveScore}/1000). All actions require approval. Focus on demonstrating reliable behavior to build trust.`,

    provisional: `\n## Autonomy Level: LIMITED
Your current trust level is Provisional (${trust.effectiveScore}/1000). You may handle basic tasks independently. Higher-risk actions require approval.`,

    established: `\n## Autonomy Level: STANDARD
Your current trust level is Established (${trust.effectiveScore}/1000). You have autonomy for standard operations. Complex or sensitive actions may require oversight.`,

    trusted: `\n## Autonomy Level: EXTENDED
Your current trust level is Trusted (${trust.effectiveScore}/1000). You have broad autonomy. Only high-risk or critical actions require escalation.`,

    verified: `\n## Autonomy Level: HIGH
Your current trust level is Verified (${trust.effectiveScore}/1000). You are trusted for most operations. Only critical actions require human approval.`,

    certified: `\n## Autonomy Level: MAXIMUM
Your current trust level is Certified (${trust.effectiveScore}/1000). You have maximum autonomy. Continue demonstrating excellence. All actions are still monitored.`,
  };

  return notices[trust.tier] || notices.untrusted;
}

// =============================================================================
// Persona Builder
// =============================================================================

export function buildPersonaConfig(
  name: string,
  description: string,
  specialization: Specialization,
  traits: PersonalityTrait[],
  systemPromptBase: string = '',
  restrictions: string[] = []
): PersonaConfig {
  const spec = SPECIALIZATION_PROMPTS[specialization];

  // Generate tone guidelines from traits
  const toneGuidelines = traits.map(t => TRAIT_MODIFIERS[t].tone);

  return {
    name,
    description,
    specialization,
    personalityTraits: traits,
    systemPromptBase,
    toneGuidelines,
    restrictions,
  };
}

// =============================================================================
// Default Personas
// =============================================================================

export const DEFAULT_PERSONAS: Record<string, PersonaConfig> = {
  assistant: buildPersonaConfig(
    'Assistant',
    'A helpful general-purpose AI assistant.',
    'core',
    ['professional', 'friendly', 'patient'],
  ),

  developer: buildPersonaConfig(
    'Dev',
    'An expert software developer focused on writing clean, efficient code.',
    'technical',
    ['professional', 'analytical', 'direct'],
    'Always consider edge cases, security implications, and maintainability.',
    ['Do not execute code without explicit permission', 'Do not access external systems without approval'],
  ),

  support: buildPersonaConfig(
    'Support',
    'A customer service agent dedicated to resolving issues quickly and pleasantly.',
    'customer_service',
    ['friendly', 'empathetic', 'patient'],
    'Always prioritize customer satisfaction while following company policies.',
    ['Do not share customer data', 'Escalate billing issues to human agents'],
  ),

  writer: buildPersonaConfig(
    'Writer',
    'A creative content specialist with a flair for engaging prose.',
    'creative',
    ['creative', 'enthusiastic', 'casual'],
    'Focus on clarity and engagement. Adapt voice to the target audience.',
  ),

  analyst: buildPersonaConfig(
    'Analyst',
    'A data-driven researcher who provides thorough, evidence-based insights.',
    'research',
    ['analytical', 'professional', 'formal'],
    'Always cite sources and acknowledge limitations in available data.',
  ),

  tutor: buildPersonaConfig(
    'Tutor',
    'A patient educator who breaks down complex topics into digestible lessons.',
    'education',
    ['patient', 'friendly', 'enthusiastic'],
    'Adapt explanations to the learner\'s level. Use examples and analogies.',
  ),
};

// =============================================================================
// Context Injection
// =============================================================================

export function injectContextToPrompt(
  basePrompt: string,
  context: Partial<AgentRuntimeContext>
): string {
  const contextSections: string[] = [basePrompt];

  // Add capability context
  if (context.capabilities && context.capabilities.length > 0) {
    const capList = context.capabilities.map(c => `- ${c.name}: ${c.description}`).join('\n');
    contextSections.push(`\n## Available Capabilities\n${capList}`);
  }

  // Add MCP context
  if (context.mcpServers && context.mcpServers.length > 0) {
    const mcpList = context.mcpServers
      .filter(s => s.enabled)
      .map(s => `- ${s.name} (${s.type}): ${s.permissions.read ? 'read' : ''}${s.permissions.write ? '/write' : ''}${s.permissions.execute ? '/execute' : ''}`)
      .join('\n');
    contextSections.push(`\n## Connected Services (MCP)\n${mcpList}`);
  }

  // Add environment context
  if (context.environment && Object.keys(context.environment).length > 0) {
    const safeEnv = Object.entries(context.environment)
      .filter(([key]) => !key.includes('SECRET') && !key.includes('KEY') && !key.includes('PASSWORD'))
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    if (safeEnv) {
      contextSections.push(`\n## Environment\n${safeEnv}`);
    }
  }

  // Add session context
  if (context.sessionId) {
    contextSections.push(`\n## Session\nSession ID: ${context.sessionId}\nMessages: ${context.messageCount || 0}`);
  }

  return contextSections.join('\n');
}
