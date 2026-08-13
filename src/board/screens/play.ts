import { cityById, nodeForCity, regionById, REGIONS, type RegionId } from '../../../engine';
import { SEATS, type SeatId } from '../../state/events';
import type { GameState } from '../../state/game';
import { needsDestination } from '../../state/turns';
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
        // Every baron's row carries the printed sign, whatever this roll
        // paid — a home town does not rub it off the board.
        showDollar: true,
        right: latest !== undefined && latest.payout === null ? 'Home' : '',
        chip: SEAT_COLORS[seat.id],
        // Only the baron whose turn it is can act, and only to start a trip:
        // the dice are rolled from the board's own readout and the pawn is
        // walked on the map, so a row with a destination has nothing to offer.
        tone: state.turn === null || state.turn === seat.id ? 'normal' : 'dim',
        action: state.turn === seat.id && needsDestination(seat, nodeForCity)
          ? { kind: 'act', seat: seat.id }
          : (state.turn === null ? { kind: 'act', seat: seat.id } : null)
      };
    });

  // Its own row: a row carries one action, so undo cannot ride on the map
  // row. The board is seven rows, always — with six barons seated there is
  // no spare and this is left off rather than the board growing.
  if (state.phase === 'playing' && rows.length < BOARD_ROWS - 1) {
    rows.push({ ...blankRow(), label: 'Undo', text: 'Take back a turn',
                tone: 'dim', action: { kind: 'undo' } });
  }

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
    rows: withMap,
    // Every region a roll could name, not the few already on the board. The
    // first roll of a game is the case that needs it: nothing is showing yet,
    // so a panel built from the rows would have the answer and a blank to
    // turn between.
    panel: REGIONS.map(region => region.name)
  };
}
