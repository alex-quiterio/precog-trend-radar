// PRECOG / Trend Radar · Morning brief: sentences, top movers, Markdown export, last-look snapshot.
import { FIT_N, LS, Z_WATCH, store } from '@core/config';
import { ago, changeLabel, fmtPct, fmtTime, fmtVal, nf0 } from '@core/format';
import { levelOf } from '@core/stats';
import type { DatapointFacts, DatapointRow } from '@features/datapoints';
import { hnStories } from '@sources/hackernews/stream';
import { channelOfLens } from '@/channels';
import type { Entry, Stats } from '@/types';
import type { AppStore, LastLook } from '@/state';

/** A brief sentence: plain text, and topics the reader can click to chart. */
export type BriefPart = string | { key: string; text: string; color: string };
export type BriefLine = BriefPart[];
const isEntry = (v: unknown): v is Entry => !!v && typeof v === 'object' && 'key' in v && 'lensId' in v && 'name' in v;
/** Tagged template for a brief line: interpolated topics become clickable parts, arrays are spliced in. */
function ln(strings: TemplateStringsArray, ...vals: unknown[]): BriefLine {
  const out: BriefLine = [];
  strings.forEach((str, i) => {
    if (str) out.push(str);
    if (i >= vals.length) return;
    const v = vals[i];
    if (isEntry(v)) out.push({ key: v.key, text: v.name, color: v.color });
    else if (Array.isArray(v)) out.push(...(v as BriefPart[]));
    else out.push(String(v));
  });
  return out;
}
/** Joins several lines' parts with a separator. */
const join = (lines: BriefLine[], sep = ', '): BriefLine => lines.flatMap((l, i) => (i ? [sep, ...l] : l));
export const lineText = (l: BriefLine): string => l.map(p => (typeof p === 'string' ? p : p.text)).join('');

/** A topic whose numbers are in. */
export type Scored = Entry & { stats: Stats };
export const hasStats = (E: Entry): E is Scored => !!E.stats;
/** z for sorting: topics without one go last. */
const zOf = (E: Scored): number => E.stats.z ?? -Infinity;
const sigma = (E: Scored): string => (E.stats.z ?? 0).toFixed(1);
const chg = (E: Scored): number => E.stats.change ?? 0;

export function lensName(app: AppStore, E: Entry): string {
  const l = app.lensById(E.lensId);
  return l ? l.name : '';
}
/** The brief for the active lens: its topics, its datapoints, plus one line on what's hot elsewhere. */
/** The gist for the channel on screen. `facts` are the open-data facts it mentions (fire risk, warnings). */
export function buildBrief(app: AppStore, facts: DatapointFacts = {}) {
  const { state } = app;
  const lens = app.activeLens();
  const items = app.entriesOf(lens).filter(hasStats);
  const out = { lines: [] as BriefLine[], movers: [] as Scored[], items, lens };
  if (!items.length) return out;
  if (!state.liveLoaded) out.lines.push(ln`Still loading: numbers will settle once every source has answered.`);
  const hot = items.filter(E => levelOf(E.stats.z)).sort((a, b) => zOf(b) - zOf(a));
  out.lines.push(
    hot.length
      ? ln`${hot.length} topic${hot.length > 1 ? 's are' : ' is'} running hot: ${join(
          hot.slice(0, 3).map(E => ln`${E} (${sigma(E)}σ)`),
        )}${hot.length > 3 ? ` and ${hot.length - 3} more` : ''}.`
      : ln`Nothing unusual: every topic is within ${Z_WATCH}σ of its 30-step baseline.`,
  );
  const withChg = items.filter(E => E.stats.change != null && !E.sparse);
  if (withChg.length) {
    const up = withChg.reduce((a, b) => (chg(b) > chg(a) ? b : a));
    const dn = withChg.reduce((a, b) => (chg(b) < chg(a) ? b : a));
    if (chg(up) > 0) out.lines.push(ln`Biggest move up: ${up}, ${fmtPct(up.stats.change)} ${changeLabel(up.stats)}.`);
    if (chg(dn) < 0 && dn !== up)
      out.lines.push(ln`Biggest drop: ${dn}, ${fmtPct(dn.stats.change)} ${changeLabel(dn.stats)}.`);
  }
  const climbers = items
    .filter(E => !levelOf(E.stats.z) && E.stats.momentum > 0.3 && !E.sparse)
    .sort((a, b) => b.stats.momentum - a.stats.momentum);
  if (climbers.length)
    out.lines.push(
      ln`Steadiest climb: ${climbers[0]}, ${fmtPct(climbers[0].stats.momentum)} per step over the last ${FIT_N} steps. Not a spike yet, but a trend.`,
    );
  // Don't let the focus hide a fire elsewhere: name what's hot in the other lenses.
  // A country channel never mentions another country's channel, and a focused one (Bird migration) no other channel.
  const here = lens && channelOfLens(app, lens.id)?.country;
  const focused = !!(lens && channelOfLens(app, lens.id)?.focused);
  const elsewhere = state.lenses
    .filter(l => l !== lens && !focused)
    .filter(l => {
      const there = channelOfLens(app, l.id)?.country;
      return !here || !there || there === here;
    })
    .flatMap(app.entriesOf)
    .filter(hasStats)
    .filter(E => levelOf(E.stats.z) && !E.sparse)
    .sort((a, b) => zOf(b) - zOf(a));
  if (elsewhere.length)
    out.lines.push(
      ln`Elsewhere: ${join(
        elsewhere.slice(0, 3).map(E => ln`${E} (${sigma(E)}σ, ${lensName(app, E)})`),
      )}${elsewhere.length > 3 ? ` and ${elsewhere.length - 3} more` : ''}.`,
    );
  // Fire and storm warnings matter for the land lens; elsewhere they'd be noise.
  const f = lens?.id === 'portugal' ? facts : {};
  if (f.fire && f.fire.hi)
    out.lines.push(
      ln`Portugal fire risk today: ${f.fire.hi} of ${f.fire.n} municipalities at very high or maximum risk (IPMA).`,
    );
  if (f.warnings && (f.warnings.red || f.warnings.orange))
    out.lines.push(
      ln`IPMA has ${f.warnings.red} red and ${f.warnings.orange} orange weather warnings active (${f.warnings.types}).`,
    );
  const prev = state.prevLook;
  if (prev && prev.source === state.source) {
    const newly = items.filter(E => {
      const p = prev.items[E.key],
        L = levelOf(E.stats.z);
      return L && (!p || !p.level || (p.level === 'watch' && L === 'alert'));
    });
    const cooled = items.filter(E => {
      const p = prev.items[E.key];
      return p && p.level && !levelOf(E.stats.z);
    });
    out.lines.push(
      ln`Since your last look ${ago(prev.at, app.ui.now)}: ${newly.length ? ln`newly hot: ${join(newly.map(E => ln`${E}`))}` : 'nothing new turned hot'}${cooled.length ? ln`; cooled down: ${join(cooled.map(E => ln`${E}`))}` : ''}.`,
    );
  }
  out.movers = items
    .filter(E => !E.sparse)
    .sort((a, b) => (b.stats.z ?? -99) - (a.stats.z ?? -99))
    .slice(0, 7);
  return out;
}
/** The gist as Markdown, with the movers, recent alerts, the cards and rising stories. */
export function briefMarkdown(
  app: AppStore,
  cards: { rows: DatapointRow[]; facts: DatapointFacts },
  /** The Hacker News stream's last result, for "Rising stories". */
  hn?: unknown,
): string {
  const b = buildBrief(app, cards.facts),
    d = new Date().toISOString().slice(0, 10);
  const rows = b.movers
    .map(
      E =>
        `| ${E.name} | ${fmtVal(E.stats.latest)} | ${fmtPct(E.stats.change)} | ${E.stats.z == null ? '—' : E.stats.z.toFixed(1)} | ${levelOf(E.stats.z) || 'normal'} |`,
    )
    .join('\n');
  const recent = app.state.alerts
    .filter(a => a.lens === b.lens?.name)
    .slice(0, 8)
    .map(a => `- **${a.level.toUpperCase()}** ${a.topic} (${a.lens}), ${fmtTime(a.t, a.step)}: ${a.text}`)
    .join('\n');
  const keys = new Set(b.items.map(E => E.key));
  const rowsDp = cards.rows;
  const top = hnStories(hn)
    .filter(s => s.topics.some(k => keys.has(k)))
    .sort((a, b) => (b.vel ?? 0) - (a.vel ?? 0))
    .slice(0, 5)
    .map(s => `- [${s.title}](${s.url}) (${nf0.format(s.vel ?? 0)}/h)`)
    .join('\n');
  return (
    `## PRECOG brief, ${d} · ${b.lens?.name || ''}\n\n${b.lines.map(l => `- ${lineText(l)}`).join('\n')}\n\n| Topic | Now | Change | z | State |\n|---|---|---|---|---|\n${rows}\n` +
    (rowsDp.length ? `\n### Datapoints\n${rowsDp.map(r => `- ${r.k}: ${r.v} (${r.src})`).join('\n')}\n` : '') +
    (recent ? `\n### Alerts\n${recent}\n` : '') +
    (top ? `\n### Rising stories\n${top}\n` : '')
  );
}
/** Remembers what each topic looked like now, for "since your last look". */
export function saveLook(app: AppStore): void {
  const { state } = app;
  if (!state.liveLoaded) return;
  const items: LastLook['items'] = {};
  app.allEntries().forEach(E => {
    if (E.stats) items[E.key] = { z: E.stats.z, level: levelOf(E.stats.z), latest: E.stats.latest };
  });
  if (Object.keys(items).length) store.set(LS.look, { at: Date.now(), source: state.source, items });
}
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* ignore */
    }
    ta.remove();
    return ok;
  }
}
