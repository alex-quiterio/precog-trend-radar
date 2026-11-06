import { describe, expect, it } from 'vitest';
import posts from './fixtures/wp-posts.json';
import { parseWpPosts, type ReadingSite } from './parse';

const site: ReadingSite = {
  url: 'https://www.themarginalian.org',
  name: 'The Marginalian',
  types: [['posts', 'Essay']],
};

describe('WordPress replies', () => {
  it('reads posts with their date (UTC), link and plain-text excerpt', () => {
    const items = parseWpPosts(posts, site, 'posts', 'Essay');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'rd:https://www.themarginalian.org:posts:88362',
      site: 'The Marginalian',
      kind: 'Essay',
      t: Date.parse('2026-11-05T17:58:43Z'),
      url: 'https://www.themarginalian.org/2026/11/05/interesting/',
    });
    expect(items[0].title).toContain('C.S. Lewis');
    expect(items[0].text).not.toMatch(/<\w+/); // tags stripped
    expect(items[0].text).toBe(items[0].text.toLowerCase());
  });
  it('reads an episode number from the slug', () => {
    const [ep] = parseWpPosts(
      [
        {
          id: 1,
          date_gmt: '2026-01-01T00:00:00',
          link: 'https://x.org/233-dont-build-gods/',
          title: { rendered: 'A' },
        },
      ],
      site,
      'episode',
      'Episode',
    );
    expect(ep.num).toBe(233);
  });
  it('skips posts without a date or link, and refuses a reply that is not a list', () => {
    expect(parseWpPosts([{ id: 1, title: { rendered: 'x' } }], site, 'posts', 'Essay')).toEqual([]);
    expect(() => parseWpPosts({ code: 'rest_no_route' }, site, 'posts', 'Essay')).toThrow(/unexpected format/);
  });
});
