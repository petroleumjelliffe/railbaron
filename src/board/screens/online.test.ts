import { describe, expect, it } from 'vitest';
import { lobbyView, type LobbySnapshot } from '../../../vendor/lobby/client/view';
import { BOARD_ROWS } from '../types';
import { joinRoom, onlineChoice, onlineLobby, roomGone } from './online';

const LIMITS = { capacity: 6, minPlayers: 2 };

const snapshot = (over: Partial<LobbySnapshot> = {}): LobbySnapshot => ({
  phase: 'lobby',
  status: 'open',
  playerId: 'red',
  roster: {
    roomId: 'ABC234',
    lifecycle: 'lobby',
    players: [
      { id: 'red', name: 'ADA', isHost: true, connected: true },
      { id: 'green', name: 'BEN', isHost: false, connected: true },
    ],
  },
  ...over,
});

const view = (over: Partial<LobbySnapshot> = {}) => lobbyView(snapshot(over), LIMITS);

describe('the online choice board (1d)', () => {
  it('is seven rows like every other screen', () => {
    expect(onlineChoice().rows).toHaveLength(BOARD_ROWS);
  });

  it('offers exactly the two ways in, and no code entry', () => {
    const { rows } = onlineChoice();
    expect(rows[0]!.text).toBe('CREATE ROOM');
    expect(rows[0]!.action).toEqual({ kind: 'createRoom' });
    expect(rows[1]!.text).toBe('JOIN WITH CODE');
    expect(rows[1]!.action).toEqual({ kind: 'navigate', to: 'joinRoom' });
    // The rest of the board is blank — the code is typed on 1f, not here.
    expect(rows.slice(2).every((r) => r.action === null && r.text === '')).toBe(true);
  });

  it('carries the approved copy for each row', () => {
    const { rows } = onlineChoice();
    expect(rows[0]!.label).toBe('Host');
    expect(rows[0]!.status).toBe('New room');
    expect(rows[0]!.right).toBe('Seats you now');
    expect(rows[1]!.label).toBe('Guest');
    expect(rows[1]!.status).toBe('Have a code');
    expect(rows[1]!.right).toBe('Six letters');
  });

  it('says so when creating a room fails, and keeps the row tappable', () => {
    // The bug this guards: the create flow ignored the rejected channel, so a
    // version mismatch or a dead server produced no change on screen at all.
    const refused = onlineChoice('Server speaks a different protocol');
    expect(refused.sub).toBe('SERVER SPEAKS A DIFFERENT PROTOCOL');
    expect(refused.rows[0]!.status).toBe('Failed');
    expect(refused.rows[0]!.right).toBe('Try again');
    expect(refused.rows[0]!.action).toEqual({ kind: 'createRoom' });
  });

  it('reads normally when nothing has gone wrong', () => {
    expect(onlineChoice().sub).toBe('EACH PLAYER, OWN DEVICE');
  });
});

describe('the join board (1f)', () => {
  it('is seven rows', () => {
    expect(joinRoom('', '').rows).toHaveLength(BOARD_ROWS);
  });

  it('asks for the code first and will not join without six characters', () => {
    const empty = joinRoom('', '');
    expect(empty.rows[0]!.action).toEqual({
      kind: 'edit', field: 'roomCode', placeholder: 'Six letters, press Enter',
    });
    expect(empty.rows[0]!.status).toBe('Required');
    expect(empty.rows[2]!.action).toBeNull();
    expect(empty.rows[2]!.right).toBe('Code first');

    const ready = joinRoom('ABC234', '');
    expect(ready.rows[0]!.status).toBe('Ready');
    expect(ready.rows[2]!.action).toEqual({ kind: 'joinRoom' });
    expect(ready.rows[2]!.right).toBe('Takes a seat');
  });

  it('offers a name, optional, with the server naming the seat otherwise', () => {
    const anonymous = joinRoom('ABC234', '');
    expect(anonymous.rows[1]!.status).toBe('Optional');
    expect(anonymous.rows[1]!.right).toBe('Or be seated');
    expect(anonymous.rows[1]!.action).toEqual({
      kind: 'edit', field: 'joinName', placeholder: 'Optional, press Enter',
    });

    const named = joinRoom('ABC234', 'KIT');
    expect(named.rows[1]!.text).toBe('KIT');
    expect(named.rows[1]!.status).toBe('Ready');
    expect(named.rows[1]!.right).toBe('Tap to edit');
  });

  it('no longer offers a room of its own — that moved to the choice board', () => {
    const { rows } = joinRoom('', '');
    expect(rows.every((r) => r.action?.kind !== 'createRoom')).toBe(true);
  });
});

describe('the room board (1e)', () => {
  it('is seven rows like every other screen', () => {
    expect(onlineLobby(view()).rows).toHaveLength(BOARD_ROWS);
  });

  it('hands the room code to the header readout, not a row', () => {
    const screen = onlineLobby(view());
    expect(screen.code).toBe('ABC234');
    expect(screen.rows.every((r) => r.text !== 'ABC234' && r.right !== 'ABC234')).toBe(true);
  });

  it('renders a row per seat, all six, with the empty ones dim and waiting', () => {
    const { rows } = onlineLobby(view());
    expect(rows.slice(0, 2).map((r) => r.text)).toEqual(['ADA', 'BEN']);
    expect(rows.slice(2, 6).map((r) => r.text)).toEqual(['WAITING', 'WAITING', 'WAITING', 'WAITING']);
    expect(rows[2]!.tone).toBe('dim');
    expect(rows[2]!.action).toBeNull();
  });

  it('colours each seat by the colour its id already is', () => {
    const { rows } = onlineLobby(view());
    expect(rows[0]!.chip).toBe('#e02b1d');   // red
    expect(rows[1]!.chip).toBe('#5fbb2e');   // green
  });

  it('names the host on their seat label', () => {
    const { rows } = onlineLobby(view());
    expect(rows[0]!.label).toBe('Seat 1 · host');
    expect(rows[1]!.label).toBe('Seat 2');
  });

  it('marks a dropped baron away rather than removing them', () => {
    const { rows } = onlineLobby(view({
      roster: {
        roomId: 'ABC234', lifecycle: 'lobby',
        players: [
          { id: 'red', name: 'ADA', isHost: true, connected: true },
          { id: 'green', name: 'BEN', isHost: false, connected: false },
        ],
      },
    }));
    expect(rows[1]!.status).toBe('Away');
    expect(rows[1]!.text).toBe('BEN');
  });

  it('offers START GAME to the host once there are enough barons', () => {
    const departure = onlineLobby(view()).rows[6]!;
    expect(departure.text).toBe('START GAME');
    expect(departure.status).toBe('Ready');
    expect(departure.right).toBe('Host only');
    expect(departure.action).toEqual({ kind: 'begin' });
  });

  it('says why it cannot start yet', () => {
    const alone = onlineLobby(view({
      roster: {
        roomId: 'ABC234', lifecycle: 'lobby',
        players: [{ id: 'red', name: 'ADA', isHost: true, connected: true }],
      },
    })).rows[6]!;
    expect(alone.text).toBe('START GAME');
    expect(alone.status).toBe('Need 2 barons');
    expect(alone.action).toBeNull();
  });

  it('does not offer START GAME to a player who is not the host', () => {
    const guest = onlineLobby(view({ playerId: 'green' })).rows[6]!;
    expect(guest.status).toBe('Host starts');
    expect(guest.action).toBeNull();
  });

  it('lets you edit your own seat and nobody else’s', () => {
    const { rows } = onlineLobby(view());
    expect(rows[0]!.action).toEqual({
      kind: 'edit', field: 'seat:red', placeholder: 'Type a name, press Enter',
    });
    expect(rows[1]!.action).toBeNull();
  });
});

describe('the terminals', () => {
  it('say what happened and offer a way out', () => {
    const gone = roomGone();
    expect(gone.rows[0]!.text).toBe('THAT ROOM IS NO LONGER RUNNING');
    expect(gone.rows[1]!.action).toEqual({ kind: 'navigate', to: 'home' });
    expect(gone.rows).toHaveLength(BOARD_ROWS);
  });
});

describe('the room board when the server refuses something', () => {
  it('carries the refusal, and keeps the room code beside it', () => {
    // The lobby hook ranks the roster above refusal messages so a seated
    // player is never thrown back to a join form — which means the message
    // reaches nobody unless this board shows it.
    const refused = onlineLobby(view(), 'only the host may begin the game');
    expect(refused.sub).toBe('ROOM ABC234 · ONLY THE HOST MAY BEGIN THE GAME');
  });

  it('reads as the connection state when nothing has been refused', () => {
    expect(onlineLobby(view()).sub).toBe('ROOM ABC234 · LIVE');
  });
});
