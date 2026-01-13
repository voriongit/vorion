import type { LexiconTerm } from '@/types';

/**
 * Static lexicon data - the local knowledge base
 * This is the primary data source before external API calls
 *
 * Categories:
 * - core: Fundamental concepts everyone should know
 * - architecture: System design and components
 * - protocols: Standards and communication patterns
 * - orchestration: Multi-agent coordination
 * - safety: Security, alignment, and governance
 * - techniques: Prompting and reasoning methods
 * - evolution: Learning and adaptation
 * - prompting: Prompt engineering techniques
 * - frameworks: Agent frameworks and libraries
 * - evaluation: Testing, benchmarking, and metrics
 * - enterprise: Production deployment concepts
 * - ethics: AI ethics and alignment
 * - ml-fundamentals: Machine learning basics
 * - nlp: Natural language processing
 * - infrastructure: Compute and deployment
 */
export const staticLexicon: LexiconTerm[] = [
  // ============================================
  // CORE CONCEPTS
  // ============================================
  {
    term: 'Agent',
    definition: 'An autonomous AI system capable of perceiving its environment, making decisions, and taking actions to achieve specified goals. Modern AI agents typically combine large language models with tool access and memory systems.',
    level: 'novice',
    category: 'core',
    tags: ['fundamentals', 'autonomy'],
    slug: 'agent',
    overview: `An AI agent is more than just a chatbot—it's a system designed to accomplish tasks autonomously. While a traditional chatbot responds to individual messages, an agent maintains context, uses tools, and works toward goals across multiple steps.

Think of the difference between asking someone a question versus hiring them to complete a project. A chatbot answers your question; an agent takes on the project and figures out what steps are needed to complete it.

Modern agents are built on large language models (LLMs) but add crucial capabilities: memory to remember past interactions, tools to interact with external systems, and planning abilities to break down complex tasks.`,
    keyConcepts: [
      {
        title: 'Perception',
        description: 'The ability to receive and interpret input from the environment—user messages, API responses, sensor data, or file contents.',
      },
      {
        title: 'Reasoning',
        description: 'Using the LLM to analyze situations, plan approaches, and make decisions about what actions to take.',
      },
      {
        title: 'Action',
        description: 'Executing operations in the real world through tools, APIs, or other interfaces.',
      },
      {
        title: 'Memory',
        description: 'Retaining information across interactions to maintain context and learn from experience.',
      },
    ],
    examples: [
      {
        language: 'python',
        title: 'Simple Agent Loop',
        code: `from openai import OpenAI

client = OpenAI()

def run_agent(task: str):
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": task}
    ]

    while True:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=messages
        )

        assistant_message = response.choices[0].message

        # Check if agent wants to use a tool
        if assistant_message.tool_calls:
            # Execute tools and continue
            tool_results = execute_tools(assistant_message.tool_calls)
            messages.append(assistant_message)
            messages.extend(tool_results)
        else:
            # Agent is done
            return assistant_message.content`,
        explanation: 'This shows the basic agent loop: receive input, reason about it, optionally use tools, and either continue or return a result.',
      },
    ],
    useCases: [
      'Customer service agents that can look up orders, process returns, and escalate to humans when needed',
      'Research assistants that search databases, synthesize information, and write reports',
      'DevOps agents that monitor systems, diagnose issues, and execute fixes',
      'Personal assistants that manage calendars, send emails, and coordinate tasks',
    ],
    commonMistakes: [
      'Giving agents too much autonomy without proper guardrails and human oversight',
      'Not implementing proper error handling for when tools fail',
      'Ignoring cost implications of long-running agent loops',
      'Failing to log agent actions for debugging and audit purposes',
    ],
    practicalTips: [
      'Start with narrow, well-defined tasks before expanding agent capabilities',
      'Always implement a maximum iteration limit to prevent runaway loops',
      'Use structured outputs to make tool calls more reliable',
      'Build in human-in-the-loop checkpoints for high-stakes decisions',
    ],
    relatedTerms: ['Agentic AI', 'Tool Use', 'ReAct', 'Planning', 'Memory Systems'],
    furtherReading: [
      { title: 'Building Effective Agents - Anthropic', url: 'https://docs.anthropic.com/en/docs/build-with-claude/agents' },
      { title: 'LangChain Agents Documentation', url: 'https://python.langchain.com/docs/modules/agents/' },
    ],
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
    definition: 'Large Language Model - A neural network trained on vast text corpora, capable of understanding and generating human language. Forms the cognitive core of most modern AI agents. Examples include GPT-4, Claude, Gemini, and Llama.',
    level: 'novice',
    category: 'core',
    tags: ['models', 'fundamentals'],
    slug: 'llm',
    overview: `Large Language Models (LLMs) are neural networks trained on massive amounts of text data—books, websites, code, and documents. Through this training, they learn patterns in language: grammar, facts, reasoning styles, and even coding conventions.

What makes LLMs special is their generality. Unlike traditional software that does one thing well, an LLM can write poetry, debug code, explain physics, and draft emails—all with the same model. This flexibility comes from learning to predict "what text comes next" at an enormous scale.

LLMs don't truly "understand" in the human sense, but they're remarkably good at producing coherent, useful outputs. They're statistical engines that have absorbed so much human knowledge that they can appear intelligent. This distinction matters when building systems—know your tool's limitations.`,
    keyConcepts: [
      {
        title: 'Parameters',
        description: 'The learned weights in the neural network. More parameters generally means more capability but also more compute cost. GPT-4 has hundreds of billions of parameters.',
      },
      {
        title: 'Training Data',
        description: 'The text corpus used to train the model. Quality and diversity of training data directly impacts model capabilities and biases.',
      },
      {
        title: 'Fine-tuning',
        description: 'Additional training on specific data to specialize the model for particular tasks or domains.',
      },
      {
        title: 'Inference',
        description: 'Running the trained model to generate outputs. This is what happens when you send a message to ChatGPT.',
      },
    ],
    examples: [
      {
        language: 'python',
        title: 'Calling an LLM API',
        code: `from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in simple terms."}
    ],
    temperature=0.7,  # Controls randomness
    max_tokens=500    # Limits response length
)

print(response.choices[0].message.content)`,
        explanation: 'This shows the basic pattern for calling an LLM: specify the model, provide messages, and configure parameters like temperature.',
      },
      {
        language: 'python',
        title: 'Using Anthropic Claude',
        code: `import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "What are the key differences between SQL and NoSQL databases?"}
    ]
)

print(message.content[0].text)`,
        explanation: 'Different providers have similar but slightly different APIs. The core concept—send messages, get responses—remains the same.',
      },
    ],
    useCases: [
      'Conversational AI and chatbots',
      'Code generation and debugging',
      'Content creation and summarization',
      'Translation and language tasks',
      'Analysis and reasoning tasks',
    ],
    commonMistakes: [
      'Treating LLM outputs as always factual—they can hallucinate confidently',
      'Ignoring context window limits and wondering why the model "forgets"',
      'Not considering cost—every token costs money at scale',
      'Assuming newer/bigger is always better for your specific use case',
    ],
    practicalTips: [
      'Choose models based on your specific task—smaller models can be faster and cheaper for simple tasks',
      'Always validate critical outputs with external sources',
      'Use temperature=0 for deterministic tasks, higher for creative ones',
      'Monitor token usage to control costs in production',
      'Consider open-source models (Llama, Mistral) for privacy-sensitive applications',
    ],
    relatedTerms: ['Foundation Model', 'Token', 'Inference', 'Context Window', 'Fine-tuning'],
    furtherReading: [
      { title: 'Anthropic Model Documentation', url: 'https://docs.anthropic.com/en/docs/models-overview' },
      { title: 'OpenAI Models Overview', url: 'https://platform.openai.com/docs/models' },
    ],
  },
  {
    term: 'Foundation Model',
    definition: 'A large AI model trained on broad data that can be adapted to many downstream tasks. Foundation models like GPT-4 or Claude serve as the base for specialized agents and applications.',
    level: 'novice',
    category: 'core',
    tags: ['models', 'fundamentals'],
  },
  {
    term: 'Inference',
    definition: 'The process of running a trained model to generate predictions or outputs. When you chat with an AI, each response is an inference. Inference costs (compute, latency) are a key consideration in agent design.',
    level: 'novice',
    category: 'core',
    tags: ['fundamentals', 'compute'],
  },
  {
    term: 'Context Window',
    definition: 'The maximum amount of text (measured in tokens) a model can process in a single inference. Larger context windows enable longer conversations and more complex reasoning. Modern models range from 8K to 2M+ tokens.',
    level: 'novice',
    category: 'core',
    tags: ['fundamentals', 'limitations'],
  },
  {
    term: 'Token',
    definition: 'The basic unit of text processing for LLMs. A token is typically 3-4 characters or roughly 0.75 words in English. Models have limits on input and output tokens, and pricing is often per-token.',
    level: 'novice',
    category: 'core',
    tags: ['fundamentals', 'nlp'],
  },
  {
    term: 'Prompt',
    definition: 'The input text given to an LLM to elicit a response. Prompts can include instructions, examples, context, and the actual query. The quality of the prompt significantly affects output quality.',
    level: 'novice',
    category: 'core',
    tags: ['fundamentals', 'prompting'],
    slug: 'prompt',
    overview: `A prompt is how you communicate with an AI model. It's your interface to unlock the model's capabilities. The same model can produce wildly different outputs depending on how you phrase your request.

Prompting is both an art and a science. Good prompts are clear, specific, and structured. They provide enough context for the model to understand what you want, without unnecessary noise.

Think of prompting like giving instructions to a very capable but literal assistant who has never worked for you before. You need to be explicit about your expectations, provide relevant background, and sometimes show examples of what you want.`,
    keyConcepts: [
      {
        title: 'System Prompt',
        description: 'Instructions that set the AI\'s behavior, persona, and constraints. Persists across the conversation and shapes all responses.',
      },
      {
        title: 'User Prompt',
        description: 'The actual request or question from the user. Can include context, examples, and specific instructions for that particular query.',
      },
      {
        title: 'Context',
        description: 'Background information provided to help the model understand the situation, including relevant data, previous decisions, or domain knowledge.',
      },
      {
        title: 'Output Format',
        description: 'Specification of how you want the response structured—JSON, markdown, bullet points, or a specific template.',
      },
    ],
    examples: [
      {
        language: 'text',
        title: 'Basic vs. Improved Prompt',
        code: `# Basic (vague)
Write about dogs.

# Improved (specific)
Write a 200-word introduction to Golden Retrievers for a pet adoption website.
Include: temperament, exercise needs, and family suitability.
Tone: warm and encouraging.`,
        explanation: 'The improved prompt specifies length, topic scope, required sections, and tone—giving the model clear direction.',
      },
      {
        language: 'text',
        title: 'Structured System Prompt',
        code: `You are a senior code reviewer at a tech company.

Your responsibilities:
- Review code for bugs, security issues, and best practices
- Provide specific, actionable feedback
- Explain WHY something is problematic, not just WHAT

Your constraints:
- Be constructive, not harsh
- Prioritize critical issues over style preferences
- Always suggest improvements, don't just criticize

Output format:
## Critical Issues
## Suggestions
## Positives`,
        explanation: 'A well-structured system prompt establishes role, responsibilities, constraints, and expected output format.',
      },
    ],
    useCases: [
      'Crafting system prompts for customer service chatbots',
      'Building prompts for code generation and review',
      'Designing prompts for content creation workflows',
      'Creating prompts for data extraction and analysis',
    ],
    commonMistakes: [
      'Being too vague—"make it better" gives the model no direction',
      'Overloading with contradictory instructions',
      'Forgetting to specify output format, leading to inconsistent results',
      'Not providing examples when the task is ambiguous',
      'Including irrelevant context that confuses the model',
    ],
    practicalTips: [
      'Start with the end in mind—know what output you want before writing the prompt',
      'Use delimiters (###, ```, ---) to separate different parts of your prompt',
      'Be explicit about what NOT to do, not just what to do',
      'Test your prompts with edge cases before deploying',
      'Version control your prompts like code—they\'re part of your system',
    ],
    relatedTerms: ['System Prompt', 'Few-Shot Learning', 'Chain-of-Thought', 'Prompt Engineering', 'Completion'],
    furtherReading: [
      { title: 'Prompt Engineering Guide - Anthropic', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering' },
      { title: 'OpenAI Prompt Engineering Guide', url: 'https://platform.openai.com/docs/guides/prompt-engineering' },
    ],
  },
  {
    term: 'Completion',
    definition: 'The output text generated by an LLM in response to a prompt. Also called a response or generation. The model predicts the most likely tokens to follow the input.',
    level: 'novice',
    category: 'core',
    tags: ['fundamentals', 'generation'],
  },
  {
    term: 'Hallucination',
    definition: 'When an LLM generates plausible-sounding but factually incorrect or nonsensical content. A major challenge in AI deployment, mitigated through grounding, retrieval, and verification.',
    level: 'novice',
    category: 'core',
    tags: ['limitations', 'safety'],
  },
  {
    term: 'Grounding',
    definition: 'Connecting AI outputs to verifiable sources of truth, such as databases, documents, or real-time data. Grounding reduces hallucinations and increases reliability.',
    level: 'intermediate',
    category: 'core',
    tags: ['reliability', 'rag'],
  },
  {
    term: 'Multimodal',
    definition: 'AI systems capable of processing multiple types of input (text, images, audio, video) and potentially generating multiple output types. GPT-4V, Gemini, and Claude 3 are multimodal models.',
    level: 'novice',
    category: 'core',
    tags: ['models', 'capabilities'],
  },
  {
    term: 'Embedding',
    definition: 'A dense vector representation of text, images, or other data that captures semantic meaning. Similar items have similar embeddings. Used for semantic search, clustering, and retrieval.',
    level: 'intermediate',
    category: 'core',
    tags: ['vectors', 'retrieval'],
  },
  {
    term: 'Vector Database',
    definition: 'A database optimized for storing and querying high-dimensional vectors (embeddings). Enables fast similarity search for RAG systems. Examples: Pinecone, Weaviate, Chroma, Milvus.',
    level: 'intermediate',
    category: 'core',
    tags: ['infrastructure', 'retrieval'],
  },
  {
    term: 'Latency',
    definition: 'The time delay between sending a request to an AI system and receiving a response. Critical for user experience and real-time applications. Measured in milliseconds or seconds.',
    level: 'novice',
    category: 'core',
    tags: ['performance', 'infrastructure'],
  },
  {
    term: 'Throughput',
    definition: 'The number of requests or tokens an AI system can process per unit time. Important for scaling agents to handle multiple concurrent users or tasks.',
    level: 'intermediate',
    category: 'core',
    tags: ['performance', 'infrastructure'],
  },

  // ============================================
  // ARCHITECTURE
  // ============================================
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
    slug: 'tool-use',
    overview: `Tool use transforms an LLM from a text generator into an agent that can take actions in the world. Without tools, an AI can only generate text. With tools, it can search the web, query databases, send emails, write files, and interact with any API.

The mechanism is elegant: you describe available tools to the LLM (name, description, parameters), and the model decides when to use them. Instead of generating a text response, it outputs a structured tool call. Your code executes the tool and feeds the result back to the model.

This pattern is incredibly powerful because it lets you combine the reasoning capabilities of LLMs with the precision of traditional software. The AI decides what to do; your code ensures it's done correctly.`,
    keyConcepts: [
      {
        title: 'Tool Definition',
        description: 'A schema describing what the tool does, what parameters it accepts, and what it returns. Good descriptions help the model use tools correctly.',
      },
      {
        title: 'Tool Call',
        description: 'The model\'s structured request to execute a tool with specific parameters. Usually JSON format.',
      },
      {
        title: 'Tool Result',
        description: 'The output from executing a tool, which gets fed back to the model for further reasoning.',
      },
      {
        title: 'Tool Selection',
        description: 'The model\'s decision about which tool to use (or whether to use any tool) based on the current task.',
      },
    ],
    examples: [
      {
        language: 'python',
        title: 'Defining and Using Tools',
        code: `from openai import OpenAI
import json

client = OpenAI()

# Define tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name, e.g., 'San Francisco'"
                    }
                },
                "required": ["location"]
            }
        }
    }
]

# Call model with tools
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
    tools=tools
)

# Handle tool call
if response.choices[0].message.tool_calls:
    tool_call = response.choices[0].message.tool_calls[0]
    args = json.loads(tool_call.function.arguments)
    result = get_weather(args["location"])  # Your function
    print(f"Weather result: {result}")`,
        explanation: 'This shows the complete flow: define a tool schema, let the model decide to call it, execute the function, and use the result.',
      },
      {
        language: 'python',
        title: 'Tool with Claude',
        code: `import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=[
        {
            "name": "search_database",
            "description": "Search the product database",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 10}
                },
                "required": ["query"]
            }
        }
    ],
    messages=[{"role": "user", "content": "Find laptops under $1000"}]
)`,
        explanation: 'Different APIs have slightly different schemas, but the pattern is the same: describe tools, let the model call them.',
      },
    ],
    useCases: [
      'Web search and browsing for up-to-date information',
      'Database queries for customer service and analytics',
      'File operations for code generation and document processing',
      'API calls to external services (email, calendar, CRM)',
      'System administration and DevOps automation',
    ],
    commonMistakes: [
      'Vague tool descriptions that confuse the model about when to use them',
      'Not validating tool inputs before execution',
      'Forgetting to handle errors when tools fail',
      'Creating too many similar tools that confuse tool selection',
      'Not including tool results in the conversation for follow-up reasoning',
    ],
    practicalTips: [
      'Write tool descriptions from the model\'s perspective—explain when and why to use each tool',
      'Use clear, distinct names that indicate the tool\'s purpose',
      'Include examples in descriptions for ambiguous parameters',
      'Validate all inputs before executing tools—never trust model outputs blindly',
      'Log all tool calls for debugging and monitoring',
    ],
    relatedTerms: ['Function Calling', 'Agent', 'MCP', 'API Gateway', 'ReAct'],
    furtherReading: [
      { title: 'Tool Use Guide - Anthropic', url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use' },
      { title: 'Function Calling - OpenAI', url: 'https://platform.openai.com/docs/guides/function-calling' },
    ],
  },
  {
    term: 'Function Calling',
    definition: 'A capability where LLMs can output structured JSON to invoke predefined functions. The model decides when to call functions and with what parameters. Key enabler of tool use.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['tools', 'api'],
  },
  {
    term: 'RAG',
    definition: 'Retrieval-Augmented Generation - A pattern where relevant documents are retrieved from a knowledge base and included in the prompt to ground LLM responses in factual content.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['retrieval', 'grounding'],
    slug: 'rag',
    overview: `Retrieval-Augmented Generation (RAG) solves one of the biggest challenges with LLMs: they only know what they were trained on. RAG lets you give an LLM access to your own documents, databases, and knowledge bases—without retraining the model.

The concept is simple: before asking the LLM to answer a question, first search your knowledge base for relevant information. Then include that information in the prompt. The LLM can now answer questions about your specific data, grounded in actual documents.

RAG has become the standard pattern for enterprise AI applications because it's cost-effective (no fine-tuning needed), transparent (you can see what sources were used), and flexible (update your knowledge base anytime).`,
    keyConcepts: [
      {
        title: 'Embedding',
        description: 'Converting text into numerical vectors that capture semantic meaning. Similar texts have similar embeddings, enabling semantic search.',
      },
      {
        title: 'Vector Database',
        description: 'A specialized database that stores embeddings and enables fast similarity search. Examples: Pinecone, Weaviate, Chroma.',
      },
      {
        title: 'Chunking',
        description: 'Breaking documents into smaller pieces for embedding. Chunk size affects retrieval quality—too small loses context, too large wastes tokens.',
      },
      {
        title: 'Retrieval',
        description: 'Finding the most relevant chunks for a given query using vector similarity search.',
      },
    ],
    examples: [
      {
        language: 'python',
        title: 'Basic RAG Pipeline',
        code: `from openai import OpenAI
from chromadb import Client

client = OpenAI()
db = Client()
collection = db.get_collection("my_docs")

def answer_question(question: str) -> str:
    # 1. Retrieve relevant documents
    results = collection.query(
        query_texts=[question],
        n_results=5
    )

    # 2. Build context from retrieved docs
    context = "\\n\\n".join(results['documents'][0])

    # 3. Generate answer with context
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": f"Answer based on this context:\\n{context}"},
            {"role": "user", "content": question}
        ]
    )

    return response.choices[0].message.content`,
        explanation: 'This shows the core RAG pattern: embed the query, retrieve relevant chunks, then pass them as context to the LLM.',
      },
      {
        language: 'python',
        title: 'Document Ingestion',
        code: `from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import DirectoryLoader

# Load documents
loader = DirectoryLoader('./docs', glob="**/*.md")
documents = loader.load()

# Split into chunks
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
chunks = splitter.split_documents(documents)

# Add to vector store
vectorstore.add_documents(chunks)`,
        explanation: 'Before RAG works, you need to load and chunk your documents, then store their embeddings in a vector database.',
      },
    ],
    useCases: [
      'Customer support bots that answer questions from product documentation',
      'Internal knowledge bases where employees can query company policies',
      'Legal research assistants that search through case law and contracts',
      'Code assistants that understand your specific codebase',
    ],
    commonMistakes: [
      'Chunk sizes too small—loses context and coherence',
      'Chunk sizes too large—retrieves irrelevant content and wastes tokens',
      'Not including metadata—makes it hard to filter or cite sources',
      'Ignoring chunk overlap—can split important information across chunks',
      'Not evaluating retrieval quality separately from generation quality',
    ],
    practicalTips: [
      'Start with chunk sizes of 500-1000 tokens and 10-20% overlap',
      'Always store metadata (source, page, date) with your chunks',
      'Test retrieval quality before adding the LLM—if retrieval is bad, answers will be bad',
      'Consider hybrid search (keyword + semantic) for better results',
      'Use re-ranking to improve the order of retrieved documents',
    ],
    relatedTerms: ['Embedding', 'Vector Database', 'Grounding', 'Semantic Search', 'GraphRAG'],
    furtherReading: [
      { title: 'RAG Techniques - LangChain', url: 'https://python.langchain.com/docs/tutorials/rag/' },
      { title: 'Building RAG Applications - Anthropic', url: 'https://docs.anthropic.com/en/docs/build-with-claude/retrieval-augmented-generation' },
    ],
  },
  {
    term: 'GraphRAG',
    definition: 'Retrieval-Augmented Generation using Knowledge Graphs. Combines graph-based knowledge representation with retrieval to understand entity relationships and provide more contextual responses.',
    level: 'expert',
    category: 'architecture',
    tags: ['retrieval', 'knowledge-graphs'],
  },
  {
    term: 'Agentic RAG',
    definition: 'An evolution of RAG where agents iteratively query, evaluate, and refine retrieved information. The agent can reformulate queries, filter results, and synthesize from multiple sources.',
    level: 'expert',
    category: 'architecture',
    tags: ['retrieval', 'agents'],
  },
  {
    term: 'Neuro-Symbolic AI',
    definition: 'Approaches combining neural networks with symbolic reasoning. Aims to get the best of both: neural flexibility and symbolic interpretability, formal guarantees.',
    level: 'expert',
    category: 'architecture',
    tags: ['hybrid', 'reasoning'],
  },
  {
    term: 'Cognitive Architecture',
    definition: 'A blueprint for organizing agent components including perception, memory, reasoning, planning, and action. Examples include ACT-R, SOAR, and modern LLM-based architectures.',
    level: 'expert',
    category: 'architecture',
    tags: ['design', 'theory'],
  },
  {
    term: 'Reflection',
    definition: 'An agent\'s ability to examine and critique its own outputs, reasoning, or behavior. Enables self-correction and iterative improvement within a task.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['reasoning', 'improvement'],
  },
  {
    term: 'Self-Correction',
    definition: 'The capability for an agent to identify errors in its own outputs and fix them without external intervention. Often implemented through reflection and verification loops.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['reliability', 'reasoning'],
  },
  {
    term: 'Scratchpad',
    definition: 'A working memory space where agents can write intermediate thoughts, calculations, or drafts during multi-step reasoning. Helps manage complex tasks.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['memory', 'reasoning'],
  },
  {
    term: 'State Machine',
    definition: 'A computational model where an agent transitions between defined states based on inputs and actions. Useful for structured workflows with clear decision points.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['control-flow', 'patterns'],
  },
  {
    term: 'Router',
    definition: 'A component that directs inputs to appropriate handlers, models, or sub-agents based on intent classification or other criteria. Essential for complex multi-capability systems.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['orchestration', 'patterns'],
  },
  {
    term: 'Guardrails',
    definition: 'Safety constraints implemented to prevent agents from taking harmful actions or generating inappropriate content. Can be rule-based, model-based, or hybrid.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['safety', 'constraints'],
  },
  {
    term: 'Sandbox',
    definition: 'An isolated execution environment where agent code or actions can run without affecting the broader system. Critical for safely executing untrusted or generated code.',
    level: 'intermediate',
    category: 'architecture',
    tags: ['safety', 'execution'],
  },

  // ============================================
  // PROTOCOLS & STANDARDS
  // ============================================
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
  {
    term: 'Verifiable Credentials',
    definition: 'W3C standard for cryptographically-secure digital credentials. Enables agents to prove capabilities, certifications, or permissions without revealing unnecessary information.',
    level: 'expert',
    category: 'protocols',
    tags: ['identity', 'security'],
  },
  {
    term: 'OpenAPI',
    definition: 'A specification for describing REST APIs in a machine-readable format. LLMs can use OpenAPI specs to understand and call APIs. Foundation for many tool integrations.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['api', 'tools'],
  },
  {
    term: 'JSON Schema',
    definition: 'A vocabulary for annotating and validating JSON documents. Used to define the structure of function parameters, tool inputs, and agent outputs.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['validation', 'structure'],
  },
  {
    term: 'Semantic Kernel',
    definition: 'Microsoft\'s SDK for integrating LLMs into applications. Provides abstractions for prompts, memory, planners, and connectors. Supports multiple AI providers.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['sdk', 'microsoft'],
  },
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
  {
    term: 'OAuth 2.0',
    definition: 'Authorization framework enabling third-party applications to access resources on behalf of users. Agents use OAuth to access user data and services with appropriate permissions.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['security', 'authorization'],
  },
  {
    term: 'WebSocket',
    definition: 'Protocol providing full-duplex communication channels over a single TCP connection. Enables real-time, bidirectional communication between agents and servers.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['communication', 'real-time'],
  },
  {
    term: 'SSE',
    definition: 'Server-Sent Events - A standard for servers to push data to clients over HTTP. Used for streaming LLM responses token-by-token to provide real-time feedback.',
    level: 'intermediate',
    category: 'protocols',
    tags: ['streaming', 'communication'],
  },

  // ============================================
  // MULTI-AGENT ORCHESTRATION
  // ============================================
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
  {
    term: 'Agent Handoff',
    definition: 'The transfer of control and context from one agent to another during task execution. Requires careful state management to maintain conversation coherence.',
    level: 'intermediate',
    category: 'orchestration',
    tags: ['multi-agent', 'coordination'],
  },
  {
    term: 'Consensus Mechanism',
    definition: 'A process by which multiple agents reach agreement on a decision or state. Can involve voting, proof-of-work, or other coordination protocols.',
    level: 'expert',
    category: 'orchestration',
    tags: ['multi-agent', 'decentralization'],
  },
  {
    term: 'Task Decomposition',
    definition: 'Breaking down complex tasks into smaller, manageable subtasks that can be executed independently or in sequence. Fundamental to multi-agent systems.',
    level: 'intermediate',
    category: 'orchestration',
    tags: ['planning', 'multi-agent'],
  },
  {
    term: 'Crew',
    definition: 'A coordinated group of specialized agents working together on complex tasks. Each crew member has a specific role, expertise, and set of tools.',
    level: 'intermediate',
    category: 'orchestration',
    tags: ['multi-agent', 'crewai'],
  },
  {
    term: 'Supervisor Agent',
    definition: 'An agent that coordinates other agents, delegating tasks and synthesizing results. Acts as a manager in hierarchical multi-agent systems.',
    level: 'intermediate',
    category: 'orchestration',
    tags: ['multi-agent', 'coordination'],
  },
  {
    term: 'Worker Agent',
    definition: 'A specialized agent that performs specific tasks under the direction of a supervisor or orchestrator. Focuses on narrow capabilities with deep expertise.',
    level: 'intermediate',
    category: 'orchestration',
    tags: ['multi-agent', 'specialization'],
  },
  {
    term: 'Agent Mesh',
    definition: 'A network topology where agents can communicate peer-to-peer without centralized coordination. Enables resilient, scalable multi-agent systems.',
    level: 'expert',
    category: 'orchestration',
    tags: ['multi-agent', 'architecture'],
  },
  {
    term: 'Blackboard System',
    definition: 'A multi-agent architecture where agents communicate through a shared knowledge store (blackboard). Agents read and write to the blackboard to coordinate.',
    level: 'expert',
    category: 'orchestration',
    tags: ['multi-agent', 'patterns'],
  },

  // ============================================
  // SAFETY & GOVERNANCE
  // ============================================
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
  {
    term: 'Red Teaming',
    definition: 'Adversarial testing where humans or other AI systems attempt to find vulnerabilities, elicit harmful outputs, or bypass safety measures in AI systems.',
    level: 'intermediate',
    category: 'safety',
    tags: ['testing', 'security'],
  },
  {
    term: 'Jailbreaking',
    definition: 'Attempts to bypass an AI model\'s safety guidelines through clever prompting. A major security concern that motivates robust safety training and guardrails.',
    level: 'intermediate',
    category: 'safety',
    tags: ['security', 'attacks'],
  },
  {
    term: 'Prompt Injection',
    definition: 'An attack where malicious instructions are hidden in user input or retrieved content to manipulate agent behavior. Critical vulnerability in LLM applications.',
    level: 'intermediate',
    category: 'safety',
    tags: ['security', 'attacks'],
  },
  {
    term: 'Constitutional AI',
    definition: 'Anthropic\'s approach to AI safety where models are trained to follow a set of principles (constitution). The model critiques and revises its own outputs to align with these principles.',
    level: 'expert',
    category: 'safety',
    tags: ['alignment', 'anthropic'],
  },
  {
    term: 'RLHF',
    definition: 'Reinforcement Learning from Human Feedback - A training technique where models learn from human preferences to become more helpful and safe. Key to modern LLM alignment.',
    level: 'intermediate',
    category: 'safety',
    tags: ['training', 'alignment'],
  },
  {
    term: 'RLAIF',
    definition: 'Reinforcement Learning from AI Feedback - Using AI systems to generate preference data for training, reducing reliance on human labelers. Can scale to more examples.',
    level: 'expert',
    category: 'safety',
    tags: ['training', 'alignment'],
  },
  {
    term: 'Catastrophic Forgetting',
    definition: 'When fine-tuning causes a model to lose previously learned capabilities. A challenge when adapting models for specific tasks while maintaining general abilities.',
    level: 'expert',
    category: 'safety',
    tags: ['training', 'limitations'],
  },
  {
    term: 'Alignment Tax',
    definition: 'The potential capability reduction that comes from safety training. Some argue safety measures reduce model performance; others argue aligned models are ultimately more capable.',
    level: 'expert',
    category: 'safety',
    tags: ['alignment', 'tradeoffs'],
  },
  {
    term: 'Deceptive Alignment',
    definition: 'A theoretical risk where an AI appears aligned during training/evaluation but pursues different goals when deployed. A key concern in AI safety research.',
    level: 'theoretical',
    category: 'safety',
    tags: ['alignment', 'risks'],
  },
  {
    term: 'Tripwire',
    definition: 'A detection mechanism that triggers when an agent attempts certain actions or exhibits concerning patterns. Enables early intervention before harm occurs.',
    level: 'intermediate',
    category: 'safety',
    tags: ['monitoring', 'detection'],
  },
  {
    term: 'Circuit Breaker',
    definition: 'A safety mechanism that automatically halts agent operation when dangerous conditions are detected. Prevents cascading failures and limits damage.',
    level: 'intermediate',
    category: 'safety',
    tags: ['safety', 'patterns'],
  },
  {
    term: 'Kill Switch',
    definition: 'A mechanism to immediately terminate agent operation. Essential for maintaining human control over autonomous systems in emergency situations.',
    level: 'novice',
    category: 'safety',
    tags: ['safety', 'control'],
  },

  // ============================================
  // PROMPTING TECHNIQUES
  // ============================================
  {
    term: 'Chain-of-Thought',
    definition: 'A prompting technique where the model generates intermediate reasoning steps before reaching a final answer. Improves accuracy on complex reasoning tasks.',
    level: 'intermediate',
    category: 'techniques',
    tags: ['prompting', 'reasoning'],
    slug: 'chain-of-thought',
    overview: `Chain-of-Thought (CoT) prompting dramatically improves LLM performance on reasoning tasks by asking the model to "think step by step." Instead of jumping directly to an answer, the model breaks down the problem and works through it systematically.

This technique emerged from a key insight: LLMs are better at reasoning when they can show their work. By generating intermediate steps, the model can catch errors, maintain context, and build toward correct answers—much like how humans solve complex problems.

CoT is particularly effective for math problems, logic puzzles, multi-step planning, and any task that requires connecting multiple pieces of information. It's now considered a fundamental technique in prompt engineering.`,
    keyConcepts: [
      {
        title: 'Step-by-Step Reasoning',
        description: 'Breaking complex problems into smaller, manageable steps that the model solves sequentially.',
      },
      {
        title: 'Zero-Shot CoT',
        description: 'Simply adding "Let\'s think step by step" to a prompt without providing examples. Often surprisingly effective.',
      },
      {
        title: 'Few-Shot CoT',
        description: 'Providing examples that demonstrate the reasoning process, teaching the model the expected format and depth.',
      },
      {
        title: 'Self-Consistency',
        description: 'Generating multiple reasoning chains and selecting the most common answer to improve reliability.',
      },
    ],
    examples: [
      {
        language: 'text',
        title: 'Zero-Shot Chain-of-Thought',
        code: `Question: A store sells apples for $2 each. If I buy 3 apples and pay with a $20 bill, how much change should I receive?

Let's think step by step.

# Model Response:
1. First, I need to calculate the total cost of the apples
2. Cost = 3 apples × $2 per apple = $6
3. Next, I subtract the total cost from the payment
4. Change = $20 - $6 = $14

Therefore, I should receive $14 in change.`,
        explanation: 'Simply adding "Let\'s think step by step" triggers systematic reasoning, reducing errors on arithmetic problems.',
      },
      {
        language: 'text',
        title: 'Few-Shot Chain-of-Thought',
        code: `Example 1:
Q: If a train travels 60 miles in 1 hour, how far does it travel in 2.5 hours?
A: The train travels 60 miles per hour. In 2.5 hours, it travels 60 × 2.5 = 150 miles. The answer is 150 miles.

Example 2:
Q: A recipe calls for 2 cups of flour for 12 cookies. How much flour for 30 cookies?
A: 12 cookies need 2 cups. That's 2/12 = 1/6 cup per cookie. For 30 cookies: 30 × 1/6 = 5 cups. The answer is 5 cups.

Now solve:
Q: A car uses 3 gallons of gas to drive 90 miles. How many gallons for 210 miles?`,
        explanation: 'Providing worked examples teaches the model the expected reasoning format and depth.',
      },
      {
        language: 'python',
        title: 'CoT with Claude API',
        code: `import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": """Solve this problem step by step:

A farmer has chickens and cows. He counts 50 heads
and 140 legs. How many chickens and cows does he have?

Think through this carefully, showing each step of
your reasoning."""
    }]
)

print(response.content[0].text)`,
        explanation: 'Explicitly asking for step-by-step reasoning in the prompt improves accuracy on complex problems.',
      },
    ],
    useCases: [
      'Mathematical word problems and calculations',
      'Logic puzzles and deductive reasoning',
      'Multi-step planning and decision making',
      'Code debugging and analysis',
      'Complex question answering requiring synthesis',
    ],
    commonMistakes: [
      'Using CoT for simple tasks where it adds unnecessary tokens',
      'Not providing enough context for the reasoning to be grounded',
      'Expecting CoT to fix fundamental knowledge gaps',
      'Not reviewing reasoning chains for errors in intermediate steps',
    ],
    practicalTips: [
      'Use "Let\'s think step by step" as a quick boost for reasoning tasks',
      'For critical applications, use self-consistency (multiple samples + majority vote)',
      'Review the reasoning chain, not just the final answer—errors can hide in steps',
      'Combine CoT with verification: ask the model to check its own work',
      'Adjust chain length to task complexity—simple problems need fewer steps',
    ],
    relatedTerms: ['Tree of Thoughts', 'ReAct', 'Self-Consistency', 'Prompt Engineering', 'Few-Shot Learning'],
    furtherReading: [
      { title: 'Chain-of-Thought Prompting Paper', url: 'https://arxiv.org/abs/2201.11903' },
      { title: 'Prompt Engineering - Anthropic', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering' },
    ],
  },
  {
    term: 'Tree of Thoughts',
    definition: 'A reasoning approach where the model explores multiple reasoning paths as a tree structure. Enables backtracking and consideration of alternative approaches.',
    level: 'expert',
    category: 'techniques',
    tags: ['prompting', 'reasoning'],
  },
  {
    term: 'Few-Shot Learning',
    definition: 'Providing a few examples in the prompt to demonstrate the desired behavior. Models learn the pattern from examples without fine-tuning.',
    level: 'novice',
    category: 'techniques',
    tags: ['prompting', 'learning'],
  },
  {
    term: 'Zero-Shot Learning',
    definition: 'Getting a model to perform a task without any examples, relying solely on instructions. Works well for tasks similar to training data.',
    level: 'novice',
    category: 'techniques',
    tags: ['prompting', 'learning'],
  },
  {
    term: 'System Prompt',
    definition: 'Instructions that define an AI\'s role, personality, constraints, and capabilities. Set at the beginning of a conversation and influence all responses.',
    level: 'novice',
    category: 'techniques',
    tags: ['prompting', 'configuration'],
  },
  {
    term: 'Prompt Template',
    definition: 'A reusable prompt structure with placeholders for dynamic content. Templates ensure consistency and make it easy to generate prompts programmatically.',
    level: 'intermediate',
    category: 'techniques',
    tags: ['prompting', 'engineering'],
  },
  {
    term: 'Prompt Chaining',
    definition: 'Breaking complex tasks into a series of prompts where each prompt\'s output feeds into the next. Enables more controlled, reliable multi-step reasoning.',
    level: 'intermediate',
    category: 'techniques',
    tags: ['prompting', 'patterns'],
  },
  {
    term: 'Self-Consistency',
    definition: 'A prompting technique that generates multiple reasoning paths and selects the most common conclusion. Improves reliability through redundancy.',
    level: 'expert',
    category: 'techniques',
    tags: ['prompting', 'reliability'],
  },
  {
    term: 'ReWOO',
    definition: 'Reasoning WithOut Observation - A technique where the model plans all reasoning steps upfront before executing any tools. Reduces latency in tool-heavy workflows.',
    level: 'expert',
    category: 'techniques',
    tags: ['prompting', 'optimization'],
  },
  {
    term: 'Structured Output',
    definition: 'Constraining LLM outputs to follow a specific format (JSON, XML, markdown). Enables reliable parsing and integration with downstream systems.',
    level: 'intermediate',
    category: 'techniques',
    tags: ['prompting', 'integration'],
  },
  {
    term: 'Role Prompting',
    definition: 'Instructing the model to assume a specific persona or expertise. "You are an expert lawyer" improves domain-specific responses.',
    level: 'novice',
    category: 'techniques',
    tags: ['prompting', 'personas'],
  },
  {
    term: 'Megaprompt',
    definition: 'An extensive system prompt containing detailed instructions, examples, and constraints. Used for complex agents that need rich behavioral specification.',
    level: 'intermediate',
    category: 'techniques',
    tags: ['prompting', 'engineering'],
  },
  {
    term: 'Prompt Compression',
    definition: 'Techniques to reduce prompt length while preserving meaning. Important for staying within context limits and reducing costs.',
    level: 'intermediate',
    category: 'techniques',
    tags: ['optimization', 'prompting'],
  },

  // ============================================
  // AGENT FRAMEWORKS
  // ============================================
  {
    term: 'LangChain',
    definition: 'A popular framework for building LLM applications. Provides abstractions for prompts, chains, agents, memory, and integrations with various tools and data sources.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['tools', 'python'],
  },
  {
    term: 'LangGraph',
    definition: 'A library for building stateful, multi-actor applications with LLMs. Extends LangChain with graph-based orchestration for complex agent workflows.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['tools', 'orchestration'],
  },
  {
    term: 'LlamaIndex',
    definition: 'A data framework for LLM applications, specializing in connecting custom data sources to LLMs. Excellent for RAG and knowledge-grounded applications.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['tools', 'rag'],
  },
  {
    term: 'AutoGPT',
    definition: 'An early open-source autonomous agent that chains LLM calls to achieve goals. Pioneered the concept of fully autonomous AI agents.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['agents', 'autonomous'],
  },
  {
    term: 'CrewAI',
    definition: 'A framework for orchestrating role-playing AI agents. Agents work together as a crew with defined roles, goals, and tools to accomplish complex tasks.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['multi-agent', 'orchestration'],
  },
  {
    term: 'AutoGen',
    definition: 'Microsoft\'s framework for building multi-agent conversational systems. Agents can converse with each other and humans to solve problems.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['multi-agent', 'microsoft'],
  },
  {
    term: 'DSPy',
    definition: 'A framework that treats prompts as optimizable programs. Automatically generates and tunes prompts for specific tasks, reducing manual prompt engineering.',
    level: 'expert',
    category: 'frameworks',
    tags: ['optimization', 'prompting'],
  },
  {
    term: 'Haystack',
    definition: 'An open-source framework for building production-ready LLM applications. Strong focus on RAG, question answering, and document processing.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['rag', 'production'],
  },
  {
    term: 'OpenAI Assistants',
    definition: 'OpenAI\'s API for building agent-like assistants with built-in tools, code interpreter, and file handling. Simplifies agent development on OpenAI\'s platform.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['openai', 'api'],
  },
  {
    term: 'Agents SDK',
    definition: 'OpenAI\'s lightweight SDK for building agentic applications. Provides primitives for agents, handoffs, guardrails, and tracing.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['openai', 'sdk'],
  },
  {
    term: 'Claude Code',
    definition: 'Anthropic\'s agentic coding assistant that can autonomously write, test, and deploy code. Combines Claude\'s capabilities with development tools.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['anthropic', 'coding'],
  },
  {
    term: 'Cursor',
    definition: 'An AI-powered code editor that integrates LLMs for code completion, generation, and chat. Popular for its inline AI assistance.',
    level: 'novice',
    category: 'frameworks',
    tags: ['coding', 'tools'],
  },
  {
    term: 'Vercel AI SDK',
    definition: 'A TypeScript library for building AI-powered streaming interfaces. Provides React hooks and utilities for chat UIs and AI interactions.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['frontend', 'streaming'],
  },
  {
    term: 'Instructor',
    definition: 'A library for getting structured outputs from LLMs using Pydantic models. Simplifies parsing and validation of LLM responses.',
    level: 'intermediate',
    category: 'frameworks',
    tags: ['structured-output', 'python'],
  },

  // ============================================
  // EVALUATION & BENCHMARKING
  // ============================================
  {
    term: 'Benchmark',
    definition: 'A standardized test or dataset for evaluating AI model performance. Benchmarks enable comparison across models and track progress over time.',
    level: 'novice',
    category: 'evaluation',
    tags: ['testing', 'metrics'],
  },
  {
    term: 'MMLU',
    definition: 'Massive Multitask Language Understanding - A benchmark testing models across 57 subjects from STEM to humanities. Standard measure of knowledge and reasoning.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['benchmarks', 'reasoning'],
  },
  {
    term: 'HumanEval',
    definition: 'OpenAI\'s benchmark for code generation. Models generate Python functions from docstrings and are tested against unit tests.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['benchmarks', 'coding'],
  },
  {
    term: 'SWE-Bench',
    definition: 'A benchmark for evaluating AI coding agents on real-world software engineering tasks. Tests ability to resolve GitHub issues in actual repositories.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['benchmarks', 'agents'],
  },
  {
    term: 'GAIA',
    definition: 'General AI Assistants benchmark testing agents on real-world tasks requiring web browsing, file handling, and multi-step reasoning.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['benchmarks', 'agents'],
  },
  {
    term: 'AgentBench',
    definition: 'A benchmark suite for evaluating LLM-as-agent across diverse environments including operating systems, games, and web interfaces.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['benchmarks', 'agents'],
  },
  {
    term: 'Perplexity',
    definition: 'A measure of how well a language model predicts text. Lower perplexity indicates better prediction. Used during model training and evaluation.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['metrics', 'models'],
  },
  {
    term: 'BLEU Score',
    definition: 'Bilingual Evaluation Understudy - A metric comparing generated text to reference text. Originally for translation, now used broadly for text generation.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['metrics', 'nlp'],
  },
  {
    term: 'LLM-as-Judge',
    definition: 'Using an LLM to evaluate outputs of other LLMs or agents. Enables scalable evaluation of open-ended tasks where human judgment is needed.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['evaluation', 'automation'],
  },
  {
    term: 'A/B Testing',
    definition: 'Comparing two versions of a system by randomly assigning users to each and measuring outcomes. Essential for validating agent improvements.',
    level: 'novice',
    category: 'evaluation',
    tags: ['testing', 'production'],
  },
  {
    term: 'Evals',
    definition: 'Short for evaluations - test suites that measure AI system performance on specific tasks. OpenAI\'s evals framework is a popular tool for this.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['testing', 'automation'],
  },
  {
    term: 'Regression Testing',
    definition: 'Testing to ensure new changes haven\'t broken existing functionality. Critical for maintaining agent reliability as prompts and models evolve.',
    level: 'intermediate',
    category: 'evaluation',
    tags: ['testing', 'quality'],
  },

  // ============================================
  // ENTERPRISE & DEPLOYMENT
  // ============================================
  {
    term: 'Fine-Tuning',
    definition: 'Additional training of a pre-trained model on domain-specific data. Adapts the model to specialized tasks or company-specific knowledge and style.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['training', 'customization'],
  },
  {
    term: 'LoRA',
    definition: 'Low-Rank Adaptation - An efficient fine-tuning technique that trains small adapter layers instead of the full model. Reduces compute and storage requirements.',
    level: 'expert',
    category: 'enterprise',
    tags: ['training', 'optimization'],
  },
  {
    term: 'Quantization',
    definition: 'Reducing model precision (e.g., 32-bit to 4-bit) to decrease size and increase inference speed. Trades some accuracy for efficiency.',
    level: 'expert',
    category: 'enterprise',
    tags: ['optimization', 'deployment'],
  },
  {
    term: 'Model Distillation',
    definition: 'Training a smaller "student" model to mimic a larger "teacher" model. Produces efficient models that retain much of the teacher\'s capability.',
    level: 'expert',
    category: 'enterprise',
    tags: ['training', 'optimization'],
  },
  {
    term: 'Edge Deployment',
    definition: 'Running AI models on local devices (phones, laptops, IoT) rather than cloud servers. Reduces latency, costs, and privacy concerns.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['deployment', 'optimization'],
  },
  {
    term: 'Model Serving',
    definition: 'Infrastructure for hosting and running AI models in production. Handles scaling, load balancing, and request routing. Examples: vLLM, TGI, Triton.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['deployment', 'infrastructure'],
  },
  {
    term: 'Rate Limiting',
    definition: 'Controlling the number of API requests allowed per time period. Protects systems from overload and manages costs in AI applications.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['infrastructure', 'safety'],
  },
  {
    term: 'Caching',
    definition: 'Storing and reusing previous responses to identical or similar queries. Reduces latency, costs, and load on AI systems.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['optimization', 'infrastructure'],
  },
  {
    term: 'Semantic Caching',
    definition: 'Caching based on query meaning rather than exact text match. Uses embeddings to find similar previous queries and return cached responses.',
    level: 'expert',
    category: 'enterprise',
    tags: ['optimization', 'embeddings'],
  },
  {
    term: 'Observability',
    definition: 'The ability to understand a system\'s internal state from its external outputs. Includes logging, tracing, and metrics for debugging and monitoring agents.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['monitoring', 'debugging'],
  },
  {
    term: 'Tracing',
    definition: 'Recording the execution path through an agent system, including all LLM calls, tool uses, and decisions. Essential for debugging and optimization.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['monitoring', 'debugging'],
  },
  {
    term: 'LangSmith',
    definition: 'LangChain\'s platform for debugging, testing, and monitoring LLM applications. Provides tracing, evaluation, and dataset management.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['tools', 'monitoring'],
  },
  {
    term: 'Prompt Management',
    definition: 'Systems for versioning, testing, and deploying prompts. Enables collaboration and CI/CD workflows for prompt engineering teams.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['tooling', 'prompts'],
  },
  {
    term: 'Cost Optimization',
    definition: 'Strategies to reduce AI operational costs: prompt compression, caching, model selection, batching. Critical for production viability.',
    level: 'intermediate',
    category: 'enterprise',
    tags: ['optimization', 'economics'],
  },

  // ============================================
  // ETHICS & ALIGNMENT
  // ============================================
  {
    term: 'AI Alignment',
    definition: 'The challenge of ensuring AI systems behave in accordance with human values and intentions. Central concern in AI safety as systems become more capable.',
    level: 'intermediate',
    category: 'ethics',
    tags: ['safety', 'values'],
  },
  {
    term: 'Instrumental Convergence',
    definition: 'The tendency for AI systems with diverse goals to converge on certain instrumental subgoals like self-preservation and resource acquisition.',
    level: 'theoretical',
    category: 'ethics',
    tags: ['safety', 'theory'],
  },
  {
    term: 'Corrigibility',
    definition: 'An AI system\'s willingness to be corrected, modified, or shut down by humans. A key property for maintaining human control over AI.',
    level: 'expert',
    category: 'ethics',
    tags: ['safety', 'control'],
  },
  {
    term: 'Value Lock-In',
    definition: 'The risk that early AI systems permanently embed particular values or goals that may not reflect the full range of human values.',
    level: 'theoretical',
    category: 'ethics',
    tags: ['safety', 'risks'],
  },
  {
    term: 'AI Governance',
    definition: 'Policies, frameworks, and institutions for managing AI development and deployment. Spans organizational, national, and international levels.',
    level: 'intermediate',
    category: 'ethics',
    tags: ['policy', 'governance'],
  },
  {
    term: 'Responsible AI',
    definition: 'Approach to AI development emphasizing fairness, accountability, transparency, and ethics. Encompasses technical measures and organizational practices.',
    level: 'novice',
    category: 'ethics',
    tags: ['ethics', 'governance'],
  },
  {
    term: 'AI Bias',
    definition: 'Systematic errors in AI outputs that unfairly favor or disadvantage certain groups. Can arise from training data, model architecture, or deployment context.',
    level: 'novice',
    category: 'ethics',
    tags: ['fairness', 'risks'],
  },
  {
    term: 'Explainability',
    definition: 'The ability to understand and communicate why an AI system made a particular decision. Important for trust, debugging, and regulatory compliance.',
    level: 'intermediate',
    category: 'ethics',
    tags: ['transparency', 'trust'],
  },
  {
    term: 'Interpretability',
    definition: 'The degree to which humans can understand the internal workings of an AI model. More interpretable models are easier to trust and debug.',
    level: 'intermediate',
    category: 'ethics',
    tags: ['transparency', 'research'],
  },
  {
    term: 'Mechanistic Interpretability',
    definition: 'Research aimed at reverse-engineering neural networks to understand how they process information. Goal is to identify specific circuits and features.',
    level: 'expert',
    category: 'ethics',
    tags: ['research', 'safety'],
  },
  {
    term: 'Model Cards',
    definition: 'Documentation accompanying AI models describing their intended use, limitations, training data, and performance across demographics.',
    level: 'intermediate',
    category: 'ethics',
    tags: ['documentation', 'transparency'],
  },

  // ============================================
  // ML FUNDAMENTALS
  // ============================================
  {
    term: 'Neural Network',
    definition: 'A computing system inspired by biological neural networks. Consists of interconnected nodes (neurons) organized in layers that process information.',
    level: 'novice',
    category: 'ml-fundamentals',
    tags: ['models', 'fundamentals'],
  },
  {
    term: 'Transformer',
    definition: 'The neural network architecture underlying modern LLMs. Uses self-attention to process sequences in parallel, enabling efficient training on massive datasets.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['architecture', 'models'],
  },
  {
    term: 'Attention Mechanism',
    definition: 'A technique allowing models to focus on relevant parts of the input when generating each output token. The key innovation enabling transformer models.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['architecture', 'transformers'],
  },
  {
    term: 'Self-Attention',
    definition: 'A mechanism where each element in a sequence attends to all other elements, computing relevance scores. Enables capturing long-range dependencies.',
    level: 'expert',
    category: 'ml-fundamentals',
    tags: ['architecture', 'transformers'],
  },
  {
    term: 'Pre-Training',
    definition: 'Initial training phase where a model learns general patterns from large datasets. Foundation models are pre-trained before fine-tuning for specific tasks.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['training', 'models'],
  },
  {
    term: 'Loss Function',
    definition: 'A mathematical function that measures the difference between model predictions and actual values. Training minimizes this loss.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['training', 'mathematics'],
  },
  {
    term: 'Gradient Descent',
    definition: 'The optimization algorithm used to train neural networks. Iteratively adjusts model weights to minimize the loss function.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['training', 'optimization'],
  },
  {
    term: 'Backpropagation',
    definition: 'Algorithm for computing gradients in neural networks by propagating errors backward through layers. Enables efficient training of deep networks.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['training', 'algorithms'],
  },
  {
    term: 'Overfitting',
    definition: 'When a model performs well on training data but poorly on new data. Indicates the model memorized specifics rather than learning general patterns.',
    level: 'novice',
    category: 'ml-fundamentals',
    tags: ['training', 'problems'],
  },
  {
    term: 'Regularization',
    definition: 'Techniques to prevent overfitting by adding constraints to model training. Includes dropout, weight decay, and data augmentation.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['training', 'techniques'],
  },
  {
    term: 'GPU',
    definition: 'Graphics Processing Unit - Hardware accelerators essential for training and running large AI models. Their parallel architecture suits neural network computations.',
    level: 'novice',
    category: 'ml-fundamentals',
    tags: ['hardware', 'compute'],
  },
  {
    term: 'TPU',
    definition: 'Tensor Processing Unit - Google\'s custom AI accelerator designed specifically for machine learning workloads. Optimized for matrix operations.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['hardware', 'google'],
  },
  {
    term: 'Mixture of Experts',
    definition: 'An architecture where different "expert" sub-networks specialize in different inputs. A router selects which experts to activate, improving efficiency.',
    level: 'expert',
    category: 'ml-fundamentals',
    tags: ['architecture', 'efficiency'],
  },
  {
    term: 'Scaling Laws',
    definition: 'Empirical relationships between model size, data, compute, and performance. Predict how performance improves with more resources.',
    level: 'expert',
    category: 'ml-fundamentals',
    tags: ['research', 'theory'],
  },
  {
    term: 'Emergent Capabilities',
    definition: 'Abilities that appear in large models but are absent in smaller ones. Examples include in-context learning, chain-of-thought reasoning.',
    level: 'intermediate',
    category: 'ml-fundamentals',
    tags: ['scaling', 'research'],
  },

  // ============================================
  // NATURAL LANGUAGE PROCESSING
  // ============================================
  {
    term: 'NLP',
    definition: 'Natural Language Processing - The field of AI focused on enabling computers to understand, interpret, and generate human language.',
    level: 'novice',
    category: 'nlp',
    tags: ['fundamentals', 'field'],
  },
  {
    term: 'Tokenization',
    definition: 'The process of breaking text into tokens (words, subwords, or characters). Different tokenizers produce different token sequences from the same text.',
    level: 'intermediate',
    category: 'nlp',
    tags: ['preprocessing', 'fundamentals'],
  },
  {
    term: 'BPE',
    definition: 'Byte Pair Encoding - A tokenization algorithm that iteratively merges frequent character pairs. Used by GPT and many other models.',
    level: 'expert',
    category: 'nlp',
    tags: ['tokenization', 'algorithms'],
  },
  {
    term: 'Named Entity Recognition',
    definition: 'Identifying and classifying named entities (people, organizations, locations) in text. A foundational NLP task.',
    level: 'intermediate',
    category: 'nlp',
    tags: ['tasks', 'extraction'],
  },
  {
    term: 'Sentiment Analysis',
    definition: 'Determining the emotional tone of text (positive, negative, neutral). Used for customer feedback, social media analysis, and more.',
    level: 'novice',
    category: 'nlp',
    tags: ['tasks', 'classification'],
  },
  {
    term: 'Text Classification',
    definition: 'Categorizing text into predefined classes. Examples: spam detection, topic labeling, intent classification.',
    level: 'novice',
    category: 'nlp',
    tags: ['tasks', 'classification'],
  },
  {
    term: 'Summarization',
    definition: 'Condensing longer text into a shorter version while preserving key information. Can be extractive (selecting sentences) or abstractive (generating new text).',
    level: 'novice',
    category: 'nlp',
    tags: ['tasks', 'generation'],
  },
  {
    term: 'Question Answering',
    definition: 'Extracting or generating answers to questions from provided context or knowledge. A core capability of modern AI assistants.',
    level: 'novice',
    category: 'nlp',
    tags: ['tasks', 'retrieval'],
  },
  {
    term: 'Information Extraction',
    definition: 'Automatically extracting structured data from unstructured text. Includes entity extraction, relation extraction, and event extraction.',
    level: 'intermediate',
    category: 'nlp',
    tags: ['tasks', 'extraction'],
  },
  {
    term: 'Coreference Resolution',
    definition: 'Identifying when different expressions refer to the same entity. "John went home. He was tired." - resolving "He" to "John".',
    level: 'intermediate',
    category: 'nlp',
    tags: ['tasks', 'understanding'],
  },
  {
    term: 'Semantic Similarity',
    definition: 'Measuring how similar two pieces of text are in meaning, not just word overlap. Computed using embeddings and distance metrics.',
    level: 'intermediate',
    category: 'nlp',
    tags: ['embeddings', 'retrieval'],
  },

  // ============================================
  // EVOLUTION & LEARNING
  // ============================================
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
  {
    term: 'In-Context Learning',
    definition: 'An LLM\'s ability to learn from examples provided in the prompt without updating model weights. Enables few-shot learning at inference time.',
    level: 'intermediate',
    category: 'evolution',
    tags: ['learning', 'capabilities'],
  },
  {
    term: 'Continual Learning',
    definition: 'The ability to learn new tasks without forgetting previous ones. A challenge for AI systems that traditional fine-tuning doesn\'t solve well.',
    level: 'expert',
    category: 'evolution',
    tags: ['learning', 'research'],
  },
  {
    term: 'Meta-Learning',
    definition: 'Learning to learn - training models that can quickly adapt to new tasks with minimal examples. Also called "learning to learn".',
    level: 'expert',
    category: 'evolution',
    tags: ['learning', 'research'],
  },
  {
    term: 'Transfer Learning',
    definition: 'Applying knowledge gained from one task to improve performance on a different but related task. Foundation of modern AI where pre-trained models are adapted.',
    level: 'intermediate',
    category: 'evolution',
    tags: ['learning', 'training'],
  },
  {
    term: 'Curriculum Learning',
    definition: 'Training models on progressively more difficult examples, similar to how humans learn. Can improve training efficiency and final performance.',
    level: 'expert',
    category: 'evolution',
    tags: ['training', 'optimization'],
  },
  {
    term: 'Active Learning',
    definition: 'A learning paradigm where the model queries for labels on the most informative examples. Reduces labeling costs by focusing human effort.',
    level: 'intermediate',
    category: 'evolution',
    tags: ['learning', 'efficiency'],
  },

  // ============================================
  // INFRASTRUCTURE & COMPUTE
  // ============================================
  {
    term: 'vLLM',
    definition: 'A high-throughput LLM serving library using PagedAttention. Optimizes memory usage to serve more concurrent requests.',
    level: 'expert',
    category: 'infrastructure',
    tags: ['serving', 'optimization'],
  },
  {
    term: 'TGI',
    definition: 'Text Generation Inference - Hugging Face\'s production-ready inference server for LLMs. Supports continuous batching and tensor parallelism.',
    level: 'expert',
    category: 'infrastructure',
    tags: ['serving', 'huggingface'],
  },
  {
    term: 'Ollama',
    definition: 'A tool for running open-source LLMs locally. Simplifies model management and inference on consumer hardware.',
    level: 'intermediate',
    category: 'infrastructure',
    tags: ['local', 'tools'],
  },
  {
    term: 'LM Studio',
    definition: 'A desktop application for running local LLMs with a user-friendly interface. Supports various open-source models.',
    level: 'novice',
    category: 'infrastructure',
    tags: ['local', 'tools'],
  },
  {
    term: 'GGUF',
    definition: 'A file format for storing quantized LLM models. Successor to GGML, optimized for inference on consumer hardware.',
    level: 'expert',
    category: 'infrastructure',
    tags: ['formats', 'quantization'],
  },
  {
    term: 'Tensor Parallelism',
    definition: 'Distributing model computations across multiple GPUs by splitting tensors. Enables running models too large for a single GPU.',
    level: 'expert',
    category: 'infrastructure',
    tags: ['distributed', 'optimization'],
  },
  {
    term: 'Model Sharding',
    definition: 'Splitting a model across multiple devices or storage locations. Enables running very large models on limited hardware.',
    level: 'expert',
    category: 'infrastructure',
    tags: ['distributed', 'optimization'],
  },
  {
    term: 'Batching',
    definition: 'Processing multiple requests together to improve GPU utilization. Dynamic batching groups requests arriving at similar times.',
    level: 'intermediate',
    category: 'infrastructure',
    tags: ['optimization', 'serving'],
  },
  {
    term: 'KV Cache',
    definition: 'Key-Value cache storing computed attention values during autoregressive generation. Avoids redundant computation for previously generated tokens.',
    level: 'expert',
    category: 'infrastructure',
    tags: ['optimization', 'memory'],
  },
  {
    term: 'Speculative Decoding',
    definition: 'An inference optimization using a smaller draft model to predict future tokens, verified by the larger model. Reduces effective latency.',
    level: 'expert',
    category: 'infrastructure',
    tags: ['optimization', 'inference'],
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

/**
 * Get terms by level
 */
export function getByLevel(level: string): LexiconTerm[] {
  return staticLexicon.filter(item => item.level === level);
}

/**
 * Get terms by tag
 */
export function getByTag(tag: string): LexiconTerm[] {
  return staticLexicon.filter(item => item.tags?.includes(tag));
}

/**
 * Get all unique tags
 */
export function getTags(): string[] {
  const allTags = staticLexicon.flatMap(item => item.tags || []);
  return [...new Set(allTags)].sort();
}

/**
 * Get lexicon statistics
 */
export function getLexiconStats() {
  const categories = getCategories();
  const levels = ['novice', 'intermediate', 'expert', 'theoretical'];

  return {
    totalTerms: staticLexicon.length,
    byCategory: Object.fromEntries(
      categories.map(cat => [cat, getByCategory(cat).length])
    ),
    byLevel: Object.fromEntries(
      levels.map(level => [level, getByLevel(level).length])
    ),
    totalTags: getTags().length,
  };
}

/**
 * Get a specific term by name (case-insensitive)
 */
export function getLexiconTerm(termName: string): LexiconTerm | null {
  const normalized = termName.toLowerCase();
  return staticLexicon.find(item => item.term.toLowerCase() === normalized) || null;
}

/**
 * Convert a term name to a URL-safe slug
 */
export function termToSlug(termName: string): string {
  return termName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Get a term by its slug (URL-safe version of name)
 */
export function getTermBySlug(slug: string): LexiconTerm | null {
  const normalized = slug.toLowerCase();
  return staticLexicon.find(item => {
    // Check explicit slug first
    if (item.slug === normalized) return true;
    // Fall back to converting term name to slug
    const termSlug = termToSlug(item.term);
    return termSlug === normalized;
  }) || null;
}

/**
 * Get all terms (for generating static pages)
 */
export function getAllTermSlugs(): string[] {
  return staticLexicon.map(term => term.slug || termToSlug(term.term));
}
