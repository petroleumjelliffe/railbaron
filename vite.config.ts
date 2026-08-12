import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// Extensionless, matching Acquire. Vite 8's native config loader warns and
// wants './basePath.ts', but tsc rejects that without
// allowImportingTsExtensions — a repo-wide compiler flag is too much to
// spend on a deprecation warning that has not landed yet.
import { BASE_PATH } from './basePath';

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
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
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts']
        }
      }
    ]
  }
});
