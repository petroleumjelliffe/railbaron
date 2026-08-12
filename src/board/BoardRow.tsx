import type { ReactNode } from 'react';
import type { FlapChar } from './drum';
import type { Row } from './types';
import { TOKENS } from '../game/tokens';

/**
 * Exported so the layout-budget test derives its expectations from the same
 * numbers the row is built with, rather than restating them.
 *
 * These are the design's own column widths, and they are self-consistent
 * only at a 27px tile: five columns, five gaps and the row's padding come
 * to 1301px inside a 1304px board. `TOKENS.tileWidth` is 30, which the old
 * three-column row could afford in a 436px destination and this five-column
 * one cannot — 14 tiles at 30px overflow the 406px column by 27px.
 */
export const BOARD_COLUMN_WIDTHS = {
  chip: 22, label: 168, status: 170, destination: 406, amount: 219, right: 178
} as const;

export const BOARD_TILE = {
  width: 27,
  height: 40,
  gap: 1,
  columnGap: 22,
  rowPadding: 14,
  /** The board's inner width: 1400 less its 14px bezel and 34px padding. */
  rowWidth: 1304
} as const;

export interface BoardRowProps {
  row: Row;
  faces: FlapChar[];
  onAct: () => void;
  /**
   * Rendered in the destination column in place of the tiles. The rest of
   * the row — chip, seat label, state and note — stays put, so typing a
   * name happens *in* the board rather than replacing a row of it.
   */
  input?: ReactNode;
}

/**
 * A single flap panel showing a whole string at once, rather than one tile
 * per character. Status and the right-hand note are labels, not fixed-width
 * character grids, so each gets one physical flap the width of its column.
 */
function Panel({ value, width }: { value: string; width: number }) {
  return (
    <span
      style={{
        display: 'inline-block', width, height: BOARD_TILE.height,
        lineHeight: `${BOARD_TILE.height}px`, paddingLeft: 11,
        boxSizing: 'border-box', borderRadius: 3, overflow: 'hidden',
        whiteSpace: 'nowrap', fontSize: 18, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: TOKENS.pale,
        background: `linear-gradient(180deg, ${TOKENS.flapTop} 0 50%, ${TOKENS.flapBottom} 50% 100%)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)'
      }}
    >
      {value.toUpperCase()}
    </span>
  );
}

export function BoardRow({ row, faces, onAct, input }: BoardRowProps) {
  const interactive = row.action !== null && row.tone !== 'disabled' && input === undefined;
  const colour =
    row.tone === 'disabled' ? '#4a463e' : row.tone === 'dim' ? TOKENS.dim : TOKENS.pale;

  const body = (
    <>
      <span
        aria-hidden="true"
        style={{
          // Proportional, not the design's flat 74px. The design's board is
          // a fixed 788px tall, giving ~92px rows and a 9px gap above each
          // chip; ours is fluid, and on a short viewport a 74px chip exactly
          // fills a 74px row, fusing every seat colour into one stripe.
          // 80% holds the design's ratio at any height. Measured, not guessed.
          width: BOARD_COLUMN_WIDTHS.chip, height: '80%',
          flex: `0 0 ${BOARD_COLUMN_WIDTHS.chip}px`, borderRadius: 2,
          background: row.chip ?? '#141414',
          boxShadow: row.chip ? '0 0 0 2px rgba(255,255,255,0.14)' : 'inset 0 0 0 1px #2c2c2c'
        }}
      />
      <span
        style={{
          width: BOARD_COLUMN_WIDTHS.label, flex: `0 0 ${BOARD_COLUMN_WIDTHS.label}px`,
          fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: TOKENS.dim, whiteSpace: 'nowrap', overflow: 'hidden'
        }}
      >
        {row.label.toUpperCase()}
      </span>
      <span
        data-column="status"
        style={{ width: BOARD_COLUMN_WIDTHS.status, flex: `0 0 ${BOARD_COLUMN_WIDTHS.status}px` }}
      >
        <Panel value={row.status} width={BOARD_COLUMN_WIDTHS.status - 2} />
      </span>
      <span
        data-column="destination"
        style={{
          width: BOARD_COLUMN_WIDTHS.destination,
          flex: `0 0 ${BOARD_COLUMN_WIDTHS.destination}px`,
          whiteSpace: 'nowrap'
        }}
      >
        {input !== undefined ? input : <>
        {/* The accessible copy carries the destination throughout a flap.
            Reading the drum instead would narrate two seconds of noise. */}
        <span
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
        >
          {row.text.toUpperCase()}
        </span>
        {faces.map((face, index) => (
          <span
            key={index}
            data-flap={face.top}
            aria-hidden="true"
            style={{
              display: 'inline-block', width: BOARD_TILE.width, height: BOARD_TILE.height,
              marginLeft: index === 0 ? 0 : BOARD_TILE.gap,
              lineHeight: `${BOARD_TILE.height}px`, textAlign: 'center', fontSize: 29,
              borderRadius: 3, color: colour,
              background: `linear-gradient(180deg, ${TOKENS.flapTop} 0 50%, ${TOKENS.flapBottom} 50% 100%)`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)'
            }}
          >
            {face.top === ' ' ? ' ' : face.top}
          </span>
        ))}
        </>}
      </span>
      <span
        data-column="amount"
        style={{
          width: BOARD_COLUMN_WIDTHS.amount, flex: `0 0 ${BOARD_COLUMN_WIDTHS.amount}px`,
          fontSize: 27, color: TOKENS.amber, whiteSpace: 'nowrap'
        }}
      >
        {row.showDollar && <span data-dollar="">$</span>}
        {row.amount}
      </span>
      <span
        data-column="right"
        style={{ width: BOARD_COLUMN_WIDTHS.right, flex: `0 0 ${BOARD_COLUMN_WIDTHS.right}px` }}
      >
        <Panel value={row.right} width={BOARD_COLUMN_WIDTHS.right - 2} />
      </span>
    </>
  );

  const shared = {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: BOARD_TILE.columnGap,
    flex: 1,
    width: '100%',
    padding: `0 ${BOARD_TILE.rowPadding}px`,
    boxSizing: 'border-box' as const,
    borderBottom: `1px solid ${TOKENS.rule}`,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left' as const
  };

  if (row.action === null) return <div style={shared}>{body}</div>;

  return (
    <button
      type="button"
      onClick={() => { if (interactive) onAct(); }}
      aria-disabled={!interactive}
      style={{ ...shared, border: 0, cursor: interactive ? 'pointer' : 'default' }}
    >
      {body}
    </button>
  );
}
