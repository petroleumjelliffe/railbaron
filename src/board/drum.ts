import { ALPHABET, FLAP_WIDTH, toIndexes } from './alphabet';

export interface Tile {
  cur: number;
  prev: number;
  target: number;
  /**
   * Extra ticks this tile turns before it is allowed to land, on top of the
   * distance it has to cover. This is how a column is made to settle later
   * than one with less distance to travel.
   *
   * Always a whole number of laps. A drum turns one way and cannot stop
   * between faces, so a tile asked to hold for some arbitrary count would
   * end that count somewhere short of its target and have to run most of
   * another lap to reach it — turning a 12-tick delay into a 42-tick one.
   * Whole laps land it back where it started, with exactly its own distance
   * left to go.
   */
  hold: number;
  /** How many faces this tile carries. Characters for a tile grid, whole words for a panel. */
  faces: readonly string[];
}

/** A tile shows two half-flaps: the arriving character above, the leaving one below. */
export interface FlapChar {
  top: string;
  bottom: string;
}

const CHARACTERS = [...ALPHABET];

/**
 * The faces a payout tile carries: digits, a comma and a blank. The dollar
 * sign is not among them — it is a fixed label in front of the tiles, not
 * something that turns. Nothing else can appear in a payout, so a tile
 * carrying only these reaches any figure in at most twelve turns instead of
 * the alphabet's forty-one; the payout lands last in the sequence, and a
 * full alphabet drum there would add two seconds to every roll for
 * characters that can never come up.
 */
const DIGITS = [...' 0123456789,'];

export interface DrumSpec {
  from: string;
  to: string;
  width?: number;
  /** Defaults to the full alphabet, one tile per character. */
  faces?: readonly string[];
  /**
   * One tile carrying the whole string, rather than one tile per character —
   * a single physical panel that flips between words. Only the region column
   * works this way; the payout has its own reduced ring but is still a row of
   * tiles, and treating "not the alphabet" as "must be a panel" turned it
   * into one tumbling character.
   */
  whole?: boolean;
  /**
   * The earliest tick any tile in this drum may land. A tile with further to
   * travel than that still takes as long as it takes — this sets a floor, not
   * a schedule, so the cascade across a field still comes from the tiles
   * themselves rather than being dictated here.
   */
  settleAt?: number;
}

function ringIndexes(
  text: string, width: number, faces: readonly string[], whole: boolean
): number[] {
  if (!whole) {
    // Per character, against this drum's own ring. Anything the ring does
    // not carry shows blank, which is index 0 in every ring here.
    const padded = text.toUpperCase().slice(0, width).padEnd(width, ' ');
    return [...padded].map(character => {
      const at = faces.indexOf(character);
      return at < 0 ? 0 : at;
    });
  }
  // A panel carries whole words, so the whole string is one face.
  const at = faces.indexOf(text);
  return [at < 0 ? 0 : at];
}

export function buildDrum(spec: DrumSpec): Tile[] {
  const faces = spec.faces ?? CHARACTERS;
  const whole = spec.whole ?? false;
  const width = whole ? 1 : (spec.width ?? FLAP_WIDTH);
  const settleAt = spec.settleAt ?? 0;

  const start = ringIndexes(spec.from, width, faces, whole);
  return ringIndexes(spec.to, width, faces, whole).map((target, i) => {
    // Both arrays come from the same call so they are the same length by
    // construction, but noUncheckedIndexedAccess cannot know that. A tile
    // with no outgoing face starts from the blank, which is what a widening
    // field should do anyway.
    const cur = start[i] ?? 0;
    const travel = (target - cur + faces.length) % faces.length;
    const laps = Math.max(0, Math.ceil((settleAt - travel) / faces.length));
    return { cur, prev: cur, target, hold: laps * faces.length, faces };
  });
}

/** Whole words rather than characters: one physical panel that flips through a list. */
export const panelDrum = (from: string, to: string, faces: readonly string[], settleAt = 0) =>
  buildDrum({ from, to, faces, settleAt, whole: true });

/** The payout's own reduced ring — see DIGITS. */
export const amountDrum = (from: string, to: string, width: number, settleAt = 0) =>
  buildDrum({ from, to, width, faces: DIGITS, settleAt });

/**
 * How many ticks this drum needs before every tile has landed. Known up
 * front because each tile's remaining distance and hold are both known, which
 * is what lets one column be scheduled to settle after another rather than
 * the two racing.
 */
export function duration(tiles: readonly Tile[]): number {
  return tiles.reduce((longest, tile) => {
    const travel = (tile.target - tile.cur + tile.faces.length) % tile.faces.length;
    return Math.max(longest, tile.hold + travel);
  }, 0);
}

/**
 * One tick. Every unsettled tile moves exactly one place forward; settled
 * tiles hold. The cascade an onlooker sees is not choreographed anywhere —
 * it falls out of tiles having different distances left to travel.
 *
 * A tile that lands on this tick sets `prev` to where it landed, so both
 * halves show the arriving character the moment it arrives. Leaving `prev`
 * behind would hold the outgoing character on the bottom half for one extra
 * tick after the flap had visibly stopped.
 */
export function advance(tiles: readonly Tile[]): Tile[] {
  return tiles.map(tile => {
    if (tile.hold === 0 && tile.cur === tile.target) return tile;

    const next = (tile.cur + 1) % tile.faces.length;
    const hold = Math.max(0, tile.hold - 1);
    // Still under hold, so it turns past its target rather than landing on it.
    const landed = hold === 0 && next === tile.target;
    return { ...tile, cur: next, prev: landed ? next : tile.cur, hold };
  });
}

export function isSettled(tiles: readonly Tile[]): boolean {
  return tiles.every(tile => tile.hold === 0 && tile.cur === tile.target);
}

const show = (tile: Tile, index: number): string => tile.faces[index] ?? ' ';

export function faces(tiles: readonly Tile[]): FlapChar[] {
  return tiles.map(tile => ({ top: show(tile, tile.cur), bottom: show(tile, tile.prev) }));
}

export function staticFaces(text: string, width: number = FLAP_WIDTH): FlapChar[] {
  return toIndexes(text, width).map(index => {
    const face = CHARACTERS[index] ?? ' ';
    return { top: face, bottom: face };
  });
}

/** What a settled panel shows: the value itself, no drum needed. */
export const staticPanel = (text: string): FlapChar[] => [{ top: text, bottom: text }];
