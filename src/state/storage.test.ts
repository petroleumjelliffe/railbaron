import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY, clearLog, loadLog, saveLog } from './storage';
import type { GameEvent } from './events';

const log: GameEvent[] = [
  { type: 'joined', seat: 'red', name: 'Pete' },
  { type: 'arrived', seat: 'red', city: 43, region: 'PL', payout: null },
  { type: 'arrived', seat: 'red', city: 47, region: 'PL', payout: 0 }
];

describe('persistence', () => {
  beforeEach(() => localStorage.clear());

  it('namespaces its key, because this origin is shared with another game', () => {
    expect(STORAGE_KEY.startsWith('railbaron:')).toBe(true);
  });

  it('round-trips a log, zero payouts included', () => {
    saveLog(log);
    const back = loadLog();
    expect(back).toEqual(log);
    expect(back[2]!.type === 'arrived' && back[2]!.payout).toBe(0);
  });

  it('returns an empty log when nothing has been saved', () => {
    expect(loadLog()).toEqual([]);
  });

  it('returns an empty log rather than throwing on damaged data', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadLog()).toEqual([]);
  });

  it('ignores a log written by a future version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, events: log }));
    expect(loadLog()).toEqual([]);
  });

  it('leaves other games\' keys alone when clearing', () => {
    localStorage.setItem('acquire:something', 'keep me');
    saveLog(log);
    clearLog();
    expect(loadLog()).toEqual([]);
    expect(localStorage.getItem('acquire:something')).toBe('keep me');
  });
});
