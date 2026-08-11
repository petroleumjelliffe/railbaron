import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('the app', () => {
  beforeEach(() => localStorage.clear());

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
});
