// PRECOG / Trend Radar · Your GitHub: public repos, stars, languages and the last 30 days of activity.
// Reads only public data for the username you set (your own), with three unauthenticated calls,
// cached for 30 minutes. GitHub allows 60 such calls an hour.
import { reactive, ref } from 'vue';
import { errorText } from '@core/errors';
import { MIN, store } from '@core/config';
import { githubHeaders } from '@sources/github/auth';
import { HttpError, getJSON } from '@sources/registry';
import { parseActivity, parseUser, parseUserRepos } from '@sources/github/parse';

const USER_KEY = 'precog.github.user';
const CACHE = 'precog.github.me.v1.';
export const DEFAULT_USER = 'alex-quiterio';
// Held in a ref (and mirrored to storage) so the panel shows a new username straight away.
const user = ref<string>(String(store.get(USER_KEY, DEFAULT_USER) || '').trim());
export const githubUser = (): string => user.value;
export function setGithubUser(u: string): void {
  user.value = String(u || '').trim();
  store.set(USER_KEY, user.value);
}

export interface MyRepo {
  name: string;
  url: string;
  desc: string;
  stars: number;
  forks: number;
  language: string | null;
  pushed: number;
}
export interface MyStats {
  login: string;
  url: string;
  publicRepos: number;
  followers: number;
  stars: number;
  languages: { lang: string; count: number }[];
  topRepos: MyRepo[];
  recent: MyRepo[];
  /** Public events per UTC day, oldest first, last 30 days. */
  activity: { t: number; value: number }[];
  pushes30: number;
  activeDays30: number;
}

export const me = reactive({ stats: null as MyStats | null, loading: false, error: null as string | null, at: 0 });

export async function loadMyGitHub(force = false): Promise<void> {
  const login = githubUser();
  if (!login) {
    Object.assign(me, { stats: null, error: null });
    return;
  }
  const ck = CACHE + login.toLowerCase();
  const c = store.get<{ at: number; stats: MyStats } | null>(ck, null);
  if (!force && c && Date.now() - c.at < 30 * MIN) {
    Object.assign(me, { stats: c.stats, at: c.at, error: null });
    return;
  }
  me.loading = true;
  me.error = null;
  try {
    const base = `https://api.github.com/users/${encodeURIComponent(login)}`;
    const [userReply, repoReply, events] = await Promise.all([
      getJSON(base, undefined, githubHeaders()),
      getJSON(`${base}/repos?per_page=100&sort=pushed&type=owner`, undefined, githubHeaders()),
      getJSON(`${base}/events/public?per_page=100`, undefined, githubHeaders()).catch(() => []),
    ]);
    const user = parseUser(userReply);
    const own: MyRepo[] = parseUserRepos(repoReply).map(({ name, url, desc, stars, forks, language, pushed }) => ({
      name,
      url,
      desc,
      stars,
      forks,
      language,
      pushed,
    }));
    const langs = new Map<string, number>();
    own.forEach(r => r.language && langs.set(r.language, (langs.get(r.language) || 0) + 1));
    const { days, pushes } = parseActivity(events);
    const stats: MyStats = {
      ...user,
      stars: own.reduce((a, r) => a + r.stars, 0),
      languages: [...langs.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([lang, count]) => ({ lang, count })),
      topRepos: [...own].sort((a, b) => b.stars - a.stars || b.pushed - a.pushed).slice(0, 5),
      recent: own.slice(0, 5),
      activity: days,
      pushes30: pushes,
      activeDays30: days.filter(d => d.value > 0).length,
    };
    store.set(ck, { at: Date.now(), stats });
    Object.assign(me, { stats, at: Date.now() });
  } catch (e) {
    me.error =
      e instanceof HttpError && e.status === 404
        ? `no GitHub user called “${login}”`
        : e instanceof HttpError && e.status === 401
          ? 'GitHub rejected the token; change or remove it'
          : e instanceof HttpError && (e.status === 403 || e.status === 429)
            ? 'GitHub rate limit reached; try again in a few minutes, or add a token'
            : errorText(e);
  }
  me.loading = false;
}
