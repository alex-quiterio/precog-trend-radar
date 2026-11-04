// PRECOG / Trend Radar · View helpers shared by components: axis ticks, tags, small building blocks.
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { COMP_LABEL, nf0 } from '../core/format';
import { levelOf } from '../core/stats';

export function niceStep(x) {
  const e = Math.floor(Math.log10(x)),
    f = x / 10 ** e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * 10 ** e;
}
export function niceTicks(max) {
  if (!(max > 0)) max = 1;
  const st = niceStep(max / 4);
  const out = [];
  for (let v = 0; v <= max + st * 0.999; v += st) out.push(+v.toPrecision(12));
  if (out.length < 2) out.push(st);
  return out;
}
export const compText = (comp: Record<string, number> | null): string =>
  comp
    ? Object.entries(comp)
        .map(([k, v]) => `${COMP_LABEL[k] || k} ${nf0.format(v)}`)
        .join(' · ')
    : '';
export function tagOf(st) {
  const l = st && levelOf(st.z);
  return l === 'alert'
    ? { cls: 'alert', text: '▲ ALERT' }
    : l === 'watch'
      ? { cls: 'watch', text: '◆ WATCH' }
      : { cls: 'none', text: 'normal' };
}
export const pathOf = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

// Keeps a ref in sync with an element's width.
export function useWidth(elRef, fallback = 600) {
  const width = ref(fallback);
  let ro = null;
  onMounted(() => {
    ro = new ResizeObserver(([e]) => {
      width.value = Math.round(e.contentRect.width) || fallback;
    });
    ro.observe(elRef.value);
  });
  onBeforeUnmount(() => ro && ro.disconnect());
  return width;
}
