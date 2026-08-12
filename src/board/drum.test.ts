import { describe, expect, it } from 'vitest';
import { ALPHABET, toIndexes } from './alphabet';
import { advance, buildDrum, faces, isSettled, staticFaces, type Tile } from './drum';

const spin = (tiles: Tile[], ticks: number) => {
  let out = tiles;
  for (let i = 0; i < ticks; i++) out = advance(out);
  return out;
};

const ticksToSettle = (from: string, to: string) => {
  let tiles = buildDrum({ from, to });
  let n = 0;
  while (!isSettled(tiles) && n < 200) { tiles = advance(tiles); n++; }
  return n;
};

describe('the flap alphabet', () => {
  it('holds 42 characters, starting with a blank', () => {
    expect(ALPHABET).toHaveLength(42);
    expect(ALPHABET[0]).toBe(' ');
  });

  it('pads and truncates to the field width rather than reflowing', () => {
    expect(toIndexes('AB', 4)).toEqual([1, 2, 0, 0]);
    expect(toIndexes('ABCDE', 3)).toEqual([1, 2, 3]);
  });

  it('maps an unknown character to the blank rather than to -1', () => {
    expect(toIndexes('%', 1)).toEqual([0]);
  });
});

describe('a flap drum', () => {
  it('advances one step per tick until it reaches the target', () => {
    expect(ticksToSettle('A', 'C')).toBe(2);
  });

  it('wraps through the end of the alphabet rather than running backwards', () => {
    // A drum only turns one way. Z is index 26 and A is 1, so getting from
    // one to the other means running off the end of the alphabet and round:
    // 26 + 17 === 43, and 43 mod 42 === 1.
    expect(ticksToSettle('Z', 'A')).toBe(17);
  });

  it('settles immediately when the text has not changed', () => {
    expect(ticksToSettle('DENVER', 'DENVER')).toBe(0);
    expect(isSettled(buildDrum({ from: 'DENVER', to: 'DENVER' }))).toBe(true);
  });

  it('lets each tile settle at its own tick — the cascade is not choreographed', () => {
    // 'AA' -> 'BZ': tile 0 travels 1 step, tile 1 travels 25.
    const tiles = buildDrum({ from: 'AA', to: 'BZ', width: 2 });
    const [first, second] = advance(tiles);
    expect(first!.cur).toBe(first!.target);
    expect(second!.cur).not.toBe(second!.target);
    expect(isSettled(advance(tiles))).toBe(false);
  });

  it('shows the outgoing character on the bottom half while spinning', () => {
    const mid = spin(buildDrum({ from: 'A', to: 'D', width: 1 }), 1);
    expect(faces(mid)[0]).toEqual({ top: 'B', bottom: 'A' });
  });

  it('shows the same character on both halves as soon as it lands', () => {
    const done = spin(buildDrum({ from: 'A', to: 'C', width: 1 }), 2);
    expect(faces(done)[0]).toEqual({ top: 'C', bottom: 'C' });
  });

  it('renders a static field with both halves matching, padded to width', () => {
    expect(staticFaces('HI', 3)).toEqual([
      { top: 'H', bottom: 'H' },
      { top: 'I', bottom: 'I' },
      { top: ' ', bottom: ' ' }
    ]);
  });
});
