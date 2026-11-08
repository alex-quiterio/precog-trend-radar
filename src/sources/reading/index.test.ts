// Reading sites: the followed ones (The Great Simplification and The Marginalian are built in, never removable),
// probing a site to follow, and loading posts, kept 12 hours.
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeFetch, fixture } from '@sources/fake-fetch';
import { memoryBackend, useBackend } from '@core/storage';
import {
  CAMPFIRE,
  isBuiltInSite,
  loadReading,
  probeSite,
  readingSites,
  reloadReadingSites,
  saveReadingSites,
  siteByUrl,
} from './index';
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

describe('reading sites', () => {
  const posts = JSON.parse(fixture('reading', 'wp-posts.json'));
  let failing = '';
  const net = fakeFetch(url => {
    if (url.origin === failing) throw new Error('down');
    if (url.pathname === '/wp-json/') return { name: '  Example   Co ' };
    if (url.pathname.endsWith('/pages'))
      return [
        {
          id: 9,
          modified_gmt: '2026-11-01T10:00:00',
          link: `${url.origin}/resources/`,
          title: { rendered: 'Resources' },
          content: { rendered: '' },
        },
      ];
    return posts;
  });
  const signal = new AbortController().signal;
  const site = (url: string, extra: Partial<ReadingSite> = {}): ReadingSite => ({
    url,
    name: url,
    types: [['posts', 'Post']],
    ...extra,
  });
  beforeEach(() => {
    failing = '';
  });

  it('probeSite names a WordPress site from its own title', async () => {
    expect(await probeSite('example.org/some/page', signal)).toEqual({
      url: 'https://example.org',
      name: 'Example Co', // squashed
      types: [['posts', 'Post']],
    });
  });
  it('probeSite says why a site can’t be followed', async () => {
    await expect(probeSite('http://', signal)).rejects.toThrow('that is not a web address');
    failing = 'https://www.campfire-stories.org';
    await expect(probeSite('https://www.campfire-stories.org', signal)).rejects.toThrow(
      "campfire-stories.org can't be read from the browser",
    );
  });
  it('reads each post type and watched page, newest first', async () => {
    const { items, errors } = await loadReading(signal, [
      site('https://a.example', {
        types: [
          ['posts', 'Essay'],
          ['episode', 'Episode'],
        ],
        pages: ['resources'],
      }),
    ]);
    expect(errors).toEqual([]);
    expect(new Set(items.map(i => i.kind))).toEqual(new Set(['Essay', 'Episode', 'Page updated']));
    expect(items.map(i => i.t)).toEqual([...items.map(i => i.t)].sort((a, b) => b - a));
    expect(net.urls.some(u => u.includes('/wp-json/wp/v2/pages?slug=resources'))).toBe(true);
  });
  it('keeps a site’s posts for 12 hours', async () => {
    await loadReading(signal, [site('https://b.example')]);
    const asked = net.urls.length;
    await loadReading(signal, [site('https://b.example')]);
    expect(net.urls).toHaveLength(asked);
  });
  it('shows the other sites when one fails, and names the one that did', async () => {
    failing = 'https://down.example';
    const { items, errors } = await loadReading(signal, [
      site('https://c.example'),
      site('https://down.example', { name: 'Down' }),
    ]);
    expect(items.length).toBeGreaterThan(0);
    expect(errors).toEqual(['Down: HTTP 500']); // named once
  });
  it('lists a kept library without asking the network', async () => {
    const { items } = await loadReading(signal, [CAMPFIRE]);
    expect(items.length).toBe(CAMPFIRE.library!.entries.length);
    expect(net.urls).toEqual([]);
  });
  it('finds a channel’s own sites by origin', () => {
    expect(siteByUrl(CAMPFIRE.url)?.name).toBe('Campfire Stories');
    expect(siteByUrl('https://www.dutchnews.nl')?.ttlHours).toBe(2);
    expect(siteByUrl('https://nowhere.example')).toBeUndefined();
  });
});
