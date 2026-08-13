import { useCallback, useEffect, useState } from 'react';
import {
  arrived as hasArrived, back, complete, extend, here, isRejection, movement,
  nodeById, nodeForCity, options, path as pathOf, remaining as leftOf, startDraft,
  type Draft, type NodeId, type Rejection
} from '../../engine';
import type { SeatId } from '../state/events';
import type { GameState } from '../state/game';
import { destinationOf } from '../state/turns';

export interface RouteApi {
  draft: Draft | null;
  /** Nodes a tap would accept right now. */
  legal: ReadonlySet<NodeId>;
  at: NodeId | null;
  remaining: number;
  tap: (id: NodeId) => void;
  undo: () => void;
  canCommit: boolean;
  commit: () => void;
  /** Why the last tap was refused, or null. Cleared by the next accepted tap. */
  refused: Rejection | null;
}

const NOTHING: ReadonlySet<NodeId> = new Set();

/**
 * A junction is not a place. Taking it automatically means the player taps
 * dots — which is what the printed board looks like — and never has to notice
 * that the graph carries extra nodes. Only an unambiguous continuation is
 * taken: at a genuine fork the player must choose, and the dots beyond both
 * branches are offered instead.
 *
 * The `seen` set is not decoration. Two junctions can adjoin, and an edge
 * carrying several railroads may legally be re-crossed — so without it a pair
 * of bend points would hand each other the pawn back and forth until the
 * sections ran out.
 */
function throughJunctions(draft: Draft): Draft {
  const seen = new Set<NodeId>([here(draft)]);
  let landed = draft;
  for (;;) {
    const onward = options(landed)
      .filter(step => nodeById(step.to).kind === 'junction' && !seen.has(step.to));
    if (onward.length !== 1) return landed;
    const through = extend(landed, onward[0]!.to);
    if (isRejection(through)) return landed;
    seen.add(onward[0]!.to);
    landed = through;
  }
}

/**
 * The route a player is tapping out, held here and nowhere else.
 *
 * It never touches the log, so undo is free and a reload loses it — an
 * annoyance on one tablet, not a lost game. It also does not cross tabs, which
 * is the right split: route-building happens in the tab that is playing, and
 * the other watches the committed move play back like any other spectator.
 */
export function useRoute(
  state: GameState,
  onMove: (seat: SeatId, path: readonly NodeId[], arrived: boolean) => void
): RouteApi {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [refused, setRefused] = useState<Rejection | null>(null);

  const seat = state.turn === null ? null : state.seats[state.turn];
  const destination = seat === null ? null : destinationOf(seat);
  const roll = state.rolled;

  /**
   * How much this leg may spend. The first leg has the whole roll; a Bonus
   * Roll leg has only the bonus die, because the movement the white dice
   * bought was lost the moment the pawn arrived.
   */
  const legMovement = roll === null
    ? 0
    : state.leg === 0 ? movement(roll) : (roll.bonus ?? 0);

  // Rebuild whenever the turn, the leg or the destination changes — a draft
  // outliving the turn that started it would let a player spend last turn's
  // dice on this one.
  const key = `${state.turn ?? ''}|${state.leg}|${destination ?? ''}|${legMovement}`;
  useEffect(() => {
    if (seat === null || seat.at === null || destination === null || roll === null) {
      setDraft(null);
      setRefused(null);
      return;
    }
    setDraft(startDraft(seat.at, nodeForCity(destination), legMovement, seat.used));
    setRefused(null);
    // `key` is the whole dependency: seat and roll are rebuilt every render,
    // and depending on them would reset the draft on every tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const tap = useCallback((id: NodeId) => {
    setDraft(current => {
      if (current === null) return current;
      const next = extend(current, id);
      if (isRejection(next)) { setRefused(next); return current; }
      setRefused(null);
      return throughJunctions(next);
    });
  }, []);

  const undo = useCallback(() => {
    setRefused(null);
    setDraft(current => (current === null ? current : back(current)));
  }, []);

  const canCommit = draft !== null && complete(draft) && draft.steps.length > 0;

  const commit = useCallback(() => {
    if (draft === null || state.turn === null) return;
    if (!complete(draft) || draft.steps.length === 0) return;
    onMove(state.turn, pathOf(draft), hasArrived(draft));
    setDraft(null);
  }, [draft, state.turn, onMove]);

  return {
    draft,
    legal: draft === null ? NOTHING : new Set(options(draft).map(step => step.to)),
    at: draft === null ? (seat?.at ?? null) : here(draft),
    remaining: draft === null ? 0 : leftOf(draft),
    tap, undo, canCommit, commit, refused
  };
}
