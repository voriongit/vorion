import type { LearningPath } from '@/types';

/**
 * Omniscience Learning Paths
 *
 * Structured curricula connecting related terms into coherent learning journeys.
 * Each path builds knowledge progressively from fundamentals to advanced concepts.
 */
export const learningPaths: LearningPath[] = [
  // ============================================
  // BEGINNER PATHS
  // ============================================
  {
    id: 'ai-foundations',
    slug: 'ai-foundations',
    title: 'AI Foundations',
    description: 'Start here! Learn the fundamental concepts of AI, large language models, and how modern AI systems work.',
    difficulty: 'beginner',
    duration: 'medium',
    estimatedHours: 1.5,
    icon: 'Sparkles',
    color: 'cyan',
    modules: [
      {
        id: 'what-is-ai',
        title: 'What is AI?',
        description: 'Understand the basics of artificial intelligence and machine learning.',
        terms: ['Neural Network', 'NLP', 'GPU'],
        objectives: [
          'Understand what neural networks are',
          'Know the difference between AI and ML',
          'Understand why GPUs matter for AI',
        ],
        estimatedMinutes: 15,
      },
      {
        id: 'llm-basics',
        title: 'Understanding LLMs',
        description: 'Learn how large language models work and why they\'re revolutionary.',
        terms: ['LLM', 'Foundation Model', 'Transformer', 'Token', 'Context Window'],
        objectives: [
          'Understand what makes LLMs different',
          'Know what tokens are and why they matter',
          'Grasp the concept of context windows',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'talking-to-ai',
        title: 'Talking to AI',
        description: 'Learn the basics of interacting with AI systems.',
        terms: ['Prompt', 'Completion', 'Inference', 'Latency'],
        objectives: [
          'Understand the prompt-completion paradigm',
          'Know what happens during inference',
          'Appreciate latency considerations',
        ],
        estimatedMinutes: 15,
      },
      {
        id: 'ai-limitations',
        title: 'AI Limitations',
        description: 'Understand what AI can and cannot do reliably.',
        terms: ['Hallucination', 'Grounding', 'Overfitting'],
        objectives: [
          'Recognize when AI might hallucinate',
          'Understand how grounding improves reliability',
          'Know common AI failure modes',
        ],
        estimatedMinutes: 15,
      },
    ],
    outcomes: [
      'Explain how LLMs work to others',
      'Understand AI news and discussions',
      'Know when AI is appropriate for a task',
      'Recognize AI limitations and risks',
    ],
    tags: ['fundamentals', 'beginner', 'llm', 'ml'],
  },

  {
    id: 'prompt-engineering-101',
    slug: 'prompt-engineering-101',
    title: 'Prompt Engineering 101',
    description: 'Master the art of communicating with AI. Learn techniques to get better, more reliable outputs.',
    difficulty: 'beginner',
    duration: 'medium',
    estimatedHours: 1,
    icon: 'MessageSquare',
    color: 'purple',
    prerequisites: ['ai-foundations'],
    modules: [
      {
        id: 'prompt-basics',
        title: 'Prompt Fundamentals',
        description: 'Learn the building blocks of effective prompts.',
        terms: ['Prompt', 'System Prompt', 'Completion'],
        objectives: [
          'Write clear, effective prompts',
          'Understand system vs user prompts',
          'Structure prompts for clarity',
        ],
        estimatedMinutes: 15,
      },
      {
        id: 'learning-techniques',
        title: 'Few-Shot & Zero-Shot',
        description: 'Teach AI by example or instruction.',
        terms: ['Zero-Shot Learning', 'Few-Shot Learning', 'Role Prompting'],
        objectives: [
          'Know when to use examples vs instructions',
          'Create effective few-shot prompts',
          'Use role prompting effectively',
        ],
        estimatedMinutes: 20,
      },
      {
        id: 'reasoning-prompts',
        title: 'Reasoning Techniques',
        description: 'Help AI think through complex problems.',
        terms: ['Chain-of-Thought', 'Prompt Chaining'],
        objectives: [
          'Use chain-of-thought for complex tasks',
          'Break problems into prompt chains',
          'Improve reasoning quality',
        ],
        estimatedMinutes: 15,
      },
      {
        id: 'structured-outputs',
        title: 'Getting Structured Outputs',
        description: 'Get consistent, parseable responses from AI.',
        terms: ['Structured Output', 'Prompt Template'],
        objectives: [
          'Request JSON and other formats',
          'Create reusable prompt templates',
          'Handle output parsing',
        ],
        estimatedMinutes: 10,
      },
    ],
    outcomes: [
      'Write prompts that work consistently',
      'Debug prompt failures',
      'Choose the right prompting technique',
      'Create reusable prompt templates',
    ],
    tags: ['prompting', 'beginner', 'techniques'],
  },

  // ============================================
  // INTERMEDIATE PATHS
  // ============================================
  {
    id: 'building-ai-agents',
    slug: 'building-ai-agents',
    title: 'Building AI Agents',
    description: 'Learn how to create autonomous AI systems that can reason, use tools, and accomplish complex tasks.',
    difficulty: 'intermediate',
    duration: 'long',
    estimatedHours: 3,
    icon: 'Bot',
    color: 'green',
    prerequisites: ['ai-foundations', 'prompt-engineering-101'],
    modules: [
      {
        id: 'agent-fundamentals',
        title: 'What Are AI Agents?',
        description: 'Understand what makes an agent different from a chatbot.',
        terms: ['Agent', 'Agentic AI', 'Tool Use', 'Function Calling'],
        objectives: [
          'Define what makes something an agent',
          'Understand the agent loop',
          'Know how tools extend capabilities',
        ],
        estimatedMinutes: 20,
      },
      {
        id: 'agent-architectures',
        title: 'Agent Architectures',
        description: 'Learn the common patterns for building agents.',
        terms: ['ReAct', 'Cognitive Architecture', 'State Machine', 'Router'],
        objectives: [
          'Implement the ReAct pattern',
          'Choose the right architecture',
          'Design agent control flow',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'memory-systems',
        title: 'Agent Memory',
        description: 'Give your agents persistent memory and context.',
        terms: ['Memory System', 'Scratchpad', 'Embedding', 'Vector Database'],
        objectives: [
          'Implement different memory types',
          'Use embeddings for semantic memory',
          'Integrate vector databases',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'rag-fundamentals',
        title: 'Retrieval-Augmented Generation',
        description: 'Ground your agents in real knowledge.',
        terms: ['RAG', 'Grounding', 'Semantic Similarity'],
        objectives: [
          'Build a basic RAG pipeline',
          'Choose retrieval strategies',
          'Evaluate retrieval quality',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'agent-reasoning',
        title: 'Advanced Reasoning',
        description: 'Make your agents think more carefully.',
        terms: ['Reflection', 'Self-Correction', 'Tree of Thoughts', 'Self-Consistency'],
        objectives: [
          'Implement reflection loops',
          'Add self-correction capabilities',
          'Use advanced reasoning patterns',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'agent-safety',
        title: 'Agent Safety Basics',
        description: 'Keep your agents safe and reliable.',
        terms: ['Guardrails', 'Sandbox', 'Human-in-the-Loop'],
        objectives: [
          'Implement basic guardrails',
          'Sandbox dangerous operations',
          'Add human oversight points',
        ],
        estimatedMinutes: 20,
      },
    ],
    outcomes: [
      'Build functional AI agents from scratch',
      'Choose appropriate architectures for tasks',
      'Implement memory and retrieval systems',
      'Add safety measures to agents',
    ],
    tags: ['agents', 'architecture', 'intermediate', 'rag'],
  },

  {
    id: 'agent-frameworks',
    slug: 'agent-frameworks',
    title: 'Agent Frameworks Deep Dive',
    description: 'Master the popular frameworks and tools for building production AI agents.',
    difficulty: 'intermediate',
    duration: 'medium',
    estimatedHours: 2,
    icon: 'Wrench',
    color: 'orange',
    prerequisites: ['building-ai-agents'],
    modules: [
      {
        id: 'langchain-ecosystem',
        title: 'LangChain Ecosystem',
        description: 'The most popular framework for LLM applications.',
        terms: ['LangChain', 'LangGraph', 'LangSmith'],
        objectives: [
          'Build agents with LangChain',
          'Use LangGraph for complex flows',
          'Debug with LangSmith',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'llamaindex-rag',
        title: 'LlamaIndex for RAG',
        description: 'The go-to framework for data-connected applications.',
        terms: ['LlamaIndex', 'RAG', 'Agentic RAG'],
        objectives: [
          'Build RAG with LlamaIndex',
          'Handle complex data sources',
          'Implement agentic retrieval',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'multi-agent-frameworks',
        title: 'Multi-Agent Frameworks',
        description: 'Frameworks for coordinating multiple agents.',
        terms: ['CrewAI', 'AutoGen', 'AutoGPT'],
        objectives: [
          'Build agent crews',
          'Coordinate agent conversations',
          'Design multi-agent systems',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'structured-output-tools',
        title: 'Structured Output Tools',
        description: 'Get reliable structured data from LLMs.',
        terms: ['Instructor', 'Structured Output', 'JSON Schema'],
        objectives: [
          'Extract structured data reliably',
          'Validate LLM outputs',
          'Handle parsing errors',
        ],
        estimatedMinutes: 20,
      },
      {
        id: 'frontend-integration',
        title: 'Frontend Integration',
        description: 'Build UIs for AI applications.',
        terms: ['Vercel AI SDK', 'SSE'],
        objectives: [
          'Stream responses to UIs',
          'Build chat interfaces',
          'Handle real-time updates',
        ],
        estimatedMinutes: 20,
      },
    ],
    outcomes: [
      'Choose the right framework for your use case',
      'Build production-ready agent applications',
      'Integrate agents into web applications',
      'Debug and monitor agent systems',
    ],
    tags: ['frameworks', 'tools', 'intermediate', 'production'],
  },

  {
    id: 'multi-agent-systems',
    slug: 'multi-agent-systems',
    title: 'Multi-Agent Systems',
    description: 'Design and build systems where multiple AI agents collaborate to solve complex problems.',
    difficulty: 'intermediate',
    duration: 'medium',
    estimatedHours: 2,
    icon: 'Users',
    color: 'blue',
    prerequisites: ['building-ai-agents'],
    modules: [
      {
        id: 'why-multi-agent',
        title: 'Why Multiple Agents?',
        description: 'Understand when and why to use multi-agent systems.',
        terms: ['Task Decomposition', 'Crew', 'Supervisor Agent', 'Worker Agent'],
        objectives: [
          'Identify multi-agent use cases',
          'Design agent roles and responsibilities',
          'Decompose tasks effectively',
        ],
        estimatedMinutes: 20,
      },
      {
        id: 'orchestration-patterns',
        title: 'Orchestration Patterns',
        description: 'Learn the common patterns for coordinating agents.',
        terms: ['Hierarchical Orchestration', 'Agent Handoff', 'Blackboard System'],
        objectives: [
          'Choose orchestration patterns',
          'Implement supervisor hierarchies',
          'Handle agent handoffs',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'agent-communication',
        title: 'Agent Communication',
        description: 'How agents talk to each other.',
        terms: ['A2A', 'Agent Mesh', 'Consensus Mechanism'],
        objectives: [
          'Design agent communication protocols',
          'Handle agent discovery',
          'Reach consensus in agent groups',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'advanced-patterns',
        title: 'Advanced Patterns',
        description: 'Sophisticated multi-agent techniques.',
        terms: ['Multi-Agent Debate', 'Swarm Intelligence'],
        objectives: [
          'Implement debate patterns',
          'Design emergent behaviors',
          'Handle agent conflicts',
        ],
        estimatedMinutes: 20,
      },
    ],
    outcomes: [
      'Design effective multi-agent architectures',
      'Choose the right orchestration pattern',
      'Implement agent communication',
      'Debug multi-agent systems',
    ],
    tags: ['multi-agent', 'orchestration', 'intermediate'],
  },

  // ============================================
  // ADVANCED PATHS
  // ============================================
  {
    id: 'agent-safety-governance',
    slug: 'agent-safety-governance',
    title: 'Agent Safety & Governance',
    description: 'Build safe, trustworthy AI agents. Learn security, monitoring, and governance best practices.',
    difficulty: 'advanced',
    duration: 'long',
    estimatedHours: 3,
    icon: 'Shield',
    color: 'red',
    prerequisites: ['building-ai-agents'],
    modules: [
      {
        id: 'trust-foundations',
        title: 'Trust Foundations',
        description: 'Understand trust in AI systems.',
        terms: ['Trust Score', 'Capability Gating', 'Audit Trail'],
        objectives: [
          'Design trust scoring systems',
          'Implement capability gating',
          'Build comprehensive audit trails',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'security-threats',
        title: 'Security Threats',
        description: 'Know the attacks and how to defend against them.',
        terms: ['Prompt Injection', 'Jailbreaking', 'Red Teaming'],
        objectives: [
          'Identify prompt injection attacks',
          'Defend against jailbreaking',
          'Conduct red team exercises',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'safety-mechanisms',
        title: 'Safety Mechanisms',
        description: 'Implement safety at every layer.',
        terms: ['Guardrails', 'Tripwire', 'Circuit Breaker', 'Kill Switch'],
        objectives: [
          'Implement multi-layer guardrails',
          'Set up monitoring tripwires',
          'Design failsafe mechanisms',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'alignment-training',
        title: 'Alignment & Training',
        description: 'How models are made safe.',
        terms: ['RLHF', 'Constitutional AI', 'RLAIF'],
        objectives: [
          'Understand RLHF process',
          'Know Constitutional AI principles',
          'Evaluate alignment techniques',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'governance-frameworks',
        title: 'Governance Frameworks',
        description: 'Organizational approaches to AI safety.',
        terms: ['AI Governance', 'Responsible AI', 'Human-in-the-Loop', 'Model Cards'],
        objectives: [
          'Design governance policies',
          'Implement responsible AI practices',
          'Create model documentation',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'standards-identity',
        title: 'Standards & Identity',
        description: 'Industry standards for agent identity and trust.',
        terms: ['ACI Spec', 'Trust Tiers', 'DID', 'Verifiable Credentials'],
        objectives: [
          'Understand ACI specification (0-1000 trust scale)',
          'Implement agent identity with DIDs',
          'Use verifiable credentials for capability gating',
        ],
        estimatedMinutes: 25,
      },
    ],
    outcomes: [
      'Design comprehensive agent safety systems',
      'Defend against known attack vectors',
      'Implement governance frameworks',
      'Audit and monitor agent behavior',
    ],
    tags: ['safety', 'security', 'governance', 'advanced'],
  },

  {
    id: 'production-deployment',
    slug: 'production-deployment',
    title: 'Production AI Deployment',
    description: 'Take AI agents from prototype to production. Learn scaling, optimization, and operations.',
    difficulty: 'advanced',
    duration: 'long',
    estimatedHours: 3.5,
    icon: 'Rocket',
    color: 'emerald',
    prerequisites: ['building-ai-agents', 'agent-frameworks'],
    modules: [
      {
        id: 'model-optimization',
        title: 'Model Optimization',
        description: 'Make models faster and cheaper to run.',
        terms: ['Quantization', 'Model Distillation', 'LoRA'],
        objectives: [
          'Apply quantization techniques',
          'Distill models for production',
          'Use LoRA for efficient fine-tuning',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'inference-infrastructure',
        title: 'Inference Infrastructure',
        description: 'Serve models at scale.',
        terms: ['Model Serving', 'vLLM', 'TGI', 'Batching'],
        objectives: [
          'Choose serving infrastructure',
          'Optimize batch processing',
          'Handle concurrent requests',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'performance-optimization',
        title: 'Performance Optimization',
        description: 'Reduce latency and costs.',
        terms: ['Caching', 'Semantic Caching', 'Prompt Compression', 'KV Cache'],
        objectives: [
          'Implement caching strategies',
          'Compress prompts effectively',
          'Optimize inference costs',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'distributed-systems',
        title: 'Distributed Systems',
        description: 'Run large models across multiple machines.',
        terms: ['Tensor Parallelism', 'Model Sharding', 'Speculative Decoding'],
        objectives: [
          'Distribute model inference',
          'Handle large model deployment',
          'Use speculative decoding',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'observability',
        title: 'Observability & Monitoring',
        description: 'Know what your agents are doing.',
        terms: ['Observability', 'Tracing', 'LangSmith'],
        objectives: [
          'Implement comprehensive tracing',
          'Set up monitoring dashboards',
          'Debug production issues',
        ],
        estimatedMinutes: 20,
      },
      {
        id: 'cost-management',
        title: 'Cost Management',
        description: 'Control AI operational costs.',
        terms: ['Cost Optimization', 'Rate Limiting', 'Throughput'],
        objectives: [
          'Estimate and control costs',
          'Implement rate limiting',
          'Optimize for throughput',
        ],
        estimatedMinutes: 20,
      },
      {
        id: 'local-deployment',
        title: 'Local & Edge Deployment',
        description: 'Run models locally or on edge devices.',
        terms: ['Edge Deployment', 'Ollama', 'LM Studio', 'GGUF'],
        objectives: [
          'Deploy models locally',
          'Choose local inference tools',
          'Handle edge constraints',
        ],
        estimatedMinutes: 20,
      },
    ],
    outcomes: [
      'Deploy AI agents to production',
      'Optimize for performance and cost',
      'Monitor and debug production systems',
      'Scale to handle real-world traffic',
    ],
    tags: ['production', 'deployment', 'optimization', 'advanced'],
  },

  {
    id: 'evaluation-testing',
    slug: 'evaluation-testing',
    title: 'AI Evaluation & Testing',
    description: 'Measure AI performance rigorously. Learn benchmarking, testing, and quality assurance.',
    difficulty: 'advanced',
    duration: 'medium',
    estimatedHours: 2,
    icon: 'ClipboardCheck',
    color: 'yellow',
    prerequisites: ['building-ai-agents'],
    modules: [
      {
        id: 'benchmark-fundamentals',
        title: 'Benchmarks & Metrics',
        description: 'Understand how AI is measured.',
        terms: ['Benchmark', 'Perplexity', 'BLEU Score'],
        objectives: [
          'Interpret common benchmarks',
          'Understand evaluation metrics',
          'Compare model capabilities',
        ],
        estimatedMinutes: 20,
      },
      {
        id: 'model-benchmarks',
        title: 'Model Benchmarks',
        description: 'Key benchmarks for LLMs and agents.',
        terms: ['MMLU', 'HumanEval', 'SWE-Bench', 'GAIA', 'AgentBench'],
        objectives: [
          'Know major LLM benchmarks',
          'Understand agent-specific evals',
          'Interpret benchmark results',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'custom-evaluation',
        title: 'Custom Evaluation',
        description: 'Build evaluations for your specific use case.',
        terms: ['Evals', 'LLM-as-Judge', 'A/B Testing'],
        objectives: [
          'Design custom evaluations',
          'Use LLM-as-judge effectively',
          'Run A/B tests in production',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'testing-practices',
        title: 'Testing Practices',
        description: 'Test AI systems effectively.',
        terms: ['Regression Testing', 'Red Teaming'],
        objectives: [
          'Build regression test suites',
          'Conduct adversarial testing',
          'Maintain quality over time',
        ],
        estimatedMinutes: 20,
      },
    ],
    outcomes: [
      'Design rigorous AI evaluation systems',
      'Benchmark models effectively',
      'Build continuous testing pipelines',
      'Ensure quality in production',
    ],
    tags: ['evaluation', 'testing', 'benchmarks', 'advanced'],
  },

  // ============================================
  // EXPERT PATHS
  // ============================================
  {
    id: 'ml-deep-dive',
    slug: 'ml-deep-dive',
    title: 'ML Fundamentals Deep Dive',
    description: 'Understand the machine learning foundations behind modern AI. For those who want to go deeper.',
    difficulty: 'expert',
    duration: 'long',
    estimatedHours: 4,
    icon: 'Brain',
    color: 'pink',
    prerequisites: ['ai-foundations'],
    modules: [
      {
        id: 'neural-networks',
        title: 'Neural Networks',
        description: 'Deep dive into how neural networks learn.',
        terms: ['Neural Network', 'Loss Function', 'Gradient Descent', 'Backpropagation'],
        objectives: [
          'Understand forward and backward passes',
          'Know how loss functions guide learning',
          'Grasp gradient-based optimization',
        ],
        estimatedMinutes: 40,
      },
      {
        id: 'transformers',
        title: 'Transformers Deep Dive',
        description: 'The architecture that powers modern AI.',
        terms: ['Transformer', 'Attention Mechanism', 'Self-Attention'],
        objectives: [
          'Understand attention mechanisms',
          'Know how transformers process sequences',
          'Appreciate architectural innovations',
        ],
        estimatedMinutes: 35,
      },
      {
        id: 'training-techniques',
        title: 'Training Techniques',
        description: 'How models are trained effectively.',
        terms: ['Pre-Training', 'Fine-Tuning', 'Regularization', 'Catastrophic Forgetting'],
        objectives: [
          'Understand pre-training objectives',
          'Know fine-tuning strategies',
          'Handle training challenges',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'advanced-architectures',
        title: 'Advanced Architectures',
        description: 'Cutting-edge model designs.',
        terms: ['Mixture of Experts', 'Multimodal'],
        objectives: [
          'Understand MoE architectures',
          'Know multimodal integration',
          'Follow architecture research',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'scaling-emergence',
        title: 'Scaling & Emergence',
        description: 'Why bigger models behave differently.',
        terms: ['Scaling Laws', 'Emergent Capabilities', 'In-Context Learning'],
        objectives: [
          'Understand scaling laws',
          'Know about emergent behaviors',
          'Appreciate scale implications',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'learning-paradigms',
        title: 'Learning Paradigms',
        description: 'Different ways AI systems learn.',
        terms: ['Transfer Learning', 'Meta-Learning', 'Continual Learning', 'Active Learning'],
        objectives: [
          'Compare learning paradigms',
          'Know when to use each approach',
          'Understand learning limitations',
        ],
        estimatedMinutes: 30,
      },
    ],
    outcomes: [
      'Understand ML at a deeper level',
      'Read and evaluate ML research',
      'Make informed architecture decisions',
      'Debug training and inference issues',
    ],
    tags: ['ml', 'deep-learning', 'expert', 'theory'],
  },

  {
    id: 'ai-alignment-safety',
    slug: 'ai-alignment-safety',
    title: 'AI Alignment & Safety Research',
    description: 'Explore the cutting edge of AI safety research. Understand alignment challenges and proposed solutions.',
    difficulty: 'expert',
    duration: 'long',
    estimatedHours: 3,
    icon: 'Lock',
    color: 'indigo',
    prerequisites: ['agent-safety-governance'],
    modules: [
      {
        id: 'alignment-problem',
        title: 'The Alignment Problem',
        description: 'Why aligning AI with human values is hard.',
        terms: ['AI Alignment', 'Instrumental Convergence', 'Value Lock-In'],
        objectives: [
          'Understand core alignment challenges',
          'Know instrumental convergence risks',
          'Consider value specification problems',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'alignment-approaches',
        title: 'Alignment Approaches',
        description: 'Current approaches to AI alignment.',
        terms: ['RLHF', 'Constitutional AI', 'RLAIF', 'Corrigibility'],
        objectives: [
          'Compare alignment techniques',
          'Understand tradeoffs',
          'Evaluate effectiveness',
        ],
        estimatedMinutes: 35,
      },
      {
        id: 'safety-risks',
        title: 'Advanced Safety Risks',
        description: 'Theoretical and practical risks.',
        terms: ['Deceptive Alignment', 'Alignment Tax', 'Self-Improvement'],
        objectives: [
          'Understand deception risks',
          'Consider capability-safety tradeoffs',
          'Think about recursive improvement',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'interpretability',
        title: 'Interpretability Research',
        description: 'Understanding what\'s inside the black box.',
        terms: ['Explainability', 'Interpretability', 'Mechanistic Interpretability'],
        objectives: [
          'Know interpretability approaches',
          'Understand mechanistic research',
          'Appreciate current limitations',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'ethics-governance',
        title: 'Ethics & Governance',
        description: 'Broader ethical and policy considerations.',
        terms: ['AI Bias', 'Responsible AI', 'AI Governance'],
        objectives: [
          'Consider ethical implications',
          'Design responsible systems',
          'Understand governance landscape',
        ],
        estimatedMinutes: 25,
      },
    ],
    outcomes: [
      'Engage with alignment research',
      'Identify safety risks in systems',
      'Contribute to safety discussions',
      'Design with alignment in mind',
    ],
    tags: ['alignment', 'safety', 'research', 'expert', 'ethics'],
  },

  {
    id: 'protocols-standards',
    slug: 'protocols-standards',
    title: 'AI Protocols & Standards',
    description: 'Master the protocols that enable AI interoperability. From tool integration to agent identity.',
    difficulty: 'expert',
    duration: 'medium',
    estimatedHours: 2,
    icon: 'FileCode',
    color: 'teal',
    prerequisites: ['building-ai-agents'],
    modules: [
      {
        id: 'tool-protocols',
        title: 'Tool Integration Protocols',
        description: 'Standards for connecting AI to tools.',
        terms: ['MCP', 'OpenAPI', 'Function Calling', 'JSON Schema'],
        objectives: [
          'Implement MCP servers',
          'Design tool interfaces',
          'Handle function calling patterns',
        ],
        estimatedMinutes: 30,
      },
      {
        id: 'agent-communication',
        title: 'Agent Communication Protocols',
        description: 'How agents discover and communicate.',
        terms: ['A2A', 'WebSocket', 'SSE'],
        objectives: [
          'Implement agent protocols',
          'Handle real-time communication',
          'Design discovery mechanisms',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'identity-standards',
        title: 'Identity & Trust Standards',
        description: 'Cryptographic identity for agents.',
        terms: ['DID', 'Verifiable Credentials', 'OAuth 2.0'],
        objectives: [
          'Implement agent identity',
          'Issue and verify credentials',
          'Handle authorization flows',
        ],
        estimatedMinutes: 25,
      },
      {
        id: 'governance-standards',
        title: 'Governance Standards',
        description: 'Standards for agent governance.',
        terms: ['ACI Spec', 'Trust Tiers'],
        objectives: [
          'Understand ACI specification (npm: @vorionsys/aci-spec)',
          'Implement 0-1000 trust scoring',
          'Design governance systems with T0-T5 tiers',
        ],
        estimatedMinutes: 20,
      },
    ],
    outcomes: [
      'Implement major AI protocols',
      'Design interoperable agent systems',
      'Handle identity and authorization',
      'Follow governance standards',
    ],
    tags: ['protocols', 'standards', 'expert', 'interoperability'],
  },
];

/**
 * Get all learning paths
 */
export function getAllPaths(): LearningPath[] {
  return learningPaths;
}

/**
 * Get a learning path by slug
 */
export function getPathBySlug(slug: string): LearningPath | null {
  return learningPaths.find(path => path.slug === slug) || null;
}

/**
 * Get paths by difficulty
 */
export function getPathsByDifficulty(difficulty: LearningPath['difficulty']): LearningPath[] {
  return learningPaths.filter(path => path.difficulty === difficulty);
}

/**
 * Get paths with no prerequisites (starting points)
 */
export function getStarterPaths(): LearningPath[] {
  return learningPaths.filter(path => !path.prerequisites || path.prerequisites.length === 0);
}

/**
 * Get paths that have a specific path as prerequisite
 */
export function getNextPaths(completedPathSlug: string): LearningPath[] {
  return learningPaths.filter(
    path => path.prerequisites?.includes(completedPathSlug)
  );
}

/**
 * Get all terms used in a path
 */
export function getPathTerms(path: LearningPath): string[] {
  return path.modules.flatMap(module => module.terms);
}

/**
 * Calculate total terms in a path
 */
export function getPathTermCount(path: LearningPath): number {
  return getPathTerms(path).length;
}

/**
 * Get learning path statistics
 */
export function getPathStats() {
  const paths = getAllPaths();
  const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

  return {
    totalPaths: paths.length,
    totalModules: paths.reduce((acc, p) => acc + p.modules.length, 0),
    totalHours: paths.reduce((acc, p) => acc + p.estimatedHours, 0),
    byDifficulty: Object.fromEntries(
      difficulties.map(d => [d, getPathsByDifficulty(d).length])
    ),
    starterPaths: getStarterPaths().length,
  };
}

/**
 * Find paths containing a specific term
 */
export function findPathsWithTerm(termName: string): LearningPath[] {
  return learningPaths.filter(path =>
    path.modules.some(module =>
      module.terms.some(t => t.toLowerCase() === termName.toLowerCase())
    )
  );
}

/**
 * Get recommended path order (respecting prerequisites)
 */
export function getRecommendedPathOrder(): LearningPath[] {
  const ordered: LearningPath[] = [];
  const remaining = [...learningPaths];

  while (remaining.length > 0) {
    const next = remaining.find(path => {
      if (!path.prerequisites || path.prerequisites.length === 0) return true;
      return path.prerequisites.every(prereq =>
        ordered.some(o => o.slug === prereq)
      );
    });

    if (next) {
      ordered.push(next);
      remaining.splice(remaining.indexOf(next), 1);
    } else {
      // Handle circular dependencies by adding remaining paths
      ordered.push(...remaining);
      break;
    }
  }

  return ordered;
}
