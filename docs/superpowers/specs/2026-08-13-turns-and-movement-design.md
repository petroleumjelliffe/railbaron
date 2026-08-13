# Turns and movement — design

**Date:** 2026-08-13
**Status:** Agreed
**Covers:** the first spec of Phase 4 in [ROADMAP.md](../../../ROADMAP.md)
**Source of rules:** the Avalon Hill rulebook. Every number and rule below is quoted
from it, not recalled — which matters, because a referee that is subtly wrong ruins games
in ways a companion never could.

The PDF is deliberately **not committed**: this repository is public, and the rulebook is
Avalon Hill's. Keep a copy locally (it is git-ignored as `rail_baron.pdf`) and quote what
you need into specs, as this one does.

## What this is

v1.0.0 shipped a *companion*: it rolls each baron's destination, works out the payout,
and draws the network. The game itself happens on the table.

This spec begins Phase 4, where the app models the game rather than assisting it. It
covers the first half of that: **turn order and movement**. A baron rolls, walks their
pawn along the map by tapping, and the app enforces the rules of movement while they do.

**Scope ruling.** Phase 4 is four subsystems — turns, movement, money, winning — and
designing them as one document would produce something too vague to build. This spec is
turns and movement only.

## What it deliberately leaves out

- **Cash, purchases and the auction.** The next spec.
- **User fees.** Also the next spec — but fees are settled at end of turn and depend on
  *which companies a turn used*, so this spec records exactly that and charges nothing.
  The seam is deliberate: movement produces the fact, money prices it.
- **The win condition.** It needs cash.
- **Anything online.** Phase 3 is unchanged and unblocked by this.

## The rules, as the book states them

| Rule | The book |
|---|---|
| Movement | Two white dice, summed. |
| Bonus die | One coloured die, rolled **once**. Earned when: no train and you rolled double six; an **EXPRESS** and you rolled any double; a **SUPERCHIEF** — every turn. "A player can get no more than one Bonus Roll per turn." If entitled, he **must** take it. |
| Trains | Freight to start. EXPRESS $4,000, SUPERCHIEF $40,000. There is no Fast Freight. |
| Must move | "A player must always move the full number of dots that he rolls, whether he wants to or not, until he arrives at his destination city." |
| Arrival | "As soon as his pawn reaches its destination city, it must stop immediately — any extra movement is just lost." |
| Reuse | "Each section of rail can be used only once per trip." The pawn may pass through the same dots again, and even move between the same two dots again, **as long as it uses a different rail line**. Everything is released on arrival. |
| Changing line | "A player may change rail lines any number of times, but he can change rail lines **only at a dot**." At an intersection that is not a dot, a token may stay on the same company's line but "may never switch from a rail line of one company to the rail line of another company except at a dot." |
| Stranding | If moving to a particular dot would mean the pawn could not reach its destination without going over the same section twice, "the pawn cannot move to that particular dot — it must move to some other dot." |
| Cost | "Cities (black squares) count as dots; each pair of twin cities (Oakland–San Francisco, Minneapolis–St. Paul) count as one dot for the pair." |
| Turn order | "The players roll to see who goes first, the high roll" — then to the left, clockwise. |
| Home city | Rolled from the destination table before play. "If two players roll the same home city, the second player must roll again — no players can have the same home city." |
| Bonus after arrival | If the pawn arrived during the normal turn, the player rolls a **new destination** and uses the Bonus Roll to start the next trip. |

### A bug this surfaces in the shipped app

`rollDestination` knows nothing about other seats, so v1.0.1 will hand two barons the
same home city. The rules forbid it. Fixing it is in scope here because home cities are
where pawns start.

## The shape of a turn

```
roll ──► tap out a route ──► commit ──► watch it play back
             ▲      │
             └ undo ┘   (screen state, unlimited, within the turn)
```

**The log records the turn. The screen edits a draft. The map animates the reveal.**
Three different questions that look like one, and separating them is what lets all three
be answered well:

- The **draft route** is an array of node ids in screen state. Undo is `pop()`. It never
  touches the log, so per-step undo costs nothing to design.
- **Commit** appends one event carrying the whole path. Fees are settled at end of turn
  by the rules, so the turn is already the unit the rules reckon in.
- **The reveal** walks the pawn along the committed path. Presentation derived from
  state, exactly as the flaps are.

This is also strictly better for Phase 3 than streaming a step per tap: one message
instead of twenty, no ordering hazards, and opponents see a decisive move rather than
watching someone dither.

**Commit is offered only when the route is complete** — exactly the full roll, or ending
on the destination. There is no half-committed turn.

**Reloading mid-turn loses the draft.** On a single pass-and-play tablet that is an
annoyance, not a lost game. If it grates, persisting the draft as screen state is a small
addition that does not disturb the log.

## Setup, before anyone moves

The rulebook has an order to this and strict turns make it matter:

1. Barons join seats — unchanged from today.
2. **Each seated baron rolls a home city**, in seat order, no two the same. Their pawn
   starts there and they must return there to win.
3. **The players roll for who goes first**, high roll, and play proceeds clockwise from
   them. The app rolls this once and records the resulting order, so a replayed game
   deals the same turns.
4. The first player rolls their first destination and the game is under way.

`GameState.phase` is `setup | playing` today. Steps 2 and 3 need a phase of their own
between them, so it becomes `setup | homes | playing`. Seating order stays the existing
`SEATS` order; the roll decides only who starts within it.

## State

Three changes to the event log. Everything else derives by replay, as it does today.

- **`turnRolled`** — the dice for a turn: both white dice and the bonus die when earned.
  Recorded rather than re-rolled, so a replayed game is the same game. This is the
  existing house rule that events record what happened, not what was rolled.
- **`moved`** — one per turn: the path as node ids, and whether it ended on the
  destination.
- **A home city may not collide.** There is no `homeAssigned` event and this spec does
  not add one: a baron's home city is today the first `arrived` they record, the one that
  pays nothing. What changes is that rolling it must avoid cities already taken, so
  `rollDestination` gains the set of home cities already taken and rerolls when it hits
  one. Note the book says to roll again "for region and city" — the whole destination
  roll, not another city within the same region.

Derived at replay:

- **whose turn it is** — seating order and a turn counter
- **each pawn's position** — the last node of the last `moved`, or the home city
- **sections used this trip** — accumulated from `moved` paths since the last arrival,
  and released on arrival

Positions are node ids, not city ids. A baron between cities is the normal case; the
companion could get away with "which city are you heading for", and this cannot.

## The movement engine

Pure, in `engine/`, no React — following the split the project already holds. Its whole
job is one question: **from here, with this much movement left, which taps are legal?**

The cost model falls out of the graph rather than being enforced on top of it: `dot` and
`city` cost one, `junction` costs nothing *because it is not a dot*, and the two twin
pairs collapse to a single dot for the pair. Company-switching legality falls out the
same way — you may change company only at a dot, and a junction is precisely the
not-a-dot case the rulebook is describing.

### The hard part, named up front

A step is legal only if the **remaining movement can still be spent legally from there**.
The rulebook says so directly: you may not move to a dot that strands you. So offering
legal taps means searching forward from each candidate, not checking the edge in front of
you. With the no-reuse constraint this is trail-finding, which is unpleasant in general.

Why it should be fine here: most dots are degree two — a line with a dot on it — so the
branching factor is tiny, and the depth is capped at 12 — the two white dice. The Bonus
Roll is a *separate* move of up to 6, not an extension of the first, so it never deepens
the search. A bounded depth-first search with memoisation on (node, remaining, used-set)
should be comfortable.

**This gets measured against the real 550-node graph early, not assumed.** If it does
bite, the fallback is to allow the tap and validate at commit — the player then finds out
a moment later rather than being prevented, which is worse but not wrong.

## Interface

**The map becomes the play surface during a turn.** You cannot tap dots on a departures
board. Legal next dots are lit; the pawn walks the committed path at 80–120ms a dot; a
tap finishes the animation early — the same rule the board already applies to a flap
mid-turn.

**The board keeps the roster** — who is up, destinations, payouts, and later cash. The
two views already exist and already share state; what changes is which one is primary
during a turn.

**Turn order is strict.** Only the baron whose turn it is can act; other rows are inert
and the app advances the turn itself. Fees are settled per turn, so "whose turn" has to
be unambiguous. Undo takes back the last turn if someone acts for the wrong baron.

## Testing

`engine/` is pure, so it tests directly, and the dice are injected exactly as they are
today — a whole turn can be scripted.

- the cost model, including **both** twin pairs and a junction costing nothing
- no-reuse held **across turns** within one trip, and released on arrival
- company switching allowed at a dot, refused at a junction
- the stranding rule: a step that would trap the pawn is not offered
- "must spend the whole roll" — a route short of the roll is not committable
- the bonus die earned by each train, and never twice in a turn
- home cities never collide
- a **performance test of the look-ahead against the real graph**, not a toy one

The house rule stands: prove a new test can fail by breaking the code and reading real
output, never by reading the assertion.

## What must not break

- **The `$0` constraint.** Minneapolis↔St. Paul and San Francisco↔Oakland pay nothing and
  are real destinations. They are also the two twin pairs whose movement cost is special.
  Both facts, same two pairs, different code paths.
- **The event log as the single source of truth**, with state derived by replay.
- **A roll is not told until the board has finished announcing it** — the gate built into
  `useGame.roll`/`commitRoll`. Movement adds a second thing worth announcing and must not
  reintroduce the leak.
