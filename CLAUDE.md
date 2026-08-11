# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **companion app** for the Avalon Hill board game *Rail Baron*, not an implementation of
it. Players use the physical board; the app rolls each baron's next destination — region,
then city — and looks up the payout for the journey. Nothing else about the game is
modelled: no movement, no railroad ownership, no cash.

The repo currently holds the 2013 jQuery version. It is being replaced by a React port;
[ROADMAP.md](ROADMAP.md) has the four phases and the reasoning.

## Commands

**There is no build system yet.** No `package.json`, no tests, no lint. The old app is
static files — open `index2.html` directly, or serve the directory.

Phase 1 introduces Vite + React + TypeScript. Until it lands, don't invent commands or
assume a toolchain exists.

## The game data, and its known bugs

Everything the roller needs is in [js/railbaronv2.js](js/railbaronv2.js) — one 583-line
file, no modules, IIFE singleton:

- **`codes`** — a 22-row lookup indexed by `roll()`, which is one d6 + one d6 + a d2×11.
  Column 0 gives the region; columns 1–7 give the city within each region.
- **`regions`** — 7 entries, `index` is 1-based and is what indexes into `cities`.
- **`cities`** — 7 region groups, 67 cities, each with a globally unique `index` 0–66.
- **`payouts`** — a triangular matrix indexed `payouts[high][low]` by those global city
  indices, in thousands.

Three defects to carry across rather than reproduce:

- **`cities[4]` and `cities[5]` are labelled `"South Central"`** and should be Plains and
  Northwest ([js/railbaronv2.js:260](js/railbaronv2.js#L260) and
  [:274](js/railbaronv2.js#L274)). `cities[3]` is genuinely South Central and `cities[6]`
  is already correctly `"Southwest"` — three groups carry the label, only two wrongly.
  The current app gets away with it because region names are read from `regions`, not from
  the city groups — anything reading the city list directly is wrong.
- **The payout matrix has never been checked against the board.** A single transposed
  number is invisible until it pays someone the wrong amount. Verify before trusting.
- `player.chooseRegion` and `RailBaronController.newDestination` both compute destinations,
  by different routes. Only the latter is reachable.

## The map graph

Phase 0 converts the printed map into a graph. Three node kinds, and the distinction is
the cost model:

| On the board | In the data | Costs a move |
|---|---|---|
| White square, black stroke | `city` | yes |
| Plain black dot, no stroke | `dot` | yes |
| Nothing — the line simply forks | `junction` | **no** |

So path cost is the count of `dot` nodes traversed; junctions fall out for free with no
special case. Edges are undirected adjacency between *neighbouring* nodes, carrying the
list of railroads running over them — shared trackage is one edge with several railroads,
not parallel edges.

**Junctions do two jobs, and only one of them is forking.** Three or more edges means a
fork. Exactly two means a *bend point*, placed to shape the drawn route — a coastal line
needs them to follow the shore instead of cutting across water. Both are free, so neither
affects movement; a two-edge junction is correct data, not an unfinished fork.

**Node ids are positional and load-bearing.** `d12` means index 12 in the editor's dots
array *including rejected entries*, so ids stay stable when a point is rejected. Never
renumber; a rejected endpoint orphans its edges rather than silently repointing them.

Coordinates in `data/` are **scan pixel space, 1280×642**. The build step fits a
scan→lat/lon warp from the 67 city correspondences and pushes every node through it, so
the shipped data is real geography while the printed map's actual route shapes survive —
one rendered bulb per real dot, at its real place.

### The editor is not in this repo

The one-off tool that produced the graph lives in the **Rail Baron Game Board Design**
project on claude.ai/design, alongside the board concepts it was designed from. It runs
against a scan of the map and holds its working state in browser `localStorage` plus
`graph-base.json` in that project. Don't go looking for it here, and don't rebuild it —
ask before changing it.

The design project also holds the visual direction the port is built to: a departures-board
split-flap treatment for the main screen, and a lightbulb-map treatment for the map view.

## What Phase 1 owes Phase 3

Online multiplayer will consume the lobby extracted from the sibling repo
[`acquire-startups-m1`](../acquire-startups-m1), whose extraction design names this repo
as its intended second consumer. That lobby plugs into a particular shape, so the port
adopts it from the start rather than refactoring into it:

- A pure **`engine/`** at the top level, no React
- Game components under **`src/game/`**
- **State derived by replaying an event log**, not mutated in place
- **Namespaced `localStorage` keys** — both games share the GitHub Pages origin

That repo's `CLAUDE.md` carries the house conventions this one inherits. Two that bind
hardest: derive every displayed value from replayed state rather than hardcoding it, and
prove a new test can fail by breaking the code and reading real output — never by reading
the assertion.

## Working notes

- **The branch is `main`.** Renamed from `master` 2026-08-11; `origin/master` is deleted.
  `bugfixes`, `flippy` and `jsfixes` are 2013–2014 leftovers, deliberately kept.
- **`Untitled.html`, `testlayout.html`, `savegame.js` and `railbaronv2.min.js` are dead.**
  Layout experiments and a stale build; nothing references them. `index2.html` is the live
  app, and root-level `styles.css` is not the stylesheet it loads (that's `css/styles2.css`).
- **Don't treat `railbaronv2.min.js` as a reference for the source.** It is an older
  variant, not a build of the current file: its `codes` table holds 1-based region indices
  read as `regions[n-1]`, where [js/railbaronv2.js](js/railbaronv2.js) holds 0-based ones
  read as `regions[index]`. Diffing the two to settle a question gives a wrong answer.
- The old jQuery files get **deleted** when the port lands rather than left alongside —
  git history keeps them, and two Rail Barons in one repo is how the wrong one gets edited.
