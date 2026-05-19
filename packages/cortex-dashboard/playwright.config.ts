/**
 * V11 — Playwright E2E config for CortexOS dashboard.
 *
 * Targets the local dev server on port 3080 (matches `pnpm run dev` +
 * compose). `webServer` autostarts dev mode if not already running. CI
 * usage is manual-trigger only (see .github/workflows/e2e-dashboard.yml).
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3080);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

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
				command: "pnpm run dev",
				port: PORT,
				reuseExistingServer: true,
				timeout: 120_000,
				stdout: "pipe",
				stderr: "pipe",
			},
});
