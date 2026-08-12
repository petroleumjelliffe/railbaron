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

describe('the begin gate', () => {
  it('starts in setup, with no game under way', () => {
    expect(replay([]).phase).toBe('setup');
    expect(replay([join('red', 'ADA')]).phase).toBe('setup');
  });

  it('is playing once the log says it started', () => {
    expect(replay([join('red', 'ADA'), { type: 'started' }]).phase).toBe('playing');
  });
});

describe('renaming a seat', () => {
  it('changes the name without disturbing the journeys', () => {
    const state = replay([
      join('red', 'ADA'),
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: 4500 },
      { type: 'renamed', seat: 'red', name: 'MARGO' }
    ]);
    expect(state.seats.red.name).toBe('MARGO');
    expect(state.seats.red.stops).toHaveLength(1);
  });

  it('vacates the seat when the name is cleared', () => {
    const state = replay([join('red', 'ADA'), { type: 'renamed', seat: 'red', name: null }]);
    expect(state.seats.red.name).toBeNull();
  });
});

describe('what a seat has earned', () => {
  it('sums the payouts, counting a zero-paying journey as zero', () => {
    const state = replay([
      join('red', 'ADA'),
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: 4500 },
      { type: 'arrived', seat: 'red', city: 47, region: 'PL', payout: 0 },
      { type: 'arrived', seat: 'red', city: 59, region: 'SW', payout: 8500 }
    ]);
    expect(state.seats.red.earned).toBe(13000);
  });

  it('ignores home towns, which pay nothing at all', () => {
    const state = replay([
      join('red', 'ADA'),
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null }
    ]);
    expect(state.seats.red.earned).toBe(0);
  });
});

describe('undo', () => {
  it('does nothing during setup — a taken seat is renamed, not undone', () => {
    const log: GameEvent[] = [join('red', 'ADA')];
    expect(undo(log)).toEqual(log);
  });

  it('refuses to rewind back across the start of the game', () => {
    const log: GameEvent[] = [join('red', 'ADA'), { type: 'started' }];
    expect(undo(log)).toEqual(log);
  });

  it('takes back the last move once play is under way', () => {
    const log: GameEvent[] = [
      join('red', 'ADA'),
      { type: 'started' },
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: 4500 }
    ];
    expect(undo(log)).toHaveLength(2);
    expect(replay(undo(log)).seats.red.stops).toEqual([]);
  });

  it('does nothing to an empty log', () => {
    expect(undo([])).toEqual([]);
  });
});
