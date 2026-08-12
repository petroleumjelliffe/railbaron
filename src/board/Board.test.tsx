import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from './Board';
import { BOARD_ROWS, blankRow, type Row, type ScreenDef } from './types';

const choice = (text: string): Row => ({
  label: 'Mode 01', status: 'Local', text, amount: '2-6', showDollar: false,
  right: 'One device', chip: '#f5c451', tone: 'normal',
  action: { kind: 'navigate', to: 'passAndPlay' }
});

const screenDef = (rows: Row[]): ScreenDef => ({
  title: 'Departures', sub: 'CHOOSE A MODE', back: null,
  cols: ['Mode', 'Where', 'Select', 'Players', 'Notes'],
  rows
});

const board = (def: ScreenDef) => (
  <Board screen={def} onRowAct={() => {}} onBack={() => {}} />
);

/** The tiles of one row's destination field, as the characters on show. */
const tilesOfRow = (container: HTMLElement, index: number) =>
  [...container.querySelectorAll('[data-board-row]')[index]!.querySelectorAll('[data-flap]')]
    .map(tile => tile.getAttribute('data-flap'))
    .join('')
    .trimEnd();

afterEach(() => { vi.useRealTimers(); });

describe('the board', () => {
  it('always renders seven rows, however few the screen defines', () => {
    const { container } = render(board(screenDef([choice('PASS AND PLAY')])));
    expect(container.querySelectorAll('[data-board-row]')).toHaveLength(BOARD_ROWS);
  });

  it('still renders seven rows when the screen defines too many', () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => choice(`ROW ${i}`));
    const { container } = render(board(screenDef(tooMany)));
    expect(container.querySelectorAll('[data-board-row]')).toHaveLength(BOARD_ROWS);
  });

  it('reports which row was acted on', () => {
    const onRowAct = vi.fn();
    render(
      <Board
        screen={screenDef([blankRow(), choice('PLAY ONLINE')])}
        onRowAct={onRowAct}
        onBack={() => {}}
      />
    );
    screen.getByText('PLAY ONLINE').click();
    expect(onRowAct).toHaveBeenCalledWith(expect.objectContaining({ text: 'PLAY ONLINE' }), 1);
  });

  it('shows a back control only when the screen has somewhere to go back to', () => {
    const { rerender } = render(board(screenDef([])));
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();

    rerender(board({ ...screenDef([]), back: 'home' }));
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('shows the screen title and its column headings', () => {
    render(board(screenDef([])));
    expect(screen.getByText('CHOOSE A MODE')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
  });

  it('reads out the destination throughout a flap, not the spinning tiles', () => {
    // A screen reader must not narrate two seconds of alphabet.
    vi.useFakeTimers();
    const { container, rerender } = render(board(screenDef([choice('PASS AND PLAY')])));
    rerender(board(screenDef([choice('PLAY ONLINE')])));
    act(() => { vi.advanceTimersByTime(52); });

    expect(tilesOfRow(container, 0)).not.toBe('PLAY ONLINE');
    expect(screen.getByText('PLAY ONLINE')).toBeInTheDocument();
  });

  it('clears the status and note columns while the destination is spinning', () => {
    // Columns B and E blank and come back; A and D swap instantly. That
    // asymmetry is the effect — without it the board reads as a page swap.
    vi.useFakeTimers();
    const { rerender } = render(board(screenDef([choice('PASS AND PLAY')])));
    expect(screen.getByText('LOCAL')).toBeInTheDocument();

    rerender(board(screenDef([choice('PLAY ONLINE')])));
    act(() => { vi.advanceTimersByTime(52); });
    expect(screen.queryByText('LOCAL')).toBeNull();
  });
});
