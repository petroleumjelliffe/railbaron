import { describe, expect, it } from 'vitest';
import { nodeById, nodeForCity, sectionKey } from './network';
import {
  arrived, back, companies, complete, extend, here, options,
  path, remaining, spent, startDraft, usedAfter, type Draft
} from './route';

const MINNEAPOLIS = nodeForCity(43);
const ST_PAUL = nodeForCity(47);
const DOT = 'd66';        // a dot next to Minneapolis — from Step 1
const FAR = 'd0';         // not next to Minneapolis — from Step 1
const JUNCTION = 'j0';    // from Step 1
const BESIDE = 'd4';      // the node the junction edge joins — from Step 1

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
