import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

// Configuration
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY || 'vorion-dev-key';
const ROOT_DIR = process.env.ROOT_DIR || path.resolve(__dirname, '../../../');
const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.FLY_APP_NAME !== undefined;

// Demo responses for when running without agent packages
const DEMO_RESPONSES: Record<string, string> = {
  'sentinel:audit': JSON.stringify({ text: 'Sentinel: Audit complete. 47 files scanned, all policies compliant. No violations detected.' }),
  'scribe:map': JSON.stringify({ text: 'Scribe: Architecture map updated. Found 12 modules, 34 components, 8 API routes.' }),
  'curator:scan': JSON.stringify({ text: 'Curator: Hygiene scan complete. 3 unused imports found, 2 orphaned files detected.' }),
  'watchman:monitor': JSON.stringify({ text: 'Watchman: All systems nominal. CPU: 23%, Memory: 1.2GB, Uptime: 47h 23m.' }),
  'librarian:index': JSON.stringify({ text: 'Librarian: Knowledge base indexed. 156 documents across 23 categories.' }),
  'envoy:plan': JSON.stringify({ text: 'Envoy: Content calendar updated for next 7 days. 12 posts scheduled.' }),
  'envoy:draft': JSON.stringify({ text: '[Twitter Draft]\nExcited to share our latest update! 🚀\n\n---\n[LinkedIn Draft]\nWe are thrilled to announce...' }),
  'ts-fixer:run': JSON.stringify({ text: 'TS-Fixer: Dry run complete. Found 5 type errors that can be auto-fixed.' }),
  'ts-fixer:fix': JSON.stringify({ text: 'TS-Fixer: Applied 5 automatic fixes. All type errors resolved.' }),
  'council:list': JSON.stringify({ text: 'Council: 3 pending proposals, 12 approved this week, 2 rejected.' }),
  'herald:run': JSON.stringify({ text: 'Herald is ready to assist. What would you like me to help with?' }),
};

// Agent command mappings (for real execution)
const AGENT_COMMANDS: Record<string, Record<string, string>> = {
  sentinel: {
    audit: 'node packages/sentinel/bin/sentinel.js audit',
  },
  scribe: {
    map: 'node packages/scribe/bin/scribe.js map',
  },
  envoy: {
    plan: 'node packages/envoy/bin/envoy.js plan',
    draft: 'node packages/envoy/bin/envoy.js draft',
  },
  'ts-fixer': {
    run: 'node packages/ts-fixer/bin/ts-fixer.js run --no-fix',
    fix: 'node packages/ts-fixer/bin/ts-fixer.js run',
  },
  watchman: {
    monitor: 'node packages/watchman/bin/watchman.js monitor',
  },
  curator: {
    scan: 'node packages/curator/bin/curator.js scan .',
  },
  librarian: {
    index: 'node packages/librarian/bin/librarian.js index',
  },
  council: {
    list: 'node packages/council/bin/council.js list',
    submit: 'node packages/council/bin/council.js submit',
  },
  herald: {
    run: 'node packages/herald/bin/herald.js run',
  },
};

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register plugins
async function registerPlugins() {
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: true, // Allow all origins (configure for production)
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
}

// API Key authentication hook
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url === '/health') return;

  const authHeader = request.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '');

  if (!apiKey || apiKey !== API_KEY) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Health check
fastify.get('/health', async () => {
  return {
    status: 'healthy',
    mode: DEMO_MODE ? 'demo' : 'live',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  };
});

// List available agents
fastify.get('/agents', async () => {
  return {
    mode: DEMO_MODE ? 'demo' : 'live',
    agents: Object.entries(AGENT_COMMANDS).map(([id, commands]) => ({
      id,
      commands: Object.keys(commands),
    })),
  };
});

// Execute agent command
interface RunBody {
  agent: string;
  command: string;
  prompt?: string;
  args?: string[];
}

fastify.post<{ Body: RunBody }>('/run', async (request, reply) => {
  const { agent, command, prompt, args } = request.body;

  if (!agent || !command) {
    return reply.code(400).send({ error: 'Missing agent or command' });
  }

  const key = `${agent}:${command}`;
  const startTime = Date.now();

  // Demo mode - return simulated responses
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 500));

    // Handle herald with prompt
    if (agent === 'herald' && prompt) {
      const responses = [
        `I understood: "${prompt}". This would be routed to the appropriate agent.`,
        `Processing: "${prompt}". Intent classification would determine the best agent.`,
        `Received: "${prompt}". In live mode, I would execute this through the agent swarm.`,
      ];
      return {
        success: true,
        output: JSON.stringify({ text: responses[Math.floor(Math.random() * responses.length)] }),
        duration: Date.now() - startTime,
        agent,
        command,
        mode: 'demo',
      };
    }

    // Return demo response
    const demoOutput = DEMO_RESPONSES[key] || JSON.stringify({ text: `Demo: ${key} executed successfully.` });
    return {
      success: true,
      output: demoOutput,
      duration: Date.now() - startTime,
      agent,
      command,
      mode: 'demo',
    };
  }

  // Live mode - execute actual commands
  const agentCommands = AGENT_COMMANDS[agent];
  if (!agentCommands) {
    return reply.code(400).send({ error: `Unknown agent: ${agent}` });
  }

  let execCmd = agentCommands[command];
  if (!execCmd) {
    return reply.code(400).send({ error: `Unknown command: ${key}` });
  }

  if (agent === 'herald' && prompt) {
    const safePrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    execCmd += ` "${safePrompt}"`;
  }

  if (args && args.length > 0) {
    const safeArgs = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
    execCmd += ` ${safeArgs}`;
  }

  try {
    fastify.log.info({ cmd: execCmd, cwd: ROOT_DIR }, 'Executing command');

    const { stdout, stderr } = await execAsync(execCmd, {
      cwd: ROOT_DIR,
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      success: true,
      output: stdout || stderr || 'Command completed successfully',
      duration: Date.now() - startTime,
      agent,
      command,
      mode: 'live',
    };
  } catch (error: any) {
    fastify.log.error({ error: error.message, cmd: execCmd }, 'Command failed');

    return reply.code(500).send({
      success: false,
      error: error.message || 'Command failed',
      output: error.stderr || error.stdout || '',
      duration: Date.now() - startTime,
      agent,
      command,
    });
  }
});

// Batch execute
interface BatchBody {
  commands: RunBody[];
}

fastify.post<{ Body: BatchBody }>('/batch', async (request, reply) => {
  const { commands } = request.body;

  if (!commands || !Array.isArray(commands)) {
    return reply.code(400).send({ error: 'Missing commands array' });
  }

  const results = await Promise.allSettled(
    commands.map(async (cmd) => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/run',
        headers: request.headers,
        payload: cmd,
      });
      return JSON.parse(response.body);
    })
  );

  return {
    results: results.map((r, i) => ({
      ...commands[i],
      ...(r.status === 'fulfilled' ? r.value : { error: r.reason }),
    })),
  };
});

// Start server
async function start() {
  try {
    await registerPlugins();
    await fastify.listen({ port: PORT, host: HOST });

    console.log(`
╔════════════════════════════════════════════════╗
║        Vorion API Backend v0.1.0               ║
╠════════════════════════════════════════════════╣
║  Mode: ${DEMO_MODE ? 'DEMO (simulated responses)' : 'LIVE (real execution)   '}
║  URL:  http://${HOST}:${PORT}
╠════════════════════════════════════════════════╣
║  Endpoints:
║    GET  /health  - Health check
║    GET  /agents  - List agents
║    POST /run     - Execute command
║    POST /batch   - Batch execute
╚════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
