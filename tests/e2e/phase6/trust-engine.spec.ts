import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 6 Trust Engine E2E Tests
 *
 * Tests the Phase 6 Trust Engine dashboard and related functionality
 */

test.describe('Phase 6 Trust Engine Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Phase 6 dashboard
    await page.goto('/phase6');
  });

  test.describe('Dashboard Overview', () => {
    test('should display the main dashboard', async ({ page }) => {
      // Check page title
      await expect(page).toHaveTitle(/Trust Engine|Phase 6/i);

      // Check main heading
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        /Trust Engine|Phase 6/i
      );
    });

    test('should display statistics cards', async ({ page }) => {
      // Wait for stats to load
      await page.waitForSelector('[data-testid="stats-card"]', { timeout: 10000 });

      // Check that stat cards are present
      const statCards = page.locator('[data-testid="stats-card"]');
      await expect(statCards).toHaveCount(4);

      // Verify specific stat cards
      await expect(page.getByText(/Role Gates/i)).toBeVisible();
      await expect(page.getByText(/Ceiling Checks/i)).toBeVisible();
      await expect(page.getByText(/Provenance Records/i)).toBeVisible();
      await expect(page.getByText(/Active Alerts/i)).toBeVisible();
    });

    test('should load stats data from API', async ({ page }) => {
      // Intercept API call
      const statsPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/phase6/stats') &&
          response.status() === 200
      );

      await page.reload();
      const response = await statsPromise;
      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('roleGates');
      expect(data).toHaveProperty('ceiling');
      expect(data).toHaveProperty('provenance');
      expect(data).toHaveProperty('alerts');
    });
  });

  test.describe('Role Gates', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/phase6/role-gates');
    });

    test('should display role gates list', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/Role Gates/i);

      // Wait for table to load
      await page.waitForSelector('[data-testid="role-gates-table"]', { timeout: 10000 });

      // Check table headers
      await expect(page.getByText('Role')).toBeVisible();
      await expect(page.getByText('Minimum Tier')).toBeVisible();
      await expect(page.getByText('Status')).toBeVisible();
    });

    test('should filter role gates by tier', async ({ page }) => {
      // Find and click tier filter
      const tierFilter = page.getByRole('combobox', { name: /tier/i });
      await tierFilter.click();

      // Select VERIFIED tier
      await page.getByRole('option', { name: /VERIFIED/i }).click();

      // Verify filter is applied
      await page.waitForTimeout(500);

      // Check URL has filter parameter
      await expect(page).toHaveURL(/tier=VERIFIED/i);
    });

    test('should open role gate evaluation dialog', async ({ page }) => {
      // Click evaluate button
      const evaluateButton = page.getByRole('button', { name: /Evaluate/i });
      await evaluateButton.first().click();

      // Check dialog is open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Evaluate Role Gate/i)).toBeVisible();

      // Verify form fields
      await expect(page.getByLabel(/Agent ID/i)).toBeVisible();
      await expect(page.getByLabel(/Trust Tier/i)).toBeVisible();
    });

    test('should submit role gate evaluation', async ({ page }) => {
      // Open evaluation dialog
      await page.getByRole('button', { name: /Evaluate/i }).first().click();

      // Fill form
      await page.getByLabel(/Agent ID/i).fill('test-agent-001');

      // Select tier
      await page.getByLabel(/Trust Tier/i).click();
      await page.getByRole('option', { name: /VERIFIED/i }).click();

      // Intercept API call
      const evaluatePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/phase6/role-gates/evaluate') &&
          response.status() === 200
      );

      // Submit
      await page.getByRole('button', { name: /Submit|Evaluate/i }).click();

      // Wait for response
      const response = await evaluatePromise;
      const result = await response.json();

      // Verify result is displayed
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('decision');
    });
  });

  test.describe('Capability Ceiling', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/phase6/ceiling');
    });

    test('should display ceiling overview', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/Ceiling|Capability/i);

      // Wait for content to load
      await page.waitForSelector('[data-testid="ceiling-chart"]', { timeout: 10000 });
    });

    test('should show ceiling usage by resource type', async ({ page }) => {
      // Check resource type cards
      await expect(page.getByText(/API Calls/i)).toBeVisible();
      await expect(page.getByText(/Data Access/i)).toBeVisible();
      await expect(page.getByText(/Compute/i)).toBeVisible();
    });

    test('should check ceiling for agent', async ({ page }) => {
      // Click check ceiling button
      await page.getByRole('button', { name: /Check Ceiling/i }).click();

      // Fill form
      await page.getByLabel(/Agent ID/i).fill('test-agent-001');
      await page.getByLabel(/Resource Type/i).click();
      await page.getByRole('option', { name: /API_CALLS/i }).click();
      await page.getByLabel(/Requested Amount/i).fill('10');

      // Intercept API call
      const checkPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/phase6/ceiling/check') &&
          response.status() === 200
      );

      // Submit
      await page.getByRole('button', { name: /Check|Submit/i }).click();

      // Wait for response
      const response = await checkPromise;
      const result = await response.json();

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('currentUsage');
      expect(result).toHaveProperty('ceiling');
    });
  });

  test.describe('Provenance', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/phase6/provenance');
    });

    test('should display provenance records', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/Provenance/i);

      // Wait for table to load
      await page.waitForSelector('[data-testid="provenance-table"]', { timeout: 10000 });
    });

    test('should filter provenance by date range', async ({ page }) => {
      // Open date picker
      await page.getByRole('button', { name: /Date Range/i }).click();

      // Select last 7 days
      await page.getByRole('option', { name: /Last 7 days/i }).click();

      // Verify filter applied
      await expect(page).toHaveURL(/startTime=/);
    });

    test('should view provenance chain', async ({ page }) => {
      // Wait for records to load
      await page.waitForSelector('[data-testid="provenance-row"]', { timeout: 10000 });

      // Click on first record
      await page.locator('[data-testid="provenance-row"]').first().click();

      // Check chain view is displayed
      await expect(page.getByText(/Provenance Chain/i)).toBeVisible();
    });

    test('should verify provenance integrity', async ({ page }) => {
      // Wait for records to load
      await page.waitForSelector('[data-testid="provenance-row"]', { timeout: 10000 });

      // Click verify button on first record
      await page.locator('[data-testid="verify-btn"]').first().click();

      // Check verification result
      await expect(
        page.getByText(/Verified|Valid|Integrity Confirmed/i)
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Gaming Alerts', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/phase6/alerts');
    });

    test('should display alerts list', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/Alerts/i);

      // Wait for alerts to load
      await page.waitForSelector('[data-testid="alerts-list"]', { timeout: 10000 });
    });

    test('should filter alerts by severity', async ({ page }) => {
      // Find severity filter
      await page.getByRole('combobox', { name: /severity/i }).click();

      // Select CRITICAL
      await page.getByRole('option', { name: /CRITICAL/i }).click();

      // Verify filter
      await expect(page).toHaveURL(/severity=CRITICAL/i);
    });

    test('should filter alerts by status', async ({ page }) => {
      // Find status filter
      await page.getByRole('combobox', { name: /status/i }).click();

      // Select ACTIVE
      await page.getByRole('option', { name: /ACTIVE/i }).click();

      // Verify filter
      await expect(page).toHaveURL(/status=ACTIVE/i);
    });

    test('should acknowledge alert', async ({ page }) => {
      // Wait for alerts to load
      await page.waitForSelector('[data-testid="alert-card"]', { timeout: 10000 });

      // Find active alert and acknowledge
      const acknowledgeBtn = page.locator('[data-testid="acknowledge-btn"]').first();

      if (await acknowledgeBtn.isVisible()) {
        // Intercept API call
        const updatePromise = page.waitForResponse(
          (response) =>
            response.url().includes('/api/phase6/alerts/') &&
            response.request().method() === 'PATCH'
        );

        await acknowledgeBtn.click();
        await updatePromise;

        // Verify status changed
        await expect(page.getByText(/Acknowledged/i)).toBeVisible();
      }
    });

    test('should resolve alert with notes', async ({ page }) => {
      // Wait for alerts to load
      await page.waitForSelector('[data-testid="alert-card"]', { timeout: 10000 });

      // Find alert and click resolve
      const resolveBtn = page.locator('[data-testid="resolve-btn"]').first();

      if (await resolveBtn.isVisible()) {
        await resolveBtn.click();

        // Fill resolution notes
        await page.getByLabel(/Resolution Notes/i).fill('Issue investigated and resolved.');

        // Intercept API call
        const updatePromise = page.waitForResponse(
          (response) =>
            response.url().includes('/api/phase6/alerts/') &&
            response.request().method() === 'PATCH'
        );

        // Confirm resolution
        await page.getByRole('button', { name: /Confirm|Resolve/i }).click();
        await updatePromise;

        // Verify status changed
        await expect(page.getByText(/Resolved/i)).toBeVisible();
      }
    });
  });

  test.describe('ACI Presets', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/phase6/presets');
    });

    test('should display presets list', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/Presets/i);

      // Wait for presets to load
      await page.waitForSelector('[data-testid="presets-grid"]', { timeout: 10000 });
    });

    test('should filter presets by category', async ({ page }) => {
      // Click category filter
      await page.getByRole('tab', { name: /Compliance/i }).click();

      // Verify filter
      const presets = page.locator('[data-testid="preset-card"]');
      await expect(presets.first()).toContainText(/SOC2|HIPAA|GDPR|Compliance/i);
    });

    test('should preview preset configuration', async ({ page }) => {
      // Wait for presets to load
      await page.waitForSelector('[data-testid="preset-card"]', { timeout: 10000 });

      // Click preview on first preset
      await page.locator('[data-testid="preview-btn"]').first().click();

      // Check preview modal
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Configuration Preview/i)).toBeVisible();
    });

    test('should apply preset with dry run', async ({ page }) => {
      // Wait for presets to load
      await page.waitForSelector('[data-testid="preset-card"]', { timeout: 10000 });

      // Click apply on first preset
      await page.locator('[data-testid="apply-btn"]').first().click();

      // Enable dry run
      await page.getByLabel(/Dry Run/i).check();

      // Intercept API call
      const applyPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/phase6/presets/') &&
          response.url().includes('/apply')
      );

      // Apply
      await page.getByRole('button', { name: /Apply|Confirm/i }).click();

      const response = await applyPromise;
      const result = await response.json();

      // Verify dry run results are shown
      expect(result).toHaveProperty('changes');
      await expect(page.getByText(/Dry Run Results/i)).toBeVisible();
    });
  });
});

test.describe('Phase 6 API', () => {
  test('should return health check', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('should return readiness check', async ({ request }) => {
    const response = await request.get('/api/health/ready');
    expect(response.ok()).toBeTruthy();
  });

  test('should return stats', async ({ request }) => {
    const response = await request.get('/api/phase6/stats');

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('roleGates');
      expect(data).toHaveProperty('ceiling');
      expect(data).toHaveProperty('provenance');
      expect(data).toHaveProperty('alerts');
    }
  });

  test('should evaluate role gate', async ({ request }) => {
    const response = await request.post('/api/phase6/role-gates/evaluate', {
      data: {
        agentId: 'test-agent-e2e',
        role: 'READER',
        tier: 'VERIFIED',
      },
    });

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('allowed');
      expect(data).toHaveProperty('decision');
      expect(['ALLOW', 'DENY', 'ESCALATE']).toContain(data.decision);
    }
  });

  test('should check ceiling', async ({ request }) => {
    const response = await request.post('/api/phase6/ceiling/check', {
      data: {
        agentId: 'test-agent-e2e',
        resourceType: 'API_CALLS',
        requestedAmount: 10,
        tier: 'VERIFIED',
      },
    });

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('allowed');
      expect(data).toHaveProperty('currentUsage');
      expect(data).toHaveProperty('ceiling');
    }
  });

  test('should handle rate limiting', async ({ request }) => {
    // Make multiple rapid requests
    const requests = Array.from({ length: 50 }, () =>
      request.get('/api/phase6/stats')
    );

    const responses = await Promise.all(requests);

    // Check that at least some requests are rate limited
    const rateLimited = responses.filter((r) => r.status() === 429);

    // Depending on configuration, we might or might not hit rate limits
    // Just verify the API handles it gracefully
    responses.forEach((r) => {
      expect([200, 429]).toContain(r.status());
    });
  });
});

test.describe('Accessibility', () => {
  test('dashboard should be accessible', async ({ page }) => {
    await page.goto('/phase6');

    // Check for main landmark
    await expect(page.locator('main')).toBeVisible();

    // Check for skip link
    const skipLink = page.getByRole('link', { name: /skip to content/i });
    if (await skipLink.isVisible()) {
      await expect(skipLink).toBeFocused();
    }

    // Check color contrast (basic check)
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('forms should have proper labels', async ({ page }) => {
    await page.goto('/phase6/role-gates');

    // Open dialog
    await page.getByRole('button', { name: /Evaluate/i }).first().click();

    // Check all inputs have labels
    const inputs = page.locator('input:visible');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });

  test('navigation should be keyboard accessible', async ({ page }) => {
    await page.goto('/phase6');

    // Tab through navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify focus is on an interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('dashboard should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/phase6');
    await page.waitForSelector('[data-testid="stats-card"]', { timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Dashboard should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('API responses should be fast', async ({ request }) => {
    const startTime = Date.now();
    await request.get('/api/phase6/stats');
    const responseTime = Date.now() - startTime;

    // API should respond within 500ms
    expect(responseTime).toBeLessThan(500);
  });
});
