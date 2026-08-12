railbaron
=========

A destination-roller companion for the Avalon Hill board game *Rail Baron*. You play on
the physical board; the app rolls each baron's next destination and works out the payout.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
```

Built for a tablet in landscape, and deployed to GitHub Pages on every push to
`main` — the suite and the typecheck gate the deploy, because a companion that
is wrong about a payout is worse than one that is down.

**v1.0.0 is the companion release.** You play Rail Baron on the physical board;
this rolls each baron's destination, works out what the journey pays, and shows
the network. It does not model movement, railroad ownership or cash — see
[ROADMAP.md](ROADMAP.md) for what comes next.
