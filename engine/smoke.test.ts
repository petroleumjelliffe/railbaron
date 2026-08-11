import { describe, expect, it } from 'vitest';

describe('the engine test project', () => {
  it('runs without a DOM, so browser globals cannot leak into engine code', () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof globalThis.localStorage).toBe('undefined');
  });
});
