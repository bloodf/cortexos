/**
 * V11 — Playwright E2E config for CortexOS dashboard.
 *
 * Targets the local dev server on port 3080 (matches `pnpm run dev` +
 * compose). `webServer` autostarts dev mode if not already running. CI
 * usage is manual-trigger only (see .github/workflows/e2e-dashboard.yml).
 *
 * ─── Mock-API scenario switch (M1-WS5) ──────────────────────────────
 * The `x-mock-scenario` header (or `?scenario=<name>` query) tells
 * the SvelteKit server hook + browser MSW worker which scripted
 * reality to return. Per the M0-F test strategy §4.3, scenarios
 * are hot-swappable; no server restart is required.
 *
 * Use the helper `setScenario(page, name)` (declared in
 * `e2e/helpers/scenario.ts`) to switch scenarios mid-test. The
 * default for every test is `happy`.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3080);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/** Default scenario applied to every request via the test context. */
const DEFAULT_SCENARIO = process.env.E2E_MOCK_SCENARIO ?? "happy";

export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: process.env.CI ? [["github"], ["list"]] : "list",
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		// Default headers applied to every request from this context.
		// The x-mock-scenario header is the primary switch used by the
		// SvelteKit server hook; the MSW worker reads the same header
		// (or ?scenario= query as a fallback).
		extraHTTPHeaders: {
			"x-mock-scenario": DEFAULT_SCENARIO,
		},
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: process.env.E2E_NO_WEBSERVER
		? undefined
		: {
				// Inject E2E_MOCK_MODE so the SvelteKit hooks.server.ts
				// installs the mock handle. The MSW browser worker is
				// started from the +layout.svelte (M1-WS2 will wire it
				// up; until then the server-side hook is the canonical
				// entry point).
				command: `E2E_MOCK_MODE=1 E2E_MOCK_SCENARIO=${DEFAULT_SCENARIO} pnpm run dev`,
				port: PORT,
				reuseExistingServer: true,
				timeout: 120_000,
				stdout: "pipe",
				stderr: "pipe",
			},
});
