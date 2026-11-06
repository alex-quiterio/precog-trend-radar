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
        class="btn icon set-toggle"
        :class="{ on: settingsOpen, warn: ui.guardian && ui.guardianState === 'error' }"
        type="button"
        aria-label="Settings"
        aria-controls="settings"
        :aria-expanded="settingsOpen"
        :title="ui.guardian && ui.guardianState === 'error' ? 'Settings: ' + ui.guardianNote : 'Settings'"
        @click="settingsOpen = !settingsOpen"
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M2 4h7M13 4h1M2 12h1M7 12h7"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            fill="none"
          />
          <circle cx="11" cy="4" r="2" stroke="currentColor" stroke-width="1.5" fill="none" />
          <circle cx="5" cy="12" r="2" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
      </button>
    </div>
    <settings-bar v-if="settingsOpen" @close="closeSettings"></settings-bar>
    <nav class="channels" aria-label="Channels">
      <template v-for="c in view.list" :key="c.id">
        <button
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
        <button
          v-if="c.own && c.id === view.active"
          type="button"
          class="ch-del no-print"
          :aria-label="'Delete channel ' + c.label"
          :title="'Delete channel ' + c.label"
          @click="removeLens(c.lensId)"
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </template>
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
import { useApp } from '@/context';
import { computed, defineComponent, nextTick, ref } from 'vue';
import { activeChannel, channels } from '@/channels';
import { MAX_LENSES } from '@core/config';

import BrandMark from '@components/BrandMark.vue';
import ChannelIcon from '@components/ChannelIcon.vue';
import SettingsBar from '@components/SettingsBar.vue';

// PRECOG / Trend Radar · Header: name, heartbeat, controls, and the channel bar that switches the whole view.

export default defineComponent({
  name: 'AppHeader',
  components: { BrandMark, ChannelIcon, SettingsBar },
  setup() {
    const { app, live, stories: loader, actions, github, myGithub } = useApp();
    const ui = app.ui;
    const gh = github.state;
    const me = myGithub.state;
    const stories = loader.status;
    const { addLens, lensHeat, removeLens, selectLens } = actions;
    const { state } = app;
    const view = computed(() => {
      return {
        active: activeChannel(app)?.id,
        list: channels(app).map((c, i) => ({ ...c, n: i + 1, heat: lensHeat(app.lensById(c.lensId)) })),
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
    // Settings bar (theme, Guardian key): the header's sliders button opens it; ×, Esc or the button closes it.
    const settingsOpen = ref(false);
    function closeSettings() {
      settingsOpen.value = false;
      nextTick(() => document.querySelector<HTMLElement>('.set-toggle')?.focus());
    }
    function create() {
      if (name.value.trim()) addLens(name.value.trim());
      cancel();
    }
    return {
      ui,
      view,
      refresh: live.refresh,
      selectLens,
      removeLens: (id: string) => void removeLens(id),
      settingsOpen,
      closeSettings,
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

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
/* header: sticky, with section links */
.topbar {
  position: sticky;
  top: 10px;
  z-index: 10;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px 22px;
  padding: 12px 18px 0;
  margin: 10px 0 0;
  background: var(--glass-strong);
}
.brand {
  min-width: 0;
}
/* channel bar: the main navigation; each tab switches the whole view */
.channels {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0 2px;
  margin: 0 -6px;
  border-top: 1px solid var(--hair);
}
/* Phones: one scrolling row, with a fade that shows there's more to the right. */
@media (max-width: 700px) {
  .channels {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent);
    mask-image: linear-gradient(90deg, #000 85%, transparent);
  }
}
.channels::-webkit-scrollbar {
  display: none;
}
.channel {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 10px 10px 11px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: color 0.15s;
}
.ch-icon {
  flex: none;
  display: block;
}
/* Only the active channel shows its name; the others reveal it on hover or keyboard focus. */
.ch-label {
  display: inline-block;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  margin-left: -7px;
  transition:
    max-width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.2s,
    margin 0.25s;
}
.channel.on .ch-label,
.channel:hover .ch-label,
.channel:focus-visible .ch-label {
  max-width: 220px;
  opacity: 1;
  margin-left: 0;
}
.channel::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent);
  transform: scaleX(0);
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.channel:hover {
  color: var(--ink);
}
.channel.on {
  color: var(--ink);
}
.channel.on .ch-icon {
  color: var(--accent);
}
.channel.on::after {
  transform: scaleX(1);
}
/* Delete: a small × right after the active channel, only for channels you made */
.ch-del {
  align-self: center;
  flex: none;
  width: 22px;
  height: 22px;
  margin: 0 6px 0 -4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s,
    background 0.15s;
}
.ch-del svg {
  display: block;
}
.ch-del:hover,
.ch-del:focus-visible {
  color: var(--alert);
  background: var(--accent-soft);
}
.ch-add {
  align-self: center;
  margin: 0 8px 0 auto;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--hair);
  background: var(--card);
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}
.ch-add svg {
  display: block;
}
.ch-add:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}
.ch-new {
  align-self: center;
  margin: 0 8px 0 auto;
}
.ch-new input {
  width: 160px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: var(--card);
  font-size: 12px;
  outline: none;
}
.channel .heat {
  font: 600 10px/1 var(--mono);
  padding: 2px 5px;
  border-radius: 999px;
  letter-spacing: 0;
}
.channel .heat.alert {
  background: var(--alert);
  color: #fff;
}
.channel .heat.watch {
  background: var(--watch);
  color: #1a1300;
}
.btn.icon {
  width: 32px;
  padding: 0;
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 14px;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  font: 600 24px/1.1 var(--sans);
  letter-spacing: 0.02em;
}
h1 .mark {
  width: 1.45em;
  height: 1.45em;
  margin-right: 0.3em;
  vertical-align: -0.38em;
  color: var(--accent);
}
h1 .mark .blip {
  fill: var(--ink);
}
h1 .slash {
  color: var(--accent);
  font-weight: 400;
  margin: 0 0.12em;
}
h1 .sub {
  font-weight: 400;
  color: var(--ink-2);
}
.pulse {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11.5px;
}
.pulse i {
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-block;
}
.pulse i::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  opacity: 0;
}
.pulse.beat i::after {
  animation: beat 1.2s ease-out;
}
@keyframes beat {
  0% {
    opacity: 0.6;
    transform: scale(0.5);
  }
  100% {
    opacity: 0;
    transform: scale(1.8);
  }
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
/* Settings button: lit while the bar is open, amber when the Guardian key fails */
.btn.set-toggle svg {
  display: block;
  margin: auto;
}
.btn.set-toggle.on {
  color: var(--accent);
  border-color: var(--accent);
}
.btn.set-toggle.warn {
  border-color: var(--watch);
  color: var(--watch);
}
/* loading beacon: a beam of light sweeps the header's bottom edge while anything is fetching */
.beacon {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  overflow: visible;
  clip-path: inset(-20px 0 -20px 0);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s;
}
.beacon::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 26%;
  left: -26%;
  background: linear-gradient(90deg, transparent, var(--accent) 35%, #fff 50%, var(--accent) 65%, transparent);
  box-shadow:
    0 0 10px 1px var(--accent),
    0 0 28px 6px var(--accent-soft);
}
.topbar.busy .beacon {
  opacity: 1;
}
.topbar.busy .beacon::before {
  animation: beam 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
@keyframes beam {
  0% {
    left: -26%;
  }
  100% {
    left: 100%;
  }
}
.topbar.busy .pulse i {
  box-shadow:
    0 0 0 3px var(--accent-soft),
    0 0 12px var(--accent);
  animation: glow 1.2s ease-in-out infinite alternate;
}
@keyframes glow {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .topbar.busy .beacon::before {
    left: 0;
    width: 100%;
    opacity: 0.6;
  }
}
/* Phones */
@media (max-width: 600px) {
  h1 {
    font-size: 19px;
  }
  .topbar {
    top: 4px;
    padding: 10px 12px 0;
    gap: 8px 12px;
    grid-template-columns: minmax(0, 1fr);
  }
  .controls .btn {
    min-height: 28px;
    padding: 3px 10px;
    font-size: 12px;
  }
  .pulse {
    display: none;
  }
}
</style>
