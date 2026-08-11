import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeparturesRow, DEPARTURES_COLUMN_WIDTHS } from './DeparturesRow';
import { TOKENS } from './tokens';
import type { Seat } from '../state/game';

/**
 * jsdom never runs layout, so it can't tell us that thirteen 30px tiles
 * spill out of a 212px box — the way a human looking at the running app
 * did. But every flap field's occupied width is knowable by arithmetic
 * from what actually rendered, without measuring pixels:
 *
 *   - a per-character field (SplitFlap) renders one `[data-flap]` tile per
 *     character, each TOKENS.tileWidth wide, TOKENS.tileGap apart;
 *   - a single-panel field (FlapPanel) declares its own width directly as
 *     an inline style, which jsdom reports verbatim without needing layout.
 *
 * This measures whichever of those actually rendered inside a column and
 * asserts it fits the column's own declared width — both numbers pulled
 * from the live DOM and from DeparturesRow's exported constants, not
 * restated here. Reverting the region column to `<SplitFlap width={13} />`
 * makes the region assertion fail again, the way the original bug did.
 */
function occupiedWidth(container: Element): number {
  const tiles = container.querySelectorAll('[data-flap]');
  if (tiles.length > 0) {
    return tiles.length * TOKENS.tileWidth + (tiles.length - 1) * TOKENS.tileGap;
  }
  const panel = container.firstElementChild;
  if (panel === null) throw new Error('column has no rendered flap field');
  const width = parseFloat(getComputedStyle(panel).width);
  if (Number.isNaN(width)) throw new Error('flap field has no explicit width to measure');
  return width;
}

function columnWidth(container: Element): number {
  return parseFloat(getComputedStyle(container).width);
}

const seat: Seat = {
  id: 'red',
  name: 'Pete',
  stops: [{ city: 20, region: 'NC', payout: 21500 }],
  awaiting: null
};

describe('departures row column budgets', () => {
  it.each(['region', 'destination', 'payout'] as const)(
    'fits the %s field inside its column',
    column => {
      const { container } = render(<DeparturesRow seat={seat} onActivate={() => {}} />);
      const el = container.querySelector(`[data-column="${column}"]`);
      expect(el).not.toBeNull();
      expect(occupiedWidth(el!)).toBeLessThanOrEqual(columnWidth(el!));
      expect(columnWidth(el!)).toBe(DEPARTURES_COLUMN_WIDTHS[column]);
    }
  );
});
