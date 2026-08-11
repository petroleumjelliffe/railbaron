import { REGIONS, type RegionId } from '../../engine';
import type { Seat } from '../state/game';
import { SEAT_COLORS, TOKENS } from './tokens';

export interface RegionBallotProps {
  seat: Seat;
  onChoose: (region: RegionId) => void;
}

/**
 * Shown when a roll named the region the baron is already in. The seven
 * regions take over the destination column, one per row, so the board keeps
 * its shape instead of opening a dialog over it.
 */
export function RegionBallot({ seat, onChoose }: RegionBallotProps) {
  return (
    <div
      role="group"
      aria-label={`Choose a region for ${seat.name ?? seat.id}`}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 34px 20px' }}
    >
      {REGIONS.map(region => {
        const repeat = region.id === seat.awaiting;
        return (
          <button
            key={region.id}
            type="button"
            onClick={() => onChoose(region.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              flex: 1,
              border: 0,
              borderBottom: `1px solid ${TOKENS.rule}`,
              background: 'transparent',
              color: repeat ? TOKENS.dim : TOKENS.amber,
              font: 'inherit',
              fontSize: 29,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
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
                background: SEAT_COLORS[seat.id]
              }}
            />
            <span style={{ paddingLeft: 14 }}>{region.name}</span>
          </button>
        );
      })}
    </div>
  );
}
