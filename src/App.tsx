import { lazy, Suspense, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { REGIONS, type RegionId, type Rng, type RollOutcome, type TurnRoll } from '../engine';
import { Board } from './board/Board';
import { home } from './board/screens/home';
import { passAndPlay } from './board/screens/passAndPlay';
import { saved } from './board/screens/saved';
import { confirm } from './board/screens/confirm';
import { diceFor, play } from './board/screens/play';
import { regionBallot } from './board/screens/regionBallot';
import { homes } from './board/screens/homes';
import type { Row, ScreenDef } from './board/types';

/**
 * The map is loaded only when someone asks for it. It carries the projected
 * network, the coastline and d3-geo — around 160KB that the roller, which is
 * the whole app for most of a game, has no use for.
 */
const MapView = lazy(() => import('./map/MapView').then(m => ({ default: m.MapView })));
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
const ROUTES = ['/', '/pass-and-play', '/pass-and-play/game', '/pass-and-play/map'] as const;
type KnownRoute = (typeof ROUTES)[number];

const isKnown = (path: string): path is KnownRoute =>
  (ROUTES as readonly string[]).includes(path);

/** Every outcome names a region — it is the one thing a roll always produces. */
const regionOf = (outcome: RollOutcome): RegionId =>
  outcome.kind === 'chooseRegion' ? outcome.rolled : outcome.region;

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
  const { state, savedAt, roll, commitRoll, chooseRegion, rename, start,
          rollOrder, undoLast, reset, rollDice, commitDice,
          rollBonus, commitBonus, commitMove } = useGame(rng);
  const [editing, setEditing] = useState<{ seat: SeatId; placeholder: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  /**
   * A roll that has been made but not yet told. It is held here, out of the
   * log, until the board's region panel finishes turning — see `roll` in
   * useGame for why that is the gate rather than a rule to remember.
   */
  const [rolling, setRolling] = useState<{ seat: SeatId; outcome: RollOutcome } | null>(null);
  /** Dice rolled but not yet told. Same gate as `rolling`, same reason. */
  const [rollingDice, setRollingDice] = useState<{ seat: SeatId; roll: TurnRoll } | null>(null);
  /**
   * A Bonus Roll thrown but not yet told. Its own hold rather than a field on
   * `rollingDice`: the two are separate rolls made at different moments of the
   * turn, and the white pair it belongs to is already in the log by the time
   * this one is thrown.
   */
  const [rollingBonus, setRollingBonus] = useState<{ seat: SeatId; face: number } | null>(null);
  /**
   * How many rolls each seat has had told. Kept across the commit, so the
   * board sees one announcement per roll rather than a second one when the
   * roll finally reaches the log.
   */
  const [turns, setTurns] = useState<Partial<Record<SeatId, number>>>({});

  if (!isKnown(pathname)) return <Navigate to="/" replace />;

  const resuming = state.phase !== 'setup';

  // Named rather than inlined, because the board's header and the map's HUD
  // are two call sites for one roll: two copies would be two places for the
  // gate to drift apart.
  //
  // One tap, two rolls: which one the readout is offering depends on where the
  // turn stands. Before the whites it is the white pair; once they have been
  // walked and a Bonus Roll is owed, the same drums throw the red die alone.
  // The gate is the same in both directions — roll here, append only when the
  // drums report they have finished telling it.
  const onRollDice = () => {
    if (state.turn === null || rollingDice !== null || rollingBonus !== null) return;
    if (state.bonusOwed) {
      const face = rollBonus(state.turn);
      if (face === null) return;
      setRollingBonus({ seat: state.turn, face });
      return;
    }
    const rolled = rollDice(state.turn);
    if (rolled === null) return;
    setRollingDice({ seat: state.turn, roll: rolled });
  };
  const onDiceLanded = () => {
    if (rollingBonus !== null) {
      commitBonus(rollingBonus.seat, rollingBonus.face);
      setRollingBonus(null);
      return;
    }
    if (rollingDice === null) return;
    commitDice(rollingDice.seat, rollingDice.roll);
    setRollingDice(null);
  };

  // A stale bookmark or a typed URL can ask for the game board when there
  // is no game. Rendering it anyway gives a board of seven blank rows with
  // nothing tappable on it — a dead end whose only affordance is BACK.
  // The map is reached from the game and shows what each baron is doing, so
  // it is guarded the same way.
  if (pathname.startsWith('/pass-and-play/') && !resuming) {
    return <Navigate to="/pass-and-play" replace />;
  }

  // The map is not a ScreenDef and is not seven rows, so it replaces the
  // Board rather than being handed to it. Everything below this line is the
  // board and does not apply.
  if (pathname === '/pass-and-play/map') {
    return (
      <main style={{ height: '100%' }}>
        <Suspense fallback={
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#e8e6e1', fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8a8377'
          }}>
            Warming the lamps
          </div>
        }>
          <MapView
            state={state}
            onBack={() => navigate('/pass-and-play/game')}
            onMove={commitMove}
            dice={diceFor(state, rollingDice?.roll ?? null, rollingBonus?.face ?? null)}
            onRollDice={onRollDice}
            onDiceLanded={onDiceLanded}
          />
        </Suspense>
      </main>
    );
  }

  const passAndPlayScreen = (): ScreenDef => {
    if (confirming) return confirm();
    return resuming ? saved(state, savedAt) : passAndPlay(state);
  };

  // Only one seat can be owed a region at a time. It takes over the whole
  // board rather than opening a dialog over it — which is the pattern this
  // entire design generalises.
  const awaiting = SEATS.map(id => state.seats[id]).find(seat => seat.awaiting !== null);

  // Every route but the map, which returned above — it is not a ScreenDef.
  const screens: Record<Exclude<KnownRoute, '/pass-and-play/map'>, ScreenDef> = {
    '/': home(),
    '/pass-and-play': passAndPlayScreen(),
    // The ballot cannot appear early: `awaiting` comes from the log, and a
    // roll only reaches the log once its region has landed.
    '/pass-and-play/game': state.phase === 'homes'
      ? homes(state, rolling && { seat: rolling.seat, region: regionOf(rolling.outcome) })
      : awaiting
        ? regionBallot(awaiting)
        : play(state, turns,
               rolling && { seat: rolling.seat, region: regionOf(rolling.outcome) },
               rollingDice?.roll ?? null,
               rollingBonus?.face ?? null)
  };

  const onRowAct = (row: Row, index: number) => {
    if (row.action === null) return;

    if (row.action.kind === 'act') {
      // The ballot's choice is its row position: RowAction carries no
      // region, and widening it for one screen would cost every other
      // screen a field it never sets.
      if (awaiting) { chooseRegion(row.action.seat, REGIONS[index]!.id); return; }
      if (rolling !== null) return;      // one roll is already being told
      const seat = row.action.seat;
      const outcome = roll(seat);
      if (outcome === null) return;
      setTurns(counted => ({ ...counted, [seat]: (counted[seat] ?? 0) + 1 }));
      setRolling({ seat, outcome });
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

    if (row.action.kind === 'order') { rollOrder(); return; }

    if (row.action.kind === 'undo') { undoLast(); return; }

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
      case 'map':
        navigate('/pass-and-play/map');
        break;
    }
  };

  return (
    <main style={{ height: '100%' }}>
      <Board
        screen={screens[pathname]}
        awaitRegion={rolling && {
          row: SEATS.filter(id => state.seats[id].name !== null).indexOf(rolling.seat),
          onLanded: () => { commitRoll(rolling.seat, rolling.outcome); setRolling(null); }
        }}
        onRollDice={onRollDice}
        awaitDice={(rollingDice || rollingBonus) && { onLanded: onDiceLanded }}
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
