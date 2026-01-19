/**
 * Playwright Test Fixtures
 *
 * Provides reusable test fixtures for:
 * - Authentication
 * - Navigation helpers
 * - API mocking
 * - Common test utilities
 *
 * Epic 9: Production Hardening
 * Story 9.3: E2E Test Framework Setup
 */

import { test as base, expect, Page } from '@playwright/test';

// ============================================================================
// Types
// ============================================================================

export interface TestUser {
    email: string;
    name: string;
    picture?: string;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: TestUser | null;
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Extended test fixtures for TrustBot E2E testing
 */
export const test = base.extend<{
    /** Authenticated page with mock user session */
    authenticatedPage: Page;
    /** Test user data */
    testUser: TestUser;
    /** Navigate to a specific dashboard section */
    navigateTo: (path: string) => Promise<void>;
    /** Wait for API to be ready */
    waitForApi: () => Promise<void>;
    /** Mock API responses */
    mockApi: (path: string, response: object) => Promise<void>;
}>({
    // Default test user
    testUser: async ({}, use) => {
        await use({
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/avatar.png',
        });
    },

    // Authenticated page fixture
    authenticatedPage: async ({ page, testUser }, use) => {
        // Set up mock authentication state in localStorage
        await page.addInitScript((user) => {
            localStorage.setItem('auth_user', JSON.stringify(user));
            localStorage.setItem('auth_token', 'mock-token-for-testing');
            localStorage.setItem('isAuthenticated', 'true');
        }, testUser);

        // Mock Google OAuth endpoint
        await page.route('**/oauth2/v3/userinfo', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    email: testUser.email,
                    name: testUser.name,
                    picture: testUser.picture,
                }),
            });
        });

        await use(page);
    },

    // Navigation helper
    navigateTo: async ({ page }, use) => {
        const navigate = async (path: string) => {
            await page.goto(path);
            await page.waitForLoadState('networkidle');
        };
        await use(navigate);
    },

    // Wait for API readiness
    waitForApi: async ({ page }, use) => {
        const waitForApi = async () => {
            const apiUrl = process.env.E2E_API_URL || 'http://localhost:3002';
            let retries = 10;

            while (retries > 0) {
                try {
                    const response = await page.request.get(`${apiUrl}/health`);
                    if (response.ok()) {
                        return;
                    }
                } catch {
                    // API not ready yet
                }
                await page.waitForTimeout(1000);
                retries--;
            }

            throw new Error('API did not become ready in time');
        };
        await use(waitForApi);
    },

    // Mock API helper
    mockApi: async ({ page }, use) => {
        const mockApi = async (path: string, response: object) => {
            await page.route(`**/api/**${path}`, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(response),
                });
            });
        };
        await use(mockApi);
    },
});

// ============================================================================
// Custom Expect Matchers
// ============================================================================

export { expect };

// ============================================================================
// Common Test Helpers
// ============================================================================

/**
 * Wait for the dashboard to fully load
 */
export async function waitForDashboardLoad(page: Page): Promise<void> {
    // Wait for main content to be visible
    await page.waitForSelector('[data-testid="dashboard-content"], .dashboard-container, main', {
        state: 'visible',
        timeout: 10000,
    });

    // Wait for any loading indicators to disappear
    await page.waitForSelector('.loading-spinner, [data-loading="true"]', {
        state: 'hidden',
        timeout: 10000,
    }).catch(() => {
        // Loading indicator may not exist, that's fine
    });
}

/**
 * Check if the user is on the login page
 */
export async function isOnLoginPage(page: Page): Promise<boolean> {
    const loginButton = await page.$('[data-testid="google-login-button"], .login-button');
    return loginButton !== null;
}

/**
 * Get the current page title from the app
 */
export async function getPageTitle(page: Page): Promise<string | null> {
    const title = await page.$('h1, [data-testid="page-title"]');
    return title ? await title.textContent() : null;
}

/**
 * Click a navigation item
 */
export async function clickNavItem(page: Page, label: string): Promise<void> {
    await page.click(`nav >> text="${label}"`);
    await page.waitForLoadState('networkidle');
}

/**
 * Get all visible agent cards
 */
export async function getAgentCards(page: Page): Promise<number> {
    const cards = await page.$$('[data-testid="agent-card"], .agent-card');
    return cards.length;
}

/**
 * Get all pending decisions
 */
export async function getPendingDecisions(page: Page): Promise<number> {
    const decisions = await page.$$('[data-testid="pending-decision"], .decision-card');
    return decisions.length;
}
