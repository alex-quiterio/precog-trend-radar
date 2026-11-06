// The Great Simplification and The Marginalian are built in: always followed, never removable.
import { describe, expect, it, vi } from 'vitest';
import type { ReadingSite } from './parse';

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: k => mem.get(k) ?? null,
  setItem: (k, v) => void mem.set(k, String(v)),
  removeItem: k => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;
const SITES_KEY = 'precog.reading.sites.v1';
const mine: ReadingSite = { url: 'https://example.org', name: 'Example', types: [['posts', 'Post']] };

/** A fresh copy of the module, reading whatever storage holds now. */
async function load() {
  vi.resetModules();
  return import('./index');
}

describe('followed sites', () => {
  it('starts with the built-in sites', async () => {
    mem.clear();
    const { readingSites } = await load();
    expect(readingSites().map(s => s.name)).toEqual(['The Great Simplification', 'The Marginalian']);
  });
  it('brings the built-in sites back for someone who removed them in an older version', async () => {
    mem.set(SITES_KEY, JSON.stringify([mine]));
    const { readingSites } = await load();
    expect(readingSites().map(s => s.url)).toEqual([
      'https://www.thegreatsimplification.com',
      'https://www.themarginalian.org',
      'https://example.org',
    ]);
  });
  it('cannot remove a built-in site, and stores only your own', async () => {
    mem.clear();
    const { readingSites, saveReadingSites, isBuiltInSite } = await load();
    saveReadingSites([mine]); // a list without the built-in ones
    expect(readingSites()).toHaveLength(3);
    expect(isBuiltInSite('https://www.themarginalian.org')).toBe(true);
    expect(JSON.parse(mem.get(SITES_KEY) || '[]')).toEqual([mine]);
  });
  it('ignores stored entries that are not sites', async () => {
    mem.set(SITES_KEY, JSON.stringify([{ url: 3 }, 'x', null, mine]));
    const { readingSites } = await load();
    expect(readingSites()).toHaveLength(3);
  });
});
