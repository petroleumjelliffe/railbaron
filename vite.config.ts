import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// Extensionless, matching Acquire. Vite 8's native config loader warns and
// wants './basePath.ts', but tsc rejects that without
// allowImportingTsExtensions — a repo-wide compiler flag is too much to
// spend on a deprecation warning that has not landed yet.
import { BASE_PATH } from './basePath';

/**
 * GitHub Pages serves static files and knows nothing about client-side
 * routes, so a direct load or a refresh on /pass-and-play/game returns its
 * own 404 page rather than the app. Pages falls back to 404.html for any
 * path it cannot find, so shipping a copy of index.html under that name
 * hands those URLs back to the router.
 *
 * Written at build time rather than kept as a second file in the repo, which
 * would be an identical copy that silently stops matching.
 */
function pagesFallback(): Plugin {
  return {
    name: 'railbaron:pages-fallback',
    apply: 'build',
    closeBundle() {
      const built = resolve('dist', 'index.html');
      if (existsSync(built)) copyFileSync(built, resolve('dist', '404.html'));
    }
  };
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), pagesFallback()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: { name: 'engine', environment: 'node', include: ['engine/**/*.test.ts'] }
      },
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          // The shared lobby's client half runs here too. A consumer that
          // does not run the shared tests will not notice when a submodule
          // bump breaks it.
          include: ['src/**/*.test.{ts,tsx}', 'vendor/lobby/client/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts']
        }
      }
    ]
  }
});
