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
});
