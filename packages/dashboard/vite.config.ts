import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    tailwindcss(),
    // svelte() (client-side) so component unit tests can `mount()` Svelte 5
    // components. We intentionally do NOT include sveltekit() here — vitest
    // wants the client build of components, and the sveltekit() plugin picks
    // SSR when it can't see a route context. SvelteKit's dev/build pipeline
    // is in vite.config.dev.ts / vite.config.build.ts (separate files).
    svelte({ hot: false }),
  ],
  resolve: {
    // Use the browser build of Svelte so the runes compiler emits client code.
    conditions: ['browser'],
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    server: {
      deps: {
        // Svelte + testing-library both ship ESM with `svelte/internal/client`
        // imports. Pre-bundling them causes the runes-compiler to choke on the
        // `$` namespace import. Let Vite transform them on-demand instead.
        inline: [/(svelte|testing-library)/],
      },
    },
    exclude: [
      'node_modules/**',
      '.svelte-kit/**',
      'build/**',
      'e2e/**',
      // Old Next.js tests — out of scope for the SvelteKit migration. M1-WS2
      // will delete the Next.js tree; the corresponding tests die with it.
      'src/lib/ai/**',
      'src/lib/incus/**',
      'src/lib/agents/**',
      'src/lib/alerts*.ts',
      'src/lib/api*.ts',
      'src/lib/auth*.ts',
      'src/lib/db/**',
      'src/lib/host-exec*',
      'src/lib/pam*',
      'src/lib/runtime/**',
      'src/lib/secrets/**',
      'src/lib/socket*',
      'src/lib/sys-pilot/**',
      'src/lib/theme-presets*',
      'src/lib/types*',
      'src/lib/validation/**',
    ],
    // For M1-WS3 we focus on the design system tests under src/lib/.
    include: ['src/lib/**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/components/ui/**/*.{ts,svelte}', 'src/lib/utils/**/*.{ts,svelte}'],
    },
  },
});
