// PRECOG / Trend Radar · Parsers for GitHub's REST replies: repository search, a user, their repos and events.
import { DAY } from '@core/config';
import { ShapeError, at, list, listOr, num, obj, str } from '@sources/shape';

/** A repository as PRECOG shows it. */
export interface Repo {
  name: string;
  url: string;
  desc: string;
  stars: number;
  forks: number;
  language: string | null;
  created: number;
  pushed: number;
}
/** One repository object from any GitHub reply; null for forks and anything without a name or link. */
function repo(r: unknown, nameField: 'name' | 'full_name', descMax: number): Repo | null {
  const name = str(at(r, nameField)),
    url = str(at(r, 'html_url'));
  if (!name || !url || at(r, 'fork') === true) return null;
  return {
    name,
    url,
    desc: str(at(r, 'description')).slice(0, descMax),
    stars: num(at(r, 'stargazers_count')) ?? 0,
    forks: num(at(r, 'forks_count')) ?? 0,
    language: str(at(r, 'language')) || null,
    created: Date.parse(str(at(r, 'created_at'))),
    pushed: Date.parse(str(at(r, 'pushed_at'))),
  };
}
const notNull = <T>(v: T | null): v is T => v != null;

/** A repository search reply: the total match count and the repos listed (forks dropped). */
export function parseRepoSearch(reply: unknown): { total: number; repos: Repo[] } {
  const j = obj(reply, 'GitHub search');
  const total = num(j.total_count);
  if (total == null) throw new ShapeError('GitHub search', 'no total_count');
  return {
    total,
    repos: listOr(j.items)
      .map(r => repo(r, 'full_name', 160))
      .filter(notNull),
  };
}
/** A user's own repos (forks dropped), in the order GitHub listed them. */
export const parseUserRepos = (reply: unknown): Repo[] =>
  list(reply, 'GitHub repos')
    .map(r => repo(r, 'name', 140))
    .filter(notNull);
/** The public profile fields PRECOG shows. */
export function parseUser(reply: unknown): { login: string; url: string; publicRepos: number; followers: number } {
  const j = obj(reply, 'GitHub user');
  const login = str(j.login);
  if (!login) throw new ShapeError('GitHub user', 'no login');
  return {
    login,
    url: str(j.html_url),
    publicRepos: num(j.public_repos) ?? 0,
    followers: num(j.followers) ?? 0,
  };
}
/** Public events bucketed into the 30 UTC days ending `today`, oldest first, and the commits pushed. */
export function parseActivity(
  reply: unknown,
  today = Math.floor(Date.now() / DAY) * DAY,
): { days: { t: number; value: number }[]; pushes: number } {
  const days = Array.from({ length: 30 }, (_, i) => ({ t: today - (29 - i) * DAY, value: 0 }));
  let pushes = 0;
  listOr(reply).forEach(e => {
    const d = Math.floor(Date.parse(str(at(e, 'created_at'))) / DAY) * DAY;
    const slot = days.find(x => x.t === d);
    if (!slot) return;
    slot.value++;
    if (at(e, 'type') === 'PushEvent')
      pushes += num(at(e, 'payload', 'size')) || listOr(at(e, 'payload', 'commits')).length || 1;
  });
  return { days, pushes };
}
