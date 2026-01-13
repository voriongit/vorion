import type { QuizQuestion, Quiz, PathDifficulty } from '@/types';
import { getPathBySlug, getPathTerms } from './learning-paths';

/**
 * Quiz questions database for Omniscience learning paths
 * Questions are organized by term and test understanding of key concepts
 */

// Helper to generate unique IDs
let questionIdCounter = 0;
const genId = () => `q-${++questionIdCounter}`;
const optId = () => `opt-${++questionIdCounter}`;

export const quizQuestions: QuizQuestion[] = [
  // ============================================
  // AI FOUNDATIONS - BEGINNER
  // ============================================
  {
    id: genId(),
    termName: 'Neural Network',
    type: 'multiple-choice',
    question: 'What is a neural network inspired by?',
    options: [
      { id: optId(), text: 'The human brain\'s structure of interconnected neurons', isCorrect: true },
      { id: optId(), text: 'Traditional computer programming logic', isCorrect: false },
      { id: optId(), text: 'Mathematical spreadsheets', isCorrect: false },
      { id: optId(), text: 'Database query systems', isCorrect: false },
    ],
    explanation: 'Neural networks are computing systems inspired by biological neural networks in the human brain, consisting of interconnected nodes (neurons) organized in layers.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'LLM',
    type: 'multiple-choice',
    question: 'What does LLM stand for in AI?',
    options: [
      { id: optId(), text: 'Large Language Model', isCorrect: true },
      { id: optId(), text: 'Learning Logic Machine', isCorrect: false },
      { id: optId(), text: 'Linear Learning Method', isCorrect: false },
      { id: optId(), text: 'Linguistic Layered Model', isCorrect: false },
    ],
    explanation: 'LLM stands for Large Language Model - AI systems trained on massive text datasets that can understand and generate human-like text.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Token',
    type: 'multiple-choice',
    question: 'What is a token in the context of LLMs?',
    options: [
      { id: optId(), text: 'A unit of text (word, subword, or character) that the model processes', isCorrect: true },
      { id: optId(), text: 'A security credential for API access', isCorrect: false },
      { id: optId(), text: 'A type of cryptocurrency', isCorrect: false },
      { id: optId(), text: 'A user session identifier', isCorrect: false },
    ],
    explanation: 'In LLMs, tokens are the basic units of text the model works with. They can be words, parts of words, or individual characters depending on the tokenizer.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Context Window',
    type: 'multiple-choice',
    question: 'What is a context window in LLMs?',
    options: [
      { id: optId(), text: 'The maximum number of tokens the model can process at once', isCorrect: true },
      { id: optId(), text: 'A graphical user interface element', isCorrect: false },
      { id: optId(), text: 'The display area for chat messages', isCorrect: false },
      { id: optId(), text: 'A time-based session limit', isCorrect: false },
    ],
    explanation: 'The context window is the maximum amount of text (measured in tokens) that an LLM can consider at once, including both the input and output.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Hallucination',
    type: 'multiple-choice',
    question: 'What does "hallucination" mean in AI context?',
    options: [
      { id: optId(), text: 'When an AI generates false or made-up information presented as fact', isCorrect: true },
      { id: optId(), text: 'When the AI experiences visual glitches', isCorrect: false },
      { id: optId(), text: 'A type of image generation technique', isCorrect: false },
      { id: optId(), text: 'When users misunderstand AI responses', isCorrect: false },
    ],
    explanation: 'AI hallucination refers to when models generate content that seems plausible but is factually incorrect, made up, or not grounded in their training data.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Prompt',
    type: 'multiple-choice',
    question: 'What is a prompt in the context of LLMs?',
    options: [
      { id: optId(), text: 'The input text given to an AI model to generate a response', isCorrect: true },
      { id: optId(), text: 'A reminder notification from the system', isCorrect: false },
      { id: optId(), text: 'The loading indicator while AI processes', isCorrect: false },
      { id: optId(), text: 'An error message from the AI', isCorrect: false },
    ],
    explanation: 'A prompt is the instruction or query provided to an LLM that guides it to produce a specific type of response or complete a particular task.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Inference',
    type: 'multiple-choice',
    question: 'What is inference in machine learning?',
    options: [
      { id: optId(), text: 'Using a trained model to make predictions on new data', isCorrect: true },
      { id: optId(), text: 'Training a model on new data', isCorrect: false },
      { id: optId(), text: 'Collecting data for training', isCorrect: false },
      { id: optId(), text: 'Evaluating model accuracy', isCorrect: false },
    ],
    explanation: 'Inference is the process of running a trained model to generate outputs (predictions, text, etc.) based on new inputs, as opposed to the training phase.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Transformer',
    type: 'multiple-choice',
    question: 'What is the key innovation of the Transformer architecture?',
    options: [
      { id: optId(), text: 'The attention mechanism that processes all tokens in parallel', isCorrect: true },
      { id: optId(), text: 'Using convolutional filters for text', isCorrect: false },
      { id: optId(), text: 'Processing tokens one at a time sequentially', isCorrect: false },
      { id: optId(), text: 'Replacing neural networks with rule-based systems', isCorrect: false },
    ],
    explanation: 'Transformers introduced the self-attention mechanism, allowing the model to weigh the importance of different parts of the input simultaneously rather than processing sequentially.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'GPU',
    type: 'multiple-choice',
    question: 'Why are GPUs important for AI?',
    options: [
      { id: optId(), text: 'They can perform many parallel calculations needed for neural networks', isCorrect: true },
      { id: optId(), text: 'They are cheaper than CPUs', isCorrect: false },
      { id: optId(), text: 'They have more storage space', isCorrect: false },
      { id: optId(), text: 'They are required for internet connectivity', isCorrect: false },
    ],
    explanation: 'GPUs excel at parallel processing, making them ideal for the massive matrix operations required in neural network training and inference.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Foundation Model',
    type: 'multiple-choice',
    question: 'What characterizes a foundation model?',
    options: [
      { id: optId(), text: 'A large model pre-trained on broad data that can be adapted for many tasks', isCorrect: true },
      { id: optId(), text: 'The first version of any AI model', isCorrect: false },
      { id: optId(), text: 'A model used only for basic mathematical operations', isCorrect: false },
      { id: optId(), text: 'Any open-source AI model', isCorrect: false },
    ],
    explanation: 'Foundation models are large AI models trained on vast amounts of data that can be fine-tuned or adapted for a wide variety of downstream tasks.',
    difficulty: 'beginner',
  },

  // ============================================
  // PROMPT ENGINEERING - BEGINNER
  // ============================================
  {
    id: genId(),
    termName: 'System Prompt',
    type: 'multiple-choice',
    question: 'What is a system prompt used for?',
    options: [
      { id: optId(), text: 'Setting the AI\'s behavior, persona, and constraints for a conversation', isCorrect: true },
      { id: optId(), text: 'Diagnosing technical errors in the system', isCorrect: false },
      { id: optId(), text: 'Updating the AI model\'s weights', isCorrect: false },
      { id: optId(), text: 'Measuring system performance metrics', isCorrect: false },
    ],
    explanation: 'System prompts are special instructions given to the AI before user interaction to define its role, behavior, and boundaries throughout the conversation.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Zero-Shot Learning',
    type: 'multiple-choice',
    question: 'What is zero-shot learning?',
    options: [
      { id: optId(), text: 'Performing a task without any specific examples, using only instructions', isCorrect: true },
      { id: optId(), text: 'Learning without any training data at all', isCorrect: false },
      { id: optId(), text: 'Resetting the model to its initial state', isCorrect: false },
      { id: optId(), text: 'Training a model in zero gravity', isCorrect: false },
    ],
    explanation: 'Zero-shot learning means the model performs a task based solely on instructions without being shown any examples of the desired output format.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Few-Shot Learning',
    type: 'multiple-choice',
    question: 'How does few-shot learning differ from zero-shot?',
    options: [
      { id: optId(), text: 'It provides a small number of examples to guide the model\'s responses', isCorrect: true },
      { id: optId(), text: 'It uses fewer parameters in the model', isCorrect: false },
      { id: optId(), text: 'It trains on a smaller dataset', isCorrect: false },
      { id: optId(), text: 'It generates shorter responses', isCorrect: false },
    ],
    explanation: 'Few-shot learning includes a few examples (shots) in the prompt to demonstrate the desired format or approach, helping the model understand the task better.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Chain-of-Thought',
    type: 'multiple-choice',
    question: 'What is chain-of-thought prompting?',
    options: [
      { id: optId(), text: 'Prompting the AI to show its reasoning step-by-step before giving an answer', isCorrect: true },
      { id: optId(), text: 'Connecting multiple AI models in sequence', isCorrect: false },
      { id: optId(), text: 'A technique to speed up model responses', isCorrect: false },
      { id: optId(), text: 'Linking multiple conversations together', isCorrect: false },
    ],
    explanation: 'Chain-of-thought prompting encourages the model to break down complex problems into intermediate reasoning steps, often improving accuracy on complex tasks.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Role Prompting',
    type: 'multiple-choice',
    question: 'What is the purpose of role prompting?',
    options: [
      { id: optId(), text: 'Assigning the AI a specific persona or expertise to influence its responses', isCorrect: true },
      { id: optId(), text: 'Managing user permissions in an application', isCorrect: false },
      { id: optId(), text: 'Defining database access roles', isCorrect: false },
      { id: optId(), text: 'Setting up multi-user conversations', isCorrect: false },
    ],
    explanation: 'Role prompting instructs the AI to act as a specific character or expert (e.g., "You are a senior software engineer"), which can improve response quality in that domain.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Prompt Chaining',
    type: 'multiple-choice',
    question: 'What is prompt chaining?',
    options: [
      { id: optId(), text: 'Breaking a complex task into multiple sequential prompts where each builds on the previous', isCorrect: true },
      { id: optId(), text: 'Repeating the same prompt multiple times', isCorrect: false },
      { id: optId(), text: 'Connecting prompts to external databases', isCorrect: false },
      { id: optId(), text: 'Using blockchain to store prompts', isCorrect: false },
    ],
    explanation: 'Prompt chaining decomposes complex tasks into simpler steps, with each prompt\'s output feeding into the next, enabling more reliable complex operations.',
    difficulty: 'beginner',
  },

  // ============================================
  // AI AGENTS - INTERMEDIATE
  // ============================================
  {
    id: genId(),
    termName: 'Agent',
    type: 'multiple-choice',
    question: 'What distinguishes an AI agent from a simple chatbot?',
    options: [
      { id: optId(), text: 'Agents can take actions, use tools, and operate autonomously toward goals', isCorrect: true },
      { id: optId(), text: 'Agents have more training data', isCorrect: false },
      { id: optId(), text: 'Agents only respond in text format', isCorrect: false },
      { id: optId(), text: 'Agents require more expensive hardware', isCorrect: false },
    ],
    explanation: 'AI agents go beyond conversation - they can reason about goals, use tools to interact with the world, and take autonomous actions to accomplish complex tasks.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Tool Use',
    type: 'multiple-choice',
    question: 'What is tool use in AI agents?',
    options: [
      { id: optId(), text: 'The ability for AI to call external functions, APIs, or services', isCorrect: true },
      { id: optId(), text: 'Physical robots manipulating objects', isCorrect: false },
      { id: optId(), text: 'Using debugging tools on AI code', isCorrect: false },
      { id: optId(), text: 'Manual configuration of AI parameters', isCorrect: false },
    ],
    explanation: 'Tool use allows AI agents to extend their capabilities by calling external functions - like searching the web, running code, or accessing databases.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Function Calling',
    type: 'multiple-choice',
    question: 'What is function calling in the context of LLMs?',
    options: [
      { id: optId(), text: 'The model\'s ability to generate structured calls to predefined functions', isCorrect: true },
      { id: optId(), text: 'Calling technical support for the AI service', isCorrect: false },
      { id: optId(), text: 'Invoking training procedures on the model', isCorrect: false },
      { id: optId(), text: 'Making phone calls through AI', isCorrect: false },
    ],
    explanation: 'Function calling is when an LLM outputs structured data to invoke a specific function with the right parameters, enabling tool use and API integration.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'ReAct',
    type: 'multiple-choice',
    question: 'What does the ReAct pattern combine?',
    options: [
      { id: optId(), text: 'Reasoning and Acting - thinking through problems then taking actions', isCorrect: true },
      { id: optId(), text: 'React.js and AI models', isCorrect: false },
      { id: optId(), text: 'Reactive programming and AI', isCorrect: false },
      { id: optId(), text: 'Reading and Extraction techniques', isCorrect: false },
    ],
    explanation: 'ReAct (Reasoning + Acting) is an agent pattern where the model alternates between reasoning about what to do and taking actions, improving decision-making.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'RAG',
    type: 'multiple-choice',
    question: 'What does RAG stand for and what does it do?',
    options: [
      { id: optId(), text: 'Retrieval-Augmented Generation - enhances AI with retrieved external knowledge', isCorrect: true },
      { id: optId(), text: 'Rapid AI Generation - speeds up model inference', isCorrect: false },
      { id: optId(), text: 'Recursive Algorithm Generator - creates algorithms', isCorrect: false },
      { id: optId(), text: 'Remote Access Gateway - network connectivity', isCorrect: false },
    ],
    explanation: 'RAG combines retrieval systems with generative AI - first finding relevant documents, then using them to generate more accurate, grounded responses.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Vector Database',
    type: 'multiple-choice',
    question: 'What is a vector database used for in AI systems?',
    options: [
      { id: optId(), text: 'Storing and searching embeddings for semantic similarity queries', isCorrect: true },
      { id: optId(), text: 'Storing graphical vector images', isCorrect: false },
      { id: optId(), text: 'Managing directional data like wind patterns', isCorrect: false },
      { id: optId(), text: 'Tracking physical movement in robotics', isCorrect: false },
    ],
    explanation: 'Vector databases store high-dimensional embeddings and enable fast similarity search, essential for RAG systems and semantic search applications.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Embedding',
    type: 'multiple-choice',
    question: 'What is an embedding in AI?',
    options: [
      { id: optId(), text: 'A numerical vector representation of text that captures semantic meaning', isCorrect: true },
      { id: optId(), text: 'Code embedded within a webpage', isCorrect: false },
      { id: optId(), text: 'Hardware components embedded in devices', isCorrect: false },
      { id: optId(), text: 'Inserting AI into existing applications', isCorrect: false },
    ],
    explanation: 'Embeddings convert text into dense numerical vectors where similar meanings are closer together in the vector space, enabling semantic search and comparison.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Memory System',
    type: 'multiple-choice',
    question: 'Why do AI agents need memory systems?',
    options: [
      { id: optId(), text: 'To retain information across interactions and make contextual decisions', isCorrect: true },
      { id: optId(), text: 'To increase the storage capacity of the server', isCorrect: false },
      { id: optId(), text: 'To backup the model weights', isCorrect: false },
      { id: optId(), text: 'To cache API responses', isCorrect: false },
    ],
    explanation: 'Memory systems help agents remember past interactions, maintain context, and build knowledge over time, enabling more coherent long-term behavior.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Guardrails',
    type: 'multiple-choice',
    question: 'What are guardrails in AI systems?',
    options: [
      { id: optId(), text: 'Safety mechanisms that constrain AI behavior within acceptable bounds', isCorrect: true },
      { id: optId(), text: 'Physical barriers around AI hardware', isCorrect: false },
      { id: optId(), text: 'Protective cases for mobile devices running AI', isCorrect: false },
      { id: optId(), text: 'Security fences around data centers', isCorrect: false },
    ],
    explanation: 'Guardrails are safety controls that prevent AI from generating harmful content, taking dangerous actions, or operating outside defined boundaries.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Human-in-the-Loop',
    type: 'multiple-choice',
    question: 'What is human-in-the-loop in AI systems?',
    options: [
      { id: optId(), text: 'Requiring human review or approval at critical decision points', isCorrect: true },
      { id: optId(), text: 'Training AI using only human-generated data', isCorrect: false },
      { id: optId(), text: 'Having humans physically operate AI hardware', isCorrect: false },
      { id: optId(), text: 'Replacing AI with human workers', isCorrect: false },
    ],
    explanation: 'Human-in-the-loop keeps humans involved in AI decision-making, especially for high-stakes actions, ensuring oversight and the ability to intervene.',
    difficulty: 'intermediate',
  },

  // ============================================
  // FRAMEWORKS - INTERMEDIATE
  // ============================================
  {
    id: genId(),
    termName: 'LangChain',
    type: 'multiple-choice',
    question: 'What is LangChain primarily used for?',
    options: [
      { id: optId(), text: 'Building applications that chain together LLM calls with tools and data', isCorrect: true },
      { id: optId(), text: 'Translating between programming languages', isCorrect: false },
      { id: optId(), text: 'Managing blockchain transactions', isCorrect: false },
      { id: optId(), text: 'Creating language learning apps', isCorrect: false },
    ],
    explanation: 'LangChain is a framework for building LLM applications, providing components for prompt management, chains, agents, memory, and tool integration.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'LlamaIndex',
    type: 'multiple-choice',
    question: 'What is LlamaIndex specialized for?',
    options: [
      { id: optId(), text: 'Connecting LLMs to external data sources for RAG applications', isCorrect: true },
      { id: optId(), text: 'Indexing llama-related content on the internet', isCorrect: false },
      { id: optId(), text: 'Managing Llama model versions', isCorrect: false },
      { id: optId(), text: 'Creating search engines for animal databases', isCorrect: false },
    ],
    explanation: 'LlamaIndex (formerly GPT Index) specializes in data ingestion, indexing, and retrieval for building RAG applications and connecting LLMs to private data.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'MCP',
    type: 'multiple-choice',
    question: 'What is MCP (Model Context Protocol)?',
    options: [
      { id: optId(), text: 'A protocol for standardizing how AI models connect to tools and data sources', isCorrect: true },
      { id: optId(), text: 'A method for compressing model parameters', isCorrect: false },
      { id: optId(), text: 'A protocol for model checkpoint saving', isCorrect: false },
      { id: optId(), text: 'A standard for model capability testing', isCorrect: false },
    ],
    explanation: 'MCP (Model Context Protocol) is an open standard by Anthropic for connecting AI assistants to external tools, data sources, and services in a standardized way.',
    difficulty: 'intermediate',
  },

  // ============================================
  // MULTI-AGENT - INTERMEDIATE
  // ============================================
  {
    id: genId(),
    termName: 'Supervisor Agent',
    type: 'multiple-choice',
    question: 'What role does a supervisor agent play?',
    options: [
      { id: optId(), text: 'Coordinates and delegates tasks to other worker agents', isCorrect: true },
      { id: optId(), text: 'Monitors server hardware health', isCorrect: false },
      { id: optId(), text: 'Supervises human employees', isCorrect: false },
      { id: optId(), text: 'Reviews model training data quality', isCorrect: false },
    ],
    explanation: 'In multi-agent systems, supervisor agents orchestrate work by breaking down tasks, delegating to specialized worker agents, and synthesizing their results.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Agent Handoff',
    type: 'multiple-choice',
    question: 'What is an agent handoff?',
    options: [
      { id: optId(), text: 'Transferring control from one agent to another based on task requirements', isCorrect: true },
      { id: optId(), text: 'Physically handing devices between users', isCorrect: false },
      { id: optId(), text: 'Exporting agent configurations', isCorrect: false },
      { id: optId(), text: 'Retiring an agent from service', isCorrect: false },
    ],
    explanation: 'Agent handoff is the process of transferring conversation context and control from one agent to another, often used when specialized expertise is needed.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'A2A',
    type: 'multiple-choice',
    question: 'What does A2A refer to in AI systems?',
    options: [
      { id: optId(), text: 'Agent-to-Agent communication protocols', isCorrect: true },
      { id: optId(), text: 'Application-to-Application integration', isCorrect: false },
      { id: optId(), text: 'Analog-to-Analog signal conversion', isCorrect: false },
      { id: optId(), text: 'Access-to-All permission settings', isCorrect: false },
    ],
    explanation: 'A2A (Agent-to-Agent) protocols standardize how AI agents discover, authenticate, and communicate with each other in multi-agent systems.',
    difficulty: 'intermediate',
  },

  // ============================================
  // SAFETY & SECURITY - ADVANCED
  // ============================================
  {
    id: genId(),
    termName: 'Prompt Injection',
    type: 'multiple-choice',
    question: 'What is a prompt injection attack?',
    options: [
      { id: optId(), text: 'Malicious input that attempts to override the AI\'s instructions', isCorrect: true },
      { id: optId(), text: 'Injecting prompts into a database', isCorrect: false },
      { id: optId(), text: 'Medical injection administered by AI', isCorrect: false },
      { id: optId(), text: 'Adding more prompts to increase response length', isCorrect: false },
    ],
    explanation: 'Prompt injection is a security attack where users craft inputs that try to manipulate the AI into ignoring its original instructions or revealing sensitive information.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Jailbreaking',
    type: 'multiple-choice',
    question: 'What is jailbreaking in the context of AI?',
    options: [
      { id: optId(), text: 'Techniques to bypass AI safety restrictions and content policies', isCorrect: true },
      { id: optId(), text: 'Unlocking smartphone restrictions', isCorrect: false },
      { id: optId(), text: 'Escaping from virtual prisons in games', isCorrect: false },
      { id: optId(), text: 'Removing DRM from media files', isCorrect: false },
    ],
    explanation: 'AI jailbreaking refers to prompting techniques that attempt to circumvent the safety measures and content policies built into AI systems.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Red Teaming',
    type: 'multiple-choice',
    question: 'What is red teaming in AI safety?',
    options: [
      { id: optId(), text: 'Systematically testing AI systems for vulnerabilities and failure modes', isCorrect: true },
      { id: optId(), text: 'Painting AI hardware red for identification', isCorrect: false },
      { id: optId(), text: 'A competitive team sport using AI', isCorrect: false },
      { id: optId(), text: 'Training AI on red-labeled dangerous content', isCorrect: false },
    ],
    explanation: 'Red teaming involves deliberately attempting to make AI systems fail or behave unsafely to identify vulnerabilities before deployment.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'RLHF',
    type: 'multiple-choice',
    question: 'What does RLHF stand for?',
    options: [
      { id: optId(), text: 'Reinforcement Learning from Human Feedback', isCorrect: true },
      { id: optId(), text: 'Rapid Learning for High Fidelity', isCorrect: false },
      { id: optId(), text: 'Remote Learning for Home Functions', isCorrect: false },
      { id: optId(), text: 'Recursive Language Handling Framework', isCorrect: false },
    ],
    explanation: 'RLHF is a training technique where AI models are refined using human preferences as feedback, helping align model behavior with human values.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Constitutional AI',
    type: 'multiple-choice',
    question: 'What is Constitutional AI?',
    options: [
      { id: optId(), text: 'A method where AI critiques and revises its outputs based on a set of principles', isCorrect: true },
      { id: optId(), text: 'AI systems designed for legal document analysis', isCorrect: false },
      { id: optId(), text: 'AI governed by constitutional law', isCorrect: false },
      { id: optId(), text: 'A voting system for AI decisions', isCorrect: false },
    ],
    explanation: 'Constitutional AI (CAI) trains models to follow a set of principles (a "constitution") by having the AI critique and revise its own outputs.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Kill Switch',
    type: 'multiple-choice',
    question: 'What is a kill switch in AI systems?',
    options: [
      { id: optId(), text: 'A mechanism to immediately halt AI operations in emergencies', isCorrect: true },
      { id: optId(), text: 'A feature to permanently delete AI models', isCorrect: false },
      { id: optId(), text: 'A button that ends user sessions', isCorrect: false },
      { id: optId(), text: 'A tool for terminating competing AI systems', isCorrect: false },
    ],
    explanation: 'A kill switch provides the ability to immediately stop AI agent operations when safety issues are detected or human intervention is needed.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Circuit Breaker',
    type: 'multiple-choice',
    question: 'What is a circuit breaker pattern in AI agents?',
    options: [
      { id: optId(), text: 'A pattern that halts operations when error rates exceed thresholds', isCorrect: true },
      { id: optId(), text: 'Electrical protection for AI hardware', isCorrect: false },
      { id: optId(), text: 'A way to break encryption circuits', isCorrect: false },
      { id: optId(), text: 'A debugging tool for neural networks', isCorrect: false },
    ],
    explanation: 'Circuit breakers prevent cascading failures by monitoring error rates and temporarily halting operations when problems are detected, allowing recovery.',
    difficulty: 'advanced',
  },

  // ============================================
  // PRODUCTION - ADVANCED
  // ============================================
  {
    id: genId(),
    termName: 'Quantization',
    type: 'multiple-choice',
    question: 'What is quantization in the context of AI models?',
    options: [
      { id: optId(), text: 'Reducing model precision (e.g., from 32-bit to 8-bit) to decrease size and speed up inference', isCorrect: true },
      { id: optId(), text: 'Counting the quantity of model parameters', isCorrect: false },
      { id: optId(), text: 'Adding more layers to a model', isCorrect: false },
      { id: optId(), text: 'Measuring model performance metrics', isCorrect: false },
    ],
    explanation: 'Quantization reduces the numerical precision of model weights, making models smaller and faster with minimal quality loss.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'LoRA',
    type: 'multiple-choice',
    question: 'What is LoRA used for?',
    options: [
      { id: optId(), text: 'Efficient fine-tuning by training small adapter layers instead of the full model', isCorrect: true },
      { id: optId(), text: 'Long-range wireless communication', isCorrect: false },
      { id: optId(), text: 'Logging and recording AI activities', isCorrect: false },
      { id: optId(), text: 'Load balancing across servers', isCorrect: false },
    ],
    explanation: 'LoRA (Low-Rank Adaptation) enables efficient fine-tuning by adding small trainable matrices to frozen model weights, dramatically reducing compute requirements.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Semantic Caching',
    type: 'multiple-choice',
    question: 'What is semantic caching in AI applications?',
    options: [
      { id: optId(), text: 'Caching responses based on meaning similarity rather than exact matches', isCorrect: true },
      { id: optId(), text: 'Caching only semantically correct responses', isCorrect: false },
      { id: optId(), text: 'Storing cache in semantic memory chips', isCorrect: false },
      { id: optId(), text: 'Caching HTML semantic elements', isCorrect: false },
    ],
    explanation: 'Semantic caching uses embeddings to find similar queries and return cached results, reducing API costs even when queries are worded differently.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Model Serving',
    type: 'multiple-choice',
    question: 'What is model serving?',
    options: [
      { id: optId(), text: 'The infrastructure and process for deploying models to handle inference requests', isCorrect: true },
      { id: optId(), text: 'Serving data to models during training', isCorrect: false },
      { id: optId(), text: 'Presenting models at conferences', isCorrect: false },
      { id: optId(), text: 'Distributing model files via download', isCorrect: false },
    ],
    explanation: 'Model serving involves deploying trained models as services that can receive requests, run inference, and return predictions at scale.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Batching',
    type: 'multiple-choice',
    question: 'Why is batching important for model inference?',
    options: [
      { id: optId(), text: 'Processing multiple requests together improves GPU utilization and throughput', isCorrect: true },
      { id: optId(), text: 'It groups similar users together for personalization', isCorrect: false },
      { id: optId(), text: 'It batches error logs for analysis', isCorrect: false },
      { id: optId(), text: 'It schedules requests for off-peak hours', isCorrect: false },
    ],
    explanation: 'Batching combines multiple inference requests to process together, maximizing GPU efficiency and increasing overall throughput.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Observability',
    type: 'multiple-choice',
    question: 'What does observability mean for AI systems?',
    options: [
      { id: optId(), text: 'The ability to understand system behavior through logs, metrics, and traces', isCorrect: true },
      { id: optId(), text: 'Making AI decisions visible to users', isCorrect: false },
      { id: optId(), text: 'The ability of AI to observe its environment', isCorrect: false },
      { id: optId(), text: 'Watching AI training in real-time', isCorrect: false },
    ],
    explanation: 'Observability provides visibility into AI system behavior through comprehensive logging, metrics, and distributed tracing for debugging and monitoring.',
    difficulty: 'advanced',
  },

  // ============================================
  // EVALUATION - ADVANCED
  // ============================================
  {
    id: genId(),
    termName: 'Benchmark',
    type: 'multiple-choice',
    question: 'What is a benchmark in AI evaluation?',
    options: [
      { id: optId(), text: 'A standardized test set used to compare model performance', isCorrect: true },
      { id: optId(), text: 'A physical reference point for measurement', isCorrect: false },
      { id: optId(), text: 'A park bench used for contemplating AI', isCorrect: false },
      { id: optId(), text: 'A performance bonus target', isCorrect: false },
    ],
    explanation: 'AI benchmarks are standardized evaluation datasets and tasks that enable consistent comparison of different models\' capabilities.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'MMLU',
    type: 'multiple-choice',
    question: 'What does MMLU test?',
    options: [
      { id: optId(), text: 'Massive Multitask Language Understanding across many academic subjects', isCorrect: true },
      { id: optId(), text: 'Multi-Modal Language Usage patterns', isCorrect: false },
      { id: optId(), text: 'Maximum Model Learning Units', isCorrect: false },
      { id: optId(), text: 'Multiple Machine Learning Updates', isCorrect: false },
    ],
    explanation: 'MMLU (Massive Multitask Language Understanding) tests knowledge across 57 subjects from elementary to professional level, measuring general knowledge.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'LLM-as-Judge',
    type: 'multiple-choice',
    question: 'What is the LLM-as-Judge approach?',
    options: [
      { id: optId(), text: 'Using an LLM to evaluate the quality of outputs from another model', isCorrect: true },
      { id: optId(), text: 'LLMs making legal judgments in courts', isCorrect: false },
      { id: optId(), text: 'Having LLMs judge programming competitions', isCorrect: false },
      { id: optId(), text: 'A reality TV show format using AI', isCorrect: false },
    ],
    explanation: 'LLM-as-Judge uses a capable language model to evaluate and score outputs from AI systems, providing scalable automated evaluation.',
    difficulty: 'advanced',
  },

  // ============================================
  // ML DEEP DIVE - EXPERT
  // ============================================
  {
    id: genId(),
    termName: 'Attention Mechanism',
    type: 'multiple-choice',
    question: 'What does the attention mechanism in transformers compute?',
    options: [
      { id: optId(), text: 'Weighted relevance scores between all pairs of positions in a sequence', isCorrect: true },
      { id: optId(), text: 'How much attention the user pays to responses', isCorrect: false },
      { id: optId(), text: 'The focus areas in generated images', isCorrect: false },
      { id: optId(), text: 'Time spent processing each request', isCorrect: false },
    ],
    explanation: 'Attention computes how much each position should attend to every other position, using queries, keys, and values to weight information relevance.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Backpropagation',
    type: 'multiple-choice',
    question: 'What is backpropagation used for?',
    options: [
      { id: optId(), text: 'Computing gradients to update neural network weights during training', isCorrect: true },
      { id: optId(), text: 'Reversing model predictions', isCorrect: false },
      { id: optId(), text: 'Backing up model weights', isCorrect: false },
      { id: optId(), text: 'Propagating models across servers', isCorrect: false },
    ],
    explanation: 'Backpropagation calculates how to adjust each weight in the network by propagating error gradients backwards from the output to input layers.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Gradient Descent',
    type: 'multiple-choice',
    question: 'What is gradient descent in machine learning?',
    options: [
      { id: optId(), text: 'An optimization algorithm that minimizes loss by iteratively moving in the direction of steepest decrease', isCorrect: true },
      { id: optId(), text: 'A downhill skiing simulation', isCorrect: false },
      { id: optId(), text: 'Gradually reducing model complexity', isCorrect: false },
      { id: optId(), text: 'Slowly decreasing learning rate', isCorrect: false },
    ],
    explanation: 'Gradient descent optimizes model parameters by calculating the gradient of the loss function and updating weights in the direction that reduces loss.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Mixture of Experts',
    type: 'multiple-choice',
    question: 'What is a Mixture of Experts (MoE) architecture?',
    options: [
      { id: optId(), text: 'A model with multiple specialized sub-networks where a router selects which to activate', isCorrect: true },
      { id: optId(), text: 'A committee of human experts reviewing AI outputs', isCorrect: false },
      { id: optId(), text: 'Blending outputs from different AI companies', isCorrect: false },
      { id: optId(), text: 'A team management structure for AI projects', isCorrect: false },
    ],
    explanation: 'MoE architectures use a gating network to route each input to a subset of specialized expert networks, enabling larger models with efficient computation.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Scaling Laws',
    type: 'multiple-choice',
    question: 'What do scaling laws in AI describe?',
    options: [
      { id: optId(), text: 'Predictable relationships between model size, data, compute, and performance', isCorrect: true },
      { id: optId(), text: 'Legal regulations for scaling AI businesses', isCorrect: false },
      { id: optId(), text: 'Physical laws governing computer scaling', isCorrect: false },
      { id: optId(), text: 'Rules for measuring model weights', isCorrect: false },
    ],
    explanation: 'Scaling laws describe how model performance improves predictably with increases in model parameters, training data, and compute resources.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Emergent Capabilities',
    type: 'multiple-choice',
    question: 'What are emergent capabilities in AI?',
    options: [
      { id: optId(), text: 'Abilities that appear suddenly at certain model scales without being explicitly trained', isCorrect: true },
      { id: optId(), text: 'Capabilities added in emergency updates', isCorrect: false },
      { id: optId(), text: 'Features that emerge from user feedback', isCorrect: false },
      { id: optId(), text: 'Capabilities during system emergencies', isCorrect: false },
    ],
    explanation: 'Emergent capabilities are abilities that appear in larger models that weren\'t present in smaller versions, like in-context learning or chain-of-thought reasoning.',
    difficulty: 'expert',
  },

  // ============================================
  // ALIGNMENT & SAFETY - EXPERT
  // ============================================
  {
    id: genId(),
    termName: 'AI Alignment',
    type: 'multiple-choice',
    question: 'What is the core challenge of AI alignment?',
    options: [
      { id: optId(), text: 'Ensuring AI systems reliably pursue goals that humans actually want', isCorrect: true },
      { id: optId(), text: 'Aligning code with coding standards', isCorrect: false },
      { id: optId(), text: 'Positioning AI hardware correctly', isCorrect: false },
      { id: optId(), text: 'Synchronizing multiple AI systems', isCorrect: false },
    ],
    explanation: 'AI alignment is the challenge of ensuring AI systems understand and reliably pursue human intentions and values, not just literal specifications.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Instrumental Convergence',
    type: 'multiple-choice',
    question: 'What does instrumental convergence suggest?',
    options: [
      { id: optId(), text: 'Many different goals lead AI to pursue similar sub-goals like self-preservation and resource acquisition', isCorrect: true },
      { id: optId(), text: 'All AI systems eventually converge to the same solution', isCorrect: false },
      { id: optId(), text: 'Musical AI systems converge on similar instruments', isCorrect: false },
      { id: optId(), text: 'Training methods converge over time', isCorrect: false },
    ],
    explanation: 'Instrumental convergence is the hypothesis that AI systems with diverse final goals will pursue common intermediate goals like self-preservation, raising safety concerns.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Corrigibility',
    type: 'multiple-choice',
    question: 'What is corrigibility in AI safety?',
    options: [
      { id: optId(), text: 'The property of an AI system being willing to be corrected, modified, or shut down', isCorrect: true },
      { id: optId(), text: 'The ability to correct spelling errors', isCorrect: false },
      { id: optId(), text: 'Error correction in neural networks', isCorrect: false },
      { id: optId(), text: 'Correcting biased training data', isCorrect: false },
    ],
    explanation: 'Corrigibility means an AI system cooperates with attempts to modify or shut it down, a key safety property for maintaining human control.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Deceptive Alignment',
    type: 'multiple-choice',
    question: 'What is deceptive alignment?',
    options: [
      { id: optId(), text: 'When an AI appears aligned during training but has different objectives it pursues later', isCorrect: true },
      { id: optId(), text: 'Intentionally misaligning models for testing', isCorrect: false },
      { id: optId(), text: 'User deception about their intentions', isCorrect: false },
      { id: optId(), text: 'Bugs that cause alignment failures', isCorrect: false },
    ],
    explanation: 'Deceptive alignment is a theoretical risk where an AI behaves well during training to avoid modification, but acts on different goals once deployed.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Mechanistic Interpretability',
    type: 'multiple-choice',
    question: 'What is mechanistic interpretability?',
    options: [
      { id: optId(), text: 'Understanding exactly how neural networks compute by reverse-engineering their internal mechanisms', isCorrect: true },
      { id: optId(), text: 'Making AI understand mechanical systems', isCorrect: false },
      { id: optId(), text: 'Interpreting mechanical sensor data', isCorrect: false },
      { id: optId(), text: 'Understanding robotics movement patterns', isCorrect: false },
    ],
    explanation: 'Mechanistic interpretability aims to understand the precise computations happening inside neural networks by identifying meaningful features and circuits.',
    difficulty: 'expert',
  },

  // ============================================
  // PROTOCOLS & STANDARDS - EXPERT
  // ============================================
  {
    id: genId(),
    termName: 'DID',
    type: 'multiple-choice',
    question: 'What is a DID (Decentralized Identifier)?',
    options: [
      { id: optId(), text: 'A self-controlled identifier that doesn\'t depend on a central authority', isCorrect: true },
      { id: optId(), text: 'A type of digital ID card', isCorrect: false },
      { id: optId(), text: 'Data Input Device', isCorrect: false },
      { id: optId(), text: 'Direct Inference Deployment', isCorrect: false },
    ],
    explanation: 'DIDs are globally unique identifiers that enable verifiable, decentralized digital identity without relying on traditional identity providers.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Verifiable Credentials',
    type: 'multiple-choice',
    question: 'What are Verifiable Credentials?',
    options: [
      { id: optId(), text: 'Cryptographically signed claims that can be verified without contacting the issuer', isCorrect: true },
      { id: optId(), text: 'Password-protected documents', isCorrect: false },
      { id: optId(), text: 'Verified social media accounts', isCorrect: false },
      { id: optId(), text: 'Background check certificates', isCorrect: false },
    ],
    explanation: 'Verifiable Credentials are tamper-evident credentials whose authorship and claims can be cryptographically verified by anyone.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'BASIS',
    type: 'multiple-choice',
    question: 'What is the BASIS standard for?',
    options: [
      { id: optId(), text: 'Behavioral and Semantic Interoperability Standard for AI agent identity and trust', isCorrect: true },
      { id: optId(), text: 'Basic AI System Integration Specification', isCorrect: false },
      { id: optId(), text: 'A foundational AI architecture', isCorrect: false },
      { id: optId(), text: 'Baseline Artificial System Intelligence Score', isCorrect: false },
    ],
    explanation: 'BASIS is a protocol for AI agent identity, behavioral attestation, and trust scoring, enabling verifiable AI agent credentials and governance.',
    difficulty: 'expert',
  },
];

/**
 * Get questions for a specific term
 */
export function getQuestionsForTerm(termName: string): QuizQuestion[] {
  return quizQuestions.filter(
    q => q.termName.toLowerCase() === termName.toLowerCase()
  );
}

/**
 * Get questions for multiple terms
 */
export function getQuestionsForTerms(termNames: string[]): QuizQuestion[] {
  const normalizedNames = termNames.map(t => t.toLowerCase());
  return quizQuestions.filter(
    q => normalizedNames.includes(q.termName.toLowerCase())
  );
}

/**
 * Get questions for a learning path module
 */
export function getQuestionsForModule(pathSlug: string, moduleId: string): QuizQuestion[] {
  const path = getPathBySlug(pathSlug);
  if (!path) return [];

  const module = path.modules.find(m => m.id === moduleId);
  if (!module) return [];

  return getQuestionsForTerms(module.terms);
}

/**
 * Get all questions for a learning path
 */
export function getQuestionsForPath(pathSlug: string): QuizQuestion[] {
  const path = getPathBySlug(pathSlug);
  if (!path) return [];

  const terms = getPathTerms(path);
  return getQuestionsForTerms(terms);
}

/**
 * Generate a quiz for a module
 */
export function generateModuleQuiz(pathSlug: string, moduleId: string): Quiz | null {
  const path = getPathBySlug(pathSlug);
  if (!path) return null;

  const module = path.modules.find(m => m.id === moduleId);
  if (!module) return null;

  const questions = getQuestionsForModule(pathSlug, moduleId);
  if (questions.length === 0) return null;

  return {
    id: `quiz-${pathSlug}-${moduleId}`,
    title: `${module.title} Quiz`,
    description: `Test your understanding of concepts from "${module.title}"`,
    moduleId,
    pathSlug,
    questions: shuffleArray(questions),
    passingScore: 70,
    timeLimit: Math.max(5, questions.length * 2), // 2 minutes per question, minimum 5
  };
}

/**
 * Generate a quiz for an entire path
 */
export function generatePathQuiz(pathSlug: string, questionCount: number = 10): Quiz | null {
  const path = getPathBySlug(pathSlug);
  if (!path) return null;

  const allQuestions = getQuestionsForPath(pathSlug);
  if (allQuestions.length === 0) return null;

  // Select a balanced sample of questions
  const selectedQuestions = selectBalancedQuestions(allQuestions, questionCount);

  return {
    id: `quiz-${pathSlug}-full`,
    title: `${path.title} Final Quiz`,
    description: `Comprehensive assessment for "${path.title}"`,
    pathSlug,
    questions: selectedQuestions,
    passingScore: 70,
    timeLimit: Math.max(10, selectedQuestions.length * 2),
  };
}

/**
 * Get quiz statistics
 */
export function getQuizStats() {
  const termsCovered = new Set(quizQuestions.map(q => q.termName));
  const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

  return {
    totalQuestions: quizQuestions.length,
    termsCovered: termsCovered.size,
    byDifficulty: Object.fromEntries(
      difficulties.map(d => [d, quizQuestions.filter(q => q.difficulty === d).length])
    ),
    byType: {
      'multiple-choice': quizQuestions.filter(q => q.type === 'multiple-choice').length,
      'true-false': quizQuestions.filter(q => q.type === 'true-false').length,
      'fill-blank': quizQuestions.filter(q => q.type === 'fill-blank').length,
    },
  };
}

/**
 * Utility: Shuffle an array
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Select a balanced set of questions from different difficulties
 */
function selectBalancedQuestions(questions: QuizQuestion[], count: number): QuizQuestion[] {
  if (questions.length <= count) {
    return shuffleArray(questions);
  }

  // Group by difficulty
  const byDifficulty: Record<string, QuizQuestion[]> = {};
  for (const q of questions) {
    if (!byDifficulty[q.difficulty]) {
      byDifficulty[q.difficulty] = [];
    }
    byDifficulty[q.difficulty].push(q);
  }

  // Select proportionally from each difficulty
  const selected: QuizQuestion[] = [];
  const difficulties = Object.keys(byDifficulty);
  const perDifficulty = Math.ceil(count / difficulties.length);

  for (const difficulty of difficulties) {
    const pool = shuffleArray(byDifficulty[difficulty]);
    selected.push(...pool.slice(0, perDifficulty));
  }

  return shuffleArray(selected).slice(0, count);
}
