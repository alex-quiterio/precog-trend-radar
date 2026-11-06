// PRECOG / Trend Radar · View helpers shared by components: axis ticks, tags, small building blocks.
import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';
import type { Stats } from '@/types';
import { COMP_LABEL, nf0 } from '@core/format';
import { levelOf } from '@core/stats';

export function niceStep(x: number): number {
  const e = Math.floor(Math.log10(x)),
    f = x / 10 ** e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * 10 ** e;
}
export function niceTicks(max: number): number[] {
  if (!(max > 0)) max = 1;
  const st = niceStep(max / 4);
  const out: number[] = [];
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
export function tagOf(st: Pick<Stats, 'z'> | null | undefined): { cls: string; text: string } {
  const l = st && levelOf(st.z);
  return l === 'alert'
    ? { cls: 'alert', text: '▲ ALERT' }
    : l === 'watch'
      ? { cls: 'watch', text: '◆ WATCH' }
      : { cls: 'none', text: 'normal' };
}
export const pathOf = (pts: number[][]): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

// Keeps a ref in sync with an element's width.
export function useWidth(elRef: Ref<HTMLElement | null>, fallback = 600): Ref<number> {
  const width = ref(fallback);
  let ro: ResizeObserver | undefined;
  onMounted(() => {
    ro = new ResizeObserver(([e]) => {
      width.value = Math.round(e.contentRect.width) || fallback;
    });
    if (elRef.value) ro.observe(elRef.value);
  });
  onBeforeUnmount(() => ro?.disconnect());
  return width;
}
