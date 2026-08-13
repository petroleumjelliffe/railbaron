import type { GoldenGame } from './types';

/**
 * The movement rules, stored as data. One game states one rule, and every one
 * of them is awkward to reach by playing normally — which is why they are
 * written down rather than found.
 *
 * Every node id here was read off the built graph, never assumed. The
 * neighbourhoods each game leans on:
 *
 *   c13 Minneapolis -> d417[GN,NP] d131[C&NW] d127[C&NW] d222[CMStP&P]
 *                      d352[CMStP&P] d66[CRI&P] c95 St. Paul[C&NW,CMStP&P,NP,GN]
 *   c95 St. Paul    -> c13 only — a spur
 *   c40 San Francisco -> c41 Oakland[AT&SF,SP] only — a spur
 *   c41 Oakland     -> d271[AT&SF] d54[SP] d86[SP] c40[AT&SF,SP]
 *   c4  Fargo       -> d324[GN] d372[GN] d201[NP] d192[NP]
 *   d417            -> d372[GN] c13[GN,NP] d201[NP]
 *   d372            -> c4[GN] d417[GN]
 *   d131            -> d123[C&NW] c13[C&NW] d15[C&NW]
 *   c12 Billings    -> d397[NP] d147[NP] d64[CB&Q]
 *   d397            -> d176[NP,CMStP&P] c12[NP] d146[CMStP&P]
 *   j2 (junction)   -> d252[GN] d170[NP] d176[NP]
 *   c65 Los Angeles -> d402[AT&SF,SP] d452[AT&SF] d423[SP]
 *   d452            -> c65[AT&SF] c75 San Diego[AT&SF]
 *
 * Every fixture starts on a city, so `src/state/replay.golden.test.ts` can
 * build a real log for each one and hold the runner and `replay` together.
 */
export const GAMES: readonly GoldenGame[] = [
  {
    id: 'reuse-by-another-line',
    title: 'a trip that re-crosses its own dots by a different line',
    /**
     * "Each section of rail can be used only once per trip", but the pawn "may
     * move between the same two dots again, as long as it uses a different rail
     * line." Minneapolis–d417 carries GN and NP, so it takes two crossings and
     * refuses a third — while the untouched C&NW section out of the same city
     * is still there for the taking. No-reuse is per section, not per dot.
     */
    setup: { at: 'c13', destination: 'c17' },
    steps: [
      { name: 'roll six', intent: { kind: 'roll', faces: [3, 3] },
        then: { spent: 0, remaining: 6, bonus: null } },
      { name: 'out to d417, on one of its two lines',
        intent: { kind: 'step', to: 'd417' }, then: { spent: 1, remaining: 5 } },
      { name: 'back to Minneapolis on the other',
        intent: { kind: 'step', to: 'c13' },
        then: { spent: 2, remaining: 4, companies: ['GN', 'NP'] } },
      { name: 'a third crossing has no line left to ride',
        intent: { kind: 'step', to: 'd417' }, expectError: 'section-used' },
      { name: 'but a different section out of the same city is untouched',
        intent: { kind: 'step', to: 'd131' },
        then: { spent: 3, remaining: 3, companies: ['GN', 'NP', 'C&NW'] } }
    ],
    final: { at: 'c13', spent: 3 }
  },

  {
    id: 'trip-across-turns',
    title: 'a trip that spans several turns',
    /**
     * A trip is not a turn. Sections spent on a turn that ended short of the
     * destination are still spent when the next turn starts — and arriving
     * releases the whole trip's worth at once, not just the last leg's.
     */
    setup: { at: 'c13', destination: 'c4' },
    steps: [
      { name: 'roll two', intent: { kind: 'roll', faces: [1, 1] },
        then: { remaining: 2, bonus: null } },
      { name: 'spend both dots', intent: { kind: 'step', to: 'd417' } },
      { name: 'and stop short of Fargo', intent: { kind: 'step', to: 'd372' },
        then: { spent: 2, remaining: 0, arrived: false, complete: true } },
      { name: 'end the turn part-way along the trip', intent: { kind: 'commit' },
        then: { at: 'd372', usedCount: 2, legOwed: false } },
      { name: 'roll again next turn', intent: { kind: 'roll', faces: [1, 2] },
        then: { remaining: 3, usedCount: 2 } },
      { name: 'the last dot into Fargo', intent: { kind: 'step', to: 'c4' },
        then: { spent: 1, arrived: true, complete: true } },
      { name: 'arriving releases the whole trip', intent: { kind: 'commit' },
        then: { at: 'c4', usedCount: 0 } }
    ],
    final: { at: 'c4', usedCount: 0, legOwed: false }
  },

  {
    id: 'junction-company',
    title: 'a route through a junction',
    /**
     * "A player may change rail lines any number of times, but he can change
     * rail lines only at a dot." j2 is the one fork on the board whose branches
     * carry different companies — d252 on GN, d170 and d176 on NP — so a pawn
     * that reaches it on NP must leave it on NP. Nothing is drawn at a junction
     * for the player to stand on, and it costs no movement either way.
     */
    setup: { at: 'c12', destination: 'c4' },
    steps: [
      { name: 'roll three', intent: { kind: 'roll', faces: [1, 2] },
        then: { remaining: 3 } },
      { name: 'north out of Billings', intent: { kind: 'step', to: 'd397' },
        then: { spent: 1 } },
      { name: 'on to the dot before the fork', intent: { kind: 'step', to: 'd176' },
        then: { spent: 2 } },
      { name: 'the fork itself costs nothing', intent: { kind: 'step', to: 'j2' },
        then: { spent: 2, remaining: 1, complete: false } },
      { name: 'the GN branch is another company, and this is no dot',
        intent: { kind: 'step', to: 'd252' }, expectError: 'wrong-company' },
      { name: 'its own line carries on', intent: { kind: 'step', to: 'd170' },
        then: { spent: 3, remaining: 0, complete: true } },
      { name: 'end the turn on a dot, not on the fork', intent: { kind: 'commit' },
        then: { at: 'd170', usedCount: 4 } }
    ],
    final: { at: 'd170' }
  },

  {
    id: 'twin-minneapolis',
    title: 'Minneapolis and St. Paul',
    /**
     * "Each pair of twin cities count as one dot for the pair." The crossing
     * was paid for on the way into the pair, so stepping between the two costs
     * nothing — a whole roll can be left standing unspent on arrival.
     */
    setup: { at: 'c13', destination: 'c95' },
    steps: [
      { name: 'roll seven', intent: { kind: 'roll', faces: [3, 4] },
        then: { remaining: 7 } },
      { name: 'across the pair, for nothing', intent: { kind: 'step', to: 'c95' },
        then: { spent: 0, remaining: 7, arrived: true, complete: true } },
      { name: 'arrive with the whole roll unspent', intent: { kind: 'commit' },
        then: { at: 'c95', usedCount: 0 } }
    ],
    final: { at: 'c95', usedCount: 0 }
  },

  {
    id: 'twin-bay',
    title: 'San Francisco and Oakland',
    /** The same rule, for the board's other pair. Both, not one. */
    setup: { at: 'c41', destination: 'c40' },
    steps: [
      { name: 'roll seven', intent: { kind: 'roll', faces: [2, 5] },
        then: { remaining: 7 } },
      { name: 'across the bay, for nothing', intent: { kind: 'step', to: 'c40' },
        then: { spent: 0, remaining: 7, arrived: true, complete: true } },
      { name: 'arrive with the whole roll unspent', intent: { kind: 'commit' },
        then: { at: 'c40', usedCount: 0 } }
    ],
    final: { at: 'c40', usedCount: 0 }
  },

  {
    id: 'stranding',
    title: 'a step that would strand the pawn',
    /**
     * "If moving to a particular dot would mean that a pawn could not get to
     * its destination city without going over the same rail section twice, then
     * the pawn cannot move to that particular dot."
     *
     * d452 is the San Diego spur: one AT&SF section in, the same one section
     * back out, and nothing else. Taking it while heading anywhere but San
     * Diego spends the only way home. This is the only such step in the shipped
     * graph that starts from a city with no sections already spent — see the
     * task report.
     */
    setup: { at: 'c65', destination: 'c76' },
    steps: [
      { name: 'roll seven', intent: { kind: 'roll', faces: [4, 3] },
        then: { remaining: 7 } },
      { name: 'down the San Diego spur, which has no way back',
        intent: { kind: 'step', to: 'd452' }, expectError: 'would-strand' },
      { name: 'the refusal cost nothing — the pawn moves on instead',
        intent: { kind: 'step', to: 'd402' }, then: { spent: 1, remaining: 6 } }
    ],
    final: { at: 'c65', spent: 1 }
  },

  {
    id: 'arrive-with-spare',
    title: 'a roll that arrives with movement to spare',
    /**
     * "As soon as his pawn reaches its destination city, it must stop
     * immediately — any extra movement is just lost." The route is finished
     * with movement still in hand, and there is no step left to offer.
     */
    setup: { at: 'c13', destination: 'c4' },
    steps: [
      { name: 'roll eight for a three-dot journey', intent: { kind: 'roll', faces: [4, 4] },
        then: { remaining: 8 } },
      { name: 'out of Minneapolis', intent: { kind: 'step', to: 'd417' } },
      { name: 'along the GN', intent: { kind: 'step', to: 'd372' } },
      { name: 'into Fargo, five dots early', intent: { kind: 'step', to: 'c4' },
        then: { spent: 3, remaining: 5, arrived: true, complete: true } },
      { name: 'the spare movement buys nothing', intent: { kind: 'step', to: 'd372' },
        expectError: 'already-arrived' },
      { name: 'end the turn', intent: { kind: 'commit' },
        then: { at: 'c4', usedCount: 0, legOwed: false } }
    ],
    final: { at: 'c4', legOwed: false }
  },

  {
    id: 'bonus-die-freight',
    title: 'a Freight earns a Bonus Roll on double six, and on nothing else',
    /**
     * Two turns, because the rule has two halves: snake eyes earn a Freight
     * nothing, and only the double six pays.
     */
    setup: { at: 'c13', destination: 'c8', train: 'freight' },
    steps: [
      { name: 'a pair of ones is still a pair', intent: { kind: 'roll', faces: [1, 1] },
        then: { bonus: null, remaining: 2 } },
      { name: 'walk it off', intent: { kind: 'step', to: 'd417' } },
      { name: 'and again', intent: { kind: 'step', to: 'd372' },
        then: { spent: 2, complete: true } },
      { name: 'end the turn', intent: { kind: 'commit' }, then: { legOwed: false } },
      { name: 'double six, and the third die comes out',
        intent: { kind: 'roll', faces: [6, 6, 5] },
        then: { bonus: 5, remaining: 17 } }
    ]
  },

  {
    id: 'bonus-die-express',
    title: 'an Express earns a Bonus Roll on any double',
    /** Three the hard way earns nothing; three and three earns the die. */
    setup: { at: 'c13', destination: 'c8', train: 'express' },
    steps: [
      { name: 'one and two is no double', intent: { kind: 'roll', faces: [1, 2] },
        then: { bonus: null, remaining: 3 } },
      { name: 'walk it off', intent: { kind: 'step', to: 'd417' } },
      { name: 'and on', intent: { kind: 'step', to: 'd372' } },
      { name: 'as far as Fargo', intent: { kind: 'step', to: 'c4' },
        then: { spent: 3, arrived: false, complete: true } },
      { name: 'end the turn', intent: { kind: 'commit' }, then: { legOwed: false } },
      { name: 'a double three is enough for an Express',
        intent: { kind: 'roll', faces: [3, 3, 5] },
        then: { bonus: 5, remaining: 11 } }
    ]
  },

  {
    id: 'bonus-die-superchief',
    title: 'a Superchief earns a Bonus Roll every turn',
    /**
     * No double, no double six — a Superchief takes the third die anyway, and
     * it joins the white dice as movement. The same faces earn a Freight or an
     * Express nothing at all.
     */
    setup: { at: 'c13', destination: 'c8', train: 'superchief' },
    steps: [
      { name: 'a plain one and two still earns the die',
        intent: { kind: 'roll', faces: [1, 2, 4] },
        then: { bonus: 4, remaining: 7 } }
    ]
  },

  {
    id: 'bonus-leg',
    title: 'arriving on the white dice, then a bonus leg',
    /**
     * Arriving inside the white dice does not end the turn: the baron is paid,
     * rolls a new destination, and spends the Bonus Roll starting that new trip
     * — with the old trip's sections released, which is why the bonus leg may
     * re-cross every section the first leg just used.
     *
     * And it happens once. The bonus leg arrives inside the white dice too, and
     * earns nothing for it: "a player can get no more than one Bonus Roll per
     * turn."
     */
    setup: { at: 'c4', destination: 'c13' },
    steps: [
      { name: 'double six on a Freight', intent: { kind: 'roll', faces: [6, 6, 6] },
        then: { bonus: 6, remaining: 18 } },
      { name: 'out of Fargo', intent: { kind: 'step', to: 'd372' } },
      { name: 'along the GN', intent: { kind: 'step', to: 'd417' } },
      { name: 'into Minneapolis on the third dot', intent: { kind: 'step', to: 'c13' },
        then: { spent: 3, arrived: true, complete: true } },
      { name: 'the turn is not over — a bonus leg is owed', intent: { kind: 'commit' },
        then: { at: 'c13', usedCount: 0, legOwed: true, bonus: 6 } },
      { name: 'a new destination for the bonus leg',
        intent: { kind: 'destination', to: 'c4' },
        then: { spent: 0, remaining: 6, usedCount: 0 } },
      { name: 'back over a section the last leg used, now released',
        intent: { kind: 'step', to: 'd417' }, then: { spent: 1 } },
      { name: 'and the next one', intent: { kind: 'step', to: 'd372' },
        then: { spent: 2 } },
      { name: 'into Fargo', intent: { kind: 'step', to: 'c4' },
        then: { spent: 3, remaining: 3, arrived: true, complete: true } },
      { name: 'no second Bonus Roll', intent: { kind: 'commit' },
        then: { at: 'c4', usedCount: 0, legOwed: false } }
    ],
    final: { at: 'c4', usedCount: 0, legOwed: false }
  }
];
