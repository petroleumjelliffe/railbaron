import { describe, expect, it } from 'vitest';
import { cityById } from '../../engine';
import { layout, RAILROADS } from './geo';

const board = layout(1400, 788);

const city = (name: string) => {
  const node = board.nodes.find(n => n.kind === 'city' && n.name === name);
  if (!node) throw new Error(`no lamp for ${name}`);
  return node;
};

const gap = (a: string, b: string) => Math.hypot(city(a).x - city(b).x, city(a).y - city(b).y);

describe('placing the network on the cabinet', () => {
  it('places every node the network carries', () => {
    expect(board.nodes).toHaveLength(550);
    expect(board.nodes.filter(n => n.kind === 'city')).toHaveLength(67);
    expect(board.byId.size).toBe(550);
  });

  it('keeps everything inside the cabinet', () => {
    for (const node of board.nodes) {
      expect(node.x, node.id).toBeGreaterThan(0);
      expect(node.x, node.id).toBeLessThan(1400);
      expect(node.y, node.id).toBeGreaterThan(0);
      expect(node.y, node.id).toBeLessThan(788);
    }
  });

  it('draws a coastline', () => {
    expect(board.landPath.length).toBeGreaterThan(10000);
    expect(board.landPath.startsWith('M')).toBe(true);
  });

  it('lays the country out west to east and north to south', () => {
    expect(city('Seattle').x).toBeLessThan(city('Boston').x);
    expect(city('Los Angeles').x).toBeLessThan(city('Miami').x);
    expect(city('Minneapolis').y).toBeLessThan(city('Houston').y);
    expect(city('Seattle').y).toBeLessThan(city('San Diego').y);
  });

  it('pushes twin cities far enough apart to be two lamps', () => {
    // The whole reason separation exists. Each pair is closer than a lamp is
    // wide in true projection, and two of the three are the board's only $0
    // journeys — a single lamp would merge two distinct destinations.
    expect(gap('San Francisco', 'Oakland')).toBeGreaterThanOrEqual(20.9);
    expect(gap('Minneapolis', 'St. Paul')).toBeGreaterThanOrEqual(20.9);
    expect(gap('Dallas', 'Fort Worth')).toBeGreaterThanOrEqual(20.9);
  });

  it('leaves no two city lamps overlapping', () => {
    const cities = board.nodes.filter(n => n.kind === 'city');
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        const a = cities[i]!;
        const b = cities[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.name}/${b.name}`).toBeGreaterThan(17);
      }
    }
  });

  it('does not shove a separated city off its own part of the map', () => {
    // Separation is licence, not relocation: nudging must not move a lamp so
    // far that it reads as the wrong place.
    expect(city('Oakland').x).toBeLessThan(city('Sacramento').x);
    expect(city('San Francisco').x).toBeLessThan(city('Oakland').x);
    expect(city('Minneapolis').x).toBeLessThan(city('St. Paul').x);
  });

  it('names a railroad for every segment, and knows each one', () => {
    expect(board.edges).toHaveLength(710);
    for (const edge of board.edges) {
      expect(board.byId.has(edge.a)).toBe(true);
      expect(board.byId.has(edge.b)).toBe(true);
      for (const id of edge.railroads) expect(RAILROADS.has(id), id).toBe(true);
    }
  });

  it('gives every city lamp the engine id its colour is looked up by', () => {
    for (const node of board.nodes.filter(n => n.kind === 'city')) {
      expect(cityById(node.cityId!).name).toBe(node.name);
    }
  });

  it('fits a smaller cabinet without leaking outside it', () => {
    const small = layout(700, 394);
    for (const node of small.nodes) {
      expect(node.x, node.id).toBeGreaterThan(0);
      expect(node.x, node.id).toBeLessThan(700);
      expect(node.y, node.id).toBeGreaterThan(0);
      expect(node.y, node.id).toBeLessThan(394);
    }
  });
});
