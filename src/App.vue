<template>
  <div class="page">
    <app-header></app-header>

    <section class="channel-hero" :key="view.channel.id" aria-labelledby="ch-title">
      <div>
        <p class="ch-kicker">
          <span class="ch-no">CH {{ view.no }}</span>
          {{ view.updated }}
        </p>
        <h2 id="ch-title">{{ view.title }}</h2>
        <p class="ch-desc">{{ view.channel.kicker }}</p>
        <p v-if="view.channel.links?.length" class="ch-links">
          <a v-for="l in view.channel.links" :key="l.href" :href="l.href" target="_blank" rel="noopener noreferrer">
            {{ l.label }} ↗
          </a>
        </p>
      </div>
      <p class="status" role="status">{{ ui.status }}</p>
    </section>

    <div class="layout" :key="'l-' + view.channel.id">
      <div class="main">
        <section v-if="view.channel.prices" class="block" aria-labelledby="b-prices">
          <h3 id="b-prices" class="block-head">
            <span>{{ view.n('prices') }}</span>
            Prices
          </h3>
          <markets-panel :index="0"></markets-panel>
        </section>
        <section v-if="view.channel.digest" class="block" aria-labelledby="b-today">
          <h3 id="b-today" class="block-head">
            <span>{{ view.n('today') }}</span>
            Today
          </h3>
          <digest-panel :index="0"></digest-panel>
        </section>
        <section v-if="!view.channel.prices" class="block" aria-labelledby="b-gist">
          <h3 id="b-gist" class="block-head">
            <span>{{ view.n('gist') }}</span>
            Gist
          </h3>
          <morning-brief :index="0"></morning-brief>
        </section>
        <section class="block" aria-labelledby="b-trends">
          <h3 id="b-trends" class="block-head">
            <span>{{ view.n('trends') }}</span>
            {{ view.channel.prices ? 'Topics' : 'Trends' }}
          </h3>
          <div class="stack">
            <!-- A price channel charts real prices above, not attention. -->
            <signal-panel v-if="!view.channel.prices" :index="1"></signal-panel>
            <lens-panel :index="2"></lens-panel>
          </div>
        </section>
        <section v-if="view.channel.github" class="block" aria-labelledby="b-build">
          <h3 id="b-build" class="block-head">
            <span>{{ view.n('build') }}</span>
            Builders
          </h3>
          <div class="stack">
            <git-hub-panel :index="3"></git-hub-panel>
            <git-hub-me-panel :index="4"></git-hub-me-panel>
          </div>
        </section>
        <section class="block" aria-labelledby="b-streams">
          <h3 id="b-streams" class="block-head">
            <span>{{ view.n('streams') }}</span>
            Streams
          </h3>
          <stories-panel :index="5"></stories-panel>
        </section>
      </div>
      <aside class="side" aria-label="Context and radar">
        <template v-if="view.side">
          <h3 class="block-head">
            <span>◇</span>
            Context
          </h3>
          <datapoints-panel :index="1"></datapoints-panel>
        </template>
        <template v-if="!view.channel.prices">
          <h3 class="block-head">
            <span>◇</span>
            Radar
          </h3>
          <radar-panel :index="2"></radar-panel>
        </template>
      </aside>
    </div>

    <footer class="foot">
      PRECOG tracks topics, never people · Wikipedia · The Guardian · Hacker News · Manifold · GitHub · ECB · Eurostat ·
      IPMA · Open-Meteo · NOAA · NSIDC · DGEG · CoinGecko · EIA · alternative.me
    </footer>
  </div>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { computed, defineComponent } from 'vue';
import { activeChannel, channelDatapoints, channels } from '@/channels';
import AppHeader from '@components/AppHeader.vue';
import MorningBrief from '@components/MorningBrief.vue';
import DigestPanel from '@components/DigestPanel.vue';
import MarketsPanel from '@components/MarketsPanel.vue';
import DatapointsPanel from '@components/DatapointsPanel.vue';
import LensPanel from '@components/LensPanel.vue';
import SignalPanel from '@components/SignalPanel.vue';
import StoriesPanel from '@components/StoriesPanel.vue';
import GitHubPanel from '@components/GitHubPanel.vue';
import GitHubMePanel from '@components/GitHubMePanel.vue';
import RadarPanel from '@components/RadarPanel.vue';

// PRECOG / Trend Radar · One channel on screen at a time: its gist, trends, streams and context.

export default defineComponent({
  name: 'App',
  components: {
    AppHeader,
    MorningBrief,
    DigestPanel,
    MarketsPanel,
    DatapointsPanel,
    LensPanel,
    SignalPanel,
    StoriesPanel,
    GitHubPanel,
    GitHubMePanel,
    RadarPanel,
  },
  setup() {
    const { app } = useApp();
    const ui = app.ui;
    const view = computed(() => {
      const channel = activeChannel(app);
      const i = channels(app).findIndex(c => c.id === channel.id);
      // The main column's sections, numbered in the order they show.
      const blocks = [
        channel.prices && 'prices',
        channel.digest && 'today',
        !channel.prices && 'gist',
        'trends',
        channel.github && 'build',
        'streams',
      ].filter(Boolean);
      return {
        n: (b: string) => String(blocks.indexOf(b) + 1).padStart(2, '0'),
        channel,
        no: String(i + 1).padStart(2, '0'),
        title: app.activeLens()?.name || channel.label,
        side: channelDatapoints(channel).length > 0,
        updated: new Date(ui.now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
      };
    });
    return { ui, view };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.status {
  margin: 0 6px 6px;
  min-height: 1.5em;
  color: var(--muted);
  font-size: 11.5px;
}

/* channel hero */
.ch-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin: 10px 0 0;
}
.ch-links a {
  padding: 4px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 99px;
  background: var(--card);
  color: var(--ink-2);
  font-size: 12px;
  text-decoration: none;
}
.ch-links a:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.channel-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px 24px;
  padding: 30px 4px 18px;
  animation: enter 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.ch-kicker {
  margin: 0 0 6px;
  color: var(--muted);
  font: 500 11px/1 var(--mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ch-no {
  color: var(--accent);
  margin-right: 10px;
}
.channel-hero h2 {
  margin: 0;
  font: 300 42px/1.05 var(--sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--title);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px var(--accent-soft));
}
.ch-desc {
  margin: 8px 0 0;
  color: var(--ink-2);
  font-size: 14px;
  max-width: 70ch;
}
.channel-hero .status {
  margin: 0;
  text-align: right;
  max-width: 46ch;
}

/* layout: the channel's main column, and its context alongside on wide screens */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 22px 26px;
  align-items: start;
}
.main,
.side {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
@media (min-width: 1180px) {
  .layout:not(.wide) {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
  .side {
    position: sticky;
    top: 120px;
    max-height: calc(100vh - 132px);
    overflow-y: auto;
    scrollbar-width: thin;
  }
}
.block {
  min-width: 0;
}
.block-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 4px 10px;
  color: var(--ink-2);
  font: 600 11px/1 var(--mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.block-head span {
  color: var(--accent);
  font-weight: 500;
  text-shadow: 0 0 12px var(--accent-soft);
}
.block-head::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--accent-soft), var(--hair) 30%, transparent);
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.foot {
  margin: 44px 4px 0;
  padding-top: 14px;
  border-top: 1px solid var(--hair);
  color: var(--muted);
  font-size: 11px;
}
/* Phones */
@media (max-width: 600px) {
  .page {
    padding: 0 12px 52px;
  }
  .channel-hero {
    grid-template-columns: minmax(0, 1fr);
    padding-top: 20px;
  }
  .channel-hero h2 {
    font-size: 28px;
    letter-spacing: 0.04em;
  }
  .channel-hero .status {
    text-align: left;
  }
}
</style>
