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
});
