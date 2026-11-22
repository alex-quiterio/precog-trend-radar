// The daily picks from a pool (Alt Amsterdam, The Great Turning): Wikipedia momentum and the channel's sites'
// recent posts, scored over a curated pool.
import { describe, expect, it } from 'vitest';
import { DAY } from '@core/config';
import { PICKED_LENSES } from '@core/config';
import { TURNING_POOL, sceneCandidates, siteMentions, viewsSurge } from '@features/scene-topics';
import type { ReadingItem } from '@sources/reading/parse';

const now = Date.UTC(2026, 10, 7);
const post = (title: string, text: string, daysAgo: number, site = 'Shareable'): ReadingItem => ({
  id: title,
  origin: 'https://www.shareable.net',
  site,
  kind: 'Story',
  num: null,
  title,
  url: 'https://www.shareable.net/x',
  t: now - daysAgo * DAY,
  text: text.toLowerCase(),
});
const POOL: [string, string, string][] = [
  ['Library of things', 'Library of things', 'library of things'],
  ['Squatting', 'Squatting', 'squat'],
  ['Cohousing', 'Cohousing', 'cohousing'],
  ['Degrowth', 'Degrowth', 'degrowth'],
];

describe('the scene pick', () => {
  it('measures this week against the four weeks before', () => {
    expect(viewsSurge([...Array(28).fill(100), ...Array(7).fill(200)])).toBe(2);
    expect(viewsSurge([...Array(28).fill(100), ...Array(7).fill(50)])).toBe(0.5);
    // Too little history, or too few readers for a ratio to mean anything.
    expect(viewsSurge(Array(10).fill(100))).toBeNull();
    expect(viewsSurge(Array(35).fill(2))).toBeNull();
  });
  it('counts recent posts naming a topic: titles double, older posts fade', () => {
    const items = [
      post('The Library of Things Toolkit', '', 0),
      post('Tools for neighbours', 'start a library of things', 30, 'Resilience'),
      post('Housing', 'nothing here', 1),
    ];
    const m = siteMentions(items, 'library of things', now);
    expect(m.posts).toBe(2);
    expect(m.sites).toEqual(['Shareable', 'Resilience']);
    expect(m.weight).toBeCloseTo(2 + 0.5);
  });
  it('ranks what the scene writes about and what readers turn to, and says why', () => {
    const surge = new Map<string, number | null>([
      ['Library of things', 1],
      ['Squatting', 2],
      ['Cohousing', 0.5],
      ['Degrowth', null],
    ]);
    const c = sceneCandidates(POOL, surge, [post('The Library of Things Toolkit', '', 0)], now);
    expect(c.map(x => x.name)).toEqual(['Library of things', 'Squatting', 'Degrowth', 'Cohousing']);
    expect(c[0]).toMatchObject({ echoes: ['sites'], notes: ['1 recent post on Shareable'] });
    expect(c[1]).toMatchObject({ echoes: ['views'], notes: ['read 2.0× its usual on Wikipedia this week'] });
    expect(c[3].score).toBeLessThan(0);
  });
  it('leaves out topics you removed, and matches a phrase as a whole word', () => {
    const c = sceneCandidates(
      POOL,
      new Map(),
      [post('Squatters win in court', 'a squat in the west', 2)],
      now,
      new Set(['degrowth']),
    );
    expect(c.map(x => x.name)).not.toContain('Degrowth');
    expect(c.find(x => x.name === 'Squatting')?.echoes).toEqual(['sites']);
  });
});

describe('The Great Turning’s pick', () => {
  it('is picked each day, so its saved topics survive a preset upgrade', () => {
    expect(PICKED_LENSES).toContain('turning');
  });
  it('draws on a pool of more than six subjects, none of them a person, each with its own article', () => {
    expect(TURNING_POOL.length).toBeGreaterThan(20);
    expect(new Set(TURNING_POOL.map(([n]) => n.toLowerCase())).size).toBe(TURNING_POOL.length);
    expect(new Set(TURNING_POOL.map(([, w]) => w)).size).toBe(TURNING_POOL.length);
    expect(TURNING_POOL.map(([n]) => n)).not.toContain('Joanna Macy');
  });
  it('lifts what its voices are writing about this month over a quiet subject', () => {
    const items = [post('Seed saving as resistance', 'keep the old varieties', 3, 'Local Futures')];
    const c = sceneCandidates(TURNING_POOL, new Map(), items, now);
    expect(c[0]).toMatchObject({ name: 'Seed saving', notes: ['1 recent post on Local Futures'] });
  });
});
