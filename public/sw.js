// PRECOG / Trend Radar · Service worker: makes the installed app open even offline, with the last version seen.
// Only the page itself is kept (the build puts all JS and CSS into index.html). It is network first, so a new
// deploy shows as soon as there is a connection; the data APIs are never touched and always load live.
const CACHE = 'precog-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return; // everything but the page goes straight to the network
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        if (res.ok) void caches.open(CACHE).then(c => c.put('./', copy));
        return res;
      })
      .catch(() => caches.match('./').then(hit => hit || Response.error())),
  );
});
