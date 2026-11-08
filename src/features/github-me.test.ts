// Your GitHub: public numbers for a username, from three calls, kept 30 minutes.
import { describe, expect, it } from 'vitest';
import { store } from '@core/config';
import { fakeFetch, fixture } from '@sources/fake-fetch';
import { HttpError } from '@sources/registry';
import { DEFAULT_USER, createMyGitHub } from './github-me';

const today = new Date().toISOString().slice(0, 10);
const net = fakeFetch(url => {
  if (url.pathname.endsWith('/repos')) return fixture('github', 'user-repos.json');
  if (url.pathname.endsWith('/events/public'))
    return [
      { type: 'PushEvent', created_at: `${today}T08:00:00Z`, payload: { size: 3 } },
      { type: 'WatchEvent', created_at: `${today}T09:00:00Z` },
    ];
  if (url.pathname === '/users/octocat') return fixture('github', 'user.json');
  throw new HttpError(404);
});

describe('your GitHub', () => {
  it('starts with the default username, and keeps a new one trimmed', () => {
    const me = createMyGitHub();
    expect(me.user()).toBe(DEFAULT_USER);
    me.setUser('  octocat ');
    expect(me.user()).toBe('octocat');
    expect(store.get('precog.github.user', '')).toBe('octocat');
  });
  it('adds up stars, languages, top repos and the last 30 days', async () => {
    const me = createMyGitHub();
    me.setUser('octocat');
    await me.load();
    const s = me.state.stats!;
    expect(s).toMatchObject({ login: 'octocat', publicRepos: 8, followers: 24952, pushes30: 3, activeDays30: 1 });
    expect(s.stars).toBe(s.topRepos.reduce((a, r) => a + r.stars, 0));
    expect(s.topRepos[0].name).toBe('Spoon-Knife');
    expect(s.languages.every(l => l.lang)).toBe(true); // repos with no language aren't counted
    expect(s.activity).toHaveLength(30);
  });
  it('reads a user once every 30 minutes, unless asked to refresh', async () => {
    const me = createMyGitHub();
    me.setUser('octocat');
    await me.load();
    await me.load();
    expect(net.urls).toHaveLength(3);
    await me.load(true);
    expect(net.urls).toHaveLength(6);
  });
  it('still shows the numbers when the activity can’t be read', async () => {
    net.custom = url => {
      if (url.pathname.endsWith('/events/public')) throw new Error('down');
    };
    const me = createMyGitHub();
    me.setUser('octocat');
    await me.load();
    expect(me.state.stats?.activeDays30).toBe(0);
    expect(me.state.error).toBeNull();
  });
  it.each([
    [404, 'no GitHub user called “octocat”'],
    [401, 'GitHub rejected the token; change or remove it'],
    [403, 'GitHub rate limit reached; try again in a few minutes, or add a token'],
  ])('says what went wrong on HTTP %i', async (status, message) => {
    net.custom = url => {
      if (url.pathname === '/users/octocat') throw new HttpError(status);
    };
    const me = createMyGitHub();
    me.setUser('octocat');
    await me.load();
    expect(me.state.error).toBe(message);
    expect(me.state.loading).toBe(false);
  });
  it('shows nothing without a username', async () => {
    const me = createMyGitHub();
    me.setUser('');
    await me.load();
    expect(me.state.stats).toBeNull();
    expect(net.urls).toEqual([]);
  });
});
