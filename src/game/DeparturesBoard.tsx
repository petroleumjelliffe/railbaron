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
  onReset: () => void;
}

export function DeparturesBoard({ state, onActivate, onChooseRegion, onReset }: DeparturesBoardProps) {
  // Only one seat can be owed a region at a time — it is the app's one modal
  // state, and it takes over the board rather than opening a dialog.
  const awaiting = SEATS.map(id => state.seats[id]).find(seat => seat.awaiting !== null);
  const hasBarons = SEATS.some(id => state.seats[id].name !== null);

  const handleReset = () => {
    // The header is reachable by accident on a tablet; confirm before a tap
    // destroys a game in progress.
    if (window.confirm('Start a new game? This clears every baron on the board.')) {
      onReset();
    }
  };

  // Shared by the status span and the New Game button — same type
  // treatment, so it's one declaration rather than two copies to keep in
  // sync.
  const headerType = {
    fontFamily: "'DM Mono', ui-monospace, monospace",
    fontSize: 13,
    letterSpacing: '0.22em',
    color: TOKENS.dim,
    textTransform: 'uppercase' as const
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={headerType}>
            {awaiting ? `${awaiting.name ?? awaiting.id} rolled its own region` : 'Departures'}
          </span>
          {hasBarons && !awaiting && (
            <button
              type="button"
              onClick={handleReset}
              style={{ ...headerType, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              New Game
            </button>
          )}
        </div>
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
