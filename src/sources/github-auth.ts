// PRECOG / Trend Radar · Optional GitHub token. Without one GitHub allows ~10 searches a minute and
// 60 other calls an hour; with one, 30 searches a minute and 5,000 calls an hour. A fine-grained
// token with no permissions at all is enough (public data only). It lives only in this browser.
import { store } from '../core/config';

const KEY = 'precog.github.token';
export const githubToken = (): string => String(store.get(KEY, '') || '').trim();
export function setGithubToken(t: string): void {
  store.set(KEY, String(t || '').trim());
}
export function githubHeaders(): HeadersInit {
  const t = githubToken();
  return t
    ? { Accept: 'application/vnd.github+json', Authorization: `Bearer ${t}` }
    : { Accept: 'application/vnd.github+json' };
}
/** Milliseconds to wait between searches, inside GitHub's per-minute search limit. */
export const searchGap = (): number => (githubToken() ? 2100 : 6500);
