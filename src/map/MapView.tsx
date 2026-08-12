import { useMemo } from 'react';
import { cityById, type RegionId } from '../../engine';
import { SEAT_COLORS } from '../game/tokens';
import { SEATS } from '../state/events';
import type { GameState } from '../state/game';
import { layout, RAILROADS, type Placed } from './geo';
import { markers, type Marker } from './lit';

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
const CITY_R = 8.5;
const DOT_R = 2.6;

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

/** A bulb in its socket: the housing is always drawn, the filament is not. */
function CityLamp({ node, color, lit, marker }: {
  node: Placed; color: string; lit: boolean; marker: Marker | undefined;
}) {
  const r = CITY_R;
  const { x, y } = node;
  return (
    <g>
      <g>
        <circle cx={x} cy={y + r * 0.07} r={r * 1.06} fill="#000" opacity={0.5} />
        <circle cx={x - r * 0.07} cy={y - r * 0.09} r={r * 0.98} fill="#f2f0eb" />
        <circle cx={x + r * 0.1} cy={y + r * 0.13} r={r * 0.88} fill="#9b9a96" />
        <circle cx={x} cy={y} r={r * 0.72} fill="#100c08" />
      </g>
      <g style={{ opacity: lit ? 1 : DIM, transition: 'opacity 90ms cubic-bezier(.2,.8,.3,1)' }}>
        <circle cx={x} cy={y} r={r * 2.6} fill={color} opacity={0.12} />
        <circle cx={x} cy={y} r={r * 1.5} fill={color} opacity={0.24} />
        <circle cx={x} cy={y} r={r * 0.64} fill={color} />
        <circle cx={x - r * 0.2} cy={y - r * 0.24} r={r * 0.2} fill="#fff" opacity={0.6} />
      </g>
      <title>
        {node.name}
        {marker ? ` — ${marker.name}'s ${marker.role}` : ''}
      </title>
    </g>
  );
}

function RouteLamp({ node, lit }: { node: Placed; lit: boolean }) {
  const r = DOT_R;
  const { x, y } = node;
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.5} fill="#2a1c0d" />
      <g style={{ opacity: lit ? 1 : DIM, transition: 'opacity 110ms cubic-bezier(.2,.8,.3,1)' }}>
        <circle cx={x} cy={y} r={r * 4.2} fill="#fff6e2" opacity={0.1} />
        <circle cx={x} cy={y} r={r * 2.2} fill="#fff6e2" opacity={0.2} />
        <circle cx={x} cy={y} r={r} fill="#fffaf0" />
      </g>
    </g>
  );
}

export interface MapViewProps {
  state: GameState;
  onBack: () => void;
}

export function MapView({ state, onBack }: MapViewProps) {
  // The projection is expensive and depends on nothing that changes — the
  // network is a build artefact and the cabinet is a fixed size.
  const board = useMemo(() => layout(WIDTH, HEIGHT), []);
  const lamps = useMemo(() => markers(state), [state]);

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
      <div style={{
        width: WIDTH,
        height: HEIGHT,
        maxWidth: '100%',
        boxSizing: 'border-box',
        boxShadow: '0 30px 70px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(180deg,#4a2c17,#331d0e)'
      }}>
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
          role="img"
          aria-label="The Rail Baron network. Each baron's destination and the city they set out from are lit in their colour."
        >
          <path d={board.landPath} fill="rgba(0,0,0,0.20)" stroke="#8b6a42" strokeWidth={3}
                strokeLinejoin="round" transform="translate(0,3)" />
          <path d={board.landPath} fill="rgba(255,240,214,0.045)" stroke="#d6ab6d" strokeWidth={1.5}
                strokeLinejoin="round" />

          <Track edges={board.edges} nodes={board.byId} />

          <g>
            {board.nodes.filter(n => n.kind === 'dot').map(node => (
              <RouteLamp key={node.id} node={node} lit={false} />
            ))}
          </g>
          <g>
            {board.nodes.filter(n => n.kind === 'city').map(node => {
              const marker = node.cityId === undefined
                ? undefined
                : lamps.get(node.cityId)?.[0];
              const region = node.cityId === undefined
                ? undefined
                : cityById(node.cityId).region;
              return (
                <CityLamp
                  key={node.id}
                  node={node}
                  lit={marker !== undefined}
                  marker={marker}
                  color={marker
                    ? SEAT_COLORS[marker.seat]
                    : (region ? REGION_COLOR[region] : '#e8a13c')}
                />
              );
            })}
          </g>
        </svg>

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
