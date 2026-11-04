# PRECOG / Trend Radar

A morning-brief dashboard for world attention trends. It tracks **topics** (themes, technologies, markets, policies), groups them into lenses, flags unusual spikes, and shows the stories behind them.

Open `index.html` in a browser. It needs no build step or dependencies. The default theme is dark; the **◐** button switches to light, and printing always uses light.

## Scope

PRECOG tracks topics only. It never collects, stores or aggregates data about individual people.

- Topic and lens names that look like a person, an @handle or an email are refused. This check is a heuristic based on common first names and titles.
- A Wikipedia lookup that lands on a person's article is skipped.
- Story lists show headlines and outlets only. Hacker News authors are never requested.
- Community Archive results are reduced to their date the moment they arrive. Usernames, account IDs and text are thrown away.

## The daily read

1. **Morning brief:** what's running hot, the biggest moves, the steadiest climb, the most active lens, Portugal fire risk, and what changed since your last look. Use **Copy brief as Markdown** to paste it into a daily note, and **Mark as read** to set the comparison point for tomorrow.
2. **Datapoints:** the ECB deposit rate, unemployment (PT, NL, euro area), IPMA fire risk and weather warnings, and today's temperature and air quality in Lisbon, Porto and Amsterdam. These are always real data, even in demo mode.
3. **Rising stories:**
   - **Hacker News:** ranked by engagement (points plus comments) per hour. While the page is open it re-checks every 10 minutes, so velocity is *measured*, not just averaged. The 24h projection assumes engagement levels off (E(t) = E∞·(1 − e^(−t/8h))). **Breaking out** marks young stories in the top fifth by velocity.
   - **Global news (GDELT):** last-24h articles grouped into story clusters, ranked by how many outlets cover them.
   - **PT · NL news:** the same clustering over RTP, Público, Observador, NOS, NU.nl, DutchNews and NL Times. This tab needs the local proxy (see below).
4. **Lenses:** World, Geopolitics, Climate & energy, Circular economy, Portugal, Nederland and Tech radar. Each holds up to 6 topics, and there can be up to 8 lenses. The Portugal and Nederland lenses read Portuguese and Dutch Wikipedia, and filter GDELT to Portuguese and Dutch outlets. Press `[` and `]` to switch lens, and ←/→ to switch topic.

## Sources

| Source | What it measures | Notes |
|---|---|---|
| **World attention index** (default live source) | A blend of the sources below. Each one is re-based so 100 = its own 30-day median, then they are averaged with weights. | Only days that every source has published are used. Sparse sources get less weight, and "low volume" topics are kept out of the brief's headline claims. |
| Wikipedia pageviews | daily views of the topic's article, in the lens language (en, pt or nl) | Titles are resolved automatically, or set exactly with `\| wiki: Title`. |
| Global news share (GDELT) | the topic's share of worldwide news coverage per day | Allows one request every ~5 s, so it loads last. Results are cached for the day. Untick **GDELT news** if it's rate-limiting you. |
| Hacker News | stories per day matching the phrase (typo tolerance off) | English lenses only. Usually one request per topic, cached per day. |
| Community Archive | posts per day in the opt-in Twitter archive (semantic search) | Not in the index by default: it's a niche community and slow. Choose it as its own source. |
| GitHub | new repos per week | Allows about 10 requests a minute, so it's slow the first time. Results are cached for 12 h. |
| RSS | mentions per day across your feeds | Configure feeds under **Feeds…**. |

**Topic syntax:** `Name | wiki: Exact article title | q: search phrase`, for example `Rust | wiki: Rust (programming language) | q: Rust`.

## Portuguese and Dutch news (local proxy)

Portuguese and Dutch outlets block feed reads from other websites, so the page can't fetch them directly. Run the bundled proxy on your own machine:

```sh
node feed-proxy.mjs          # Node 18+, no dependencies
```

It listens on `127.0.0.1:8787` and fetches only the news hosts listed in `ALLOW` at the top of the file. In the dashboard, open **Rising stories → PT · NL news → set up PT + NL feeds**. That fills in the outlets and the proxy address (`http://localhost:8787/?url=`). To add an outlet, add its host to `ALLOW` and its feed URL in the dialog.

## Other open data you could add

All of these allow browser requests and need no key (checked November 2026):

- **Statistics Netherlands (CBS) StatLine OData**, `opendata.cbs.nl`: house prices, energy and other Dutch statistics.
- **Statistics Portugal (INE)**, `ine.pt/ine/json_indicador`: Portuguese indicators. It returns data but doesn't allow browser requests, so it would need the proxy.
- **Wikimedia most-read by country**, `pageviews/top-per-country/PT|NL`: what each country is reading. It's mostly people, so it would need a person filter, for example Wikidata "instance of human".
- **Manifold Markets**: crowd forecasts on world questions. A good fit for a "pre-cog" view.
- **USGS earthquakes**, **Open-Meteo climate archive**, **Mastodon trending tags**.
- **Eurostat / ECB inflation (HICP):** both returned data only up to December 2025 when checked, probably because of the 2026 base-year change, so inflation is left out of the dashboard for now.

## How the numbers work

- **Forecast:** linear regression on the last 20 points, projected 12 steps ahead. The band is ±1σ of the residuals.
- **Momentum:** the regression slope as a % of the recent mean, per step. The radar maps it to distance from the centre.
- **z-score:** the latest point against the previous 30. Above 2.5 raises an **ALERT**; above 1.8 raises a **WATCH**. One topic gets at most one alert every 6 steps, unless a watch escalates.
- **Demo mode:** seeded random walks with injected spikes. One tick (every 2 s) is one simulated hour.

## Adding a data adapter

```html
<script>
PRECOG.registerAdapter({
  id: 'npm', label: 'npm downloads / day', unit: 'downloads',
  weight: 0.2,       // optional: weight if you add it to the blend
  minMean: 1,        // optional: count sources sparser than this get less weight
  lagDays: 0,        // optional: drop the newest N days (sources that publish late)
  async fetch(topic, { signal, query }) {      // query = { name, wiki, q, lang, country }
    const r = await fetch(`https://api.npmjs.org/downloads/range/last-month/${encodeURIComponent(query.q)}`, { signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return { topic, points: j.downloads.map(d => ({ t: d.day + 'T00:00:00Z', value: d.downloads })) };
  },
});
</script>
```

Return `{ topic, points: [{ t: ISODate, value }] }`. Throw an `Error` with a short message when there's no data. Return `{ topic, points: [], skip: 'reason' }` when the source doesn't apply to a lens, for example a non-English lens. Respect `signal`. Query by topic only, and never return or store data about individual people.

## Stored in your browser (`localStorage`)

Lenses and topics, panel order, theme, source, the last-look snapshot, RSS settings, and caches (Wikipedia titles, HN day counts, GDELT for the day, story engagement observations for 72 h). Nothing leaves your machine except the API requests themselves.
