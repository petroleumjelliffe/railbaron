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

/**
 * jsdom normalises a `style.background` hex string to `rgb(r, g, b)` on
 * read, so a raw string comparison against `COLORS`'s hex constants never
 * matches either way — silently vacuous, not a real check. Converts the
 * hex constant to the same form the DOM will report.
 */
const asRgb = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

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

  it('clears a stale bonus face at the start of the next roll, not the end', () => {
    // Reported from live play: a player rolled 4+5 (not a double) and
    // believed the bonus roll had triggered. It cannot have — the engine
    // only grants a bonus on a double, pinned elsewhere — so the readout
    // itself must have shown something misleading. This pins the fix: once
    // a previous roll left the bonus drum showing a number, a following
    // roll that earns no bonus must fall the drum to blank as the whites
    // *begin* turning, not hold the stale face and drop it only once the
    // whites land.
    const { rerender } = render(<DiceReadout roll={{ white: [6, 6], bonus: 5 }} live={false} />);
    settle();
    expect(screen.getByRole('img', { name: 'Bonus die, 5' })).toBeInTheDocument();

    rerender(<DiceReadout roll={{ white: [4, 5], bonus: null }} live={false} />);
    // Three ticks in — the whites (11+ ticks to land) are still well into
    // their spin. The bonus drum only needed two ticks to fall from 5 to
    // the blank, so by now both its leaves must already show the blank,
    // not the stale red "5".
    act(() => { vi.advanceTimersByTime(3 * DICE_MS); });

    const bonusDie = screen.getByRole('img', { name: /Bonus die/i });
    const [top, bottom] = bonusDie.querySelectorAll('[aria-hidden]');
    expect(top).toHaveStyle({ background: COLORS.bonusBlank });
    expect(bottom).toHaveStyle({ background: COLORS.bonusBlank });
  });

  it('puts the dice away between turns, rather than leaving a face on the table', () => {
    // The other half of the same report, and the gap the tick-by-tick record
    // below cannot see: between one baron's turn and the next there is no
    // roll at all, and nothing ticks until somebody taps. A readout that only
    // clears the stale face when the *next* roll starts leaves the previous
    // player's bonus number showing for the whole of the wait.
    const { rerender } = render(<DiceReadout roll={{ white: [6, 6], bonus: 5 }} live={false} />);
    settle();
    expect(screen.getByRole('img', { name: 'Bonus die, 5' })).toBeInTheDocument();

    rerender(<DiceReadout roll={null} live />);

    expect(screen.getByRole('img', { name: 'Bonus die, not earned' })).toBeInTheDocument();
    const bonusDie = screen.getByRole('img', { name: /Bonus die/i });
    const [top, bottom] = bonusDie.querySelectorAll('[aria-hidden]');
    expect(top).toHaveStyle({ background: COLORS.bonusBlank });
    expect(bottom).toHaveStyle({ background: COLORS.bonusBlank });
    // And the whites are back on the table too, not showing the six they rolled.
    expect(screen.getAllByRole('img', { name: 'White die, 1' })).toHaveLength(2);
  });

  it('documents what the bonus drum shows, tick by tick, across a stale-face transition', () => {
    // Investigative record for the same report: confirms (a) the drum
    // never holds the stale face once the fix is in place, and (b) it
    // never *settles* — fully stopped, name readable — on a nonzero face
    // for a roll that earned no bonus. (b) would be a hard engine-adjacent
    // bug; only (a) being true (pre-fix) meant the report was perceptual.
    const { rerender } = render(<DiceReadout roll={{ white: [6, 6], bonus: 5 }} live={false} />);
    settle();

    rerender(<DiceReadout roll={{ white: [4, 5], bonus: null }} live={false} />);

    const record: { name: string; top: string; bottom: string }[] = [];
    for (let t = 1; t <= 16; t++) {
      act(() => { vi.advanceTimersByTime(DICE_MS); });
      const bonusDie = screen.getByRole('img', { name: /Bonus die/i });
      const [top, bottom] = bonusDie.querySelectorAll('[aria-hidden]');
      record.push({
        name: bonusDie.getAttribute('aria-label') ?? '',
        top: (top as HTMLElement).style.background,
        bottom: (bottom as HTMLElement).style.background
      });
    }

    // Never held on the stale face past the drum's own two-tick fall.
    expect(record.slice(2).some(r => r.top === asRgb(COLORS.bonusLeaf))).toBe(false);
    // Never settles readable on a number: once every drum (including the
    // bonus one) has genuinely stopped, it must be the blank.
    const settled = record[record.length - 1]!;
    expect(settled.name).toBe('Bonus die, not earned');
    expect(settled.top).toBe(asRgb(COLORS.bonusBlank));
    expect(settled.bottom).toBe(asRgb(COLORS.bonusBlank));
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
