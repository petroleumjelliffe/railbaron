import { describe, expect, it } from 'vitest';
import { bonusLegOwed, d6, earnsBonus, movement, rollTurn, type TurnRoll } from './dice';

/** Feeds exact die faces, one per call. `face` is 1-6. */
const dice = (...faces: number[]) => {
  const queue = [...faces];
  return () => {
    const face = queue.shift();
    if (face === undefined) throw new Error('the scripted dice ran out');
    return (face - 1) / 6;
  };
};

describe('one die', () => {
  it('reads the scripted face', () => {
    const rng = dice(1, 6, 3);
    expect([d6(rng), d6(rng), d6(rng)]).toEqual([1, 6, 3]);
  });
});

describe('who earns a Bonus Roll', () => {
  it('gives a Freight one only on double six', () => {
    expect(earnsBonus('freight', [6, 6])).toBe(true);
    expect(earnsBonus('freight', [5, 5])).toBe(false);
    expect(earnsBonus('freight', [6, 5])).toBe(false);
  });

  it('gives an Express one on any double', () => {
    expect(earnsBonus('express', [2, 2])).toBe(true);
    expect(earnsBonus('express', [6, 6])).toBe(true);
    expect(earnsBonus('express', [2, 3])).toBe(false);
  });

  it('gives a Superchief one every turn', () => {
    expect(earnsBonus('superchief', [1, 2])).toBe(true);
    expect(earnsBonus('superchief', [6, 6])).toBe(true);
  });
});

describe('rolling a turn', () => {
  it('rolls two white dice and no bonus when none is earned', () => {
    expect(rollTurn('freight', dice(3, 4))).toEqual({ white: [3, 4], bonus: null });
  });

  it('rolls the bonus die exactly once when one is earned', () => {
    expect(rollTurn('freight', dice(6, 6, 2))).toEqual({ white: [6, 6], bonus: 2 });
  });

  it('never rolls a second bonus die, however the dice fall', () => {
    // Four faces are scripted; a second bonus die would throw on the fourth.
    expect(rollTurn('superchief', dice(6, 6, 6, 6)).bonus).toBe(6);
  });

  it('adds the bonus into the movement it grants', () => {
    expect(movement({ white: [3, 4], bonus: null })).toBe(7);
    expect(movement({ white: [6, 6], bonus: 5 })).toBe(17);
  });
});

describe('whether a bonus leg is still owed', () => {
  const withBonus: TurnRoll = { white: [4, 4], bonus: 3 };
  const without: TurnRoll = { white: [4, 4], bonus: null };

  it('is owed when the pawn arrived inside the white dice', () => {
    expect(bonusLegOwed(withBonus, 6, true)).toBe(true);
    expect(bonusLegOwed(withBonus, 8, true)).toBe(true);
  });

  it('is not owed when the pawn never arrived', () => {
    expect(bonusLegOwed(withBonus, 11, false)).toBe(false);
  });

  it('is not owed when the arrival came out of the bonus movement itself', () => {
    expect(bonusLegOwed(withBonus, 9, true)).toBe(false);
  });

  it('is not owed when no bonus was earned', () => {
    expect(bonusLegOwed(without, 4, true)).toBe(false);
  });
});
