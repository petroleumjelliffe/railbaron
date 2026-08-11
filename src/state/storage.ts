import type { GameEvent } from './events';

/** Prefixed: this game shares the GitHub Pages origin with Acquire. */
export const STORAGE_KEY = 'railbaron:log:v1';

const VERSION = 1;

export function saveLog(events: readonly GameEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, events }));
  } catch {
    // A full or disabled store loses the save, not the game in progress.
  }
}

export function loadLog(): GameEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return [];
    const { version, events } = parsed as { version?: number; events?: unknown };
    if (version !== VERSION || !Array.isArray(events)) return [];
    return events as GameEvent[];
  } catch {
    return [];
  }
}

export function clearLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}
