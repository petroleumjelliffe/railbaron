import type { RegionId } from '../../engine';
import type { SeatId } from '../state/events';
import { SEATS } from '../state/events';
import type { GameState } from '../state/game';
import { DeparturesRow } from './DeparturesRow';
import { RegionBallot } from './RegionBallot';
import { TOKENS } from './tokens';

export interface DeparturesBoardProps {
  state: GameState;
  onActivate: (seat: SeatId) => void;
  onChooseRegion: (seat: SeatId, region: RegionId) => void;
}

export function DeparturesBoard({ state, onActivate, onChooseRegion }: DeparturesBoardProps) {
  // Only one seat can be owed a region at a time — it is the app's one modal
  // state, and it takes over the board rather than opening a dialog.
  const awaiting = SEATS.map(id => state.seats[id]).find(seat => seat.awaiting !== null);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: TOKENS.board,
        border: `14px solid ${TOKENS.bezel}`,
        boxShadow: 'inset 0 0 0 1px #262626'
      }}
    >
      <header
        style={{
          flex: '0 0 78px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 34px',
          background: TOKENS.header,
          borderBottom: '1px solid #2a2a2a'
        }}
      >
        <span
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '0.22em',
            color: TOKENS.amber,
            textTransform: 'uppercase'
          }}
        >
          Rail Baron
        </span>
        <span
          style={{
            fontFamily: "'DM Mono', ui-monospace, monospace",
            fontSize: 13,
            letterSpacing: '0.22em',
            color: TOKENS.dim,
            textTransform: 'uppercase'
          }}
        >
          {awaiting ? `${awaiting.name ?? awaiting.id} rolled its own region` : 'Departures'}
        </span>
      </header>

      {awaiting ? (
        <RegionBallot
          seat={awaiting}
          onChoose={region => onChooseRegion(awaiting.id, region)}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 34px 20px' }}>
          {SEATS.map(id => (
            <DeparturesRow key={id} seat={state.seats[id]} onActivate={onActivate} />
          ))}
        </div>
      )}
    </div>
  );
}
