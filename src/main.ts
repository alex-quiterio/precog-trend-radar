// PRECOG / Trend Radar · Boot: make the app's context, restore the last view, mount, start the data loops.
import { createApp } from 'vue';
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
import { activeChannel } from '@/channels';
import { contextPlugin, createContext } from '@/context';
import { HOUR } from '@core/config';
import { startClock } from '@core/ui-store';
import { loadDatapoints } from '@features/datapoints';
import { loadGitHub } from '@features/github';
import { loadMyGitHub } from '@features/github-me';

const ctx = createContext();
restore(ctx);
createApp(App).use(contextPlugin(ctx)).mount('#app');

startClock();
ctx.live.start(); // also loads the stream on screen
if (activeChannel(ctx.app).github) void loadGitHub(ctx.app);
void loadMyGitHub();
void loadDatapoints();
setInterval(loadDatapoints, HOUR);
ctx.stories.startTimer();

installShortcuts(ctx);
installLifecycle(ctx);
exposeConsoleHooks();
