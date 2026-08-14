import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nodeForCity } from '../../engine';
import { MapView } from './MapView';
import { replay } from '../state/game';
import type { GameEvent } from '../state/events';

const MINNEAPOLIS = 43;
const ST_PAUL = 47;
const CHICAGO = 20;

const join: GameEvent[] = [
  { type: 'joined', seat: 'red', name: 'ADA' },
  { type: 'joined', seat: 'blue', name: 'MARGO' },
  { type: 'started' }
];

/** Everything the map needs that these tests are not about. */
const inert = {
  onMove: () => {},
  dice: { roll: null, live: false },
  onRollDice: () => {},
  onDiceLanded: () => {}
};

const show = (events: GameEvent[], onBack = () => {}) =>
  render(<MapView state={replay(events)} onBack={onBack} {...inert} />);

/**
 * Each lamp's <title> is its tooltip and what a screen reader announces.
 * Read directly rather than through getByTitle, which only matches a <title>
 * that is an immediate child of the <svg> — these belong to their own lamp.
 */
const titles = (container: HTMLElement) =>
  [...container.querySelectorAll('title')].map(t => t.textContent);

describe('the map', () => {
  it('draws a lamp for every city and route dot', () => {
    const { container } = show(join);
    // Cities carry a <title>; route dots do not, which is how they are told
    // apart without reaching for internals.
    expect(container.querySelectorAll('title')).toHaveLength(67);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('says whose destination a lit city is', () => {
    const { container } = show([...join,
      { type: 'arrived', seat: 'red', city: CHICAGO, region: 'NC', payout: 4500 }]);
    expect(titles(container)).toContain("Chicago — ADA's destination");
  });

  it('says which city a baron set out from', () => {
    const { container } = show([...join,
      { type: 'arrived', seat: 'red', city: CHICAGO, region: 'NC', payout: 4500 },
      { type: 'arrived', seat: 'red', city: 39, region: 'PL', payout: 9000 }]);
    expect(titles(container)).toContain("Chicago — ADA's origin");
    expect(titles(container)).toContain("Denver — ADA's destination");
  });

  it('leaves an untouched city named but unclaimed', () => {
    const { container } = show(join);
    expect(titles(container)).toContain('Chicago');
  });

  it('shows a zero-paying journey as $0, not as a home town', () => {
    // Minneapolis to St. Paul is a real, legal, zero-paying leg. `payout ||`
    // anywhere on this path would print HOME instead.
    show([...join,
      { type: 'arrived', seat: 'red', city: MINNEAPOLIS, region: 'PL', payout: 3000 },
      { type: 'arrived', seat: 'red', city: ST_PAUL, region: 'PL', payout: 0 }]);
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });

  it('says HOME when no payout applies', () => {
    show([...join,
      { type: 'arrived', seat: 'red', city: CHICAGO, region: 'NC', payout: null }]);
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('lists only the barons who have rolled', () => {
    show([...join, { type: 'arrived', seat: 'red', city: CHICAGO, region: 'NC', payout: 4500 }]);
    expect(screen.getByText('Chicago')).toBeInTheDocument();
    expect(screen.getByText('$4,500')).toBeInTheDocument();
  });

  it('goes back when asked', async () => {
    const onBack = vi.fn();
    show(join, onBack);
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('playing a turn on the map', () => {
  /** Red is up, standing in Minneapolis and bound for St. Paul next door. */
  const midTurn: GameEvent[] = [
    { type: 'joined', seat: 'red', name: 'ADA' },
    { type: 'started' },
    { type: 'arrived', seat: 'red', city: MINNEAPOLIS, region: 'PL', payout: null },
    { type: 'orderRolled', seat: 'red', first: 'red' },
    { type: 'arrived', seat: 'red', city: ST_PAUL, region: 'PL', payout: 0 },
    { type: 'turnRolled', seat: 'red', white: [1, 1], bonus: null }
  ];

  const play = (onMove = vi.fn()) => {
    render(
      <MapView
        state={replay(midTurn)}
        onBack={() => {}}
        onMove={onMove}
        dice={{ roll: null, live: false }}
        onRollDice={() => {}}
        onDiceLanded={() => {}}
      />
    );
    return onMove;
  };

  it('will not commit before a route has been tapped out', () => {
    play();
    expect(screen.getByRole('button', { name: 'COMMIT' })).toBeDisabled();
  });

  it('commits the tapped route as one leg', async () => {
    const user = userEvent.setup();
    const onMove = play();
    await user.click(screen.getByRole('button', { name: /St\. Paul/ }));
    await user.click(screen.getByRole('button', { name: 'COMMIT' }));
    expect(onMove).toHaveBeenCalledWith(
      'red', [nodeForCity(MINNEAPOLIS), nodeForCity(ST_PAUL)], true);
  });

  it('takes the last step back on undo', async () => {
    const user = userEvent.setup();
    play();
    await user.click(screen.getByRole('button', { name: /St\. Paul/ }));
    expect(screen.getByRole('button', { name: 'COMMIT' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'UNDO' }));
    expect(screen.getByRole('button', { name: 'COMMIT' })).toBeDisabled();
  });

  it('announces only the lamps that may be tapped', () => {
    play();
    // Chicago is nowhere near this leg and must not claim to be a control.
    expect(screen.queryByRole('button', { name: 'Chicago' })).not.toBeInTheDocument();
  });

  it('shows a pawn where the baron stands', () => {
    play();
    expect(screen.getAllByLabelText('ADA').length).toBeGreaterThan(0);
  });

  /**
   * Portland, OR — d432 — d393, an edge carrying both the GN and the UP, so
   * crossing it once on each line is a legal there-and-back and the route
   * arrives at d432 twice. 33 edges permit that, and the network has around
   * 161 independent cycles, so a route that revisits a node is ordinary play.
   */
  it('draws every segment of a route that doubles back on itself', async () => {
    // React only *warns* about duplicate keys and may still render both
    // children, so counting segments does not on its own catch this — the
    // damage is to reconciliation on later updates, which is undefined
    // behaviour rather than a reliable symptom. The warning is the signal
    // that discriminates, so it is asserted alongside what the player sees.
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const { container } = render(
      <MapView
        state={replay([
          { type: 'joined', seat: 'red', name: 'ADA' },
          { type: 'started' },
          { type: 'arrived', seat: 'red', city: 52, region: 'NW', payout: null },
          { type: 'orderRolled', seat: 'red', first: 'red' },
          { type: 'arrived', seat: 'red', city: 55, region: 'NW', payout: 3000 },
          { type: 'turnRolled', seat: 'red', white: [2, 2], bonus: null }
        ])}
        onBack={() => {}}
        onMove={vi.fn()}
        dice={{ roll: null, live: false }}
        onRollDice={() => {}}
        onDiceLanded={() => {}}
      />
    );

    const segments = () => container.querySelectorAll('[data-route="draft"] line');
    await user.click(screen.getByRole('button', { name: 'Dot d432' }));
    await user.click(screen.getByRole('button', { name: 'Dot d393' }));
    await user.click(screen.getByRole('button', { name: 'Dot d432' }));

    // Three steps walked, so three lines drawn...
    expect(segments()).toHaveLength(3);
    // ...each of them its own child. Keying by node id collides on the
    // repeated d432, and React is explicit that two children sharing a key
    // no longer keep their identity across updates.
    const keyed = complaints.mock.calls
      .map(call => String(call[0]))
      .filter(message => message.includes('same key'));
    expect(keyed).toEqual([]);
    complaints.mockRestore();
  });

  it('will not take a tap while the last move is still playing back', () => {
    const onMove = vi.fn();
    // A Bonus Roll turn: the primary leg lands within the white dice with a
    // bonus die still owed, so the turn stays open — a new destination is
    // rolled, and the bonus leg (Minneapolis, one hop away) becomes a real,
    // tappable candidate. Without the guard, `route.legal` genuinely holds
    // it; this is the scenario the guard exists for, not one where there is
    // nothing to tap regardless.
    const played: GameEvent[] = [
      { type: 'joined', seat: 'red', name: 'ADA' },
      { type: 'started' },
      { type: 'arrived', seat: 'red', city: MINNEAPOLIS, region: 'PL', payout: null },
      { type: 'orderRolled', seat: 'red', first: 'red' },
      { type: 'arrived', seat: 'red', city: ST_PAUL, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'red', white: [6, 6], bonus: 4 },
      { type: 'moved', seat: 'red', path: [nodeForCity(MINNEAPOLIS), nodeForCity(ST_PAUL)], arrived: true },
      { type: 'arrived', seat: 'red', city: MINNEAPOLIS, region: 'PL', payout: 3000 }
    ];
    render(
      <MapView
        state={replay(played)}
        onBack={() => {}}
        onMove={onMove}
        dice={{ roll: null, live: false }}
        onRollDice={() => {}}
        onDiceLanded={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /Minneapolis/ })).not.toBeInTheDocument();
  });

  /**
   * The bonus leg used to strand the player here. A pawn that arrives inside
   * the white dice is paid and owes a new destination before the bonus die can
   * be spent — so the map had nothing tappable, dice that were not live, UNDO
   * and COMMIT greyed out, and a "0 left" readout that named none of it.
   *
   * The destination is rolled on the board, behind the region panel and the
   * own-region ballot, so the honest fix is to say so and point at it.
   */
  describe('when the baron up owes a destination roll', () => {
    /** Arrived inside the white dice, bonus die still owed, no new destination. */
    const bonusLegOwed: GameEvent[] = [
      { type: 'joined', seat: 'red', name: 'ADA' },
      { type: 'started' },
      { type: 'arrived', seat: 'red', city: MINNEAPOLIS, region: 'PL', payout: null },
      { type: 'orderRolled', seat: 'red', first: 'red' },
      { type: 'arrived', seat: 'red', city: ST_PAUL, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'red', white: [6, 6], bonus: 4 },
      { type: 'moved', seat: 'red',
        path: [nodeForCity(MINNEAPOLIS), nodeForCity(ST_PAUL)], arrived: true }
    ];

    const shown = (events: GameEvent[], onBack = vi.fn()) => {
      render(
        <MapView
          state={replay(events)}
          onBack={onBack}
          onMove={vi.fn()}
          dice={{ roll: null, live: false }}
          onRollDice={() => {}}
          onDiceLanded={() => {}}
        />
      );
      return onBack;
    };

    it('says what the game is waiting for, and offers the way to it', async () => {
      const user = userEvent.setup();
      const onBack = shown(bonusLegOwed);
      expect(screen.getByText(/roll a new destination/i)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /to the board/i }));
      expect(onBack).toHaveBeenCalledOnce();
    });

    it('offers no lamp and no move controls while it waits', () => {
      shown(bonusLegOwed);
      // The route controls would be a lie: there is no destination to route to.
      expect(screen.queryByRole('button', { name: 'COMMIT' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'UNDO' })).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+ left/)).not.toBeInTheDocument();
      // Nothing is offered, and not because the screen suppresses it: the
      // draft runs from where the pawn stands to where it stands, and the
      // engine refuses every step out of it with `already-arrived`.
      expect(screen.queryByRole('button', { name: /Minneapolis/ })).not.toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: /^Dot / })).toEqual([]);
    });

    it('says none of it mid-leg, when there is a route to walk', () => {
      shown(midTurn);
      expect(screen.queryByText(/roll a new destination/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /to the board/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'COMMIT' })).toBeInTheDocument();
      expect(screen.getByText(/2 left/)).toBeInTheDocument();
    });
  });

  /**
   * The sibling state, and the other way this screen used to read as stranded.
   *
   * A white leg that stops in open country on an entitled turn leaves the turn
   * open — "if entitled, he must take it" — with no movement to spend until
   * the die is thrown. Unlike the destination above, the roll that clears it
   * is on this screen already: the dice readout the map renders. So the HUD
   * names what is owed and leaves the dice to take it.
   */
  describe('when the baron up owes the Bonus Roll', () => {
    /** Double six walked without arriving: entitled, and the die still in the cup. */
    const bonusOwed: GameEvent[] = [
      { type: 'joined', seat: 'red', name: 'ADA' },
      { type: 'started' },
      { type: 'arrived', seat: 'red', city: MINNEAPOLIS, region: 'PL', payout: null },
      { type: 'orderRolled', seat: 'red', first: 'red' },
      { type: 'arrived', seat: 'red', city: ST_PAUL, region: 'PL', payout: 0 },
      { type: 'turnRolled', seat: 'red', white: [6, 6], bonus: null },
      { type: 'moved', seat: 'red', path: [nodeForCity(MINNEAPOLIS), 'd66'], arrived: false }
    ];

    const shown = (events: GameEvent[], live = true) =>
      render(
        <MapView
          state={replay(events)}
          onBack={vi.fn()}
          onMove={vi.fn()}
          dice={{ roll: { white: [6, 6], bonus: null }, live }}
          onRollDice={() => {}}
          onDiceLanded={() => {}}
        />
      );

    it('says the Bonus Roll is what it is waiting for', () => {
      shown(bonusOwed);
      expect(screen.getByText(/bonus roll/i)).toBeInTheDocument();
      // Not the move controls: the leg has no movement until the die lands,
      // and "0 left" over a greyed COMMIT is the stranding this replaced.
      expect(screen.queryByRole('button', { name: 'COMMIT' })).not.toBeInTheDocument();
      expect(screen.queryByText(/0 left/)).not.toBeInTheDocument();
      // And not the destination cluster either — nothing was arrived at.
      expect(screen.queryByText(/roll a new destination/i)).not.toBeInTheDocument();
    });

    it('leaves the dice on this screen to take it', async () => {
      const onRollDice = vi.fn();
      const user = userEvent.setup();
      render(
        <MapView
          state={replay(bonusOwed)}
          onBack={vi.fn()}
          onMove={vi.fn()}
          dice={{ roll: { white: [6, 6], bonus: null }, live: true }}
          onRollDice={onRollDice}
          onDiceLanded={() => {}}
        />
      );
      await user.click(screen.getByRole('button', { name: /roll the dice/i }));
      expect(onRollDice).toHaveBeenCalledOnce();
    });

    it('puts the destination first when the white leg arrived', () => {
      // Both owed at once. The book's order is destination, then the die, so
      // the destination cluster is what shows — one HUD, not two stacked.
      const arrivedFirst: GameEvent[] = [...bonusOwed.slice(0, -1),
        { type: 'moved', seat: 'red',
          path: [nodeForCity(MINNEAPOLIS), nodeForCity(ST_PAUL)], arrived: true }];
      shown(arrivedFirst, false);
      expect(screen.getByText(/roll a new destination/i)).toBeInTheDocument();
      expect(screen.queryByText(/bonus roll/i)).not.toBeInTheDocument();
    });

    it('says none of it once the die has been thrown', () => {
      shown([...bonusOwed, { type: 'bonusRolled', seat: 'red', face: 3 }], false);
      expect(screen.queryByText(/bonus roll/i)).not.toBeInTheDocument();
      expect(screen.getByText(/3 left/)).toBeInTheDocument();
    });
  });

  /**
   * Reported from live play: touch targets felt too small, and a city's
   * glow was visibly sitting over neighbouring dots. jsdom cannot do real
   * geometric hit-testing (no layout, no paint), so this pins the fix
   * structurally instead of pixel-by-pixel: every tappable circle lives in
   * one topmost layer that paints after everything else, and every other
   * circle in the SVG is explicitly marked untappable. If either of those
   * stops being true, a lamp drawn later in the document can once again
   * sit on top of a hit target and steal its taps — the exact bug
   * reported, even though jsdom itself can't see it happen.
   */
  it('puts every hit target in one top-level layer, after all painted geometry', () => {
    const { container } = render(
      <MapView
        state={replay(midTurn)}
        onBack={() => {}}
        onMove={vi.fn()}
        dice={{ roll: null, live: false }}
        onRollDice={() => {}}
        onDiceLanded={() => {}}
      />
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const rootChildren = [...svg!.children];

    // (a) Every role="button" element lives inside the same root child, and
    // that child is the SVG's last: nothing painted afterward can cover it.
    const holdsAButton = (el: Element) =>
      el.getAttribute('role') === 'button' || el.querySelector('[role="button"]') !== null;
    const holderIndices = rootChildren
      .map((el, i) => (holdsAButton(el) ? i : -1))
      .filter(i => i >= 0);
    expect(holderIndices.length).toBeGreaterThan(0);
    expect(new Set(holderIndices)).toEqual(new Set([rootChildren.length - 1]));
    const interactionLayer = rootChildren[rootChildren.length - 1]!;
    expect(interactionLayer.querySelectorAll('[role="button"]').length).toBeGreaterThan(0);

    // (b) Every circle outside that layer is explicitly inert: it carries
    // pointer-events="none", or sits under aria-hidden decoration.
    const outsideCircles = [...container.querySelectorAll('circle')]
      .filter(c => !interactionLayer.contains(c));
    expect(outsideCircles.length).toBeGreaterThan(0);
    for (const circle of outsideCircles) {
      const inert = circle.getAttribute('pointer-events') === 'none'
        || circle.closest('[aria-hidden="true"]') !== null;
      expect(inert).toBe(true);
    }
  });
});
