// PRECOG / Trend Radar · Morning brief: sentences, top movers, Markdown export, last-look snapshot.
import { FIT_N, LS, Z_WATCH, store } from '../core/config';
import { ago, changeLabel, fmtPct, fmtTime, fmtVal, nf0 } from '../core/format';
import { levelOf, mean } from '../core/stats';
import { dp } from './datapoints';
import { stories } from './stories';
import { SOURCES } from '../sources/registry';
import { allEntries, entriesOf, lensById, state } from '../state';

export function lensName(E) {
  const l = lensById(E.lensId);
  return l ? l.name : '';
}
export function buildBrief() {
  const items = allEntries().filter(E => E.stats);
  const out = { lines: [], movers: [], items };
  if (!items.length) return out;
  if (state.mode === 'live' && !state.liveLoaded)
    out.lines.push('Still loading: numbers will settle once every source has answered.');
  const hot = items.filter(E => levelOf(E.stats.z)).sort((a, b) => b.stats.z - a.stats.z);
  out.lines.push(
    hot.length
      ? `${hot.length} topic${hot.length > 1 ? 's are' : ' is'} running hot: ${hot
          .slice(0, 3)
          .map(E => `${E.name} (${E.stats.z.toFixed(1)}σ, ${lensName(E)})`)
          .join(', ')}${hot.length > 3 ? ` and ${hot.length - 3} more` : ''}.`
      : `Nothing unusual: every topic is within ${Z_WATCH}σ of its 30-step baseline.`,
  );
  const withChg = items.filter(E => E.stats.change != null && !(state.mode === 'live' && E.sparse));
  if (withChg.length) {
    const up = withChg.reduce((a, b) => (b.stats.change > a.stats.change ? b : a));
    const dn = withChg.reduce((a, b) => (b.stats.change < a.stats.change ? b : a));
    if (up.stats.change > 0)
      out.lines.push(
        `Biggest move up: ${up.name} in ${lensName(up)}, ${fmtPct(up.stats.change)} ${changeLabel(up.stats)}.`,
      );
    if (dn.stats.change < 0 && dn !== up)
      out.lines.push(`Biggest drop: ${dn.name}, ${fmtPct(dn.stats.change)} ${changeLabel(dn.stats)}.`);
  }
  const climbers = items
    .filter(E => !levelOf(E.stats.z) && E.stats.momentum > 0.3 && !(state.mode === 'live' && E.sparse))
    .sort((a, b) => b.stats.momentum - a.stats.momentum);
  if (climbers.length)
    out.lines.push(
      `Steadiest climb: ${climbers[0].name}, ${fmtPct(climbers[0].stats.momentum)} per step over the last ${FIT_N} steps. Not a spike yet, but a trend.`,
    );
  const lensHeat = state.lenses
    .map(l => {
      const zs = entriesOf(l)
        .map(E => E.stats?.z)
        .filter(z => z != null);
      return { l, z: zs.length ? mean(zs) : null };
    })
    .filter(x => x.z != null);
  if (lensHeat.length > 1) {
    const top = lensHeat.reduce((a, b) => (b.z > a.z ? b : a));
    if (top.z > 0.3) out.lines.push(`${top.l.name} is the most active lens (average z ${top.z.toFixed(1)}).`);
  }
  const f = dp.facts;
  if (f.fire && f.fire.hi)
    out.lines.push(
      `Portugal fire risk today: ${f.fire.hi} of ${f.fire.n} municipalities at very high or maximum risk (IPMA).`,
    );
  if (f.warnings && (f.warnings.red || f.warnings.orange))
    out.lines.push(
      `IPMA has ${f.warnings.red} red and ${f.warnings.orange} orange weather warnings active (${f.warnings.types}).`,
    );
  const prev = state.prevLook;
  if (state.mode === 'live' && prev && prev.source === state.source) {
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
      `Since your last look ${ago(prev.at)}: ${newly.length ? 'newly hot: ' + newly.map(E => E.name).join(', ') : 'nothing new turned hot'}${cooled.length ? '; cooled down: ' + cooled.map(E => E.name).join(', ') : ''}.`,
    );
  }
  out.movers = items
    .filter(E => !(state.mode === 'live' && E.sparse))
    .sort((a, b) => (b.stats.z ?? -99) - (a.stats.z ?? -99))
    .slice(0, 7);
  return out;
}
export function briefMarkdown() {
  const b = buildBrief(),
    d = new Date().toISOString().slice(0, 10);
  const rows = b.movers
    .map(
      E =>
        `| ${E.name} | ${lensName(E)} | ${fmtVal(E.stats.latest)} | ${fmtPct(E.stats.change)} | ${E.stats.z == null ? '—' : E.stats.z.toFixed(1)} | ${levelOf(E.stats.z) || 'normal'} |`,
    )
    .join('\n');
  const recent = state.alerts
    .slice(0, 8)
    .map(a => `- **${a.level.toUpperCase()}** ${a.topic} (${a.lens}), ${fmtTime(a.t, a.step)}: ${a.text}`)
    .join('\n');
  const top = [...stories.hn.values()]
    .sort((a, b) => b.vel - a.vel)
    .slice(0, 5)
    .map(s => `- [${s.title}](${s.url}) (${nf0.format(s.vel)}/h)`)
    .join('\n');
  return (
    `## PRECOG brief, ${d}\n\nSource: ${state.mode === 'demo' ? 'DEMO DATA (simulated)' : SOURCES[state.source].label}\n\n${b.lines.map(l => `- ${l}`).join('\n')}\n\n| Topic | Lens | Now | Change | z | State |\n|---|---|---|---|---|---|\n${rows}\n` +
    (dp.rows.length ? `\n### Datapoints\n${dp.rows.map(r => `- ${r.k}: ${r.v} (${r.src})`).join('\n')}\n` : '') +
    (recent ? `\n### Alerts\n${recent}\n` : '') +
    (top && state.mode === 'live' ? `\n### Rising stories\n${top}\n` : '')
  );
}
export function saveLook() {
  if (state.mode !== 'live' || !state.liveLoaded) return;
  const items = {};
  allEntries().forEach(E => {
    if (E.stats) items[E.key] = { z: E.stats.z, level: levelOf(E.stats.z), latest: E.stats.latest };
  });
  if (Object.keys(items).length) store.set(LS.look, { at: Date.now(), source: state.source, items });
}
export async function copyText(text) {
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
