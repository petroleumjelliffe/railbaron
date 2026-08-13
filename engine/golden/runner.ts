import { expect } from 'vitest';
import { bonusLegOwed, movement, rollTurn } from '../dice';
import { isRejection } from '../movement';
import { sectionKey } from '../network';
import {
  arrived, back, companies, complete, extend, here, path as pathOf,
  remaining, spent, startDraft, usedAfter
} from '../route';
import type { GoldenGame, GoldenState, GoldenRejection, StateAssertion } from './types';

const scripted = (faces: readonly number[]) => {
  const queue = [...faces];
  return () => {
    const face = queue.shift();
    if (face === undefined) throw new Error('the golden game ran out of dice');
    return (face - 1) / 6;
  };
};

function build(game: GoldenGame): GoldenState {
  const used = new Map<string, number>();
  for (const [a, b] of game.setup.used ?? []) {
    const key = sectionKey(a, b);
    used.set(key, (used.get(key) ?? 0) + 1);
  }
  return {
    at: game.setup.at,
    destination: game.setup.destination,
    train: game.setup.train ?? 'freight',
    used, roll: null, leg: 0, draft: null, legs: []
  };
}

/** Applies one intent, or names why it could not be applied. */
function apply(state: GoldenState, step: GoldenGame['steps'][number]): GoldenState | GoldenRejection {
  const intent = step.intent;
  switch (intent.kind) {
    case 'roll': {
      if (state.roll !== null) return 'no-roll';
      const roll = rollTurn(state.train, scripted(intent.faces));
      const left = state.leg === 0 ? movement(roll) : (roll.bonus ?? 0);
      return {
        ...state, roll,
        draft: startDraft(state.at, state.destination, left, state.used)
      };
    }
    case 'step': {
      if (state.draft === null) return 'no-roll';
      const next = extend(state.draft, intent.to);
      if (isRejection(next)) return next;
      return { ...state, draft: next };
    }
    case 'back': {
      if (state.draft === null || state.draft.steps.length === 0) return 'nothing-to-undo';
      return { ...state, draft: back(state.draft) };
    }
    case 'commit': {
      if (state.draft === null) return 'no-roll';
      if (!complete(state.draft)) return 'route-incomplete';
      const draft = state.draft;
      const landed = arrived(draft);
      // `state.leg === 0` is "a player can get no more than one Bonus Roll per
      // turn": a bonus leg that arrives inside the white dice would otherwise
      // earn a bonus leg of its own, for ever. `replay` states the same cap as
      // `open.legs >= 2`.
      //
      // The two are pinned separately, not against each other:
      // `src/state/replay.golden.test.ts` scripts every leg as [1,1], which
      // earns a Freight nothing, so `replay`'s bonus branch never runs there
      // and it could not hold the caps together even in principle. This side
      // is pinned by the `bonus-leg` golden game below; replay's side by the
      // bonus-leg pair in `src/state/game.test.ts` ("keeps the turn when a
      // bonus leg is still owed", "ends the turn after the bonus leg").
      const owed = state.leg === 0
        && state.roll !== null && bonusLegOwed(state.roll, spent(draft), landed);
      return {
        ...state,
        at: here(draft),
        // "Everything is released on arrival" — the whole trip, not the leg.
        used: landed ? new Map() : usedAfter(draft),
        roll: owed ? state.roll : null,
        leg: owed ? state.leg + 1 : 0,
        draft: null,
        legs: [...state.legs, { path: pathOf(draft), arrived: landed }]
      };
    }
    case 'destination': {
      return {
        ...state,
        destination: intent.to,
        draft: state.roll === null
          ? null
          : startDraft(state.at, intent.to,
                       state.leg === 0 ? movement(state.roll) : (state.roll.bonus ?? 0),
                       state.used)
      };
    }
  }
}

function assertState(state: GoldenState, want: StateAssertion, where: string): void {
  const at = (what: string) => `${where} — ${what}`;
  if (want.at !== undefined) expect(state.at, at('at')).toBe(want.at);
  if (want.usedCount !== undefined) expect(state.used.size, at('used sections')).toBe(want.usedCount);
  if (want.bonus !== undefined) expect(state.roll?.bonus ?? null, at('bonus die')).toBe(want.bonus);
  if (want.legOwed !== undefined) expect(state.leg > 0, at('bonus leg owed')).toBe(want.legOwed);
  if (state.draft !== null) {
    if (want.spent !== undefined) expect(spent(state.draft), at('spent')).toBe(want.spent);
    if (want.remaining !== undefined) expect(remaining(state.draft), at('remaining')).toBe(want.remaining);
    if (want.arrived !== undefined) expect(arrived(state.draft), at('arrived')).toBe(want.arrived);
    if (want.complete !== undefined) expect(complete(state.draft), at('complete')).toBe(want.complete);
    if (want.companies !== undefined) {
      expect([...companies(state.draft)].sort(), at('companies'))
        .toEqual([...want.companies].sort());
    }
  } else {
    for (const field of ['spent', 'remaining', 'arrived', 'complete', 'companies'] as const) {
      expect(want[field], at(`${field} asserted with no draft`)).toBeUndefined();
    }
  }
}

export function runGoldenGame(game: GoldenGame): GoldenState {
  let state = build(game);

  game.steps.forEach((step, index) => {
    const where = `${game.id} step ${index + 1} (${step.name})`;
    const before = JSON.stringify(state, (_, value) =>
      value instanceof Map ? [...value] : value);
    const result = apply(state, step);

    if (step.expectError !== undefined) {
      expect(result, `${where} — expected rejection ${step.expectError}`).toBe(step.expectError);
      const after = JSON.stringify(state, (_, value) =>
        value instanceof Map ? [...value] : value);
      expect(after, `${where} — a rejected intent must change nothing`).toBe(before);
    } else {
      expect(typeof result, `${where} — unexpected rejection: ${String(result)}`)
        .not.toBe('string');
      state = result as GoldenState;
    }

    if (step.then) assertState(state, step.then, where);
  });

  if (game.final) assertState(state, game.final, `${game.id} final`);
  return state;
}
