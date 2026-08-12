/**
 * The one copy of the GitHub Pages base path.
 *
 * Root-level rather than in `src/` because `vite.config.ts` and build
 * scripts run under Node, outside the app graph. Acquire's equivalent
 * records having lived in three places — the Vite config, the entry point
 * and the manifest generator — before it was consolidated; this file exists
 * before that can happen here.
 *
 * Rail Baron has no deploy yet, so this value is unverified. The point of
 * the file is to be the only place it will need changing when there is one.
 */
export const BASE_PATH = '/railbaron';
