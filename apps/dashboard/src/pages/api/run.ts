import type { NextApiRequest, NextApiResponse } from 'next'
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// Environment detection
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

// External API backend configuration
const API_BACKEND_URL = process.env.VORION_API_URL;
const API_BACKEND_KEY = process.env.VORION_API_KEY;

// Demo responses for pure demo/offline mode
const DEMO_RESPONSES: Record<string, string> = {
  'sentinel:audit': JSON.stringify({ text: 'Sentinel: Audit complete. No violations detected. 47 files scanned, all policies compliant.' }),
  'scribe:map': JSON.stringify({ text: 'Scribe: Architecture map updated. Found 12 modules, 34 components, 8 API routes.' }),
  'curator:scan': JSON.stringify({ text: 'Curator: Hygiene scan complete. 3 unused imports found, 2 orphaned files detected.' }),
  'watchman:monitor': JSON.stringify({ text: 'Watchman: All systems nominal. CPU: 23%, Memory: 1.2GB, Uptime: 47h.' }),
  'librarian:index': JSON.stringify({ text: 'Librarian: Knowledge base indexed. 156 documents, 23 categories, fully searchable.' }),
  'envoy:plan': JSON.stringify({ text: 'Envoy: Content calendar updated for next 7 days. 12 posts scheduled.' }),
  'ts-fixer:run': JSON.stringify({ text: 'TS-Fixer: Dry run complete. Found 5 type errors that can be auto-fixed.' }),
};

// Call external API backend
async function callBackendAPI(agent: string, command: string, prompt?: string): Promise<{ output?: string; error?: string }> {
  if (!API_BACKEND_URL || !API_BACKEND_KEY) {
    throw new Error('API backend not configured');
  }

  const response = await fetch(`${API_BACKEND_URL}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_BACKEND_KEY}`,
    },
    body: JSON.stringify({ agent, command, prompt }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Backend API error');
  }

  return { output: data.output };
}

// Demo mode response
function getDemoResponse(agent: string, command: string, prompt?: string): string {
  const key = `${agent}:${command}`;

  if (agent === 'herald' && prompt) {
    const responses = [
      `I understood your request: "${prompt}". In demo mode, I can show you how the system routes commands.`,
      `Processing: "${prompt}". This would be routed to the appropriate agent based on intent classification.`,
      `Received: "${prompt}". Connect a backend API to enable full agent execution.`,
    ];
    return JSON.stringify({ text: responses[Math.floor(Math.random() * responses.length)] });
  }

  return DEMO_RESPONSES[key] || JSON.stringify({ text: `Demo mode: ${key} would execute here with full agent capabilities.` });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { agent, command, prompt } = req.body;

  // Priority 1: Try external API backend (works everywhere)
  if (API_BACKEND_URL && API_BACKEND_KEY) {
    try {
      const result = await callBackendAPI(agent, command, prompt);
      res.status(200).json(result);
      return;
    } catch (error: any) {
      // Log but continue to fallback
      console.error('Backend API failed:', error.message);
    }
  }

  // Priority 2: Local execution (only works locally, not on Vercel)
  if (!isServerless) {
    const validMap: Record<string, string> = {
      'sentinel:audit': 'node packages/sentinel/bin/sentinel.js audit',
      'scribe:map': 'node packages/scribe/bin/scribe.js map',
      'envoy:plan': 'node packages/envoy/bin/envoy.js plan',
      'ts-fixer:run': 'node packages/ts-fixer/bin/ts-fixer.js run --no-fix',
      'watchman:monitor': 'node packages/watchman/bin/watchman.js monitor',
      'curator:scan': 'node packages/curator/bin/curator.js scan .',
      'librarian:index': 'node packages/librarian/bin/librarian.js index',
      'council:list': 'node packages/council/bin/council.js list',
      'council:submit-test': 'node packages/council/bin/council.js submit ts-fixer "Test Proposal" HIGH',
      'herald:run': 'node packages/herald/bin/herald.js run'
    };

    const key = `${agent}:${command}`;
    let execCmd = validMap[key];

    if (execCmd) {
      if (agent === 'herald' && prompt) {
        const safePrompt = prompt.replace(/"/g, '\\"');
        execCmd += ` "${safePrompt}"`;
      }

      const rootDir = path.resolve(process.cwd(), '../../');

      try {
        const { stdout, stderr } = await execAsync(execCmd, { cwd: rootDir, timeout: 60000 });
        res.status(200).json({ output: stderr && !stdout ? stderr : stdout || 'Command completed successfully' });
        return;
      } catch (error: any) {
        res.status(500).json({
          error: error.message || 'Command failed',
          output: error.stderr || error.stdout || ''
        });
        return;
      }
    }
  }

  // Priority 3: Demo mode (serverless or no valid command)
  await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
  res.status(200).json({ output: getDemoResponse(agent, command, prompt) });
}
