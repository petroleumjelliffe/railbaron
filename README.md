railbaron
=========

A destination-roller companion for the Avalon Hill board game *Rail Baron*. You play on
the physical board; the app rolls each baron's next destination and works out the payout.

```bash
npm install
git submodule update --init --recursive   # vendor/lobby, needed by the server

npm run dev        # client only, http://localhost:7931/railbaron/
npm run dev:all    # client + game server, for online mode
npm test
```

Online mode needs both halves running. Ports come from the cross-game registry in
the sibling `game-host` repo's `PORTS.md` — Rail Baron's slots are server 4001,
dev client 7931. To move the server port for a one-off, put `VITE_SERVER_PORT=<port>` in
`.env.local` (gitignored) and start normally; client and server read the same file,
so the halves cannot disagree.

One file, both halves: Vite hands the port to the client, and the server loads the
same file itself, so there is no env prefix to remember and no way for the two to
disagree. `PORT` still overrides it for a one-off.

The client works out the server's address from the page it was loaded from —
`http://<hostname>:<port>` — using the hostname rather than `localhost` so a phone
on the same wifi reaches the dev server on your machine instead of looking for one
on the phone. `VITE_SERVER_PORT` moves only the port and keeps that; a full
`VITE_SERVER_URL` replaces the lot, and is what production sets.

Built for a tablet in landscape, and deployed to GitHub Pages on every push to
`main` — the suite and the typecheck gate the deploy, because a companion that
is wrong about a payout is worse than one that is down.

**v1.0.0 is the companion release.** You play Rail Baron on the physical board;
this rolls each baron's destination, works out what the journey pays, and shows
the network. It does not model movement, railroad ownership or cash — see
[ROADMAP.md](ROADMAP.md) for what comes next.
