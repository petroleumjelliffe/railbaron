import { describe, expect, it } from 'vitest';
import { cityAt, cityById } from '../../engine';
import { GAMES } from '../../engine/golden/games';
import { runGoldenGame } from '../../engine/golden/runner';
import type { GameEvent } from './events';
import { replay } from './game';

/**
 * A golden game and the event log say the same thing two different ways: the
 * runner folds the engine's functions, replay folds the log. They are two
 * implementations of one rule, so this is where they are made to agree.
 * Without it the executable rules spec could drift away from the game the app
 * actually plays, and neither suite would notice.
 *
 * The log is built rather than scripted: a baron seated at the fixture's
 * starting node, then one `moved` per committed leg. `turnRolled` is included
 * because replay's leg counter reads it, and its faces are irrelevant here —
 * this test is about where the pawn ends and what the trip has spent, not
 * about the dice.
 */
/** Both spent-section tallies in one comparable shape: key and count, ordered. */
const sections = (used: ReadonlyMap<string, number>): [string, number][] =>
  [...used].sort(([a], [b]) => a.localeCompare(b));

describe('replay agrees with the golden runner', () => {
  for (const game of GAMES) {
    it(`${game.id}: leaves the pawn and the trip in the same state`, () => {
      const finished = runGoldenGame(game);

      // Every golden fixture starts on a city, never a plain dot — a home
      // roll needs a city to land on. If a future fixture starts on a dot
      // instead, this throws rather than silently skipping the game.
      const home = cityAt(game.setup.at);
      if (home === null) {
        throw new Error(
          `${game.id}: fixture starts on a dot (${game.setup.at}), not a city — ` +
          'no home city to build a replay log from'
        );
      }

      const log: GameEvent[] = [
        { type: 'joined', seat: 'red', name: 'ADA' },
        { type: 'started' },
        // The region must be the one this city really belongs to — isGameEvent
        // checks cityById(city).region === region and rejects the whole log
        // otherwise.
        { type: 'arrived', seat: 'red', city: home, region: cityById(home).region, payout: null },
        { type: 'orderRolled', seat: 'red', first: 'red' }
      ];
      for (const leg of finished.legs) {
        log.push({ type: 'turnRolled', seat: 'red', white: [1, 1], bonus: null });
        log.push({ type: 'moved', seat: 'red', path: [...leg.path], arrived: leg.arrived });
      }

      const seat = replay(log).seats.red;
      expect(seat.at, 'where the pawn ended').toBe(finished.at);
      // The map, not its size. A section carrying two railroads may be
      // crossed twice, so the counts are the rule — comparing sizes alone
      // passes even if replay marks each section used without ever counting
      // it, and an app built on that would offer a third crossing.
      expect(sections(seat.used), 'sections the trip has spent')
        .toEqual(sections(finished.used));
    });
  }
});
