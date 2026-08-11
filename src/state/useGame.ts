import { useCallback, useEffect, useState } from 'react';
import { destinationInRegion, rollDestination, type RegionId, type Rng } from '../../engine';
import type { GameEvent, SeatId } from './events';
import { currentCity, replay, undo } from './game';
import { clearLog, loadLog, saveLog } from './storage';

export function useGame(rng: Rng = Math.random) {
  const [events, setEvents] = useState<GameEvent[]>(() => loadLog());

  useEffect(() => saveLog(events), [events]);

  const state = replay(events);

  // Side effects (window.prompt, the dice roll) happen here, in the event
  // handler body, reading `state` from this render's closure. They must not
  // live inside the setEvents updater below: React 19's StrictMode
  // deliberately invokes updaters twice to catch ones that aren't pure, and
  // a prompt() or rng() call inside one fires twice for a single tap. The
  // updater itself does nothing but append the one event it was handed, so
  // calling it twice is harmless — both invocations compute the same result
  // from the same input and React keeps only the last.
  //
  // Reading `state` from the render closure (rather than re-deriving it from
  // the updater's own `log` argument) means two taps landing in the same
  // tick could both read the same pre-tap state. For a single-user tablet
  // app where taps are sequential and each one waits for its own render,
  // that's not a real risk in practice — but it is a real trade-off, not an
  // oversight.
  const activate = useCallback((seat: SeatId) => {
    const current = state.seats[seat];
    if (current.awaiting !== null) return;

    if (current.name === null) {
      const name = window.prompt('Name this baron')?.trim();
      if (!name) return;
      setEvents(log => [...log, { type: 'joined', seat, name }]);
      return;
    }

    const outcome = rollDestination(currentCity(current), rng);
    switch (outcome.kind) {
      case 'home':
        setEvents(log => [...log,
          { type: 'arrived', seat, city: outcome.city, region: outcome.region, payout: null }]);
        return;
      case 'arrived':
        setEvents(log => [...log,
          { type: 'arrived', seat, city: outcome.city, region: outcome.region, payout: outcome.payout }]);
        return;
      case 'chooseRegion':
        setEvents(log => [...log, { type: 'regionRequested', seat, rolled: outcome.rolled }]);
        return;
    }
  }, [state, rng]);

  const chooseRegion = useCallback((seat: SeatId, region: RegionId) => {
    const current = state.seats[seat];
    const from = currentCity(current);
    if (from === null || current.awaiting === null) return;
    const arrival = destinationInRegion(from, region, rng);
    setEvents(log => [...log,
      { type: 'arrived', seat, city: arrival.city, region: arrival.region, payout: arrival.payout }]);
  }, [state, rng]);

  const undoLast = useCallback(() => setEvents(log => undo(log)), []);
  const reset = useCallback(() => { clearLog(); setEvents([]); }, []);

  return { state, activate, chooseRegion, undoLast, reset };
}
