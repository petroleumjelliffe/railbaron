import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlap } from './useFlap';

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

/**
 * The probe builds its texts array inline, on purpose. `Board` derives its
 * texts from a `ScreenDef` its page recomputes every render, so the hook
 * really does receive a fresh array each time — including on the renders
 * its own ticks cause. Taking a ready-made array as a prop would hand the
 * hook a stable reference that the real caller never has, and would hide
 * exactly the bug the "keeps spinning" test is here to catch.
 */
function Probe({ text }: { text: string }) {
  const { rows, flapping, snap } = useFlap([text]);
  return (
    <div>
      <span data-testid="row0">{rows[0]!.map(face => face.top).join('').trimEnd()}</span>
      <span data-testid="flapping">{String(flapping)}</span>
      <button onClick={snap}>snap</button>
    </div>
  );
}

const row0 = () => screen.getByTestId('row0').textContent;
const flapping = () => screen.getByTestId('flapping').textContent;

beforeEach(() => {
  vi.useFakeTimers();
  setReducedMotion(false);
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('the flap hook', () => {
  it('shows the text straight away when nothing has changed yet', () => {
    render(<Probe text="DENVER" />);
    expect(row0()).toBe('DENVER');
    expect(flapping()).toBe('false');
  });

  it('spins through intermediate characters before arriving', () => {
    const { rerender } = render(<Probe text="A" />);
    rerender(<Probe text="D" />);

    act(() => { vi.advanceTimersByTime(52); });
    expect(row0()).toBe('B');            // en route, not yet arrived
    expect(flapping()).toBe('true');

    act(() => { vi.advanceTimersByTime(52 * 2); });
    expect(row0()).toBe('D');
    expect(flapping()).toBe('false');
  });

  it('keeps spinning across the re-renders its own ticks cause', () => {
    // Each tick sets state, which re-renders, which hands the hook a fresh
    // `texts` array. If the hook keys its effect on that array's identity
    // rather than its contents, the animation cancels itself after one tick.
    const { rerender } = render(<Probe text="A" />);
    rerender(<Probe text="J" />);

    act(() => { vi.advanceTimersByTime(52 * 3); });
    expect(row0()).toBe('D');            // still moving, three ticks in
    expect(flapping()).toBe('true');
  });

  it('snaps instantly and never spins when reduced motion is asked for', () => {
    setReducedMotion(true);
    const { rerender } = render(<Probe text="A" />);
    rerender(<Probe text="D" />);

    // No timer advance at all: it must already be there.
    expect(row0()).toBe('D');
    expect(flapping()).toBe('false');
  });

  it('abandons a transition in flight when a new one starts', () => {
    const { rerender } = render(<Probe text="A" />);
    rerender(<Probe text="Z" />);
    act(() => { vi.advanceTimersByTime(52 * 3); });
    expect(row0()).not.toBe('Z');

    rerender(<Probe text="B" />);
    act(() => { vi.advanceTimersByTime(52 * 30); });
    expect(row0()).toBe('B');           // the abandoned run did not win
  });

  it('settles immediately when tapped mid-flap', () => {
    const { rerender } = render(<Probe text="A" />);
    rerender(<Probe text="Z" />);
    act(() => { vi.advanceTimersByTime(52 * 2); });
    expect(row0()).not.toBe('Z');

    act(() => { screen.getByText('snap').click(); });
    expect(row0()).toBe('Z');
    expect(flapping()).toBe('false');
  });

  it('stops its timers when unmounted', () => {
    const { rerender, unmount } = render(<Probe text="A" />);
    rerender(<Probe text="Z" />);
    act(() => { vi.advanceTimersByTime(52); });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
