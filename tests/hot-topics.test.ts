// World's daily topic pick: filters, matching, scoring and choosing on saved real replies (6 Nov 2026), then
// the store against a fake network, and the actions that pin, add and remove World topics.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActions } from '@/actions';
import { createAppStore, type AppStore } from '@/state';
import { memoryBackend, useBackend } from '@core/storage';
import { DAY } from '@core/config';
import {
  type Candidate,
  type HotPick,
  candidatesOf,
  choosePicks,
  createHotTopics,
  headlineRegex,
  leftOut,
  sameStory,
  topicName,
  topicsFor,
} from '@features/hot-topics';
import type { EchoSignals } from '@sources/echoes';
import { parseFeed, parseHnTitles, parseManifoldQuestions, parseSparqlItems } from '@sources/echoes/parse';
import feed from '@sources/echoes/fixtures/featured-feed.json';
import hn from '@sources/echoes/fixtures/hn-front-page.json';
import manifold from '@sources/echoes/fixtures/manifold-trending.json';
import humans from '@sources/echoes/fixtures/wikidata-humans.json';

const signals = (extra: Partial<EchoSignals['elsewhere']> = {}): EchoSignals => ({
  feed: parseFeed(feed),
  elsewhere: { hn: parseHnTitles(hn), manifold: parseManifoldQuestions(manifold), guardian: [], ...extra },
});
const PEOPLE = parseSparqlItems(humans);
const TODAY = '2026-11-06';

describe('what is left out', () => {
  it('people, by their description or (when Wikidata can’t say) their name', () => {
    expect(
      leftOut({ title: 'Abdul El-Sayed', description: 'American epidemiologist and politician (born 1984)' }),
    ).toBe('a person');
    expect(leftOut({ title: 'Dolores Huerta', description: 'American labor leader (1930–2026)' })).toBe('a person');
    expect(leftOut({ title: 'Disappearance of Natalee Holloway', description: '2005 disappearance' })).toBe(
      'not a topic',
    );
    expect(leftOut({ title: 'Guy Fawkes Night', description: 'Annual custom originating in England' })).toBe(
      'a person',
    );
    expect(
      leftOut({ title: 'Guy Fawkes Night', description: 'Annual custom originating in England' }, false),
    ).toBeNull();
  });
  it('sport, films, shows and non-topics', () => {
    expect(leftOut({ title: '2026 World Series', description: "Major League Baseball's championship series" })).toBe(
      'sport or entertainment',
    );
    expect(leftOut({ title: 'Ramayana: Part 1', description: '2026 Indian film by Nitesh Tiwari' })).toBe(
      'sport or entertainment',
    );
    expect(leftOut({ title: 'VisionQuest', description: 'Marvel Studios television miniseries' })).toBe(
      'sport or entertainment',
    );
    expect(leftOut({ title: 'Deaths in 2026', description: '' })).toBe('not a topic');
    expect(leftOut({ title: '2026 Binance hack', description: 'Cryptocurrency theft' })).toBeNull();
    expect(leftOut({ title: 'Large language model', description: 'Type of machine learning model' })).toBeNull();
  });
});

describe('names and matching', () => {
  it('names a topic after its article, without the leading year, in at most 40 characters', () => {
    expect(topicName('2026 Binance hack')).toBe('Binance hack');
    expect(topicName('.xyz')).toBe('.xyz');
    expect(
      topicName('2026 United States Senate election in Mississippi and somewhere else').length,
    ).toBeLessThanOrEqual(40);
  });
  it('spots a title in a headline: whole words, any case, US for United States, plural or not', () => {
    expect(headlineRegex('United States Senate')!.test('Democrats eye the US Senate')).toBe(true);
    expect(headlineRegex('2026 Binance hack')!.test('Inside the Binance hacks')).toBe(true);
    expect(headlineRegex('Binance')!.test('Binancer launches')).toBe(false);
    expect(headlineRegex('AI')).toBeNull(); // too short to match safely
  });
  it('treats near-identical titles as one story', () => {
    expect(sameStory('2026 United States Senate elections', '2026 United States elections')).toBe(true);
    expect(sameStory('United States Senate', '2026 United States elections')).toBe(false);
  });
});

describe('candidates from today’s replies', () => {
  it('picks the news, not the people, films or sport, and folds a story’s pages into one topic', () => {
    const c = candidatesOf(signals(), PEOPLE);
    expect(c.map(x => x.name)).toEqual([
      'United States elections',
      'Polish Constitutional Tribunal crisis',
      'Binance hack',
      'Guy Fawkes Night',
      '.xyz',
    ]);
    expect(c[0]).toMatchObject({ echoes: ['news', 'read', 'manifold'] }); // “US Senate” in a market question
    expect(c[0].notes.join(' · ')).toBe(
      '+8 related pages in the most read · 356k reads yesterday · 3 markets on Manifold',
    );
    expect(c[3].notes).toEqual(['137k reads yesterday, 14× usual']);
  });
  it('without Wikidata, the title check keeps out anything named like a person (at a cost)', () => {
    expect(candidatesOf(signals(), null).map(x => x.name)).not.toContain('Guy Fawkes Night');
  });
  it('weighs every other place a topic echoes', () => {
    const before = candidatesOf(signals(), PEOPLE).find(x => x.name === 'Binance hack')!;
    const after = candidatesOf(
      signals({ hn: ['Binance hack drains $400M'], guardian: ['Crypto exchange Binance hacked'] }),
      PEOPLE,
    ).find(x => x.name === 'Binance hack')!;
    expect(after.echoes).toEqual(['news', 'hn', 'guardian']);
    expect(after.score).toBe(before.score + 3);
    expect(after.notes).toEqual(['1 on Hacker News', '1 in the Guardian']);
  });
  it('leaves out topics you removed', () => {
    expect(candidatesOf(signals(), PEOPLE, new Set(['binance hack'])).map(x => x.name)).not.toContain('Binance hack');
  });
});

const cand = (name: string, score: number): Candidate => ({
  name,
  wiki: name,
  q: name,
  qid: '',
  score,
  echoes: ['read'],
  aliases: [],
  notes: [],
});
const pick = (name: string, since: string, more: Partial<HotPick> = {}): HotPick => ({
  name,
  wiki: name,
  since,
  echoes: [],
  why: '',
  ...more,
});

describe('choosing the day’s topics', () => {
  it('keeps pinned topics, then takes the best, at most six', () => {
    const c = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => cand(n, 10 - i));
    const out = choosePicks([pick('Mine', '2026-01-01', { pinned: true })], c, TODAY);
    expect(out.map(p => p.name)).toEqual(['Mine', 'A', 'B', 'C', 'D', 'E']);
  });
  it('gives a recent pick a head start, so the list doesn’t churn; an old one has to earn its place', () => {
    const c = [cand('New', 5), cand('Recent', 3.5), cand('Old', 3.5), cand('X', 4), cand('Y', 4), cand('Z', 4)];
    const prev = [pick('Recent', '2026-11-05'), pick('Old', '2026-11-01')];
    const out = choosePicks(prev, c, TODAY, 3);
    expect(out.map(p => p.name)).toEqual(['Recent', 'New', 'X']);
    expect(out[0].since).toBe('2026-11-05'); // still counts from the day it was first picked
  });
  it('fills a quiet day with what was there before', () => {
    const out = choosePicks([pick('Tariffs', '2026-10-01')], [cand('A', 5)], TODAY, 3);
    expect(out.map(p => [p.name, p.echoes.length])).toEqual([
      ['A', 1],
      ['Tariffs', 0],
    ]);
  });
  it('keeps each kept topic’s colour slot and gives new ones the free slots', () => {
    const defs = topicsFor(
      [pick('New', TODAY), pick('Kept', '2026-11-05')],
      [
        { name: 'Gone', slot: 0 },
        { name: 'Kept', slot: 3, wiki: 'Kept' },
      ],
    );
    expect(defs.map(d => [d.name, d.slot])).toEqual([
      ['New', 0],
      ['Kept', 3],
    ]);
  });
});

describe('the World pick, with a fake network', () => {
  let app: AppStore;
  let now = Date.parse(`${TODAY}T08:00:00Z`);
  const fetchSignals = vi.fn(async () => signals());
  const people = vi.fn(async () => PEOPLE);
  const make = () => createHotTopics({ app, fetchSignals, people, now: () => now });
  beforeEach(() => {
    useBackend(memoryBackend());
    app = createAppStore();
    app.loadLenses();
    now = Date.parse(`${TODAY}T08:00:00Z`);
    fetchSignals.mockClear();
    fetchSignals.mockImplementation(async () => signals());
  });
  const worldTopics = () => app.lensById('world')!.topics.map(t => t.name);

  it('replaces World’s topics once a day, keeping a shipped one to fill the sixth place', async () => {
    const hot = make();
    expect(await hot.refresh()).toBe(true);
    expect(worldTopics()).toHaveLength(6);
    expect(worldTopics()).toEqual(
      expect.arrayContaining(['United States elections', 'Binance hack', 'Guy Fawkes Night', '.xyz']),
    );
    expect(app.state.rt.has('world::binance hack')).toBe(true); // ready for the data loop
    expect(await hot.refresh()).toBe(false); // same day: nothing to do
    const binance = hot.pickOf('Binance hack');
    expect(hot.isNew(binance, TODAY)).toBe(false); // the first day: everything is new, so nothing is marked
    expect(fetchSignals).toHaveBeenCalledTimes(1);
    // A new visit the same day reads the pick back instead of fetching.
    expect(await make().refresh()).toBe(false);
    expect(fetchSignals).toHaveBeenCalledTimes(1);
  });
  it('keeps the current topics when the pick fails', async () => {
    fetchSignals.mockImplementation(async () => {
      throw new Error('HTTP 503');
    });
    const before = worldTopics();
    const hot = make();
    expect(await hot.refresh()).toBe(false);
    expect(worldTopics()).toEqual(before);
    expect(hot.state.error).toBe('HTTP 503');
  });
  it('still picks when Wikidata is down, without the topics named like people', async () => {
    people.mockImplementationOnce(async () => {
      throw new Error('HTTP 502');
    });
    await make().refresh();
    expect(worldTopics()).toContain('Binance hack');
    expect(worldTopics()).not.toContain('Guy Fawkes Night');
  });

  describe('through the actions', () => {
    const fakeLive = () => ({
      signal: () => undefined,
      parts: () => [] as string[],
      fetchPart: vi.fn(async () => {}),
      setStatus: vi.fn(),
      start: vi.fn(),
    });
    const fakeStories = () => ({ load: vi.fn(async () => {}), status: { at: {} } });
    it('pins a topic so the next day’s pick keeps it', async () => {
      const hot = make();
      const actions = createActions(app, { live: fakeLive(), stories: fakeStories(), hot });
      await hot.refresh();
      actions.togglePin('world::.xyz');
      expect(hot.pickOf('.xyz')?.pinned).toBe(true);
      now += 5 * DAY;
      fetchSignals.mockImplementation(async () => ({
        ...signals(),
        feed: { news: signals().feed.news, mostRead: [] },
      }));
      await hot.refresh();
      expect(worldTopics()).toContain('.xyz');
    });
    it('a topic you add is pinned, and takes the weakest pick’s place when World is full', async () => {
      const hot = make();
      const actions = createActions(app, { live: fakeLive(), stories: fakeStories(), hot });
      app.state.activeLens = 'world';
      await hot.refresh();
      expect(worldTopics()).toHaveLength(6);
      expect(actions.addTopic('Heat pumps')).toBe(true);
      expect(worldTopics()).toHaveLength(6);
      expect(worldTopics()).toContain('Heat pumps');
      expect(hot.pickOf('Heat pumps')?.pinned).toBe(true);
    });
    it('a topic you remove stays out of the picks for a week', async () => {
      const hot = make();
      const actions = createActions(app, { live: fakeLive(), stories: fakeStories(), hot });
      await hot.refresh();
      actions.removeTopic('world::binance hack');
      expect(app.ui.watchMsg).toContain('won’t be picked again'.replace('’', "'"));
      now += DAY;
      await hot.refresh();
      expect(worldTopics()).not.toContain('Binance hack');
      now += 7 * DAY;
      await hot.refresh();
      expect(worldTopics()).toContain('Binance hack');
      expect(hot.isNew(hot.pickOf('Binance hack'), '2026-11-14')).toBe(true); // back, and marked new
    });
  });
});
