// The gist: what moved on the channel on screen, what is hot elsewhere, Portugal's fire risk, and the Markdown copy.
import { beforeEach, describe, expect, it } from 'vitest';
import { DAY, LS, store } from '@core/config';
import { fmtPct } from '@core/format';
import { memoryBackend, useBackend } from '@core/storage';
import type { HNStory } from '@sources/hackernews/stream';
import { createAppStore, type AppStore } from '@/state';
import type { Entry, Stats } from '@/types';
import { briefMarkdown, buildBrief, hasStats, lineText, saveLook } from './brief';

const stats = (o: Partial<Stats>): Stats => ({
  latest: 100,
  lt: Date.UTC(2026, 10, 7),
  step: DAY,
  change: 0,
  slope: 0,
  sigma: 1,
  fc: [],
  momentum: 0,
  z: 0,
  baseN: 30,
  above: 0,
  n: 40,
  comp: null,
  ...o,
});
let app: AppStore;
const lens = (id: string): Entry[] => app.entriesOf(app.lensById(id));
const lines = (facts = {}) => buildBrief(app, facts).lines.map(lineText);
beforeEach(() => {
  useBackend(memoryBackend());
  app = createAppStore();
  app.loadLenses();
  app.state.activeLens = 'world';
  app.state.liveLoaded = true;
  app.allEntries().forEach(E => (E.stats = stats({})));
});

describe('buildBrief', () => {
  it('says nothing before any numbers are in', () => {
    app.allEntries().forEach(E => (E.stats = null));
    expect(buildBrief(app).lines).toEqual([]);
  });
  it('says so while sources are still answering', () => {
    app.state.liveLoaded = false;
    expect(lines()[0]).toMatch(/^Still loading/);
  });
  it('calls a calm channel calm', () => {
    expect(lines()).toEqual(['Nothing unusual: every topic is within 1.8σ of its 30-step baseline.']);
  });
  it('names the topics running hot, hottest first, up to three', () => {
    const [a, b, c, d] = lens('world');
    a.stats = stats({ z: 2 });
    b.stats = stats({ z: 4 });
    c.stats = stats({ z: 3 });
    d.stats = stats({ z: 1.9 });
    expect(lines()[0]).toBe(
      `4 topics are running hot: ${b.name} (4.0σ), ${c.name} (3.0σ), ${a.name} (2.0σ) and 1 more.`,
    );
    const part = buildBrief(app).lines[0].find(p => typeof p !== 'string');
    expect(part).toEqual({ key: b.key, text: b.name, color: b.color }); // a topic you can click to chart
  });
  it('names the biggest move up and down, leaving out sparse topics', () => {
    const [a, b, c] = lens('world');
    a.stats = stats({ change: 40 });
    b.stats = stats({ change: -25 });
    c.stats = stats({ change: 90 });
    c.sparse = true;
    expect(lines()).toContain(`Biggest move up: ${a.name}, ${fmtPct(40)} vs yesterday.`);
    expect(lines()).toContain(`Biggest drop: ${b.name}, ${fmtPct(-25)} vs yesterday.`);
  });
  it('names the steadiest climber that is not a spike yet', () => {
    const [a, b] = lens('world');
    a.stats = stats({ momentum: 0.5 });
    b.stats = stats({ momentum: 2, z: 3 }); // hot already: named above, not here
    expect(lines().find(l => l.startsWith('Steadiest climb'))).toMatch(new RegExp(`^Steadiest climb: ${a.name},`));
  });
  it('names what is hot on other channels, with the channel', () => {
    const turning = lens('turning')[0];
    turning.stats = stats({ z: 3 });
    expect(lines()).toContain(`Elsewhere: ${turning.name} (3.0σ, The Great Turning).`);
  });
  it('keeps a country channel to its own country, and a focused one to itself', () => {
    lens('amsterdam')[0].stats = stats({ z: 3 });
    app.state.activeLens = 'portugal';
    expect(lines().some(l => l.startsWith('Elsewhere'))).toBe(false);
    lens('turning')[0].stats = stats({ z: 3 });
    app.state.activeLens = 'birds';
    expect(lines().some(l => l.startsWith('Elsewhere'))).toBe(false);
  });
  it('mentions fire risk and warnings on Portugal & the land only', () => {
    const facts = {
      fire: { hi: 12, max: 2, n: 278, tomorrow: 0 },
      warnings: { red: 1, orange: 2, yellow: 0, types: 'Vento' },
    };
    expect(lines(facts).some(l => l.includes('fire risk'))).toBe(false);
    app.state.activeLens = 'portugal';
    expect(lines(facts)).toContain(
      'Portugal fire risk today: 12 of 278 municipalities at very high or maximum risk (IPMA); none tomorrow.',
    );
    expect(lines(facts)).toContain('IPMA has 1 red and 2 orange weather warnings active (Vento).');
  });
  it('tells what turned hot or cooled since your last look', () => {
    const [a, b] = lens('world');
    app.state.prevLook = {
      at: Date.now() - 3 * 3600e3,
      source: app.state.source,
      items: { [b.key]: { z: 3, level: 'alert', latest: 1 } },
    };
    a.stats = stats({ z: 3 });
    expect(lines().at(-1)).toMatch(
      new RegExp(`^Since your last look .*ago: newly hot: ${a.name}; cooled down: ${b.name}\\.$`),
    );
  });
  it('lists up to seven movers, hottest first', () => {
    lens('world').forEach((E, i) => (E.stats = stats({ z: i })));
    const movers = buildBrief(app).movers;
    expect(movers.map(E => E.stats.z)).toEqual([...movers.map(E => E.stats.z)].sort((x, y) => y! - x!));
    expect(movers.length).toBeLessThanOrEqual(7);
    expect(movers.every(hasStats)).toBe(true);
  });
});

describe('briefMarkdown', () => {
  it('writes the gist, the movers table, the cards and the rising stories', () => {
    const [a] = lens('world');
    a.stats = stats({ z: 3, latest: 140, change: 40 });
    const story: HNStory = {
      id: 'hn:1',
      title: 'A rising story',
      url: 'https://example.org/1',
      discuss: '',
      domain: 'example.org',
      t: Date.now(),
      points: 1,
      comments: 1,
      topics: [a.key],
      vel: 12,
    };
    const md = briefMarkdown(
      app,
      { rows: [{ id: 'ecb', group: 'ea', k: 'ECB deposit rate', v: '2%', src: 'ECB', href: '#', o: 1 }], facts: {} },
      new Map([[story.id, story]]),
    );
    expect(md).toMatch(/^## PRECOG brief, \d{4}-\d{2}-\d{2} · World\n/);
    expect(md).toContain(`- 1 topic is running hot: ${a.name} (3.0σ).`);
    expect(md).toContain(`| ${a.name} | 140 | ${fmtPct(40)} | 3.0 | alert |`);
    expect(md).toContain('### Datapoints\n- ECB deposit rate: 2% (ECB)');
    expect(md).toContain('### Rising stories\n- [A rising story](https://example.org/1) (12/h)');
  });
  it('leaves out the sections it has nothing for', () => {
    const md = briefMarkdown(app, { rows: [], facts: {} });
    expect(md).not.toMatch(/### (Datapoints|Alerts|Rising stories)/);
  });
});

describe('saveLook', () => {
  it('remembers each topic’s level once the numbers are in', () => {
    lens('world')[0].stats = stats({ z: 3, latest: 7 });
    saveLook(app);
    const look = store.get<{ items: Record<string, { level: string | null; latest: number }> }>(LS.look, { items: {} });
    expect(look.items[lens('world')[0].key]).toEqual({ z: 3, level: 'alert', latest: 7 });
  });
  it('saves nothing while loading', () => {
    app.state.liveLoaded = false;
    saveLook(app);
    expect(store.get(LS.look, null)).toBeNull();
  });
});
