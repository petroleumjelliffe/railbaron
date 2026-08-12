import type { CityId, RegionId } from '../../engine';
import { SEATS, type GameEvent, type SeatId } from './events';

export interface Stop {
  city: CityId;
  region: RegionId;
  /** null for a home town. 0 is a real, zero-paying journey. */
  payout: number | null;
}

export interface Seat {
  id: SeatId;
  name: string | null;
  stops: readonly Stop[];
  awaiting: RegionId | null;
  /** Derived at replay, never stored: payouts summed, home towns counting nothing. */
  earned: number;
}

export interface GameState {
  seats: Record<SeatId, Seat>;
  /** Derived from the log, not stored: 'playing' once a `started` event exists. */
  phase: 'setup' | 'playing';
}

function emptyState(): GameState {
  const seats = {} as Record<SeatId, Seat>;
  for (const id of SEATS) seats[id] = { id, name: null, stops: [], awaiting: null, earned: 0 };
  return { seats, phase: 'setup' };
}

export function replay(events: readonly GameEvent[]): GameState {
  const state = emptyState();
  for (const event of events) {
    // `started` is the one event with no seat, so it is handled before
    // anything narrows on event.seat.
    if (event.type === 'started') {
      state.phase = 'playing';
      continue;
    }
    const seat = state.seats[event.seat];
    switch (event.type) {
      case 'joined':
        state.seats[event.seat] = { ...seat, name: event.name };
        break;
      case 'renamed':
        state.seats[event.seat] = { ...seat, name: event.name };
        break;
      case 'regionRequested':
        state.seats[event.seat] = { ...seat, awaiting: event.rolled };
        break;
      case 'arrived':
        state.seats[event.seat] = {
          ...seat,
          awaiting: null,
          earned: seat.earned + (event.payout ?? 0),
          stops: [...seat.stops,
                  { city: event.city, region: event.region, payout: event.payout }]
        };
        break;
    }
  }
  return state;
}

/**
 * Undo is a play-phase affordance, matching Acquire. Setup has none: a
 * taken row is tapped to rename, which corrects it directly. So two
 * guards — refuse before the game has started, and refuse to rewind back
 * across the moment it did.
 */
export function undo(events: readonly GameEvent[]): GameEvent[] {
  const startedAt = events.findIndex(event => event.type === 'started');
  if (startedAt < 0) return [...events];
  if (events.length <= startedAt + 1) return [...events];
  return events.slice(0, -1);
}

export const currentCity = (seat: Seat): CityId | null =>
  seat.stops.length ? seat.stops[seat.stops.length - 1]!.city : null;
