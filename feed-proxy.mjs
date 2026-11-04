// PRECOG feed proxy: lets the dashboard read Portuguese and Dutch news feeds
// that block direct browser access. It listens on 127.0.0.1 only and fetches
// feeds from the allowlisted hosts below, nothing else.
//
//   node feed-proxy.mjs            # then use http://localhost:8787/?url= in "Feeds…"
//   PORT=9000 node feed-proxy.mjs
//
// Needs Node 18 or newer. No dependencies.
import http from 'node:http';

const PORT = Number(process.env.PORT) || 8787;
const ALLOW = new Set([
  // Portugal
  'www.rtp.pt', 'feeds.feedburner.com', 'observador.pt', 'www.publico.pt', 'expresso.pt', 'eco.sapo.pt', 'www.jornaldenegocios.pt',
  // Netherlands
  'feeds.nos.nl', 'www.nu.nl', 'www.dutchnews.nl', 'nltimes.nl', 'www.volkskrant.nl', 'www.trouw.nl', 'nos.nl',
]);
const TTL = 5 * 60e3;
const cache = new Map();   // url -> { at, status, type, body }

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.method !== 'GET') { res.writeHead(405).end('GET only'); return; }

  let target;
  try { target = new URL(new URL(req.url, 'http://localhost').searchParams.get('url') || ''); }
  catch { res.writeHead(400).end('Pass ?url=<feed URL>'); return; }
  if (target.protocol !== 'https:' || !ALLOW.has(target.hostname)) {
    res.writeHead(403).end(`Host not on the allowlist: ${target.hostname}. Edit ALLOW in feed-proxy.mjs to add a news site.`);
    return;
  }

  const hit = cache.get(target.href);
  if (hit && Date.now() - hit.at < TTL) { res.writeHead(hit.status, { 'Content-Type': hit.type }).end(hit.body); return; }
  try {
    const r = await fetch(target, { headers: { 'User-Agent': 'PRECOG-feed-proxy/1.0 (personal news dashboard)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
    if (!ALLOW.has(new URL(r.url).hostname)) { res.writeHead(403).end('Redirected off the allowlist'); return; }
    const body = Buffer.from(await r.arrayBuffer());
    if (body.length > 5e6) { res.writeHead(413).end('Feed too large'); return; }
    const entry = { at: Date.now(), status: r.status, type: r.headers.get('content-type') || 'application/xml', body };
    if (r.ok) cache.set(target.href, entry);
    res.writeHead(entry.status, { 'Content-Type': entry.type }).end(body);
  } catch (e) {
    res.writeHead(502).end(`Fetch failed: ${e.message}`);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`PRECOG feed proxy on http://localhost:${PORT}/?url=`));
