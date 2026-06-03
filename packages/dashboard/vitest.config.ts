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
		alias: {
			'@': path.resolve(__dirname, './src'),
			$lib: path.resolve(__dirname, './src/lib')
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html']
		}
	}
});
