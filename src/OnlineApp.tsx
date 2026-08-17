import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lobbyView, type LobbyLimits } from '../vendor/lobby/client/view';
import { Board } from './board/Board';
import {
  joinRoom as joinRoomScreen, onlineChoice, onlineLobby, roomGone, roomRefused, staleClient,
} from './board/screens/online';
import type { FieldId, Row, ScreenDef } from './board/types';
import { useGameShell } from './GameShell';
import { SERVER_URL } from './config';
import { closeConnection, getConnection } from './net/connection';
import { identity } from './net/identity';
import { useOnlineGame } from './net/useOnlineGame';
import { useRoom, type RoomState } from './net/useRoom';
import { SEATS, type SeatId } from './state/events';

const MapView = lazy(() => import('./map/MapView').then(m => ({ default: m.MapView })));

/**
 * Online mounts its own Board, and that is a known cost rather than an
 * oversight.
 *
 * `App` keeps one Board across its own routes so the flap plays between them.
 * Sharing that single Board with online would mean `App` calling `useRoom`
 * unconditionally — hooks cannot be called conditionally — which opens a
 * socket to the game server on every load of the mode-select screen, for
 * every player who never goes online. The trade is one lost flap on the
 * home → online transition; within online, lobby → game → map all keep the
 * same Board and animate normally.
 */

/**
 * Both halves read the same rule rather than being told it: the seat space
 * that builds the server's rooms is this same SEATS, so capacity cannot drift
 * and no protocol version is spent on a number neither side had to send.
 */
const LIMITS: LobbyLimits = { capacity: SEATS.length, minPlayers: 2 };

const shellStyle = { height: '100%' } as const;

/** `/online` — board 1d: the two ways in, stated as destinations. */
export function OnlineChoiceApp() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // The shared connection, touched only when somebody actually asks for a
  // room, so the join screen itself costs no socket. Shared is the point, not
  // a convenience: the seat this create binds rides the socket itself, and
  // `useRoom` on the next route reuses the same socket — the server's rejoin
  // shortcut hands it the same seat back, before any identity reaches
  // storage. An earlier draft opened its own connection here and closed it on
  // navigate, which threw that binding away: the creator arrived in their own
  // room as a stranger.
  useEffect(() => {
    if (!creating) return;
    const connection = getConnection();

    const offJoined = connection.onJoined((msg) => {
      // The room exists and this socket holds seat one of it.
      navigate(`/room/${msg.roomId}`);
    });

    // Every way this can fail arrives here or not at all, and both used to be
    // silent: a refusal was ignored, and a server that never answered left the
    // row tapped and the screen unchanged. The commonest cause is not exotic —
    // the sibling Acquire server also defaults to port 3001, and it answers
    // with a protocol this client does not speak.
    const offRejected = connection.onRejected((msg) => {
      setCreating(false);
      setNote(msg.code === 'versionMismatch'
        ? 'Server speaks a different protocol — reload, or check the port'
        : msg.message);
    });

    const timer = setTimeout(() => {
      setCreating(false);
      setNote(`No answer from ${SERVER_URL} — is the game server running?`);
    }, 8000);

    connection.createRoom();
    // Unsubscribe only — the connection is the app's, and the room screen
    // this navigates to is about to need it. Closing it here is how the
    // creator lost their seat.
    return () => {
      clearTimeout(timer);
      offJoined();
      offRejected();
    };
  }, [creating, navigate]);

  const onRowAct = (row: Row) => {
    if (row.action === null) return;
    switch (row.action.kind) {
      case 'createRoom':
        setNote(null);
        setCreating(true);
        return;
      case 'navigate':
        if (row.action.to === 'joinRoom') navigate('/online/join');
        if (row.action.to === 'home') navigate('/');
    }
  };

  return (
    <main style={shellStyle}>
      <Board
        screen={onlineChoice(note)}
        awaitRegion={null}
        onRollDice={() => {}}
        awaitDice={null}
        onBack={() => navigate('/')}
        onRowAct={onRowAct}
      />
    </main>
  );
}

/** `/online/join` — board 1f: code first, name second, both click-to-input. */
export function JoinRoomApp() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] =
    useState<{ field: 'roomCode' | 'joinName'; placeholder: string } | null>(null);

  const join = () => {
    // The name rides the identity store, not the URL: the lobby's join sends
    // the remembered name, so writing it here is what makes the typed name
    // the one the server seats.
    if (name !== '') identity.rememberName(name);
    navigate(`/room/${code}`);
  };

  const onRowAct = (row: Row) => {
    if (row.action === null) return;
    switch (row.action.kind) {
      case 'joinRoom':
        join();
        return;
      case 'edit':
        if (row.action.field !== 'roomCode' && row.action.field !== 'joinName') return;
        setEditing({ field: row.action.field, placeholder: row.action.placeholder });
        return;
      case 'navigate':
        if (row.action.to === 'home') navigate('/');
    }
  };

  return (
    <main style={shellStyle}>
      <Board
        screen={joinRoomScreen(code, name)}
        awaitRegion={null}
        onRollDice={() => {}}
        awaitDice={null}
        editing={editing && {
          field: editing.field,
          placeholder: editing.placeholder,
          // The underlying value, not the row's prompt text.
          initial: editing.field === 'roomCode' ? code : name
        }}
        onCommit={(value) => {
          if (editing?.field === 'joinName') {
            // The board's tiles hold fourteen characters, same as a seat name.
            setName(value.trim().toUpperCase().slice(0, 14));
          } else {
            // Room codes are six unambiguous uppercase characters; typing them
            // in lower case is the ordinary way a person copies one off a phone.
            setCode(value.trim().toUpperCase().slice(0, 6));
          }
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
        onBack={() => navigate('/online')}
        onRowAct={onRowAct}
      />
    </main>
  );
}

/** `/room/:code` — the lobby until Begin, the game after it. */
export function RoomApp({ code }: { code: string }) {
  const navigate = useNavigate();
  const room = useRoom(code);
  return <RoomBoard room={room} onHome={() => navigate('/')} />;
}

function RoomBoard({ room, onHome }: { room: RoomState; onHome: () => void }) {
  const game = useOnlineGame(room.log, room.transport, room.seat);
  // Online: this device speaks for one baron. Before a seat is granted there
  // is nothing to act with, and 'all' would be wrong — but no game screen is
  // shown then either.
  const shell = useGameShell(game, room.seat ?? 'all');
  const [editing, setEditing] =
    useState<{ field: FieldId; seat: SeatId; placeholder: string } | null>(null);
  const [onMap, setOnMap] = useState(false);

  const view = useMemo(() => lobbyView({
    phase: room.phase,
    status: room.lobby.status,
    roster: room.lobby.roster,
    playerId: room.lobby.playerId,
  }, LIMITS), [room.phase, room.lobby.status, room.lobby.roster, room.lobby.playerId]);

  const playing = room.phase === 'playing';

  const screen: ScreenDef = room.phase === 'gone'
    ? roomGone()
    : room.phase === 'stale'
      ? staleClient()
      : room.phase === 'error'
        ? roomRefused(room.lobby.message)
        : playing
          ? shell.gameScreen
          // The message is a refusal to show in the lobby — a begin or a
          // rename the server wouldn't take — and this board is the only
          // thing that can show it.
          : onlineLobby(view, room.lobby.message);

  const onRowAct = (row: Row, index: number) => {
    if (row.action === null) return;
    // The rows that play the game are the shell's, and it holds the seat gate.
    if (playing && shell.actOnRow(row, index)) return;

    switch (row.action.kind) {
      case 'begin':
        room.lobby.begin();
        return;
      case 'leave':
        room.lobby.leaveSeat();
        // Leaving is a real disconnect, not just a route change — the next
        // online visit opens a fresh socket rather than finding this one
        // still bound to a room the player walked out of.
        closeConnection();
        onHome();
        return;
      case 'edit':
        if (!row.action.field.startsWith('seat:')) return;
        setEditing({
          field: row.action.field,
          seat: row.action.field.slice('seat:'.length) as SeatId,
          placeholder: row.action.placeholder,
        });
        return;
      case 'navigate':
        if (row.action.to === 'home') onHome();
        if (row.action.to === 'map') setOnMap(true);
    }
  };

  if (onMap && playing) {
    return (
      <main style={shellStyle}>
        <Suspense fallback={<div style={shellStyle} />}>
          <MapView
            state={game.state}
            onBack={() => setOnMap(false)}
            onMove={shell.onMove}
            dice={shell.dice}
            onRollDice={shell.onRollDice}
            onDiceLanded={shell.onDiceLanded}
          />
        </Suspense>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <Board
        screen={screen}
        awaitRegion={playing ? shell.awaitRegion : null}
        onRollDice={shell.onRollDice}
        awaitDice={playing ? shell.awaitDice : null}
        editing={editing && {
          field: editing.field,
          placeholder: editing.placeholder,
          // The name the roster holds, not the row's prompt.
          initial: view.seats.find((s) => s.id === editing.seat)?.name ?? ''
        }}
        onCommit={(value) => {
          // Names are the lobby's online: the roster broadcast is the answer,
          // and no `renamed` event ever reaches the game log.
          if (editing && value.trim() !== '') room.lobby.rename(value.trim());
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
        onBack={onHome}
        onRowAct={onRowAct}
        // Best-effort. A browser that refuses the clipboard still shows the
        // code on the readout, which is the thing being shared.
        onShare={() =>
          void navigator.clipboard?.writeText(window.location.href).catch(() => {})}
      />
    </main>
  );
}
