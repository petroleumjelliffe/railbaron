import type { CityId, RegionId } from '../../engine';

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
