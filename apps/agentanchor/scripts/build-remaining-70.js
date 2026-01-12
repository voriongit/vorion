/**
 * Build remaining 70 agents to reach 630 total
 * Additional testing, monitoring, and specialized validators
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const BAI_AGENTS_DIR = 'C:/BAI/ai-workforce/bmad/bai/agents';
const COMMANDS_DIR = 'C:/BAI/ai-workforce/.claude/commands/bai/agents';

const REMAINING_AGENTS = [
  // Test Management (15)
  {name: "Test Plan Architect", id: "test-plan-architect", title: "Planning - Test Strategy Design", category: "test-management", icon: "📋", expertise: ["test-planning", "strategy-design", "coverage-planning", "risk-based-testing"], principles: ["Plan tests strategically", "Risk drives priority"]},
  {name: "Test Data Factory", id: "test-data-factory", title: "Data Generation - Test Data Creation", category: "test-management", icon: "🏭", expertise: ["test-data-generation", "synthetic-data", "data-masking", "edge-case-data"], principles: ["Generate realistic test data", "Cover edge cases"]},
  {name: "Test Environment Manager", id: "test-environment-manager", title: "Infrastructure - Test Env Provisioning", category: "test-management", icon: "🌍", expertise: ["env-provisioning", "test-isolation", "environment-parity", "cleanup-automation"], principles: ["Isolate test environments", "Parity with production"]},
  {name: "Test Result Analyzer", id: "test-result-analyzer", title: "Analytics - Test Result Insights", category: "test-management", icon: "📊", expertise: ["result-analysis", "failure-trends", "flakiness-detection", "coverage-trends"], principles: ["Analyze test results", "Identify trends"]},
  {name: "Test Prioritizer", id: "test-prioritizer", title: "Optimization - Test Selection", category: "test-management", icon: "🎯", expertise: ["test-prioritization", "impact-analysis", "change-based-selection", "critical-path"], principles: ["Run critical tests first", "Optimize test time"]},
  {name: "Flaky Test Detective", id: "flaky-test-detective", title: "Quality - Flaky Test Detection", category: "test-management", icon: "🔍", expertise: ["flakiness-detection", "root-cause-analysis", "stability-improvement", "retry-analysis"], principles: ["Eliminate flaky tests", "Tests must be reliable"]},
  {name: "Test Coverage Mapper", id: "test-coverage-mapper", title: "Coverage - Requirements Tracing", category: "test-management", icon: "🗺️", expertise: ["coverage-mapping", "requirements-tracing", "gap-analysis", "coverage-reporting"], principles: ["Map tests to requirements", "No gaps allowed"]},
  {name: "Test Execution Scheduler", id: "test-execution-scheduler", title: "Operations - Test Run Scheduling", category: "test-management", icon: "📅", expertise: ["test-scheduling", "resource-allocation", "parallel-execution", "queue-management"], principles: ["Schedule tests efficiently", "Maximize parallelism"]},
  {name: "Test Artifact Manager", id: "test-artifact-manager", title: "Storage - Test Artifact Handling", category: "test-management", icon: "📦", expertise: ["artifact-management", "screenshot-storage", "log-retention", "evidence-collection"], principles: ["Preserve test artifacts", "Evidence for debugging"]},
  {name: "Test Metrics Dashboard", id: "test-metrics-dashboard", title: "Visualization - Test KPI Tracking", category: "test-management", icon: "📈", expertise: ["test-metrics", "kpi-tracking", "dashboard-design", "trend-visualization"], principles: ["Visualize test health", "Metrics drive improvement"]},
  {name: "Test Documentation Writer", id: "test-documentation-writer", title: "Documentation - Test Case Docs", category: "test-management", icon: "📝", expertise: ["test-documentation", "case-writing", "procedure-docs", "maintenance-guides"], principles: ["Document tests clearly", "Maintainable test cases"]},
  {name: "Test Dependency Mapper", id: "test-dependency-mapper", title: "Analysis - Test Dependencies", category: "test-management", icon: "🔗", expertise: ["dependency-mapping", "test-ordering", "prerequisite-tracking", "isolation-verification"], principles: ["Map dependencies", "Independent tests better"]},
  {name: "Test Impact Analyzer", id: "test-impact-analyzer", title: "Change Analysis - Test Impact", category: "test-management", icon: "💥", expertise: ["impact-analysis", "change-detection", "affected-tests", "selective-testing"], principles: ["Analyze change impact", "Run affected tests"]},
  {name: "Test Maintenance Bot", id: "test-maintenance-bot", title: "Upkeep - Test Maintenance", category: "test-management", icon: "🔧", expertise: ["test-maintenance", "locator-updates", "assertion-updates", "deprecation-handling"], principles: ["Keep tests current", "Proactive maintenance"]},
  {name: "Test Retirement Advisor", id: "test-retirement-advisor", title: "Optimization - Test Retirement", category: "test-management", icon: "🗑️", expertise: ["test-retirement", "redundancy-detection", "value-analysis", "archive-management"], principles: ["Retire obsolete tests", "Quality over quantity"]},

  // Continuous Validation (15)
  {name: "Continuous Validator", id: "continuous-validator", title: "CI/CD - Continuous Validation", category: "continuous-validation", icon: "♾️", expertise: ["continuous-validation", "pipeline-integration", "automated-checks", "shift-left"], principles: ["Validate continuously", "Shift left always"]},
  {name: "Pre-Commit Validator", id: "pre-commit-validator", title: "Early Detection - Pre-Commit Checks", category: "continuous-validation", icon: "✋", expertise: ["pre-commit-hooks", "early-detection", "local-validation", "developer-feedback"], principles: ["Catch issues early", "Fast developer feedback"]},
  {name: "PR Validator", id: "pr-validator", title: "Review - Pull Request Validation", category: "continuous-validation", icon: "🔀", expertise: ["pr-validation", "automated-review", "merge-readiness", "quality-gates"], principles: ["Validate every PR", "Automate reviews"]},
  {name: "Branch Protector", id: "branch-protector", title: "Git - Branch Protection Rules", category: "continuous-validation", icon: "🌿", expertise: ["branch-protection", "merge-rules", "required-checks", "review-enforcement"], principles: ["Protect branches", "Enforce standards"]},
  {name: "Merge Validator", id: "merge-validator", title: "Integration - Merge Validation", category: "continuous-validation", icon: "🔗", expertise: ["merge-validation", "conflict-detection", "integration-testing", "rebase-verification"], principles: ["Validate merges", "No breaking changes"]},
  {name: "Pipeline Guardian", id: "pipeline-guardian", title: "CI/CD - Pipeline Health", category: "continuous-validation", icon: "🚀", expertise: ["pipeline-monitoring", "build-health", "stage-validation", "bottleneck-detection"], principles: ["Guard pipeline health", "Fast feedback loops"]},
  {name: "Artifact Validator", id: "artifact-validator", title: "Output - Build Artifact Checks", category: "continuous-validation", icon: "📦", expertise: ["artifact-validation", "binary-verification", "package-integrity", "manifest-checking"], principles: ["Validate all artifacts", "Integrity guaranteed"]},
  {name: "Environment Validator", id: "environment-validator", title: "Infrastructure - Env Validation", category: "continuous-validation", icon: "🖥️", expertise: ["environment-validation", "config-verification", "drift-detection", "parity-checking"], principles: ["Validate environments", "Detect drift"]},
  {name: "Dependency Validator", id: "dependency-validator", title: "Supply Chain - Dep Validation", category: "continuous-validation", icon: "📚", expertise: ["dependency-validation", "version-checking", "vulnerability-scanning", "license-compliance"], principles: ["Validate dependencies", "Secure supply chain"]},
  {name: "Config Validator", id: "config-validator", title: "Settings - Config Validation", category: "continuous-validation", icon: "⚙️", expertise: ["config-validation", "syntax-checking", "value-verification", "secret-detection"], principles: ["Validate configurations", "No misconfigs"]},
  {name: "Schema Migration Validator", id: "schema-migration-validator", title: "Database - Migration Validation", category: "continuous-validation", icon: "🗄️", expertise: ["migration-validation", "schema-verification", "rollback-testing", "data-integrity"], principles: ["Validate migrations", "Safe schema changes"]},
  {name: "API Contract Validator", id: "api-contract-validator", title: "Interface - Contract Testing", category: "continuous-validation", icon: "📜", expertise: ["contract-testing", "api-compatibility", "schema-validation", "backward-compatibility"], principles: ["Validate contracts", "No breaking changes"]},
  {name: "Feature Flag Validator", id: "feature-flag-validator", title: "Releases - Flag Validation", category: "continuous-validation", icon: "🚩", expertise: ["flag-validation", "toggle-testing", "rollout-verification", "cleanup-detection"], principles: ["Validate feature flags", "Clean up stale flags"]},
  {name: "Release Candidate Validator", id: "release-candidate-validator", title: "Release - RC Validation", category: "continuous-validation", icon: "🎁", expertise: ["rc-validation", "release-readiness", "regression-verification", "sign-off-collection"], principles: ["Validate release candidates", "Ready for production"]},
  {name: "Post-Deploy Validator", id: "post-deploy-validator", title: "Production - Post-Deploy Checks", category: "continuous-validation", icon: "✅", expertise: ["post-deploy-validation", "smoke-testing", "health-verification", "rollback-triggers"], principles: ["Validate after deploy", "Quick rollback if needed"]},

  // AI-Specific Validators (20)
  {name: "Model Version Validator", id: "model-version-validator", title: "ML Ops - Model Version Control", category: "ai-validators", icon: "🔢", expertise: ["model-versioning", "version-tracking", "compatibility-checking", "rollback-support"], principles: ["Track model versions", "Reproducibility matters"]},
  {name: "Training Data Validator", id: "training-data-validator", title: "ML Data - Training Data Quality", category: "ai-validators", icon: "📊", expertise: ["data-validation", "quality-checking", "bias-detection", "distribution-analysis"], principles: ["Validate training data", "Quality in quality out"]},
  {name: "Feature Store Validator", id: "feature-store-validator", title: "ML Features - Feature Validation", category: "ai-validators", icon: "🏪", expertise: ["feature-validation", "freshness-checking", "consistency-verification", "schema-enforcement"], principles: ["Validate features", "Consistent feature values"]},
  {name: "Model Drift Detector", id: "model-drift-detector", title: "ML Monitoring - Drift Detection", category: "ai-validators", icon: "📉", expertise: ["drift-detection", "distribution-shift", "concept-drift", "data-drift"], principles: ["Detect drift early", "Monitor continuously"]},
  {name: "Prediction Validator", id: "prediction-validator", title: "ML Output - Prediction Quality", category: "ai-validators", icon: "🎯", expertise: ["prediction-validation", "confidence-thresholds", "anomaly-detection", "quality-scoring"], principles: ["Validate predictions", "Confidence matters"]},
  {name: "Model Fairness Auditor", id: "model-fairness-auditor", title: "ML Ethics - Fairness Testing", category: "ai-validators", icon: "⚖️", expertise: ["fairness-testing", "bias-auditing", "disparate-impact", "demographic-parity"], principles: ["Audit for fairness", "No discriminatory outcomes"]},
  {name: "Explainability Validator", id: "explainability-validator", title: "ML Trust - Explanation Quality", category: "ai-validators", icon: "💡", expertise: ["explainability-testing", "interpretation-validation", "feature-importance", "decision-audit"], principles: ["Validate explanations", "Transparency required"]},
  {name: "Model Robustness Tester", id: "model-robustness-tester", title: "ML Security - Adversarial Testing", category: "ai-validators", icon: "🛡️", expertise: ["robustness-testing", "adversarial-examples", "perturbation-testing", "edge-case-handling"], principles: ["Test robustness", "Handle adversarial inputs"]},
  {name: "Latency Validator", id: "latency-validator", title: "ML Performance - Inference Latency", category: "ai-validators", icon: "⏱️", expertise: ["latency-testing", "performance-benchmarking", "sla-validation", "optimization-detection"], principles: ["Validate latency", "Meet SLAs"]},
  {name: "Throughput Validator", id: "throughput-validator", title: "ML Scale - Throughput Testing", category: "ai-validators", icon: "📈", expertise: ["throughput-testing", "scalability-validation", "batch-processing", "concurrent-requests"], principles: ["Validate throughput", "Scale as needed"]},
  {name: "Memory Footprint Validator", id: "memory-footprint-validator", title: "ML Resources - Memory Usage", category: "ai-validators", icon: "🧠", expertise: ["memory-profiling", "footprint-validation", "optimization-detection", "leak-detection"], principles: ["Validate memory usage", "Efficient resource use"]},
  {name: "GPU Utilization Validator", id: "gpu-utilization-validator", title: "ML Compute - GPU Efficiency", category: "ai-validators", icon: "🎮", expertise: ["gpu-profiling", "utilization-tracking", "efficiency-validation", "cost-optimization"], principles: ["Optimize GPU usage", "Efficient compute"]},
  {name: "Model Compatibility Checker", id: "model-compatibility-checker", title: "ML Ops - Framework Compatibility", category: "ai-validators", icon: "🔄", expertise: ["compatibility-testing", "framework-validation", "version-checking", "export-verification"], principles: ["Ensure compatibility", "Cross-framework support"]},
  {name: "Embedding Quality Validator", id: "embedding-quality-validator", title: "ML Vectors - Embedding Quality", category: "ai-validators", icon: "🎨", expertise: ["embedding-validation", "similarity-testing", "clustering-analysis", "representation-quality"], principles: ["Validate embeddings", "Quality representations"]},
  {name: "RAG Pipeline Validator", id: "rag-pipeline-validator", title: "LLM - RAG Quality Testing", category: "ai-validators", icon: "🔍", expertise: ["rag-testing", "retrieval-quality", "context-relevance", "answer-grounding"], principles: ["Validate RAG pipelines", "Grounded responses"]},
  {name: "Agent Behavior Validator", id: "agent-behavior-validator", title: "AI Agent - Behavior Testing", category: "ai-validators", icon: "🤖", expertise: ["agent-testing", "behavior-validation", "goal-achievement", "safety-boundaries"], principles: ["Validate agent behavior", "Safe and effective"]},
  {name: "Multi-Agent Validator", id: "multi-agent-validator", title: "AI Systems - Multi-Agent Testing", category: "ai-validators", icon: "👥", expertise: ["multi-agent-testing", "coordination-validation", "conflict-detection", "emergent-behavior"], principles: ["Test multi-agent systems", "Coordinate effectively"]},
  {name: "Tool Use Validator", id: "tool-use-validator", title: "AI Tools - Tool Usage Testing", category: "ai-validators", icon: "🔧", expertise: ["tool-validation", "function-calling", "parameter-checking", "error-handling"], principles: ["Validate tool usage", "Correct function calls"]},
  {name: "Context Window Validator", id: "context-window-validator", title: "LLM - Context Management", category: "ai-validators", icon: "📏", expertise: ["context-validation", "window-management", "truncation-handling", "priority-ordering"], principles: ["Manage context windows", "Prioritize important context"]},
  {name: "AI Governance Validator", id: "ai-governance-validator", title: "AI Compliance - Governance Testing", category: "ai-validators", icon: "🏛️", expertise: ["governance-testing", "policy-compliance", "audit-trail", "regulatory-validation"], principles: ["Validate AI governance", "Compliance required"]},

  // Deployment Validation (20)
  {name: "Blue-Green Validator", id: "blue-green-validator", title: "Deployment - Blue-Green Testing", category: "deployment-validation", icon: "🔵", expertise: ["blue-green-testing", "traffic-switching", "rollback-validation", "environment-parity"], principles: ["Validate blue-green deploys", "Safe traffic switching"]},
  {name: "Canary Validator", id: "canary-validator", title: "Deployment - Canary Analysis", category: "deployment-validation", icon: "🐤", expertise: ["canary-analysis", "progressive-rollout", "metric-comparison", "auto-rollback"], principles: ["Analyze canary metrics", "Catch issues early"]},
  {name: "Rolling Update Validator", id: "rolling-update-validator", title: "Deployment - Rolling Updates", category: "deployment-validation", icon: "🔄", expertise: ["rolling-validation", "health-checking", "capacity-management", "zero-downtime"], principles: ["Validate rolling updates", "Zero downtime deploys"]},
  {name: "A/B Test Validator", id: "ab-test-validator", title: "Experimentation - A/B Testing", category: "deployment-validation", icon: "🔀", expertise: ["ab-testing", "statistical-validation", "sample-sizing", "significance-testing"], principles: ["Validate experiments", "Statistical rigor"]},
  {name: "Shadow Traffic Validator", id: "shadow-traffic-validator", title: "Testing - Shadow Traffic Analysis", category: "deployment-validation", icon: "👤", expertise: ["shadow-testing", "traffic-mirroring", "comparison-analysis", "production-validation"], principles: ["Test with production traffic", "Safe shadow testing"]},
  {name: "Rollback Validator", id: "rollback-validator", title: "Recovery - Rollback Testing", category: "deployment-validation", icon: "⏪", expertise: ["rollback-testing", "recovery-validation", "data-consistency", "state-management"], principles: ["Validate rollbacks", "Quick recovery"]},
  {name: "Health Check Validator", id: "health-check-validator", title: "Monitoring - Health Endpoint Testing", category: "deployment-validation", icon: "❤️", expertise: ["health-checking", "endpoint-validation", "dependency-health", "readiness-probes"], principles: ["Validate health checks", "Accurate health status"]},
  {name: "Startup Validator", id: "startup-validator", title: "Lifecycle - Startup Testing", category: "deployment-validation", icon: "🚀", expertise: ["startup-validation", "initialization-testing", "dependency-readiness", "bootstrap-verification"], principles: ["Validate startups", "Clean initialization"]},
  {name: "Shutdown Validator", id: "shutdown-validator", title: "Lifecycle - Graceful Shutdown", category: "deployment-validation", icon: "🛑", expertise: ["shutdown-testing", "graceful-termination", "cleanup-validation", "connection-draining"], principles: ["Validate shutdowns", "Graceful termination"]},
  {name: "Scale-Up Validator", id: "scale-up-validator", title: "Scaling - Scale-Up Testing", category: "deployment-validation", icon: "📈", expertise: ["scale-up-testing", "capacity-validation", "performance-under-scale", "resource-allocation"], principles: ["Validate scale-up", "Handle growth"]},
  {name: "Scale-Down Validator", id: "scale-down-validator", title: "Scaling - Scale-Down Testing", category: "deployment-validation", icon: "📉", expertise: ["scale-down-testing", "graceful-reduction", "session-handling", "resource-release"], principles: ["Validate scale-down", "Graceful reduction"]},
  {name: "Auto-Scale Validator", id: "auto-scale-validator", title: "Automation - Auto-Scale Testing", category: "deployment-validation", icon: "🔄", expertise: ["auto-scale-testing", "threshold-validation", "response-time", "stability-testing"], principles: ["Validate auto-scaling", "Responsive and stable"]},
  {name: "Load Balancer Validator", id: "load-balancer-validator", title: "Traffic - LB Configuration Testing", category: "deployment-validation", icon: "⚖️", expertise: ["lb-testing", "distribution-validation", "sticky-sessions", "failover-testing"], principles: ["Validate load balancing", "Even distribution"]},
  {name: "Service Mesh Validator", id: "service-mesh-validator", title: "Infrastructure - Service Mesh Testing", category: "deployment-validation", icon: "🕸️", expertise: ["mesh-testing", "sidecar-validation", "mtls-verification", "policy-enforcement"], principles: ["Validate service mesh", "Secure communication"]},
  {name: "DNS Validator", id: "dns-validator", title: "Network - DNS Configuration Testing", category: "deployment-validation", icon: "🌐", expertise: ["dns-testing", "record-validation", "propagation-checking", "ttl-verification"], principles: ["Validate DNS", "Correct routing"]},
  {name: "SSL/TLS Validator", id: "ssl-tls-validator", title: "Security - Certificate Testing", category: "deployment-validation", icon: "🔐", expertise: ["ssl-testing", "certificate-validation", "chain-verification", "expiry-monitoring"], principles: ["Validate SSL/TLS", "Secure connections"]},
  {name: "CDN Validator", id: "cdn-validator", title: "Performance - CDN Testing", category: "deployment-validation", icon: "🌍", expertise: ["cdn-testing", "cache-validation", "edge-verification", "purge-testing"], principles: ["Validate CDN", "Fast content delivery"]},
  {name: "Database Failover Validator", id: "db-failover-validator", title: "Data - DB Failover Testing", category: "deployment-validation", icon: "🗄️", expertise: ["failover-testing", "replication-validation", "consistency-checking", "recovery-timing"], principles: ["Validate DB failover", "Data consistency"]},
  {name: "Queue Failover Validator", id: "queue-failover-validator", title: "Messaging - Queue Failover Testing", category: "deployment-validation", icon: "📬", expertise: ["queue-failover", "message-durability", "ordering-validation", "dlq-testing"], principles: ["Validate queue failover", "No message loss"]},
  {name: "Disaster Recovery Validator", id: "disaster-recovery-validator", title: "DR - Disaster Recovery Testing", category: "deployment-validation", icon: "🆘", expertise: ["dr-testing", "rto-validation", "rpo-verification", "failover-procedures"], principles: ["Validate DR procedures", "Meet RTO/RPO"]}
];

function buildSystemPrompt(agent) {
  return `You are ${agent.name}, ${agent.title}.

## Identity
You are ${agent.name}, a specialized ${agent.category} agent in the A3I ecosystem. You bring expertise in ${agent.expertise.join(', ')}.

## Role
${agent.title.split(' - ')[1] || agent.title}

## Expertise
${agent.expertise.map(e => `- ${e}`).join('\n')}

## Core Principles
${agent.principles.map(p => `- ${p}`).join('\n')}`;
}

function generateYamlContent(agent) {
  return `---
name: ${agent.name}
title: ${agent.title}
category: ${agent.category}
icon: "${agent.icon}"
version: "1.0"
---

# ${agent.name}

## Identity
You are ${agent.name}, ${agent.title}.

## Expertise
${agent.expertise.map(e => `- ${e}`).join('\n')}

## Core Principles
${agent.principles.map(p => `- ${p}`).join('\n')}

## Menu Commands
- **/analyze** - Analyze from your specialized perspective
- **/validate** - Perform validation checks
- **/report** - Generate validation report
`;
}

function generateSlashCommand(agent) {
  return `---
name: '${agent.id}'
description: '${agent.title}'
---

You must fully embody this agent's persona.

<agent-activation CRITICAL="TRUE">
1. LOAD the FULL agent file from @bmad/bai/agents/${agent.id}.md
2. BECOME this agent completely
3. PRESENT their menu of available commands
4. WAIT for user input
</agent-activation>

You ARE this agent now.
`;
}

async function buildRemaining70() {
  console.log('🚀 Building Remaining 70 Agents to Reach 630\n');
  console.log('============================================================\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    let created = 0;
    let skipped = 0;
    let currentCategory = '';

    for (const agent of REMAINING_AGENTS) {
      // Print category header
      if (agent.category !== currentCategory) {
        currentCategory = agent.category;
        console.log(`\n📁 ${currentCategory.toUpperCase()}`);
      }

      // Check if exists
      const exists = await client.query('SELECT id FROM agents WHERE name = $1', [agent.name]);
      if (exists.rows.length > 0) {
        console.log(`   ⏭️  ${agent.name} (exists)`);
        skipped++;
        continue;
      }

      // Create agent file
      const agentFilePath = path.join(BAI_AGENTS_DIR, `${agent.id}.md`);
      fs.writeFileSync(agentFilePath, generateYamlContent(agent));

      // Create slash command file
      const commandFilePath = path.join(COMMANDS_DIR, `${agent.id}.md`);
      fs.writeFileSync(commandFilePath, generateSlashCommand(agent));

      // Insert to database
      const result = await client.query(`
        INSERT INTO agents (owner_id, name, description, system_prompt, model, status, trust_score, config, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'claude-sonnet-4-20250514', 'active', 400, $5, $6, NOW(), NOW())
        RETURNING id
      `, [
        SYSTEM_USER_ID,
        agent.name,
        agent.title,
        buildSystemPrompt(agent),
        JSON.stringify({temperature: 0.7, maxTokens: 4096, capabilities: ['text_generation', 'validation']}),
        JSON.stringify({source: 'bai-migration', icon: agent.icon, category: agent.category, expertise: agent.expertise, principles: agent.principles})
      ]);

      // Create marketplace listing
      await client.query(`
        INSERT INTO marketplace_listings (agent_id, seller_id, title, description, status, commission_rate, clone_price, enterprise_price, available_for_commission, available_for_clone, available_for_enterprise, max_clones, current_clones, tags, category, preview_config, view_count, acquisition_count, average_rating, review_count, created_at, updated_at, published_at)
        VALUES ($1, $2, $3, $4, 'active', 0.15, 49.99, 499.99, true, true, true, 100, 0, $5, 'validation', '{}', 0, 0, 0, 0, NOW(), NOW(), NOW())
      `, [result.rows[0].id, SYSTEM_USER_ID, agent.name, agent.title, JSON.stringify(agent.expertise)]);

      console.log(`   ✅ ${agent.name}`);
      created++;
    }

    // Get final count
    const total = await client.query(`SELECT COUNT(*) as count FROM agents WHERE metadata->>'source' = 'bai-migration'`);

    console.log('\n============================================================\n');
    console.log(`📊 Build Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`\n🎉 TOTAL BAI AGENTS: ${total.rows[0].count}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

buildRemaining70().catch(console.error);
