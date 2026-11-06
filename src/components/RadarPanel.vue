<template>
  <panel-shell id="p-radar" :title="view.title" meta="closer = rising faster" :index="index">
    <div ref="wrap" class="radar-wrap">
      <svg id="radar" viewBox="0 0 300 300" role="img" :aria-label="view.label">
        <circle v-for="r in S.rings" :key="r" class="ring" :cx="RC" :cy="RC" :r="r" />
        <circle class="ring flat" :cx="RC" :cy="RC" :r="RR * R_FLAT" />
        <line v-for="(s, i) in S.spokes" :key="'s' + i" class="spoke" :x1="s[0]" :y1="s[1]" :x2="s[2]" :y2="s[3]" />
        <g v-show="!reduced" ref="sweep" class="sweep">
          <path v-for="(s, i) in S.slices" :key="'w' + i" class="sweep-slice" :d="s.d" :opacity="s.o" />
          <line class="sweep-line" :x1="RC" :y1="RC" :x2="RC" :y2="RC - RR" />
        </g>
        <text class="rlbl" :x="RC" :y="RC + RR * 0.25 + 11" text-anchor="middle">▲ RISING inside</text>
        <text class="rlbl" :x="RC + 4" :y="RC - RR * R_FLAT - 4">FLAT</text>
        <text class="rlbl" :x="RC + 4" :y="RC - RR + 11">FALLING</text>
        <g
          v-for="b in view.blips"
          :key="b.E.key"
          class="blip"
          :style="{ transform: 'translate(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px)' }"
          @click="focusTopic(b.E.key)"
          @pointerenter="hovered = b.E.key"
          @pointerleave="hovered = null"
        >
          <circle class="hit" r="16" fill="transparent" />
          <circle v-if="flash[b.E.key]" :key="flash[b.E.key]" class="ping on" :r="b.size" :stroke="b.E.color" />
          <circle class="core" :r="b.size" :fill="b.E.color" />
          <text :x="(b.right ? 1 : -1) * (b.size + 5)" y="3.5" :text-anchor="b.right ? 'start' : 'end'">
            {{ b.label }}
          </text>
        </g>
      </svg>
      <div v-if="tip" class="tip" :style="tip.style">
        <b>{{ tip.b.E.name }}</b>
        <br />
        {{ fmtVal(tip.st.latest) }} · {{ tip.a }} {{ tip.word }}
        <br />
        <span class="muted">
          momentum {{ fmtPct(tip.st.momentum) }}/step · z {{ tip.st.z == null ? '—' : tip.st.z.toFixed(2) }}
        </span>
      </div>
    </div>
    <div class="radar-key">Distance: momentum (centre = fastest rise, dashed ring = flat). Size: current volume.</div>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { reactive, ref, computed, onMounted, onBeforeUnmount, defineComponent } from 'vue';
import { fmtPct, fmtVal } from '@core/format';
import { arrowOf } from '@core/stats';
import { hasStats } from '@features/brief';
import PanelShell from '@components/PanelShell.vue';

const RC = 150,
  RR = 116,
  R_FLAT = 0.525;
const polar = (deg: number, r: number): [number, number] => [
  RC + r * Math.sin((deg * Math.PI) / 180),
  RC - r * Math.cos((deg * Math.PI) / 180),
];
const RADAR_STATIC = {
  rings: [0.25, 0.5, 0.75, 1].map(f => RR * f),
  spokes: [0, 45, 90, 135].map(a => [...polar(a, RR), ...polar(a + 180, RR)]),
  slices: Array.from({ length: 8 }, (_, k) => {
    const [x0, y0] = polar(-k * 5, RR),
      [x1, y1] = polar(-(k + 1) * 5, RR);
    return { d: `M${RC},${RC} L${x0},${y0} A${RR},${RR} 0 0 0 ${x1},${y1} Z`, o: (0.09 * (1 - k / 8)).toFixed(3) };
  }),
};

export default defineComponent({
  name: 'RadarPanel',
  props: { index: Number },
  components: { PanelShell },
  setup() {
    const { app, actions } = useApp();
    const ui = app.ui;
    const { focusTopic } = actions;
    const sweep = ref<SVGGElement | null>(null),
      wrap = ref<HTMLElement | null>(null),
      hovered = ref<string | null>(null);
    const flash = reactive<Record<string, number>>({});
    const view = computed(() => {
      const lens = app.activeLens(),
        list = app.entriesOf(lens).filter(hasStats);
      const mMax = Math.max(2, ...list.map(E => Math.abs(E.stats.momentum)));
      const vMax = Math.max(1e-9, ...list.map(E => E.stats.latest));
      return {
        title: 'Radar',
        label: 'Radar: ' + list.map(E => `${E.name} ${arrowOf(E.stats.momentum)[1]}`).join(', '),
        blips: list.map(E => {
          const m = Math.max(-1, Math.min(1, E.stats.momentum / mMax));
          const [x, y] = polar(E.angle, RR * (0.1 + 0.85 * (1 - (m + 1) / 2)));
          const size = 4 + 8 * Math.sqrt(E.stats.latest / vMax),
            right = Math.sin((E.angle * Math.PI) / 180) >= 0;
          return { E, x, y, size, right, label: E.name.length > 12 ? E.name.slice(0, 11) + '…' : E.name };
        }),
      };
    });
    const tip = computed(() => {
      const b = hovered.value && view.value.blips.find(x => x.E.key === hovered.value);
      if (!b || !wrap.value) return null;
      const scale = wrap.value.clientWidth / 300,
        st = b.E.stats,
        [a, word] = arrowOf(st.momentum);
      const left = (b.x + b.size + 8) * scale,
        flip = left > wrap.value.clientWidth - 170;
      return {
        b,
        a,
        word,
        st,
        style: {
          [flip ? 'right' : 'left']: `${flip ? wrap.value.clientWidth - (b.x - b.size - 8) * scale : left}px`,
          top: `${Math.max(0, (b.y - 14) * scale)}px`,
        },
      };
    });

    let raf = 0,
      start = 0,
      prev = 0;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const frame = (now: number) => {
      const a = (((now - start) / 6000) * 360) % 360;
      sweep.value?.setAttribute('transform', `rotate(${a.toFixed(2)} ${RC} ${RC})`);
      view.value.blips.forEach(b => {
        const t = b.E.angle;
        if (prev <= a ? t > prev && t <= a : t > prev || t <= a) flash[b.E.key] = (flash[b.E.key] || 0) + 1;
      });
      prev = a;
      raf = requestAnimationFrame(frame);
    };
    const apply = () => {
      cancelAnimationFrame(raf);
      if (!mq.matches) {
        start = performance.now();
        prev = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    const reduced = ref(mq.matches);
    const onMq = () => {
      reduced.value = mq.matches;
      apply();
    };
    onMounted(() => {
      mq.addEventListener?.('change', onMq);
      apply();
    });
    onBeforeUnmount(() => {
      cancelAnimationFrame(raf);
      mq.removeEventListener?.('change', onMq);
    });

    return {
      ui,
      sweep,
      wrap,
      hovered,
      flash,
      view,
      tip,
      reduced,
      RC,
      RR,
      R_FLAT,
      S: RADAR_STATIC,
      focusTopic,
      fmtVal,
      fmtPct,
    };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
/* radar */
.radar-wrap {
  position: relative;
}
#radar {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1/1;
  overflow: visible;
}
.ring {
  fill: none;
  stroke: var(--ring-line);
  stroke-width: 1;
}
.ring.flat {
  stroke-dasharray: 3 4;
  stroke: var(--ring-flat);
}
.spoke {
  stroke: var(--spoke);
  stroke-width: 1;
}
.rlbl {
  fill: var(--muted);
  font: 9.5px var(--mono);
  letter-spacing: 0.12em;
}
.sweep-line {
  stroke: var(--sweep-line);
  stroke-width: 1.5;
}
.sweep-slice {
  fill: var(--sweep-fill);
}
.blip {
  transition: transform 0.9s cubic-bezier(0.3, 0.7, 0.2, 1);
  cursor: pointer;
}
.blip .core {
  stroke: var(--ring);
  stroke-width: 2;
  transform-box: fill-box;
  transform-origin: center;
}
.blip .ping {
  fill: none;
  stroke-width: 2;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
}
.blip .ping.on {
  animation: ping 0.9s ease-out forwards;
}
@keyframes ping {
  0% {
    opacity: 0.85;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(2.8);
  }
}
@keyframes pop {
  0% {
    transform: scale(1.35);
  }
  100% {
    transform: scale(1);
  }
}
.blip text {
  fill: var(--ink);
  font: 10px var(--mono);
  paint-order: stroke;
  stroke: var(--halo);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.radar-key {
  color: var(--muted);
  font-size: 11px;
  margin-top: 6px;
}
.sweep {
  pointer-events: none;
}
</style>
