import type { LobbyView } from '../../../vendor/lobby/client/view';
import { SEATS } from '../../state/events';
import { SEAT_COLORS } from '../../game/tokens';
import { padRows, type Row, type ScreenDef } from '../types';

/**
 * Boards 1d, 1e, 1f and the terminals.
 *
 * Copy and structure follow the approved boards in the Rail Baron Game Board
 * Design project (Multiplayer Screens.dc.html, boards 1d–1f), reconciled
 * 2026-08-16, with one owner ruling on top: the design's 1e spends a row on
 * the room code and shows five seats, but the game has six, so the code moved
 * to the header where the dice otherwise go (`ScreenDef.code`) and all six
 * seats keep their rows. The terminals are this app's own — the design does
 * not cover failure.
 */

/** The lobby's seat ids are the game's colours, so the chip is a lookup. */
const chipFor = (id: string | null): string | null => {
  const seat = SEATS.find((s) => s === id);
  return seat === undefined ? null : SEAT_COLORS[seat];
};

const BEGIN_BLOCKED: Record<NonNullable<LobbyView['beginBlocked']>, string> = {
  notHost: 'Host starts',
  notEnoughPlayers: 'Need 2 barons',
  alreadyBegun: 'Under way',
};

const CONNECTION: Record<LobbyView['connection'], string> = {
  connecting: 'Connecting',
  live: 'Live',
  dropped: 'Reconnecting',
};

/** The design's chips for the two ways in: gold for the host, blue for a guest. */
const HOST_CHIP = '#f5c451';
const GUEST_CHIP = '#2f7fe8';

/**
 * Board 1d: the two ways in, stated as destinations. No code entry here —
 * typing the code is board 1f's whole job.
 *
 * `note` is how a create-room refusal becomes visible. Opening a room is the
 * one action here that talks to the server, and every way it can fail — no
 * server listening, a server speaking a different protocol — arrives as a
 * rejection or as nothing at all. Without somewhere to say so, the row is
 * tapped and the screen simply sits there.
 */
export function onlineChoice(note: string | null = null): ScreenDef {
  return {
    title: 'Play Online',
    sub: (note ?? 'Each player, own device').toUpperCase(),
    back: 'home',
    cols: ['Role', 'State', 'Select', '', 'Notes'],
    rows: padRows([
      {
        label: 'Host',
        status: note === null ? 'New room' : 'Failed',
        text: 'CREATE ROOM',
        amount: '', showDollar: false,
        right: note === null ? 'Seats you now' : 'Try again',
        chip: HOST_CHIP,
        tone: 'normal',
        // Creating seats you immediately — there is no room-setup screen
        // between, which is the Lobby Flow correction.
        action: { kind: 'createRoom' },
      },
      {
        label: 'Guest',
        status: 'Have a code',
        text: 'JOIN WITH CODE',
        amount: '', showDollar: false,
        right: 'Six letters',
        chip: GUEST_CHIP,
        tone: 'normal',
        action: { kind: 'navigate', to: 'joinRoom' },
      },
    ]),
  };
}

/**
 * Board 1f: code first, name second, both on the click-to-input pattern.
 * The name is optional — leaving it asks the server to name the seat.
 */
export function joinRoom(code: string, name: string): ScreenDef {
  const ready = code.length === 6;
  return {
    title: 'Join Room',
    sub: 'ENTER A CODE',
    back: 'online',
    cols: ['Field', 'State', 'Value', '', 'Action'],
    rows: padRows([
      {
        label: 'Room code',
        status: ready ? 'Ready' : 'Required',
        text: code === '' ? 'TAP TO ENTER' : code,
        amount: '', showDollar: false,
        right: 'From the host',
        chip: code === '' ? null : HOST_CHIP,
        tone: code === '' ? 'dim' : 'normal',
        action: { kind: 'edit', field: 'roomCode', placeholder: 'Six letters, press Enter' },
      },
      {
        label: 'Your name',
        status: name === '' ? 'Optional' : 'Ready',
        text: name === '' ? 'TAP TO ENTER' : name,
        amount: '', showDollar: false,
        right: name === '' ? 'Or be seated' : 'Tap to edit',
        chip: name === '' ? null : GUEST_CHIP,
        tone: name === '' ? 'dim' : 'normal',
        action: { kind: 'edit', field: 'joinName', placeholder: 'Optional, press Enter' },
      },
      {
        label: '',
        status: ready ? 'Ready' : 'Waiting',
        text: 'JOIN GAME',
        amount: '', showDollar: false,
        right: ready ? 'Takes a seat' : 'Code first',
        chip: null,
        tone: ready ? 'normal' : 'disabled',
        action: ready ? { kind: 'joinRoom' } : null,
      },
    ]),
  };
}

/**
 * Board 1e: the room, its seats, and the way into the game.
 *
 * The room code is not a row: it renders in the header where the dice
 * otherwise go, big enough to read across a table, and tapping it copies the
 * share link. That is what buys all six seats their rows and START GAME its
 * seventh.
 *
 * `note` is a refusal to show *in* the room — "only the host may begin",
 * a rename the server wouldn't take. The lobby hook deliberately ranks the
 * roster above such messages so a seated player is never thrown back to a
 * join form; the price of that ranking is that the message reaches nobody
 * unless a screen carries it, and this board is that screen. Failure on this
 * wire is opt-in — every channel left unread is a refusal shown to no one.
 */
export function onlineLobby(view: LobbyView, note: string | null = null): ScreenDef {
  const seats: Row[] = view.seats.map((seat) => {
    if (seat.id === null) {
      return {
        label: `Seat ${seat.index + 1}`,
        status: 'Open',
        text: 'WAITING',
        amount: '', showDollar: false,
        right: '',
        chip: null,
        tone: 'dim',
        action: null,
      } satisfies Row;
    }
    return {
      label: `Seat ${seat.index + 1}${seat.isHost ? ' · host' : ''}`,
      // Away rather than gone: a dropped player keeps their seat and the game
      // waits for them, which is what the roster's `connected` means.
      status: seat.connected ? 'Connected' : 'Away',
      text: seat.name ?? '',
      amount: '', showDollar: false,
      right: seat.canRename ? 'Tap to edit' : (seat.isYou ? 'You' : ''),
      chip: chipFor(seat.id),
      tone: seat.connected ? 'normal' : 'dim',
      action: seat.canRename && seat.id !== null
        ? { kind: 'edit', field: `seat:${SEATS.find((s) => s === seat.id)!}`,
            placeholder: 'Type a name, press Enter' }
        : null,
    } satisfies Row;
  });

  const departure: Row = {
    label: '',
    status: view.canBegin ? 'Ready' : (view.beginBlocked ? BEGIN_BLOCKED[view.beginBlocked] : 'Waiting'),
    text: 'START GAME',
    amount: '', showDollar: false,
    right: 'Host only',
    chip: null,
    tone: view.canBegin ? 'normal' : 'disabled',
    action: view.canBegin ? { kind: 'begin' } : null,
  };

  return {
    title: 'New Room',
    // The room code survives a refusal — it is the one thing a player might
    // need to read out loud at any moment.
    sub: `ROOM ${view.code} · ${(note ?? CONNECTION[view.connection]).toUpperCase()}`,
    back: 'home',
    cols: ['Seat', 'Presence', 'Player', '', 'Action'],
    rows: padRows([...seats, departure]),
    code: view.code,
  };
}

/** One explanatory row and one way out. */
function terminal(sub: string, status: string, text: string, right: string): ScreenDef {
  return {
    title: 'Online',
    sub,
    back: 'home',
    cols: ['', 'State', 'What happened', '', 'Action'],
    rows: padRows([
      {
        label: '', status, text,
        amount: '', showDollar: false, right,
        chip: null, tone: 'dim', action: null,
      },
      {
        label: '', status: '', text: 'BACK TO DEPARTURES',
        amount: '', showDollar: false, right: '',
        chip: null, tone: 'normal',
        action: { kind: 'navigate', to: 'home' },
      },
    ]),
  };
}

/**
 * The room is not there. It may have finished, or the server may have been
 * replaced with an empty disk — the lobby splits this from a refused seat
 * precisely because the remedies differ.
 */
export const roomGone = (): ScreenDef =>
  terminal('ROOM GONE', 'Gone', 'THAT ROOM IS NO LONGER RUNNING', 'Start a new one');

/** This client and the server disagree about the protocol. Reloading is the fix. */
export const staleClient = (): ScreenDef => ({
  ...terminal('OUT OF DATE', 'Stale', 'THIS PAGE IS OLDER THAN THE SERVER', 'Reload to update'),
  rows: padRows([
    {
      label: '', status: 'Stale', text: 'THIS PAGE IS OLDER THAN THE SERVER',
      amount: '', showDollar: false, right: 'Reload to update',
      chip: null, tone: 'dim', action: null,
    },
    {
      label: '', status: '', text: 'RELOAD',
      amount: '', showDollar: false, right: '',
      chip: null, tone: 'normal',
      // Its own screen rather than a navigation: nothing in the app can fix a
      // stale bundle, only fetching a new one.
      action: { kind: 'navigate', to: 'home' },
    },
  ]),
});

/** The seat was refused — usually a stored identity that has gone stale. */
export const roomRefused = (message: string | null): ScreenDef =>
  terminal('SEAT REFUSED', 'Refused', (message ?? 'THAT SEAT IS NOT YOURS').toUpperCase(),
           'Join again');
