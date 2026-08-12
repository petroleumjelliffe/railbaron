import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardRow, BOARD_COLUMN_WIDTHS, BOARD_TILE } from './BoardRow';
import { FLAP_WIDTH } from './alphabet';
import { staticFaces } from './drum';
import { blankRow, type Row } from './types';

const row: Row = {
  label: 'Seat 1', status: 'Ready', text: 'ADA',
  amount: '42,000', showDollar: true, right: 'Tap to edit',
  chip: '#e02b1d', tone: 'normal',
  action: { kind: 'navigate', to: 'play' }
};

const render1 = (r: Row, onAct = () => {}) =>
  render(<BoardRow row={r} faces={staticFaces(r.text)} onAct={onAct} />);

/**
 * jsdom runs no layout, so it cannot see tiles spilling out of a column —
 * the way a human looking at the running app did, in the bug that produced
 * the original column budgets. But a per-character field's occupied width
 * is knowable by arithmetic from what actually rendered, and both numbers
 * come from the live DOM and the component's own exported constants rather
 * than being restated here.
 */
function occupiedWidth(container: Element): number {
  const tiles = container.querySelectorAll('[data-flap]');
  return tiles.length * BOARD_TILE.width + Math.max(0, tiles.length - 1) * BOARD_TILE.gap;
}

describe('a board row', () => {
  it('renders one tile per character position of the destination field', () => {
    const { container } = render1(row);
    expect(container.querySelectorAll('[data-flap]')).toHaveLength(FLAP_WIDTH);
  });

  it('fits the destination field inside its declared column', () => {
    const { container } = render1(row);
    const column = container.querySelector('[data-column="destination"]')!;
    expect(occupiedWidth(column)).toBeLessThanOrEqual(BOARD_COLUMN_WIDTHS.destination);
  });

  it('reads out as plain text for anything not looking at pixels', () => {
    render1(row);
    expect(screen.getByText('ADA')).toBeInTheDocument();
  });

  it('is a button when it has an action', () => {
    render1(row);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls back when tapped', () => {
    const onAct = vi.fn();
    render1(row, onAct);
    screen.getByRole('button').click();
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it('is not a button when it has no action', () => {
    render1({ ...row, action: null });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not call back when disabled, even though it still shows an action', () => {
    const onAct = vi.fn();
    render1({ ...row, tone: 'disabled' }, onAct);
    screen.getByRole('button').click();
    expect(onAct).not.toHaveBeenCalled();
  });

  it('shows the dollar sign only when the row asks for one', () => {
    const { container } = render1(row);
    expect(container.querySelector('[data-dollar]')).not.toBeNull();
    const without = render1({ ...row, showDollar: false });
    expect(without.container.querySelector('[data-dollar]')).toBeNull();
  });

  it('renders a blank row with no action and a full set of blank tiles', () => {
    const { container } = render1(blankRow());
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelectorAll('[data-flap]')).toHaveLength(FLAP_WIDTH);
  });

  it('keeps every column inside the width the board budgets for a row', () => {
    // The five columns, their gaps and the row's own padding have to fit
    // the board's inner width. The design has three pixels of slack, so
    // this is worth asserting rather than assuming.
    const gaps = 5 * BOARD_TILE.columnGap;
    const total =
      Object.values(BOARD_COLUMN_WIDTHS).reduce((sum, width) => sum + width, 0) +
      gaps +
      2 * BOARD_TILE.rowPadding;
    expect(total).toBeLessThanOrEqual(BOARD_TILE.rowWidth);
  });
});
