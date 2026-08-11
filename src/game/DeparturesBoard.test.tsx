import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeparturesBoard } from './DeparturesBoard';
import { replay } from '../state/game';
import type { GameEvent } from '../state/events';
import { REGIONS } from '../../engine';

const board = (
  events: GameEvent[],
  onActivate = vi.fn(),
  onChooseRegion = vi.fn(),
  onReset = vi.fn()
) => {
  render(
    <DeparturesBoard
      state={replay(events)}
      onActivate={onActivate}
      onChooseRegion={onChooseRegion}
      onReset={onReset}
    />
  );
  return { onActivate, onChooseRegion, onReset };
};

describe('the departures board', () => {
  it('offers all six seats before anyone has joined', () => {
    board([]);
    expect(screen.getAllByRole('button', { name: /tap to join/i })).toHaveLength(6);
  });

  it('shows a seated baron by name', () => {
    board([{ type: 'joined', seat: 'red', name: 'Pete' }]);
    expect(screen.getByText('PETE')).toBeInTheDocument();
  });

  it('shows a home town with no payout', () => {
    board([
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null }
    ]);
    expect(screen.getByText('CHICAGO')).toBeInTheDocument();
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('shows a zero payout as $0', () => {
    board([
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 43, region: 'PL', payout: null },
      { type: 'arrived', seat: 'red', city: 47, region: 'PL', payout: 0 }
    ]);
    expect(screen.getByText('ST. PAUL')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('rolls for a seat when its row is tapped', async () => {
    const { onActivate } = board([
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null }
    ]);
    await userEvent.click(screen.getByRole('button', { name: /pete/i }));
    expect(onActivate).toHaveBeenCalledWith('red');
  });

  it('replaces the destinations with a ballot when a region is owed', () => {
    board([
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null },
      { type: 'regionRequested', seat: 'red', rolled: 'NC' }
    ]);
    expect(screen.getByRole('button', { name: /northwest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /southwest/i })).toBeInTheDocument();
    // "Replaces" means the six departure rows are gone, not merely that the
    // ballot's buttons are present alongside them.
    expect(screen.getAllByRole('button')).toHaveLength(REGIONS.length);
    expect(screen.queryByRole('button', { name: /tap to join/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pete/i })).not.toBeInTheDocument();
  });

  it('reports which region was picked, for the seat that owes one', async () => {
    const { onChooseRegion } = board([
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null },
      { type: 'regionRequested', seat: 'red', rolled: 'NC' }
    ]);
    await userEvent.click(screen.getByRole('button', { name: /southwest/i }));
    expect(onChooseRegion).toHaveBeenCalledWith('red', 'SW');
  });

  it('hides the New Game control while a region ballot is up, even with a baron seated', () => {
    board([
      { type: 'joined', seat: 'red', name: 'Pete' },
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null },
      { type: 'regionRequested', seat: 'red', rolled: 'NC' }
    ]);
    expect(screen.queryByRole('button', { name: /new game/i })).not.toBeInTheDocument();
  });
});
