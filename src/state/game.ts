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
}

export interface GameState {
  seats: Record<SeatId, Seat>;
}

function emptyState(): GameState {
  const seats = {} as Record<SeatId, Seat>;
  for (const id of SEATS) seats[id] = { id, name: null, stops: [], awaiting: null };
  return { seats };
}

export function replay(events: readonly GameEvent[]): GameState {
  const state = emptyState();
  for (const event of events) {
    const seat = state.seats[event.seat];
    switch (event.type) {
      case 'joined':
        state.seats[event.seat] = { ...seat, name: event.name };
        break;
      case 'regionRequested':
        state.seats[event.seat] = { ...seat, awaiting: event.rolled };
        break;
      case 'arrived':
        state.seats[event.seat] = {
          ...seat,
          awaiting: null,
          stops: [...seat.stops,
                  { city: event.city, region: event.region, payout: event.payout }]
        };
        break;
    }
  }
  return state;
}

export function undo(events: readonly GameEvent[]): GameEvent[] {
  return events.slice(0, -1);
}

export const currentCity = (seat: Seat): CityId | null =>
  seat.stops.length ? seat.stops[seat.stops.length - 1]!.city : null;
