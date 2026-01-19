/**
 * Playwright E2E Test Configuration - Production
 *
 * Runs tests against production environment without starting local servers.
 */

import { defineConfig, devices } from '@playwright/test';

// Production URLs
const PROD_WEB_URL = 'https://trustbot-web.vercel.app';
const PROD_API_URL = 'https://trustbot-api.fly.dev';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: true,
    retries: 1,
    workers: 1,
    reporter: [
        ['html', { outputFolder: 'e2e-report' }],
        ['list'],
    ],
    use: {
        baseURL: PROD_WEB_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
    // No webServer - testing against production
    outputDir: 'e2e-results',
    timeout: 30 * 1000,
    expect: {
        timeout: 10 * 1000,
    },
    // Set API URL for tests
    globalSetup: undefined,
    metadata: {
        apiUrl: PROD_API_URL,
    },
});

// Export for use in tests
export { PROD_API_URL, PROD_WEB_URL };
