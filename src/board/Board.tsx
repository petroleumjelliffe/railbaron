import { useMemo } from 'react';
import { BoardRow, BOARD_COLUMN_WIDTHS, BOARD_TILE } from './BoardRow';
import { RowInput } from './RowInput';
import { useFlap } from './useFlap';
import { padRows, type Row, type ScreenDef } from './types';
import type { SeatId } from '../state/events';
import { TOKENS } from '../game/tokens';

export interface BoardProps {
  screen: ScreenDef;
  onRowAct: (row: Row, index: number) => void;
  onBack: () => void;
  /** The seat currently being typed into, if any. */
  editing?: { seat: SeatId; placeholder: string } | null;
  onCommit?: (value: string) => void;
  onCancel?: () => void;
}

export function Board({
  screen, onRowAct, onBack, editing = null, onCommit, onCancel
}: BoardProps) {
  const rows = useMemo(() => padRows(screen.rows), [screen.rows]);
  const texts = useMemo(
    () => rows.map(row => ({ status: row.status, text: row.text, amount: row.amount })),
    [rows]
  );
  const { rows: faces, settled, flapping, snap } = useFlap(texts);

  const headings = [
    BOARD_COLUMN_WIDTHS.label,
    BOARD_COLUMN_WIDTHS.status,
    BOARD_COLUMN_WIDTHS.destination,
    BOARD_COLUMN_WIDTHS.amount,
    BOARD_COLUMN_WIDTHS.right
  ];

  return (
    <div
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: TOKENS.board, border: `14px solid ${TOKENS.bezel}`,
        boxShadow: 'inset 0 0 0 1px #262626'
      }}
    >
      <header
        style={{
          flex: '0 0 78px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 34px',
          background: TOKENS.header, borderBottom: '1px solid #2a2a2a'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <span
            style={{
              fontSize: 30, fontWeight: 700, letterSpacing: '0.22em',
              color: TOKENS.amber, textTransform: 'uppercase'
            }}
          >
            Rail Baron
          </span>
          <span
            style={{
              fontSize: 12, letterSpacing: '0.22em', color: TOKENS.dim,
              textTransform: 'uppercase'
            }}
          >
            {screen.title}
          </span>
        </span>
        <span
          style={{
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
            letterSpacing: '0.18em', color: TOKENS.dim
          }}
        >
          <span>{screen.sub}</span>
          {screen.back !== null && (
            <button
              type="button"
              onClick={onBack}
              style={{
                cursor: 'pointer', color: TOKENS.dim, background: 'transparent',
                border: '1px solid #2a2a2a', borderRadius: 3, padding: '8px 12px',
                font: 'inherit', letterSpacing: 'inherit'
              }}
            >
              BACK
            </button>
          )}
        </span>
      </header>

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: BOARD_TILE.columnGap,
          padding: `16px ${34 + BOARD_TILE.rowPadding}px 10px`, fontSize: 11,
          letterSpacing: '0.24em', textTransform: 'uppercase', color: '#7d7669'
        }}
      >
        <span style={{ flex: `0 0 ${BOARD_COLUMN_WIDTHS.chip}px` }} />
        {screen.cols.map((heading, index) => (
          <span key={index} style={{ flex: `0 0 ${headings[index]}px` }}>{heading}</span>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 34px 20px' }}>
        {rows.map((row, index) => {
          const isEditing =
            editing !== null &&
            row.action?.kind === 'edit' &&
            row.action.field === `seat:${editing.seat}`;

          return (
            <div key={index} data-board-row="" style={{ display: 'flex', flex: 1 }}>
              <BoardRow
                // The HOME note lands with the payout it stands in for.
                row={{ ...row, right: settled[index]?.amount === false ? '' : row.right }}
                faces={faces[index]?.text ?? []}
                status={faces[index]?.status ?? []}
                amount={faces[index]?.amount ?? []}
                amountSettled={settled[index]?.amount ?? true}
                input={isEditing ? (
                  <RowInput
                    initial={row.text === 'TAP TO JOIN' ? '' : row.text}
                    placeholder={editing.placeholder}
                    onCommit={value => onCommit?.(value)}
                    onCancel={() => onCancel?.()}
                  />
                ) : undefined}
                onAct={() => {
                  // A tap during a flap finishes it rather than being
                  // ignored: an inert menu is a worse trade than a
                  // cut-short animation.
                  if (flapping) snap();
                  onRowAct(row, index);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
