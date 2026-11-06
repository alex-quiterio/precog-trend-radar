<template>
  <header class="topbar" :class="{ busy: view.busy }" :aria-busy="view.busy">
    <span class="beacon" aria-hidden="true"></span>
    <div class="brand">
      <h1>
        <BrandMark />
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
        class="btn guardian"
        :class="ui.guardian ? ui.guardianState : ''"
        type="button"
        :aria-pressed="ui.guardian"
        :title="
          ui.guardian
            ? ui.guardianNote + ' Click to change or remove the key.'
            : 'Add a free Guardian API key to count news coverage for each topic.'
        "
        @click="editGuardianKey"
      >
        <template v-if="!ui.guardian">+ Guardian key</template>
        <template v-else-if="ui.guardianState === 'checking'">Guardian…</template>
        <template v-else-if="ui.guardianState === 'error'">⚠ Guardian</template>
        <template v-else>✓ Guardian</template>
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
        :class="{ on: c.id === view.active }"
        :aria-current="c.id === view.active ? 'page' : undefined"
        :aria-label="c.label + (c.heat ? `, ${c.heat.n} ${c.heat.level}` : '')"
        :aria-keyshortcuts="c.n <= 9 ? String(c.n) : undefined"
        :title="c.n <= 9 ? `${c.label} (press ${c.n})` : c.label"
        @click="selectLens(c.lensId)"
      >
        <channel-icon :name="c.icon"></channel-icon>
        <span class="ch-label">{{ c.label }}</span>
        <span v-if="c.heat" :class="['heat', c.heat.level]" aria-hidden="true">{{ c.heat.n }}</span>
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
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </nav>
  </header>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref } from 'vue';
import { addLens, editGuardianKey, lensHeat, selectLens, toggleTheme } from '@/actions';
import { activeChannel, channels } from '@/channels';
import { MAX_LENSES } from '@core/config';
import { ui } from '@core/ui-store';
import { refresh } from '@/live';
import { stories } from '@features/stories';
import { gh } from '@features/github';
import { me } from '@features/github-me';
import BrandMark from '@components/BrandMark.vue';
import ChannelIcon from '@components/ChannelIcon.vue';
import { lensById, state } from '@/state';

// PRECOG / Trend Radar · Header: name, heartbeat, controls, and the channel bar that switches the whole view.

export default defineComponent({
  name: 'AppHeader',
  components: { BrandMark, ChannelIcon },
  setup() {
    const view = computed(() => {
      return {
        active: activeChannel()?.id,
        list: channels().map((c, i) => ({ ...c, n: i + 1, heat: lensHeat(lensById(c.lensId)) })),
        canAdd: state.lenses.length < MAX_LENSES,
        // Anything still fetching lights the beacon: trends, streams, GitHub.
        busy: ui.loading || Object.values(stories.loading).some(Boolean) || gh.loading || me.loading,
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
