import { describe, expect, it } from 'vitest';
import { replay, undo } from './game';
import type { GameEvent } from './events';

const join = (seat: 'red' | 'blue', name: string): GameEvent =>
  ({ type: 'joined', seat, name });

describe('replaying the log', () => {
  it('starts with six empty seats', () => {
    const state = replay([]);
    expect(Object.keys(state.seats)).toHaveLength(6);
    expect(state.seats.red.name).toBeNull();
    expect(state.seats.red.stops).toEqual([]);
    expect(state.seats.red.awaiting).toBeNull();
  });

  it('seats a player by name', () => {
    expect(replay([join('red', 'Pete')]).seats.red.name).toBe('Pete');
  });

  it('records a home town with no payout', () => {
    const state = replay([
      join('red', 'Pete'),
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null }
    ]);
    expect(state.seats.red.stops).toEqual([{ city: 20, region: 'NC', payout: null }]);
  });

  it('keeps a zero payout as zero rather than losing it', () => {
    const state = replay([
      join('red', 'Pete'),
      { type: 'arrived', seat: 'red', city: 43, region: 'PL', payout: null },
      { type: 'arrived', seat: 'red', city: 47, region: 'PL', payout: 0 }
    ]);
    expect(state.seats.red.stops[1]!.payout).toBe(0);
  });

  it('holds a seat waiting once a region has been requested', () => {
    const state = replay([
      join('red', 'Pete'),
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null },
      { type: 'regionRequested', seat: 'red', rolled: 'NC' }
    ]);
    expect(state.seats.red.awaiting).toBe('NC');
  });

  it('clears the wait when the baron arrives somewhere', () => {
    const state = replay([
      join('red', 'Pete'),
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null },
      { type: 'regionRequested', seat: 'red', rolled: 'NC' },
      { type: 'arrived', seat: 'red', city: 59, region: 'SW', payout: 22000 }
    ]);
    expect(state.seats.red.awaiting).toBeNull();
    expect(state.seats.red.stops).toHaveLength(2);
  });

  it('keeps seats independent', () => {
    const state = replay([join('red', 'Pete'), join('blue', 'Sam')]);
    expect(state.seats.red.name).toBe('Pete');
    expect(state.seats.blue.name).toBe('Sam');
    expect(state.seats.green.name).toBeNull();
  });

  it('is a pure fold — replaying twice gives the same answer', () => {
    const log: GameEvent[] = [
      join('red', 'Pete'),
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null }
    ];
    expect(replay(log)).toEqual(replay(log));
  });
});

describe('undo', () => {
  it('drops the last event', () => {
    const log: GameEvent[] = [
      join('red', 'Pete'),
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null }
    ];
    expect(undo(log)).toHaveLength(1);
    expect(replay(undo(log)).seats.red.stops).toEqual([]);
  });

  it('does nothing to an empty log', () => {
    expect(undo([])).toEqual([]);
  });
});
