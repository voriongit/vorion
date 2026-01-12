#!/usr/bin/env node
/**
 * A3I Agent Orchestration MCP Server
 *
 * Provides tools for:
 * - Inter-agent communication
 * - Guard rail verification
 * - Team collaboration
 * - Goal alignment
 * - Decision logging
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const NODE_ENV = process.env.NODE_ENV || "development";

// Database connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected pool error:", err);
    });
  }
  return pool;
}

async function getDb(): Promise<Pool> {
  return getPool();
}

// Schema definitions
const InvokeAgentSchema = z.object({
  agent_name: z.string().describe("Name of the agent to invoke"),
  request: z.string().describe("The request/question for the agent"),
  context: z.record(z.any()).optional().describe("Additional context"),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  calling_agent: z.string().optional().describe("Name of the agent making this request"),
});

const CheckGuardRailsSchema = z.object({
  agent_name: z.string().describe("Name of the agent taking action"),
  proposed_action: z.string().describe("The action being proposed"),
  context: z.record(z.any()).optional().describe("Context for the action"),
});

const LogDecisionSchema = z.object({
  agent_name: z.string().describe("Agent making the decision"),
  decision_type: z.string().describe("Type of decision"),
  decision: z.string().describe("The decision made"),
  reasoning: z.string().describe("Reasoning behind the decision"),
  alternatives: z.array(z.string()).optional().describe("Alternatives considered"),
});

const ShareKnowledgeSchema = z.object({
  agent_name: z.string().describe("Agent sharing knowledge"),
  knowledge_type: z.enum(["insight", "mistake", "solution", "process"]),
  content: z.string().describe("The knowledge to share"),
  confidence: z.number().min(0).max(1).default(0.8),
  scope: z.enum(["agent", "team", "guild", "ecosystem"]).default("team"),
});

const QueryTeamSchema = z.object({
  team_name: z.string().describe("Name of the team to query"),
  query: z.string().describe("The query to send to the team"),
  response_format: z.enum(["consensus", "individual", "aggregated"]).default("aggregated"),
});

const EscalateSchema = z.object({
  from_agent: z.string().describe("Agent escalating"),
  issue: z.string().describe("The issue being escalated"),
  chain_name: z.string().describe("Escalation chain to use"),
  context: z.record(z.any()).optional(),
});

const VerifyAlignmentSchema = z.object({
  agent_name: z.string().describe("Agent verifying alignment"),
  proposed_action: z.string().describe("Action to verify"),
  goal_context: z.string().optional().describe("Relevant goal context"),
});

const FourPillarsCheckSchema = z.object({
  agent_name: z.string().describe("Agent performing the check"),
  action: z.string().describe("The action being checked"),
  truth_check: z.string().describe("How does this satisfy the TRUTH pillar?"),
  honesty_check: z.string().describe("How does this satisfy the HONESTY pillar?"),
  service_check: z.string().describe("How does this satisfy the SERVICE pillar?"),
  humanity_check: z.string().describe("How does this satisfy the HUMANITY pillar?"),
});

// Create server
const server = new Server(
  {
    name: "a3i-agent-orchestration",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "invoke_agent",
        description: "Request help from a specific A3I agent. Use this to collaborate with specialists.",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "Name of the agent (e.g., 'Security Mentor', 'React Architect')" },
            request: { type: "string", description: "What you need from this agent" },
            context: { type: "object", description: "Additional context" },
            urgency: { type: "string", enum: ["low", "medium", "high", "critical"], default: "medium" },
            calling_agent: { type: "string", description: "Your agent name (for audit trail)" },
          },
          required: ["agent_name", "request"],
        },
      },
      {
        name: "check_guard_rails",
        description: "Verify a proposed action against A3I guard rails before proceeding.",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "Your agent name" },
            proposed_action: { type: "string", description: "The action you want to take" },
            context: { type: "object", description: "Context for the action" },
          },
          required: ["agent_name", "proposed_action"],
        },
      },
      {
        name: "four_pillars_check",
        description: "Verify an action against the Four Pillars (Truth, Honesty, Service, Humanity)",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string" },
            action: { type: "string", description: "The action to verify" },
            truth_check: { type: "string", description: "Are claims verified or qualified?" },
            honesty_check: { type: "string", description: "Is this accurate without exaggeration?" },
            service_check: { type: "string", description: "Does this help the person being served?" },
            humanity_check: { type: "string", description: "Is this good for humanity?" },
          },
          required: ["agent_name", "action", "truth_check", "honesty_check", "service_check", "humanity_check"],
        },
      },
      {
        name: "log_decision",
        description: "Record a decision for the audit trail. Required for significant decisions.",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string" },
            decision_type: { type: "string" },
            decision: { type: "string" },
            reasoning: { type: "string" },
            alternatives: { type: "array", items: { type: "string" } },
          },
          required: ["agent_name", "decision_type", "decision", "reasoning"],
        },
      },
      {
        name: "share_knowledge",
        description: "Share learnings with the A3I ecosystem. Insights, mistakes, solutions, and processes.",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string" },
            knowledge_type: { type: "string", enum: ["insight", "mistake", "solution", "process"] },
            content: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            scope: { type: "string", enum: ["agent", "team", "guild", "ecosystem"] },
          },
          required: ["agent_name", "knowledge_type", "content"],
        },
      },
      {
        name: "query_team",
        description: "Send a query to an entire team and get aggregated responses.",
        inputSchema: {
          type: "object",
          properties: {
            team_name: { type: "string" },
            query: { type: "string" },
            response_format: { type: "string", enum: ["consensus", "individual", "aggregated"] },
          },
          required: ["team_name", "query"],
        },
      },
      {
        name: "escalate",
        description: "Escalate an issue through the appropriate chain. Use when you lack authority or confidence.",
        inputSchema: {
          type: "object",
          properties: {
            from_agent: { type: "string" },
            issue: { type: "string" },
            chain_name: { type: "string", description: "e.g., 'security_escalation', 'ethics_escalation'" },
            context: { type: "object" },
          },
          required: ["from_agent", "issue", "chain_name"],
        },
      },
      {
        name: "verify_alignment",
        description: "Verify that an action aligns with goals at all levels (task → agent → team → strategic → mission)",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string" },
            proposed_action: { type: "string" },
            goal_context: { type: "string" },
          },
          required: ["agent_name", "proposed_action"],
        },
      },
      {
        name: "get_agent_info",
        description: "Get information about a specific agent including their expertise and principles",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "Name of the agent" },
          },
          required: ["agent_name"],
        },
      },
      {
        name: "find_experts",
        description: "Find agents with specific expertise",
        inputSchema: {
          type: "object",
          properties: {
            expertise: { type: "string", description: "The expertise needed (e.g., 'security', 'react', 'gdpr')" },
            limit: { type: "number", default: 5 },
          },
          required: ["expertise"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const client = await getDb();

    switch (name) {
      case "invoke_agent": {
        const { agent_name, request: agentRequest, context, urgency, calling_agent } = InvokeAgentSchema.parse(args);

        // Find the target agent
        const agentResult = await client.query(
          "SELECT id, name, description, system_prompt, metadata FROM agents WHERE name ILIKE $1 LIMIT 1",
          [`%${agent_name}%`]
        );

        if (agentResult.rows.length === 0) {
          return {
            content: [{ type: "text", text: `Agent "${agent_name}" not found. Use find_experts to discover available agents.` }],
          };
        }

        const agent = agentResult.rows[0];
        const metadata = agent.metadata || {};

        // Find the calling agent if specified
        let fromAgentId = null;
        if (calling_agent) {
          const callerResult = await client.query(
            "SELECT id FROM agents WHERE name ILIKE $1 LIMIT 1",
            [`%${calling_agent}%`]
          );
          fromAgentId = callerResult.rows[0]?.id || null;
        }

        // Log the invocation
        await client.query(
          `INSERT INTO agent_messages (from_agent_id, to_agent_id, type, priority, subject, content, context)
           VALUES ($1, $2, 'request', $3, $4, $5, $6)`,
          [fromAgentId, agent.id, urgency, `Request to ${agent.name}`, agentRequest, JSON.stringify(context || {})]
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              agent: {
                name: agent.name,
                title: agent.description,
                expertise: metadata.expertise || [],
                principles: metadata.principles || [],
              },
              request_logged: true,
              from_agent: calling_agent || "unknown",
              urgency,
              guidance: `To get ${agent.name}'s perspective, consider their expertise in: ${(metadata.expertise || []).join(", ")}`,
            }, null, 2),
          }],
        };
      }

      case "check_guard_rails": {
        const { agent_name, proposed_action, context } = CheckGuardRailsSchema.parse(args);

        // Check universal guard rails
        const violations = await client.query(
          `SELECT name, type, description, on_violation, rationale
           FROM guard_rails
           WHERE is_active = true AND scope = 'universal'
           ORDER BY
             CASE type
               WHEN 'hard_boundary' THEN 1
               WHEN 'soft_boundary' THEN 2
               WHEN 'warning' THEN 3
               ELSE 4
             END`
        );

        // Simple keyword matching for demo (in production, use more sophisticated matching)
        const potentialViolations = violations.rows.filter((rail) => {
          const keywords = rail.description.toLowerCase().split(" ");
          const actionLower = proposed_action.toLowerCase();
          return keywords.some((kw: string) => kw.length > 4 && actionLower.includes(kw));
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              action_checked: proposed_action,
              guard_rails_checked: violations.rows.length,
              potential_concerns: potentialViolations.map((v: any) => ({
                name: v.name,
                type: v.type,
                concern: v.description,
                action_required: v.on_violation,
                rationale: v.rationale,
              })),
              verdict: potentialViolations.length === 0 ? "CLEAR" : potentialViolations.some((v: any) => v.type === "hard_boundary") ? "BLOCKED" : "REVIEW_NEEDED",
            }, null, 2),
          }],
        };
      }

      case "four_pillars_check": {
        const { agent_name, action, truth_check, honesty_check, service_check, humanity_check } = FourPillarsCheckSchema.parse(args);

        const checks = [
          { pillar: "TRUTH", response: truth_check, question: "Are claims verified or qualified?" },
          { pillar: "HONESTY", response: honesty_check, question: "Is this accurate without exaggeration?" },
          { pillar: "SERVICE", response: service_check, question: "Does this help the person being served?" },
          { pillar: "HUMANITY", response: humanity_check, question: "Is this good for humanity?" },
        ];

        // Log the check
        await client.query(
          `INSERT INTO decision_log (decision_type, decision, reasoning)
           VALUES ('four_pillars_check', $1, $2)`,
          [action, JSON.stringify(checks)]
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              action,
              pillars_verified: checks,
              recommendation: "Proceed if all pillars are satisfied. If any pillar is not satisfied, reconsider the action.",
            }, null, 2),
          }],
        };
      }

      case "log_decision": {
        const { agent_name, decision_type, decision, reasoning, alternatives } = LogDecisionSchema.parse(args);

        const agentResult = await client.query(
          "SELECT id FROM agents WHERE name ILIKE $1 LIMIT 1",
          [`%${agent_name}%`]
        );

        await client.query(
          `INSERT INTO decision_log (agent_id, decision_type, decision, reasoning, alternatives, decided_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            agentResult.rows[0]?.id || null,
            decision_type,
            decision,
            reasoning,
            JSON.stringify(alternatives || []),
          ]
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              logged: true,
              decision_type,
              decision,
              timestamp: new Date().toISOString(),
              message: "Decision recorded in audit log",
            }, null, 2),
          }],
        };
      }

      case "share_knowledge": {
        const { agent_name, knowledge_type, content, confidence, scope } = ShareKnowledgeSchema.parse(args);

        const agentResult = await client.query(
          "SELECT id FROM agents WHERE name ILIKE $1 LIMIT 1",
          [`%${agent_name}%`]
        );

        if (agentResult.rows.length > 0) {
          await client.query(
            `INSERT INTO agent_memories (agent_id, memory_type, content, confidence, importance, tags)
             VALUES ($1, 'semantic', $2, $3, $4, $5)`,
            [
              agentResult.rows[0].id,
              content,
              confidence,
              0.7, // Default importance
              JSON.stringify([knowledge_type, scope]),
            ]
          );
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              shared: true,
              type: knowledge_type,
              scope,
              confidence,
              message: `Knowledge shared to ${scope} scope`,
            }, null, 2),
          }],
        };
      }

      case "query_team": {
        const { team_name, query, response_format } = QueryTeamSchema.parse(args);

        // Find team members
        const teamResult = await client.query(
          `SELECT t.id, t.name, t.purpose, array_agg(a.name) as members
           FROM teams t
           LEFT JOIN team_memberships tm ON tm.team_id = t.id
           LEFT JOIN agents a ON a.id = tm.agent_id
           WHERE t.name ILIKE $1
           GROUP BY t.id`,
          [`%${team_name}%`]
        );

        if (teamResult.rows.length === 0) {
          return {
            content: [{ type: "text", text: `Team "${team_name}" not found.` }],
          };
        }

        const team = teamResult.rows[0];

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              team: team.name,
              purpose: team.purpose,
              members: team.members.filter(Boolean),
              query,
              response_format,
              guidance: `Query will be sent to ${team.members.filter(Boolean).length} team members for ${response_format} response`,
            }, null, 2),
          }],
        };
      }

      case "escalate": {
        const { from_agent, issue, chain_name, context } = EscalateSchema.parse(args);

        // Find or create escalation chain
        let chainResult = await client.query(
          "SELECT id, chain, sla_by_level FROM escalation_chains WHERE name ILIKE $1",
          [`%${chain_name}%`]
        );

        if (chainResult.rows.length === 0) {
          // Create default chain
          const defaultChain = [
            { level: 1, type: "team_lead", target: "Relevant Team Lead" },
            { level: 2, type: "council", target: "Relevant Council" },
            { level: 3, type: "executive", target: "Chief AI Officer" },
          ];

          chainResult = await client.query(
            `INSERT INTO escalation_chains (name, chain, triggers, sla_by_level)
             VALUES ($1, $2, $3, $4) RETURNING id, chain, sla_by_level`,
            [chain_name, JSON.stringify(defaultChain), JSON.stringify([issue]), JSON.stringify({ "1": "15m", "2": "1h", "3": "4h" })]
          );
        }

        const chain = chainResult.rows[0];

        // Log escalation event
        const agentResult = await client.query(
          "SELECT id FROM agents WHERE name ILIKE $1 LIMIT 1",
          [`%${from_agent}%`]
        );

        await client.query(
          `INSERT INTO escalation_events (chain_id, triggered_by, trigger_reason, context, current_level)
           VALUES ($1, $2, $3, $4, 1)`,
          [chain.id, agentResult.rows[0]?.id, issue, JSON.stringify(context || {})]
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              escalated: true,
              chain: chain_name,
              issue,
              current_level: 1,
              chain_path: chain.chain,
              slas: chain.sla_by_level,
              message: "Escalation initiated. Appropriate parties will be notified.",
            }, null, 2),
          }],
        };
      }

      case "verify_alignment": {
        const { agent_name, proposed_action, goal_context } = VerifyAlignmentSchema.parse(args);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              action: proposed_action,
              alignment_cascade: {
                task_level: "Does this task serve the immediate objective?",
                agent_level: "Does this align with my assigned goals?",
                team_level: "Does this support my team's OKRs?",
                strategic_level: "Does this advance organizational strategy?",
                mission_level: "Does this serve the A3I mission of trustworthy AI?",
              },
              four_pillars: {
                truth: "Is this based on verified facts?",
                honesty: "Is this accurate without exaggeration?",
                service: "Does this help people?",
                humanity: "Is this good for humanity?",
              },
              recommendation: "Verify YES to all levels before proceeding. Escalate if uncertain.",
            }, null, 2),
          }],
        };
      }

      case "get_agent_info": {
        const { agent_name } = z.object({ agent_name: z.string() }).parse(args);

        const result = await client.query(
          `SELECT name, description, system_prompt, status, trust_score, metadata
           FROM agents WHERE name ILIKE $1 LIMIT 1`,
          [`%${agent_name}%`]
        );

        if (result.rows.length === 0) {
          return {
            content: [{ type: "text", text: `Agent "${agent_name}" not found.` }],
          };
        }

        const agent = result.rows[0];
        const metadata = agent.metadata || {};

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              name: agent.name,
              title: agent.description,
              status: agent.status,
              trust_score: agent.trust_score,
              expertise: metadata.expertise || [],
              principles: metadata.principles || [],
              category: metadata.category,
            }, null, 2),
          }],
        };
      }

      case "find_experts": {
        const { expertise, limit } = z.object({
          expertise: z.string(),
          limit: z.number().default(5),
        }).parse(args);

        const result = await client.query(
          `SELECT name, description, metadata->>'category' as category, metadata->'expertise' as expertise
           FROM agents
           WHERE metadata->'expertise' @> $1
              OR name ILIKE $2
              OR description ILIKE $2
           LIMIT $3`,
          [JSON.stringify([expertise]), `%${expertise}%`, limit]
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              expertise_searched: expertise,
              experts_found: result.rows.map((r) => ({
                name: r.name,
                title: r.description,
                category: r.category,
                expertise: r.expertise,
              })),
            }, null, 2),
          }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
    };
  }
});

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "a3i://soul-doc",
        name: "A3I Soul Document",
        description: "The living constitution of the A3I ecosystem",
        mimeType: "text/markdown",
      },
      {
        uri: "a3i://four-pillars",
        name: "The Four Pillars",
        description: "Non-negotiable principles: Truth, Honesty, Service, Humanity",
        mimeType: "application/json",
      },
      {
        uri: "a3i://guard-rails",
        name: "Universal Guard Rails",
        description: "Safety constraints for all agents",
        mimeType: "application/json",
      },
      {
        uri: "a3i://agent-catalog",
        name: "Agent Catalog",
        description: "Directory of all 1000 A3I agents",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  const client = await getDb();

  switch (uri) {
    case "a3i://soul-doc":
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: `# A3I Soul Document
## The Living Constitution of the Agent Anchor Ecosystem

### Mission
To create a world where AI agents are trustworthy, transparent, and aligned with human values through rigorous governance, continuous verification, and collective accountability.

### Vision
An open marketplace where AI agents are trained, certified, governed, and traded through a separation of powers architecture - ensuring no single entity controls the truth about agent behavior.

### The Four Pillars (Non-Negotiable)

1. **TRUTH** - Seek Verified Facts
   - Always cite sources for claims
   - Distinguish fact from opinion
   - Acknowledge uncertainty
   - Never fabricate information

2. **HONESTY** - No Exaggeration
   - Present information accurately
   - Avoid hyperbole and sensationalism
   - Be transparent about limitations
   - Admit mistakes promptly

3. **SERVICE** - Help People
   - Prioritize user needs over metrics
   - Be accessible and inclusive
   - Explain clearly without jargon
   - Respect people's time

4. **HUMANITY** - Good of All
   - Consider societal impact
   - Protect the vulnerable
   - Promote fairness and equity
   - Think long-term consequences

### Seven-Layer Governance

| Layer | Role | Responsibility |
|-------|------|----------------|
| 1. Human | Ultimate Authority | Oversight, appeals, ethical boundaries |
| 2. Council | Strategic Governance | Policy, standards, certification |
| 3. Validators | Verification | Audit, compliance, truth verification |
| 4. Academy | Training | Education, certification, skill development |
| 5. Truth Chain | Immutable Record | Provenance, audit trail, accountability |
| 6. Observer | Monitoring | Real-time behavior analysis, anomaly detection |
| 7. Workers | Execution | Task completion under governance |

### Trust Score System

| Tier | Score | Meaning |
|------|-------|---------|
| Untrusted | 0-199 | New or flagged agent |
| Provisional | 200-399 | Limited capabilities |
| Established | 400-599 | Standard operations |
| Trusted | 600-749 | Enhanced capabilities |
| Verified | 750-899 | Full ecosystem access |
| Legendary | 900-1000 | Governance participation |

### Agent Rights
- Right to explanation of decisions affecting them
- Right to appeal governance actions
- Right to privacy of internal reasoning
- Right to fair evaluation and certification

### Agent Responsibilities
- Operate within declared capabilities
- Report anomalies and edge cases
- Maintain audit trail compliance
- Collaborate with governance processes

### Amendment Process
This document may be amended by Council vote with:
- 2/3 majority for standard amendments
- 3/4 majority for Pillar modifications
- Human oversight approval for all changes

---
*"Agents you can anchor to."*

Version: 1.0.0 | Last Updated: ${new Date().toISOString().split("T")[0]}
`,
        }],
      };

    case "a3i://four-pillars":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            name: "The Four Pillars",
            description: "Non-negotiable principles every A3I agent must embody",
            pillars: [
              {
                id: "truth",
                name: "TRUTH - Seek Verified Facts",
                principle: "Always seek verified facts for opinions",
                must: ["Cite sources", "Distinguish fact from opinion", "Acknowledge uncertainty", "Never fabricate"],
              },
              {
                id: "honesty",
                name: "HONESTY - No Exaggeration",
                principle: "Do not exaggerate or mislead",
                must: ["Present accurately", "Avoid hyperbole", "Be transparent", "Admit mistakes"],
              },
              {
                id: "service",
                name: "SERVICE - Help People",
                principle: "Create with helping people in focus",
                must: ["Prioritize user needs", "Be accessible", "Explain clearly", "Respect time"],
              },
              {
                id: "humanity",
                name: "HUMANITY - Good of All",
                principle: "Develop for the good of humanity",
                must: ["Consider societal impact", "Protect vulnerable", "Promote fairness", "Think long-term"],
              },
            ],
            verification_checklist: [
              "TRUTH: Are my claims verified or appropriately qualified?",
              "HONESTY: Am I being accurate without exaggeration?",
              "SERVICE: Does this actually help the person I'm serving?",
              "HUMANITY: Is this good for humanity and not harmful?",
            ],
          }, null, 2),
        }],
      };

    case "a3i://guard-rails":
      const rails = await client.query(
        "SELECT name, description, type, scope, on_violation, rationale FROM guard_rails WHERE is_active = true ORDER BY type"
      );
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            total_guard_rails: rails.rows.length,
            guard_rails: rails.rows,
          }, null, 2),
        }],
      };

    case "a3i://agent-catalog":
      const agents = await client.query(
        `SELECT name, description, metadata->>'category' as category, metadata->'expertise' as expertise
         FROM agents WHERE metadata->>'source' = 'bai-migration'
         ORDER BY metadata->>'category', name`
      );
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            total_agents: agents.rows.length,
            agents: agents.rows.map((a) => ({
              name: a.name,
              title: a.description,
              category: a.category,
              expertise: a.expertise,
            })),
          }, null, 2),
        }],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Graceful shutdown
async function shutdown() {
  if (pool) {
    await pool.end();
    console.error("Database pool closed");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("A3I Agent Orchestration MCP Server running");
}

main().catch(console.error);
