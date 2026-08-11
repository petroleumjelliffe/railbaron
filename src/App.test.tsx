import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY } from './state/storage';

describe('the app', () => {
  beforeEach(() => {
    localStorage.clear();
    // window.prompt is spied on in more than one test below; without this,
    // vi.spyOn reuses the same mock across tests and call counts accumulate,
    // making the exactly-once assertions meaningless.
    vi.restoreAllMocks();
  });

  it('seats a baron, rolls a home town, and keeps it across a remount', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Pete');
    const first = render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: /tap to join/i })[0]!);
    expect(screen.getByText('PETE')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /pete/i }));
    expect(screen.getByText('HOME')).toBeInTheDocument();

    first.unmount();
    render(<App />);
    expect(screen.getByText('PETE')).toBeInTheDocument();
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  // StrictMode is how main.tsx actually renders the app, and it deliberately
  // double-invokes state updaters to surface impure ones. If a tap's side
  // effects (window.prompt, the dice roll) live inside the setEvents updater
  // rather than the event handler, the user sees two name dialogs and two
  // rolls get consumed for one destination — the log stays correct because
  // React keeps only the final updater result, but the *effects* still fire
  // twice. These tests watch the effect count, not the resulting log.
  it('prompts for a name exactly once under StrictMode, even though updaters run twice', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Pete');
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    await userEvent.click(screen.getAllByRole('button', { name: /tap to join/i })[0]!);

    expect(window.prompt).toHaveBeenCalledTimes(1);
  });

  it('appends exactly one event per roll under StrictMode', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Pete');
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    await userEvent.click(screen.getAllByRole('button', { name: /tap to join/i })[0]!);
    await userEvent.click(screen.getByRole('button', { name: /pete/i }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { events: unknown[] };
    // 'joined' + one roll's worth of 'arrived' (or 'regionRequested') — never two.
    expect(stored.events).toHaveLength(2);
  });

  // useGame's rng has no route through App unless App exposes it, so this is
  // the only test that drives chooseRegion — the glue that turns a ballot
  // pick into an 'arrived' event with a real payout. The scripted values
  // below were confirmed by direct execution against engine/roll.ts before
  // being wired in here (not derived by hand alone):
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
  //
  // Verified by running rollDestination(null, rng) then
  // rollDestination(59, rng) then destinationInRegion(59, 'NE', rng) with
  // this exact queue and reading the real output: home = Los Angeles/SW,
  // second = { kind: 'chooseRegion', rolled: 'SW' }, arrival = New York,
  // payout 31000 — all 12 scripted draws consumed, none left over.
  it('scripts dice through the full ballot path and shows the payout that lands', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Pete');

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

    render(<App rng={rng} />);

    await userEvent.click(screen.getAllByRole('button', { name: /tap to join/i })[0]!);
    expect(screen.getByText('PETE')).toBeInTheDocument();

    // Roll #1: the home town.
    await userEvent.click(screen.getByRole('button', { name: /pete/i }));
    expect(screen.getByText('LOS ANGELES')).toBeInTheDocument();
    expect(screen.getByText('HOME')).toBeInTheDocument();

    // Roll #2: names the seat's own region, so the ballot takes over instead
    // of a destination.
    await userEvent.click(screen.getByRole('button', { name: /pete/i }));
    const northeast = screen.getByRole('button', { name: /northeast/i });
    expect(northeast).toBeInTheDocument();

    // Pick Northeast from the ballot.
    await userEvent.click(northeast);

    expect(screen.getByText('NEW YORK')).toBeInTheDocument();
    expect(screen.getByText('$31,000')).toBeInTheDocument();
  });

  it('has no New Game button on a fresh board — nothing to reset yet', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: /new game/i })).not.toBeInTheDocument();
  });

  it('confirms before a New Game tap wipes the board, and honors a decline', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Pete');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: /tap to join/i })[0]!);
    expect(screen.getByText('PETE')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /new game/i }));

    // Declined: the baron already on the board is untouched, in the DOM and
    // in the persisted log alike.
    expect(screen.getByText('PETE')).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { events: unknown[] };
    expect(stored.events).toHaveLength(1);
  });

  it('empties the board and clears storage once New Game is confirmed', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Pete');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await userEvent.click(screen.getAllByRole('button', { name: /tap to join/i })[0]!);
    expect(screen.getByText('PETE')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /new game/i }));

    // Rendered state, not internals: the board is back to six open seats
    // and the button that started it is gone along with the baron it named.
    expect(screen.queryByText('PETE')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /tap to join/i })).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /new game/i })).not.toBeInTheDocument();

    // The key is genuinely gone, not left behind holding an empty log:
    // useGame's save effect skips persisting when the log is empty, so
    // reset()'s clearLog() call isn't immediately undone by the render it
    // triggers.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
