<template>
  <panel-shell id="p-signal" title="Signal" :meta="head.meta" :index="index" :data-tick="ui.v">
    <div class="signal-top">
      <div>
        <div class="sel-name">
          <topic-dot :color="head.E ? head.E.color : 'transparent'"></topic-dot>
          <span>{{ head.name }}</span>
        </div>
        <div class="big">
          <span class="num">{{ head.st ? fmtVal(head.st.latest) : '—' }}</span>
          <span class="arrow" aria-hidden="true">{{ head.arrow[0] }}</span>
          <span class="chg" v-if="head.st">{{ fmtPct(head.st.change) }} {{ changeLabel(head.st) }}</span>
        </div>
        <div class="sub" v-if="head.st">
          momentum {{ fmtPct(head.st.momentum) }}/step · {{ head.arrow[1] }} · z
          {{ head.st.z == null ? '—' : head.st.z.toFixed(2) }}
          <template v-if="head.st.comp">· {{ compText(head.st.comp) }}</template>
        </div>
        <div class="sub" v-else-if="head.E && head.E.liveError">{{ head.E.liveError }}</div>
        <div v-if="head.sources.length" class="srcs" aria-label="Sources for this topic">
          <span class="muted">Sources</span>
          <span v-for="x in head.sources" :key="x.id" :class="['src-chip', x.state]" :title="x.note">
            <i aria-hidden="true">
              {{ x.state === 'ok' ? '✓' : x.state === 'error' ? '!' : x.state === 'wait' ? '…' : '–' }}
            </i>
            {{ x.label }}
            <b v-if="x.state === 'ok'">{{ x.days }}d</b>
          </span>
        </div>
      </div>
      <div class="switcher">
        <button class="btn" type="button" aria-label="Previous topic" @click="shiftTopic(-1)">‹</button>
        <span>{{ head.index }}</span>
        <button class="btn" type="button" aria-label="Next topic" @click="shiftTopic(1)">›</button>
      </div>
    </div>
    <div
      ref="wrap"
      class="chart-wrap"
      :class="{ dragging }"
      tabindex="0"
      role="img"
      :aria-label="geo.label || geo.empty"
      :style="{ '--dx': dx + 'px' }"
      @pointerdown="down"
      @pointermove="move"
      @pointerleave="leave"
    >
      <svg
        :key="ui.swap"
        :class="{ swapped: ui.swap > 0 }"
        :viewBox="'0 0 ' + geo.W + ' ' + geo.H"
        :width="geo.W"
        :height="geo.H"
        aria-hidden="true"
      >
        <text v-if="geo.empty" :x="geo.W / 2" :y="geo.H / 2" text-anchor="middle" class="yl" style="font-size: 12px">
          {{ geo.empty }}
        </text>
        <template v-else>
          <template v-for="t in geo.yTicks" :key="'y' + t.v">
            <line :class="t.v === 0 ? 'base' : 'gl'" :x1="geo.M.l" :x2="geo.W - geo.M.r" :y1="t.y" :y2="t.y" />
            <text class="yl" :x="geo.M.l - 8" :y="t.y" dy="0.32em" text-anchor="end">{{ t.label }}</text>
          </template>
          <text v-for="(t, k) in geo.xTicks" :key="'x' + k" class="xl" :x="t.x" :y="geo.H - 8" :text-anchor="t.anchor">
            {{ t.label }}
          </text>
          <line class="nowline" :x1="geo.xn" :x2="geo.xn" :y1="geo.M.t" :y2="geo.M.t + geo.ih" />
          <text class="nowlbl" :x="geo.xn + 5" :y="geo.M.t + 9">NOW</text>
          <path :d="geo.band" :fill="geo.color" opacity=".14" />
          <path
            :d="geo.line"
            fill="none"
            :stroke="geo.color"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <path
            :d="geo.forecast"
            fill="none"
            :stroke="geo.color"
            stroke-width="2"
            stroke-dasharray="5 4"
            stroke-linecap="round"
          />
          <circle :cx="geo.xn" :cy="geo.yn" r="4.5" :fill="geo.color" style="stroke: var(--ring)" stroke-width="2" />
          <g v-if="hover">
            <line
              :x1="hover.p.x"
              :x2="hover.p.x"
              :y1="geo.M.t"
              :y2="geo.M.t + geo.ih"
              style="stroke: var(--ink-2)"
              stroke-width="1"
              opacity=".45"
            />
            <circle
              :cx="hover.p.x"
              :cy="hover.p.y"
              r="4.5"
              :fill="geo.color"
              style="stroke: var(--ring)"
              stroke-width="2"
            />
          </g>
        </template>
      </svg>
      <div v-if="hover" class="tip" :style="hover.style">
        <b>{{ fmtTime(hover.p.t, geo.step) }}</b>
        <br />
        {{ hover.p.fc ? 'forecast ' : '' }}{{ fmtVal(hover.p.value) }}
        <template v-if="hover.p.fc">
          <br />
          <span class="muted">±1σ {{ fmtVal(hover.p.lo) }}–{{ fmtVal(hover.p.hi) }}</span>
        </template>
        <template v-if="hover.p.comp">
          <br />
          <span class="muted">{{ compText(hover.p.comp) }}</span>
        </template>
      </div>
    </div>
    <div class="key">
      <span>
        <svg width="22" height="8">
          <line x1="1" y1="4" x2="21" y2="4" style="stroke: var(--ink-2)" stroke-width="2" stroke-linecap="round" />
        </svg>
        history
      </span>
      <span>
        <svg width="22" height="8">
          <line x1="1" y1="4" x2="21" y2="4" style="stroke: var(--ink-2)" stroke-width="2" stroke-dasharray="4 3" />
        </svg>
        12-step forecast (linear fit, last 20)
      </span>
      <span>
        <svg width="16" height="10">
          <rect width="16" height="10" rx="2" style="fill: var(--ink-2)" opacity=".18" />
        </svg>
        ±1σ
      </span>
      <span class="hint">Swipe, drag or ←/→ to switch topic · [ ] to switch channel</span>
    </div>
  </panel-shell>
</template>

<script lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineComponent } from 'vue';
import type { SeriesPoint } from '../types';
import { shiftTopic } from '../actions';
import { compText, niceTicks, pathOf, useWidth } from './helpers';
import { DAY } from '../core/config';
import { COMP_LABEL, changeLabel, fmtAxis, fmtPct, fmtTick, fmtVal } from '../core/format';
import { arrowOf } from '../core/stats';
import { ui } from '../core/ui-store';
import { ADAPTERS, SOURCES } from '../sources/registry';
import { liveParts } from '../live';
import { activeLens, entriesOf, selectedEntry, series, state } from '../state';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';

// hover crosshair, and swipe/drag (or ←/→) to switch topic.

export default defineComponent({
  name: 'SignalPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const wrap = ref(null),
      width = useWidth(wrap, 640);
    const hoverX = ref(null),
      dx = ref(0),
      dragging = ref(false);

    const head = computed(() => {
      ui.v;
      const E = selectedEntry(),
        st = E && E.stats,
        lens = activeLens(),
        list = entriesOf(lens);
      const unit = SOURCES[state.source]?.unit || '';
      return {
        E,
        st,
        name: E ? `${E.name} · ${lens.name}` : 'No topic selected',
        index: `${E ? list.indexOf(E) + 1 : 0}/${list.length}`,
        meta: st ? `1 step = ${st.step >= 7 * DAY ? '1 week' : '1 day'} · ${unit}` : unit,
        arrow: st ? arrowOf(st.momentum) : ['', ''],
        // Each source's state for this topic, so you can see what's actually feeding the line.
        sources: E
          ? liveParts().map(pid => {
              const pts = E.parts?.[pid],
                err = E.partErr?.[pid],
                skip = E.skipped?.[pid];
              const label = COMP_LABEL[pid] || pid;
              if (pts?.length)
                return {
                  id: pid,
                  label,
                  state: 'ok',
                  days: pts.length,
                  note: `${label}: ${pts.length} days of data, latest ${fmtVal(pts[pts.length - 1].value)} ${ADAPTERS[pid]?.unit || ''}`,
                };
              if (err) return { id: pid, label, state: 'error', note: `${label}: ${err}` };
              if (skip) return { id: pid, label, state: 'skip', note: `${label}: ${skip}` };
              return { id: pid, label, state: 'wait', note: `${label}: still loading` };
            })
          : [],
      };
    });

    const geo = computed(() => {
      ui.v;
      const E = selectedEntry(),
        st = E && E.stats,
        s = E ? series(E) : [];
      const W = Math.max(280, width.value),
        H = W < 540 ? 230 : 300;
      if (!E || s.length < 2 || !st)
        return {
          W,
          H,
          empty: !E
            ? 'Add a topic to this lens to start tracking.'
            : E.liveError
              ? `No data: ${E.liveError}`
              : 'Waiting for data…',
        };
      const M = { l: 50, r: 16, t: 16, b: 28 },
        iw = W - M.l - M.r,
        ih = H - M.t - M.b;
      const fc = st.fc,
        t0 = s[0].t,
        t1 = fc[fc.length - 1].t;
      const ticks = niceTicks(Math.max(...s.map(p => p.value), ...fc.map(f => f.hi)) * 1.04),
        ymax = ticks[ticks.length - 1];
      const x = t => M.l + ((t - t0) / (t1 - t0)) * iw,
        y = v => M.t + ih - (v / ymax) * ih;
      const last = s[s.length - 1],
        xn = x(last.t),
        all: Array<SeriesPoint & { lo?: number; hi?: number }> = [...s, ...fc],
        nT = Math.max(2, Math.floor(iw / 120));
      return {
        W,
        H,
        M,
        ih,
        color: E.color,
        step: st.step,
        xn,
        yn: y(last.value),
        yTicks: ticks.map(v => ({ v, y: y(v), label: fmtAxis(v) })),
        xTicks: Array.from({ length: nT + 1 }, (_, k) => {
          const p = all[Math.round((k / nT) * (all.length - 1))];
          return { x: x(p.t), label: fmtTick(p.t, st.step), anchor: k === 0 ? 'start' : k === nT ? 'end' : 'middle' };
        }),
        line: pathOf(s.map(p => [x(p.t), y(p.value)])),
        forecast: pathOf([[xn, y(last.value)], ...fc.map(f => [x(f.t), y(f.value)])]),
        band:
          pathOf([
            [xn, y(last.value)],
            ...fc.map(f => [x(f.t), y(f.hi)]),
            ...[...fc].reverse().map(f => [x(f.t), y(f.lo)]),
          ]) + 'Z',
        pts: all.map((p, i) => ({ ...p, fc: i >= s.length, x: x(p.t), y: y(p.value) })),
        label: `${E.name}: current ${fmtVal(st.latest)}, ${fmtPct(st.change)} ${changeLabel(st)}, ${arrowOf(st.momentum)[1]}. Forecast in 12 steps ${fmtVal(fc[fc.length - 1].value)}.`,
      };
    });

    const hover = computed(() => {
      const g = geo.value;
      if (hoverX.value == null || !g.pts) return null;
      let best = g.pts[0];
      for (const p of g.pts) if (Math.abs(p.x - hoverX.value) < Math.abs(best.x - hoverX.value)) best = p;
      const right = best.x > g.W * 0.62;
      return {
        p: best,
        style: {
          [right ? 'right' : 'left']: `${right ? g.W - best.x + 14 : best.x + 14}px`,
          top: `${Math.max(0, Math.min(best.y - 30, g.H - 80))}px`,
        },
      };
    });

    let drag = null;
    const localX = e => e.clientX - wrap.value.getBoundingClientRect().left;
    function down(e) {
      drag = { x: e.clientX, y: e.clientY, moved: false };
    }
    function move(e) {
      if (drag) {
        const d = e.clientX - drag.x;
        if (Math.abs(d) > 8 && Math.abs(d) > Math.abs(e.clientY - drag.y)) {
          drag.moved = true;
          dragging.value = true;
          dx.value = d * 0.25;
          hoverX.value = null;
          return;
        }
      }
      hoverX.value = localX(e);
    }
    function end(e) {
      if (!drag) return;
      const d = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      dragging.value = false;
      dx.value = 0;
      if (drag.moved && Math.abs(d) > 50 && Math.abs(d) > 1.4 * Math.abs(dy)) shiftTopic(d < 0 ? 1 : -1);
      drag = null;
    }
    onMounted(() => {
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    });

    return {
      ui,
      wrap,
      head,
      geo,
      hover,
      dx,
      dragging,
      down,
      move,
      leave: () => {
        if (!drag) hoverX.value = null;
      },
      shiftTopic,
      compText,
    };
  },
});
</script>
