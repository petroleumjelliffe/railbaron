import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { REGIONS } from '../../engine';
import type { Seat } from '../state/game';
import { RegionBallot } from './RegionBallot';
import { TOKENS } from './tokens';

// jsdom normalizes inline hex colors to rgb(...) strings; round-tripping
// TOKENS.amber through a throwaway element gets the same normalization the
// buttons under test go through, instead of hardcoding jsdom's format.
const normalizedAmber = (() => {
  const probe = document.createElement('span');
  probe.style.color = TOKENS.amber;
  return probe.style.color;
})();

const seat = (awaiting: Seat['awaiting']): Seat => ({
  id: 'red',
  name: 'Pete',
  stops: [],
  awaiting
});

describe('the region ballot', () => {
  it('renders all seven regions as buttons', () => {
    render(<RegionBallot seat={seat('NE')} onChoose={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
    for (const region of REGIONS) {
      expect(screen.getByRole('button', { name: new RegExp(region.name, 'i') })).toBeInTheDocument();
    }
  });

  it('calls onChoose with the chosen region id when a button is clicked', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<RegionBallot seat={seat('NE')} onChoose={onChoose} />);

    await user.click(screen.getByRole('button', { name: /southwest/i }));

    expect(onChoose).toHaveBeenCalledExactlyOnceWith('SW');
  });

  it('still allows choosing the region just rolled, even though it is distinguished', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<RegionBallot seat={seat('PL')} onChoose={onChoose} />);

    const plainsButton = screen.getByRole('button', { name: /plains/i });
    await user.click(plainsButton);

    expect(onChoose).toHaveBeenCalledExactlyOnceWith('PL');
  });

  it('assigns a different colour value to the awaited region', () => {
    render(<RegionBallot seat={seat('PL')} onChoose={() => {}} />);

    const plainsButton = screen.getByRole('button', { name: /plains/i });
    const otherButton = screen.getByRole('button', { name: /northeast/i });

    // jsdom paints nothing, so this only proves the two buttons receive
    // different inline `color` values (dim vs amber) — not that a human
    // would perceive a difference on screen.
    expect(plainsButton.style.color).not.toBe(otherButton.style.color);
  });

  it('gives every button the same active colour when the seat is not awaiting one', () => {
    render(<RegionBallot seat={seat(null)} onChoose={() => {}} />);

    const colors = screen.getAllByRole('button').map(button => button.style.color);
    expect(colors).toEqual(colors.map(() => normalizedAmber));
  });

  it('names whose choice this is in the group\'s accessible name', () => {
    render(<RegionBallot seat={seat('NE')} onChoose={() => {}} />);
    expect(screen.getByRole('group', { name: /Pete/i })).toBeInTheDocument();
  });

  it('falls back to the seat id when the seat has no name yet', () => {
    render(<RegionBallot seat={{ id: 'blue', name: null, stops: [], awaiting: 'NE' }} onChoose={() => {}} />);
    expect(screen.getByRole('group', { name: /blue/i })).toBeInTheDocument();
  });
});
