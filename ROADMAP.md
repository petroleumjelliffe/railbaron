# Rail Baron — roadmap

A destination-roller companion for the Avalon Hill board game *Rail Baron*. You play on
the physical board; the app rolls destinations, computes payouts, and shows the network.

## Phase 0 — map data

Convert the printed map into a graph. Done in a one-off editor that runs against a scan of
the board: cities, movement dots, and junctions as nodes; track between them as edges,
each attributed to one or more of the 28 railroads.

- [x] Detect and hand-clean the point set — 471 dots, 67 cities, 12 junctions
- [x] Trace every railroad's route
- [x] Find the missing 67th city — Minneapolis, by elimination in the registration
- [x] Attach names and regions to city nodes — `data/city-names.json`, all 67
      confirmed against `engine/cities.ts`
- [x] Validate: no dead-end dots, no orphan edges, one connected component
- [x] Fit the scan→lat/lon warp so every node has real coordinates —
      `npm run network:build`

**Phase 0 is done.** `data/rail-baron-graph.json` (scan pixel space, hand-verified)
plus `data/city-names.json` (names and regions, keyed by node id) build into
`src/data/network.json` — 550 nodes in WGS84 degrees, each city carrying the
`cityId` that indexes [`engine/cities.ts`](engine/cities.ts), so the map and the
roller agree about what a destination is without matching strings at runtime.

The warp is a thin-plate spline over the 67 cities, fitted scan→Albers so the
spline corrects only the drawing's distortions rather than also learning the
projection; lat/lon comes back by inverting Albers. Control points are
reproduced to 3e-12°. `src/data/network.test.ts` re-checks the build's output
against the real engine module — the build reads city ids by parsing
`engine/cities.ts`, which it cannot import, so the test is what makes a drifting
parse fail rather than ship.

## Phase 1 — the React port

Replace the 2013 jQuery app. Same game, redesigned board, plus the map.

- [x] Vite + React + TypeScript, tablet landscape
- [x] Departures-board UI: split-flap rows, region ballot on a same-region roll, naming.
      Rebuilt in Phase 2 as one board driven by screen definitions — see below
- [x] Map as a second view: real US geometry, one lamp per real dot, cities tinted by
      region, track drawn in each railroad's own colour. Reached from the last row of the
      in-play board. Each baron's destination and the city they set out from light in
      their colour — no path is drawn between them, because which route a baron takes
      depends on the railroads they can use and this app does not model that
- [x] Game logic ported from [`engine/`](engine/) — roll tables, 67 cities, payout matrix —
      with the two mislabelled regions fixed. The source it was transcribed from,
      `js/railbaronv2.js`, lived at the repo root and was deleted once the port had a
      passing test suite covering the same ground; it's still reachable in git history.

The roller — departures board plus the ported game logic — is done. Scope for it was the
roller only: no movement, no railroad ownership, no cash. The graph carries dot counts and
railroad attribution anyway, so those can be layered on without redoing the extraction.

## Phase 2 — pass-and-play menu — done

A front door: start a game, pick how many barons, name them, resume a game in progress.

Landed as **board-as-lobby** rather than as a menu bolted onto the roller. The split-flap
board is the whole interface, and every screen — home, setup, saved games, discard confirm,
play, region ballot — is a `ScreenDef` in [`src/board/screens/`](src/board/screens/)
rendered by one `Board`. Adding a screen means adding a definition, not a component, and
the flap animation is written once in `useFlap` instead of per screen. The original
`SplitFlap`/`DeparturesRow`/`DeparturesBoard`/`RegionBallot` components were retired in the
process; they are in git history.

Saved games carry an age and migrate from the v1 record shape, so an in-progress game
survives the upgrade rather than being silently dropped.

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
- Game components under **`src/board/`** (the extraction design says `src/game/`; the name
  moved in Phase 2, the separation it was asking for did not)
- **State derived by replaying an event log**, not mutated in place
- **Namespaced `localStorage` keys** — both games will share the GitHub Pages origin

The lobby is turn-agnostic by design: it knows seats, tokens, lifecycle and presence,
never turns or timing. A roller with no turn order at all sits on it unchanged.
