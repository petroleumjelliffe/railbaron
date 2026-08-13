import { cityById, regionById, REGIONS, type RegionId } from '../../../engine';
import { SEATS, type SeatId } from '../../state/events';
import type { GameState } from '../../state/game';
import { homesDone, nextHomeSeat } from '../../state/turns';
import { SEAT_COLORS } from '../../game/tokens';
import { blankRow, BOARD_ROWS, padRows, type Row, type ScreenDef } from '../types';

/**
 * Home cities, then the roll for who goes first.
 *
 * The rulebook has an order to setup and strict turns make it matter: every
 * baron takes a home city, in seat order and no two the same, and only then do
 * the players roll to see who starts. Both are rolls, so both go through the
 * board's existing gate — the value is not in the log until the panel lands.
 */
export function homes(
  state: GameState,
  pending: { seat: SeatId; region: RegionId } | null = null
): ScreenDef {
  const owed = nextHomeSeat(state);
  const ready = homesDone(state);

  const rows: Row[] = SEATS
    .map(id => state.seats[id])
    .filter(seat => seat.name !== null)
    .map((seat, index) => {
      const home = seat.stops[0];
      const rolling = pending !== null && pending.seat === seat.id;
      return {
        // Stamped so the flap is started by the announcement rather than by
        // the text changing — the same reason the in-play screen carries it.
        turn: index,
        label: seat.name!,
        status: rolling
          ? regionById(pending!.region).name
          : (home ? regionById(home.region).name : ''),
        text: rolling ? '' : (home ? cityById(home.city).name : ''),
        // A home town pays nothing, and that is `payout: null` rather than a
        // zero — so there is no figure to print, and HOME stands in its place.
        amount: '',
        showDollar: true,
        right: home ? 'Home' : '',
        chip: SEAT_COLORS[seat.id],
        tone: home ? 'normal' : (seat.id === owed ? 'normal' : 'dim'),
        action: seat.id === owed && pending === null ? { kind: 'act', seat: seat.id } : null
      };
    });

  const withOrder = padRows(rows).slice(0, BOARD_ROWS - 1);
  withOrder.push(ready
    ? { ...blankRow(), label: 'Start', text: 'Roll for first', tone: 'normal',
        action: { kind: 'order' } }
    : { ...blankRow(), label: 'Start', text: 'Homes first', tone: 'dim' });

  return {
    title: 'Departures',
    sub: ready ? 'ROLL FOR FIRST' : 'HOME CITIES',
    back: 'home',
    cols: ['Baron', 'Region', 'Home city', '', ''],
    rows: withOrder,
    panel: REGIONS.map(region => region.name)
  };
}
