import { cityById, regionById, type RegionId } from '../../../engine';
import { SEATS, type SeatId } from '../../state/events';
import type { GameState } from '../../state/game';
import { SEAT_COLORS } from '../../game/tokens';
import { blankRow, BOARD_ROWS, padRows, type Row, type ScreenDef } from '../types';

/**
 * `pending` is a roll whose region has been named but which has not yet
 * reached the log. Its row shows that region and nothing else new — the
 * destination and payout still show where the baron was, because where they
 * are going is not known to the board until the panel has landed.
 */
export function play(
  state: GameState,
  turns: Partial<Record<SeatId, number>> = {},
  pending: { seat: SeatId; region: RegionId } | null = null
): ScreenDef {
  const rows: Row[] = SEATS
    .map(id => state.seats[id])
    .filter(seat => seat.name !== null)
    .map(seat => {
      const latest = seat.stops[seat.stops.length - 1];
      const rolling = pending !== null && pending.seat === seat.id;
      // A payout of 0 is a real, legal journey — the board's twin-city
      // pairs pay it. Only null means "no payout applies", i.e. a home town.
      const paid = latest !== undefined && latest.payout !== null;
      return {
        // Carried on every row, not only the one rolling, so that committing
        // the roll does not itself look like a fresh announcement.
        turn: turns[seat.id] ?? 0,
        label: seat.name!,
        status: rolling
          ? regionById(pending!.region).name
          : (latest ? regionById(latest.region).name : ''),
        text: latest ? cityById(latest.city).name : '',
        amount: paid ? latest.payout!.toLocaleString('en-US') : '',
        showDollar: paid,
        right: latest !== undefined && latest.payout === null ? 'Home' : '',
        chip: SEAT_COLORS[seat.id],
        tone: 'normal',
        action: { kind: 'act', seat: seat.id }
      };
    });

  // Seven rows, six barons: the last is always free, and the map takes it.
  // Padding to the row above first pins it to the bottom of the board, so it
  // does not slide up the screen as barons join — a row that moves under the
  // finger between turns is one that gets tapped by mistake.
  const withMap = padRows(rows).slice(0, BOARD_ROWS - 1);
  withMap.push({
    ...blankRow(),
    label: 'Map',
    // Fourteen tiles. "View the network" is sixteen and lost its last two.
    text: 'View the map',
    action: { kind: 'navigate', to: 'map' }
  });

  return {
    title: 'Departures',
    sub: 'IN PLAY',
    back: 'home',
    cols: ['Baron', 'Region', 'Destination', 'Payout', ''],
    rows: withMap
  };
}
