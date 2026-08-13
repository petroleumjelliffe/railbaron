import type { Rng } from './types';

/**
 * Freight to start. EXPRESS costs $4,000 and SUPERCHIEF $40,000 — prices the
 * money spec will charge. Nothing here upgrades a train; this type exists
 * because the Bonus Roll rule already turns on it, and threading it now costs
 * one parameter against a later change to every call site.
 *
 * There is no Fast Freight in this rulebook.
 */
export type TrainType = 'freight' | 'express' | 'superchief';

export interface TurnRoll {
  readonly white: readonly [number, number];
  /** null when this turn earned no Bonus Roll. */
  readonly bonus: number | null;
}

export const d6 = (rng: Rng): number => Math.floor(rng() * 6) + 1;

/**
 * "A player can get no more than one Bonus Roll per turn", and a player
 * entitled to one must take it — so this is a fact about the turn rather than
 * a choice offered to anyone.
 */
export function earnsBonus(train: TrainType, white: readonly [number, number]): boolean {
  switch (train) {
    case 'superchief': return true;
    case 'express': return white[0] === white[1];
    case 'freight': return white[0] === 6 && white[1] === 6;
  }
}

export function rollTurn(train: TrainType, rng: Rng): TurnRoll {
  const white: [number, number] = [d6(rng), d6(rng)];
  return { white, bonus: earnsBonus(train, white) ? d6(rng) : null };
}

export const movement = (roll: TurnRoll): number =>
  roll.white[0] + roll.white[1] + (roll.bonus ?? 0);

/**
 * Whether a second leg is still owed, and this is the one place the two legs
 * of a turn stop being interchangeable.
 *
 * Moving the white dice and the bonus die as one continuous run is equivalent
 * to the book's two legs *only while the pawn does not arrive*. If it arrives
 * inside the white dice, the book stops it dead, pays the player, has them
 * roll a **new** destination, and spends the Bonus Roll starting that new trip
 * with the used sections released. So the bonus movement can belong to a
 * different trip entirely, and the turn is not over.
 *
 * Arriving later than the white dice means the arrival happened during the
 * bonus movement of the same trip, which simply ends the turn.
 */
export function bonusLegOwed(roll: TurnRoll, spent: number, arrived: boolean): boolean {
  if (!arrived || roll.bonus === null) return false;
  return spent <= roll.white[0] + roll.white[1];
}
