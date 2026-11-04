// PRECOG / Trend Radar · Pure GDELT query helpers, shared by the browser and the CI snapshot script.
// No imports on purpose: scripts/gdelt-snapshot.ts runs this file directly under Node.

const DAY = 86400e3;

/** Quotes a multi-word topic for exact matching, unless it's already a query expression. */
export const phrase = (q: string): string =>
  /["()]|\bOR\b/.test(q) || !/\s/.test(q.trim()) ? q.trim() : `"${q.trim()}"`;

/** The GDELT query for one topic. The snapshot is keyed by this string, lower-cased. */
export const gdeltQuery = (q: string, country?: string | null): string =>
  phrase(q) + (country ? ` sourcecountry:${country}` : '');

export const gdeltDate = (s: string): number =>
  Date.parse(
    `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11) || '00'}:${s.slice(11, 13) || '00'}:${s.slice(13, 15) || '00'}Z`,
  );

/** Turns a timelinevol reply into one point per UTC day (the mean of GDELT's 15-minute buckets). */
export function timelinePoints(j: any): { t: string; value: number }[] {
  const byDay = new Map<number, number[]>();
  (j?.timeline?.[0]?.data || []).forEach((d: { date: string; value: number }) => {
    const t = Math.floor(gdeltDate(d.date) / DAY) * DAY;
    const o = byDay.get(t) || [];
    o.push(+d.value);
    byDay.set(t, o);
  });
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, vs]) => ({ t: new Date(t).toISOString(), value: vs.reduce((x, y) => x + y, 0) / vs.length }));
}

export interface StoryTopic {
  key: string;
  q: string;
  country?: string | null;
}
/**
 * Groups topics into a few OR queries (one per country, at most `per` topics each), so a lens costs
 * one GDELT request instead of six. GDELT rejects keywords under 3 letters, so those are left out.
 */
export function storyQueries(topics: StoryTopic[], per = 6): { q: string; keys: string[] }[] {
  const byCountry = new Map<string, StoryTopic[]>();
  topics
    .filter(t => t.q.replace(/"/g, '').trim().length >= 3)
    .forEach(t => {
      const k = t.country || '';
      byCountry.set(k, [...(byCountry.get(k) || []), t]);
    });
  const out: { q: string; keys: string[] }[] = [];
  byCountry.forEach((list, country) => {
    for (let i = 0; i < list.length; i += per) {
      const chunk = list.slice(i, i + per);
      const terms = [...new Set(chunk.map(t => phrase(t.q)))];
      const body = terms.length > 1 ? `(${terms.join(' OR ')})` : terms[0];
      out.push({ q: body + (country ? ` sourcecountry:${country}` : ''), keys: chunk.map(t => t.key) });
    }
  });
  return out;
}
