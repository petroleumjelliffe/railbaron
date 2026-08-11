import { isGameEvent, type GameEvent } from './events';

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
    // All-or-nothing: a log with one bad event and the rest filtered out
    // would replay into a state that never existed (a seat arriving
    // somewhere it never departed from). An empty board is an honest
    // failure; a silently-repaired one isn't.
    return events.every(isGameEvent) ? events : [];
  } catch {
    return [];
  }
}

export function clearLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}
