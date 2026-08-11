import { cityById, regionById } from '../../engine';
import type { Seat } from '../state/game';
import type { SeatId } from '../state/events';
import { SplitFlap, formatMoney } from './SplitFlap';
import { SEAT_COLORS, TOKENS } from './tokens';

export interface DeparturesRowProps {
  seat: Seat;
  onActivate: (seat: SeatId) => void;
}

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
      <span style={{ width: 212 }}>
        <SplitFlap value={latest ? regionById(latest.region).name : ''} width={13} />
      </span>
      <span style={{ width: 436 }}>
        <SplitFlap value={latest ? cityById(latest.city).name : ''} width={14} />
      </span>
      <span style={{ width: 219 }}>
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
