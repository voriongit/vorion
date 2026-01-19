/**
 * Production Verification Script
 *
 * Verifies all production endpoints are working correctly.
 * This replaces E2E tests for quick production health checks.
 */

const API_URL = 'https://trustbot-api.fly.dev';

interface CheckResult {
    name: string;
    endpoint: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    duration: number;
}

const results: CheckResult[] = [];

async function check(name: string, endpoint: string, validator: (response: Response, data: unknown) => Promise<string | null>): Promise<void> {
    const start = performance.now();
    try {
        const response = await fetch(`${API_URL}${endpoint}`);
        const data = await response.json().catch(() => null);
        const duration = performance.now() - start;

        const error = await validator(response, data);
        if (error) {
            results.push({ name, endpoint, status: 'FAIL', message: error, duration });
        } else {
            results.push({ name, endpoint, status: 'PASS', message: 'OK', duration });
        }
    } catch (e) {
        const duration = performance.now() - start;
        results.push({ name, endpoint, status: 'FAIL', message: String(e), duration });
    }
}

async function checkPost(name: string, endpoint: string, body: object, validator: (response: Response, data: unknown) => Promise<string | null>): Promise<void> {
    const start = performance.now();
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => null);
        const duration = performance.now() - start;

        const error = await validator(response, data);
        if (error) {
            results.push({ name, endpoint, status: 'FAIL', message: error, duration });
        } else {
            results.push({ name, endpoint, status: 'PASS', message: 'OK', duration });
        }
    } catch (e) {
        const duration = performance.now() - start;
        results.push({ name, endpoint, status: 'FAIL', message: String(e), duration });
    }
}

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           TrustBot Production Verification                   ║
╠══════════════════════════════════════════════════════════════╣
║  API: ${API_URL.padEnd(53)}║
╚══════════════════════════════════════════════════════════════╝
`);

    console.log('Running checks...\n');

    // Core Health Endpoints
    await check('Health Check', '/health', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        if (data?.status !== 'healthy' && data?.status !== 'degraded') return `Status: ${data?.status}`;
        return null;
    });

    await check('Liveness Probe', '/live', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        if (!data?.alive) return 'Not alive';
        return null;
    });

    await check('Readiness Probe', '/ready', async (res, data: any) => {
        if (!res.ok && res.status !== 503) return `HTTP ${res.status}`;
        return null;
    });

    // Authentication
    await checkPost('Authentication', '/auth/human', { masterKey: 'trustbot-master-key-2025' }, async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        if (!data?.tokenId) return 'No token returned';
        return null;
    });

    // Agent Discovery Endpoints
    await check('Agent Registry', '/api/agent-discovery/registry', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        if (typeof data?.count !== 'number') return 'Invalid response';
        return null;
    });

    await check('Agent Discovery Stats', '/api/agent-discovery/stats', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        if (!data?.agents) return 'No agents data';
        return null;
    });

    await check('Skill Search', '/api/agent-discovery/registry/search/by-skills?skills=research,analysis', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        if (typeof data?.matchCount !== 'number') return 'Invalid response';
        return null;
    });

    // Task Endpoints
    await check('Task List', '/tasks', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        if (!Array.isArray(data)) return 'Invalid response';
        return null;
    });

    // Dashboard
    await check('Dashboard Today', '/dashboard/today', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        return null;
    });

    // Trust Stats
    await check('Trust Stats', '/trust/stats', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        return null;
    });

    // Agents List
    await check('Agents List', '/api/agents', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        return null;
    });

    // Approvals
    await check('Approvals', '/approvals', async (res, data: any) => {
        if (!res.ok) return `HTTP ${res.status}`;
        return null;
    });

    // Memory Routes (may 503 if OpenAI not configured)
    await check('Memory Health', '/api/memory/health', async (res, data: any) => {
        if (res.status === 503) return null; // Expected if no OpenAI key
        if (!res.ok) return `HTTP ${res.status}`;
        return null;
    });

    // Print Results
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    VERIFICATION RESULTS                      ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');

    let passCount = 0;
    let failCount = 0;

    for (const r of results) {
        const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⚠';
        const statusStr = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'WARN';
        console.log(`║  ${icon} ${r.name.padEnd(25)} ${statusStr.padEnd(6)} ${r.duration.toFixed(0).padStart(4)}ms ║`);

        if (r.status === 'PASS') passCount++;
        else if (r.status === 'FAIL') failCount++;
    }

    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Total: ${results.length}  |  Passed: ${passCount}  |  Failed: ${failCount}${' '.repeat(24)}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (failCount === 0) {
        console.log('\n✅ All production checks passed!');
    } else {
        console.log('\n❌ Some checks failed:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`   - ${r.name}: ${r.message}`);
        });
        process.exit(1);
    }
}

main().catch(console.error);
