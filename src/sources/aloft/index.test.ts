// Aloft: a radar's newest day, from the newest file of the last three days, downloaded at most once.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryBackend, useBackend } from '@core/storage';
import { latestDay } from './index';

const NOW = Date.UTC(2026, 10, 8, 12);
const CSV = readFileSync(new URL('./fixtures/ptlis-vpts.csv', import.meta.url), 'utf8');
const fileOf = (u: string) => u.split('_vpts_')[1]?.replace('.csv', '');

/** Files out (yyyymmdd): the bucket answers 404 for any other, and `status` for every one when set. */
let published = new Set<string>();
let status = 0;
const asked: string[] = [];
beforeEach(() => {
  published = new Set();
  status = 0;
  asked.length = 0;
  useBackend(memoryBackend());
  vi.stubGlobal('fetch', async (u: string) => {
    asked.push(u);
    if (status) return { ok: false, status };
    return published.has(fileOf(u) ?? '')
      ? { ok: true, status: 200, text: async () => CSV }
      : { ok: false, status: 404 };
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('latestDay', () => {
  it('reads yesterday’s file when it is out', async () => {
    published = new Set(['20261107']);
    const d = await latestDay('ptlis', undefined, NOW);
    expect(asked).toEqual([
      'https://aloftdata.s3-eu-west-1.amazonaws.com/baltrad/daily/ptlis/2026/ptlis_vpts_20261107.csv',
    ]);
    expect(d.day.birdsPerKm).toBeGreaterThan(0);
    expect(d.prev).toBeUndefined();
  });
  it('steps back a day at a time, up to three, while files are not out yet', async () => {
    published = new Set(['20261105']);
    await latestDay('nlhrw', undefined, NOW);
    expect(asked.map(fileOf)).toEqual(['20261107', '20261106', '20261105']);
  });
  it('says so when no file came out in three days', async () => {
    await expect(latestDay('ptlis', undefined, NOW)).rejects.toThrow('no radar file in the last 3 days');
    expect(asked).toHaveLength(3);
  });
  it('checks again only after six hours, and never downloads a file it already has', async () => {
    published = new Set(['20261107']);
    const first = await latestDay('ptlis', undefined, NOW);
    await latestDay('ptlis', undefined, NOW + 5 * 3600e3);
    expect(asked).toHaveLength(1);
    // Seven hours on it is still the 8th, so yesterday is the file it already has: nothing is downloaded.
    const later = await latestDay('ptlis', undefined, NOW + 7 * 3600e3);
    expect(asked).toHaveLength(1);
    expect(later.day).toEqual(first.day);
  });
  it('keeps what it has when nothing newer is out', async () => {
    published = new Set(['20261107']);
    const first = await latestDay('ptlis', undefined, NOW);
    published = new Set();
    // The next day: the 8th isn't out, and the 7th is the file it has, so it stops there.
    const next = await latestDay('ptlis', undefined, NOW + 86400e3);
    expect(asked.map(fileOf)).toEqual(['20261107', '20261108']);
    expect(next.day).toEqual(first.day);
  });
  it('fails on a server error rather than skipping the day', async () => {
    status = 500;
    await expect(latestDay('ptlis', undefined, NOW)).rejects.toThrow('HTTP 500');
  });
});
