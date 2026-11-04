<template>
  <panel-shell id="p-brief" :title="head.title" :meta="head.meta" :index="index" :data-tick="ui.v">
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
            <th scope="col">z</th>
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
            <td>{{ E.stats.z == null ? '—' : E.stats.z.toFixed(1) }}</td>
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
import { ref, computed, defineComponent } from 'vue';
import { focusTopic, markRead } from '../actions';
import { DAY } from '../core/config';
import { fmtTime } from '../core/format';
import { ui } from '../core/ui-store';
import { briefMarkdown, buildBrief, copyText } from '../features/brief';
import { state } from '../state';
import StateTag from './StateTag.vue';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';

// PRECOG / Trend Radar · Morning brief panel: sentences, top movers, copy as Markdown, mark as read.

export default defineComponent({
  name: 'MorningBrief',
  props: { index: Number },
  components: { PanelShell, StateTag, TopicDot },
  setup() {
    const note = ref('');
    const b = computed(() => (ui.v, buildBrief()));
    const head = computed(() => {
      ui.v;
      return {
        title: 'What moved',
        meta: state.liveLoaded
          ? `data to ${fmtTime(Math.max(0, ...b.value.items.map(E => E.stats.lt)), DAY)}`
          : ui.offline
            ? 'offline'
            : 'loading…',
      };
    });
    const bar = E => {
      const c = Math.max(-100, Math.min(100, E.stats.change ?? 0)),
        w = (Math.abs(c) / 100) * 50;
      return { background: E.color, left: `${c >= 0 ? 50 : 50 - w}%`, width: `${Math.max(w, 1.5)}%` };
    };
    async function copy() {
      note.value = (await copyText(briefMarkdown())) ? 'Copied. Paste into your daily note.' : 'Copy failed.';
    }
    function read() {
      markRead();
      note.value = 'Marked as read.';
    }
    return { ui, state, b, head, bar, note, copy, read, focusTopic };
  },
});
</script>
