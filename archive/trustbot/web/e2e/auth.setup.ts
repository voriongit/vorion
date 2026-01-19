/**
 * Authentication Setup
 *
 * Runs before all tests to set up authentication state.
 * Stores auth state to be reused across tests.
 *
 * Epic 9: Production Hardening
 * Story 9.3: E2E Test Framework Setup
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
    // For E2E testing, we mock the authentication flow
    // In a real scenario, you might use a test account with actual OAuth

    // Navigate to the app
    await page.goto('/');

    // Set up mock authentication in localStorage
    await page.evaluate(() => {
        const mockUser = {
            email: 'e2e-test@example.com',
            name: 'E2E Test User',
            picture: 'https://example.com/test-avatar.png',
        };

        localStorage.setItem('auth_user', JSON.stringify(mockUser));
        localStorage.setItem('auth_token', 'e2e-mock-token');
        localStorage.setItem('isAuthenticated', 'true');
    });

    // Reload to apply auth state
    await page.reload();

    // Wait for the app to recognize authenticated state
    // This might show the dashboard or require checking the nav
    await page.waitForTimeout(1000);

    // Save the authentication state
    await page.context().storageState({ path: authFile });
});
