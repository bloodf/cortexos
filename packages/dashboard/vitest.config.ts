import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'playwright-report/**', 'test-results/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // SvelteKit convention: `$lib` resolves to `src/lib`. Used by the
      // new data layer at `src/lib/server/db/`. Both aliases point at
      // the same `src/` root.
      '$lib': path.resolve(__dirname, './src/lib'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
