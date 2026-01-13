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

  // ============================================
  // AI FOUNDATIONS - ADDITIONAL BEGINNER
  // ============================================
  {
    id: genId(),
    termName: 'NLP',
    type: 'multiple-choice',
    question: 'What does NLP stand for in AI?',
    options: [
      { id: optId(), text: 'Natural Language Processing - enabling computers to understand human language', isCorrect: true },
      { id: optId(), text: 'Neural Layer Programming - a way to code neural networks', isCorrect: false },
      { id: optId(), text: 'Network Learning Protocol - a communication standard', isCorrect: false },
      { id: optId(), text: 'Neuro-Linguistic Programming - a therapy technique', isCorrect: false },
    ],
    explanation: 'NLP (Natural Language Processing) is the field of AI focused on enabling computers to understand, interpret, and generate human language.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Completion',
    type: 'multiple-choice',
    question: 'What is a completion in the context of LLMs?',
    options: [
      { id: optId(), text: 'The output text generated by the model in response to a prompt', isCorrect: true },
      { id: optId(), text: 'Finishing the training process', isCorrect: false },
      { id: optId(), text: 'A fully trained model', isCorrect: false },
      { id: optId(), text: 'The end of a conversation', isCorrect: false },
    ],
    explanation: 'A completion is the text output that an LLM generates in response to a given prompt. The prompt-completion paradigm is fundamental to how we interact with LLMs.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Latency',
    type: 'multiple-choice',
    question: 'What does latency refer to in AI systems?',
    options: [
      { id: optId(), text: 'The time delay between sending a request and receiving a response', isCorrect: true },
      { id: optId(), text: 'The accuracy of the model', isCorrect: false },
      { id: optId(), text: 'The size of the model', isCorrect: false },
      { id: optId(), text: 'The cost per request', isCorrect: false },
    ],
    explanation: 'Latency is the time it takes for an AI system to respond to a request. Lower latency is crucial for real-time applications and good user experience.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Grounding',
    type: 'multiple-choice',
    question: 'What is grounding in AI?',
    options: [
      { id: optId(), text: 'Connecting AI responses to verified facts or source documents', isCorrect: true },
      { id: optId(), text: 'Connecting AI hardware to electrical ground', isCorrect: false },
      { id: optId(), text: 'Basic training of AI models', isCorrect: false },
      { id: optId(), text: 'Resetting the AI to default state', isCorrect: false },
    ],
    explanation: 'Grounding ensures AI responses are anchored in factual information, typically by providing source documents or verified data to reduce hallucinations.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Overfitting',
    type: 'multiple-choice',
    question: 'What is overfitting in machine learning?',
    options: [
      { id: optId(), text: 'When a model memorizes training data but fails to generalize to new data', isCorrect: true },
      { id: optId(), text: 'When a model is too large for the available hardware', isCorrect: false },
      { id: optId(), text: 'When too many users access the model simultaneously', isCorrect: false },
      { id: optId(), text: 'When training takes too long', isCorrect: false },
    ],
    explanation: 'Overfitting occurs when a model learns the training data too well, including noise and outliers, causing poor performance on new, unseen data.',
    difficulty: 'beginner',
  },

  // ============================================
  // PROMPT ENGINEERING - ADDITIONAL
  // ============================================
  {
    id: genId(),
    termName: 'Structured Output',
    type: 'multiple-choice',
    question: 'What is structured output in LLMs?',
    options: [
      { id: optId(), text: 'Model responses formatted in a consistent, parseable format like JSON', isCorrect: true },
      { id: optId(), text: 'Organizing the neural network architecture', isCorrect: false },
      { id: optId(), text: 'Creating outlines before generating text', isCorrect: false },
      { id: optId(), text: 'Structuring the training data', isCorrect: false },
    ],
    explanation: 'Structured output refers to getting LLMs to return responses in predictable formats (like JSON, XML, or specific schemas) that can be easily parsed by code.',
    difficulty: 'beginner',
  },
  {
    id: genId(),
    termName: 'Prompt Template',
    type: 'multiple-choice',
    question: 'What is a prompt template?',
    options: [
      { id: optId(), text: 'A reusable prompt structure with placeholders for dynamic content', isCorrect: true },
      { id: optId(), text: 'A blank starting point for conversations', isCorrect: false },
      { id: optId(), text: 'The default system prompt', isCorrect: false },
      { id: optId(), text: 'A template for documenting prompts', isCorrect: false },
    ],
    explanation: 'Prompt templates are reusable patterns with variable placeholders that can be filled in dynamically, enabling consistent prompting across different inputs.',
    difficulty: 'beginner',
  },

  // ============================================
  // AGENT BUILDING - ADDITIONAL INTERMEDIATE
  // ============================================
  {
    id: genId(),
    termName: 'Agentic AI',
    type: 'multiple-choice',
    question: 'What distinguishes agentic AI from traditional AI?',
    options: [
      { id: optId(), text: 'The ability to autonomously plan, decide, and take actions toward goals', isCorrect: true },
      { id: optId(), text: 'Being developed by a single agent or person', isCorrect: false },
      { id: optId(), text: 'Having a visual interface', isCorrect: false },
      { id: optId(), text: 'Being based on agent-oriented programming', isCorrect: false },
    ],
    explanation: 'Agentic AI refers to systems that can autonomously reason about goals, make decisions, and take actions in the world, going beyond simple response generation.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Cognitive Architecture',
    type: 'multiple-choice',
    question: 'What is a cognitive architecture in AI agents?',
    options: [
      { id: optId(), text: 'A blueprint defining how an agent perceives, reasons, and acts', isCorrect: true },
      { id: optId(), text: 'The physical layout of AI hardware', isCorrect: false },
      { id: optId(), text: 'A database schema for storing knowledge', isCorrect: false },
      { id: optId(), text: 'The neural network structure', isCorrect: false },
    ],
    explanation: 'Cognitive architecture defines the overall structure of an AI agent\'s mind - how it perceives inputs, maintains state, reasons about goals, and decides on actions.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'State Machine',
    type: 'multiple-choice',
    question: 'How are state machines used in AI agents?',
    options: [
      { id: optId(), text: 'To define discrete states and transitions that control agent behavior', isCorrect: true },
      { id: optId(), text: 'To store the physical state of hardware', isCorrect: false },
      { id: optId(), text: 'To manage database connections', isCorrect: false },
      { id: optId(), text: 'To track US state-level regulations', isCorrect: false },
    ],
    explanation: 'State machines in agents define explicit states (like "thinking", "acting", "waiting") and the transitions between them, providing predictable control flow.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Router',
    type: 'multiple-choice',
    question: 'What does a router do in an AI agent system?',
    options: [
      { id: optId(), text: 'Directs requests to the appropriate handler, tool, or sub-agent', isCorrect: true },
      { id: optId(), text: 'Connects the agent to the internet', isCorrect: false },
      { id: optId(), text: 'Routes electricity through the system', isCorrect: false },
      { id: optId(), text: 'Manages network traffic between servers', isCorrect: false },
    ],
    explanation: 'An agent router analyzes incoming requests and decides which component should handle them - routing to specific tools, specialized sub-agents, or different processing paths.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Scratchpad',
    type: 'multiple-choice',
    question: 'What is a scratchpad in AI agents?',
    options: [
      { id: optId(), text: 'Temporary working memory for intermediate reasoning and calculations', isCorrect: true },
      { id: optId(), text: 'A place to store deleted content', isCorrect: false },
      { id: optId(), text: 'A testing environment', isCorrect: false },
      { id: optId(), text: 'A backup storage location', isCorrect: false },
    ],
    explanation: 'A scratchpad is working memory where agents can store intermediate results, notes, and reasoning steps during complex multi-step tasks.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Semantic Similarity',
    type: 'multiple-choice',
    question: 'What does semantic similarity measure?',
    options: [
      { id: optId(), text: 'How close two pieces of text are in meaning, regardless of exact wording', isCorrect: true },
      { id: optId(), text: 'Whether two texts use the same words', isCorrect: false },
      { id: optId(), text: 'The length difference between texts', isCorrect: false },
      { id: optId(), text: 'How similar two websites look', isCorrect: false },
    ],
    explanation: 'Semantic similarity quantifies how close two texts are in meaning using embeddings, enabling search and matching based on concepts rather than keywords.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Reflection',
    type: 'multiple-choice',
    question: 'What is reflection in AI agents?',
    options: [
      { id: optId(), text: 'The agent reviewing and critiquing its own outputs to improve them', isCorrect: true },
      { id: optId(), text: 'Mirroring user behavior', isCorrect: false },
      { id: optId(), text: 'Displaying a visual representation of the agent', isCorrect: false },
      { id: optId(), text: 'Copying responses from other agents', isCorrect: false },
    ],
    explanation: 'Reflection is when an agent evaluates its own reasoning or outputs, identifying errors and improving responses through self-critique loops.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Self-Correction',
    type: 'multiple-choice',
    question: 'What is self-correction in AI agents?',
    options: [
      { id: optId(), text: 'The ability to detect and fix errors in its own outputs automatically', isCorrect: true },
      { id: optId(), text: 'Autocorrect for spelling errors', isCorrect: false },
      { id: optId(), text: 'Users correcting the AI', isCorrect: false },
      { id: optId(), text: 'Automatic grammar checking', isCorrect: false },
    ],
    explanation: 'Self-correction enables agents to identify mistakes in their reasoning or outputs and revise them without human intervention, improving reliability.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Tree of Thoughts',
    type: 'multiple-choice',
    question: 'What is the Tree of Thoughts technique?',
    options: [
      { id: optId(), text: 'Exploring multiple reasoning paths simultaneously and selecting the best one', isCorrect: true },
      { id: optId(), text: 'Organizing knowledge in a tree data structure', isCorrect: false },
      { id: optId(), text: 'A visualization of neural network layers', isCorrect: false },
      { id: optId(), text: 'Branching conversations in chat applications', isCorrect: false },
    ],
    explanation: 'Tree of Thoughts extends chain-of-thought by exploring multiple reasoning branches, evaluating them, and selecting the most promising path for complex problems.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Self-Consistency',
    type: 'multiple-choice',
    question: 'What is self-consistency in AI reasoning?',
    options: [
      { id: optId(), text: 'Generating multiple solutions and selecting the most common answer', isCorrect: true },
      { id: optId(), text: 'Ensuring the AI always gives the same response', isCorrect: false },
      { id: optId(), text: 'Making the AI agree with itself', isCorrect: false },
      { id: optId(), text: 'Consistent formatting across responses', isCorrect: false },
    ],
    explanation: 'Self-consistency improves reasoning by sampling multiple independent chains of thought and selecting the most frequent or consistent answer.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Sandbox',
    type: 'multiple-choice',
    question: 'What is a sandbox in AI safety?',
    options: [
      { id: optId(), text: 'An isolated environment where agents can execute code safely', isCorrect: true },
      { id: optId(), text: 'A place for testing new AI models', isCorrect: false },
      { id: optId(), text: 'A children\'s play area at AI conferences', isCorrect: false },
      { id: optId(), text: 'A visual simulation environment', isCorrect: false },
    ],
    explanation: 'A sandbox isolates agent operations so that potentially dangerous actions (like code execution) cannot affect the broader system or cause harm.',
    difficulty: 'intermediate',
  },

  // ============================================
  // AGENT FRAMEWORKS - ADDITIONAL
  // ============================================
  {
    id: genId(),
    termName: 'LangGraph',
    type: 'multiple-choice',
    question: 'What is LangGraph designed for?',
    options: [
      { id: optId(), text: 'Building stateful, multi-step agent workflows as graphs', isCorrect: true },
      { id: optId(), text: 'Creating language learning applications', isCorrect: false },
      { id: optId(), text: 'Visualizing language patterns', isCorrect: false },
      { id: optId(), text: 'Graphing linguistic data', isCorrect: false },
    ],
    explanation: 'LangGraph extends LangChain for building complex agent workflows as directed graphs, enabling cycles, branching, and persistent state management.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'LangSmith',
    type: 'multiple-choice',
    question: 'What is LangSmith used for?',
    options: [
      { id: optId(), text: 'Debugging, testing, and monitoring LLM applications', isCorrect: true },
      { id: optId(), text: 'Generating new programming languages', isCorrect: false },
      { id: optId(), text: 'Teaching languages to AI', isCorrect: false },
      { id: optId(), text: 'Translating between programming languages', isCorrect: false },
    ],
    explanation: 'LangSmith is LangChain\'s platform for tracing, evaluating, and monitoring LLM applications, providing visibility into agent behavior and performance.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Agentic RAG',
    type: 'multiple-choice',
    question: 'What distinguishes Agentic RAG from basic RAG?',
    options: [
      { id: optId(), text: 'The agent can decide when and how to retrieve, and iterate on results', isCorrect: true },
      { id: optId(), text: 'It uses larger databases', isCorrect: false },
      { id: optId(), text: 'It only works with text documents', isCorrect: false },
      { id: optId(), text: 'It requires human approval for each retrieval', isCorrect: false },
    ],
    explanation: 'Agentic RAG gives agents control over the retrieval process - deciding when to search, what to query, evaluating results, and iteratively refining searches.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'CrewAI',
    type: 'multiple-choice',
    question: 'What is CrewAI designed for?',
    options: [
      { id: optId(), text: 'Orchestrating teams of AI agents with defined roles working toward goals', isCorrect: true },
      { id: optId(), text: 'Managing human teams with AI assistance', isCorrect: false },
      { id: optId(), text: 'Creating AI-generated crew for ships', isCorrect: false },
      { id: optId(), text: 'Hiring AI developers', isCorrect: false },
    ],
    explanation: 'CrewAI is a framework for building multi-agent systems where agents have specific roles, tools, and goals, collaborating like a team of specialists.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'AutoGen',
    type: 'multiple-choice',
    question: 'What is AutoGen\'s key feature?',
    options: [
      { id: optId(), text: 'Enabling multi-agent conversations where agents can talk to each other', isCorrect: true },
      { id: optId(), text: 'Automatically generating AI models', isCorrect: false },
      { id: optId(), text: 'Auto-generating documentation', isCorrect: false },
      { id: optId(), text: 'Generating automatic responses', isCorrect: false },
    ],
    explanation: 'AutoGen (by Microsoft) enables building multi-agent systems through conversational patterns, where agents can communicate and collaborate autonomously.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'AutoGPT',
    type: 'multiple-choice',
    question: 'What made AutoGPT notable?',
    options: [
      { id: optId(), text: 'One of the first autonomous agents that could set sub-goals and work independently', isCorrect: true },
      { id: optId(), text: 'Automatically training GPT models', isCorrect: false },
      { id: optId(), text: 'A faster version of GPT', isCorrect: false },
      { id: optId(), text: 'Automatic prompt generation', isCorrect: false },
    ],
    explanation: 'AutoGPT was a pioneering autonomous agent that could break down goals into sub-tasks, use tools, and work toward objectives with minimal human intervention.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Instructor',
    type: 'multiple-choice',
    question: 'What is the Instructor library used for?',
    options: [
      { id: optId(), text: 'Getting structured, validated outputs from LLMs using Pydantic models', isCorrect: true },
      { id: optId(), text: 'Teaching AI systems new skills', isCorrect: false },
      { id: optId(), text: 'Creating educational AI content', isCorrect: false },
      { id: optId(), text: 'Providing instructions to users', isCorrect: false },
    ],
    explanation: 'Instructor is a library that uses Pydantic for type-safe structured extraction from LLMs, with automatic validation and retry handling.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'JSON Schema',
    type: 'multiple-choice',
    question: 'How is JSON Schema used with LLMs?',
    options: [
      { id: optId(), text: 'To define and validate the structure of model outputs', isCorrect: true },
      { id: optId(), text: 'To store model weights', isCorrect: false },
      { id: optId(), text: 'To configure network settings', isCorrect: false },
      { id: optId(), text: 'To define database tables', isCorrect: false },
    ],
    explanation: 'JSON Schema defines the expected structure of LLM outputs, enabling validation and ensuring responses conform to the required format.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Vercel AI SDK',
    type: 'multiple-choice',
    question: 'What is the Vercel AI SDK designed for?',
    options: [
      { id: optId(), text: 'Building streaming AI chat interfaces in web applications', isCorrect: true },
      { id: optId(), text: 'Deploying AI models to production', isCorrect: false },
      { id: optId(), text: 'Training AI models in the cloud', isCorrect: false },
      { id: optId(), text: 'Creating AI-powered websites', isCorrect: false },
    ],
    explanation: 'The Vercel AI SDK provides React hooks and utilities for building streaming chat UIs, handling AI responses in real-time web applications.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'SSE',
    type: 'multiple-choice',
    question: 'What is SSE and why is it used in AI applications?',
    options: [
      { id: optId(), text: 'Server-Sent Events - enables streaming AI responses to the browser', isCorrect: true },
      { id: optId(), text: 'Secure Socket Encryption - protects AI data', isCorrect: false },
      { id: optId(), text: 'System State Engine - manages AI state', isCorrect: false },
      { id: optId(), text: 'Semantic Search Engine - finds relevant content', isCorrect: false },
    ],
    explanation: 'SSE (Server-Sent Events) allows servers to push data to browsers in real-time, perfect for streaming LLM responses token-by-token.',
    difficulty: 'intermediate',
  },

  // ============================================
  // MULTI-AGENT SYSTEMS - ADDITIONAL
  // ============================================
  {
    id: genId(),
    termName: 'Task Decomposition',
    type: 'multiple-choice',
    question: 'What is task decomposition in AI agents?',
    options: [
      { id: optId(), text: 'Breaking complex tasks into smaller, manageable subtasks', isCorrect: true },
      { id: optId(), text: 'Removing unnecessary tasks from a queue', isCorrect: false },
      { id: optId(), text: 'Analyzing completed tasks', isCorrect: false },
      { id: optId(), text: 'Converting tasks into data', isCorrect: false },
    ],
    explanation: 'Task decomposition is when an agent breaks down a complex goal into smaller subtasks that can be tackled individually or delegated to specialized agents.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Crew',
    type: 'multiple-choice',
    question: 'What is a crew in multi-agent systems?',
    options: [
      { id: optId(), text: 'A team of specialized agents working together on a shared goal', isCorrect: true },
      { id: optId(), text: 'The development team building the AI', isCorrect: false },
      { id: optId(), text: 'Users of the AI system', isCorrect: false },
      { id: optId(), text: 'A group of identical agent copies', isCorrect: false },
    ],
    explanation: 'A crew is a coordinated group of AI agents, each with specific roles and capabilities, collaborating to achieve complex objectives.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Worker Agent',
    type: 'multiple-choice',
    question: 'What is a worker agent?',
    options: [
      { id: optId(), text: 'An agent that executes specific tasks assigned by a supervisor', isCorrect: true },
      { id: optId(), text: 'An AI that helps with employment', isCorrect: false },
      { id: optId(), text: 'A human working alongside AI', isCorrect: false },
      { id: optId(), text: 'An agent that works continuously', isCorrect: false },
    ],
    explanation: 'Worker agents are specialized agents that receive and execute specific tasks from supervisor agents, focusing on particular types of work.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Hierarchical Orchestration',
    type: 'multiple-choice',
    question: 'What is hierarchical orchestration?',
    options: [
      { id: optId(), text: 'A multi-agent pattern with supervisor agents managing worker agents', isCorrect: true },
      { id: optId(), text: 'Organizing music in layers', isCorrect: false },
      { id: optId(), text: 'A corporate management structure', isCorrect: false },
      { id: optId(), text: 'Arranging servers in a data center', isCorrect: false },
    ],
    explanation: 'Hierarchical orchestration organizes agents in layers, where higher-level supervisors coordinate and delegate to lower-level workers.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Blackboard System',
    type: 'multiple-choice',
    question: 'What is a blackboard system in multi-agent AI?',
    options: [
      { id: optId(), text: 'A shared workspace where agents post and read information', isCorrect: true },
      { id: optId(), text: 'A visual display for agent outputs', isCorrect: false },
      { id: optId(), text: 'A classroom teaching tool', isCorrect: false },
      { id: optId(), text: 'A dark-themed user interface', isCorrect: false },
    ],
    explanation: 'A blackboard system is a shared memory space where multiple agents can post findings and read contributions from others, enabling indirect coordination.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Agent Mesh',
    type: 'multiple-choice',
    question: 'What is an agent mesh?',
    options: [
      { id: optId(), text: 'A network topology where agents can communicate peer-to-peer', isCorrect: true },
      { id: optId(), text: 'A physical network of AI hardware', isCorrect: false },
      { id: optId(), text: 'A 3D visualization of agents', isCorrect: false },
      { id: optId(), text: 'A filtering layer for agent outputs', isCorrect: false },
    ],
    explanation: 'An agent mesh is a decentralized network where agents can discover and communicate directly with each other without requiring a central coordinator.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Consensus Mechanism',
    type: 'multiple-choice',
    question: 'What is a consensus mechanism in multi-agent systems?',
    options: [
      { id: optId(), text: 'A method for agents to agree on decisions or shared state', isCorrect: true },
      { id: optId(), text: 'A voting system for users', isCorrect: false },
      { id: optId(), text: 'Agreement to terms of service', isCorrect: false },
      { id: optId(), text: 'A way to resolve merge conflicts', isCorrect: false },
    ],
    explanation: 'Consensus mechanisms enable multiple agents to reach agreement on shared decisions, resolving conflicts and coordinating action.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Multi-Agent Debate',
    type: 'multiple-choice',
    question: 'What is multi-agent debate?',
    options: [
      { id: optId(), text: 'Agents arguing different positions to reach better conclusions', isCorrect: true },
      { id: optId(), text: 'Users debating which AI to use', isCorrect: false },
      { id: optId(), text: 'A competitive game between AI systems', isCorrect: false },
      { id: optId(), text: 'Public discussions about AI ethics', isCorrect: false },
    ],
    explanation: 'Multi-agent debate has agents argue different perspectives or solutions, with the discourse helping identify flaws and reach better conclusions.',
    difficulty: 'intermediate',
  },
  {
    id: genId(),
    termName: 'Swarm Intelligence',
    type: 'multiple-choice',
    question: 'What is swarm intelligence?',
    options: [
      { id: optId(), text: 'Collective behavior emerging from many simple agents following local rules', isCorrect: true },
      { id: optId(), text: 'A large number of AI models running together', isCorrect: false },
      { id: optId(), text: 'Insects that have been trained by AI', isCorrect: false },
      { id: optId(), text: 'Overwhelming servers with requests', isCorrect: false },
    ],
    explanation: 'Swarm intelligence draws inspiration from biological swarms, where complex global behavior emerges from many simple agents following local rules.',
    difficulty: 'intermediate',
  },

  // ============================================
  // SAFETY & GOVERNANCE - ADDITIONAL
  // ============================================
  {
    id: genId(),
    termName: 'Trust Score',
    type: 'multiple-choice',
    question: 'What is a trust score in AI agent systems?',
    options: [
      { id: optId(), text: 'A numerical measure of how much an agent should be trusted for certain actions', isCorrect: true },
      { id: optId(), text: 'A rating given by users to AI responses', isCorrect: false },
      { id: optId(), text: 'The confidence level of model predictions', isCorrect: false },
      { id: optId(), text: 'A security clearance level', isCorrect: false },
    ],
    explanation: 'Trust scores quantify an agent\'s trustworthiness based on past behavior, attestations, and verification, determining what capabilities they can access.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Capability Gating',
    type: 'multiple-choice',
    question: 'What is capability gating?',
    options: [
      { id: optId(), text: 'Restricting agent access to tools or actions based on trust level', isCorrect: true },
      { id: optId(), text: 'Testing what AI models can do', isCorrect: false },
      { id: optId(), text: 'Limiting the size of AI models', isCorrect: false },
      { id: optId(), text: 'Controlling user access to AI features', isCorrect: false },
    ],
    explanation: 'Capability gating ensures agents can only access certain tools, APIs, or actions once they\'ve demonstrated sufficient trustworthiness.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Audit Trail',
    type: 'multiple-choice',
    question: 'What is an audit trail in AI systems?',
    options: [
      { id: optId(), text: 'A complete record of all agent actions and decisions for review', isCorrect: true },
      { id: optId(), text: 'A path through training data', isCorrect: false },
      { id: optId(), text: 'Financial records for AI projects', isCorrect: false },
      { id: optId(), text: 'A hiking trail near data centers', isCorrect: false },
    ],
    explanation: 'Audit trails provide complete, tamper-evident logs of agent actions, enabling accountability, debugging, and compliance verification.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Tripwire',
    type: 'multiple-choice',
    question: 'What is a tripwire in AI safety?',
    options: [
      { id: optId(), text: 'A monitoring trigger that alerts when specific conditions are detected', isCorrect: true },
      { id: optId(), text: 'A physical security measure', isCorrect: false },
      { id: optId(), text: 'A way to restart crashed agents', isCorrect: false },
      { id: optId(), text: 'A debugging breakpoint', isCorrect: false },
    ],
    explanation: 'Tripwires are monitoring conditions that trigger alerts or actions when specific patterns are detected, like attempts to bypass safety measures.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'RLAIF',
    type: 'multiple-choice',
    question: 'What does RLAIF stand for?',
    options: [
      { id: optId(), text: 'Reinforcement Learning from AI Feedback', isCorrect: true },
      { id: optId(), text: 'Rapid Learning AI Framework', isCorrect: false },
      { id: optId(), text: 'Recursive Learning Algorithm Interface', isCorrect: false },
      { id: optId(), text: 'Real-time Learning AI Functions', isCorrect: false },
    ],
    explanation: 'RLAIF uses AI-generated feedback (instead of human feedback) to train and align models, scaling the alignment process.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'AI Governance',
    type: 'multiple-choice',
    question: 'What does AI governance encompass?',
    options: [
      { id: optId(), text: 'Policies, processes, and oversight for responsible AI development and deployment', isCorrect: true },
      { id: optId(), text: 'Government regulations about AI', isCorrect: false },
      { id: optId(), text: 'AI making governance decisions', isCorrect: false },
      { id: optId(), text: 'Corporate leadership of AI companies', isCorrect: false },
    ],
    explanation: 'AI governance includes the frameworks, policies, and oversight mechanisms organizations use to ensure AI is developed and used responsibly.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Responsible AI',
    type: 'multiple-choice',
    question: 'What are key principles of Responsible AI?',
    options: [
      { id: optId(), text: 'Fairness, transparency, accountability, and safety in AI systems', isCorrect: true },
      { id: optId(), text: 'Making AI that follows orders', isCorrect: false },
      { id: optId(), text: 'AI that takes responsibility for errors', isCorrect: false },
      { id: optId(), text: 'Profitable AI development', isCorrect: false },
    ],
    explanation: 'Responsible AI emphasizes building AI systems that are fair, transparent, accountable, safe, and aligned with human values and societal benefit.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Model Cards',
    type: 'multiple-choice',
    question: 'What is a model card?',
    options: [
      { id: optId(), text: 'Documentation describing a model\'s capabilities, limitations, and appropriate uses', isCorrect: true },
      { id: optId(), text: 'A physical ID card for AI models', isCorrect: false },
      { id: optId(), text: 'A playing card game using AI', isCorrect: false },
      { id: optId(), text: 'A credit card for API usage', isCorrect: false },
    ],
    explanation: 'Model cards are standardized documentation that describes an AI model\'s intended use, performance characteristics, limitations, and ethical considerations.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'ATSF',
    type: 'multiple-choice',
    question: 'What is the ATSF in the context of AI agents?',
    options: [
      { id: optId(), text: 'Agent Trust Scoring Framework - a system for evaluating agent trustworthiness', isCorrect: true },
      { id: optId(), text: 'Automated Testing Software Framework', isCorrect: false },
      { id: optId(), text: 'Advanced Training System Fundamentals', isCorrect: false },
      { id: optId(), text: 'AI Task Scheduling Framework', isCorrect: false },
    ],
    explanation: 'ATSF (Agent Trust Scoring Framework) provides a structured approach to evaluating and scoring the trustworthiness of AI agents based on their behavior and attestations.',
    difficulty: 'expert',
  },

  // ============================================
  // PRODUCTION DEPLOYMENT - ADDITIONAL
  // ============================================
  {
    id: genId(),
    termName: 'Model Distillation',
    type: 'multiple-choice',
    question: 'What is model distillation?',
    options: [
      { id: optId(), text: 'Training a smaller model to mimic a larger model\'s behavior', isCorrect: true },
      { id: optId(), text: 'Extracting pure data from models', isCorrect: false },
      { id: optId(), text: 'Removing impurities from training data', isCorrect: false },
      { id: optId(), text: 'Converting models to liquid form', isCorrect: false },
    ],
    explanation: 'Model distillation trains a smaller, faster "student" model to replicate the outputs of a larger "teacher" model, reducing size while preserving capability.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'vLLM',
    type: 'multiple-choice',
    question: 'What is vLLM known for?',
    options: [
      { id: optId(), text: 'High-throughput LLM serving with efficient memory management', isCorrect: true },
      { id: optId(), text: 'A virtual LLM that runs in browsers', isCorrect: false },
      { id: optId(), text: 'A visual interface for LLMs', isCorrect: false },
      { id: optId(), text: 'A very large language model', isCorrect: false },
    ],
    explanation: 'vLLM is an open-source LLM serving engine known for PagedAttention, which dramatically improves memory efficiency and throughput.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'TGI',
    type: 'multiple-choice',
    question: 'What is TGI (Text Generation Inference)?',
    options: [
      { id: optId(), text: 'Hugging Face\'s toolkit for deploying and serving LLMs', isCorrect: true },
      { id: optId(), text: 'A text-to-image generation tool', isCorrect: false },
      { id: optId(), text: 'A testing framework for generative AI', isCorrect: false },
      { id: optId(), text: 'A text grammar interface', isCorrect: false },
    ],
    explanation: 'TGI is Hugging Face\'s production-ready solution for serving text generation models with features like tensor parallelism and dynamic batching.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Caching',
    type: 'multiple-choice',
    question: 'How does caching help AI applications?',
    options: [
      { id: optId(), text: 'Stores previous responses to avoid redundant API calls and reduce costs', isCorrect: true },
      { id: optId(), text: 'Hides AI responses from users', isCorrect: false },
      { id: optId(), text: 'Speeds up model training', isCorrect: false },
      { id: optId(), text: 'Protects sensitive data', isCorrect: false },
    ],
    explanation: 'Caching stores responses for repeated or similar queries, reducing API costs, latency, and load on the inference infrastructure.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Prompt Compression',
    type: 'multiple-choice',
    question: 'What is prompt compression?',
    options: [
      { id: optId(), text: 'Reducing prompt length while preserving meaning to save tokens and cost', isCorrect: true },
      { id: optId(), text: 'Compressing files attached to prompts', isCorrect: false },
      { id: optId(), text: 'Making prompts harder to read', isCorrect: false },
      { id: optId(), text: 'Storing prompts in compressed format', isCorrect: false },
    ],
    explanation: 'Prompt compression reduces input length through summarization or encoding, lowering costs and fitting more context within token limits.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'KV Cache',
    type: 'multiple-choice',
    question: 'What is a KV cache in LLM inference?',
    options: [
      { id: optId(), text: 'Storing key-value pairs from attention to avoid recomputation', isCorrect: true },
      { id: optId(), text: 'A database for storing prompts', isCorrect: false },
      { id: optId(), text: 'Keyboard and voice cache', isCorrect: false },
      { id: optId(), text: 'A general-purpose key-value store', isCorrect: false },
    ],
    explanation: 'The KV cache stores computed key and value tensors from attention layers, avoiding redundant computation when generating each new token.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Tensor Parallelism',
    type: 'multiple-choice',
    question: 'What is tensor parallelism?',
    options: [
      { id: optId(), text: 'Splitting model layers across multiple GPUs to handle large models', isCorrect: true },
      { id: optId(), text: 'Running multiple models at the same time', isCorrect: false },
      { id: optId(), text: 'Parallel processing of multiple prompts', isCorrect: false },
      { id: optId(), text: 'A type of multi-threading', isCorrect: false },
    ],
    explanation: 'Tensor parallelism distributes individual layer computations across multiple GPUs, enabling inference of models too large for a single GPU.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Model Sharding',
    type: 'multiple-choice',
    question: 'What is model sharding?',
    options: [
      { id: optId(), text: 'Splitting a model across multiple devices or machines', isCorrect: true },
      { id: optId(), text: 'Breaking a model into smaller independent models', isCorrect: false },
      { id: optId(), text: 'Sharing models between users', isCorrect: false },
      { id: optId(), text: 'Fragmenting model weights for security', isCorrect: false },
    ],
    explanation: 'Model sharding distributes model parameters across multiple devices, enabling deployment of models larger than any single device\'s memory.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Speculative Decoding',
    type: 'multiple-choice',
    question: 'What is speculative decoding?',
    options: [
      { id: optId(), text: 'Using a small model to draft tokens that a large model then verifies', isCorrect: true },
      { id: optId(), text: 'Guessing what users will type next', isCorrect: false },
      { id: optId(), text: 'Predicting future market trends', isCorrect: false },
      { id: optId(), text: 'Generating multiple possible responses', isCorrect: false },
    ],
    explanation: 'Speculative decoding accelerates inference by having a fast draft model propose tokens that the main model verifies in parallel batches.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Tracing',
    type: 'multiple-choice',
    question: 'What is tracing in AI applications?',
    options: [
      { id: optId(), text: 'Recording the flow of requests through the system for debugging', isCorrect: true },
      { id: optId(), text: 'Drawing outlines around detected objects', isCorrect: false },
      { id: optId(), text: 'Copying model architectures', isCorrect: false },
      { id: optId(), text: 'Tracking user locations', isCorrect: false },
    ],
    explanation: 'Tracing captures the journey of requests through an AI system, including all LLM calls, tool uses, and intermediate steps for debugging and monitoring.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Cost Optimization',
    type: 'multiple-choice',
    question: 'What are common AI cost optimization strategies?',
    options: [
      { id: optId(), text: 'Caching, smaller models, batching, and prompt compression', isCorrect: true },
      { id: optId(), text: 'Using free AI services only', isCorrect: false },
      { id: optId(), text: 'Reducing the quality of responses', isCorrect: false },
      { id: optId(), text: 'Limiting users to one request per day', isCorrect: false },
    ],
    explanation: 'Cost optimization combines techniques like caching, using appropriately-sized models, batching requests, and compressing prompts to reduce API costs.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Rate Limiting',
    type: 'multiple-choice',
    question: 'Why is rate limiting important in AI applications?',
    options: [
      { id: optId(), text: 'Controls costs and prevents abuse by limiting request frequency', isCorrect: true },
      { id: optId(), text: 'Limits how fast AI can think', isCorrect: false },
      { id: optId(), text: 'Reduces the quality of responses', isCorrect: false },
      { id: optId(), text: 'Slows down model training', isCorrect: false },
    ],
    explanation: 'Rate limiting controls how many requests users or systems can make, preventing runaway costs, ensuring fair access, and protecting against abuse.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Throughput',
    type: 'multiple-choice',
    question: 'What does throughput measure in AI systems?',
    options: [
      { id: optId(), text: 'The number of requests or tokens processed per unit time', isCorrect: true },
      { id: optId(), text: 'How much data flows through network cables', isCorrect: false },
      { id: optId(), text: 'The accuracy of model predictions', isCorrect: false },
      { id: optId(), text: 'User satisfaction rates', isCorrect: false },
    ],
    explanation: 'Throughput measures system capacity - typically requests per second or tokens per second - indicating how much work the system can handle.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Edge Deployment',
    type: 'multiple-choice',
    question: 'What is edge deployment for AI?',
    options: [
      { id: optId(), text: 'Running AI models on local devices rather than cloud servers', isCorrect: true },
      { id: optId(), text: 'Deploying AI at the edge of networks for routing', isCorrect: false },
      { id: optId(), text: 'Testing AI in extreme conditions', isCorrect: false },
      { id: optId(), text: 'Running AI near physical edges of buildings', isCorrect: false },
    ],
    explanation: 'Edge deployment runs AI models directly on user devices (phones, laptops, IoT) rather than in the cloud, enabling offline use and privacy.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Ollama',
    type: 'multiple-choice',
    question: 'What is Ollama?',
    options: [
      { id: optId(), text: 'A tool for running LLMs locally on your computer', isCorrect: true },
      { id: optId(), text: 'A cloud-based AI service', isCorrect: false },
      { id: optId(), text: 'A new type of language model', isCorrect: false },
      { id: optId(), text: 'An AI mascot character', isCorrect: false },
    ],
    explanation: 'Ollama makes it easy to run open-source LLMs locally, providing a simple interface for downloading and running models like Llama, Mistral, and others.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'LM Studio',
    type: 'multiple-choice',
    question: 'What is LM Studio?',
    options: [
      { id: optId(), text: 'A desktop app for discovering and running local LLMs with a GUI', isCorrect: true },
      { id: optId(), text: 'A recording studio for AI voice', isCorrect: false },
      { id: optId(), text: 'A cloud platform for model training', isCorrect: false },
      { id: optId(), text: 'An IDE for developing AI models', isCorrect: false },
    ],
    explanation: 'LM Studio is a user-friendly desktop application for downloading, running, and chatting with open-source LLMs locally without coding.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'GGUF',
    type: 'multiple-choice',
    question: 'What is GGUF?',
    options: [
      { id: optId(), text: 'A file format for efficiently storing and loading quantized LLMs', isCorrect: true },
      { id: optId(), text: 'A new type of neural network', isCorrect: false },
      { id: optId(), text: 'A GPU manufacturer', isCorrect: false },
      { id: optId(), text: 'A training framework', isCorrect: false },
    ],
    explanation: 'GGUF (GPT-Generated Unified Format) is a binary format for storing quantized models, optimized for efficient loading and inference on consumer hardware.',
    difficulty: 'advanced',
  },

  // ============================================
  // EVALUATION & TESTING - ADDITIONAL
  // ============================================
  {
    id: genId(),
    termName: 'Perplexity',
    type: 'multiple-choice',
    question: 'What does perplexity measure in language models?',
    options: [
      { id: optId(), text: 'How surprised the model is by the test data - lower is better', isCorrect: true },
      { id: optId(), text: 'How confused users are by responses', isCorrect: false },
      { id: optId(), text: 'The complexity of the model architecture', isCorrect: false },
      { id: optId(), text: 'How puzzling the training data is', isCorrect: false },
    ],
    explanation: 'Perplexity measures how well a model predicts text - lower perplexity means the model is less "surprised" by the data, indicating better language modeling.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'BLEU Score',
    type: 'multiple-choice',
    question: 'What is BLEU score used for?',
    options: [
      { id: optId(), text: 'Measuring how similar generated text is to reference text', isCorrect: true },
      { id: optId(), text: 'Rating the color quality of generated images', isCorrect: false },
      { id: optId(), text: 'Scoring the emotional tone of text', isCorrect: false },
      { id: optId(), text: 'Measuring API response times', isCorrect: false },
    ],
    explanation: 'BLEU (Bilingual Evaluation Understudy) measures n-gram overlap between generated and reference text, commonly used for translation and text generation quality.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'HumanEval',
    type: 'multiple-choice',
    question: 'What does HumanEval benchmark test?',
    options: [
      { id: optId(), text: 'AI ability to generate correct code from docstrings', isCorrect: true },
      { id: optId(), text: 'Human evaluation of AI responses', isCorrect: false },
      { id: optId(), text: 'AI understanding of human emotions', isCorrect: false },
      { id: optId(), text: 'Human-like conversation abilities', isCorrect: false },
    ],
    explanation: 'HumanEval tests code generation ability by giving models function signatures and docstrings, then checking if generated code passes unit tests.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'SWE-Bench',
    type: 'multiple-choice',
    question: 'What does SWE-Bench evaluate?',
    options: [
      { id: optId(), text: 'AI ability to solve real-world GitHub issues from popular repositories', isCorrect: true },
      { id: optId(), text: 'Software engineering interview performance', isCorrect: false },
      { id: optId(), text: 'AI coding speed', isCorrect: false },
      { id: optId(), text: 'Website performance benchmarks', isCorrect: false },
    ],
    explanation: 'SWE-Bench tests AI on real GitHub issues, requiring models to understand codebases and generate patches that pass the project\'s test suite.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'GAIA',
    type: 'multiple-choice',
    question: 'What does the GAIA benchmark assess?',
    options: [
      { id: optId(), text: 'AI assistant abilities requiring multi-step reasoning and tool use', isCorrect: true },
      { id: optId(), text: 'Global AI adoption rates', isCorrect: false },
      { id: optId(), text: 'Environmental impact of AI', isCorrect: false },
      { id: optId(), text: 'Geographic AI distribution', isCorrect: false },
    ],
    explanation: 'GAIA (General AI Assistants) evaluates AI assistants on real-world tasks requiring web browsing, file handling, and multi-step reasoning.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'AgentBench',
    type: 'multiple-choice',
    question: 'What is AgentBench designed to evaluate?',
    options: [
      { id: optId(), text: 'LLM performance as autonomous agents in interactive environments', isCorrect: true },
      { id: optId(), text: 'Human agent customer service quality', isCorrect: false },
      { id: optId(), text: 'Real estate agent AI tools', isCorrect: false },
      { id: optId(), text: 'Sports agent negotiation skills', isCorrect: false },
    ],
    explanation: 'AgentBench evaluates LLMs as agents across diverse environments like operating systems, databases, web browsing, and games.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Evals',
    type: 'multiple-choice',
    question: 'What are "evals" in AI development?',
    options: [
      { id: optId(), text: 'Systematic tests to measure AI model performance on specific tasks', isCorrect: true },
      { id: optId(), text: 'Employee evaluations at AI companies', isCorrect: false },
      { id: optId(), text: 'Economic value assessments', isCorrect: false },
      { id: optId(), text: 'Event logging systems', isCorrect: false },
    ],
    explanation: 'Evals (evaluations) are structured tests that measure how well AI models perform on specific capabilities, tasks, or safety properties.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'A/B Testing',
    type: 'multiple-choice',
    question: 'How is A/B testing used in AI applications?',
    options: [
      { id: optId(), text: 'Comparing two versions to see which performs better with real users', isCorrect: true },
      { id: optId(), text: 'Testing models A and B from different companies', isCorrect: false },
      { id: optId(), text: 'Grading AI responses as A or B', isCorrect: false },
      { id: optId(), text: 'Alternating between two training methods', isCorrect: false },
    ],
    explanation: 'A/B testing splits users between two variants (like different prompts or models) to measure which performs better on real-world metrics.',
    difficulty: 'advanced',
  },
  {
    id: genId(),
    termName: 'Regression Testing',
    type: 'multiple-choice',
    question: 'Why is regression testing important for AI systems?',
    options: [
      { id: optId(), text: 'Ensures changes don\'t break previously working capabilities', isCorrect: true },
      { id: optId(), text: 'Tests for statistical regression in data', isCorrect: false },
      { id: optId(), text: 'Checks for declining performance over time', isCorrect: false },
      { id: optId(), text: 'Validates backward compatibility', isCorrect: false },
    ],
    explanation: 'Regression testing runs a suite of tests after changes to verify that existing functionality still works, catching unintended side effects.',
    difficulty: 'advanced',
  },

  // ============================================
  // ML DEEP DIVE - ADDITIONAL EXPERT
  // ============================================
  {
    id: genId(),
    termName: 'Loss Function',
    type: 'multiple-choice',
    question: 'What role does a loss function play in training?',
    options: [
      { id: optId(), text: 'Measures how wrong the model\'s predictions are, guiding learning', isCorrect: true },
      { id: optId(), text: 'Tracks data loss during transmission', isCorrect: false },
      { id: optId(), text: 'Calculates financial losses from errors', isCorrect: false },
      { id: optId(), text: 'Determines when to stop training', isCorrect: false },
    ],
    explanation: 'The loss function quantifies prediction errors, providing the signal that gradient descent uses to update model weights during training.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Self-Attention',
    type: 'multiple-choice',
    question: 'What makes self-attention "self"?',
    options: [
      { id: optId(), text: 'Each position attends to all other positions in the same sequence', isCorrect: true },
      { id: optId(), text: 'The model trains itself without supervision', isCorrect: false },
      { id: optId(), text: 'It automatically adjusts its own parameters', isCorrect: false },
      { id: optId(), text: 'It only pays attention to itself', isCorrect: false },
    ],
    explanation: 'Self-attention has each token in a sequence attend to every other token in that same sequence, enabling modeling of long-range dependencies.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Pre-Training',
    type: 'multiple-choice',
    question: 'What happens during pre-training of LLMs?',
    options: [
      { id: optId(), text: 'The model learns general language patterns from massive text datasets', isCorrect: true },
      { id: optId(), text: 'Preparing the hardware for training', isCorrect: false },
      { id: optId(), text: 'Testing the model before real training begins', isCorrect: false },
      { id: optId(), text: 'Setting up the training environment', isCorrect: false },
    ],
    explanation: 'Pre-training exposes the model to vast amounts of text to learn general language understanding before fine-tuning on specific tasks.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Fine-Tuning',
    type: 'multiple-choice',
    question: 'What is fine-tuning in machine learning?',
    options: [
      { id: optId(), text: 'Further training a pre-trained model on task-specific data', isCorrect: true },
      { id: optId(), text: 'Adjusting hyperparameters during training', isCorrect: false },
      { id: optId(), text: 'Making small improvements to model architecture', isCorrect: false },
      { id: optId(), text: 'Final quality checks before deployment', isCorrect: false },
    ],
    explanation: 'Fine-tuning adapts a pre-trained model to specific tasks or domains by continuing training on relevant, often smaller, datasets.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Regularization',
    type: 'multiple-choice',
    question: 'What is the purpose of regularization in training?',
    options: [
      { id: optId(), text: 'Preventing overfitting by adding constraints or penalties', isCorrect: true },
      { id: optId(), text: 'Making training more regular and consistent', isCorrect: false },
      { id: optId(), text: 'Ensuring compliance with regulations', isCorrect: false },
      { id: optId(), text: 'Standardizing data formats', isCorrect: false },
    ],
    explanation: 'Regularization techniques (like dropout, weight decay) add constraints during training to prevent overfitting and improve generalization.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Catastrophic Forgetting',
    type: 'multiple-choice',
    question: 'What is catastrophic forgetting?',
    options: [
      { id: optId(), text: 'When learning new tasks causes the model to forget previously learned ones', isCorrect: true },
      { id: optId(), text: 'A system crash that loses all data', isCorrect: false },
      { id: optId(), text: 'Users forgetting how to use the AI', isCorrect: false },
      { id: optId(), text: 'Losing training data during power outages', isCorrect: false },
    ],
    explanation: 'Catastrophic forgetting occurs when training on new data overwrites the model\'s knowledge of previous tasks, a challenge for continual learning.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Multimodal',
    type: 'multiple-choice',
    question: 'What is a multimodal AI model?',
    options: [
      { id: optId(), text: 'A model that can process multiple types of input like text, images, and audio', isCorrect: true },
      { id: optId(), text: 'A model that works in multiple languages', isCorrect: false },
      { id: optId(), text: 'A model with multiple different modes of operation', isCorrect: false },
      { id: optId(), text: 'A model that can be deployed in multiple ways', isCorrect: false },
    ],
    explanation: 'Multimodal models can understand and generate across multiple data types (modalities) like text, images, audio, and video.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'In-Context Learning',
    type: 'multiple-choice',
    question: 'What is in-context learning?',
    options: [
      { id: optId(), text: 'Learning from examples provided in the prompt without weight updates', isCorrect: true },
      { id: optId(), text: 'Learning about the context of a conversation', isCorrect: false },
      { id: optId(), text: 'Training within a specific application context', isCorrect: false },
      { id: optId(), text: 'Understanding contextual clues in text', isCorrect: false },
    ],
    explanation: 'In-context learning is when LLMs adapt to new tasks using examples in the prompt, without any parameter updates - an emergent capability of large models.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Transfer Learning',
    type: 'multiple-choice',
    question: 'What is transfer learning?',
    options: [
      { id: optId(), text: 'Applying knowledge learned on one task to a different but related task', isCorrect: true },
      { id: optId(), text: 'Moving models between different computers', isCorrect: false },
      { id: optId(), text: 'Transferring data between training sessions', isCorrect: false },
      { id: optId(), text: 'Converting models between frameworks', isCorrect: false },
    ],
    explanation: 'Transfer learning reuses knowledge from a model trained on one task (or dataset) to improve learning on a related task, reducing data and compute needs.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Meta-Learning',
    type: 'multiple-choice',
    question: 'What is meta-learning?',
    options: [
      { id: optId(), text: 'Learning to learn - training models to quickly adapt to new tasks', isCorrect: true },
      { id: optId(), text: 'Learning about Meta\'s AI systems', isCorrect: false },
      { id: optId(), text: 'High-level learning strategies', isCorrect: false },
      { id: optId(), text: 'Learning metadata about datasets', isCorrect: false },
    ],
    explanation: 'Meta-learning trains models to learn efficiently from limited data by learning good learning algorithms or initializations across many tasks.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Continual Learning',
    type: 'multiple-choice',
    question: 'What is continual learning?',
    options: [
      { id: optId(), text: 'Training models to learn new tasks while retaining old knowledge', isCorrect: true },
      { id: optId(), text: 'Continuous 24/7 model training', isCorrect: false },
      { id: optId(), text: 'Ongoing user education programs', isCorrect: false },
      { id: optId(), text: 'Regular model updates', isCorrect: false },
    ],
    explanation: 'Continual learning addresses how models can learn sequentially over time without catastrophically forgetting previously learned tasks.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Active Learning',
    type: 'multiple-choice',
    question: 'What is active learning?',
    options: [
      { id: optId(), text: 'The model selects which examples it wants labeled to learn efficiently', isCorrect: true },
      { id: optId(), text: 'Users actively interacting with the model during training', isCorrect: false },
      { id: optId(), text: 'Training while the model is deployed', isCorrect: false },
      { id: optId(), text: 'High-intensity training sessions', isCorrect: false },
    ],
    explanation: 'Active learning lets models identify the most informative examples to be labeled, reducing annotation costs while improving learning efficiency.',
    difficulty: 'expert',
  },

  // ============================================
  // ALIGNMENT & SAFETY - ADDITIONAL EXPERT
  // ============================================
  {
    id: genId(),
    termName: 'Value Lock-In',
    type: 'multiple-choice',
    question: 'What is value lock-in in AI alignment?',
    options: [
      { id: optId(), text: 'The risk of permanently encoding specific values that may later prove wrong', isCorrect: true },
      { id: optId(), text: 'Locking AI systems to prevent changes', isCorrect: false },
      { id: optId(), text: 'Securing valuable AI models', isCorrect: false },
      { id: optId(), text: 'Fixing the economic value of AI systems', isCorrect: false },
    ],
    explanation: 'Value lock-in is the concern that powerful AI might permanently embed particular values or goals, preventing future course correction.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Alignment Tax',
    type: 'multiple-choice',
    question: 'What is the alignment tax?',
    options: [
      { id: optId(), text: 'The cost in capabilities or resources to make AI systems safer', isCorrect: true },
      { id: optId(), text: 'Government taxes on AI development', isCorrect: false },
      { id: optId(), text: 'Fees for using aligned AI models', isCorrect: false },
      { id: optId(), text: 'The cost of regulatory compliance', isCorrect: false },
    ],
    explanation: 'Alignment tax refers to any reduction in AI capabilities or increase in costs that results from implementing safety measures.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Self-Improvement',
    type: 'multiple-choice',
    question: 'Why is AI self-improvement a safety concern?',
    options: [
      { id: optId(), text: 'An AI improving itself could rapidly become uncontrollable', isCorrect: true },
      { id: optId(), text: 'It might improve itself instead of helping users', isCorrect: false },
      { id: optId(), text: 'Self-improvement is wasteful of compute', isCorrect: false },
      { id: optId(), text: 'It could create too many copies of itself', isCorrect: false },
    ],
    explanation: 'Recursive self-improvement could lead to rapid capability gains that outpace human ability to maintain oversight and control.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Explainability',
    type: 'multiple-choice',
    question: 'What is explainability in AI?',
    options: [
      { id: optId(), text: 'The ability to understand and describe why an AI made a specific decision', isCorrect: true },
      { id: optId(), text: 'AI explaining concepts to users', isCorrect: false },
      { id: optId(), text: 'Documentation of how to use AI systems', isCorrect: false },
      { id: optId(), text: 'Marketing descriptions of AI capabilities', isCorrect: false },
    ],
    explanation: 'Explainability aims to make AI decision-making transparent and understandable to humans, crucial for trust and accountability.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'Interpretability',
    type: 'multiple-choice',
    question: 'How does interpretability differ from explainability?',
    options: [
      { id: optId(), text: 'Interpretability focuses on understanding internal model mechanisms', isCorrect: true },
      { id: optId(), text: 'Interpretability is for non-technical audiences', isCorrect: false },
      { id: optId(), text: 'They are the same thing', isCorrect: false },
      { id: optId(), text: 'Interpretability is about translating AI responses', isCorrect: false },
    ],
    explanation: 'While explainability describes why decisions are made, interpretability dives into understanding the internal workings and representations of models.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'AI Bias',
    type: 'multiple-choice',
    question: 'What causes AI bias?',
    options: [
      { id: optId(), text: 'Biases in training data, model design, or deployment contexts', isCorrect: true },
      { id: optId(), text: 'AI naturally developing prejudices', isCorrect: false },
      { id: optId(), text: 'Intentional programming of biases', isCorrect: false },
      { id: optId(), text: 'Hardware manufacturing defects', isCorrect: false },
    ],
    explanation: 'AI bias typically stems from unrepresentative training data, flawed labeling, or biased problem formulation, leading to unfair outcomes for certain groups.',
    difficulty: 'expert',
  },

  // ============================================
  // PROTOCOLS & STANDARDS - ADDITIONAL
  // ============================================
  {
    id: genId(),
    termName: 'OpenAPI',
    type: 'multiple-choice',
    question: 'How is OpenAPI used with AI agents?',
    options: [
      { id: optId(), text: 'Describes APIs that agents can call, enabling automatic tool discovery', isCorrect: true },
      { id: optId(), text: 'An open-source AI model', isCorrect: false },
      { id: optId(), text: 'A competitor to OpenAI', isCorrect: false },
      { id: optId(), text: 'An open API for training models', isCorrect: false },
    ],
    explanation: 'OpenAPI specifications describe REST APIs in a machine-readable format, allowing AI agents to understand and use external services automatically.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'WebSocket',
    type: 'multiple-choice',
    question: 'Why are WebSockets useful for AI applications?',
    options: [
      { id: optId(), text: 'Enable bidirectional real-time communication for streaming and agent interactions', isCorrect: true },
      { id: optId(), text: 'They are faster than regular internet', isCorrect: false },
      { id: optId(), text: 'They provide better security', isCorrect: false },
      { id: optId(), text: 'They reduce API costs', isCorrect: false },
    ],
    explanation: 'WebSockets provide persistent bidirectional connections, ideal for streaming AI responses and enabling real-time agent communication.',
    difficulty: 'expert',
  },
  {
    id: genId(),
    termName: 'OAuth 2.0',
    type: 'multiple-choice',
    question: 'How does OAuth 2.0 apply to AI agents?',
    options: [
      { id: optId(), text: 'Enables agents to access resources on behalf of users with proper authorization', isCorrect: true },
      { id: optId(), text: 'A method for training AI models', isCorrect: false },
      { id: optId(), text: 'An AI-specific authentication protocol', isCorrect: false },
      { id: optId(), text: 'A way to authenticate AI models themselves', isCorrect: false },
    ],
    explanation: 'OAuth 2.0 allows AI agents to act on behalf of users to access protected resources (like emails, calendars) with proper authorization.',
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
