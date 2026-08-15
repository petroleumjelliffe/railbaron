railbaron
=========

A destination-roller companion for the Avalon Hill board game *Rail Baron*. You play on
the physical board; the app rolls each baron's next destination and works out the payout.

```bash
npm install
git submodule update --init --recursive   # vendor/lobby, needed by the server

npm run dev        # client only, http://localhost:5173
npm run dev:all    # client + game server, for online mode
npm test
```

Online mode needs both halves running. `npm run dev:server` starts the game server
on port 3001 by default (`PORT` overrides it — the sibling Acquire server uses the
same port, so set one if you run both). The client points at
`http://<hostname>:3001` unless `VITE_SERVER_URL` says otherwise; the hostname
rather than `localhost` so a phone on the same wifi can reach a dev server here.

Built for a tablet in landscape, and deployed to GitHub Pages on every push to
`main` — the suite and the typecheck gate the deploy, because a companion that
is wrong about a payout is worse than one that is down.

**v1.0.0 is the companion release.** You play Rail Baron on the physical board;
this rolls each baron's destination, works out what the journey pays, and shows
the network. It does not model movement, railroad ownership or cash — see
[ROADMAP.md](ROADMAP.md) for what comes next.
