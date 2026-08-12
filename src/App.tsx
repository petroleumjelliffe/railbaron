import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { Rng } from '../engine';
import { Board } from './board/Board';
import { home } from './board/screens/home';
import { passAndPlay } from './board/screens/passAndPlay';
import type { Row, ScreenDef } from './board/types';
import type { SeatId } from './state/events';
import { useGame } from './state/useGame';

export interface AppProps {
  /** Injectable so tests can script the dice through the full ballot path. */
  rng?: Rng;
}

/**
 * The routes this app answers to. Not every screen has one — the discard
 * confirmation and the region ballot are states within a route, because a
 * confirmation should not be bookmarkable and the back button out of one
 * must be harmless.
 */
const ROUTES = ['/', '/pass-and-play', '/pass-and-play/game'] as const;
type KnownRoute = (typeof ROUTES)[number];

const isKnown = (path: string): path is KnownRoute =>
  (ROUTES as readonly string[]).includes(path);

/**
 * There is exactly one Board, mounted above the routing, and the route only
 * decides which ScreenDef it is handed.
 *
 * This is not a tidiness preference. A Board per route means navigation
 * unmounts one and mounts another, `useFlap` sees a first render and
 * correctly declines to animate — so the flap, which is the entire point of
 * the design, never plays on the transition it exists for. It would also
 * give each route its own `useGame`, and therefore its own copy of the
 * event log.
 */
export default function App({ rng }: AppProps = {}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state, rename, start } = useGame(rng);
  const [editing, setEditing] = useState<{ seat: SeatId; placeholder: string } | null>(null);

  if (!isKnown(pathname)) return <Navigate to="/" replace />;

  const screens: Record<KnownRoute, ScreenDef> = {
    '/': home(),
    '/pass-and-play': passAndPlay(state),
    // Task 10 replaces this with the play board and the region ballot.
    '/pass-and-play/game': passAndPlay(state)
  };

  const onRowAct = (row: Row) => {
    if (row.action === null) return;

    if (row.action.kind === 'edit') {
      // No `as any`: FieldId is the template literal `seat:${SeatId}`, so
      // slicing the prefix yields a SeatId by construction.
      setEditing({
        seat: row.action.field.slice('seat:'.length) as SeatId,
        placeholder: row.action.placeholder
      });
      return;
    }

    if (row.action.kind !== 'navigate') return;
    switch (row.action.to) {
      case 'passAndPlay':
        navigate('/pass-and-play');
        break;
      case 'play':
        start();
        navigate('/pass-and-play/game');
        break;
    }
  };

  return (
    <main style={{ height: '100%' }}>
      <Board
        screen={screens[pathname]}
        editing={editing}
        onCommit={value => {
          if (editing) rename(editing.seat, value || null);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
        onBack={() => navigate(pathname === '/' ? '/' : '/')}
        onRowAct={onRowAct}
      />
    </main>
  );
}
