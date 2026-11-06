<template>
  <panel-shell id="p-me" :title="'Your GitHub' + (s ? ' · @' + s.login : '')" :meta="meta" :index="index">
    <template #controls>
      <button
        class="btn small no-print"
        type="button"
        :aria-pressed="ui.ghToken"
        :title="
          ui.ghToken
            ? 'Using your GitHub token. Click to change or remove it.'
            : 'Add a GitHub token to search 3× faster'
        "
        @click="editGithubToken"
      >
        {{ ui.ghToken ? '✓ Token' : '+ Token' }}
      </button>
      <button class="btn small no-print" type="button" @click="editUser">
        {{ user ? 'Change user' : 'Set your username' }}
      </button>
    </template>

    <p v-if="!user" class="empty">Set your GitHub username to see your public repos, stars and activity.</p>
    <p v-else-if="!s" class="empty">{{ me.error ? `Could not load: ${me.error}.` : 'Loading…' }}</p>
    <template v-else>
      <div class="gh-tiles">
        <div class="tile">
          <span class="tile-k">Public repos</span>
          <b class="tile-v">{{ nf0.format(s.publicRepos) }}</b>
          <span class="tile-s">{{ nf0.format(s.followers) }} followers</span>
        </div>
        <div class="tile">
          <span class="tile-k">Stars on your repos</span>
          <b class="tile-v">{{ nf0.format(s.stars) }}</b>
          <span class="tile-s">{{ s.topRepos[0] ? 'most on ' + s.topRepos[0].name : '' }}</span>
        </div>
        <div class="tile">
          <span class="tile-k">Active days · 30 days</span>
          <b class="tile-v">{{ s.activeDays30 }}</b>
          <span class="tile-s">{{ nf0.format(s.pushes30) }} commits pushed</span>
        </div>
        <div class="tile">
          <span class="tile-k">Main language</span>
          <b class="tile-v small">{{ s.languages[0] ? s.languages[0].lang : '—' }}</b>
          <span class="tile-s">{{ s.languages[0] ? s.languages[0].count + ' repos' : '' }}</span>
        </div>
      </div>

      <div class="gh-grid">
        <figure class="gh-fig">
          <figcaption>
            Activity
            <span class="muted">public events per day, last 30 days</span>
          </figcaption>
          <div class="act" role="img" :aria-label="`${s.activeDays30} active days in the last 30`">
            <span
              v-for="d in s.activity"
              :key="d.t"
              class="act-col"
              :title="`${day(d.t)}: ${d.value} event${d.value === 1 ? '' : 's'}`"
            >
              <i
                :style="{ height: Math.max(d.value ? 8 : 2, (d.value / actMax) * 100) + '%' }"
                :class="{ zero: !d.value }"
              ></i>
            </span>
          </div>
          <div class="act-axis muted">
            <span>{{ day(s.activity[0].t) }}</span>
            <span>today</span>
          </div>
        </figure>
        <figure class="gh-fig">
          <figcaption>
            Languages
            <span class="muted">by number of your repos</span>
          </figcaption>
          <ul class="gh-bars langs">
            <li v-for="l in s.languages" :key="l.lang" :title="`${l.lang}: ${l.count} repos`">
              <span class="gh-name">{{ l.lang }}</span>
              <span class="gh-track">
                <i class="gh-bar neutral" :style="{ width: (l.count / langMax) * 100 + '%' }"></i>
              </span>
              <span class="gh-val">{{ l.count }}</span>
            </li>
          </ul>
        </figure>
      </div>

      <h4 class="gh-sub">Recently pushed</h4>
      <ol class="stories compact">
        <li v-for="r in s.recent" :key="r.name" class="story">
          <span class="rank">↑</span>
          <div>
            <div class="title">
              <a :href="r.url" target="_blank" rel="noopener noreferrer">{{ r.name }}</a>
            </div>
            <div class="smeta">
              <span v-if="r.language">{{ r.language }}</span>
              <span>pushed {{ ago(r.pushed) }}</span>
              <span v-if="r.desc" class="desc">{{ r.desc }}</span>
            </div>
          </div>
          <div class="vel">
            <b>★ {{ nf0.format(r.stars) }}</b>
            <small>{{ nf0.format(r.forks) }} forks</small>
          </div>
        </li>
      </ol>
    </template>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import './github.css';
import { computed, defineComponent } from 'vue';
import { ago, nf0 } from '@core/format';
import { ui } from '@core/ui-store';
import { githubUser, loadMyGitHub, me, setGithubUser } from '@features/github-me';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Your GitHub: public repos, stars, languages and 30 days of activity.

export default defineComponent({
  name: 'GitHubMePanel',
  props: { index: Number },
  components: { PanelShell },
  setup() {
    const { actions } = useApp();
    const { editGithubToken } = actions;
    const s = computed(() => me.stats);
    const user = computed(() => githubUser());
    const actMax = computed(() => Math.max(1, ...(s.value?.activity || []).map(d => d.value)));
    const langMax = computed(() => Math.max(1, ...(s.value?.languages || []).map(l => l.count)));
    const meta = computed(() => (me.loading ? 'loading…' : me.at ? `checked ${ago(me.at)} · public data` : ''));
    const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    function editUser() {
      const u = window.prompt('Your GitHub username (public data only):', githubUser());
      if (u == null) return;
      setGithubUser(u);
      loadMyGitHub(true);
    }
    return { ui, me, s, user, actMax, langMax, meta, day, editUser, editGithubToken, ago, nf0 };
  },
});
</script>
