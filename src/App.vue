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
      </div>
      <p class="status" role="status">{{ ui.status }}</p>
    </section>

    <div class="layout" :key="'l-' + view.channel.id">
      <div class="main">
        <section class="block" aria-labelledby="b-gist">
          <h3 id="b-gist" class="block-head">
            <span>01</span>
            Gist
          </h3>
          <morning-brief :index="0"></morning-brief>
        </section>
        <section class="block" aria-labelledby="b-trends">
          <h3 id="b-trends" class="block-head">
            <span>02</span>
            Trends
          </h3>
          <div class="stack">
            <signal-panel :index="1"></signal-panel>
            <lens-panel :index="2"></lens-panel>
          </div>
        </section>
        <section v-if="view.channel.github" class="block" aria-labelledby="b-build">
          <h3 id="b-build" class="block-head">
            <span>03</span>
            Builders
          </h3>
          <div class="stack">
            <git-hub-panel :index="3"></git-hub-panel>
            <git-hub-me-panel :index="4"></git-hub-me-panel>
          </div>
        </section>
        <section class="block" aria-labelledby="b-streams">
          <h3 id="b-streams" class="block-head">
            <span>{{ view.channel.github ? '04' : '03' }}</span>
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
        <h3 class="block-head">
          <span>◇</span>
          Radar
        </h3>
        <radar-panel :index="2"></radar-panel>
      </aside>
    </div>

    <footer class="foot">
      PRECOG tracks topics, never people · Wikipedia · The Guardian · Hacker News · Manifold · GitHub · ECB · Eurostat ·
      IPMA · Open-Meteo · NOAA · NSIDC
    </footer>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { activeChannel, channelDatapoints, channels } from '@/channels';
import { ui } from '@core/ui-store';
import { activeLens } from '@/state';
import AppHeader from '@components/AppHeader.vue';
import MorningBrief from '@components/MorningBrief.vue';
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
    DatapointsPanel,
    LensPanel,
    SignalPanel,
    StoriesPanel,
    GitHubPanel,
    GitHubMePanel,
    RadarPanel,
  },
  setup() {
    const view = computed(() => {
      const channel = activeChannel();
      const i = channels().findIndex(c => c.id === channel.id);
      return {
        channel,
        no: String(i + 1).padStart(2, '0'),
        title: activeLens()?.name || channel.label,
        side: channelDatapoints(channel).length > 0,
        updated: new Date(ui.now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
      };
    });
    return { ui, view };
  },
});
</script>
