// PRECOG / Trend Radar · Adapter registry, source list and shared fetch helpers. Every adapter registers itself here.
import type { Adapter, AdapterResult, Entry, Lens, Query, Source } from '../types';
import { DAY } from '../core/config';
import { bump } from '../core/ui-store';
import { lensById } from '../state';

export const ADAPTERS: Record<string, Adapter> = {};
export const SOURCES: Record<string, Source> = {
  blend: {
    label: 'World attention index',
    parts: ['news', 'wikipedia', 'hn'],
    unit: 'index · 100 = 30-day norm',
    blend: true,
  },
};
export function addSourceOption(id) {
  if (typeof bump === 'function') bump(); // the source <select> is rendered from SOURCES
}
export function registerAdapter(a: Adapter): void {
  if (!a || !a.id || typeof a.fetch !== 'function') throw new Error('Adapter needs id and fetch()');
  ADAPTERS[a.id] = a;
  if (!SOURCES[a.id] || !SOURCES[a.id].blend)
    SOURCES[a.id] = { label: a.label || a.id, parts: [a.id], unit: a.unit || '' };
  addSourceOption(a.id);
}
export const utcDay = (d = Date.now()) => Math.floor(+d / DAY) * DAY;
export const iso = t => new Date(t).toISOString();
export const withTimeout = (signal?: AbortSignal, ms = 25000): AbortSignal | undefined =>
  AbortSignal.any ? AbortSignal.any([signal, AbortSignal.timeout(ms)].filter(Boolean)) : signal;
/** An HTTP error that keeps the status, so callers can react to 403/404/429. */
export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}
export async function getJSON(url: string, signal?: AbortSignal, headers?: HeadersInit): Promise<any> {
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
export const phrase = q => (/["()]|\bOR\b/.test(q) || !/\s/.test(q.trim()) ? q.trim() : `"${q.trim()}"`);
export const queryOf = (E: Entry): Query => {
  const l: Partial<Lens> = lensById(E.lensId) || {};
  return {
    name: E.name,
    wiki: E.def.wiki || null,
    q: E.def.q || E.name,
    lang: l.lang || 'en',
    country: l.country || null,
  };
};
export const SKIP = (topic: string, why: string): AdapterResult => ({ topic, points: [], skip: why });
