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
    <span style={{ display: 'inline-flex', gap: 1 }}>
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
