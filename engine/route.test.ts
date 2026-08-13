import { describe, expect, it } from 'vitest';
import { legalSteps } from './movement';
import { nodeById, nodeForCity, sectionKey } from './network';
import {
  arrived, back, companies, complete, extend, here, options,
  path, remaining, rideNow, spent, startDraft, tripOf, usedAfter, type Draft
} from './route';

const MINNEAPOLIS = nodeForCity(43);
const ST_PAUL = nodeForCity(47);
const DOT = 'd66';        // a dot next to Minneapolis — from Step 1
const FAR = 'd0';         // not next to Minneapolis — from Step 1
const JUNCTION = 'j0';    // from Step 1
const BESIDE = 'd4';      // the node the junction edge joins — from Step 1

// A fork whose three edges do NOT all carry the same companies — needed to
// demonstrate "he can change rail lines only at a dot", not merely exercise
// the code path. j2's edges are d252 (GN only), d170 (NP only), d176 (NP
// only); j0 above (all three edges the same company set, or none named)
// cannot demonstrate the rule because arriving via any of its edges leaves
// every onward edge still ridable. Found by the same node-id discovery
// approach as Step 1 (see task-5-report.md, fix round 1).
const FORK = 'j2';
const BEFORE_FORK = 'd250';       // neighbour of ARRIVE_DOT, off the fork
const ARRIVE_DOT = 'd252';        // the dot on FORK's GN-only edge
const PAST_FORK = 'd183';         // a destination beyond the fork, forcing a real trip
const NP_ONLY_A = 'd170';         // FORK's NP-only neighbour
const NP_ONLY_B = 'd176';         // FORK's other NP-only neighbour

/** Extends a draft, failing loudly rather than silently, so a test reads. */
const walk = (draft: Draft, ...nodes: string[]): Draft =>
  nodes.reduce((current, to) => {
    const next = extend(current, to);
    if (typeof next === 'string') throw new Error(`step to ${to} refused: ${next}`);
    return next;
  }, draft);

describe('a fresh draft', () => {
  const draft = startDraft(MINNEAPOLIS, ST_PAUL, 7);

  it('stands where it started and has spent nothing', () => {
    expect(here(draft)).toBe(MINNEAPOLIS);
    expect(spent(draft)).toBe(0);
    expect(remaining(draft)).toBe(7);
    expect(path(draft)).toEqual([MINNEAPOLIS]);
  });

  it('has not arrived, and offers the steps the engine allows', () => {
    expect(arrived(draft)).toBe(false);
    expect(options(draft).map(step => step.to)).toContain(ST_PAUL);
  });

  it('is not committable — nothing spent and nowhere reached', () => {
    expect(complete(draft)).toBe(false);
  });
});

describe('extending a draft', () => {
  it('moves the head and charges the step', () => {
    const draft = walk(startDraft(MINNEAPOLIS, DOT, 7), DOT);
    expect(here(draft)).toBe(DOT);
    expect(spent(draft)).toBe(1);
    expect(path(draft)).toEqual([MINNEAPOLIS, DOT]);
  });

  it('charges nothing to cross into the twin city', () => {
    const draft = walk(startDraft(MINNEAPOLIS, ST_PAUL, 7), ST_PAUL);
    expect(spent(draft)).toBe(0);
    expect(arrived(draft)).toBe(true);
  });

  it('hands back the reason rather than a draft when the step is refused', () => {
    expect(extend(startDraft(MINNEAPOLIS, ST_PAUL, 7), FAR)).toBe('not-a-neighbour');
  });

  it('records the sections it has crossed', () => {
    const draft = walk(startDraft(MINNEAPOLIS, ST_PAUL, 7), ST_PAUL);
    expect(usedAfter(draft).get(sectionKey(MINNEAPOLIS, ST_PAUL))).toBe(1);
  });

  it('carries sections used earlier in the trip forward', () => {
    const before = new Map([[sectionKey(MINNEAPOLIS, ST_PAUL), 2]]);
    const draft = walk(startDraft(MINNEAPOLIS, ST_PAUL, 7, before), ST_PAUL);
    expect(usedAfter(draft).get(sectionKey(MINNEAPOLIS, ST_PAUL))).toBe(3);
  });

  it('refuses every step once the destination is underfoot', () => {
    const draft = walk(startDraft(MINNEAPOLIS, ST_PAUL, 7), ST_PAUL);
    expect(options(draft)).toEqual([]);
    expect(extend(draft, MINNEAPOLIS)).toBe('already-arrived');
  });
});

describe('undoing', () => {
  it('takes back the last step and everything it charged', () => {
    const draft = walk(startDraft(MINNEAPOLIS, DOT, 7), DOT);
    const undone = back(draft);
    expect(here(undone)).toBe(MINNEAPOLIS);
    expect(spent(undone)).toBe(0);
    expect(usedAfter(undone).size).toBe(0);
  });

  it('is harmless with nothing to take back', () => {
    const draft = startDraft(MINNEAPOLIS, ST_PAUL, 7);
    expect(back(draft)).toEqual(draft);
  });
});

describe('whether a draft may be committed', () => {
  it('may be, once it ends on the destination', () => {
    expect(complete(walk(startDraft(MINNEAPOLIS, ST_PAUL, 7), ST_PAUL))).toBe(true);
  });

  it('may be, once the whole roll is spent', () => {
    const draft = walk(startDraft(MINNEAPOLIS, FAR, 1), DOT);
    expect(spent(draft)).toBe(1);
    expect(arrived(draft)).toBe(false);
    expect(complete(draft)).toBe(true);
  });

  it('may not be with movement left and the destination unreached', () => {
    expect(complete(walk(startDraft(MINNEAPOLIS, FAR, 4), DOT))).toBe(false);
  });

  it('may not be with the pawn on a junction, which is not a dot', () => {
    expect(nodeById(JUNCTION).kind).toBe('junction');
    const draft = walk(startDraft(BESIDE, FAR, 0), JUNCTION);
    expect(spent(draft)).toBe(0);
    expect(complete(draft)).toBe(false);
  });
});

describe('which companies the route used', () => {
  it('is every company any of its steps could have ridden', () => {
    const draft = walk(startDraft(MINNEAPOLIS, ST_PAUL, 7), ST_PAUL);
    expect(companies(draft)).toEqual(
      expect.arrayContaining(['C&NW', 'CMStP&P', 'NP', 'GN'])
    );
  });

  it('is empty before a step has been taken', () => {
    expect(companies(startDraft(MINNEAPOLIS, ST_PAUL, 7))).toEqual([]);
  });
});

describe('rideNow', () => {
  it('is null before any step has been taken', () => {
    expect(rideNow(startDraft(MINNEAPOLIS, ST_PAUL, 7))).toBeNull();
  });

  it('is null once the pawn is standing on a dot', () => {
    const draft = walk(startDraft(MINNEAPOLIS, DOT, 7), DOT);
    expect(rideNow(draft)).toBeNull();
  });

  it('is null once the pawn is standing on a city', () => {
    const draft = walk(startDraft(MINNEAPOLIS, ST_PAUL, 7), ST_PAUL);
    expect(rideNow(draft)).toBeNull();
  });

  it("carries the last step's companies forward once the pawn is standing on a junction", () => {
    const draft = walk(startDraft(BEFORE_FORK, PAST_FORK, 5), ARRIVE_DOT, FORK);
    expect(nodeById(FORK).kind).toBe('junction');
    expect(rideNow(draft)).toEqual(['GN']);
  });
});

describe('the company constraint at a junction', () => {
  it('restricts onward options to the companies the run arrived on, not every company on the fork', () => {
    const draft = walk(startDraft(BEFORE_FORK, PAST_FORK, 5), ARRIVE_DOT, FORK);

    // What the fork would offer with no company restriction at all (as if
    // standing on a dot) — both NP-only spurs are legal from here.
    const unrestricted = legalSteps({ ...tripOf(draft), ride: null });
    expect(unrestricted.map(step => step.to)).toEqual(
      expect.arrayContaining([NP_ONLY_A, NP_ONLY_B])
    );

    // What the draft actually offers, restricted to the GN the run arrived
    // on: neither NP-only spur qualifies, so nothing does.
    expect(options(draft)).toEqual([]);
  });
});

describe('legalSteps through options(), with nothing left', () => {
  // "may not be with the pawn on a junction" above walks BESIDE -> JUNCTION
  // via extend(), which calls stepTo() directly and never legalSteps — so it
  // pins stepTo's no-early-return-on-remaining-0 behaviour, not legalSteps's.
  // This test calls options() (-> legalSteps) instead, at remaining: 0, and
  // is the one that actually closes the Task 3 gap: "no test anywhere calls
  // legalSteps with remaining: 0".
  it('still offers a free step onto a junction even with the roll fully spent', () => {
    const draft = startDraft(BESIDE, FAR, 0);
    expect(options(draft).map(step => step.to)).toContain(JUNCTION);
  });
});

describe('tripOf', () => {
  it('reports from, remaining, used and ride consistent with the draft head', () => {
    const draft = walk(startDraft(BEFORE_FORK, PAST_FORK, 5), ARRIVE_DOT, FORK);
    const trip = tripOf(draft);
    expect(trip.from).toBe(here(draft));
    expect(trip.remaining).toBe(remaining(draft));
    expect(trip.used).toEqual(usedAfter(draft));
    expect(trip.ride).toEqual(rideNow(draft));
  });
});
