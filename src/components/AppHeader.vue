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
      <form v-if="view.canAdd && adding" class="ch-new" autocomplete="off" @submit.prevent="create">
        <label class="sr-only" for="ch-name">New channel name</label>
        <input
          id="ch-name"
          ref="nameInput"
          v-model="name"
          maxlength="30"
          placeholder="Channel name…"
          @keydown.esc="cancel"
          @blur="!name.trim() && cancel()"
        />
      </form>
      <button
        v-else-if="view.canAdd"
        type="button"
        class="ch-add"
        title="New channel"
        aria-label="New channel"
        @click="open"
      >
        +
      </button>
    </nav>
  </header>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref } from 'vue';
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
    // New channel: a small "+" that opens an inline name field (Enter creates, Esc cancels).
    const adding = ref(false),
      name = ref(''),
      nameInput = ref<HTMLInputElement | null>(null);
    function open() {
      adding.value = true;
      nextTick(() => nameInput.value?.focus());
    }
    function cancel() {
      adding.value = false;
      name.value = '';
    }
    function create() {
      if (name.value.trim()) addLens(name.value.trim());
      cancel();
    }
    return {
      ui,
      view,
      refresh,
      toggleTheme,
      editGuardianKey,
      selectLens,
      adding,
      name,
      nameInput,
      open,
      cancel,
      create,
    };
  },
});
</script>
