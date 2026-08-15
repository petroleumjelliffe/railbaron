// server/index.ts
// Boot. Express for /health, socket.io for everything that matters, the
// lobby's handlers and the game's over one connection.
import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import {
  GAME_SERVER_EVENTS, RB_PROTOCOL_VERSION, RB_SAVE_VERSION,
  type LogMessage,
} from '../session/protocol';
import { createLobbyHandlers } from '../vendor/lobby/server/handlers';
import { attachGameHandlers } from './handlers';
import { createRooms, type GameRoom } from './rooms';
import { createFileStore } from './store';

export interface RunningServer {
  port: number;
  close(): Promise<void>;
}

export async function startServer(
  opts: { port: number; gamesDir: string },
): Promise<RunningServer> {
  const app = express();
  app.use(cors());
  // Versions from day one: the client ships to GitHub Pages and the server to
  // Render, independently, so "which halves are these?" has to be answerable
  // without reading a deploy log.
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      protocolVersion: RB_PROTOCOL_VERSION,
      saveVersion: RB_SAVE_VERSION,
    });
  });

  const http = createServer(app);
  const io = new SocketServer(http, { cors: { origin: '*' } });
  const rooms = createRooms(createFileStore(opts.gamesDir));

  const sendLog = (room: GameRoom, to: { emit: (e: string, m: LogMessage) => void }): void => {
    to.emit(GAME_SERVER_EVENTS.log, { roomId: room.id, events: room.log });
  };

  const wiring = createLobbyHandlers<GameRoom>(io, rooms.registry, {
    protocolVersion: RB_PROTOCOL_VERSION,

    onBegin(room) {
      rooms.seedOnBegin(room);
      void rooms.persist(room);
      // The lobby hands Begin to the game and lets it own the send order: the
      // lifecycle has just become 'playing', so the roster goes first and the
      // log that justifies it goes second.
      wiring.broadcastRoster(room);
      sendLog(room, io.to(room.id));
    },

    onSeated(room, playerId) {
      // A joiner or rejoiner needs the game so far, and only they do — the
      // roster already went to everyone. socketsFor narrows it to the sockets
      // actually holding this seat rather than re-broadcasting to the room.
      if (room.log.length === 0) return;
      for (const socket of wiring.socketsFor(room.id, playerId)) sendLog(room, socket);
    },
  });

  const attachGame = attachGameHandlers(io, rooms, wiring);
  io.on('connection', (socket) => {
    wiring.attach(socket);
    attachGame(socket);
  });

  // Boot-only, and before listen: no socket can race the restore because none
  // can connect yet.
  const restored = await rooms.restore();
  if (restored > 0) console.log(`✓ Restored ${restored} room(s)`);

  await new Promise<void>((resolve) => { http.listen(opts.port, resolve); });
  const address = http.address();
  const port = typeof address === 'object' && address !== null ? address.port : opts.port;
  console.log(`Server listening on ${port}`);

  return {
    port,
    async close() {
      // Saves before sockets. Handlers do not await persist, so a room whose
      // last append is still being written would otherwise be restored a move
      // behind — or not at all, if it was its first save.
      await rooms.settled();
      // io.close() disconnects every socket and closes the http server it was
      // attached to. Awaited so a next boot cannot race a half-closed port.
      await new Promise<void>((resolve) => { io.close(() => { resolve(); }); });
    },
  };
}

// Run directly (`tsx server/index.ts`); imported by tests without starting.
const invoked = process.argv[1] ?? '';
if (invoked.endsWith('server/index.ts') || invoked.endsWith('server/index.js')) {
  const port = Number(process.env.PORT ?? 3001);
  const gamesDir = process.env.GAMES_DIR ?? 'server/games';
  void startServer({ port, gamesDir });
}
