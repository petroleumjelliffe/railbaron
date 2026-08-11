import { TOKENS } from './tokens';

export interface SplitFlapProps {
  value: string;
  width: number;
  align?: 'left' | 'right';
  tone?: 'pale' | 'amber';
}

/**
 * A payout of 0 is a real amount — the board's two twin-city pairs pay it.
 * Only null means "no payout applies".
 */
export function formatMoney(payout: number | null): string {
  if (payout === null) return 'HOME';
  return `$${payout.toLocaleString('en-US')}`;
}

function pad(value: string, width: number, align: 'left' | 'right'): string[] {
  const text = value.toUpperCase().slice(0, width);
  const gap = ' '.repeat(width - text.length);
  return (align === 'right' ? gap + text : text + gap).split('');
}

export function SplitFlap({ value, width, align = 'left', tone = 'pale' }: SplitFlapProps) {
  const characters = pad(value, width, align);
  const color = tone === 'amber' ? TOKENS.amber : TOKENS.pale;

  return (
    <span style={{ display: 'inline-flex', gap: TOKENS.tileGap }}>
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clipPath: 'inset(50%)'
        }}
      >
        {value.toUpperCase()}
      </span>
      {characters.map((character, index) => (
        <span
          key={index}
          data-flap={character}
          aria-hidden="true"
          style={{
            width: TOKENS.tileWidth,
            height: TOKENS.tileHeight,
            lineHeight: `${TOKENS.tileHeight}px`,
            textAlign: 'center',
            fontSize: 31,
            color,
            background: `linear-gradient(180deg, ${TOKENS.flapTop} 0 50%, ${TOKENS.flapBottom} 50% 100%)`,
            borderRadius: 3,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)'
          }}
        >
          {character === ' ' ? ' ' : character}
        </span>
      ))}
    </span>
  );
}

export interface FlapPanelProps {
  value: string;
  width: number;
}

/**
 * A single flap panel showing a whole string at once, rather than one tile
 * per character. This is the departures-board's region field: a region name
 * is a label, not a fixed-width character grid, so it gets one physical
 * flap the width of the column instead of thirteen tiles that don't fit.
 *
 * It shares SplitFlap's look (the same top/bottom gradient halves and inset
 * highlight) and its accessibility approach (a visually-hidden copy of the
 * plain text sits alongside an aria-hidden visible label) so it reads as
 * the same kind of object, both on screen and to a screen reader.
 */
export function FlapPanel({ value, width }: FlapPanelProps) {
  const text = value.toUpperCase();

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height: TOKENS.tileHeight,
        borderRadius: 3,
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${TOKENS.flapTop} 0 50%, ${TOKENS.flapBottom} 50% 100%)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)'
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clipPath: 'inset(50%)'
        }}
      >
        {text}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: TOKENS.pale
        }}
      >
        {text}
      </span>
    </span>
  );
}
