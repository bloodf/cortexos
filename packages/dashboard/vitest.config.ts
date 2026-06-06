import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	// Force the `browser` export condition so `import { mount } from 'svelte'`
	// resolves to the browser build (with mount/unmount), not the
	// server build. The svelte package's `exports` map defaults to
	// `index-server.js`; the test render harness needs `mount` from
	// `index-client.js`.
	resolve: {
		conditions: ['browser'],
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./vitest.setup.ts'],
		globals: true,
		exclude: ['e2e/**', 'node_modules/**', '.svelte-kit/**', 'playwright-report/**', 'test-results/**'],
		// PGlite (used by session-store-drizzle + db/repos tests) is
		// ~3-5x slower under coverage instrumentation. Bump the global
		// test timeout to 30s so these don't flake on the Linux CI VM.
		testTimeout: 30_000,
		alias: {
			'@': path.resolve(__dirname, './src'),
			$lib: path.resolve(__dirname, './src/lib')
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			// Default: only files imported during tests are counted. We use
			// `exclude` to drop test-infrastructure that test code imports
			// (e.g. mocks/server.ts is imported by test files but is dev-only
			// MSW plumbing, not production logic). Without exclude these would
			// be reported with 0% coverage and drag the overall % down.
			exclude: [
				// Test infrastructure (MSW dev-only, static data, helpers)
				'src/lib/mocks/**',
				'src/lib/icons/**',
				'src/lib/i18n/**',
				'src/lib/utils/test-render.ts',
				'src/lib/server/db/test-utils.ts',
				// Svelte generated type files
				'**/*.svelte.d.ts',
				// Test scaffolding
				'vitest.config.ts',
				'vitest.setup.ts',
				'playwright.config.ts'
			],
			thresholds: {
				lines: 95,
				functions: 95,
				branches: 95,
				statements: 95
			}
		}
	}
});
