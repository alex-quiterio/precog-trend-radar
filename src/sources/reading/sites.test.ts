// The Great Simplification and The Marginalian are built in: always followed, never removable.
import { describe, expect, it } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { isBuiltInSite, readingSites, reloadReadingSites, saveReadingSites } from './index';
import type { ReadingSite } from './parse';

const mem = useBackend(memoryBackend()).data;
const SITES_KEY = 'precog.reading.sites.v1';
const mine: ReadingSite = { url: 'https://example.org', name: 'Example', types: [['posts', 'Post']] };

/** Reads the followed sites again from what storage holds now. */
function load() {
  reloadReadingSites();
  return { readingSites, saveReadingSites, isBuiltInSite };
}

describe('followed sites', () => {
  it('starts with the built-in sites', () => {
    mem.clear();
    const { readingSites } = load();
    expect(readingSites().map(s => s.name)).toEqual(['The Great Simplification', 'The Marginalian']);
  });
  it('brings the built-in sites back for someone who removed them in an older version', () => {
    mem.set(SITES_KEY, JSON.stringify([mine]));
    const { readingSites } = load();
    expect(readingSites().map(s => s.url)).toEqual([
      'https://www.thegreatsimplification.com',
      'https://www.themarginalian.org',
      'https://example.org',
    ]);
  });
  it('cannot remove a built-in site, and stores only your own', () => {
    mem.clear();
    const { readingSites, saveReadingSites, isBuiltInSite } = load();
    saveReadingSites([mine]); // a list without the built-in ones
    expect(readingSites()).toHaveLength(3);
    expect(isBuiltInSite('https://www.themarginalian.org')).toBe(true);
    expect(JSON.parse(mem.get(SITES_KEY) || '[]')).toEqual([mine]);
  });
  it('ignores stored entries that are not sites', () => {
    mem.set(SITES_KEY, JSON.stringify([{ url: 3 }, 'x', null, mine]));
    const { readingSites } = load();
    expect(readingSites()).toHaveLength(3);
  });
});
