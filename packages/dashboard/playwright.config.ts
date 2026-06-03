import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — E2E shell test for the SvelteKit dashboard.
 *
 * The web server is the SvelteKit production preview (port 3080,
 * matching the legacy Next.js dashboard port per the audit, §6.3).
 * CI builds first, then starts `pnpm preview` which boots
 * `adapter-node` (or vite preview in dev mode). In local dev
 * `pnpm dev` is enough; Playwright will reuse it via
 * `reuseExistingServer`.
 */
export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3080',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: process.env.PLAYWRIGHT_NO_WEBSERVER ? 'true' : 'pnpm run build && pnpm run preview',
		port: 3080,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
