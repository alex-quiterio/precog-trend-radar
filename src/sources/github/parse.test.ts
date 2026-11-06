import { describe, expect, it } from 'vitest';
import search from './fixtures/repo-search.json';
import user from './fixtures/user.json';
import repos from './fixtures/user-repos.json';
import { parseActivity, parseRepoSearch, parseUser, parseUserRepos } from './parse';

const DAY = 86400e3;

describe('GitHub replies', () => {
  it('reads a repository search: total and repos', () => {
    const { total, repos: found } = parseRepoSearch(search);
    expect(total).toBe(40781);
    expect(found[0]).toMatchObject({ name: 'jub0t/Concat', stars: 14519, language: 'Rust' });
    expect(found[0].created).toBe(Date.parse('2026-08-25T18:34:47Z'));
  });
  it('refuses a search reply without a total (e.g. a rate-limit message)', () => {
    expect(() => parseRepoSearch({ message: 'API rate limit exceeded' })).toThrow(/total_count/);
  });
  it('reads a user, and their own repos without forks', () => {
    expect(parseUser(user)).toMatchObject({ login: 'octocat', url: 'https://github.com/octocat' });
    expect(parseUserRepos(repos).map(r => r.name)).toEqual(['Spoon-Knife', 'Hello-World']);
  });
  it('buckets public events into 30 days and counts pushed commits', () => {
    const today = Date.UTC(2026, 10, 6);
    const { days, pushes } = parseActivity(
      [
        { type: 'PushEvent', created_at: '2026-11-06T10:00:00Z', payload: { size: 3 } },
        { type: 'IssuesEvent', created_at: '2026-11-05T10:00:00Z' },
        { type: 'PushEvent', created_at: '2026-01-01T10:00:00Z', payload: { size: 9 } }, // outside the 30 days
      ],
      today,
    );
    expect(days).toHaveLength(30);
    expect(days[29]).toEqual({ t: today, value: 1 });
    expect(days[28]).toEqual({ t: today - DAY, value: 1 });
    expect(pushes).toBe(3);
  });
});
