import { describe, expect, it } from 'vitest';
import { play } from './play';
import { replay } from '../../state/game';
import type { GameEvent } from '../../state/events';
import { BOARD_ROWS } from '../types';

const log: GameEvent[] = [
  { type: 'joined', seat: 'red', name: 'ADA' },
  { type: 'joined', seat: 'blue', name: 'MARGO' },
  { type: 'started' },
  { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: 4500 }
];

const rows = (events: GameEvent[] = log) => play(replay(events)).rows;

describe('the in-play board', () => {
  it('shows one row per seated baron and blanks the rest', () => {
    expect(rows()).toHaveLength(BOARD_ROWS);
    expect(rows()[0]!.label).toBe('ADA');
    expect(rows()[1]!.label).toBe('MARGO');
    expect(rows()[2]!.action).toBeNull();
  });

  it('makes a baron row roll when tapped', () => {
    expect(rows()[0]!.action).toEqual({ kind: 'act', seat: 'red' });
  });

  it('shows the latest destination and what it paid', () => {
    const row = rows()[0]!;
    expect(row.text).toBe('Chicago');
    expect(row.status).toBe('North Central');
    expect(row.amount).toBe('4,500');
    expect(row.showDollar).toBe(true);
  });

  it('leaves a baron who has not travelled with an empty destination', () => {
    expect(rows()[1]!.text).toBe('');
    expect(rows()[1]!.amount).toBe('');
  });

  it('says HOME rather than a payout for a home town', () => {
    const home: GameEvent[] = [
      { type: 'joined', seat: 'red', name: 'ADA' },
      { type: 'started' },
      { type: 'arrived', seat: 'red', city: 20, region: 'NC', payout: null }
    ];
    expect(rows(home)[0]!.right).toBe('Home');
    expect(rows(home)[0]!.showDollar).toBe(false);
  });

  it('shows a zero-paying journey as a real zero, not as blank', () => {
    // Minneapolis to St. Paul really does pay nothing.
    const zero: GameEvent[] = [
      { type: 'joined', seat: 'red', name: 'ADA' },
      { type: 'started' },
      { type: 'arrived', seat: 'red', city: 47, region: 'PL', payout: 0 }
    ];
    expect(rows(zero)[0]!.amount).toBe('0');
    expect(rows(zero)[0]!.showDollar).toBe(true);
  });
});
