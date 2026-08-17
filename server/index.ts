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

  // `listen` reports failure by emitting 'error', not by throwing, and an
  // unhandled 'error' on a server takes the process down with a stack trace
  // that buries the one useful word in it. Surfacing it as a rejection lets
  // the caller say something a person can act on.
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(opts.port, () => {
      http.off('error', reject);
      resolve();
    });
  });
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
  // `.env.local` is where a developer moves the port off 3001, which the
  // sibling Acquire server also defaults to. The client reads it through Vite;
  // the server has no bundler to do that for it, so it loads the same file
  // itself — one place to set the port, and both halves agree without anyone
  // having to remember an env prefix on the command line.
  //
  // VITE_SERVER_PORT is a bundler-flavoured name for a variable this process
  // also reads, and that is the point: the two halves must not be able to
  // disagree about which port they mean.
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // No such file is the ordinary case, not an error.
  }

  // 4001 is Rail Baron's slot in the cross-game registry (the game-host
  // repo's PORTS.md).
  // Must agree with src/config.ts's DEFAULT_SERVER_PORT, or a client with no
  // env at all derives a port nothing is listening on.
  const port = Number(process.env.PORT ?? process.env.VITE_SERVER_PORT ?? 4001);
  const gamesDir = process.env.GAMES_DIR ?? 'server/games';

  startServer({ port, gamesDir }).then((server) => {
    // close() has always known how to drain in-flight saves (rooms.settled(),
    // so the last move's write lands before the process dies) — but until
    // here nothing called it on the signals that actually stop a server:
    // SIGTERM from launchd/`brew services stop`, SIGINT from Ctrl-C. A
    // second signal skips the drain — if close() is wedged, the way out
    // should not be `kill -9`.
    let closing = false;
    const stop = (): void => {
      if (closing) process.exit(1);
      closing = true;
      void server.close().then(() => { process.exit(0); });
    };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
  }).catch((error: unknown) => {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'EADDRINUSE') {
      console.error(
        `\n✗ Port ${port} is already in use — something is listening there.\n\n`
        + '  Find it:   lsof -nP -iTCP:' + String(port) + ' -sTCP:LISTEN\n'
        + '  Or move:   set VITE_SERVER_PORT in .env.local to a free port, which\n'
        + '             moves this server and the client together.\n\n'
        + '  The cross-game port registry is the game-host repo\'s PORTS.md.\n',
      );
      process.exit(1);
    }
    console.error('✗ The server failed to start:', error);
    process.exit(1);
  });
}
