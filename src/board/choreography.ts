import { amountDrum, buildDrum, duration, panelDrum, type Tile } from './drum';

/** The three fields of a row that turn. Label and chip never do. */
export interface RowText {
  status: string;
  text: string;
  amount: string;
  /** See `Row.turn`: a roll being announced, rather than a value changing. */
  turn: number;
}

export interface RowDrums {
  status: Tile[];
  text: Tile[];
  amount: Tile[];
}

/**
 * Payout figures are short. The largest on the board is $35,000 — six
 * characters once the dollar sign is set aside as a label — so six tiles
 * cover every payout the table can produce.
 */
export const AMOUNT_WIDTH = 6;

/**
 * A panel with nothing to change to still turns a full lap, so that a baron
 * rolling the region they are already in sees the same flip as one who
 * rolled a new region. A panel that sat still would answer the question
 * before the city had finished asking it.
 */
const PANEL_LAP = 8;

/**
 * Ticks between one column landing and the next.
 *
 * Small because a hold is rounded up to whole laps, so asking a column to
 * wait a little longer can cost it a whole revolution — the payout's ring is
 * twelve faces, and a gap of four rather than two was pushing the worst roll
 * past three and a half seconds. Two ticks still reads as a beat between
 * columns; the rounding supplies the rest.
 */
const GAP = 1;

/**
 * The order the answer arrives in: region, then city, then payout.
 *
 * Each column is scheduled against the *measured* length of the one before
 * it rather than against a guessed delay, so the order holds whatever the
 * text is — including the cases that would otherwise break it. A city whose
 * name has not changed has nothing to travel and would land instantly; a
 * payout of two digits reaches its target faster than a thirteen-letter city
 * reaches its own. Both are made to wait.
 */
export function rowDrums(
  from: RowText,
  to: RowText,
  panelFaces: readonly string[]
): RowDrums | null {
  const announcing = from.turn !== to.turn;
  const changed = announcing
    || from.status !== to.status || from.text !== to.text || from.amount !== to.amount;
  if (!changed) return null;

  // A column turns because it is announcing something, or because what it
  // says has changed — never merely because it is not blank. That distinction
  // is the whole gate: the panel turns on the announcement, so a baron who
  // rolled the region they are already in sees exactly what everyone else
  // sees, and the board gives nothing away by sitting still. Meanwhile the
  // city and payout stay put during that announcement, because they have
  // nothing to say yet, and turn when the roll is finally told.
  const status = panelDrum(
    from.status, to.status, panelFaces,
    (announcing || from.status !== to.status) && to.status !== '' ? PANEL_LAP : 0
  );

  const statusFor = duration(status);
  const text = buildDrum({
    from: from.text,
    to: to.text,
    settleAt: from.text === to.text ? 0 : (statusFor === 0 ? 0 : statusFor + GAP)
  });

  // Deliberately the later of the two, not simply the city. A roll that lands
  // a baron on their own home town leaves the city unchanged, so the city
  // column has nothing to travel — and the payout, which is the field that
  // says HOME, would arrive before the region that explains it.
  const before = Math.max(statusFor, duration(text));
  const amount = amountDrum(
    from.amount, to.amount, AMOUNT_WIDTH,
    from.amount === to.amount ? 0 : (before === 0 ? 0 : before + GAP)
  );

  return { status, text, amount };
}

/**
 * What the status panel can flip through: a blank, then every value on the
 * board before and after the change.
 *
 * Derived rather than declared because the column means something different
 * on each screen — regions in play, ROLLED/CHOOSE on the ballot — and a
 * hardcoded list would land a panel on a blank the first time a screen used
 * a word that was not in it. Each drum freezes its own copy when built, so a
 * later change to the board cannot renumber a flip already under way.
 */
export function panelFaces(from: readonly RowText[], to: readonly RowText[]): string[] {
  const seen = new Set<string>(['']);
  for (const row of [...from, ...to]) seen.add(row.status);
  return [...seen];
}
