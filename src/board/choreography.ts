import { amountDrum, buildDrum, duration, panelDrum, type Tile } from './drum';

/** The three fields of a row that turn. Label and chip never do. */
export interface RowText {
  status: string;
  text: string;
  amount: string;
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
const GAP = 2;

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
  const changed =
    from.status !== to.status || from.text !== to.text || from.amount !== to.amount;
  if (!changed) return null;

  // A column that is blank before and after has nothing to say and stays
  // still, however long the sequence around it runs. Without this, every row
  // on the setup screens — where the panel and the payout are both empty —
  // would flick through the board's whole vocabulary to arrive back at
  // nothing, and a blank payout would hold the row flapping after the name
  // it was waiting on had already landed.
  //
  // Note this asks whether the field is *empty*, not whether it changed. A
  // baron who rolls the region they are already in, or is sent home for the
  // same payout twice, still gets a full turn — a field that sat still would
  // answer the question before the city had finished asking it.
  const idle = (before: string, after: string) => before === '' && after === '';
  const spin = (before: string, after: string, at: number) => (idle(before, after) ? 0 : at);

  const status = panelDrum(
    from.status, to.status, panelFaces, spin(from.status, to.status, PANEL_LAP)
  );

  // Each column waits on the one before it, and only on a column that
  // actually moves: a screen where the panel stays put should not pay for a
  // gap it is not using.
  // The city is the one column not made to turn when its value has not
  // changed. Holding a drum is done in whole laps, and this drum carries the
  // whole alphabet — a lap here is 42 ticks, well over two seconds, against
  // eight for the panel and twelve for the payout. A baron sent to their own
  // home town has not moved, so a still city column says something true; the
  // region and payout still turn, and still land in order around it.
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
    spin(from.amount, to.amount, before === 0 ? 0 : before + GAP)
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
