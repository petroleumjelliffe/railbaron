import { useCallback, useEffect, useState } from 'react';
import {
  destinationInRegion, rollDestination,
  type RegionId, type Rng, type RollOutcome
} from '../../engine';
import type { GameEvent, SeatId } from './events';
import { currentCity, replay, undo } from './game';
import { clearLog, loadLog, saveLog } from './storage';

export function useGame(rng: Rng = Math.random) {
  const [events, setEvents] = useState<GameEvent[]>(() => loadLog().events);
  // Read once, at mount: this is the age of the record we resumed from, not
  // of the save this session goes on to write.
  const [savedAt] = useState<number | null>(() => loadLog().savedAt);

  // loadLog() already defaults to [] when nothing is stored, so an empty log
  // needs no entry of its own — persisting `{version,events:[]}` here would
  // just resurrect the key on the very next render after reset()'s
  // clearLog() call removed it, making that call a no-op in practice.
  useEffect(() => {
    if (events.length === 0) return;
    saveLog(events);
  }, [events]);

  const state = replay(events);

  // The dice roll happens here, in the event handler body, reading `state`
  // from this render's closure. It must not live inside the setEvents
  // updater below: React 19's StrictMode deliberately invokes updaters
  // twice to catch ones that aren't pure, and an rng() call inside one
  // consumes two rolls for a single tap. The updater itself does nothing
  // but append the one event it was handed, so calling it twice is
  // harmless — both invocations compute the same result from the same
  // input and React keeps only the last.
  //
  // Naming used to be the other half of this hazard, via window.prompt.
  // The board's inline input replaced it, so only the roll remains — but
  // the roll is enough to keep the rule.
  //
  // Reading `state` from the render closure (rather than re-deriving it from
  // the updater's own `log` argument) means two taps landing in the same
  // tick could both read the same pre-tap state. For a single-user tablet
  // app where taps are sequential and each one waits for its own render,
  // that's not a real risk in practice — but it is a real trade-off, not an
  // oversight.
  /**
   * Rolls, and returns what was rolled. Deliberately appends nothing.
   *
   * THE GATE. A roll's consequence — the destination, the payout, or the
   * ballot that a baron's own region hands back to them — is visible the
   * moment the event describing it exists, because every screen on this board
   * is a pure function of the log. So the roll does not enter the log until
   * the board has finished announcing the region it produced.
   *
   * Splitting the two is what makes that structural rather than a convention
   * somebody has to remember. There is no way to append a roll except through
   * `commitRoll`, and its only caller is the handler that fires when the
   * region panel lands. A future screen cannot leak the outcome early by
   * reading the wrong thing, because until that moment there is nothing to
   * read.
   */
  const roll = useCallback((seat: SeatId): RollOutcome | null => {
    const current = state.seats[seat];
    if (current.awaiting !== null || current.name === null) return null;
    return rollDestination(currentCity(current), rng);
  }, [state, rng]);

  /** The only way a roll reaches the log. See `roll`. */
  const commitRoll = useCallback((seat: SeatId, outcome: RollOutcome) => {
    setEvents(log => {
      switch (outcome.kind) {
        case 'home':
          return [...log,
            { type: 'arrived', seat, city: outcome.city, region: outcome.region, payout: null }];
        case 'arrived':
          return [...log,
            { type: 'arrived', seat, city: outcome.city, region: outcome.region, payout: outcome.payout }];
        case 'chooseRegion':
          return [...log, { type: 'regionRequested', seat, rolled: outcome.rolled }];
      }
    });
  }, []);

  const chooseRegion = useCallback((seat: SeatId, region: RegionId) => {
    const current = state.seats[seat];
    const from = currentCity(current);
    if (from === null || current.awaiting === null) return;
    const arrival = destinationInRegion(from, region, rng);
    setEvents(log => [...log,
      { type: 'arrived', seat, city: arrival.city, region: arrival.region, payout: arrival.payout }]);
  }, [state, rng]);

  /**
   * An empty name vacates the seat. Whether that is a `joined` or a
   * `renamed` event is decided from the log itself rather than from this
   * render's `state`, so two commits in one tick cannot both read a seat
   * as empty and append two `joined` events for it.
   */
  const rename = useCallback((seat: SeatId, name: string | null) => {
    setEvents(log => {
      const seated = replay(log).seats[seat].name !== null;
      if (!seated && name) return [...log, { type: 'joined', seat, name }];
      return [...log, { type: 'renamed', seat, name: name || null }];
    });
  }, []);

  const start = useCallback(() => {
    setEvents(log => (log.some(e => e.type === 'started') ? log : [...log, { type: 'started' }]));
  }, []);

  const undoLast = useCallback(() => setEvents(log => undo(log)), []);
  const reset = useCallback(() => { clearLog(); setEvents([]); }, []);

  return { state, savedAt, roll, commitRoll, chooseRegion, rename, start, undoLast, reset };
}
