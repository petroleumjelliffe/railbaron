import { useEffect, useRef, useState } from 'react';
import type { TurnRoll } from '../../engine';
import { BONUS_BEAT_TICKS, BONUS_FACES, COLORS, DICE_MS, DIE, WHITE_FACES, dieTurn, pipCells } from './dice';

/**
 * One drum: the face showing, the face still falling away, ticks left to
 * spin, and ticks left to wait before it may spin at all. `wait` is how the
 * bonus drum holds still while the whites are still turning, and then for
 * its own beat afterward — a drum with `wait > 0` renders unchanged and does
 * not count as stopped, whatever `left` says.
 */
interface Drum { cur: number; prev: number; left: number; wait: number; faces: number; }

const rest = (faces: number): Drum => ({ cur: 0, prev: 0, left: 0, wait: 0, faces });

const tick = (drum: Drum): Drum => {
  if (drum.wait > 0) return { ...drum, wait: drum.wait - 1 };
  if (drum.left <= 0) return drum.prev === drum.cur ? drum : { ...drum, prev: drum.cur };
  return { ...drum, cur: (drum.cur + 1) % drum.faces, prev: drum.cur, left: drum.left - 1 };
};

const stopped = (drum: Drum): boolean =>
  drum.wait <= 0 && drum.left <= 0 && drum.prev === drum.cur;

export interface DiceReadoutProps {
  /** The dice of the turn under way, or null when none has been rolled. */
  roll: TurnRoll | null;
  /** Whether tapping does anything — only the baron whose turn it is may roll. */
  live: boolean;
  onRoll?: () => void;
  /** Fires once, when every drum has stopped. The gate for committing a roll. */
  onLanded?: () => void;
}

/**
 * Three drums in the middle of the header: one pair of white dice on the
 * table, shared, plus the bonus die's own drum.
 *
 * The bonus drum is always there and rests on a black blank. That empty slot
 * is the design's point — it shows a Freight player what a Superchief gets
 * every turn, and makes the upgrade legible before you buy it rather than
 * after.
 *
 * Faces are not readable until the drums stop: the accessible name is the
 * value only once settled, which is the same rule the region panel follows.
 * A caller waiting on `onLanded` therefore cannot learn the roll early.
 */
export function DiceReadout({ roll, live, onRoll, onLanded }: DiceReadoutProps) {
  const [drums, setDrums] = useState<[Drum, Drum, Drum]>(
    () => [rest(WHITE_FACES), rest(WHITE_FACES), rest(BONUS_FACES)]
  );
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const landed = useRef<(() => void) | undefined>(onLanded);
  landed.current = onLanded;

  // Keyed on the faces rather than the object: the caller rebuilds `roll`
  // every render, and keying on identity would restart the drums every tick.
  const key = roll === null ? '' : `${roll.white[0]}-${roll.white[1]}-${roll.bonus ?? 0}`;
  // Seeded with a sentinel no real key can equal — not with `key` itself.
  // Seeding it with the mount-time key would make the very first effect run
  // a no-op whenever a roll is already present at mount (every test here,
  // and any re-render that lands with dice mid-turn), leaving the drums
  // silently parked at rest instead of turning to the awaited face.
  const started = useRef<string | undefined>(undefined);
  const [begun, setBegun] = useState(key);

  useEffect(() => {
    if (started.current === key) return;
    started.current = key;
    setBegun(key);
    if (timer.current !== null) { clearInterval(timer.current); timer.current = null; }
    if (roll === null) return;

    setDrums(current => {
      const whiteLeft0 = dieTurn(current[0].cur, roll.white[0] - 1, WHITE_FACES, true);
      const whiteLeft1 = dieTurn(current[1].cur, roll.white[1] - 1, WHITE_FACES, true);
      // The later of the two whites to land is when both have — they start
      // together, so the larger `left` decides it. `+ 1` is the extra tick
      // the trailing leaf takes to fall once a drum's `left` reaches zero,
      // and `beat` is the design's pause, held only when a bonus was earned:
      // the bonus drum does not wait its turn on the whites, but it does
      // wait a beat past them before it moves at all.
      const whiteTicks = Math.max(whiteLeft0, whiteLeft1);
      const beat = roll.bonus !== null ? BONUS_BEAT_TICKS : 0;
      return [
        { ...current[0], left: whiteLeft0, wait: 0 },
        { ...current[1], left: whiteLeft1, wait: 0 },
        // The bonus drum laps only when it is showing something: falling
        // round to the blank should look like the die being put away, not
        // thrown.
        { ...current[2],
          left: dieTurn(current[2].cur, roll.bonus ?? 0, BONUS_FACES, roll.bonus !== null),
          wait: whiteTicks + 1 + beat }
      ];
    });

    timer.current = setInterval(() => {
      setDrums(current => {
        const next: [Drum, Drum, Drum] = [tick(current[0]), tick(current[1]), tick(current[2])];
        // Gated on the same null-check as the clear, not fired unconditionally
        // whenever `stopped` is true: under fake timers a whole
        // `advanceTimersByTime` sweep can fire every tick before React ever
        // processes the batched updates, chaining dozens of these updater
        // calls together. Once landed, every later call in that chain still
        // sees `stopped` — an unguarded call would report the landing once
        // per remaining tick instead of once.
        if (next.every(stopped) && timer.current !== null) {
          clearInterval(timer.current);
          timer.current = null;
          landed.current?.();
        }
        return next;
      });
    }, DICE_MS);
  }, [key, roll]);

  useEffect(() => () => { if (timer.current !== null) clearInterval(timer.current); }, []);

  const turning = begun !== key || !drums.every(stopped);

  return (
    <div
      role="button"
      aria-label="Roll the dice"
      aria-disabled={!live}
      onClick={() => { if (live) onRoll?.(); }}
      style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        display: 'flex', alignItems: 'center', gap: DIE.gap,
        cursor: live ? 'pointer' : 'default'
      }}
    >
      {drums.map((drum, index) => {
        const bonus = index === 2;
        const face = (at: number) => (bonus ? at : at + 1);
        const leaf = (at: number) =>
          bonus
            ? (face(at) === 0 ? COLORS.bonusBlank : COLORS.bonusLeaf)
            : (at === drum.cur ? COLORS.whiteTop : COLORS.whiteBottom);
        const pip = bonus ? COLORS.bonusPip : COLORS.whitePip;
        const value = face(drum.cur);
        const name = turning
          ? (bonus ? 'Bonus die, turning' : 'White die, turning')
          : bonus
            ? (value === 0 ? 'Bonus die, not earned' : `Bonus die, ${value}`)
            : `White die, ${value}`;

        return (
          <span
            key={index}
            role="img"
            aria-label={name}
            style={{
              position: 'relative', display: 'inline-block',
              width: DIE.width, height: DIE.height, borderRadius: DIE.radius,
              background: COLORS.body, overflow: 'hidden',
              boxShadow: '0 3px 8px rgba(0,0,0,0.55)'
            }}
          >
            <Leaf half="top" bg={leaf(drum.cur)} pips={pipCells(face(drum.cur), pip)} />
            <Leaf half="bottom" bg={leaf(drum.prev)} pips={pipCells(face(drum.prev), pip)} />
          </span>
        );
      })}
    </div>
  );
}

function Leaf({ half, bg, pips }: {
  half: 'top' | 'bottom'; bg: string; pips: { bg: string }[];
}) {
  const top = half === 'top';
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', left: 0, [top ? 'top' : 'bottom']: 0,
        width: DIE.width, height: DIE.leafHeight, overflow: 'hidden', background: bg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,${top ? 0.18 : 0.12})`
      }}
    >
      <div
        style={{
          width: DIE.width, height: DIE.height, boxSizing: 'border-box',
          padding: DIE.padding, display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)',
          gap: DIE.pipGap,
          ...(top ? {} : { marginTop: DIE.bottomOffset })
        }}
      >
        {pips.map((cell, i) => (
          <div key={i} style={{ borderRadius: '50%', background: cell.bg }} />
        ))}
      </div>
    </div>
  );
}
