import { describe, expect, it } from 'vitest';
import { home } from './home';
import { BOARD_ROWS } from '../types';

describe('the home screen', () => {
  it('states both modes as destinations', () => {
    const rows = home().rows;
    expect(rows[0]!.text).toBe('PASS AND PLAY');
    expect(rows[1]!.text).toBe('PLAY ONLINE');
  });

  it('fills the board to seven rows like every other screen', () => {
    expect(home().rows).toHaveLength(BOARD_ROWS);
  });

  it('sends pass-and-play somewhere real', () => {
    expect(home().rows[0]!.action).toEqual({ kind: 'navigate', to: 'passAndPlay' });
  });

  it('shows online as coming rather than hiding it', () => {
    // The mode select's whole statement is that both modes exist.
    const online = home().rows[1]!;
    expect(online.tone).toBe('disabled');
    expect(online.right).toBe('Soon');
    expect(online.action).toBeNull();
  });

  it('has nowhere to go back to', () => {
    expect(home().back).toBeNull();
  });
});
