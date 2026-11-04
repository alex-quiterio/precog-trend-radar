<template>
  <header class="topbar" :data-tick="ui.v">
    <div class="brand">
      <h1>
        PRECOG
        <span class="slash">/</span>
        <span class="sub">Trend Radar</span>
      </h1>
      <span class="pulse beat">
        <i :key="ui.beat" aria-hidden="true"></i>
        <span>{{ ui.pulse }}</span>
      </span>
    </div>
    <div class="controls no-print">
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
      <button
        class="btn"
        type="button"
        :aria-pressed="ui.guardian"
        :title="
          ui.guardian
            ? 'Guardian news counts are on. Click to change or remove the key.'
            : 'Add a free Guardian API key to count news coverage for English topics.'
        "
        @click="editGuardianKey"
      >
        {{ ui.guardian ? '✓ Guardian' : '+ Guardian key' }}
      </button>
      <button
        class="btn icon"
        type="button"
        :aria-label="ui.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'"
        @click="toggleTheme"
      >
        ◐
      </button>
    </div>
    <nav class="channels" aria-label="Channels">
      <button
        v-for="c in view.list"
        :key="c.id"
        type="button"
        class="channel"
        :aria-current="c.id === view.active ? 'page' : undefined"
        @click="selectLens(c.lensId)"
      >
        {{ c.label }}
        <span v-if="c.heat" :class="['heat', c.heat.level]" :aria-label="c.heat.n + ' ' + c.heat.level">
          {{ c.heat.n }}
        </span>
      </button>
      <button
        v-if="view.canAdd"
        type="button"
        class="channel add"
        title="Make your own channel from a new lens of topics"
        @click="newChannel"
      >
        + channel
      </button>
    </nav>
  </header>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { addLens, editGuardianKey, lensHeat, selectLens, toggleTheme } from '../actions';
import { activeChannel, channels } from '../channels';
import { MAX_LENSES } from '../core/config';
import { ui } from '../core/ui-store';
import { refresh } from '../live';
import { lensById, state } from '../state';

// PRECOG / Trend Radar · Header: name, heartbeat, controls, and the channel bar that switches the whole view.

export default defineComponent({
  name: 'AppHeader',
  setup() {
    const view = computed(() => {
      ui.v;
      return {
        active: activeChannel()?.id,
        list: channels().map(c => ({ ...c, heat: lensHeat(lensById(c.lensId)) })),
        canAdd: state.lenses.length < MAX_LENSES,
      };
    });
    function newChannel() {
      const name = window.prompt('Name your channel (you can add up to six topics to it):');
      if (name && name.trim()) addLens(name.trim());
    }
    return { ui, view, refresh, toggleTheme, editGuardianKey, selectLens, newChannel };
  },
});
</script>
