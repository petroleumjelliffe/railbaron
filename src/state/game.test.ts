import { describe, expect, it } from 'vitest';
import { replay, undo } from './game';
import type { GameEvent } from './events';
import { nodeForCity } from '../../engine';
import { destinationOf, homesDone, needsDestination, nextHomeSeat, rotate } from './turns';

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

  it('leaves setup once the log says it started, landing in homes rather than playing', () => {
    // `started` alone is not enough to reach `playing` under the new model —
    // that also needs `orderRolled`, covered by `the phases` below. This
    // pins the other half: the gate does open, moving the game somewhere,
    // not nowhere.
    const state = replay([join('red', 'ADA'), { type: 'started' }]);
    expect(state.phase).not.toBe('setup');
    expect(state.phase).toBe('homes');
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

const MINNEAPOLIS_CITY = 43;
const ST_PAUL_CITY = 47;
const MINNEAPOLIS = nodeForCity(MINNEAPOLIS_CITY);
const ST_PAUL = nodeForCity(ST_PAUL_CITY);

/** Two seated barons, started, homes rolled, order settled on green. */
const twoBarons: GameEvent[] = [
  { type: 'joined', seat: 'red', name: 'ADA' },
  { type: 'joined', seat: 'green', name: 'GRACE' },
  { type: 'started' },
  { type: 'arrived', seat: 'red', city: MINNEAPOLIS_CITY, region: 'PL', payout: null },
  { type: 'arrived', seat: 'green', city: ST_PAUL_CITY, region: 'PL', payout: null },
  { type: 'orderRolled', seat: 'red', first: 'green' }
];

describe('the phases', () => {
  it('is setup before the game has started', () => {
    expect(replay([{ type: 'joined', seat: 'red', name: 'ADA' }]).phase).toBe('setup');
  });

  it('is homes once started, while home cities are still being rolled', () => {
    expect(replay(twoBarons.slice(0, 3)).phase).toBe('homes');
  });

  it('is playing once the order has been rolled', () => {
    expect(replay(twoBarons).phase).toBe('playing');
  });

  it('resumes a game saved before turn order existed in the homes phase', () => {
    // A v1.0.1 log: started, destinations rolled, no orderRolled. It lands in
    // `homes` with every home already in, so the only thing left is the roll
    // for first player — no migration code, and nothing discarded.
    const old = twoBarons.slice(0, 5);
    const state = replay(old);
    expect(state.phase).toBe('homes');
    expect(homesDone(state)).toBe(true);
  });
});

describe('where a pawn stands', () => {
  it('is nowhere until a home city is rolled', () => {
    expect(replay(twoBarons.slice(0, 3)).seats.red.at).toBeNull();
  });

  it('is the home city once one is', () => {
    expect(replay(twoBarons).seats.red.at).toBe(MINNEAPOLIS);
  });

  it('does not move when a destination is rolled', () => {
    const log: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'red', city: ST_PAUL_CITY, region: 'PL', payout: 0 }];
    expect(replay(log).seats.red.at).toBe(MINNEAPOLIS);
    expect(destinationOf(replay(log).seats.red)).toBe(ST_PAUL_CITY);
  });

  it('is the last node of the last leg once one has been walked', () => {
    const log: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'red', city: ST_PAUL_CITY, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'red', white: [3, 4], bonus: null },
      { type: 'moved', seat: 'red', path: [MINNEAPOLIS, ST_PAUL], arrived: true }];
    expect(replay(log).seats.red.at).toBe(ST_PAUL);
  });
});

describe('the sections a trip has spent', () => {
  const trip = (arrived: boolean): GameEvent[] => [...twoBarons,
    { type: 'arrived', seat: 'red', city: ST_PAUL_CITY, region: 'PL', payout: 0 },
    { type: 'turnRolled', seat: 'red', white: [1, 1], bonus: null },
    { type: 'moved', seat: 'red', path: [MINNEAPOLIS, ST_PAUL], arrived }];

  it('records every section a leg crossed', () => {
    expect(replay(trip(false)).seats.red.used.size).toBe(1);
  });

  it('releases them all on arrival', () => {
    expect(replay(trip(true)).seats.red.used.size).toBe(0);
  });
});

describe('turn order', () => {
  it('rotates the seated barons to start with the high roll', () => {
    expect(rotate(['red', 'green', 'blue'], 'green')).toEqual(['green', 'blue', 'red']);
    expect(rotate(['red', 'green', 'blue'], 'red')).toEqual(['red', 'green', 'blue']);
  });

  it('gives the first turn to whoever won the roll', () => {
    const state = replay(twoBarons);
    expect(state.order).toEqual(['green', 'red']);
    expect(state.turn).toBe('green');
  });

  it('stays with a baron whose turn is under way', () => {
    const log: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'green', city: MINNEAPOLIS_CITY, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'green', white: [3, 4], bonus: null }];
    const state = replay(log);
    expect(state.turn).toBe('green');
    expect(state.rolled).toEqual({ white: [3, 4], bonus: null });
  });

  it('passes to the left once the turn is spent', () => {
    const log: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'green', city: MINNEAPOLIS_CITY, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'green', white: [3, 4], bonus: null },
      { type: 'moved', seat: 'green', path: [ST_PAUL, MINNEAPOLIS], arrived: true }];
    const state = replay(log);
    expect(state.turn).toBe('red');
    expect(state.rolled).toBeNull();
  });

  it('keeps the turn when a bonus leg is still owed', () => {
    // Arrived inside the white dice with a bonus die rolled: the book has the
    // player roll a new destination and spend the bonus starting that trip.
    const log: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'green', city: MINNEAPOLIS_CITY, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'green', white: [6, 6], bonus: 4 },
      { type: 'moved', seat: 'green', path: [ST_PAUL, MINNEAPOLIS], arrived: true }];
    const state = replay(log);
    expect(state.turn).toBe('green');
    expect(state.rolled).toEqual({ white: [6, 6], bonus: 4 });
  });

  it('ends the turn after the bonus leg', () => {
    const log: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'green', city: MINNEAPOLIS_CITY, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'green', white: [6, 6], bonus: 4 },
      { type: 'moved', seat: 'green', path: [ST_PAUL, MINNEAPOLIS], arrived: true },
      { type: 'arrived', seat: 'green', city: ST_PAUL_CITY, region: 'PL', payout: 0 },
      { type: 'moved', seat: 'green', path: [MINNEAPOLIS, ST_PAUL], arrived: true }];
    expect(replay(log).turn).toBe('red');
  });

  it('counts the leg so the bonus leg knows what it has to spend', () => {
    const base: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'green', city: MINNEAPOLIS_CITY, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'green', white: [6, 6], bonus: 4 }];
    expect(replay(base).leg).toBe(0);
    const after: GameEvent[] = [...base,
      { type: 'moved', seat: 'green', path: [ST_PAUL, MINNEAPOLIS], arrived: true }];
    expect(replay(after).leg).toBe(1);
  });
});

/**
 * A turn is no longer one event, so neither is taking one back. The row that
 * offers this says "Take back a turn"; these are what make that true.
 */
describe('undo takes back a whole turn', () => {
  /** GREEN is up, standing in St. Paul and bound for Minneapolis. */
  const upNext: GameEvent[] = [...twoBarons,
    { type: 'arrived', seat: 'green', city: MINNEAPOLIS_CITY, region: 'PL', payout: 0 }];

  const shorterBy = (log: GameEvent[]) => log.length - undo(log).length;

  it('pops the roll and the leg together, and hands the turn back', () => {
    const log: GameEvent[] = [...upNext,
      { type: 'turnRolled', seat: 'green', white: [3, 4], bonus: null },
      { type: 'moved', seat: 'green', path: [ST_PAUL, MINNEAPOLIS], arrived: true }];
    expect(replay(log).turn, 'the turn had passed on').toBe('red');

    expect(shorterBy(log)).toBe(2);
    const state = replay(undo(log));
    expect(state.turn).toBe('green');
    expect(state.rolled).toBeNull();
    expect(state.seats.green.at).toBe(ST_PAUL);
  });

  it('pops all four events of a turn with a bonus leg', () => {
    // Arrived inside the white dice: paid, given a new destination, and the
    // bonus die spent starting that trip. One tap took back the last leg
    // alone and left the board mid-turn with dice still on the table.
    const log: GameEvent[] = [...upNext,
      { type: 'turnRolled', seat: 'green', white: [6, 6], bonus: 4 },
      { type: 'moved', seat: 'green', path: [ST_PAUL, MINNEAPOLIS], arrived: true },
      { type: 'arrived', seat: 'green', city: ST_PAUL_CITY, region: 'PL', payout: 0 },
      { type: 'moved', seat: 'green', path: [MINNEAPOLIS, ST_PAUL], arrived: true }];

    expect(shorterBy(log)).toBe(4);
    expect(undo(log)).toEqual(upNext);
    const state = replay(undo(log));
    expect(state.turn).toBe('green');
    expect(state.rolled).toBeNull();
    expect(state.leg).toBe(0);
    expect(state.seats.green.stops).toHaveLength(2);
  });

  it('pops a roll that has not been walked yet, and nothing else', () => {
    const log: GameEvent[] = [...upNext,
      { type: 'turnRolled', seat: 'green', white: [3, 4], bonus: null }];
    expect(shorterBy(log)).toBe(1);
    expect(replay(undo(log)).rolled).toBeNull();
    expect(replay(undo(log)).turn).toBe('green');
  });

  it('pops a destination on its own — it is its own action, not a turn', () => {
    expect(shorterBy(upNext)).toBe(1);
    expect(undo(upNext)).toEqual(twoBarons);
  });

  it('pops a region ballot on its own too', () => {
    const log: GameEvent[] = [...twoBarons,
      { type: 'regionRequested', seat: 'green', rolled: 'PL' }];
    expect(shorterBy(log)).toBe(1);
    expect(replay(undo(log)).seats.green.awaiting).toBeNull();
  });
});

describe('who may be given a destination', () => {
  const nodeOf = nodeForCity;

  it('may be, with no home city yet', () => {
    expect(needsDestination(replay(twoBarons.slice(0, 3)).seats.red, nodeOf)).toBe(true);
  });

  it('may be, standing on the last destination reached', () => {
    expect(needsDestination(replay(twoBarons).seats.red, nodeOf)).toBe(true);
  });

  it('may not be, part-way along a trip', () => {
    const log: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'red', city: ST_PAUL_CITY, region: 'PL', payout: 0 }];
    expect(needsDestination(replay(log).seats.red, nodeOf)).toBe(false);
  });
});

describe('whose home city is owed', () => {
  it('is the first seated baron without one, in seat order', () => {
    expect(nextHomeSeat(replay(twoBarons.slice(0, 3)))).toBe('red');
    expect(nextHomeSeat(replay(twoBarons.slice(0, 4)))).toBe('green');
    expect(nextHomeSeat(replay(twoBarons))).toBeNull();
  });
});

describe('the last committed move', () => {
  it('is nothing before anyone has moved', () => {
    expect(replay(twoBarons).lastMove).toBeNull();
  });

  it('is the most recent leg, whoever walked it', () => {
    const log: GameEvent[] = [...twoBarons,
      { type: 'arrived', seat: 'green', city: MINNEAPOLIS_CITY, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'green', white: [1, 1], bonus: null },
      { type: 'moved', seat: 'green', path: [ST_PAUL, MINNEAPOLIS], arrived: true }];
    expect(replay(log).lastMove)
      .toEqual({ seat: 'green', path: [ST_PAUL, MINNEAPOLIS], arrived: true });
  });
});
