import { useCallback, useEffect, useState } from 'react';
import { destinationInRegion, rollDestination, type RegionId, type Rng } from '../../engine';
import type { GameEvent, SeatId } from './events';
import { currentCity, replay, undo } from './game';
import { clearLog, loadLog, saveLog } from './storage';

export function useGame(rng: Rng = Math.random) {
  const [events, setEvents] = useState<GameEvent[]>(() => loadLog());

  useEffect(() => saveLog(events), [events]);

  const state = replay(events);

  const activate = useCallback((seat: SeatId) => {
    setEvents(log => {
      const current = replay(log).seats[seat];
      if (current.awaiting !== null) return log;

      if (current.name === null) {
        const name = window.prompt('Name this baron')?.trim();
        if (!name) return log;
        return [...log, { type: 'joined', seat, name }];
      }

      const outcome = rollDestination(currentCity(current), rng);
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
  }, [rng]);

  const chooseRegion = useCallback((seat: SeatId, region: RegionId) => {
    setEvents(log => {
      const current = replay(log).seats[seat];
      const from = currentCity(current);
      if (from === null || current.awaiting === null) return log;
      const arrival = destinationInRegion(from, region, rng);
      return [...log,
        { type: 'arrived', seat, city: arrival.city, region: arrival.region, payout: arrival.payout }];
    });
  }, [rng]);

  const undoLast = useCallback(() => setEvents(log => undo(log)), []);
  const reset = useCallback(() => { clearLog(); setEvents([]); }, []);

  return { state, activate, chooseRegion, undoLast, reset };
}
