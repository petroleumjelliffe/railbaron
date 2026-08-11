import { CITIES, REGIONS, cityById, type CityId, type RegionId } from '../../engine';

export type SeatId = 'red' | 'green' | 'blue' | 'yellow' | 'black' | 'white';

export const SEATS: readonly SeatId[] = ['red', 'green', 'blue', 'yellow', 'black', 'white'];

/**
 * Events record what happened, not what was rolled. Replaying the log gives
 * the same game back without re-rolling any dice, which is what lets undo be
 * truncation and what a server-authoritative version would need.
 *
 * `payout: null` means "no payout applies" — a home town. A journey worth
 * nothing is the number 0, and the two are not interchangeable.
 */
export type GameEvent =
  | { type: 'joined'; seat: SeatId; name: string }
  | { type: 'regionRequested'; seat: SeatId; rolled: RegionId }
  | { type: 'arrived'; seat: SeatId; city: CityId; region: RegionId; payout: number | null };

// Derived from the engine rather than copied as literals, so a table change
// can't silently drift away from what a loaded log is allowed to contain.
const VALID_SEATS: ReadonlySet<string> = new Set(SEATS);
const VALID_REGIONS: ReadonlySet<RegionId> = new Set(REGIONS.map(region => region.id));
const VALID_CITIES: ReadonlySet<CityId> = new Set(CITIES.map(city => city.id));

/**
 * A structurally-valid-but-wrong log (an unknown `type`, a city id that was
 * never real) would otherwise survive `JSON.parse` and throw deep inside
 * `cityById` on every replay — bricking the app with no recovery but clearing
 * site data by hand. This is the gate that keeps that out of `loadLog`.
 */
export function isGameEvent(value: unknown): value is GameEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;

  switch (event.type) {
    case 'joined':
      return VALID_SEATS.has(event.seat as string) && typeof event.name === 'string';
    case 'regionRequested':
      return VALID_SEATS.has(event.seat as string) && VALID_REGIONS.has(event.rolled as RegionId);
    case 'arrived':
      // payout: 0 is a real, legal journey (Minneapolis<->St. Paul,
      // San Francisco<->Oakland) — `typeof === 'number'` here, never a
      // truthiness check, or every $0 save silently loses that stop.
      //
      // VALID_CITIES.has(...) must short-circuit before cityById(...) runs:
      // cityById throws on an id it doesn't recognise, and && evaluates
      // left to right, so a bad id is rejected here rather than reaching
      // the call that would throw on it.
      return (
        VALID_SEATS.has(event.seat as string) &&
        VALID_CITIES.has(event.city as CityId) &&
        VALID_REGIONS.has(event.region as RegionId) &&
        cityById(event.city as CityId).region === event.region &&
        (event.payout === null ||
          (typeof event.payout === 'number' && Number.isFinite(event.payout)))
      );
    default:
      return false;
  }
}
