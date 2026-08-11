import '@testing-library/jest-dom/vitest';

// Provide a mock localStorage if it doesn't exist (for jsdom compatibility)
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(key => delete store[key]); },
    key: (index: number) => Object.keys(store)[index] ?? null,
    length: 0
  } as unknown as Storage;
}
