import type { TrainType, TurnRoll } from '../dice';
import type { Rejection } from '../movement';
import type { NodeId, RailroadId } from '../network';

export interface FixtureSpec {
  at: NodeId;
  destination: NodeId;
  train?: TrainType;
  /** Sections already spent this trip, as node pairs. */
  used?: readonly (readonly [NodeId, NodeId])[];
}

export type GoldenIntent =
  /** Roll the turn's dice, with the faces scripted so the game is a game. */
  | { kind: 'roll'; faces: readonly number[] }
  | { kind: 'step'; to: NodeId }
  | { kind: 'back' }
  | { kind: 'commit' }
  /** A new destination, named after arriving — the bonus-leg case. */
  | { kind: 'destination'; to: NodeId };

export type GoldenRejection = Rejection | 'route-incomplete' | 'no-roll' | 'nothing-to-undo';

export interface StateAssertion {
  at?: NodeId;
  spent?: number;
  remaining?: number;
  arrived?: boolean;
  complete?: boolean;
  /** How many sections the trip has spent. 0 after an arrival releases them. */
  usedCount?: number;
  bonus?: number | null;
  legOwed?: boolean;
  companies?: readonly RailroadId[];
}

export interface GoldenStep {
  name: string;
  intent: GoldenIntent;
  /** When set, the step must be REJECTED with this code and change nothing. */
  expectError?: GoldenRejection;
  then?: StateAssertion;
}

export interface GoldenGame {
  id: string;
  title: string;
  setup: FixtureSpec;
  steps: GoldenStep[];
  final?: StateAssertion;
}

export interface GoldenState {
  at: NodeId;
  destination: NodeId;
  train: TrainType;
  used: ReadonlyMap<string, number>;
  roll: TurnRoll | null;
  leg: number;
  draft: import('../route').Draft | null;
  /**
   * Every leg this game has committed, in order — exactly what a `moved`
   * event carries. It is here so the same story can be replayed through the
   * app's event log and the two made to agree.
   */
  legs: readonly { path: readonly NodeId[]; arrived: boolean }[];
}
