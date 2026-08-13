# Scenarios — design

**Date:** 2026-08-13
**Status:** Design agreed; **implementation deliberately deferred** — see Sequencing
**Covers:** A dev-only route that seeds a named game state, so a by-hand pass reaches an
interesting position in one click

## What and why

Driving Rail Baron by hand means playing to the state you want to look at. During the
board-as-lobby pass, reaching the region ballot took **ten rolls** before the attempt was
abandoned and `localStorage` hand-edited to force a `regionRequested` event. That is the
whole problem: the interesting states are behind dice.

A scenario is a named starting position you can be *in* with one click, and then play on
from for real.

**This is a dev affordance, not a rules spec.** Acquire's golden games G1–G17 exist because
its merger rules are genuinely hard and no unit test pins them; Rail Baron's engine is roll
tables, 67 cities and a payout matrix, already covered by its own tests. The value here is
reaching states cheaply, not asserting them.

## Not a shared module

Acquire has the same idea in `engine/golden/` and `src/game/catalog/`, and it was considered
as a second submodule alongside the lobby. It is not one.

Measured: `engine/golden/` is 1814 lines and `src/game/catalog/` another 1263, and almost
none of it is game-agnostic. A golden game's `StateAssertion` names `cash`, `shares`,
`chainSize`, `founded`, `availableShares`, `boardOwner`, `finalScoreTotals` — every field an
Acquire noun. Its runner imports `applyIntent`, `getStartupSize`, `getCurrentActor`,
`finalScore`. Strip the Acquire concepts out and what remains is a pattern of roughly thirty
lines, which is the least valuable part; sharing a thirty-line function across two repos
costs more than writing it twice.

Contrast the lobby, which *was* worth extracting: rooms, seats, tokens and presence mean the
same thing in both games. `chainSize` does not exist in Rail Baron at all.

**So: the pattern is copied, the code is not.**

## Sequencing — why this is spec-only for now

`feat/turns-and-movement` is 15 commits ahead and touches `src/state/events.ts`,
`src/state/game.ts` and `src/state/useGame.ts` — the three files this design changes.

More than a merge conflict: scenario *data* encodes event shapes. New event types, or new
fields on `arrived`, make hand-authored scenarios stale — and because `loadLog` applies
`isGameEvent` all-or-nothing, a stale scenario fails as an **empty board with no error
anywhere**, not as a loud break.

**Build this after turns-and-movement merges**, against a settled event model. The spec ages
far more slowly than the data would.

## A scenario is a `GameEvent[]`

`replay(events)` is the whole state, so a scenario needs no new representation. It is a named
event log.

But not written as literals. Authored through builders that derive everything derivable:

```ts
scenario('ballot', 'A baron rolls its own region', [
  join('red', 'ADA'),
  join('blue', 'MARGO'),
  start(),
  arrive('red', 'Chicago'),   // region and payout derived
  rollsOwnRegion('red'),      // reads the seat's current region
]);
```

| Builder | Derives |
|---|---|
| `join(seat, name)` | — |
| `start()` | — |
| `arrive(seat, cityName)` | the `CityId` and `region` from `CITIES`; the `payout` from `payoutBetween(previous, next)`, or `null` when the seat has no previous stop |
| `rollsOwnRegion(seat)` | the `region` from where that seat currently is |

**Why builders rather than literals.** The raw form carries a trap:

```ts
{ type: 'arrived', seat: 'red', city: 20, region: 'SW', payout: 4500 }
```

City 20 is Chicago, which is in `NC`. `isGameEvent` checks
`cityById(city).region === region` and rejects this — and `loadLog` is all-or-nothing, so the
*entire* scenario comes back empty. Deriving the region from the city makes that
unrepresentable rather than merely caught. An unknown city name throws where it is written.

This is the project's "derive from the engine, never hardcode" rule applied to fixtures.

## Running one is ephemeral

`useGame` currently seeds from `loadLog()` at mount and persists on every change. A scenario
must not touch the one saved game per device — Acquire's equivalent screen says so on itself:
*"nothing you do here is saved."*

So `useGame` gains one optional argument:

```ts
useGame(rng?: Rng, options?: { initial?: GameEvent[]; persist?: boolean })
```

- `initial` seeds instead of `loadLog().events`
- `persist: false` skips the save effect

Two small changes, and scenarios then *cannot* clobber a real game.

**The alternative was a scenario page owning its own state** and duplicating the roll
handlers. Rejected: the point is to exercise the real screen through the real hook, and a
second copy of `activate`/`chooseRegion` would drift from the first.

## Routes and stripping

`/scenarios` lists them; picking one seeds and shows the board, playing on for real — the same
`Board`, the same `useGame`, real dice.

**Dev-only**, matching Acquire's ruling (2026-08-08): an `import.meta.env.DEV` guard in
`App.tsx` so neither the route nor the scenario data is emitted into a production chunk, plus
a bundle check grepping `dist/` for a scenario title, mirroring Acquire's `check:bundle`.

Rail Baron's `ROUTES` array is exact-match, so `/scenarios` and `/scenarios/:id` join it — and
the array must stay honest about what exists in each build.

## Testing

One test replays **every** scenario through `saveLog`/`loadLog` and asserts the events survive
and `replay()` reaches the state the scenario claims.

That is the test that matters, because it converts the silent failure into a loud one: a
scenario whose data has gone stale against a changed event model stops being an empty board
and starts being a red suite.

It must be proven to fail — corrupt one scenario's region and confirm the test goes red rather
than the log quietly emptying.

## Deliberately not included

- **Capturing scenarios from play.** A "copy the current log" control would remove the
  authoring cost entirely, and was the recommended option; hand-authoring was chosen instead
  (owner, 2026-08-13) because a written log reads as a spec and lets an exact edge case be
  crafted rather than fished for. Worth revisiting if authoring proves tedious in practice.
- **Golden-game assertions.** Scenarios reach states; they do not pin rules. If Rail Baron's
  rules ever get hard enough to need that, it is a separate design.
- **A `/catalog` route.** Acquire's every-component-state surface is a good discipline and a
  separate piece of work, over a different component set.
