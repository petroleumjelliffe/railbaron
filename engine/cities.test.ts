import { describe, expect, it } from 'vitest';
import { CITIES, cityById, citiesIn } from './cities';
import { REGIONS } from './regions';

describe('the city table', () => {
  it('holds 67 cities with contiguous ids from 0', () => {
    expect(CITIES).toHaveLength(67);
    expect(CITIES.map(c => c.id)).toEqual([...Array(67).keys()]);
  });

  it('groups them into the regions the board uses', () => {
    const counts = Object.fromEntries(
      REGIONS.map(r => [r.id, citiesIn(r.id).length])
    );
    expect(counts).toEqual({ NE: 9, SE: 11, NC: 8, SC: 11, PL: 9, NW: 9, SW: 10 });
  });

  it('keeps ids in region order, which the roll table depends on', () => {
    // Column c of the roll table indexes into citiesIn(region c) by position,
    // so a region's cities must be a contiguous, ascending run of ids.
    for (const region of REGIONS) {
      const ids = citiesIn(region.id).map(c => c.id);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
      expect(ids[ids.length - 1]! - ids[0]!).toBe(ids.length - 1);
    }
  });

  it('places the cities the old app mislabelled into their real regions', () => {
    // js/railbaronv2.js labels groups 4, 5 and 6 all "South Central".
    expect(cityById(43).name).toBe('Minneapolis');
    expect(cityById(43).region).toBe('PL');
    expect(cityById(55).name).toBe('Seattle');
    expect(cityById(55).region).toBe('NW');
    expect(cityById(59).name).toBe('Los Angeles');
    expect(cityById(59).region).toBe('SW');
  });

  it('has no duplicate names', () => {
    expect(new Set(CITIES.map(c => c.name)).size).toBe(67);
  });
});
