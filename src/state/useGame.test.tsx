import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { nodeForCity } from '../../engine';
import { STORAGE_KEY, saveLog } from './storage';
import type { GameEvent } from './events';
import { useGame } from './useGame';

const MINNEAPOLIS = nodeForCity(43);
const ST_PAUL = nodeForCity(47);

/** Feeds exact die faces so a roll is never a guess. */
const dice = (...faces: number[]) => {
  const queue = [...faces];
  return () => {
    const face = queue.shift();
    if (face === undefined) return Math.random();
    return (face - 1) / 6;
  };
};

const seated: GameEvent[] = [
  { type: 'joined', seat: 'red', name: 'ADA' },
  { type: 'joined', seat: 'green', name: 'GRACE' },
  { type: 'started' },
  { type: 'arrived', seat: 'red', city: 43, region: 'PL', payout: null },
  { type: 'arrived', seat: 'green', city: 47, region: 'PL', payout: null },
  { type: 'orderRolled', seat: 'red', first: 'red' }
];

/**
 * `seated` plus red's destination: Minneapolis (home) to St. Paul, one of
 * the board's only two real, zero-paying journeys. Rolling movement dice
 * needs a destination to move toward, so any test that gets past that guard
 * builds on this rather than on `seated` alone — and using the $0 journey
 * here means the payout takes the same path a real one would, so a
 * downstream `if (payout)` bug would show up as a test failure.
 */
const underway: GameEvent[] = [
  ...seated,
  { type: 'arrived', seat: 'red', city: 47, region: 'PL', payout: 0 }
];

/**
 * `underway` plus green's own destination — St. Paul (green's home) back to
 * Minneapolis, the same $0 pair in reverse. Needed wherever a test means to
 * isolate a guard that fires *after* `needsDestination`, such as the turn
 * check: with only `underway`, green still owes a destination of its own,
 * so `rollDice('green')` would be refused by that guard regardless of whose
 * turn it is, and the turn check would never actually run.
 */
const bothUnderway: GameEvent[] = [
  ...underway,
  { type: 'arrived', seat: 'green', city: 43, region: 'PL', payout: 0 }
];

beforeEach(() => localStorage.clear());

describe('rolling the movement dice', () => {
  it('hands back the dice without putting them in the log', () => {
    saveLog(underway);
    const { result } = renderHook(() => useGame(dice(3, 4)));
    let rolled: unknown;
    act(() => { rolled = result.current.rollDice('red'); });
    expect(rolled).toEqual({ white: [3, 4], bonus: null });
    expect(result.current.state.rolled).toBeNull();
  });

  it('reaches the log only through commitDice', () => {
    saveLog(seated);
    const { result } = renderHook(() => useGame(dice(3, 4)));
    act(() => { result.current.commitDice('red', { white: [3, 4], bonus: null }); });
    expect(result.current.state.rolled).toEqual({ white: [3, 4], bonus: null });
  });

  it('refuses a baron whose turn it is not', () => {
    saveLog(bothUnderway);
    const { result } = renderHook(() => useGame(dice(3, 4)));
    expect(result.current.rollDice('green')).toBeNull();
  });

  it('refuses a second roll inside one turn', () => {
    saveLog([...underway, { type: 'turnRolled', seat: 'red', white: [3, 4], bonus: null }]);
    const { result } = renderHook(() => useGame(dice(1, 1)));
    expect(result.current.rollDice('red')).toBeNull();
  });
});

describe('rolling a destination', () => {
  it('refuses one mid-trip', () => {
    saveLog([...seated,
      { type: 'arrived', seat: 'red', city: 47, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'red', white: [1, 1], bonus: null },
      { type: 'moved', seat: 'red', path: [MINNEAPOLIS, 'd66'], arrived: false }]);
    const { result } = renderHook(() => useGame(Math.random));
    expect(result.current.roll('red')).toBeNull();
  });

  it('refuses a home city another baron already holds', () => {
    // Only red is seated and homed; green's home roll must avoid red's city.
    saveLog([
      { type: 'joined', seat: 'red', name: 'ADA' },
      { type: 'joined', seat: 'green', name: 'GRACE' },
      { type: 'started' },
      { type: 'arrived', seat: 'red', city: 43, region: 'PL', payout: null }
    ]);
    const { result } = renderHook(() => useGame(Math.random));
    for (let attempt = 0; attempt < 40; attempt++) {
      const outcome = result.current.roll('green');
      expect(outcome).not.toBeNull();
      expect((outcome as { city: number }).city).not.toBe(43);
    }
  });
});

describe('committing a move', () => {
  it('appends one leg and moves the pawn', () => {
    saveLog([...underway,
      { type: 'turnRolled', seat: 'red', white: [1, 1], bonus: null }]);
    const { result } = renderHook(() => useGame(Math.random));
    act(() => { result.current.commitMove('red', [MINNEAPOLIS, ST_PAUL], true); });
    expect(result.current.state.seats.red.at).toBe(ST_PAUL);
    expect(result.current.state.turn).toBe('green');
  });
});

describe('a second tab', () => {
  it('follows the log when another tab writes it', () => {
    saveLog(seated);
    const { result } = renderHook(() => useGame(Math.random));
    expect(result.current.state.turn).toBe('red');

    // What another tab's write looks like from in here: the store already
    // holds the new log, and the event says which key moved.
    act(() => {
      saveLog([...seated,
        { type: 'turnRolled', seat: 'red', white: [2, 2], bonus: null }]);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });
    expect(result.current.state.rolled).toEqual({ white: [2, 2], bonus: null });
  });

  it('ignores a key that is not ours', () => {
    saveLog(seated);
    const { result } = renderHook(() => useGame(Math.random));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'acquire:log:v1' }));
    });
    expect(result.current.state.turn).toBe('red');
  });
});
