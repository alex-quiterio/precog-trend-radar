<template>
  <header class="topbar glass" :data-tick="ui.v">
    <div class="brand">
      <h1>
        PRECOG
        <span class="slash">/</span>
        Trend Radar
      </h1>
      <span class="pulse beat">
        <i :key="ui.beat" aria-hidden="true"></i>
        <span>{{ ui.pulse }}</span>
      </span>
    </div>
    <div class="controls no-print">
      <label>
        Source
        <select v-model="source" aria-label="Data source">
          <option v-for="id in sourceIds" :key="id" :value="id">{{ SOURCES[id].label }}</option>
        </select>
      </label>
      <label v-if="state.source === 'blend'">
        <input
          type="checkbox"
          :checked="state.includeNews"
          @change="setIncludeNews(($event.target as HTMLInputElement).checked)"
        />
        GDELT news
      </label>
      <button v-if="state.source === 'rss'" class="btn" type="button" @click="openFeeds('source')">Feeds…</button>
      <button
        class="btn"
        type="button"
        :disabled="ui.loading"
        :aria-busy="ui.loading"
        aria-label="Refresh data now"
        @click="refresh"
      >
        ↻ {{ ui.loading ? 'Loading…' : 'Refresh' }}
      </button>
      <button class="btn" type="button" :aria-pressed="state.tableView" @click="toggleTable">Table view</button>
      <button
        class="btn"
        type="button"
        :aria-label="ui.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'"
        @click="toggleTheme"
      >
        ◐ {{ ui.theme === 'light' ? 'Dark' : 'Light' }}
      </button>
    </div>
    <span class="badge live">{{ badge }}</span>
  </header>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { openFeeds, setIncludeNews, toggleTable, toggleTheme } from '../actions';
import { ui } from '../core/ui-store';
import { refresh, setSource } from '../live';
import { SOURCES } from '../sources/registry';
import { state } from '../state';

// PRECOG / Trend Radar · Header: title, pulse, source picker, refresh, table/theme toggles, LIVE badge.

export default defineComponent({
  name: 'AppHeader',
  setup() {
    const source = computed({ get: () => (ui.v, state.source), set: id => setSource(id) });
    const sourceIds = computed(() => (ui.v, Object.keys(SOURCES)));
    const badge = computed(() => {
      ui.v;
      return state.source === 'blend' ? 'LIVE · INDEX' : `LIVE · ${state.source.toUpperCase()}`;
    });
    return {
      ui,
      state,
      SOURCES,
      source,
      sourceIds,
      badge,
      refresh,
      toggleTable,
      toggleTheme,
      openFeeds,
      setIncludeNews,
    };
  },
});
</script>
