// PRECOG / Trend Radar · Boot: make the app's context, restore the last view, mount, start the data loops.
import { createApp, watch } from 'vue';
import '@/styles/tokens.css';
import '@/styles/app.css';

// Every source registers itself on import: trend sources, streams and open-data cards.
import '@sources/index';

import App from '@/App.vue';
// After the components' styles, so print and reduced-motion overrides win.
import '@/styles/print-motion.css';
import { exposeConsoleHooks } from '@/boot/console';
import { installLifecycle } from '@/boot/lifecycle';
import { restore } from '@/boot/prefs';
import { installShortcuts } from '@/boot/shortcuts';
import { registerServiceWorker } from '@features/install';
import { activeChannel, channelDatapoints } from '@/channels';
import { contextPlugin, createContext } from '@/context';
import { HOUR } from '@core/config';
import { startClock } from '@core/ui-store';

const ctx = createContext();
restore(ctx);
createApp(App).use(contextPlugin(ctx)).mount('#app');

startClock(ctx.app.ui);
ctx.live.start(); // also loads the stream on screen
// Topics picked once a day (World, Alt Amsterdam, The Great Turning); new topics are fetched straight away.
// The channel on screen picks first; the others a little later, once the screen has settled, so a cold start
// doesn't ask Wikipedia about every pool at once.
const reloadIf = (changed: boolean) => void (changed && ctx.live.load());
function pickHot(): void {
  const onScreen = ctx.hot.for(ctx.app.state.activeLens);
  void (onScreen ? onScreen.refresh() : Promise.resolve(false)).then(reloadIf);
  setTimeout(() => void ctx.hot.refresh().then(reloadIf), 20_000);
}
pickHot();
setInterval(pickHot, HOUR); // a no-op until the day changes
// Opening a picked channel before its turn picks its topics now (a no-op once it has picked today).
watch(
  () => ctx.app.state.activeLens,
  lens => void ctx.hot.for(lens)?.refresh().then(reloadIf),
);
// GitHub's panels load only on its channel (its API allows 60 calls an hour without a token).
const loadGitHub = () => {
  if (!activeChannel(ctx.app).github) return;
  void ctx.github.load();
  void ctx.myGithub.load();
};
loadGitHub();
watch(() => ctx.app.state.activeLens, loadGitHub);
// Open data: only the cards the channel on screen shows, then each channel's as it opens (refreshed hourly).
const loadCards = () => void ctx.datapoints.load(channelDatapoints(activeChannel(ctx.app)));
loadCards();
watch(() => ctx.app.state.activeLens, loadCards);
setInterval(loadCards, HOUR);
ctx.stories.startTimer();

installShortcuts(ctx);
installLifecycle(ctx);
registerServiceWorker(); // the installed app opens offline too
exposeConsoleHooks();
