# Rail Baron — roadmap

A destination-roller companion for the Avalon Hill board game *Rail Baron*. You play on
the physical board; the app rolls destinations, computes payouts, and shows the network.

## Phase 0 — map data

Convert the printed map into a graph. Done in a one-off editor that runs against a scan of
the board: cities, movement dots, and junctions as nodes; track between them as edges,
each attributed to one or more of the 28 railroads.

- [x] Detect and hand-clean the point set — 475 dots, 66 cities, 12 junctions
- [x] Trace every railroad's route
- [ ] Find the missing 67th city
- [ ] Attach names and regions to city nodes
- [ ] Validate: no dead-end dots, no orphan edges, one connected component
- [ ] Fit the scan→lat/lon warp so every node has real coordinates

Output is `data/rail-baron-graph.json` (scan pixel space, hand-verified) built into
`src/data/network.json` (lat/lon, named, validated).

## Phase 1 — the React port

Replace the 2013 jQuery app. Same game, redesigned board, plus the map.

- Vite + React + TypeScript, tablet landscape
- Departures-board UI: six player rows of split-flap, region ballot on a same-region roll,
  tap-to-join-and-name signup
- Map as a second view: real US geometry, one bulb per real dot, region and city blink
  choreography on a roll
- Game logic ported from `js/railbaronv2.js` — roll tables, 67 cities, payout matrix —
  with the two mislabelled regions fixed

Scope is the roller only. No movement, no railroad ownership, no cash. The graph carries
dot counts and railroad attribution anyway, so those can be layered on without redoing
the extraction.

## Phase 2 — pass-and-play menu

A front door: start a game, pick how many barons, name them, resume the game in progress.
Currently the app drops you straight into a board with six colour-named seats.

## Phase 3 — online multiplayer

Reuse the lobby from [`acquire-startups-m1`](../acquire-startups-m1) rather than building
one. That repo extracted its lobby — rooms, seats, join/rejoin tokens, presence, rename,
leave, and the screens around them — into a game-agnostic piece specifically so the next
game could consume it, and its design names this repo as the intended second consumer.

**This is "the lift"** described in
`acquire-startups-m1/docs/superpowers/specs/2026-08-08-generic-lobby-extraction-design.md`:
when Rail Baron is ready for online, the three lobby directories (`lobby/`,
`server/lobby/`, `src/lobby/`) move out of that repo into a shared home and both games
point at it. Leading candidate is shared TypeScript source via git — both repos are
Vite+TS and compile the source directly, so two consumers with one owner need no publish
pipeline. The final call is made at the lift.

Decisions that repo deliberately deferred to this one, to make when we get there:

- **Hosting** — a second Render service is a second paid instance; the alternative is both
  games' servers in one process
- **Honor-reclaim policy** — whether same-name seat capture fits this game's trust model
- **Game-flavoured rejection codes** — `notYourTurn`, `wrongStage`, `unknownIntent` are
  wire-level names that a turn-agnostic lobby shouldn't have

### What Phase 1 owes Phase 3

The lobby plugs into a particular shape, so the port adopts it from the start rather than
refactoring into it later:

- A pure **`engine/`** with no React
- Game components under **`src/game/`**
- **State derived by replaying an event log**, not mutated in place
- **Namespaced `localStorage` keys** — both games will share the GitHub Pages origin

The lobby is turn-agnostic by design: it knows seats, tokens, lifecycle and presence,
never turns or timing. A roller with no turn order at all sits on it unchanged.
