/**
 * TrustBot Load Testing Script
 *
 * Tests system performance at scale:
 * - Agent spawning throughput
 * - Task creation and completion
 * - Agent discovery and messaging
 * - Concurrent operations
 *
 * Usage: npx tsx scripts/load-test.ts [--url <api-url>] [--scale <1-5>]
 */

const API_URL = process.env.TRUSTBOT_API_URL || process.argv.includes('--url')
    ? process.argv[process.argv.indexOf('--url') + 1]
    : 'http://localhost:3002';

const SCALE = parseInt(process.argv.includes('--scale')
    ? process.argv[process.argv.indexOf('--scale') + 1]
    : '2');

interface TestResult {
    name: string;
    duration: number;
    success: boolean;
    operations: number;
    opsPerSecond: number;
    errors: string[];
}

interface LoadTestReport {
    apiUrl: string;
    scale: number;
    startTime: string;
    endTime: string;
    totalDuration: number;
    results: TestResult[];
    summary: {
        totalOperations: number;
        successRate: number;
        avgOpsPerSecond: number;
        peakOpsPerSecond: number;
    };
}

// Test configurations based on scale (1-5)
const SCALE_CONFIG = {
    1: { agents: 10, tasks: 20, messages: 50, concurrent: 5 },
    2: { agents: 25, tasks: 50, messages: 100, concurrent: 10 },
    3: { agents: 50, tasks: 100, messages: 200, concurrent: 20 },
    4: { agents: 100, tasks: 200, messages: 500, concurrent: 50 },
    5: { agents: 200, tasks: 500, messages: 1000, concurrent: 100 },
};

const config = SCALE_CONFIG[SCALE as keyof typeof SCALE_CONFIG] || SCALE_CONFIG[2];

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           TrustBot Load Testing Suite                        ║
╠══════════════════════════════════════════════════════════════╣
║  API URL:     ${API_URL.padEnd(45)}║
║  Scale:       ${SCALE} (${config.agents} agents, ${config.tasks} tasks)${' '.repeat(21 - config.agents.toString().length - config.tasks.toString().length)}║
║  Concurrent:  ${config.concurrent.toString().padEnd(45)}║
╚══════════════════════════════════════════════════════════════╝
`);

let tokenId: string | null = null;
const results: TestResult[] = [];

// Helper: Make API call with timing
async function timedFetch(
    endpoint: string,
    options?: RequestInit
): Promise<{ response: Response; duration: number }> {
    const start = performance.now();
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    const duration = performance.now() - start;
    return { response, duration };
}

// Helper: Run operations concurrently in batches
async function runConcurrent<T>(
    operations: (() => Promise<T>)[],
    concurrency: number
): Promise<{ results: (T | Error)[]; duration: number }> {
    const start = performance.now();
    const results: (T | Error)[] = [];

    for (let i = 0; i < operations.length; i += concurrency) {
        const batch = operations.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(batch.map(op => op()));
        batchResults.forEach(r => {
            results.push(r.status === 'fulfilled' ? r.value : new Error(String(r.reason)));
        });
    }

    const duration = performance.now() - start;
    return { results, duration };
}

// Test 1: Health check baseline
async function testHealthCheck(): Promise<TestResult> {
    console.log('\n[1/6] Testing health endpoint...');
    const errors: string[] = [];
    const iterations = 10;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        try {
            const { response } = await timedFetch('/health');
            if (!response.ok) {
                errors.push(`Health check failed: ${response.status}`);
            }
        } catch (e) {
            errors.push(`Health check error: ${e}`);
        }
    }

    const duration = performance.now() - start;
    console.log(`   ✓ ${iterations} health checks in ${duration.toFixed(0)}ms`);

    return {
        name: 'Health Check',
        duration,
        success: errors.length === 0,
        operations: iterations,
        opsPerSecond: (iterations / duration) * 1000,
        errors,
    };
}

// Test 2: Authentication
async function testAuthentication(): Promise<TestResult> {
    console.log('\n[2/6] Testing authentication...');
    const errors: string[] = [];
    const start = performance.now();

    try {
        const { response } = await timedFetch('/auth/human', {
            method: 'POST',
            body: JSON.stringify({ masterKey: process.env.MASTER_KEY || 'trustbot-master-key-2025' }),
        });

        if (response.ok) {
            const data = await response.json();
            tokenId = data.tokenId;
            console.log(`   ✓ Authenticated, token: ${tokenId?.slice(0, 8)}...`);
        } else {
            errors.push(`Auth failed: ${response.status}`);
        }
    } catch (e) {
        errors.push(`Auth error: ${e}`);
    }

    const duration = performance.now() - start;
    return {
        name: 'Authentication',
        duration,
        success: errors.length === 0 && tokenId !== null,
        operations: 1,
        opsPerSecond: 1000 / duration,
        errors,
    };
}

// Test 3: Agent spawning at scale
async function testAgentSpawning(): Promise<TestResult> {
    console.log(`\n[3/6] Spawning ${config.agents} agents...`);
    const errors: string[] = [];
    const agentIds: string[] = [];

    const operations = Array.from({ length: config.agents }, (_, i) => async () => {
        const { response } = await timedFetch('/api/spawn', {
            method: 'POST',
            body: JSON.stringify({
                name: `LoadTestAgent-${i}`,
                type: 'WORKER',
                tier: 3,
                capabilities: ['execute', 'analyze'],
                skills: ['load-testing', 'performance'],
            }),
        });

        if (response.ok) {
            const data = await response.json();
            return data.agent?.id;
        } else {
            throw new Error(`Spawn failed: ${response.status}`);
        }
    });

    const { results: spawnResults, duration } = await runConcurrent(operations, config.concurrent);

    spawnResults.forEach((r, i) => {
        if (r instanceof Error) {
            errors.push(r.message);
        } else if (r) {
            agentIds.push(r);
        }
    });

    const successCount = agentIds.length;
    console.log(`   ✓ ${successCount}/${config.agents} agents spawned in ${duration.toFixed(0)}ms`);
    console.log(`   ↳ Rate: ${((successCount / duration) * 1000).toFixed(1)} agents/sec`);

    return {
        name: 'Agent Spawning',
        duration,
        success: successCount > config.agents * 0.9, // 90% success rate
        operations: config.agents,
        opsPerSecond: (successCount / duration) * 1000,
        errors: errors.slice(0, 5), // Only first 5 errors
    };
}

// Test 4: Task creation and completion
async function testTaskLifecycle(): Promise<TestResult> {
    console.log(`\n[4/6] Testing ${config.tasks} task lifecycles...`);
    const errors: string[] = [];
    let completedTasks = 0;

    const operations = Array.from({ length: config.tasks }, (_, i) => async () => {
        // Create task
        const createRes = await timedFetch('/tasks', {
            method: 'POST',
            body: JSON.stringify({
                title: `LoadTest-Task-${i}`,
                description: `Performance test task ${i}`,
                priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
            }),
        });

        if (!createRes.response.ok) {
            throw new Error(`Task create failed: ${createRes.response.status}`);
        }

        const task = await createRes.response.json();
        return task.id;
    });

    const { results: taskResults, duration } = await runConcurrent(operations, config.concurrent);

    taskResults.forEach(r => {
        if (r instanceof Error) {
            errors.push(r.message);
        } else {
            completedTasks++;
        }
    });

    console.log(`   ✓ ${completedTasks}/${config.tasks} tasks created in ${duration.toFixed(0)}ms`);
    console.log(`   ↳ Rate: ${((completedTasks / duration) * 1000).toFixed(1)} tasks/sec`);

    return {
        name: 'Task Lifecycle',
        duration,
        success: completedTasks > config.tasks * 0.9,
        operations: config.tasks,
        opsPerSecond: (completedTasks / duration) * 1000,
        errors: errors.slice(0, 5),
    };
}

// Test 5: Agent discovery operations
async function testAgentDiscovery(): Promise<TestResult> {
    console.log(`\n[5/6] Testing agent discovery API...`);
    const errors: string[] = [];
    let successOps = 0;
    const start = performance.now();

    // Register agents
    for (let i = 0; i < 10; i++) {
        try {
            const { response } = await timedFetch('/api/agent-discovery/registry', {
                method: 'POST',
                body: JSON.stringify({
                    agentId: `discovery-test-${i}`,
                    agentName: `DiscoveryTest-${i}`,
                    provider: ['claude', 'gemini', 'grok'][i % 3],
                    skills: ['research', 'analysis', 'planning'].slice(0, (i % 3) + 1),
                    capabilities: ['execute', 'analyze'],
                    tier: (i % 5) + 1,
                    currentLoad: i * 10,
                    available: i < 8,
                }),
            });
            if (response.ok) successOps++;
            else errors.push(`Register failed: ${response.status}`);
        } catch (e) {
            errors.push(`Register error: ${e}`);
        }
    }

    // Search by skills
    try {
        const { response } = await timedFetch('/api/agent-discovery/registry/search/by-skills?skills=research,analysis');
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✓ Found ${data.matchCount} agents matching skills`);
            successOps++;
        }
    } catch (e) {
        errors.push(`Search error: ${e}`);
    }

    // Get registry list
    try {
        const { response } = await timedFetch('/api/agent-discovery/registry');
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✓ Registry contains ${data.count} agents`);
            successOps++;
        }
    } catch (e) {
        errors.push(`List error: ${e}`);
    }

    // Get stats
    try {
        const { response } = await timedFetch('/api/agent-discovery/stats');
        if (response.ok) successOps++;
    } catch (e) {
        errors.push(`Stats error: ${e}`);
    }

    const duration = performance.now() - start;
    console.log(`   ✓ ${successOps} discovery operations in ${duration.toFixed(0)}ms`);

    return {
        name: 'Agent Discovery',
        duration,
        success: errors.length < 3,
        operations: successOps,
        opsPerSecond: (successOps / duration) * 1000,
        errors,
    };
}

// Test 6: Message throughput
async function testMessaging(): Promise<TestResult> {
    console.log(`\n[6/6] Testing ${config.messages} messages...`);
    const errors: string[] = [];
    let sentMessages = 0;

    const operations = Array.from({ length: config.messages }, (_, i) => async () => {
        const { response } = await timedFetch('/api/agent-discovery/messages', {
            method: 'POST',
            body: JSON.stringify({
                type: ['QUERY', 'REQUEST_HELP', 'SHARE_CONTEXT'][i % 3],
                from: `agent-${i % 10}`,
                to: `agent-${(i + 5) % 10}`,
                subject: `Test Message ${i}`,
                content: `Performance test message content for iteration ${i}`,
                priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
            }),
        });

        if (response.ok) return true;
        throw new Error(`Message failed: ${response.status}`);
    });

    const { results: msgResults, duration } = await runConcurrent(operations, config.concurrent);

    msgResults.forEach(r => {
        if (!(r instanceof Error)) sentMessages++;
        else errors.push(r.message);
    });

    console.log(`   ✓ ${sentMessages}/${config.messages} messages sent in ${duration.toFixed(0)}ms`);
    console.log(`   ↳ Rate: ${((sentMessages / duration) * 1000).toFixed(1)} messages/sec`);

    return {
        name: 'Messaging',
        duration,
        success: sentMessages > config.messages * 0.9,
        operations: config.messages,
        opsPerSecond: (sentMessages / duration) * 1000,
        errors: errors.slice(0, 5),
    };
}

// Generate report
function generateReport(results: TestResult[], startTime: Date): LoadTestReport {
    const endTime = new Date();
    const totalOperations = results.reduce((sum, r) => sum + r.operations, 0);
    const successfulResults = results.filter(r => r.success);

    return {
        apiUrl: API_URL,
        scale: SCALE,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalDuration: endTime.getTime() - startTime.getTime(),
        results,
        summary: {
            totalOperations,
            successRate: (successfulResults.length / results.length) * 100,
            avgOpsPerSecond: results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length,
            peakOpsPerSecond: Math.max(...results.map(r => r.opsPerSecond)),
        },
    };
}

// Main execution
async function main() {
    const startTime = new Date();

    try {
        // Run all tests
        results.push(await testHealthCheck());
        results.push(await testAuthentication());

        if (!tokenId) {
            console.log('\n⚠️  Authentication failed, skipping remaining tests');
            return;
        }

        results.push(await testAgentSpawning());
        results.push(await testTaskLifecycle());
        results.push(await testAgentDiscovery());
        results.push(await testMessaging());

        // Generate report
        const report = generateReport(results, startTime);

        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    LOAD TEST RESULTS                         ║
╠══════════════════════════════════════════════════════════════╣`);

        results.forEach(r => {
            const status = r.success ? '✓' : '✗';
            console.log(`║  ${status} ${r.name.padEnd(20)} ${r.opsPerSecond.toFixed(1).padStart(8)} ops/sec  ${r.duration.toFixed(0).padStart(6)}ms ║`);
        });

        console.log(`╠══════════════════════════════════════════════════════════════╣
║  SUMMARY                                                     ║
║  Total Operations:  ${report.summary.totalOperations.toString().padEnd(40)}║
║  Success Rate:      ${report.summary.successRate.toFixed(1)}%${' '.repeat(36)}║
║  Avg Throughput:    ${report.summary.avgOpsPerSecond.toFixed(1)} ops/sec${' '.repeat(30)}║
║  Peak Throughput:   ${report.summary.peakOpsPerSecond.toFixed(1)} ops/sec${' '.repeat(30)}║
║  Total Duration:    ${(report.totalDuration / 1000).toFixed(2)}s${' '.repeat(35)}║
╚══════════════════════════════════════════════════════════════╝`);

        // Check if we pass production requirements
        const passesReqs = report.summary.successRate >= 90 &&
                          report.summary.avgOpsPerSecond >= 10;

        if (passesReqs) {
            console.log('\n✅ PASS: System meets production requirements');
        } else {
            console.log('\n⚠️  WARN: System may need optimization before production');
        }

    } catch (error) {
        console.error('\n❌ Load test failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);
