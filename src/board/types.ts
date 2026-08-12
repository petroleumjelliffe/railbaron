import type { SeatId } from '../state/events';

/**
 * Every screen the board can show, plus `map` — which the board cannot show.
 * The map is a lit cabinet, not seven rows of flaps, so it renders instead of
 * the Board rather than through it. It is named here anyway because a row has
 * to be able to navigate to it, and a second navigation vocabulary for one
 * destination would cost more than this note does.
 */
export type ScreenId =
  | 'home' | 'passAndPlay' | 'saved' | 'confirm' | 'play' | 'regionBallot' | 'map';

/** What an editable row is editing. Seat names today. */
export type FieldId = `seat:${SeatId}`;

export type RowAction =
  | { kind: 'navigate'; to: ScreenId }
  | { kind: 'edit'; field: FieldId; placeholder: string }
  | { kind: 'act'; seat: SeatId }
  | null;

/**
 * One of seven. The action is a union rather than independent `go`, `edit`
 * and `disabled` fields, because those can contradict one another — a row
 * carrying both a destination and an edit target, or disabled alongside a
 * live action — and this cannot.
 */
export interface Row {
  label: string;
  status: string;
  text: string;
  amount: string;
  showDollar: boolean;
  right: string;
  chip: string | null;
  tone: 'normal' | 'dim' | 'disabled';
  action: RowAction;
}

export interface ScreenDef {
  title: string;
  sub: string;
  back: ScreenId | null;
  cols: [string, string, string, string, string];
  rows: Row[];
}

/** The board is this many rows on every screen, without exception. */
export const BOARD_ROWS = 7;

export function blankRow(): Row {
  return {
    label: '', status: '', text: '', amount: '', showDollar: false,
    right: '', chip: null, tone: 'dim', action: null
  };
}

/**
 * Truncating as well as padding. A screen that defines more than seven rows
 * is a design bug, and dropping the overflow here makes it show up as a
 * missing row rather than a board that silently changes height.
 */
export function padRows(rows: readonly Row[]): Row[] {
  const out = rows.slice(0, BOARD_ROWS);
  while (out.length < BOARD_ROWS) out.push(blankRow());
  return out;
}
