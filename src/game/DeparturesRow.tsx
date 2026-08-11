import { cityById, regionById } from '../../engine';
import type { Seat } from '../state/game';
import type { SeatId } from '../state/events';
import { FlapPanel, SplitFlap, formatMoney } from './SplitFlap';
import { SEAT_COLORS, TOKENS } from './tokens';

export interface DeparturesRowProps {
  seat: Seat;
  onActivate: (seat: SeatId) => void;
}

/**
 * Column budgets for the three flap fields. Exported so the layout-budget
 * test derives its expectations from the same numbers the row is built
 * with, rather than restating them.
 */
export const DEPARTURES_COLUMN_WIDTHS = {
  region: 212,
  destination: 436,
  payout: 219
} as const;

/** The region field is one panel, not a per-character tile grid. */
export const REGION_PANEL_WIDTH = 210;

export function DeparturesRow({ seat, onActivate }: DeparturesRowProps) {
  const latest = seat.stops[seat.stops.length - 1];
  const joined = seat.name !== null;
  const label = joined ? seat.name! : 'Tap to join';

  return (
    <button
      type="button"
      onClick={() => onActivate(seat.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        flex: 1,
        width: '100%',
        padding: '0 14px',
        border: 0,
        borderBottom: `1px solid ${TOKENS.rule}`,
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer'
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: joined ? SEAT_COLORS[seat.id] : '#141414',
          boxShadow: joined ? '0 0 0 2px rgba(255,255,255,0.12)' : 'inset 0 0 0 1px #2c2c2c'
        }}
      />
      <span
        style={{
          width: 110,
          fontSize: 19,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: joined ? TOKENS.pale : TOKENS.dim
        }}
      >
        {label.toUpperCase()}
      </span>
      <span data-column="region" style={{ width: DEPARTURES_COLUMN_WIDTHS.region }}>
        <FlapPanel
          value={latest ? regionById(latest.region).name : ''}
          width={REGION_PANEL_WIDTH}
        />
      </span>
      <span data-column="destination" style={{ width: DEPARTURES_COLUMN_WIDTHS.destination }}>
        <SplitFlap value={latest ? cityById(latest.city).name : ''} width={14} />
      </span>
      <span data-column="payout" style={{ width: DEPARTURES_COLUMN_WIDTHS.payout }}>
        <SplitFlap
          value={latest ? formatMoney(latest.payout) : ''}
          width={7}
          align="right"
          tone="amber"
        />
      </span>
    </button>
  );
}
