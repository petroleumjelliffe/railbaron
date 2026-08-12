import { describe, expect, it } from 'vitest';
import { panelFaces, rowDrums, type RowText } from './choreography';
import { advance, isSettled } from './drum';
import type { RowDrums } from './choreography';

const REGIONS = ['', 'Northeast', 'North Central', 'Plains', 'Southwest'];

/** The tick each column lands on, found by turning the drums as the board does. */
function settleTicks(drums: RowDrums) {
  const at = { status: -1, text: -1, amount: -1 };
  let current = drums;
  for (let tick = 0; tick <= 500; tick++) {
    if (at.status < 0 && isSettled(current.status)) at.status = tick;
    if (at.text < 0 && isSettled(current.text)) at.text = tick;
    if (at.amount < 0 && isSettled(current.amount)) at.amount = tick;
    if (at.status >= 0 && at.text >= 0 && at.amount >= 0) return at;
    current = {
      status: advance(current.status),
      text: advance(current.text),
      amount: advance(current.amount)
    };
  }
  throw new Error('a column never settled');
}

const roll = (from: RowText, to: RowText) => {
  const drums = rowDrums(from, to, panelFaces([from], [to]));
  if (drums === null) throw new Error('expected the row to flap');
  return settleTicks(drums);
};

describe('the order a roll arrives in', () => {
  it('lands the region, then the city, then the payout', () => {
    const at = roll(
      { status: 'Northeast', text: 'Boston', amount: '5,000' },
      { status: 'Plains', text: 'Denver', amount: '21,000' }
    );
    expect(at.status).toBeLessThan(at.text);
    expect(at.text).toBeLessThan(at.amount);
  });

  it('still lands the payout last when the city has not changed', () => {
    // A roll that sends a baron to their own home town leaves the city where
    // it is, so its drum has nothing to travel. Scheduling the payout behind
    // the city alone would let HOME appear before the region explaining it.
    const at = roll(
      { status: 'Northeast', text: 'Boston', amount: '5,000' },
      { status: 'Northeast', text: 'Boston', amount: '' }
    );
    expect(at.status).toBeLessThan(at.amount);
    // The city column itself stays still — a baron sent home has not moved —
    // so what matters is that the payout waits for the region regardless.
    expect(at.text).toBe(0);
  });

  it('still turns the panel when the region rolled is the one already showing', () => {
    const at = roll(
      { status: 'Plains', text: 'Denver', amount: '9,000' },
      { status: 'Plains', text: 'Omaha', amount: '4,000' }
    );
    expect(at.status).toBeGreaterThan(0);
    expect(at.status).toBeLessThan(at.text);
  });

  it('still turns the payout when the figure is the one already showing', () => {
    const at = roll(
      { status: 'Plains', text: 'Denver', amount: '9,000' },
      { status: 'Southwest', text: 'Phoenix', amount: '9,000' }
    );
    expect(at.amount).toBeGreaterThan(at.text);
  });

  it('resolves a whole roll in about three seconds at worst', () => {
    // 52ms a tick. The worst case is a city whose letters have the furthest
    // to travel; anything much beyond this is a wait on every single turn.
    let worst = 0;
    for (const city of ['Salt Lake City', 'Albany', 'Zanesville', 'A']) {
      const at = roll(
        { status: 'Northeast', text: 'Boston', amount: '5,000' },
        { status: 'Plains', text: city, amount: '35,000' }
      );
      worst = Math.max(worst, at.amount);
    }
    expect(worst * 52).toBeLessThan(3200);
  });
});

describe('columns with nothing to say', () => {
  it('does not flap a row where nothing changed', () => {
    const row: RowText = { status: 'Plains', text: 'Denver', amount: '9,000' };
    expect(rowDrums(row, row, REGIONS)).toBeNull();
  });

  it('leaves an empty panel and an empty payout still while a name is typed', () => {
    // The setup screens have no region and no payout. Turning those columns
    // through the board's vocabulary to arrive back at blank would be noise,
    // and would hold the row flapping after the name had landed.
    const at = roll(
      { status: '', text: 'Tap to join', amount: '' },
      { status: '', text: 'Ada', amount: '' }
    );
    expect(at.status).toBe(0);
    expect(at.amount).toBe(0);
    expect(at.text).toBeGreaterThan(0);
  });
});

describe('what the panel can flip through', () => {
  it('offers every value on the board, before and after, plus a blank', () => {
    const faces = panelFaces(
      [{ status: 'Northeast', text: '', amount: '' }],
      [{ status: 'Plains', text: '', amount: '' }]
    );
    expect(faces).toContain('');
    expect(faces).toContain('Northeast');
    expect(faces).toContain('Plains');
  });

  it('never offers the same value twice, so a panel cannot land on the wrong one', () => {
    const rows = [
      { status: 'Choose', text: '', amount: '' },
      { status: 'Rolled', text: '', amount: '' },
      { status: 'Choose', text: '', amount: '' }
    ];
    const faces = panelFaces(rows, rows);
    expect(new Set(faces).size).toBe(faces.length);
  });
});
