import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
	// Ensure the Svelte 5 browser runtime is loaded in Vitest (per Svelte 5 testing docs).
	const isTest = mode === 'test' || process.env.VITEST === 'true';

	return {
		plugins: [tailwindcss(), sveltekit()],

		resolve: isTest
			? { conditions: ['browser'] }
			: undefined,

		server: {
			port: 5173,
			strictPort: false,
		},

		preview: {
			port: 3080,
			strictPort: false,
			host: '0.0.0.0',
		},

		test: {
			environment: 'jsdom',
			include: ['src/**/*.{test,spec}.{js,ts,svelte}', 'tests/**/*.{test,spec}.{js,ts,svelte}'],
			exclude: ['node_modules', '.svelte-kit', 'build', 'dist', 'e2e'],
			setupFiles: ['./vitest.setup.ts'],
			coverage: {
				provider: 'v8',
				reporter: ['text', 'html', 'lcov'],
				include: ['src/**/*.{js,ts,svelte}'],
				exclude: ['src/**/*.{test,spec}.{js,ts,svelte}', 'src/app.d.ts', 'src/hooks.server.ts'],
			},
		},
	};
});
