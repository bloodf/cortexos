import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			// adapter-node defaults to out=build; keep it self-host friendly.
			out: 'build',
			precompress: false,
			envPrefix: ''
		}),
		alias: {
			$lib: './src/lib',
			$contracts: '../../contracts/src'
		},
		// Type-check via svelte-check; this enables `svelte-kit sync` outputs.
		typescript: {
			config: (cfg) => ({
				...cfg,
				compilerOptions: {
					...cfg.compilerOptions,
					// The root tsconfig.json already extends the SvelteKit-generated
					// `.svelte-kit/tsconfig.json`; we leave room for per-package overrides.
				}
			})
		}
	},

	// Svelte 5 compiler options: ensure runes are the default.
	compilerOptions: {
		runes: true
	}
};

export default config;
