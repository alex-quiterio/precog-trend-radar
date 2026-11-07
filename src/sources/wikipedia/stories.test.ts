import { describe, expect, it } from 'vitest';
import feed from './fixtures/featured-news.json';
import summary from './fixtures/summary.json';
import { lead, parseNewsStories, parseSummary, plainText } from './parse';
import { memoryBackend, useBackend } from '@core/storage';
import { utcDay } from '@sources/registry';
import type { Entry } from '@/types';
import { type DigestData, digestItems, storyFor, weekChange } from './digest';

const DAY = 86400e3;

describe('Wikipedia stories', () => {
  it('reads "In the news" as plain sentences with their day and links', () => {
    const [first, , third] = parseNewsStories(feed);
    expect(first.text).toBe(
      'In the United States, the Democratic Party wins a majority in both the House of Representatives and the Senate in the midterm elections.',
    );
    expect(first.day).toBe('Nov 3');
    expect(first.links[0]).toBe('2026 United States elections');
    expect(third.links).toContain('2026 Polish Constitutional Tribunal crisis');
    expect(third.text).not.toMatch(/[<>]/);
  });
  it('drops tags, entities and "(pictured)"', () => {
    expect(plainText('<!--Nov 1-->A <b>ship</b> (pictured) sinks &amp; <i>burns</i>.')).toBe('A ship sinks & burns.');
  });
  it('reads a page summary', () => {
    const s = parseSummary(summary);
    expect(s.title).toBe('2026 Binance hack');
    expect(s.description).toBe('Cryptocurrency theft');
    expect(s.extract).toMatch(/^On 29 October 2026/);
    expect(s.url).toBe('https://en.wikipedia.org/wiki/2026_Binance_hack');
  });
  it('refuses a disambiguation page or a reply without an extract', () => {
    expect(() => parseSummary({ ...summary, type: 'disambiguation' })).toThrow(/disambiguation/);
    expect(() => parseSummary({ title: 'X' })).toThrow(/unexpected format/);
  });
  it('keeps whole sentences of a lead, up to a length', () => {
    const s = parseSummary(summary);
    const l = lead(s.extract, 240);
    expect(l.length).toBeLessThanOrEqual(240);
    expect(l).toMatch(
      /Binance, a cryptocurrency exchange, allegedly by the North Korea-linked hacking group TraderTraitor\.$/,
    );
    expect(lead('One sentence without an end and much too long for the limit', 20)).toBe('One sentence…');
  });
  it('finds the story about a topic by its article, or by name', () => {
    const stories = parseNewsStories(feed);
    expect(storyFor(stories, '2026 United States elections', 'United States elections')).toBe(stories[0]);
    expect(storyFor(stories, 'Constitutional Tribunal (Poland)', 'x')).toBe(stories[2]);
    expect(storyFor(stories, 'Nothing', 'Senate')).toBe(stories[0]);
    expect(storyFor(stories, 'Nothing', 'Gaza war')).toBeNull();
  });
  it('measures a week of attention', () => {
    const t0 = Date.UTC(2026, 10, 1);
    const series = [...Array(10).keys()].map(i => ({ t: t0 + i * DAY, value: 100 + i * 10 }));
    expect(weekChange(series)).toBeCloseTo(((190 - 120) / 120) * 100);
    expect(weekChange(series.slice(-3))).toBeNull();
    expect(weekChange([])).toBeNull();
  });
  it('tells the news, then fresh headlines, and never passes an article lead off as a story', () => {
    const now = Date.now();
    // A Guardian article on "Gaza war" from an hour ago, as the trend fetch caches it.
    useBackend(
      memoryBackend({
        'precog.guardian.v2."gaza war"': {
          day: utcDay(now),
          articles: [
            { id: 'g1', title: 'Ceasefire talks resume', url: 'https://gu.com/g1', section: 'World', t: now - 3600e3 },
          ],
        },
      }),
    );
    const entry = (key: string, name: string, values: number[]) =>
      ({
        key,
        name,
        def: { name, slot: 0 },
        lang: 'en',
        country: null,
        meta: {},
        liveSeries: values.map((value, i) => ({ t: now - (values.length - 1 - i) * DAY, value })),
      }) as unknown as Entry;
    const sum = parseSummary(summary);
    const entries = [
      entry('a', 'Binance hack', [100, 100, 100, 100, 100, 100, 100, 300]),
      entry('b', 'Gaza war', [100, 100, 100, 100, 100, 100, 100, 90]),
      entry('c', 'Quiet thing', [100, 100, 100, 100, 100, 100, 100, 500]),
    ];
    const data: DigestData = new Map([
      ['c', { key: 'c', summary: { ...sum, description: 'A quiet thing' }, news: null }],
      ['b', { key: 'b', summary: { ...sum, description: 'Armed conflict' }, news: null }],
      ['a', { key: 'a', summary: sum, news: parseNewsStories(feed)[0] }],
    ]);
    const items = digestItems(entries, data, now);
    expect(items.map(d => [d.key, d.kind])).toEqual([
      ['a', 'news'],
      ['b', 'headline'],
      ['c', 'quiet'],
    ]);
    expect(items[0].source).toBe('In the news · Nov 3');
    expect(items[0].week).toBeCloseTo(200);
    expect(items[1]).toMatchObject({
      text: 'Ceasefire talks resume',
      url: 'https://gu.com/g1',
      source: 'The Guardian',
    });
    expect(items[2].text).toBe('A quiet thing');
  });
});
