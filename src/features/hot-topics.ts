// PRECOG / Trend Radar · Hot topics: the World channel's topics, picked each day from what the internet is
// echoing. Candidates come from Wikipedia's "In the news" stories and most-read articles; each gains weight
// for every other place it shows up (Hacker News's front page, Manifold's busiest markets, the Guardian's
// newest articles). People, sport, films and shows are left out. A pick stays a few days unless it cools,
// so the chart doesn't reshuffle on every visit, and a topic you pin stays until you unpin it.
// The pure steps (candidates, scoring, choosing) are exported for tests; createHotTopics wires them to the app.
import { reactive } from 'vue';
import { DAY, LS, MAX_TOPICS, store } from '@core/config';
import { errorText } from '@core/errors';
import { looksLikePerson } from '@core/guard';
import { nf0 } from '@core/format';
import { type EchoSignals, type FeedArticle, fetchEchoSignals, peopleAmong } from '@sources/echoes';
import { isObj } from '@sources/shape';
import type { AppStore } from '@/state';
import type { TopicDef } from '@/types';

/** The lens whose topics are picked each day. */
export const HOT_LENS = 'world';
/** Where a topic was seen today. */
export type Echo = 'news' | 'read' | 'hn' | 'manifold' | 'guardian';
export const ECHO_LABEL: Record<Echo, string> = {
  news: 'In the news on Wikipedia',
  read: 'Most read on Wikipedia',
  hn: 'On the Hacker News front page',
  manifold: 'Among Manifold’s busiest markets',
  guardian: 'In the Guardian’s newest articles',
};
/** A picked topic. */
export interface HotPick {
  name: string;
  wiki: string;
  q?: string;
  /** The day (YYYY-MM-DD, UTC) it was first picked. */
  since: string;
  echoes: Echo[];
  /** One line on why it was picked. */
  why: string;
  pinned?: boolean;
}
export interface Candidate {
  name: string;
  wiki: string;
  q: string;
  qid: string;
  score: number;
  echoes: Echo[];
  /** Other article titles of the same story, for spotting it elsewhere. */
  aliases: string[];
  notes: string[];
}

/** How many days a pick keeps a head start over newcomers. */
export const STICKY_DAYS = 3;
/** How long a topic you removed stays out of the picks. */
export const DISMISS_DAYS = 7;

export const dayOf = (t: number): string => new Date(t).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

// --- What is left out ------------------------------------------------
/** Descriptions of articles about a person ("American politician (born 1984)", "(1930–2026)"). */
const PERSON_DESC =
  /\((born|died|c\.|\d{3,4}\s*[–-])|\bborn \d{4}\b|\b(politician|actor|actress|singer|songwriter|rapper|footballer|cricketer|athlete|player|journalist|businessman|businesswoman|entrepreneur|writer|poet|novelist|musician|comedian|presenter|influencer|youtuber|streamer|activist|lawyer|jurist|prosecutor|economist|physician|epidemiologist|photographer|murderer|criminal|governor-elect|mayor of|governor of)\b/i;
/** Sport, films, shows, music and games: popular, but not the news this channel is for. */
const SHOWBIZ_DESC =
  /\b(film|movie|television|tv series|web series|sitcom|miniseries|soap opera|reality show|episode|album|song|single by|band|video game|anime|manga|novel by|soundtrack|concert tour|award ceremony|beauty pageant|football|soccer|basketball|baseball|american football|ice hockey|cricket|tennis|golf|rugby|formula one|grand prix|wrestling|boxing|mixed martial arts|championship series|super bowl|world series|olympic|sports league|sports team|franchise)\b/i;
/** Pages that aren't topics, and events named after one person. */
const NOT_A_TOPIC =
  /^(main page|special:|wikipedia:|portal:|file:|list of|lists of|deaths in|\d{4} in (film|television|music|sports)\b)|^(murder|killing|death|disappearance|assassination|shooting|trial|arrest|kidnapping) of /i;
/**
 * Why an article isn't a topic for World, or null when it is. `nameCheck` adds the guess from the title's
 * words ("James …"); it's skipped when Wikidata has already said who is a person, since it also catches
 * things like "Guy Fawkes Night".
 */
export const leftOut = (a: Pick<FeedArticle, 'title' | 'description'>, nameCheck = true): string | null =>
  NOT_A_TOPIC.test(a.title)
    ? 'not a topic'
    : (nameCheck && looksLikePerson(a.title)) || PERSON_DESC.test(a.description)
      ? 'a person'
      : SHOWBIZ_DESC.test(a.description) || SHOWBIZ_DESC.test(a.title)
        ? 'sport or entertainment'
        : null;

// --- Names and matching ------------------------------------------------
/** A topic name from an article title: no leading year ("2026 Binance hack" → "Binance hack"), at most 40 characters. */
export function topicName(title: string): string {
  const s = title.replace(/^(1[89]|20)\d{2}\s+/, '').trim();
  return s.length <= 40 ? s : s.slice(0, 39).replace(/\s+\S*$/, '') + '…';
}
/** The words a headline would use: no parenthesis, no leading year. */
const core = (title: string): string =>
  title
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^(1[89]|20)\d{2}\s+/, '')
    .trim();
const STOP = new Set(['the', 'of', 'and', 'in', 'on', 'a', 'an', 'for', 'to', 'at', 'by']);
const tokens = (title: string): Set<string> =>
  new Set(
    core(title)
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(w => w && !STOP.has(w))
      .map(w => w.replace(/s$/, '')),
  );
/** True when two titles name the same thing ("2026 United States Senate elections" ~ "2026 United States elections"). */
export function sameStory(a: string, b: string): boolean {
  const A = tokens(a),
    B = tokens(b);
  if (!A.size || !B.size) return false;
  const shared = [...A].filter(w => B.has(w)).length;
  return shared / (A.size + B.size - shared) >= 0.6;
}
/** A regex for a title as a headline would write it: whole words, any case, "United States" or "US", plural or not. */
export function headlineRegex(title: string): RegExp | null {
  const c = core(title);
  if (c.replace(/\s/g, '').length < 4) return null;
  const US = '(?:United\\s+States|U\\.?S\\.?)';
  const src = c
    .replace(/United States/gi, '\u0000')
    .split(/\s+/)
    .map(w => (w === '\u0000' ? US : w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/s$/i, '') + 's?'))
    .join('\\s+')
    .replace(/\u0000/g, US);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${src}(?=$|[^\\p{L}\\p{N}])`, 'iu');
}

// --- Candidates and scores ---------------------------------------------
/** The middle value of a list (0 for none). */
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
/** Yesterday's views against the usual (the median of the days before), e.g. 5 for five times as many. */
export const surgeOf = (a: FeedArticle): number => {
  const h = a.history || [];
  const usual = median(h.slice(0, -1));
  return usual > 0 ? (a.views ?? h[h.length - 1] ?? 0) / usual : 1;
};
const fmtViews = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? nf0.format(n / 1e3) + 'k' : nf0.format(n);

/**
 * Today's candidates, best first. "In the news" stories count most (people chose them); most-read articles
 * count by how far above their usual they are; every other place a candidate shows up adds weight. Each kind
 * of echo counts once, at its strongest: a story with eight surging pages is one topic, a little ahead.
 * `people` holds the Wikidata ids known to be people, or null when Wikidata couldn't say (then the title's
 * words are checked too). `skip` names topics to leave out (ones you removed).
 */
export function candidatesOf(s: EchoSignals, people: Set<string> | null, skip: Set<string> = new Set()): Candidate[] {
  type Work = Candidate & {
    best: Partial<Record<Echo, { score: number; note: string; own?: boolean }>>;
    related: number;
  };
  const out: Work[] = [];
  const ok = (a: FeedArticle) =>
    !people?.has(a.qid) && !leftOut(a, !people) && !skip.has(topicName(a.title).toLowerCase());
  const add = (a: FeedArticle, score: number, echo: Echo, note: string, aliases: string[] = []) => {
    let c = out.find(c => c.wiki === a.title || c.aliases.includes(a.title) || sameStory(c.wiki, a.title));
    if (!c) {
      c = {
        name: topicName(a.title),
        wiki: a.title,
        q: core(a.title),
        qid: a.qid,
        score: 0,
        echoes: [],
        aliases,
        notes: [],
        best: {},
        related: 0,
      };
      out.push(c);
    } else if (echo === 'read') c.related++;
    // The strongest echo counts; the line quotes the topic's own article when it has one.
    const was = c.best[echo];
    const own = a.title === c.wiki;
    c.best[echo] = {
      score: Math.max(score, was?.score ?? 0),
      note: own || !was || (score > was.score && !was.own) ? note : was.note,
      own: own || !!was?.own,
    };
  };
  // In the news: each story's event article if it has one (a title starting with a year), else its first link.
  s.feed.news.forEach(story => {
    const lead = story.find(a => /^(1[89]|20)\d{2}\s/.test(a.title)) || story[0];
    if (lead && ok(lead))
      add(
        lead,
        4,
        'news',
        '',
        story.filter(a => a !== lead && ok(a)).map(a => a.title),
      );
  });
  // Most read: well above its usual, or near the top.
  s.feed.mostRead.forEach(a => {
    const surge = surgeOf(a),
      rank = a.rank ?? 99;
    if (!ok(a) || (surge < 1.5 && rank > 10)) return;
    const note = `${fmtViews(a.views ?? 0)} reads yesterday${surge >= 1.5 ? `, ${surge >= 10 ? Math.round(surge) : surge.toFixed(1)}× usual` : ''}`;
    add(a, 1 + Math.min(3, Math.log2(Math.max(surge, 1))) + (rank <= 10 ? 1 : 0), 'read', note);
  });
  // Echoes elsewhere: the name, or another article of the same story, in a headline or market question.
  (['hn', 'manifold', 'guardian'] as const).forEach(where => {
    const lines = s.elsewhere[where];
    out.forEach(c => {
      const res = [c.wiki, ...c.aliases].map(headlineRegex).filter((r): r is RegExp => !!r);
      const n = lines.filter(l => res.some(r => r.test(l))).length;
      if (!n) return;
      const note =
        where === 'hn'
          ? `${n} on Hacker News`
          : where === 'manifold'
            ? `${n} market${n > 1 ? 's' : ''} on Manifold`
            : `${n} in the Guardian`;
      c.best[where] = { score: 1.5, note };
    });
  });
  return out
    .map(({ best, related, ...c }) => {
      const echoes = (Object.keys(ECHO_LABEL) as Echo[]).filter(e => best[e]);
      const notes = echoes.map(e => best[e]!.note).filter(Boolean);
      if (related)
        notes.splice(
          echoes.includes('news') ? 0 : 1,
          0,
          `+${related} related page${related > 1 ? 's' : ''} in the most read`,
        );
      return {
        ...c,
        echoes,
        notes,
        score: echoes.reduce((t, e) => t + best[e]!.score, 0) + Math.min(1, related * 0.25),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Today's topics: pinned ones first, then the best candidates, where yesterday's picks keep a head start for
 * a few days so the list doesn't churn. Picks that cooled off fill any room left. At most `max`.
 */
export function choosePicks(prev: HotPick[], cands: Candidate[], today: string, max = MAX_TOPICS): HotPick[] {
  const pinned = prev.filter(p => p.pinned);
  const taken = new Set(pinned.map(p => p.wiki));
  const fresh = (p: HotPick | undefined) => !!p && daysBetween(p.since, today) < STICKY_DAYS;
  const ranked = cands
    .filter(c => !taken.has(c.wiki))
    .map(c => {
      const before = prev.find(p => p.wiki === c.wiki || sameStory(p.wiki, c.wiki));
      return { c, before, score: c.score + (fresh(before) ? 2 : 0) };
    })
    .sort((a, b) => b.score - a.score);
  const picks: HotPick[] = [...pinned];
  for (const { c, before } of ranked) {
    if (picks.length >= max) break;
    if (picks.some(p => p.wiki === c.wiki)) continue;
    picks.push({
      name: before?.name ?? c.name,
      wiki: before?.wiki ?? c.wiki,
      q: c.q,
      since: before?.since ?? today,
      echoes: c.echoes,
      why: c.notes.join(' · '),
    });
  }
  // Room left: yesterday's picks that are still recent, then any earlier ones.
  const rest = prev
    .filter(p => !p.pinned && !picks.some(q => q.wiki === p.wiki))
    .sort((a, b) => Number(fresh(b)) - Number(fresh(a)));
  for (const p of rest) {
    if (picks.length >= max) break;
    picks.push({ ...p, echoes: [], why: 'Quieter today; kept until something new takes its place' });
  }
  return picks;
}

/** Topic definitions for the picks, keeping each kept topic's slot (its colour) and filling free slots. */
export function topicsFor(picks: HotPick[], current: TopicDef[]): TopicDef[] {
  const used = new Set<number>();
  const defs = picks.map(p => {
    const was = current.find(t => t.name === p.name || (t.wiki && t.wiki === p.wiki));
    if (!was || used.has(was.slot)) return { p, slot: -1 };
    used.add(was.slot);
    return { p, slot: was.slot };
  });
  const free = [...Array(MAX_TOPICS).keys()].filter(i => !used.has(i));
  return defs
    .map(({ p, slot }) => ({ name: p.name, slot: slot >= 0 ? slot : (free.shift() ?? 0), wiki: p.wiki, q: p.q }))
    .sort((a, b) => a.slot - b.slot);
}

// --- The store -------------------------------------------------------
interface Saved {
  day: string;
  /** The day of the first pick: nothing is "new" that day, since everything is. */
  first: string;
  picks: HotPick[];
  /** Topic names you removed (lower case) → the day they may come back. */
  dismissed: Record<string, string>;
}
function loadSaved(): Saved {
  const v = store.get<unknown>(LS.hot, null);
  const empty: Saved = { day: '', first: '', picks: [], dismissed: {} };
  if (!isObj(v)) return empty;
  const picks = (Array.isArray(v.picks) ? v.picks : []).filter(
    (p): p is HotPick =>
      isObj(p) && typeof p.name === 'string' && typeof p.wiki === 'string' && typeof p.since === 'string',
  );
  return {
    day: typeof v.day === 'string' ? v.day : '',
    first: typeof v.first === 'string' ? v.first : '',
    picks: picks.map(p => ({ ...p, echoes: Array.isArray(p.echoes) ? p.echoes : [], why: String(p.why || '') })),
    dismissed: isObj(v.dismissed) ? (v.dismissed as Record<string, string>) : {},
  };
}

export interface HotDeps {
  app: AppStore;
  fetchSignals?: (signal: AbortSignal) => Promise<EchoSignals>;
  people?: (qids: string[], signal: AbortSignal) => Promise<Set<string>>;
  now?: () => number;
}
export function createHotTopics({
  app,
  fetchSignals = fetchEchoSignals,
  people = peopleAmong,
  now = Date.now,
}: HotDeps) {
  const state = reactive({ ...loadSaved(), loading: false, error: '' });
  let abort: AbortController | null = null;
  const save = () =>
    store.set(LS.hot, { day: state.day, first: state.first, picks: state.picks, dismissed: state.dismissed });
  const lens = () => app.lensById(HOT_LENS);
  const pickOf = (name: string) => state.picks.find(p => p.name.toLowerCase() === name.toLowerCase());

  /** Rewrites the World lens's topics from the picks. */
  function apply(): void {
    const l = lens();
    if (!l) return;
    l.topics = topicsFor(state.picks, l.topics);
    app.syncEntries();
    app.saveLenses();
  }
  /** The topics the lens holds now, as picks (the first time: the shipped World topics, none pinned). */
  function current(): HotPick[] {
    const l = lens();
    if (!l) return [];
    return l.topics.map(
      t => pickOf(t.name) ?? { name: t.name, wiki: t.wiki || t.name, q: t.q, since: dayOf(now()), echoes: [], why: '' },
    );
  }

  /**
   * Picks today's topics, once a day (or now, with force). Resolves true when the topics changed, so the
   * caller can fetch their data. On any failure the current topics stay as they are.
   */
  async function refresh(force = false): Promise<boolean> {
    const today = dayOf(now());
    if (!lens() || state.loading || (!force && state.day === today)) return false;
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;
    state.loading = true;
    state.error = '';
    try {
      const s = await fetchSignals(signal);
      const all = [...s.feed.news.flat(), ...s.feed.mostRead];
      // Wikidata says who is a person; if it can't answer, the descriptions and the titles' words still do.
      const humans = await people(
        all.map(a => a.qid),
        signal,
      ).catch(() => null);
      Object.entries(state.dismissed).forEach(([k, until]) => until <= today && delete state.dismissed[k]);
      const cands = candidatesOf(s, humans, new Set(Object.keys(state.dismissed)));
      if (cands.length < 3) throw new Error('too few topics stood out today');
      const before = current();
      state.picks = choosePicks(before, cands, today);
      state.day = today;
      state.first ||= today;
      save();
      const changed = before.map(p => p.name).join('|') !== state.picks.map(p => p.name).join('|');
      apply();
      return changed;
    } catch (e) {
      if (!signal.aborted) state.error = errorText(e);
      return false;
    } finally {
      state.loading = false;
      if (abort?.signal === signal) abort = null;
    }
  }
  /** Pins a topic so it stays, or unpins it. */
  function togglePin(name: string): void {
    const p = pickOf(name);
    if (!p) return;
    p.pinned = !p.pinned;
    save();
  }
  /** A topic you added to World: it's pinned, since you chose it. */
  function adopt(def: TopicDef): void {
    const p = pickOf(def.name);
    if (p) p.pinned = true;
    else
      state.picks.push({
        name: def.name,
        wiki: def.wiki || def.name,
        q: def.q,
        since: dayOf(now()),
        echoes: [],
        why: 'Added by you',
        pinned: true,
      });
    save();
  }
  /** A topic you removed from World: it stays out of the picks for a week. */
  function dismiss(name: string): void {
    state.picks = state.picks.filter(p => p.name.toLowerCase() !== name.toLowerCase());
    state.dismissed[name.toLowerCase()] = dayOf(now() + DISMISS_DAYS * DAY);
    save();
  }
  /** Makes room for a topic you add to a full World channel: the weakest unpinned pick leaves. */
  function makeRoom(): boolean {
    const l = lens();
    const out = [...state.picks].reverse().find(p => !p.pinned);
    if (!l || !out) return false;
    state.picks = state.picks.filter(p => p !== out);
    l.topics = l.topics.filter(t => t.name !== out.name);
    app.syncEntries();
    return true;
  }
  return {
    state,
    refresh,
    togglePin,
    adopt,
    dismiss,
    makeRoom,
    /** True for the lens whose topics are picked each day. */
    owns: (lensId: string | null | undefined): boolean => lensId === HOT_LENS,
    pickOf,
    /** True for a topic picked today for the first time (not on the very first day, nor one kept as filler). */
    isNew: (p: HotPick | undefined, today: string): boolean =>
      !!p && !p.pinned && p.echoes.length > 0 && p.since === today && !!state.first && state.first !== today,
    stop: () => abort?.abort(),
  };
}
export type HotTopics = ReturnType<typeof createHotTopics>;
