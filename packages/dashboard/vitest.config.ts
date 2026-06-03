import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
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
