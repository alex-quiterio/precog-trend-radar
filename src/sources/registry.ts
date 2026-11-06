// PRECOG / Trend Radar · Adapter registry, source list and shared fetch helpers. Every adapter registers itself here.
import type { Adapter, AdapterResult, Entry, Query, Source } from '@/types';
import { DAY } from '@core/config';
import { reactive } from 'vue';

export const ADAPTERS: Record<string, Adapter> = {};
// Reactive, so a source registered after start-up (e.g. from the console) shows up in the views.
export const SOURCES: Record<string, Source> = reactive({
  blend: {
    label: 'World attention index',
    parts: ['wikipedia', 'guardian', 'hn'],
    unit: 'index · 100 = 30-day norm',
    blend: true,
  },
});
export function registerAdapter(a: Adapter): void {
  if (!a || !a.id || typeof a.fetch !== 'function') throw new Error('Adapter needs id and fetch()');
  ADAPTERS[a.id] = a;
  if (!SOURCES[a.id] || !SOURCES[a.id].blend)
    SOURCES[a.id] = { label: a.label || a.id, parts: [a.id], unit: a.unit || '' };
}
export const utcDay = (d = Date.now()) => Math.floor(+d / DAY) * DAY;
export const iso = (t: number): string => new Date(t).toISOString();
export const withTimeout = (signal?: AbortSignal, ms = 25000): AbortSignal | undefined =>
  AbortSignal.any ? AbortSignal.any([signal, AbortSignal.timeout(ms)].filter((s): s is AbortSignal => !!s)) : signal;
/** An HTTP error that keeps the status, so callers can react to 403/404/429. */
export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}
/** Fetches JSON. The reply is `unknown`: read it with the helpers in shape.ts, never by trusting its shape. */
export async function getJSON(url: string, signal?: AbortSignal, headers?: HeadersInit): Promise<unknown> {
  const r = await fetch(url, { signal: withTimeout(signal), headers });
  if (!r.ok) throw new HttpError(r.status);
  return r.json();
}
export async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        await fn(items[k], k);
      }
    }),
  );
}
/** Quotes a multi-word topic for exact matching, unless it's already a query expression. */
export const phrase = (q: string): string =>
  /["()]|\bOR\b/.test(q) || !/\s/.test(q.trim()) ? q.trim() : `"${q.trim()}"`;
/** Whole-word, case-insensitive match for a topic phrase in any language. */
export const topicRegex = (q: string): RegExp => {
  const n = String(q).replace(/"/g, '').trim();
  return new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`, 'iu');
};
/** What a source searches for a topic: its query, Wikipedia title, and its lens's language and country. */
export const queryOf = (E: Entry): Query => ({
  name: E.name,
  wiki: E.def.wiki || null,
  q: E.def.q || E.name,
  lang: E.lang || 'en',
  country: E.country ?? null,
});
export const SKIP = (topic: string, why: string): AdapterResult => ({ topic, points: [], skip: why });
