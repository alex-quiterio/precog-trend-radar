// GDELT query batching and The Great Simplification matching.
import { describe, expect, it } from 'vitest';
import { gdeltQuery, storyQueries, timelinePoints } from '../src/sources/gdelt-query';
import { tgsScore, type TGSItem } from '../src/sources/tgs';

describe('storyQueries', () => {
  it('ORs a lens into one query per country and drops keywords GDELT rejects', () => {
    const qs = storyQueries([
      { key: 'a', q: 'Climate change' },
      { key: 'b', q: 'AI' },
      { key: 'c', q: 'wildfire' },
      { key: 'd', q: 'seca', country: 'portugal' },
    ]);
    expect(qs).toEqual([
      { q: '("Climate change" OR wildfire)', keys: ['a', 'c'] },
      { q: 'seca sourcecountry:portugal', keys: ['d'] },
    ]);
  });
  it('chunks long lists', () => {
    const qs = storyQueries(
      Array.from({ length: 8 }, (_, i) => ({ key: String(i), q: `topic${i}` })),
      6,
    );
    expect(qs.map(g => g.keys.length)).toEqual([6, 2]);
  });
  it('keys timelines the same way in the browser and in CI', () => {
    expect(gdeltQuery('Heat waves', 'portugal')).toBe('"Heat waves" sourcecountry:portugal');
  });
});

describe('timelinePoints', () => {
  it('averages GDELT buckets per UTC day', () => {
    const pts = timelinePoints({
      timeline: [
        {
          data: [
            { date: '20261101T000000Z', value: 1 },
            { date: '20261101T120000Z', value: 3 },
            { date: '20261102T000000Z', value: 5 },
          ],
        },
      ],
    });
    expect(pts).toEqual([
      { t: '2026-11-01T00:00:00.000Z', value: 2 },
      { t: '2026-11-02T00:00:00.000Z', value: 5 },
    ]);
  });
});

describe('tgsScore', () => {
  const it0: TGSItem = {
    id: 'x',
    kind: 'Episode',
    num: 240,
    title: 'The Hormuz Oil Crisis',
    url: '',
    t: 0,
    text: 'rory explains why diesel is tight and what peak oil means.',
  };
  it('weights title hits over description hits', () => {
    expect(tgsScore(it0, [/(^|[^\p{L}])hormuz(?=$|[^\p{L}])/iu])).toBe(3);
    expect(tgsScore(it0, [/(^|[^\p{L}])peak oil(?=$|[^\p{L}])/iu])).toBe(1);
    expect(tgsScore(it0, [/(^|[^\p{L}])permaculture(?=$|[^\p{L}])/iu])).toBe(0);
  });
});
