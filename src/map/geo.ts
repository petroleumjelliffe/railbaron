import { geoAlbers, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { EDGES, NODES, RAILROADS as LINES } from '../../engine';
import outline from '../data/us-outline.json';

export type NodeKind = 'city' | 'dot' | 'junction';

export interface Placed {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  /** Present on cities only. */
  name?: string;
  cityId?: number;
}

export interface Layout {
  width: number;
  height: number;
  /** The nation's coastline as one SVG path string. */
  landPath: string;
  nodes: Placed[];
  byId: Map<string, Placed>;
  edges: readonly { a: string; b: string; railroads: readonly string[] }[];
}

/**
 * Twin lamps must not hide one another.
 *
 * San Francisco/Oakland, Minneapolis/St. Paul and Dallas/Fort Worth sit close
 * enough that at this scale one lamp covers the next. They are separate
 * destinations that pay differently — two of the three pairs are the board's
 * only $0 journeys — so a single visible lamp where there should be two is
 * worse than a few pixels of geographic licence.
 *
 * Cities are pushed apart; route dots are left exactly where the projection
 * puts them, because they carry no label and no meaning of their own.
 */
const MIN_CITY_GAP = 21;
const RELAX_PASSES = 90;

function separateCities(cities: Placed[]): void {
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const a = cities[i]!;
        const b = cities[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= MIN_CITY_GAP) continue;
        // Exactly coincident points have no direction to separate along, so
        // pick one rather than dividing by zero.
        if (dist < 0.01) { dx = 0.7; dy = 0.7; dist = 1; }
        const push = (MIN_CITY_GAP - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

const isKind = (k: string): k is NodeKind => k === 'city' || k === 'dot' || k === 'junction';

/**
 * Projects the whole network into a box of the given size.
 *
 * `fitExtent` derives the scale and translation from the coastline rather
 * than from the network, so the land fills the cabinet the same way at every
 * size and the rails sit on it correctly at all of them.
 */
export function layout(width: number, height: number, inset = 74): Layout {
  const land = outline as unknown as GeoPermissibleObjects;
  const projection = geoAlbers().fitExtent(
    [[inset, inset], [width - inset, height - inset * 0.8]],
    land
  );
  const landPath = geoPath(projection)(land) ?? '';

  const nodes: Placed[] = [];
  for (const node of NODES) {
    const point = projection([node.lon, node.lat]);
    if (!point || !isKind(node.kind)) continue;
    nodes.push({
      id: node.id,
      kind: node.kind,
      x: point[0],
      y: point[1],
      ...(node.name !== undefined ? { name: node.name, cityId: node.cityId } : {})
    });
  }

  separateCities(nodes.filter(n => n.kind === 'city'));

  return {
    width,
    height,
    landPath,
    nodes,
    byId: new Map(nodes.map(n => [n.id, n])),
    edges: EDGES
  };
}

/** Railroad records, keyed by the id the edges carry. Re-exported so the map
 *  has one import for the network rather than two. */
export const RAILROADS = LINES;
