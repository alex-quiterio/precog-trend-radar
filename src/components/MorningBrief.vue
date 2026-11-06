<template>
  <panel-shell id="p-brief" :title="head.title" :meta="head.meta" :index="index">
    <ul v-if="b.lines.length" class="brief-list">
      <li v-for="(l, i) in b.lines" :key="i">
        <template v-for="(p, j) in l" :key="j">
          <template v-if="typeof p === 'string'">{{ p }}</template>
          <button
            v-else
            class="brief-topic"
            type="button"
            :title="'Chart ' + p.text"
            :aria-label="'Chart ' + p.text"
            @click="focusTopic(p.key)"
          >
            <topic-dot :color="p.color"></topic-dot>
            {{ p.text }}
          </button>
        </template>
      </li>
    </ul>
    <p v-else class="empty">Waiting for data…</p>
    <div v-if="b.movers.length" class="table-scroll">
      <table class="movers">
        <caption class="sr-only">Top movers by z-score in this lens</caption>
        <thead>
          <tr>
            <th scope="col">Top movers</th>
            <th scope="col">Now</th>
            <th scope="col">Change</th>
            <th scope="col" class="col-z">z</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="E in b.movers" :key="E.key">
            <td>
              <button class="topic" type="button" :title="'Chart ' + E.name" @click="focusTopic(E.key)">
                <topic-dot :color="E.color"></topic-dot>
                {{ E.name }}
              </button>
            </td>
            <td>{{ fmtVal(E.stats.latest) }}</td>
            <td>
              <span class="mbar" aria-hidden="true"><i :style="bar(E)"></i></span>
              {{ fmtPct(E.stats.change) }}
            </td>
            <td class="col-z">{{ E.stats.z == null ? '—' : E.stats.z.toFixed(1) }}</td>
            <td><state-tag :st="E.stats"></state-tag></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="brief-actions no-print">
      <button class="btn" type="button" @click="copy">Copy brief as Markdown</button>
      <button class="btn" type="button" @click="read">Mark as read</button>
      <span class="muted" role="status">{{ note }}</span>
    </div>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { ref, computed, defineComponent } from 'vue';
import { DAY } from '@core/config';
import { fmtPct, fmtTime, fmtVal } from '@core/format';
import { briefMarkdown, buildBrief, copyText, type Scored } from '@features/brief';
import StateTag from '@components/StateTag.vue';
import TopicDot from '@components/TopicDot.vue';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Morning brief panel: sentences, top movers, copy as Markdown, mark as read.

export default defineComponent({
  name: 'MorningBrief',
  props: { index: Number },
  components: { PanelShell, StateTag, TopicDot },
  setup() {
    const { app, actions, datapoints, stories } = useApp();
    const ui = app.ui;
    const { focusTopic, markRead } = actions;
    const { state } = app;
    const note = ref('');
    const b = computed(() => buildBrief(app, datapoints.state.facts));
    const head = computed(() => {
      return {
        title: 'What moved',
        meta: state.liveLoaded
          ? `data to ${fmtTime(Math.max(0, ...b.value.items.map(E => E.stats.lt)), DAY)}`
          : ui.offline
            ? 'offline'
            : 'loading…',
      };
    });
    const bar = (E: Scored) => {
      const c = Math.max(-100, Math.min(100, E.stats.change ?? 0)),
        w = (Math.abs(c) / 100) * 50;
      return { background: E.color, left: `${c >= 0 ? 50 : 50 - w}%`, width: `${Math.max(w, 1.5)}%` };
    };
    async function copy() {
      note.value = (await copyText(briefMarkdown(app, datapoints.state, stories.status.data.hn)))
        ? 'Copied. Paste into your daily note.'
        : 'Copy failed.';
    }
    function read() {
      markRead();
      note.value = 'Marked as read.';
    }
    return { ui, state, b, head, bar, note, copy, read, focusTopic, fmtVal, fmtPct };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
/* brief */

.brief-list {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.brief-list li {
  padding-left: 18px;
  position: relative;
  font-size: 13px;
}
.brief-list li::before {
  content: '›';
  position: absolute;
  left: 3px;
  color: var(--muted);
}
.movers {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.movers td,
.movers th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--hair);
  white-space: nowrap;
  text-align: right;
}
.movers td:first-child,
.movers th:first-child {
  text-align: left;
}
.movers .topic {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  padding: 2px 0;
  font-weight: 500;
  color: var(--ink);
}
.movers .topic:hover {
  color: var(--accent);
}
.movers tbody tr:hover {
  background: var(--track);
}
.movers thead th {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-2);
}
.mbar {
  position: relative;
  width: 110px;
  height: 8px;
  display: inline-block;
  vertical-align: middle;
}
.mbar::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 1px;
  background: var(--axis);
}
.mbar i {
  position: absolute;
  top: 0;
  height: 8px;
  border-radius: 4px;
}
/* Phones: drop the bar and z (State says the same thing), let long names wrap, so nothing scrolls sideways. */
@media (max-width: 600px) {
  .movers .mbar,
  .movers .col-z {
    display: none;
  }
  .movers td,
  .movers th {
    padding: 6px 4px;
  }
  .movers td:first-child {
    white-space: normal;
  }
  .movers .topic {
    text-align: left;
  }
}
.brief-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
}
/* gist: topics named in a sentence chart that topic when clicked */
.brief-topic {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  padding: 0 2px;
  margin: 0 -2px;
  border-radius: 5px;
  color: var(--ink);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: var(--axis);
  text-underline-offset: 3px;
  vertical-align: baseline;
}
.brief-topic:hover {
  background: var(--track);
  text-decoration-color: var(--accent);
}
.brief-topic .dot,
.brief-topic svg {
  flex: none;
}
</style>
