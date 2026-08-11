import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SplitFlap, formatMoney } from './SplitFlap';

const tiles = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-flap]')].map(el => el.getAttribute('data-flap'));

describe('a split-flap field', () => {
  it('shows one tile per character position, always the same number', () => {
    const { container } = render(<SplitFlap value="DENVER" width={14} />);
    expect(tiles(container)).toHaveLength(14);
  });

  it('reads out as plain text for anything not looking at pixels', () => {
    render(<SplitFlap value="Denver" width={14} />);
    expect(screen.getByText('DENVER')).toBeInTheDocument();
  });

  it('uppercases, because the flaps have no lower case', () => {
    const { container } = render(<SplitFlap value="Salt Lake City" width={14} />);
    expect(tiles(container).join('').trimEnd()).toBe('SALT LAKE CITY');
  });

  it('pads short values and truncates long ones rather than reflowing', () => {
    const { container } = render(<SplitFlap value="RENO" width={6} />);
    expect(tiles(container)).toEqual(['R', 'E', 'N', 'O', ' ', ' ']);

    const long = render(<SplitFlap value="ABCDEFGH" width={4} />);
    expect(tiles(long.container)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('right-aligns when asked, for money', () => {
    const { container } = render(<SplitFlap value="500" width={6} align="right" />);
    expect(tiles(container)).toEqual([' ', ' ', ' ', '5', '0', '0']);
  });

  it('leaves an exact-length value untouched — no padding, no truncation', () => {
    const { container } = render(<SplitFlap value="DENVER" width={6} />);
    expect(tiles(container)).toEqual(['D', 'E', 'N', 'V', 'E', 'R']);
  });

  it('renders an empty value as all-blank tiles, without a negative pad count', () => {
    const { container } = render(<SplitFlap value="" width={4} />);
    expect(tiles(container)).toEqual([' ', ' ', ' ', ' ']);
  });

  it('truncates before aligning, so a right-aligned overflow is not padded', () => {
    const { container } = render(<SplitFlap value="ABCDEFGH" width={4} align="right" />);
    expect(tiles(container)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('formatting money', () => {
  it('shows a zero payout as $0, not as blank', () => {
    // Minneapolis to St. Paul really does pay nothing.
    expect(formatMoney(0)).toBe('$0');
  });

  it('groups thousands', () => {
    expect(formatMoney(21500)).toBe('$21,500');
  });

  it('says HOME when there is no payout at all', () => {
    expect(formatMoney(null)).toBe('HOME');
  });
});
