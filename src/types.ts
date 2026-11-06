// PRECOG / Trend Radar · Shared data shapes.

export interface SeriesPoint {
  t: number;
  value: number;
  comp?: Record<string, number>;
}
export interface ForecastPoint {
  t: number;
  value: number;
  lo: number;
  hi: number;
}

export interface Stats {
  latest: number;
  lt: number;
  step: number;
  change: number | null;
  slope: number;
  sigma: number;
  fc: ForecastPoint[];
  momentum: number;
  z: number | null;
  baseN: number;
  above: number;
  n: number;
  comp: Record<string, number> | null;
}
export type AlertLevel = 'alert' | 'watch';

/** A topic as the user defined it inside a lens. */
export interface TopicDef {
  name: string;
  slot: number;
  wiki?: string;
  q?: string;
}
export interface Lens {
  id: string;
  name: string;
  desc: string;
  lang?: string;
  country?: string | null;
  topics: TopicDef[];
}

/** Runtime data for one topic: its series, stats and per-source parts. */
export interface Entry {
  key: string;
  lensId: string;
  /** The lens's language and country, which the sources query in. */
  lang: string;
  country: string | null;
  def: TopicDef;
  name: string;
  slot: number;
  color: string;
  angle: number;
  parts: Record<string, SeriesPoint[] | null>;
  partErr: Record<string, string | null>;
  skipped?: Record<string, string>;
  meta: Record<string, unknown>;
  liveSeries: SeriesPoint[];
  liveError: string | null;
  stats: Stats | null;
  lastAlert: { t: number; level: AlertLevel } | null;
  sparse?: boolean;
}

export interface Alert {
  id: number;
  key: string;
  lensId: string;
  lens: string;
  t: number;
  step: number;
  topic: string;
  color: string;
  z: number;
  level: AlertLevel;
  text: string;
}

export interface Query {
  name: string;
  wiki: string | null;
  q: string;
  lang: string;
  country: string | null;
}
export interface AdapterResult {
  topic: string;
  points: Array<{ t: string | number; value: number }>;
  meta?: Record<string, unknown>;
  skip?: string;
}
/** A live data source. Return attention points per day (or week) for one topic. */
export interface Adapter {
  id: string;
  label: string;
  unit?: string;
  concurrency?: number;
  weight?: number;
  minMean?: number;
  lagDays?: number;
  fetch(topic: string, ctx: { signal: AbortSignal; query: Query }): Promise<AdapterResult>;
}
export interface Source {
  label: string;
  parts?: string[];
  unit?: string;
  blend?: boolean;
}

export interface Prefs {
  activeLens: string;
  selectedByLens: Record<string, string>;
  source: string;
  theme: 'dark' | 'light';
  /** The stream on screen (a registered stream id: 'news', 'reading', 'forecasts', 'hn'…). */
  storySrc: string;
  storyScope: 'topic' | 'lens';
}
