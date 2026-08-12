import { ALPHABET, FLAP_WIDTH, toIndexes } from './alphabet';

export interface Tile {
  cur: number;
  prev: number;
  target: number;
}

/** A tile shows two half-flaps: the arriving character above, the leaving one below. */
export interface FlapChar {
  top: string;
  bottom: string;
}

export function buildDrum(from: string, to: string, width: number = FLAP_WIDTH): Tile[] {
  const start = toIndexes(from, width);
  return toIndexes(to, width).map((target, i) => {
    // Both arrays are toIndexes(_, width) so they are the same length by
    // construction, but noUncheckedIndexedAccess cannot know that. A tile
    // with no outgoing character starts from the blank, which is what a
    // widening field should do anyway.
    const cur = start[i] ?? 0;
    return { cur, prev: cur, target };
  });
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
    if (tile.cur === tile.target) {
      return { cur: tile.cur, prev: tile.cur, target: tile.target };
    }
    const next = (tile.cur + 1) % ALPHABET.length;
    return {
      cur: next,
      prev: next === tile.target ? next : tile.cur,
      target: tile.target
    };
  });
}

export function isSettled(tiles: readonly Tile[]): boolean {
  return tiles.every(tile => tile.cur === tile.target);
}

/** Out of range shows a blank — the same thing an unknown character maps to. */
const show = (index: number): string => ALPHABET[index] ?? ' ';

export function faces(tiles: readonly Tile[]): FlapChar[] {
  return tiles.map(tile => ({ top: show(tile.cur), bottom: show(tile.prev) }));
}

export function staticFaces(text: string, width: number = FLAP_WIDTH): FlapChar[] {
  return toIndexes(text, width).map(index => ({ top: show(index), bottom: show(index) }));
}
