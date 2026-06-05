/**
 * e2e/terminal.spec.ts — Playwright E2E for the wterm-backed
 * Terminal.svelte on the /terminal admin page.
 *
 * Mounts the terminal page as a real admin user, drives the wterm
 * input path (click into the grid to focus the hidden textarea,
 * type a command, press Enter), and asserts that the page's
 * banner + response output appear in the .term-row cells.
 *
 * The Vitest/jsdom suite in
 * `src/lib/components/terminal/__tests__/wterm-terminal-mount.test.ts`
 * covers the same lifecycle in jsdom. This spec exists for the
 * what-jsdom-cannot-check slice: real font metrics, real keyboard
 * events, real Chromium composition pipeline, and the wterm CSS
 * actually rendering.
 *
 * CI concern: the live playwright run is manual (see
 * `.github/workflows/e2e-dashboard.yml`). The spec must be in
 * the PR; the run is out of scope for this commit per the W49
 * plan (cortexos-test OrbStack VM is the live-host target, not
 * CI). Run locally with:
 *
 *   pnpm --filter @cortexos/dashboard test:e2e -- e2e/terminal.spec.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Terminal page (wterm-backed)', () => {
  test.beforeEach(async ({ page }) => {
    // Use the happy scenario so the /api/terminal endpoint returns
    // the canned allowlisted-op responses. login.spec.ts uses the
    // same header to short-circuit the auth path.
    await page.setExtraHTTPHeaders({ 'x-mock-scenario': 'happy' });
  });

  test('renders the wterm grid and a 24-row terminal', async ({ page }) => {
    // The /terminal page is admin-only; log in as the mock admin.
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('testadmin');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/terminal/);

    // The host element contract (matches Terminal.svelte + wterm).
    const host = page.locator('[data-slot="terminal"]');
    await expect(host).toBeVisible();
    await expect(host).toHaveAttribute('role', 'application');
    await expect(host).toHaveAttribute('aria-label', 'Terminal');
    // wterm adds the .wterm class during WTerm construction.
    await expect(host).toHaveClass(/wterm/);
    // Default grid is 24 rows × 80 cols. We assert the row count
    // only — col count is layout-dependent.
    await expect(host.locator('.term-grid .term-row')).toHaveCount(24);
  });

  test('typing a command produces output via the /api/terminal bridge', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('testadmin');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/terminal/);

    const host = page.locator('[data-slot="terminal"]');
    await expect(host.locator('.term-grid')).toBeVisible();

    // Click into the grid to focus wterm's hidden textarea.
    await host.click();
    // The default banner advertises the bash -c ban — assert it is
    // visible (proves the initial write() reached the renderer).
    await expect(host).toContainText(/bash -c/);

    // Type a known allowlisted op. 'docker ps' is the canonical
    // happy-scenario op per scripts/smoke/real-host.sh T3.x.
    await page.keyboard.type('docker ps');
    await page.keyboard.press('Enter');

    // The +page.svelte echoes the dispatch into the terminal. The
    // exact "argv" text comes from the mock; we assert on the
    // shape (the arrow + status code + accepted label) rather
    // than the full string to stay mock-stable.
    await expect(host).toContainText(/→ docker ps/);
    await expect(host).toContainText(/accepted/);
  });
});
