import { describe, expect, it } from 'vitest';
import { PAYOUT_TABLE, payoutBetween } from './payouts';
import { CITIES } from './cities';

const idOf = (name: string) => {
  const city = CITIES.find(c => c.name === name);
  if (!city) throw new Error(`no city named ${name}`);
  return city.id;
};

describe('the payout table', () => {
  it('is triangular — row n holds n entries, so every pair is covered', () => {
    expect(PAYOUT_TABLE).toHaveLength(67);
    PAYOUT_TABLE.forEach((row, n) => expect(row).toHaveLength(n));
  });

  it('answers the same whichever way round the journey is asked', () => {
    for (const a of [0, 17, 33, 52, 66]) {
      for (const b of [4, 21, 40, 59, 66]) {
        if (a === b) continue;
        expect(payoutBetween(a, b)).toBe(payoutBetween(b, a));
      }
    }
  });

  it('pays nothing between the two twin pairs, and only those', () => {
    // These are the board's only zero-paying journeys. They are legal
    // destinations you can be sent to; the trip is simply worth nothing.
    const zeros: string[] = [];
    for (let hi = 1; hi < PAYOUT_TABLE.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        if (payoutBetween(hi, lo) === 0) {
          zeros.push([CITIES[lo]!.name, CITIES[hi]!.name].sort().join(' / '));
        }
      }
    }
    expect(zeros.sort()).toEqual([
      'Minneapolis / St. Paul',
      'Oakland / San Francisco'
    ]);
  });

  it('still charges for the pairs that only look like twins', () => {
    expect(payoutBetween(idOf('Dallas'), idOf('Fort Worth'))).toBe(500);
    expect(payoutBetween(idOf('New York'), idOf('Philadelphia'))).toBe(1000);
  });

  it('reports dollars, not thousands', () => {
    expect(payoutBetween(idOf('Albany'), idOf('Baltimore'))).toBe(3500);
  });

  it('refuses a journey from a city to itself', () => {
    expect(() => payoutBetween(12, 12)).toThrow(/same city/);
  });

  it('never returns a negative or fractional dollar amount', () => {
    for (let hi = 1; hi < PAYOUT_TABLE.length; hi++) {
      for (let lo = 0; lo < hi; lo++) {
        const paid = payoutBetween(hi, lo);
        expect(paid).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(paid)).toBe(true);
      }
    }
  });
});
