// PRECOG GDELT snapshot: fetches GDELT once, from CI, for every topic in the shipped lenses, and
// writes data/gdelt.json next to the page. Browsers read this file first, so visitors don't each
// queue ~50 requests against GDELT's one-request-per-5-s limit (and get their network blocked).
//
//   node scripts/gdelt-snapshot.ts dist/data/gdelt.json
//   PREVIOUS_URL=https://…/data/gdelt.json node scripts/gdelt-snapshot.ts out.json
//
// PREVIOUS_URL is the snapshot currently published. Timelines are daily data, so when the previous
// snapshot is from today they are reused and only the 24-hour article lists are refreshed.
// It never fails the build: a topic GDELT refuses keeps its previous value, or is left for the browser.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PRESETS } from '../src/core/config.ts';
import { gdeltQuery, storyQueries, timelinePoints } from '../src/sources/gdelt-query.ts';

type Points = { t: string; value: number }[];
interface Snapshot {
  at: string;
  timelines: Record<string, Points>;
  articles: Record<string, unknown[]>;
}

const out = process.argv[2] || 'dist/data/gdelt.json';
const GAP = 7000;
const UA = 'PRECOG-trend-radar-snapshot/1.0 (+https://github.com/alex-quiterio/precog-trend-radar)';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let last = 0;
// Stop asking after several refusals in a row: GDELT has blocked this runner, and waiting won't help.
let streak = 0;
const GIVE_UP = 4;

async function gdelt(params: string): Promise<any> {
  if (streak >= GIVE_UP) throw new Error('skipped: GDELT is refusing this runner');
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = last + GAP * 2 ** attempt - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const r = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?format=json&${params}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(60000),
      });
      const text = await r.text();
      last = Date.now();
      if (r.ok && !/^\s*Please limit/i.test(text)) {
        streak = 0;
        return JSON.parse(text || '{}');
      }
      console.warn(`  GDELT ${r.status}, backing off (attempt ${attempt + 1})`);
    } catch (e) {
      last = Date.now();
      console.warn(`  ${(e as Error).message}, backing off (attempt ${attempt + 1})`);
    }
  }
  streak++;
  throw new Error('GDELT refused after 4 attempts');
}

async function previous(): Promise<Snapshot | null> {
  const url = process.env.PREVIOUS_URL;
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return r.ok ? ((await r.json()) as Snapshot) : null;
  } catch {
    return null;
  }
}

const prev = await previous();
const sameDay = prev && prev.at.slice(0, 10) === new Date().toISOString().slice(0, 10);
const snap: Snapshot = { at: new Date().toISOString(), timelines: {}, articles: {} };

const lensTopics = (lens: (typeof PRESETS)[number]) =>
  lens.topics.map(t => {
    const [name, def] = t as [string, { q?: string }?];
    return { key: `${lens.id}:${name}`, q: def?.q || name, country: (lens as { country?: string }).country || null };
  });
const topics = PRESETS.flatMap(lensTopics);

let ok = 0,
  kept = 0,
  failed = 0;
console.log(`Timelines for ${topics.length} topics${sameDay ? ' (reusing today’s)' : ''}…`);
for (const t of topics) {
  const key = gdeltQuery(t.q, t.country).toLowerCase();
  if (snap.timelines[key]) continue;
  if (sameDay && prev?.timelines[key]?.length) {
    snap.timelines[key] = prev.timelines[key];
    kept++;
    continue;
  }
  try {
    const points = timelinePoints(
      await gdelt(`mode=timelinevol&timespan=3months&query=${encodeURIComponent(gdeltQuery(t.q, t.country))}`),
    );
    if (points.length) {
      snap.timelines[key] = points;
      ok++;
    }
  } catch (e) {
    failed++;
    if (prev?.timelines[key]) snap.timelines[key] = prev.timelines[key];
    console.warn(`  ${t.key}: ${(e as Error).message}`);
  }
}

// One combined query per lens, matching how the browser groups the "Lens" scope.
const groups = PRESETS.flatMap(lens => storyQueries(lensTopics(lens)));
console.log(`Articles for ${groups.length} lens queries…`);
for (const g of groups) {
  const key = g.q.toLowerCase();
  if (snap.articles[key]) continue;
  try {
    const j = await gdelt(`mode=artlist&timespan=24h&maxrecords=250&sort=hybridrel&query=${encodeURIComponent(g.q)}`);
    snap.articles[key] = (j.articles || []).map(a => ({
      url: a.url,
      title: a.title,
      domain: a.domain,
      sourcecountry: a.sourcecountry,
      seendate: a.seendate,
    }));
    ok++;
  } catch (e) {
    failed++;
    console.warn(`  ${g.q}: ${(e as Error).message}`);
  }
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(snap));
console.log(`Wrote ${out}: ${ok} fetched, ${kept} reused, ${failed} failed.`);
