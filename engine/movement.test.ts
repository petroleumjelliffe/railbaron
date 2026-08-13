import { describe, expect, it } from 'vitest';
import { neighbours, nodeForCity, sectionKey } from './network';
import { canReach, pathCost, sectionsLeft, stepCost, useSection } from './movement';

const MINNEAPOLIS = nodeForCity(43);
const ST_PAUL = nodeForCity(47);
const SAN_FRANCISCO = nodeForCity(65);
const OAKLAND = nodeForCity(60);
const DALLAS = nodeForCity(29);
const FORT_WORTH = nodeForCity(30);

describe('what a step costs', () => {
  it('charges one dot for a route dot', () => {
    expect(stepCost('c13', 'd66')).toBe(1);
  });

  it('charges one dot for a city, because cities count as dots', () => {
    expect(stepCost(DALLAS, FORT_WORTH)).toBe(1);
  });

  it('charges nothing for a junction, because a junction is not a dot', () => {
    const junction = 'j0';
    expect(stepCost('d4', junction)).toBe(0);
  });

  it('charges nothing to cross between twin cities', () => {
    expect(stepCost(MINNEAPOLIS, ST_PAUL)).toBe(0);
    expect(stepCost(ST_PAUL, MINNEAPOLIS)).toBe(0);
    expect(stepCost(SAN_FRANCISCO, OAKLAND)).toBe(0);
    expect(stepCost(OAKLAND, SAN_FRANCISCO)).toBe(0);
  });

  it('sums a whole path', () => {
    expect(pathCost([MINNEAPOLIS, ST_PAUL])).toBe(0);
    expect(pathCost(['c13', 'd66'])).toBe(1);
    expect(pathCost([])).toBe(0);
  });
});

describe('how much of a section is left', () => {
  it('counts one crossing per railroad on the section', () => {
    const edge = neighbours(MINNEAPOLIS).find(e => e.a === ST_PAUL || e.b === ST_PAUL)!;
    expect(edge.railroads.length).toBe(4);
    expect(sectionsLeft(edge, new Map())).toBe(4);
    expect(sectionsLeft(edge, new Map([[sectionKey(MINNEAPOLIS, ST_PAUL), 4]]))).toBe(0);
  });

  it('records a crossing without disturbing the map it was given', () => {
    const before = new Map<string, number>();
    const after = useSection(before, 'c13', 'd66');
    expect(before.size).toBe(0);
    expect(after.get(sectionKey('c13', 'd66'))).toBe(1);
    expect(useSection(after, 'd66', 'c13').get(sectionKey('c13', 'd66'))).toBe(2);
  });
});

describe('whether the destination can still be reached', () => {
  it('says yes when nothing has been used', () => {
    expect(canReach(MINNEAPOLIS, DALLAS, new Map())).toBe(true);
  });

  it('says yes when already standing on it', () => {
    expect(canReach(DALLAS, DALLAS, new Map())).toBe(true);
  });

  it('says no once the only way out has been spent', () => {
    // St. Paul is a spur: its single section is the only way in or out, and
    // it carries four railroads, so four crossings exhaust it.
    const used = new Map([[sectionKey(MINNEAPOLIS, ST_PAUL), 4]]);
    expect(canReach(ST_PAUL, DALLAS, used)).toBe(false);
  });

  it('still says yes with the spur partly spent', () => {
    const used = new Map([[sectionKey(MINNEAPOLIS, ST_PAUL), 3]]);
    expect(canReach(ST_PAUL, DALLAS, used)).toBe(true);
  });
});
