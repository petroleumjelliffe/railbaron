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

  it('exposes localStorage.length and localStorage.key() on the real Storage implementation', () => {
    localStorage.setItem('key1', 'value1');
    localStorage.setItem('key2', 'value2');
    expect(localStorage.length).toBe(2);
    expect([localStorage.key(0), localStorage.key(1)]).toContain('key1');
    expect([localStorage.key(0), localStorage.key(1)]).toContain('key2');
  });

  it('discards a log where an arrived event names a city id that was never real', () => {
    const bad: GameEvent[] = [
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 999, region: 'PL', payout: 0 }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, events: bad }));
    expect(loadLog()).toEqual([]);
  });

  it('discards a log where a real city id is filed under the wrong region', () => {
    // City 4 is New York, which is in NE, not SW — structurally valid, but
    // the two fields disagree about where the baron actually is.
    const bad: GameEvent[] = [
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 4, region: 'SW', payout: 0 }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, events: bad }));
    expect(loadLog()).toEqual([]);
  });

  it('discards a log containing an event with an unknown type', () => {
    const bad = [
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'departed', seat: 'red' }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, events: bad }));
    expect(loadLog()).toEqual([]);
  });

  it('discards the whole log when only one of several events is bad, not just the bad one', () => {
    const mostlyGood: unknown[] = [
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 999, region: 'PL', payout: 0 },
      { type: 'joined', seat: 'blue', name: 'Alex' }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, events: mostlyGood }));
    expect(loadLog()).toHaveLength(0);
  });

  it('round-trips a well-formed log of all three event variants unchanged', () => {
    const full: GameEvent[] = [
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 43, region: 'PL', payout: null },
      { type: 'regionRequested', seat: 'red', rolled: 'NE' },
      { type: 'arrived', seat: 'red', city: 4, region: 'NE', payout: 31000 }
    ];
    saveLog(full);
    expect(loadLog()).toEqual(full);
  });
});
