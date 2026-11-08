// GitHub momentum: new repos per topic against the 90 days before, what's rising, and the language mix.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeFetch, fixture } from '@sources/fake-fetch';
import { setGithubToken } from '@sources/github/auth';
import { createAppStore, type AppStore } from '@/state';
import { createGitHub, languageMix, risingRepos, type GhRepo, type GhTopic } from './github';

/** Older-period searches (per_page=1) find 100 repos; recent ones answer with the saved search (40,781). */
const net = fakeFetch(url =>
  url.searchParams.get('per_page') === '1' ? { total_count: 100, items: [] } : fixture('github', 'repo-search.json'),
);
let app: AppStore;
// GitHub allows a search every few seconds: run the queue on fake timers rather than wait.
beforeEach(() => {
  vi.useFakeTimers();
  app = createAppStore();
  app.loadLenses();
  app.state.activeLens = 'github';
});
afterEach(() => vi.useRealTimers());
const settle = async (p: Promise<void>) => {
  await vi.runAllTimersAsync();
  await p;
};

describe('loading momentum', () => {
  it('searches each topic twice and fills the topics in as they answer', async () => {
    const gh = createGitHub(app);
    const n = app.entriesOf(app.activeLens()).length;
    await settle(gh.load());
    expect(net.urls).toHaveLength(2 * n);
    expect(gh.state).toMatchObject({ lensId: 'github', loading: false, done: n, total: n, error: null });
    expect(gh.state.topics[0]).toMatchObject({ now: 40781, before: 100, growth: (40781 - 100) / 100 });
    expect(gh.state.topics[0].top[0]).toMatchObject({ name: 'jub0t/Concat', language: 'Rust' });
    expect(decodeURIComponent(net.urls[0])).toMatch(/created:\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}/);
  });
  it('keeps the numbers 12 hours, unless asked to refresh', async () => {
    const gh = createGitHub(app);
    await settle(gh.load());
    const asked = net.urls.length;
    await settle(gh.load());
    expect(net.urls).toHaveLength(asked);
    await settle(gh.load(true)); // every topic is cached, so a forced load still asks nothing
    expect(net.urls).toHaveLength(asked);
  });
  it('stops at the search limit, and suggests a token when there is none', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 403, headers: new Headers(), json: async () => null }));
    const gh = createGitHub(app);
    await settle(gh.load());
    expect(gh.state.error).toMatch(/add a GitHub token/);
    expect(gh.state.done).toBe(0);
    setGithubToken('ghp_x');
    await settle(gh.load(true));
    expect(gh.state.error).toBe('GitHub search limit reached; the rest fills in on the next refresh');
  });
});

describe('rising repos and the language mix', () => {
  const repo = (name: string, pace: number, language: string | null = 'Rust'): GhRepo => ({
    name,
    url: '',
    desc: '',
    stars: 1,
    language,
    created: 0,
    pace,
  });
  const topic = (key: string, top: GhRepo[]): GhTopic => ({
    key,
    name: key,
    color: '',
    now: 0,
    before: 0,
    growth: null,
    top,
  });
  it('ranks repos across topics by stars per day, each once', () => {
    const r = risingRepos([topic('a', [repo('x', 5), repo('y', 9)]), topic('b', [repo('x', 5), repo('z', 1)])], 2);
    expect(r.map(x => [x.name, x.topic.key])).toEqual([
      ['y', 'a'],
      ['x', 'a'],
    ]);
  });
  it('shares out languages, folding the long tail and unknown ones into Other', () => {
    const top = ['Rust', 'Rust', 'Go', 'Python', 'C', null].map((l, i) => repo(String(i), 0, l));
    expect(languageMix([topic('a', top)], 2)).toEqual([
      { lang: 'Rust', count: 2, share: 2 / 6 },
      { lang: 'Go', count: 1, share: 1 / 6 },
      { lang: 'Other', count: 3, share: 3 / 6 },
    ]);
    expect(languageMix([])).toEqual([]);
  });
});
