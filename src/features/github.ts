// PRECOG / Trend Radar · GitHub: how much is being built around each topic, and what's rising.
// Two searches per topic (new repos in the last 90 days, and in the 90 days before), cached for 12 h.
// Search allows ~10 requests a minute (30 with a token), so requests are queued just inside that.
import type { Entry } from '../types';
import { DAY, HOUR, sleep, store } from '../core/config';
import { bump } from '../core/ui-store';
import { githubHeaders, githubToken, searchGap } from '../sources/github-auth';
import { HttpError, getJSON, phrase, queryOf } from '../sources/registry';
import { activeLens, entriesOf } from '../state';

export interface GhRepo {
  name: string;
  url: string;
  desc: string;
  stars: number;
  language: string | null;
  created: number;
  /** Stars per day since the repo was created. */
  pace: number;
}
export interface GhTopic {
  key: string;
  name: string;
  color: string;
  /** New repos created in the last 90 days, and in the 90 days before. */
  now: number;
  before: number;
  growth: number | null;
  top: GhRepo[];
}
const PERIOD = 90;
const TTL = 12 * HOUR;
const CACHE = 'precog.github.v1.';

export const gh = {
  lensId: '' as string,
  topics: [] as GhTopic[],
  loading: false,
  done: 0,
  total: 0,
  error: null as string | null,
  at: 0,
};

const queue = { last: 0, chain: Promise.resolve() as Promise<unknown> };
function search(url: string, signal: AbortSignal): Promise<any> {
  const run = queue.chain.then(async () => {
    const wait = queue.last + searchGap() - Date.now();
    if (wait > 0) await sleep(wait);
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    queue.last = Date.now();
    return getJSON(url, signal, githubHeaders());
  });
  queue.chain = run.catch(() => {});
  return run;
}
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

type Cached = Omit<GhTopic, 'key' | 'name' | 'color'>;
async function topicStats(E: Entry, signal: AbortSignal): Promise<Cached> {
  const q = phrase(queryOf(E).q);
  const ck = CACHE + q.toLowerCase();
  const c = store.get<{ at: number; v: Cached } | null>(ck, null);
  if (c && Date.now() - c.at < TTL) return c.v;
  const today = Date.now(),
    from = today - PERIOD * DAY,
    prev = from - PERIOD * DAY;
  const base = 'https://api.github.com/search/repositories?per_page=30&sort=stars&order=desc&q=';
  const recent = await search(base + encodeURIComponent(`${q} created:${ymd(from)}..${ymd(today)}`), signal);
  const older = await search(
    'https://api.github.com/search/repositories?per_page=1&q=' +
      encodeURIComponent(`${q} created:${ymd(prev)}..${ymd(from - DAY)}`),
    signal,
  );
  const now = recent.total_count || 0,
    before = older.total_count || 0;
  const top: GhRepo[] = (recent.items || [])
    .filter(r => !r.fork && r.stargazers_count > 0)
    .map(r => {
      const created = Date.parse(r.created_at);
      return {
        name: r.full_name,
        url: r.html_url,
        desc: String(r.description || '').slice(0, 160),
        stars: r.stargazers_count,
        language: r.language,
        created,
        pace: r.stargazers_count / Math.max(1, (today - created) / DAY),
      };
    });
  const v: Cached = { now, before, growth: before > 0 ? (now - before) / before : null, top };
  store.set(ck, { at: Date.now(), v });
  return v;
}

let abort: AbortController | null = null;
/** Loads GitHub stats for the active lens's topics; cached topics appear at once, the rest fill in. */
export async function loadGitHub(force = false): Promise<void> {
  const lens = activeLens();
  if (!lens) return;
  if (!force && gh.lensId === lens.id && (gh.loading || Date.now() - gh.at < TTL)) return;
  if (abort) abort.abort();
  abort = new AbortController();
  const { signal } = abort;
  const entries = entriesOf(lens);
  Object.assign(gh, { lensId: lens.id, topics: [], loading: true, done: 0, total: entries.length, error: null });
  bump();
  for (const E of entries) {
    try {
      const v = await topicStats(E, signal);
      if (signal.aborted) return;
      gh.topics = [...gh.topics, { key: E.key, name: E.name, color: E.color, ...v }];
    } catch (e) {
      if (e.name === 'AbortError') return;
      gh.error =
        e instanceof HttpError && (e.status === 403 || e.status === 429)
          ? githubToken()
            ? 'GitHub search limit reached; the rest fills in on the next refresh'
            : 'GitHub search limit reached; add a GitHub token (Your GitHub → Token) for 3× the speed'
          : e.message;
      if (e instanceof HttpError && (e.status === 403 || e.status === 429)) break;
    }
    gh.done++;
    bump();
  }
  gh.loading = false;
  gh.at = Date.now();
  bump();
}

/** Repos across the lens, ranked by stars per day since creation (what's rising, not what's old). */
export function risingRepos(topics: GhTopic[], n = 8): (GhRepo & { topic: GhTopic })[] {
  const seen = new Set<string>();
  return topics
    .flatMap(t => t.top.map(r => ({ ...r, topic: t })))
    .sort((a, b) => b.pace - a.pace)
    .filter(r => !seen.has(r.name) && seen.add(r.name))
    .slice(0, n);
}
/** Language share among the leading new repos of every topic; repos with no language and the long tail fold into "Other". */
export function languageMix(topics: GhTopic[], n = 6): { lang: string; count: number; share: number }[] {
  const counts = new Map<string, number>();
  let other = 0;
  topics.forEach(t =>
    t.top.forEach(r => {
      if (r.language) counts.set(r.language, (counts.get(r.language) || 0) + 1);
      else other++;
    }),
  );
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  other += sorted.slice(n).reduce((a, [, c]) => a + c, 0);
  const rows = sorted.slice(0, n);
  if (other) rows.push(['Other', other]);
  const total = rows.reduce((a, [, c]) => a + c, 0) || 1;
  return rows.map(([lang, count]) => ({ lang, count, share: count / total }));
}
