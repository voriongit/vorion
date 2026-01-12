import type { LexiconTerm } from '@/types';

/**
 * Static lexicon data - the local knowledge base
 * This is the primary data source before external API calls
 */
export const staticLexicon: LexiconTerm[] = [
  // Core Concepts
  {
    term: 'Agent',
    definition: 'An autonomous AI system capable of perceiving its environment, making decisions, and taking actions to achieve specified goals. Modern AI agents typically combine large language models with tool access and memory systems.',
    level: 'novice',
    category: 'core',
    tags: ['fundamentals', 'autonomy'],
  },
  {
    term: 'Agentic AI',
    definition: 'AI systems that exhibit agency - the capacity to act autonomously, make decisions, and pursue goals over extended time horizons. Distinguished from traditional AI by persistent state, tool use, and multi-step reasoning.',
    level: 'novice',
    category: 'core',
    tags: ['fundamentals', 'autonomy'],
  },
  {
    term: 'LLM',
    definition: 'Large Language Model - A neural network trained on vast text corpora, capable of understanding and generating human language. Forms the cognitive core of most modern AI agents.',
    level: 'novice',
    category: 'core',
    tags: ['models', 'fundamentals'],
  },

  // Architecture
  {
    term: 'ReAct',
    definition: 'Reasoning and Acting pattern - An agent architecture that interleaves reasoning traces with action execution. The agent thinks about what to do, takes an action, observes the result, and reasons about next steps.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['patterns', 'reasoning'],
  },
  {
    term: 'Memory System',
    definition: 'Components that enable agents to store and retrieve information across time. Includes working memory (current context), episodic memory (past experiences), and semantic memory (general knowledge).',
    level: 'intermediate',
    category: 'architecture',
    tags: ['memory', 'persistence'],
  },
  {
    term: 'Planning Engine',
    definition: 'A component that generates sequences of actions to achieve goals. May use classical planning algorithms, LLM-based planning, or hybrid approaches combining both.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['planning', 'goals'],
  },
  {
    term: 'Tool Use',
    definition: 'An agent\'s ability to invoke external functions, APIs, or systems to accomplish tasks. Tools extend agent capabilities beyond pure language processing to real-world actions.',
    level: 'novice',
    category: 'architecture',
    tags: ['tools', 'capabilities'],
  },

  // Protocols
  {
    term: 'MCP',
    definition: 'Model Context Protocol - Anthropic\'s open protocol standardizing how AI assistants connect to external tools and data sources. Provides a universal interface for tool integration.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['standards', 'tools', 'anthropic'],
  },
  {
    term: 'A2A',
    definition: 'Agent-to-Agent Protocol - Google\'s open protocol enabling direct communication between autonomous AI agents. Covers discovery, capability advertisement, and task delegation.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['standards', 'communication', 'google'],
  },
  {
    term: 'DID',
    definition: 'Decentralized Identifier - A URI that resolves to a DID Document, providing verifiable, decentralized digital identity. Format: did:method:identifier. Essential for agent identity in trustless environments.',
    level: 'expert',
    category: 'protocols',
    tags: ['identity', 'decentralization'],
  },

  // Multi-Agent Systems
  {
    term: 'Swarm Intelligence',
    definition: 'Collective behavior emerging from decentralized agents following simple rules. No single point of failure. Agents coordinate through local interactions and environmental signals.',
    level: 'expert',
    category: 'orchestration',
    tags: ['multi-agent', 'decentralization'],
  },
  {
    term: 'Hierarchical Orchestration',
    definition: 'Multi-agent coordination where agents are organized in a tree structure with supervisor-worker relationships. Supervisors delegate tasks and aggregate results.',
    level: 'intermediate',
    category: 'orchestration',
    tags: ['multi-agent', 'coordination'],
  },
  {
    term: 'Multi-Agent Debate',
    definition: 'Orchestration pattern where multiple agents with different perspectives argue and critique each other\'s reasoning. Leads to more robust conclusions through adversarial collaboration.',
    level: 'expert',
    category: 'orchestration',
    tags: ['multi-agent', 'reasoning'],
  },

  // Safety & Governance
  {
    term: 'Trust Score',
    definition: 'A quantitative measure of an agent\'s trustworthiness, typically multi-dimensional. Encompasses performance history, security posture, compliance record, and behavioral consistency.',
    level: 'intermediate',
    category: 'safety',
    tags: ['trust', 'governance'],
  },
  {
    term: 'Capability Gating',
    definition: 'The practice of restricting agent capabilities based on trust level, context, and authorization. High-risk actions require higher trust thresholds or human approval.',
    level: 'intermediate',
    category: 'safety',
    tags: ['safety', 'access-control'],
  },
  {
    term: 'Human-in-the-Loop',
    definition: 'System design where humans review, approve, or correct AI decisions at certain points. Balances autonomy with oversight for safety-critical operations.',
    level: 'novice',
    category: 'safety',
    tags: ['safety', 'oversight'],
  },
  {
    term: 'Audit Trail',
    definition: 'A chronological record of agent actions, decisions, and their justifications. Enables accountability, debugging, and forensic analysis of agent behavior.',
    level: 'intermediate',
    category: 'safety',
    tags: ['accountability', 'logging'],
  },

  // Advanced Concepts
  {
    term: 'GraphRAG',
    definition: 'Retrieval-Augmented Generation using Knowledge Graphs. Combines graph-based knowledge representation with retrieval to understand entity relationships and provide more contextual responses.',
    level: 'expert',
    category: 'architecture',
    tags: ['retrieval', 'knowledge-graphs'],
  },
  {
    term: 'Neuro-Symbolic AI',
    definition: 'Approaches combining neural networks with symbolic reasoning. Aims to get the best of both: neural flexibility and symbolic interpretability, formal guarantees.',
    level: 'expert',
    category: 'architecture',
    tags: ['hybrid', 'reasoning'],
  },
  {
    term: 'Chain-of-Thought',
    definition: 'A prompting technique where the model generates intermediate reasoning steps before reaching a final answer. Improves accuracy on complex reasoning tasks.',
    level: 'intermediate',
    category: 'techniques',
    tags: ['prompting', 'reasoning'],
  },
  {
    term: 'Tree of Thoughts',
    definition: 'A reasoning approach where the model explores multiple reasoning paths as a tree structure. Enables backtracking and consideration of alternative approaches.',
    level: 'expert',
    category: 'techniques',
    tags: ['prompting', 'reasoning'],
  },

  // Evolution
  {
    term: 'Self-Improvement',
    definition: 'An agent\'s ability to enhance its own capabilities through reflection, learning, and potentially code modification. A key concern in AI safety due to recursive improvement potential.',
    level: 'expert',
    category: 'evolution',
    tags: ['learning', 'safety'],
  },
  {
    term: 'Memetic Learning',
    definition: 'Transfer of successful strategies, prompts, or behaviors between agents. Inspired by cultural evolution, where "memes" (units of knowledge) spread through agent populations.',
    level: 'theoretical',
    category: 'evolution',
    tags: ['learning', 'multi-agent'],
  },

  // BASIS Standard
  {
    term: 'BASIS',
    definition: 'Blockchain Agent Standard for Identity and Security - A comprehensive framework combining identity, trust scoring, capability management, and governance for autonomous agents. Developed by Vorion.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['standards', 'identity', 'vorion'],
  },
  {
    term: 'ATSF',
    definition: 'Agent Trust Scoring Framework - A multi-dimensional framework within BASIS for evaluating agent trustworthiness across performance, security, compliance, and behavioral metrics.',
    level: 'expert',
    category: 'protocols',
    tags: ['trust', 'vorion', 'framework'],
  },
];

/**
 * Search the lexicon for matching terms
 */
export function searchLexicon(query: string): LexiconTerm | null {
  const q = query.toLowerCase().trim();

  // Exact match first
  const exact = staticLexicon.find(
    item => item.term.toLowerCase() === q
  );
  if (exact) return exact;

  // Partial match (term contains query, query length > 3)
  if (q.length > 3) {
    const partial = staticLexicon.find(
      item => item.term.toLowerCase().includes(q)
    );
    if (partial) return partial;
  }

  return null;
}

/**
 * Get all terms in a category
 */
export function getByCategory(category: string): LexiconTerm[] {
  return staticLexicon.filter(item => item.category === category);
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  return [...new Set(staticLexicon.map(item => item.category).filter(Boolean))] as string[];
}

/**
 * Filter lexicon by search query
 */
export function filterLexicon(query: string): LexiconTerm[] {
  if (!query.trim()) return staticLexicon;

  const q = query.toLowerCase();
  return staticLexicon.filter(
    item =>
      item.term.toLowerCase().includes(q) ||
      item.definition.toLowerCase().includes(q) ||
      item.tags?.some(tag => tag.toLowerCase().includes(q))
  );
}
