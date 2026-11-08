// PRECOG / Trend Radar · For tests only: answers `fetch` from saved replies (src/sources/*/fixtures) or built
// ones, so a source's loaders run without the network. Never imported by the app.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { CARD_LOADERS, loadCards, type DatapointFacts, type DatapointRow } from '@sources/cards';
import { HttpError } from '@sources/registry';

/** A saved reply, as text. */
export const fixture = (source: string, name: string): string =>
  readFileSync(new URL(`./${source}/fixtures/${name}`, import.meta.url), 'utf8');

/** A reply: text as it is, anything else as JSON. Throwing an HttpError answers its status; anything else, 500. */
type Answer = (url: URL) => unknown;
export interface FakeNet {
  /** Asked first, before the default answer; anything but undefined is the reply. Reset before each test. */
  custom: Answer;
  /** Every URL fetched in this test. */
  urls: string[];
}

/** Installs a fake `fetch` (and fresh storage) around each test of the file. */
export function fakeFetch(answer: Answer): FakeNet {
  const net: FakeNet = { custom: () => undefined, urls: [] };
  beforeEach(() => {
    net.custom = () => undefined;
    net.urls.length = 0;
    useBackend(memoryBackend());
    vi.stubGlobal('fetch', async (raw: string) => {
      net.urls.push(raw);
      try {
        const url = new URL(raw);
        const own = net.custom(url);
        const out = own !== undefined ? own : answer(url);
        const body = typeof out === 'string' ? out : JSON.stringify(out);
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => body,
          json: async () => JSON.parse(body),
        };
      } catch (e) {
        return {
          ok: false,
          status: e instanceof HttpError ? e.status : 500,
          headers: new Headers(),
          text: async () => '',
          json: async () => null,
        };
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  return net;
}

/** Runs one card loader by id: its cards by id, and its facts. */
export async function runCards(id: string): Promise<{ cards: Record<string, DatapointRow>; facts: DatapointFacts }> {
  const loader = CARD_LOADERS.find(l => l.id === id);
  if (!loader) throw new Error(`no card loader ${id}`);
  const out = await loader.load();
  const rows = Array.isArray(out) ? out : out.rows;
  return { cards: Object.fromEntries(rows.map(r => [r.id, r])), facts: Array.isArray(out) ? {} : out.facts };
}

/** Runs every loader whose id starts with `prefix`; expects them all to succeed with well-formed, unique cards. */
export async function expectWellFormedCards(prefix: string): Promise<DatapointRow[]> {
  const loaders = CARD_LOADERS.filter(l => l.id.startsWith(prefix));
  expect(loaders.length).toBeGreaterThan(0);
  const { rows, failed } = await loadCards(loaders);
  expect(failed).toEqual([]);
  expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
  rows.forEach(r => {
    expect(r.k, r.id).toBeTruthy();
    expect(r.v, r.id).toBeTruthy();
    expect(r.href, r.id).toMatch(/^https:\/\//);
    expect(['pt', 'nl', 'ea', 'mkt', 'planet']).toContain(r.group);
  });
  return rows;
}
