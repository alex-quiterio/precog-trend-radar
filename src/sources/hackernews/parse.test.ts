import { describe, expect, it } from 'vitest';
import byDate from './fixtures/search-by-date.json';
import storySearch from './fixtures/story-search.json';
import { parseHitCount, parseHitTimes, parseStoryHits } from './parse';

describe('Hacker News (Algolia) replies', () => {
  it('reads the hit count and the hit times', () => {
    expect(parseHitCount(byDate)).toBe(205);
    expect(parseHitTimes(byDate)).toEqual([1793122910000, 1792792402000, 1791901814000]);
  });
  it('refuses a reply without a hit count, so a broken API is not read as zero stories', () => {
    expect(() => parseHitCount({ hits: [] })).toThrow(/no hit count/);
  });
  it('reads stories with their points, comments and link', () => {
    const [first] = parseStoryHits(storySearch);
    expect(first).toMatchObject({ objectID: '22238335', points: 1582, comments: 642, t: 1580837440000 });
    expect(first.url).toMatch(/^https:\/\/blog\.discordapp\.com\//);
  });
  it('skips hits without a title, and keeps link-less posts (Ask HN) with an empty url', () => {
    const hits = parseStoryHits({
      hits: [
        { objectID: '1', created_at_i: 1 },
        { objectID: '2', title: 'Ask HN: x', created_at_i: 2 },
      ],
    });
    expect(hits).toEqual([{ objectID: '2', title: 'Ask HN: x', url: '', t: 2000, points: 0, comments: 0 }]);
  });
});
