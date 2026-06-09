import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    paths: {
      relative: false,
    },
    alias: {
      $lib: 'src/lib',
      '$lib/*': 'src/lib/*',
    },
  },
  // Note: do NOT set `compilerOptions.runes: true` here — that would force
  // runes mode for external libraries (e.g. @testing-library/svelte-core)
  // and break their compiled output. Runes are auto-detected per-file in
  // Svelte 5.20+ when `$state`, `$props`, etc. appear in the module.
};

export default config;
