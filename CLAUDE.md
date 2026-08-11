# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **companion app** for the Avalon Hill board game *Rail Baron*, not an implementation of
it. Players use the physical board; the app rolls each baron's next destination — region,
then city — and looks up the payout for the journey. Nothing else about the game is
modelled: no movement, no railroad ownership, no cash.

The repo holds the React port. The original 2013 jQuery app was deleted once the port
was complete and tested — it remains in git history, but there is only one Rail Baron in
this repo now. [ROADMAP.md](ROADMAP.md) has the phases and the reasoning; Phase 1 (the
roller) is done, Phases 2 and 3 (pass-and-play menu, online multiplayer) are ahead.

## Commands

```bash
npm install
npm run dev        # Vite dev server, http://localhost:5173
npm test            # vitest run — engine/ and src/, once
npm run test:watch  # vitest, watch mode
npm run typecheck   # tsc --noEmit
npm run build        # vite build, production bundle to dist/
npm run preview      # serve the production build locally
```

`engine/` and `src/` run as two separate Vitest projects (`vite.config.ts`): `engine`
under a plain `node` environment, `app` under `jsdom` with `src/test/setup.ts` loaded.
`engine/smoke.test.ts` asserts `window` and `localStorage` are both `undefined` in the
engine project, so a React or DOM dependency creeping into `engine/` fails a test rather
than surviving unnoticed.

## The game data, and its known bugs

Everything the roller needs is under [`engine/`](engine/) — no React, no DOM. The 2013
source it was transcribed from, `js/railbaronv2.js`, no longer exists in the working tree
but is still in git history (`git log --all --full-history -- js/railbaronv2.js`).

- **[`engine/rollTable.ts`](engine/rollTable.ts)'s `CODES`** — a 22-row lookup indexed by
  `rollRow()`, which is one d6 + one d6 + a d2×11. Column 0 gives the region; columns 1–7
  give the city within each region.
- **[`engine/regions.ts`](engine/regions.ts)'s `REGIONS`** — 7 entries.
- **[`engine/cities.ts`](engine/cities.ts)'s `CITIES`** — 7 region groups, 67 cities, each
  with a globally unique `id` 0–66.
- **[`engine/payouts.ts`](engine/payouts.ts)'s `PAYOUT_TABLE`** — a triangular matrix
  indexed `[high][low]` by those global city ids, in thousands.

Each table carries a digest test pinning the transcription — `PAYOUT_TABLE_DIGEST` in
[`engine/payouts.test.ts`](engine/payouts.test.ts), `CODES_DIGEST` in
[`engine/rollTable.test.ts`](engine/rollTable.test.ts) — an FNV-1a hash over every cell.
Range and coverage checks can pass on a transposed or mis-copied value; the digest can't.
If you deliberately change a cell (a real correction, not a transcription fix), recompute
and update the digest constant in the same commit, and say why in the commit message.

Defects carried across from the source rather than reproduced-and-fixed:

- **The two mislabelled city groups are fixed.** Counting `engine/cities.ts`'s `GROUPS`
  array in file order, 1-indexed, the 2013 source labelled the 5th and 6th groups —
  **the group containing Denver, Kansas City, Minneapolis and St. Paul** (actually Plains)
  and **the group containing Billings, Seattle and Spokane** (actually Northwest) — both
  `"South Central"`. The 4th group (Birmingham, Dallas, Houston) genuinely is South
  Central and was labelled correctly; three groups carry the literal string, only two are
  wrong. The port's `engine/cities.ts` uses the correct region for each, so this is not a
  live bug — noted here only because it explains why the 2013 file and the port disagree.
  This exact off-by-one (miscounting which two groups are the wrong ones) has recurred in
  project docs before — if you're editing this again, name the groups by contents as
  above, not only by ordinal.
- **The payout matrix was checked against the source, not against the physical board.**
  The digest tests prove the transcription is faithful to `js/railbaronv2.js`; they cannot
  prove the source itself was ever right. See task-3-report.md for how the comparison was
  done.
- `chooseRegion` (the source's second, unreachable destination-computation path) was
  dropped rather than ported — there is only one path now.

### The `$0` constraint

Minneapolis↔St. Paul and San Francisco↔Oakland are the board's only two zero-paying
journeys — legal destinations, worth nothing to land on. `payoutBetween` returns `0` for
them, a real, displayable amount. This is unrelated to `payout: null`, which means "no
payout applies" (the roll landed on the baron's own home town) and renders as `HOME`
instead of a dollar figure — see `formatMoney` in
[`src/game/SplitFlap.tsx`](src/game/SplitFlap.tsx). Anywhere on this path, `if (payout)`
or `payout || fallback` is a bug: both are falsy-on-zero and would treat a real $0 payout
as if it were the null case. `engine/payouts.test.ts` and
`src/game/SplitFlap.test.tsx` guard this distinction.

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

## Testing notes

**`src/test/setup.ts` bridges jsdom's real `localStorage` onto `globalThis` — do not
delete it, even though it looks like dead weight.** Node 26 ships its own experimental
`globalThis.localStorage`, which returns `undefined` unless the process is started with
`--localstorage-file`. Vitest's `populateGlobal` only copies a jsdom `window` property
onto `global` when that key is *absent* from `global` — and `localStorage` is not absent,
because Node already defined it (however uselessly). So jsdom's genuine `Storage`
implementation never gets bridged through, and Node's stub silently wins. jsdom itself is
fine; this is a Node-version interaction, not a jsdom bug. Every test under `src/` that
touches storage (`src/state/storage.test.ts`, plus anything rendering through
`useGame`/`App`) depends on this bridge running before it; without it they fail in a way
that looks unrelated to storage at all.

## Working notes

- **The branch is `main`.** Renamed from `master` 2026-08-11; `origin/master` is deleted.
  `bugfixes`, `flippy` and `jsfixes` are 2013–2014 leftovers, deliberately kept.
- **The 2013 jQuery app is gone from the working tree.** `index2.html`, `js/`, `css/`, and
  the rest were deleted once the React port had a passing test suite covering the same
  ground; `git log --all --full-history -- <path>` reaches any of it. Two Rail Barons in
  one repo is how the wrong one gets edited, so there is deliberately only one now.
