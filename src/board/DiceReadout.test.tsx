import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLORS, DICE_MS } from './dice';
import { DiceReadout } from './DiceReadout';

/**
 * `@testing-library/react`'s internal `act()` flushing looks for a global
 * `jest.advanceTimersByTime` directly rather than the function passed to
 * `userEvent.setup({ advanceTimers })` — a known upstream gap
 * (testing-library/react-testing-library#1197, vitest-dev/vitest#3184).
 * Without this, `await user.click(...)` under fake timers never resolves.
 */
beforeAll(() => {
  const previous = (globalThis as { jest?: unknown }).jest;
  (globalThis as { jest?: unknown }).jest = { advanceTimersByTime: vi.advanceTimersByTime.bind(vi) };
  return () => { (globalThis as { jest?: unknown }).jest = previous; };
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Runs the drums to a standstill. */
const settle = () => act(() => { vi.advanceTimersByTime(4000); });

describe('the dice readout', () => {
  it('shows three dice, always', () => {
    render(<DiceReadout roll={null} live={false} />);
    expect(screen.getAllByRole('img', { name: /die/i })).toHaveLength(3);
  });

  it('leaves the bonus die blank when none was earned', () => {
    render(<DiceReadout roll={{ white: [3, 4], bonus: null }} live={false} />);
    settle();
    expect(screen.getByRole('img', { name: 'Bonus die, not earned' })).toBeInTheDocument();
  });

  it('shows the bonus die when one was', () => {
    render(<DiceReadout roll={{ white: [6, 6], bonus: 5 }} live={false} />);
    settle();
    expect(screen.getByRole('img', { name: 'Bonus die, 5' })).toBeInTheDocument();
  });

  it('names the white faces once the drums stop', () => {
    render(<DiceReadout roll={{ white: [3, 4], bonus: null }} live={false} />);
    settle();
    expect(screen.getByRole('img', { name: 'White die, 3' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'White die, 4' })).toBeInTheDocument();
  });

  it('does not name the faces while the drums are still turning', () => {
    render(<DiceReadout roll={{ white: [3, 4], bonus: null }} live={false} />);
    act(() => { vi.advanceTimersByTime(78); });
    expect(screen.getAllByRole('img', { name: /turning/i })).toHaveLength(3);
    expect(screen.queryByRole('img', { name: /White die, \d/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Bonus die, \d/ })).not.toBeInTheDocument();
  });

  it('reports the landing once, when every drum has stopped', () => {
    const onLanded = vi.fn();
    render(<DiceReadout roll={{ white: [3, 4], bonus: null }} live={false} onLanded={onLanded} />);
    act(() => { vi.advanceTimersByTime(78); });
    expect(onLanded).not.toHaveBeenCalled();
    settle();
    expect(onLanded).toHaveBeenCalledTimes(1);
  });

  it('does not report landing during the bonus drum\'s wait, only once it too has stopped', () => {
    const onLanded = vi.fn();
    // Both white drums reach index 5 (face 6) from rest in 11 ticks, plus one
    // more for the trailing leaf to fall — fully stopped at tick 12. The
    // bonus drum's wait (whiteTicks + 1 + BONUS_BEAT_TICKS = 11 + 1 + 4 = 16)
    // holds it past that, so landing must not be reported anywhere through
    // tick 16 — the whites being done is not the whole roll being done.
    render(<DiceReadout roll={{ white: [6, 6], bonus: 5 }} live={false} onLanded={onLanded} />);
    act(() => { vi.advanceTimersByTime(16 * DICE_MS); });
    expect(onLanded).not.toHaveBeenCalled();
    settle();
    expect(onLanded).toHaveBeenCalledTimes(1);
  });

  it('holds the bonus drum on the blank until the whites have landed and its own beat has passed', () => {
    render(<DiceReadout roll={{ white: [6, 6], bonus: 5 }} live={false} />);
    // Tick 12 is exactly when both white drums have landed and their
    // trailing leaf has fallen (see the timing note above). The bonus
    // drum's wait has not elapsed at that point, so it must still be
    // resting on the blank — not partway into its own spin toward 5. The
    // accessible name can't tell these apart (the whole readout reports
    // "turning" as one unit until every drum, bonus included, has genuinely
    // stopped), so this checks what the drum is actually showing: the top
    // leaf's colour is the blank's, not the numbered leaf's.
    act(() => { vi.advanceTimersByTime(12 * DICE_MS); });
    const bonusDie = screen.getByRole('img', { name: /Bonus die/i });
    const topLeaf = bonusDie.querySelector('[aria-hidden]');
    expect(topLeaf).toHaveStyle({ background: COLORS.bonusBlank });
  });

  it('rolls when tapped, but only when it is live', async () => {
    const onRoll = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<DiceReadout roll={null} live={false} onRoll={onRoll} />);
    await user.click(screen.getByRole('button', { name: /roll the dice/i }));
    expect(onRoll).not.toHaveBeenCalled();
    rerender(<DiceReadout roll={null} live onRoll={onRoll} />);
    await user.click(screen.getByRole('button', { name: /roll the dice/i }));
    expect(onRoll).toHaveBeenCalledTimes(1);
  });
});
