import { useMemo } from 'react';
import {
  cityById, nodeForCity, path as pathOf,
  type NodeId, type RegionId, type TurnRoll
} from '../../engine';
import { DiceReadout } from '../board/DiceReadout';
import { SEAT_COLORS } from '../game/tokens';
import { SEATS, type SeatId } from '../state/events';
import type { GameState } from '../state/game';
import { needsDestination } from '../state/turns';
import { CITY_R, DOT_R, layout, RAILROADS, sizeCandidates, type Placed } from './geo';
import { markers, pawns, type Marker } from './lit';
import { PLAYBACK_MS, usePlayback } from './usePlayback';
import { useRoute } from './useRoute';

const WIDTH = 1400;
const HEIGHT = 788;

/** One per region, so a city reads as its region before you read its name. */
const REGION_COLOR: Record<RegionId, string> = {
  NE: '#ff6b5a',
  SE: '#ffb347',
  NC: '#7ad67f',
  SC: '#4fc9d4',
  PL: '#7aa6ff',
  NW: '#c58cff',
  SW: '#ff7ab8'
};

/** Unlit lamps still catch a little light, exactly as on a real board. */
const DIM = 0.3;

/** At most three lines are drawn per segment; shared trackage runs deeper. */
const MAX_LINES_PER_EDGE = 3;
const LINE_SPREAD = 1.7;

function Track({ nodes, edges }: Pick<ReturnType<typeof layout>, 'edges'> & { nodes: Map<string, Placed> }) {
  const segments = useMemo(() => edges.flatMap(edge => {
    const a = nodes.get(edge.a);
    const b = nodes.get(edge.b);
    if (!a || !b) return [];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    // Perpendicular, so several railroads over one stretch of track lie
    // side by side rather than on top of one another.
    const nx = -dy / length;
    const ny = dx / length;
    const lines = edge.railroads.slice(0, MAX_LINES_PER_EDGE);
    const offset = (lines.length - 1) / 2;
    return [{ key: `${edge.a}-${edge.b}`, a, b, nx, ny, lines, offset }];
  }), [edges, nodes]);

  return (
    <>
      <g>
        {segments.map(s => (
          <line
            key={s.key} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
            stroke="#1c1108" strokeWidth={4.6} strokeLinecap="round" opacity={0.55}
          />
        ))}
      </g>
      <g>
        {segments.map(s => s.lines.map((id, i) => {
          const k = (i - s.offset) * LINE_SPREAD;
          return (
            <line
              key={`${s.key}-${id}`}
              x1={s.a.x + s.nx * k} y1={s.a.y + s.ny * k}
              x2={s.b.x + s.nx * k} y2={s.b.y + s.ny * k}
              stroke={RAILROADS.get(id)?.color ?? '#8b6a42'}
              strokeWidth={1.5} strokeLinecap="round" opacity={0.85}
            />
          );
        }))}
      </g>
    </>
  );
}

/**
 * Both lamps below are scenery only now — every circle they draw carries
 * `pointerEvents: 'none'`. Painted SVG shapes capture taps regardless of
 * opacity (`pointer-events: visiblePainted` excludes only *unpainted*
 * geometry, not translucent), and a city's glow is drawn well past its
 * bulb — wide enough, at this scale, to sit on top of a neighbouring dot's
 * tap target and steal taps meant for it. The actual tappable surface is
 * `InteractionLayer` below, bubbled above everything so nothing can ever
 * cover it.
 */

/** A bulb in its socket: the housing is always drawn, the filament is not. */
function CityLamp({ node, color, lit, marker, candidate }: {
  node: Placed; color: string; lit: boolean; marker: Marker | undefined;
  candidate: boolean;
}) {
  const r = CITY_R;
  const { x, y } = node;
  return (
    <g>
      <circle cx={x} cy={y + r * 0.07} r={r * 1.06} fill="#000" opacity={0.5} pointerEvents="none" />
      <circle cx={x - r * 0.07} cy={y - r * 0.09} r={r * 0.98} fill="#f2f0eb" pointerEvents="none" />
      <circle cx={x + r * 0.1} cy={y + r * 0.13} r={r * 0.88} fill="#9b9a96" pointerEvents="none" />
      <circle cx={x} cy={y} r={r * 0.72} fill="#100c08" pointerEvents="none" />
      <g style={{ opacity: lit ? 1 : DIM, transition: 'opacity 90ms cubic-bezier(.2,.8,.3,1)' }}>
        <circle cx={x} cy={y} r={r * 2.6} fill={color} opacity={0.12} pointerEvents="none" />
        <circle cx={x} cy={y} r={r * 1.5} fill={color} opacity={0.24} pointerEvents="none" />
        <circle cx={x} cy={y} r={r * 0.64} fill={color} pointerEvents="none" />
        <circle cx={x - r * 0.2} cy={y - r * 0.24} r={r * 0.2} fill="#fff" opacity={0.6} pointerEvents="none" />
      </g>
      {candidate && (
        <circle cx={x} cy={y} r={r * 1.75} fill="none"
                stroke="#fff6e2" strokeWidth={1.4} opacity={0.8} pointerEvents="none" />
      )}
      <title>
        {node.name}
        {marker ? ` — ${marker.name}'s ${marker.role}` : ''}
      </title>
    </g>
  );
}

function RouteLamp({ node, lit, candidate }: {
  node: Placed; lit: boolean; candidate: boolean;
}) {
  const r = DOT_R;
  const { x, y } = node;
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.5} fill="#2a1c0d" pointerEvents="none" />
      <g style={{ opacity: lit ? 1 : DIM, transition: 'opacity 110ms cubic-bezier(.2,.8,.3,1)' }}>
        <circle cx={x} cy={y} r={r * 4.2} fill="#fff6e2" opacity={0.1} pointerEvents="none" />
        <circle cx={x} cy={y} r={r * 2.2} fill="#fff6e2" opacity={0.2} pointerEvents="none" />
        <circle cx={x} cy={y} r={r} fill="#fffaf0" pointerEvents="none" />
      </g>
      {candidate && (
        <circle cx={x} cy={y} r={r * 3.2} fill="none"
                stroke="#fff6e2" strokeWidth={1} opacity={0.75} pointerEvents="none" />
      )}
    </g>
  );
}

/**
 * The tappable surface, all of it, bubbled above every lamp and pawn: one
 * transparent circle per candidate node. Rendered last in the SVG so nothing
 * drawn earlier — a city's glow, a pawn, a route line — can ever sit on top of
 * a hit target and steal the tap meant for it. A node that currently may not
 * be tapped (not a legal candidate, or a previous move is still playing back)
 * contributes no circle at all, exactly as the old per-lamp `Tappable`
 * rendered no button for it.
 *
 * Which is also why the targets are sized *here*, per render, rather than once
 * for the whole map in geo.ts: the only lamps that can compete for a tap are
 * the ones offered at this moment, and they are the ones in this layer. See
 * `sizeCandidates`.
 */
function InteractionLayer({ nodes, legal, enabled, onTap }: {
  nodes: readonly Placed[]; legal: ReadonlySet<NodeId>; enabled: boolean;
  onTap: (id: NodeId) => void;
}) {
  const targets = useMemo(() => {
    const candidates = nodes.filter(node => legal.has(node.id));
    const radii = sizeCandidates(candidates);
    return candidates.map(node => ({ node, hit: radii.get(node.id)! }));
  }, [nodes, legal]);

  return (
    <g>
      {enabled && targets.map(({ node, hit }) => {
        const label = node.kind === 'city' ? (node.name ?? node.id) : `Dot ${node.id}`;
        return (
          <circle
            key={node.id}
            cx={node.x} cy={node.y} r={hit}
            fill="transparent"
            role="button" aria-label={label}
            onClick={() => onTap(node.id)}
            style={{ cursor: 'pointer' }}
          />
        );
      })}
    </g>
  );
}

/** The HUD sits on the cabinet, so it borrows the cabinet's brass. */
const HUD_BUTTON = {
  fontFamily: "'DM Mono', ui-monospace, monospace",
  fontSize: 12,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#f0cd94',
  background: 'rgba(43,23,10,0.55)',
  border: '1px solid #5c3a1e',
  borderRadius: 3,
  padding: '6px 12px'
} as const;

export interface MapViewProps {
  state: GameState;
  onBack: () => void;
  onMove: (seat: SeatId, path: readonly NodeId[], arrived: boolean) => void;
  /** The dice, threaded through so the map can roll them too — see below. */
  dice: { roll: TurnRoll | null; live: boolean };
  onRollDice: () => void;
  onDiceLanded: () => void;
}

/**
 * Why the dice appear on both surfaces. The readout lives on the board and is
 * shared; on one tablet that would mean tapping the dice there and then
 * navigating here to move — an extra trip every turn, on the view that is
 * *not* where the turn happens. The same component renders here, through the
 * same `onRollDice`/`onDiceLanded` gate, so there is one implementation and
 * one gate on two surfaces.
 */
export function MapView({
  state, onBack, onMove, dice, onRollDice, onDiceLanded
}: MapViewProps) {
  // The projection is expensive and depends on nothing that changes — the
  // network is a build artefact and the cabinet is a fixed size.
  const board = useMemo(() => layout(WIDTH, HEIGHT), []);
  const lamps = useMemo(() => markers(state), [state]);
  const route = useRoute(state, onMove);
  const drafted = route.draft === null ? null : pathOf(route.draft);

  /**
   * The baron up owes a destination roll, so there is nothing to walk here.
   *
   * Two states reach it. The ordinary one is between trips. The other is the
   * bonus leg: a pawn that arrives inside the white dice is paid, rolls a new
   * destination and spends the bonus die starting that new trip — so the turn
   * stays open with dice already on the table and still nothing to do until
   * the destination exists.
   *
   * Both used to leave this screen saying "0 left" with COMMIT and UNDO
   * greyed out and no way to learn what it was waiting for. The map says so
   * and points at the board, where the roll is: the announce gate for a
   * destination is the region panel and the own-region ballot, and neither
   * belongs here.
   */
  const upNext = state.turn === null ? null : state.seats[state.turn];
  const owesDestination = upNext !== null && needsDestination(upNext, nodeForCity);
  /**
   * The sibling state, and the other way this screen used to read as stranded.
   *
   * A turn whose white pair earned a Bonus Roll stays open once the white
   * movement is walked — "if entitled, he must take it" — but the die has not
   * been thrown, so the leg has no movement and nothing is tappable. Unlike
   * the destination above, the roll that clears it is *here*: the same readout
   * this screen already renders. So this says what is owed and leaves the
   * dice, three inches away, to take it.
   *
   * A destination owed as well comes first, in the book's own order.
   */
  const owesBonus = state.turn !== null && !owesDestination && state.bonusOwed;

  // The path comes from the log, not from the draft: this is what makes the
  // walk visible in the tab that played it *and* any tab just watching along.
  const lastMove = state.lastMove;
  // The mover is part of the key: two barons can commit the same dots one
  // after the other, and the path alone would make the second walk look like
  // the first still showing.
  const replaying = usePlayback(lastMove?.path ?? null, PLAYBACK_MS, lastMove?.seat ?? null);

  // While the last committed leg is still walking, the moving baron's pawn
  // sits at the node playback has reached rather than at rest on `seat.at` —
  // the two agree once `replaying.done`, since the log already recorded the
  // leg's true end the moment it committed.
  const standing = useMemo(() => {
    const base = pawns(state);
    if (lastMove === null || replaying.done) return base;
    const at = replaying.shown[replaying.shown.length - 1];
    if (at === undefined) return base;
    const out = new Map<NodeId, SeatId[]>();
    for (const [node, seats] of base) {
      const rest = seats.filter(id => id !== lastMove.seat);
      if (rest.length > 0) out.set(node, rest);
    }
    const here = out.get(at);
    if (here) here.push(lastMove.seat);
    else out.set(at, [lastMove.seat]);
    return out;
  }, [state, lastMove, replaying.shown, replaying.done]);

  const playing = SEATS
    .map(id => state.seats[id])
    .filter(seat => seat.name !== null && seat.stops.length > 0);

  return (
    <div style={{
      padding: 34,
      minHeight: '100%',
      boxSizing: 'border-box',
      background: '#e8e6e1',
      fontFamily: "'Roboto Condensed', system-ui, sans-serif"
    }}>
      {/* A tap anywhere on the cabinet finishes a playing-back move early —
          the same rule this board already applies to a flap. Harmless once
          there is nothing left to skip: `usePlayback` treats a further call
          as a no-op. */}
      <div
        onClick={replaying.skip}
        style={{
          width: WIDTH,
          height: HEIGHT,
          maxWidth: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 30px 70px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(180deg,#4a2c17,#331d0e)'
        }}
      >
        {/* Grain and a bevelled frame: the board is a lit cabinet, not a screen. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(93deg,rgba(255,255,255,0.035) 0px,rgba(255,255,255,0.035) 1px,transparent 1px,transparent 7px),'
            + 'repeating-linear-gradient(88deg,rgba(0,0,0,0.10) 0px,rgba(0,0,0,0.10) 2px,transparent 2px,transparent 13px)'
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 120px rgba(0,0,0,0.55), inset 0 0 0 12px #5c3a1e, inset 0 0 0 13px #2b170a',
          pointerEvents: 'none',
          zIndex: 3
        }} />

        <svg
          width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ position: 'absolute', inset: 0 }}
          // Not role="img": the lamps a baron may move to are real buttons
          // inside it, and a picture has no controls.
          role="group"
          aria-label="The Rail Baron network. Each baron's destination and the city they set out from are lit in their colour."
        >
          <path d={board.landPath} fill="rgba(0,0,0,0.20)" stroke="#8b6a42" strokeWidth={3}
                strokeLinejoin="round" transform="translate(0,3)" />
          <path d={board.landPath} fill="rgba(255,240,214,0.045)" stroke="#d6ab6d" strokeWidth={1.5}
                strokeLinejoin="round" />

          <Track edges={board.edges} nodes={board.byId} />

          {/* The portion of the last committed move walked so far — the same
              path everyone watching this log sees, drawn in the mover's own
              colour so it reads as their trail rather than a new draft. */}
          {lastMove && replaying.shown.length > 1 && (
            <g data-route="trail">
              {replaying.shown.slice(1).map((id, i) => {
                const a = board.byId.get(replaying.shown[i]!);
                const b = board.byId.get(id);
                if (!a || !b) return null;
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={SEAT_COLORS[lastMove.seat]} strokeWidth={3.4}
                        strokeLinecap="round" opacity={0.7} />
                );
              })}
            </g>
          )}

          {/* The route as tapped out so far, drawn over the track so it reads
              as the line the pawn is about to walk. */}
          {drafted && (
            <g data-route="draft">
              {/* Keyed by position, deliberately. A route may pass through the
                  same node twice — an edge carrying two railroads may be
                  crossed once on each — so keying by node id would collide and
                  React would reconcile two segments into one, dropping a leg
                  of the drawn route. The list is positional and never
                  reordered, which is exactly when an index key is right. */}
              {drafted.slice(1).map((id, i) => {
                const a = board.byId.get(drafted[i]!);
                const b = board.byId.get(id);
                if (!a || !b) return null;
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke="#fff6e2" strokeWidth={3.4} strokeLinecap="round"
                        opacity={0.9} />
                );
              })}
            </g>
          )}

          <g>
            {board.nodes.filter(n => n.kind === 'dot').map(node => {
              const candidate = route.legal.has(node.id);
              return <RouteLamp key={node.id} node={node} lit={candidate} candidate={candidate} />;
            })}
          </g>
          <g>
            {board.nodes.filter(n => n.kind === 'city').map(node => {
              const marker = node.cityId === undefined
                ? undefined
                : lamps.get(node.cityId)?.[0];
              const region = node.cityId === undefined
                ? undefined
                : cityById(node.cityId).region;
              const candidate = route.legal.has(node.id);
              return (
                <CityLamp
                  key={node.id}
                  node={node}
                  lit={marker !== undefined || candidate}
                  marker={marker}
                  candidate={candidate}
                  color={marker
                    ? SEAT_COLORS[marker.seat]
                    : (region ? REGION_COLOR[region] : '#e8a13c')}
                />
              );
            })}
          </g>

          {/* One pawn per baron, stacked where several share a node. */}
          <g>
            {[...standing].map(([id, seats]) => {
              const node = board.byId.get(id);
              if (!node) return null;
              return seats.map((seatId, i) => (
                <g key={`${id}-${seatId}`} role="img" aria-label={state.seats[seatId].name ?? seatId}>
                  <circle cx={node.x + i * 5} cy={node.y - 11} r={5}
                          fill={SEAT_COLORS[seatId]} stroke="#100c08" strokeWidth={1.4}
                          pointerEvents="none" />
                  <title>{state.seats[seatId].name}</title>
                </g>
              ));
            })}
          </g>

          {/* The tappable surface, last of all: see InteractionLayer above
              for why it must render after every painted lamp and pawn.
              A lamp is not tappable while the last committed move is still
              walking — a player must not start a new route over an
              animation of the previous one. */}
          <InteractionLayer
            nodes={board.nodes}
            legal={route.legal}
            enabled={replaying.done}
            onTap={route.tap}
          />
        </svg>

        <div style={{
          position: 'absolute', top: 68, left: '50%', transform: 'translateX(-50%)',
          width: 184, height: 56, zIndex: 4
        }}>
          <DiceReadout
            roll={dice.roll}
            live={dice.live}
            onRoll={onRollDice}
            onLanded={onDiceLanded}
          />
        </div>

        <div style={{
          position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center',
          fontSize: 30, fontWeight: 700, letterSpacing: '0.36em', textTransform: 'uppercase',
          color: '#f0cd94', textShadow: '0 2px 0 #2b170a', zIndex: 2
        }}>
          Rail Baron
        </div>

        <button
          onClick={onBack}
          style={{
            position: 'absolute', top: 26, left: 34, zIndex: 4,
            fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 12,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#f0cd94', background: 'rgba(43,23,10,0.55)',
            border: '1px solid #5c3a1e', borderRadius: 3, padding: '6px 12px', cursor: 'pointer'
          }}
        >
          Back
        </button>

        {/* The turn's controls. The draft they act on lives in screen state
            and never in the log, which is why UNDO costs nothing and COMMIT
            is the only thing here that writes anything down. */}
        {state.turn !== null && owesDestination && (
          <div style={{
            position: 'absolute', top: 26, right: 34, zIndex: 4,
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ ...HUD_BUTTON, background: 'rgba(43,23,10,0.35)' }}>
              {state.rolled === null
                ? 'ROLL A NEW DESTINATION'
                : 'ARRIVED — ROLL A NEW DESTINATION'}
            </span>
            <button onClick={onBack} style={{ ...HUD_BUTTON, cursor: 'pointer' }}>
              TO THE BOARD
            </button>
          </div>
        )}

        {owesBonus && (
          <div style={{
            position: 'absolute', top: 26, right: 34, zIndex: 4,
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ ...HUD_BUTTON, background: 'rgba(43,23,10,0.35)' }}>
              BONUS ROLL — TAKE THE RED DIE
            </span>
          </div>
        )}

        {state.turn !== null && !owesDestination && !owesBonus && (
          <div style={{
            position: 'absolute', top: 26, right: 34, zIndex: 4,
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ ...HUD_BUTTON, background: 'rgba(43,23,10,0.35)' }}>
              {route.remaining} left
            </span>
            <button
              onClick={route.undo}
              disabled={!route.draft?.steps.length}
              style={{
                ...HUD_BUTTON,
                cursor: route.draft?.steps.length ? 'pointer' : 'default',
                opacity: route.draft?.steps.length ? 1 : 0.45
              }}
            >
              UNDO
            </button>
            <button
              onClick={route.commit}
              disabled={!route.canCommit}
              style={{
                ...HUD_BUTTON,
                cursor: route.canCommit ? 'pointer' : 'default',
                opacity: route.canCommit ? 1 : 0.45
              }}
            >
              COMMIT
            </button>
          </div>
        )}

        {playing.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 26, left: 34, right: 34,
            display: 'flex', gap: 10, zIndex: 2
          }}>
            {playing.map(seat => {
              const stop = seat.stops[seat.stops.length - 1]!;
              return (
                <div key={seat.id} style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 12px', boxSizing: 'border-box', borderRadius: 3,
                  background: 'linear-gradient(180deg,rgba(126,96,65,0.85),rgba(90,66,41,0.85))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 4px rgba(0,0,0,0.45)'
                }}>
                  <span style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: SEAT_COLORS[seat.id],
                    boxShadow: `0 0 10px ${SEAT_COLORS[seat.id]}`
                  }} />
                  <span style={{
                    fontSize: 15, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: '#fdf3e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {cityById(stop.city).name}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontFamily: "'DM Mono', ui-monospace, monospace",
                    fontSize: 13, color: '#f2c273'
                  }}>
                    {/* 0 is a real payout; only null means the roll was a home town. */}
                    {stop.payout === null ? 'HOME' : `$${stop.payout.toLocaleString('en-US')}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
