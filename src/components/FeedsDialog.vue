<template>
  <dialog ref="dlg" @close="onClose">
    <form method="dialog">
      <h3>News feeds</h3>
      <p>
        Used by the "PT · NL news" stories tab and the RSS source. Only titles, links, summaries and dates are read.
      </p>
      <p>
        <button class="btn small" type="button" @click="addPresets">Add Portuguese + Dutch outlets</button>
        RTP, Público, Observador, NOS, NU.nl, DutchNews, NL Times
      </p>
      <label for="rss-feeds">Feed URLs, one per line</label>
      <textarea id="rss-feeds" v-model="feeds" rows="5" placeholder="https://example.com/feed.xml"></textarea>
      <label for="rss-proxy">CORS proxy prefix (optional)</label>
      <input id="rss-proxy" v-model="proxy" type="text" placeholder="http://localhost:8787/?url=" />
      <p>
        These outlets block direct browser access. Run
        <code>node feed-proxy.mjs</code>
        from the PRECOG folder and use
        <code>http://localhost:8787/?url=</code>
        . It runs on your machine and only fetches the listed news sites.
      </p>
      <div class="row">
        <button class="btn" value="cancel" type="submit">Cancel</button>
        <button class="btn primary" value="save" type="submit">Save &amp; load</button>
      </div>
    </form>
  </dialog>
</template>

<script lang="ts">
import { ref, watch, defineComponent } from 'vue';
import { LS, store } from '../core/config';
import { ui } from '../core/ui-store';
import { loadStories, stories } from '../features/stories';
import { DEFAULT_SOURCE, setSource, setStatus } from '../live';
import { FEED_PRESETS, rssCache } from '../sources/rss';
import { state } from '../state';

// PRECOG / Trend Radar · News feeds dialog, used by the RSS source and the PT·NL stories tab.

export default defineComponent({
  name: 'FeedsDialog',
  setup() {
    const dlg = ref(null),
      feeds = ref(''),
      proxy = ref('');
    const PROXY = 'http://localhost:8787/?url=';
    watch(
      () => ui.feedsOpen,
      () => {
        const cfg = store.get(LS.rss, { feeds: [], proxy: '' }),
          local = ui.feedsIntent === 'local';
        feeds.value = (cfg.feeds.length ? cfg.feeds : local ? FEED_PRESETS : []).join('\n');
        proxy.value = cfg.proxy || (local ? PROXY : '');
        dlg.value.showModal ? dlg.value.showModal() : dlg.value.setAttribute('open', '');
      },
    );
    function addPresets() {
      feeds.value = [...new Set([...feeds.value.split(/\s+/).filter(Boolean), ...FEED_PRESETS])].join('\n');
      if (!proxy.value) proxy.value = PROXY;
    }
    function onClose() {
      const intent = ui.feedsIntent;
      if (dlg.value.returnValue === 'save') {
        const list = feeds.value
          .split(/\s+/)
          .map(s => s.trim())
          .filter(s => /^https?:\/\//i.test(s));
        store.set(LS.rss, { feeds: list, proxy: proxy.value.trim() });
        rssCache.key = '';
        if (intent === 'local') {
          stories.at.local = 0;
          loadStories();
          return;
        }
        if (list.length) {
          setSource('rss');
          return;
        }
        setStatus('No valid feed URLs (they must start with http:// or https://).');
      }
      if (intent === 'local') return;
      // Picked the RSS source but saved no feeds: go back to the attention index.
      if (state.source === 'rss' && !store.get(LS.rss, { feeds: [] as string[] }).feeds.length)
        setSource(DEFAULT_SOURCE);
    }
    return { dlg, feeds, proxy, addPresets, onClose };
  },
});
</script>
