import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY } from './state/storage';
import type { GameEvent } from './state/events';

/**
 * Every transition snaps rather than spinning. The flap itself is covered
 * in Board.test/useFlap.test; here it would only add up to two seconds of
 * real time per navigation, and while a flap is running the status and
 * note columns are deliberately blank — so assertions against them would
 * be racing the animation rather than testing the app.
 */
function snapTransitions() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

const at = (path: string, rng?: () => number) =>
  render(<MemoryRouter initialEntries={[path]}><App rng={rng} /></MemoryRouter>);

const seed = (events: GameEvent[]) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, savedAt: Date.now(), events }));

const storedTypes = () =>
  (JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { events: GameEvent[] })
    .events.map(event => event.type);

async function name(seatRowName: RegExp, value: string) {
  await userEvent.click(screen.getByRole('button', { name: seatRowName }));
  await userEvent.keyboard(`${value}{Enter}`);
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  snapTransitions();
});

describe('seating and starting', () => {
  it('seats two barons and begins, writing one event per action', async () => {
    at('/pass-and-play');
    await name(/seat 1/i, 'PETE');
    await name(/seat 2/i, 'ALEX');

    expect(screen.getByText('PETE')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /start game/i }));

    expect(storedTypes()).toEqual(['joined', 'joined', 'started']);
  });

  it('appends exactly one event per action under StrictMode', async () => {
    // The roll's side effect still lives in the handler and StrictMode
    // still double-invokes updaters. Losing window.prompt retired one half
    // of this hazard, not the hazard.
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/pass-and-play']}><App /></MemoryRouter>
      </StrictMode>
    );
    await name(/seat 1/i, 'PETE');
    await name(/seat 2/i, 'ALEX');
    await userEvent.click(screen.getByRole('button', { name: /start game/i }));

    expect(storedTypes()).toEqual(['joined', 'joined', 'started']);
  });
});

// The scripted values below were confirmed by direct execution against
// engine/roll.ts before being wired in here (not derived by hand alone):
//
//   rollRow(rng) = floor(r1*6) + floor(r2*6) + floor(r3*2)*11, three draws
//   per call. Every triple below is chosen so floor(r1*6)=0, floor(r2*6)=0
//   and floor(r3*2)=0, i.e. row 0 every time — CODES[0] = [6,4,8,1,10,5,8,2].
//
//   Triple 1 (0.05, 0.10, 0.20) — rollRegion for the home roll: row 0,
//   CODES[0][0]=6, REGIONS[6]='SW'. Home region is Southwest.
//
//   Triple 2 (0.02, 0.08, 0.40) — rollCityIn('SW', ...) for the home roll:
//   row 0, SW's column is 7, CODES[0][7]=2, citiesIn('SW')[2]='Los Angeles'
//   (id 59). Home town: Los Angeles.
//
//   Triple 3 (0.10, 0.15, 0.45) — rollRegion for the second roll: row 0
//   again, region 'SW' — the seat's own region (Los Angeles is in SW), so
//   rollDestination returns 'chooseRegion' instead of a city, and the
//   ballot appears.
//
//   Triple 4 (0.01, 0.12, 0.49) — after picking Northeast, rollCityIn('NE',
//   ...) for destinationInRegion: row 0, NE's column is 1, CODES[0][1]=4,
//   citiesIn('NE')[4]='New York' (id 4). payoutBetween(59, 4) = 31000, i.e.
//   $31,000 (PAYOUT_TABLE[59][4] = 31, in thousands).
describe('the full ballot path', () => {
  it('scripts dice through the ballot and shows the payout that lands', async () => {
    const values = [
      0.05, 0.10, 0.20,
      0.02, 0.08, 0.40,
      0.10, 0.15, 0.45,
      0.01, 0.12, 0.49
    ];
    let i = 0;
    const rng = () => {
      const value = values[i++];
      if (value === undefined) {
        throw new Error('rng exhausted: scripted for fewer draws than were requested');
      }
      return value;
    };

    seed([
      { type: 'joined', seat: 'red', name: 'PETE' },
      { type: 'joined', seat: 'blue', name: 'ALEX' },
      { type: 'started' }
    ]);
    at('/pass-and-play/game', rng);

    // Roll #1: the home town.
    await userEvent.click(screen.getByRole('button', { name: /pete/i }));
    expect(screen.getByText('Los Angeles')).toBeInTheDocument();
    expect(screen.getByText('HOME')).toBeInTheDocument();

    // Roll #2: names the seat's own region, so the ballot takes over the
    // whole board instead of a destination arriving.
    await userEvent.click(screen.getByRole('button', { name: /pete/i }));
    const northeast = screen.getByRole('button', { name: /northeast/i });
    expect(northeast).toBeInTheDocument();

    await userEvent.click(northeast);

    expect(screen.getByText('New York')).toBeInTheDocument();
    expect(screen.getByText('31,000')).toBeInTheDocument();
  });
});

describe('discarding a saved game', () => {
  const started: GameEvent[] = [
    { type: 'joined', seat: 'red', name: 'PETE' },
    { type: 'joined', seat: 'blue', name: 'ALEX' },
    { type: 'started' }
  ];

  it('offers the saved game back rather than an empty board', () => {
    seed(started);
    at('/pass-and-play');
    expect(screen.getByRole('button', { name: /continue game/i })).toBeInTheDocument();
  });

  it('confirms before discarding, and honours a decline', async () => {
    seed(started);
    at('/pass-and-play');

    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(screen.getByRole('button', { name: /yes, discard/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /keep playing/i }));
    expect(screen.getByRole('button', { name: /continue game/i })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('empties the board and clears storage once discarding is confirmed', async () => {
    seed(started);
    at('/pass-and-play');

    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, discard/i }));

    // Rendered state, not internals: six open seats and no way back to the
    // game that was there.
    expect(screen.getAllByRole('button', { name: /tap to join/i })).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /continue game/i })).toBeNull();

    // The key is genuinely gone, not left behind holding an empty log:
    // useGame's save effect skips persisting when the log is empty, so
    // reset()'s clearLog() isn't undone by the render it triggers.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
