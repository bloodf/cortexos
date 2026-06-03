import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
	const isTest = mode === 'test' || process.env.VITEST === 'true';

	return {
		plugins: [tailwindcss(), sveltekit()],

		resolve: isTest ? { conditions: ['browser'] } : undefined,

		server: {
			port: 5173,
			strictPort: false
		},

		test: {
			environment: 'jsdom',
			setupFiles: ['./vitest.setup.ts'],
			globals: true,
			exclude: ['e2e/**', 'node_modules/**', '.svelte-kit/**', 'playwright-report/**', 'test-results/**'],
			alias: {
				'@': new URL('./src', import.meta.url).pathname,
				$lib: new URL('./src/lib', import.meta.url).pathname
			},
			coverage: {
				provider: 'v8',
				reporter: ['text', 'json', 'html']
			}
		}
	};
});
