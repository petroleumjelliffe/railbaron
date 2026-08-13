import {
  bonusLegOwed, nodeForCity, pathCost,
  type CityId, type NodeId, type RegionId, type TurnRoll
} from '../../engine';
import { SEATS, type GameEvent, type SeatId } from './events';
import { addSections, rotate } from './turns';

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
  /**
   * Where this baron's pawn stands, as a node — not a city. A baron between
   * two cities is the normal case, and the companion could get away with
   * "which city are you heading for" only because it never moved anything.
   */
  at: NodeId | null;
  /** Sections spent so far this trip, released on arrival. */
  used: ReadonlyMap<string, number>;
}

export interface GameState {
  seats: Record<SeatId, Seat>;
  /**
   * `setup` until the game starts, `homes` while home cities and the first
   * player are being rolled, `playing` once `orderRolled` exists. A game saved
   * before turn order existed has no `orderRolled`, so it resumes in `homes`
   * with every home already in — which is exactly the state it should be in.
   */
  phase: 'setup' | 'homes' | 'playing';
  /** Seated barons, rotated to start with whoever won the roll. */
  order: readonly SeatId[];
  /** Whose turn it is, or null before play begins. */
  turn: SeatId | null;
  /** The dice of the turn under way, or null when the current baron owes a roll. */
  rolled: TurnRoll | null;
  /**
   * Legs of the current turn already walked: 0 normally, 1 while a Bonus Roll
   * leg is owed. It decides how much movement the leg has — the whole roll,
   * or just the bonus die.
   */
  leg: number;
}

function emptyState(): GameState {
  const seats = {} as Record<SeatId, Seat>;
  for (const id of SEATS) {
    seats[id] = {
      id, name: null, stops: [], awaiting: null, earned: 0, at: null, used: new Map()
    };
  }
  return { seats, phase: 'setup', order: [], turn: null, rolled: null, leg: 0 };
}

export function replay(events: readonly GameEvent[]): GameState {
  const state = emptyState();
  let first: SeatId | null = null;
  /** Turns finished. The next one belongs to order[taken % order.length]. */
  let taken = 0;
  /** The turn under way, if any. */
  let open: { seat: SeatId; roll: TurnRoll; legs: number } | null = null;

  for (const event of events) {
    if (event.type === 'started') {
      state.phase = 'homes';
      continue;
    }
    const seat = state.seats[event.seat];
    switch (event.type) {
      case 'joined':
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
                  { city: event.city, region: event.region, payout: event.payout }],
          // The first destination a baron is given is their home town, and it
          // is where their pawn starts. Later ones are somewhere to walk to.
          at: seat.at ?? nodeForCity(event.city)
        };
        break;
      case 'orderRolled':
        first = event.first;
        state.phase = 'playing';
        break;
      case 'turnRolled':
        open = {
          seat: event.seat,
          roll: { white: event.white, bonus: event.bonus },
          legs: 0
        };
        break;
      case 'moved':
        state.seats[event.seat] = {
          ...seat,
          at: event.path[event.path.length - 1]!,
          // "Everything is released on arrival" — the whole trip's sections,
          // not just this leg's.
          used: event.arrived ? new Map() : addSections(seat.used, event.path)
        };
        if (open !== null) {
          open.legs += 1;
          const over = open.legs >= 2
            || !bonusLegOwed(open.roll, pathCost(event.path), event.arrived);
          if (over) { taken += 1; open = null; }
        }
        break;
    }
  }

  const seated = SEATS.filter(id => state.seats[id].name !== null);
  state.order = first === null ? [] : rotate(seated, first);
  state.turn = state.order.length === 0
    ? null
    : state.order[taken % state.order.length]!;
  state.rolled = open?.roll ?? null;
  state.leg = open?.legs ?? 0;
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
