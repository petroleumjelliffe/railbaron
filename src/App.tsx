import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { REGIONS, type Rng } from '../engine';
import { Board } from './board/Board';
import { home } from './board/screens/home';
import { passAndPlay } from './board/screens/passAndPlay';
import { saved } from './board/screens/saved';
import { confirm } from './board/screens/confirm';
import { play } from './board/screens/play';
import { regionBallot } from './board/screens/regionBallot';
import type { Row, ScreenDef } from './board/types';
import { SEATS, type SeatId } from './state/events';
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
  const { state, savedAt, activate, chooseRegion, rename, start, reset } = useGame(rng);
  const [editing, setEditing] = useState<{ seat: SeatId; placeholder: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!isKnown(pathname)) return <Navigate to="/" replace />;

  const resuming = state.phase === 'playing';

  const passAndPlayScreen = (): ScreenDef => {
    if (confirming) return confirm();
    return resuming ? saved(state, savedAt) : passAndPlay(state);
  };

  // Only one seat can be owed a region at a time. It takes over the whole
  // board rather than opening a dialog over it — which is the pattern this
  // entire design generalises.
  const awaiting = SEATS.map(id => state.seats[id]).find(seat => seat.awaiting !== null);

  const screens: Record<KnownRoute, ScreenDef> = {
    '/': home(),
    '/pass-and-play': passAndPlayScreen(),
    '/pass-and-play/game': awaiting ? regionBallot(awaiting) : play(state)
  };

  const onRowAct = (row: Row, index: number) => {
    if (row.action === null) return;

    if (row.action.kind === 'act') {
      // The ballot's choice is its row position: RowAction carries no
      // region, and widening it for one screen would cost every other
      // screen a field it never sets.
      if (awaiting) chooseRegion(row.action.seat, REGIONS[index]!.id);
      else activate(row.action.seat);
      return;
    }

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
        // Only reachable from the confirmation's YES, DISCARD row.
        if (confirming) reset();
        setConfirming(false);
        navigate('/pass-and-play');
        break;
      case 'confirm':
        setConfirming(true);
        break;
      case 'saved':
        setConfirming(false);
        break;
      case 'play':
        if (!resuming) start();
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
        onBack={() => {
          // Backing out of the confirmation returns to the saved game
          // rather than leaving the route, which is why it is not a route.
          if (confirming) { setConfirming(false); return; }
          navigate('/');
        }}
        onRowAct={onRowAct}
      />
    </main>
  );
}
