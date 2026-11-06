// PRECOG / Trend Radar · Streams: the tabs under "Matched to your topics". Each stream registers itself here
// (see src/sources/<name>/stream.ts), keeps what it loads, and turns it into rows the panel draws the same way.
import { ago } from '@core/format';
import { ui } from '@core/ui-store';
import type { Entry } from '@/types';

/** What a stream is looking at right now. */
export interface StreamContext {
  /** The topics in scope: the selected one, or every topic of the channel on screen. */
  entries: Entry[];
  /** Their keys, for matching. */
  scopeKeys: Set<string>;
  /** One topic, or the whole channel. */
  scope: 'topic' | 'lens';
  /** The channel's own sites, when it reads only some of the followed sites (origins). */
  sites?: string[];
}
/** A part of a row's meta line: plain text, or text with a link or a style (`site`, `flag`). */
export type RowPart = string | { text: string; href?: string; cls?: string };
/** One item in a stream, ready to draw. */
export interface StreamRow {
  id: string;
  title: string;
  url: string;
  /** Topic keys the item names; the panel shows up to two of those in scope as chips. */
  topics: string[];
  /** Labels under the title, after the topic chips. */
  meta: RowPart[];
  /** The figure on the right: a big number, its unit, and a note under it. */
  side: { big?: string; unit?: string; note: string };
  /** 0–100: how full the bar under the figure is. */
  bar: number;
}
export interface StreamView {
  rows: StreamRow[];
  /** The panel's meta line, e.g. "checked 5 minutes ago · open markets on Manifold". */
  meta: string;
  /** What to say when there are no rows. */
  empty: string;
}
export interface Stream {
  /** Unique; channels list streams by it. */
  id: string;
  /** The tab's label. */
  label: string;
  /** False hides the tab, e.g. until an API key is set. */
  available?(): boolean;
  /** A label for this channel instead of `label` (e.g. the one site a channel reads). */
  tabLabel?(ctx: StreamContext): string;
  /** Fetches items for the topics in scope and keeps them. Throw to show an error; pass `signal` on. */
  load(ctx: StreamContext, signal: AbortSignal): Promise<void>;
  /** The rows to show now, best first (12 at most), from what `load` kept. `at` is when it last finished. */
  view(ctx: StreamContext, at: number): StreamView;
  /** A partial failure from the last load (e.g. one site of several), shown under the rows. */
  warning?(): string | null;
}

export const STREAMS: Stream[] = [];
/** Adds a stream. It shows as a tab on every channel that lists its id in `streams`. */
export function registerStream(s: Stream): void {
  if (STREAMS.some(x => x.id === s.id)) throw new Error(`Stream “${s.id}” is registered twice`);
  STREAMS.push(s);
}
export const streamById = (id: string): Stream | undefined => STREAMS.find(s => s.id === id);
/** The streams a channel shows, in its order, leaving out unregistered and unavailable ones. */
export const streamsFor = (ids: string[]): Stream[] =>
  ids.map(streamById).filter((s): s is Stream => !!s && (s.available?.() ?? true));

const DAY = 86400e3;
/** "3 days ago" within a month, then the date. */
export const when = (t: number): string =>
  Math.abs(ui.now - t) < 30 * DAY
    ? ago(t)
    : new Date(t).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
/** "checked 5 minutes ago · …", or '' before the first load. */
export const checked = (at: number, rest: string): string => (at ? `checked ${ago(at)} · ${rest}` : '');
/** Topic keys of `keys` that are in scope. */
export const inScope = (keys: string[], ctx: StreamContext): string[] => keys.filter(k => ctx.scopeKeys.has(k));
