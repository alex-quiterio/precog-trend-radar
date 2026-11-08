// PRECOG / Trend Radar · The built app in a real browser, at phone and desktop widths, with every outside API
// answered from fixtures (see mock-apis.ts). Runs in CI after the build.
import { expect, test, type Page } from '@playwright/test';
import { SPIKING, mockApis } from './mock-apis';

/** Opens the app and waits until the first data load has finished. */
async function open(page: Page, opts: Parameters<typeof mockApis>[1] = {}) {
  await mockApis(page, opts);
  await page.goto('/');
  await expect(page.locator('.status')).toContainText('Live · updated', { timeout: 30_000 });
}
const heroTitle = (page: Page) => page.locator('.channel-hero h2');
const stories = (page: Page) => page.locator('#p-stories');

test('loads every panel with data', async ({ page }) => {
  await open(page);
  await expect(heroTitle(page)).toHaveText('World');
  await expect(page.locator('#p-brief .brief-list li').first()).toBeVisible();
  await expect(page.locator('#p-brief .movers tbody tr')).toHaveCount(6);
  await expect(page.locator('#p-signal svg path').first()).toBeVisible(); // the trend line
  await expect(page.locator('#p-radar .blip')).toHaveCount(6);
  await expect(page.locator('#p-data')).toContainText('ECB deposit rate');
  await expect(page.locator('#p-data')).toContainText('CO₂ in the air');
});

test('flags the topic that spikes, in the gist and the movers table', async ({ page }) => {
  await open(page);
  await expect(page.locator('#p-brief .brief-list')).toContainText(`running hot: ${SPIKING}`);
  await expect(page.locator('#p-brief .movers tbody tr').filter({ hasText: SPIKING })).toContainText('ALERT');
});

test('never scrolls sideways', async ({ page }) => {
  await open(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('switches channel from the channel bar and with number keys, and remembers it', async ({ page }) => {
  await open(page);
  await page.locator('.channels .channel').nth(1).click();
  await expect(heroTitle(page)).toHaveText('The Great Simplification');
  await page.locator('body').press('3');
  await expect(heroTitle(page)).toHaveText('The Marginalian');
  await page.reload();
  await expect(heroTitle(page)).toHaveText('The Marginalian');
});

test('switches theme in the settings bar and keeps it after a reload', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const settings = page.getByRole('region', { name: 'Settings' });
  await expect(settings).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(settings.getByText('Not set.')).toBeVisible(); // the Guardian key lives here too
  await settings.getByRole('button', { name: 'Light' }).click();
  await expect(settings.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await settings.press('Escape');
  await expect(settings).toHaveCount(0);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('shows each stream’s items, matched to the channel’s topics', async ({ page }) => {
  await open(page);
  const tab = (name: string) => stories(page).locator('.seg button', { hasText: name });
  await tab('Forecasts').click();
  await expect(stories(page).locator('li.story').first()).toContainText('Will');
  await tab('Hacker News').click();
  await expect(stories(page).locator('li.story').first()).toContainText('story');
  await expect(stories(page).locator('li.story .stopic').first()).toBeVisible(); // the topic it names
  await tab('Reading').click();
  await expect(stories(page).locator('li.story').first()).toBeVisible();
});

test('always follows the built-in sites: they cannot be removed', async ({ page }) => {
  await open(page);
  await stories(page).locator('.seg button', { hasText: 'Reading' }).click();
  const chips = stories(page).locator('.site-chip');
  await expect(chips).toHaveCount(2);
  await expect(chips).toContainText(['The Great Simplification', 'The Marginalian']);
  await expect(chips.locator('button')).toHaveCount(0);
});

test('adds a topic, and refuses a person', async ({ page }) => {
  await open(page);
  const topics = page.locator('#p-watch');
  await topics.getByRole('button', { name: 'Remove NATO' }).click(); // the World channel is full: make room
  const input = topics.locator('#add-input');
  await input.fill('Elon Musk');
  await input.press('Enter');
  await expect(topics.locator('.watch-msg')).toContainText('looks like a person');
  await input.fill('Heat pumps');
  await input.press('Enter');
  await expect(topics.locator('.chip', { hasText: 'Heat pumps' })).toBeVisible();
  await expect(page.locator('#p-signal')).toContainText('Heat pumps'); // charted straight away
});

test('the channel bar has no way to add a channel, and built-in channels have no delete', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'New channel' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Delete channel/ })).toHaveCount(0);
});

test('World picks its topics from what the internet is echoing, and a pin keeps one', async ({ page }) => {
  await open(page, { echoes: true });
  const topics = page.locator('#p-watch');
  await expect(topics.locator('.chip .name')).toHaveCount(6);
  for (const name of ['United States elections', 'Polish Constitutional Tribunal crisis', 'Binance hack', '.xyz'])
    await expect(topics.getByRole('button', { name, exact: false }).first()).toBeVisible();
  await expect(topics.getByText('Abdul El-Sayed')).toHaveCount(0); // the most-read article, but a person
  await expect(topics.getByText('World Series')).toHaveCount(0); // in the news, but sport
  await expect(topics.locator('.hot-new')).toHaveCount(0); // the first pick: everything is new, so nothing says so
  // Where the selected topic echoes, at a glance.
  await topics.locator('.chip .name', { hasText: 'United States elections' }).click();
  const why = topics.locator('.hot-why');
  await expect(why.locator('.echo')).toHaveText(['In the news', 'Most read', 'Manifold']);
  await expect(why).toContainText('356k reads yesterday');
  // Pin one; it stays pinned after a reload.
  await topics.getByRole('button', { name: 'Pin .xyz' }).click();
  await expect(topics.getByRole('button', { name: 'Unpin .xyz' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('#p-watch').getByRole('button', { name: 'Unpin .xyz' })).toBeVisible();
});

test('World opens with today’s stories: the news told in a sentence, quiet topics in a line', async ({ page }) => {
  await open(page, { echoes: true });
  const digest = page.locator('#p-digest');
  await expect(page.locator('#b-today')).toContainText('Today');
  await expect(digest.locator('.dg-item').first()).toContainText('In the news');
  await expect(digest).toContainText('the Democratic Party wins a majority');
  // A topic with no story says only what it is, never an encyclopedia lead passed off as news.
  await expect(digest.locator('.dg-quiet li').first()).toContainText('About');
});

test('with a Guardian key, World leads with fresh Guardian headlines and lists the newest', async ({ page }) => {
  // The Guardian is read a call a second (its rate limit), so the whole load takes a minute: World's topics come
  // first, and the test waits for those rather than for every channel.
  await mockApis(page, { echoes: true, guardian: true });
  await page.goto('/');
  const digest = page.locator('#p-digest');
  // Hours-old headlines come before "In the news", which stays as the story's second line.
  await expect(digest.locator('.dg-item').first()).toContainText('The Guardian', { timeout: 45_000 });
  await expect(digest.locator('.dg-also').first()).toContainText('In the news');
  await expect(digest.locator('.dg-sub').first()).toHaveText('Today in the Guardian');
  await expect(digest.locator('.dg-latest li').first()).toContainText('The Guardian');
});

test('Portugal opens with today’s stories and shows what a litre of fuel costs, from DGEG', async ({ page }) => {
  await open(page);
  await page.locator('body').press('5');
  await expect(heroTitle(page)).toHaveText('Portugal & the land');
  await expect(page.locator('#b-today')).toContainText('Today');
  await expect(page.locator('#p-digest .dg-quiet li, #p-digest .dg-item').first()).toBeVisible();
  await expect(page.locator('#p-data')).toContainText('Diesel · Portugal');
  await expect(page.locator('#p-data')).toContainText('2,205 €/L');
});

test('Alt Amsterdam picks its topics from its scene, reads its own sites, and links to Hipsy', async ({ page }) => {
  await open(page);
  await page.locator('body').press('8');
  await expect(heroTitle(page)).toHaveText('Alternative Amsterdam');
  await expect(page.locator('#p-watch')).toContainText('Picked today from what is moving in the scene');
  await expect(page.locator('#p-watch .chip .name')).toHaveCount(6);
  await expect(page.locator('.ch-links')).toContainText('Hipsy');
  await expect(page.locator('#p-data')).toContainText('Netherlands');
});

test('Markets shows real prices and plain takeaways, not attention charts', async ({ page }) => {
  await open(page);
  await page.locator('.channels .channel').nth(8).click();
  await expect(heroTitle(page)).toHaveText('Markets');
  const prices = page.locator('#p-markets');
  await expect(prices.locator('.mk-notes')).toContainText('Brent is $107.03 a barrel');
  await expect(prices.locator('.mk-tile', { hasText: 'Brent crude' })).toContainText('$107.03 – $120.15');
  await expect(prices.locator('.mk-tile', { hasText: 'Nvidia' })).toContainText('$187.69');
  await expect(prices.locator('.mk-tile', { hasText: 'Fear & Greed' })).toContainText('Extreme Fear');
  await expect(prices.locator('.mk-tile', { hasText: '€ → US dollar' })).toContainText('1.1165');
  // Prices, not attention: no attention chart, gist or radar on this channel.
  await expect(page.locator('#p-signal')).toHaveCount(0);
  await expect(page.locator('#p-brief')).toHaveCount(0);
  await expect(page.locator('#p-radar')).toHaveCount(0);
  await expect(page.locator('#p-data')).toContainText('10-year bond yield');
  const gdp = page.locator('#p-gdp');
  await expect(gdp.locator('.gdp-sec.top .gdp-row')).toHaveCount(3); // the fixture has three
  await expect(gdp.locator('.gdp-sec.home')).toContainText('Netherlands');
  await expect(gdp.locator('.gdp-sec.home')).toContainText('Portugal');
  await expect(gdp.locator('.gdp-row').first()).toContainText('United States');
  await expect(gdp.locator('.gdp-row').first()).toContainText('$30.8T');
  await expect(gdp.locator('.gdp-row').first()).toContainText('6.82'); // happiness, beside GDP
  await expect(gdp.locator('.gdp-row').first()).toContainText('#4');
  await expect(gdp.locator('.gdp-sec.home .gdp-row').first()).toContainText('7.22'); // the Netherlands
  // The happiest three, happiest first; a country the World Bank answer lacks shows without GDP.
  await expect(gdp.locator('.gdp-sec.happy .gdp-row')).toHaveCount(3);
  await expect(gdp.locator('.gdp-sec.happy .gdp-row').first()).toContainText('Finland');
  await expect(gdp.locator('.gdp-sec.happy .gdp-row').first()).toContainText('7.76');
});

test('Bird migration shows the flyway from the North Sea to the Algarve, and the birds seen near each city', async ({
  page,
}) => {
  await open(page);
  await page.locator('.channels').getByRole('button', { name: 'Bird migration' }).click();
  await expect(heroTitle(page)).toHaveText('Bird migration');
  const flyway = page.locator('#p-flyway');
  await expect(flyway.locator('.fw-stop')).toHaveCount(6);
  await expect(flyway.locator('.fw-stop').first()).toContainText('Borkum');
  await expect(flyway.locator('.fw-city')).toHaveCount(2); // the radars near Amsterdam and Lisbon
  await expect(flyway.locator('.fw-notes')).toContainText('Towards the Netherlands');
  await expect(flyway.locator('.fw-notes')).toContainText('Towards Portugal');
  await stories(page).getByRole('button', { name: 'Seen near Amsterdam' }).click();
  await expect(stories(page)).toContainText('Eurasian Blackcap');
  await expect(flyway.locator('.fw-gap')).toContainText('France and Spain');
  await expect(page.locator('#p-data')).toContainText('Birds crossing near Amsterdam');
  await expect(page.locator('#p-data')).toContainText('Birds crossing near Lisbon');
  // Birds only: no followed sites, and the gist never reports another channel.
  await expect(stories(page).getByRole('button', { name: 'Reading' })).toHaveCount(0);
  await expect(page.locator('#p-brief')).not.toContainText('Elsewhere');
});

test('Portugal & the land compares plots of land side by side, and remembers them', async ({ page }) => {
  await open(page);
  await page.locator('body').press('5');
  await expect(heroTitle(page)).toHaveText('Portugal & the land');
  const plots = page.locator('#p-plots');
  await plots.getByLabel('Plot name').fill('Águeda');
  await plots.getByLabel(/Plot location/).fill('https://www.google.com/maps/@40.58,-8.44,14z');
  await plots.getByRole('button', { name: 'Add plot' }).click();
  await expect(plots.locator('thead')).toContainText('Águeda');
  await expect(plots).toContainText('100% of normal'); // the mock's rain every day, against the same normal
  await expect(plots).toContainText('1,000 m');
  await expect(plots.locator('tbody').filter({ hasText: 'Fire risk' })).toContainText('high');
  await plots.getByLabel(/Plot location/).fill('not a place');
  await plots.getByRole('button', { name: 'Add plot' }).click();
  await expect(plots.locator('.pl-msg')).toContainText('Paste coordinates');
  await plots.getByRole('button', { name: 'Rename plot Águeda' }).click();
  await plots.getByLabel('New name for Águeda').fill('Casa do rio');
  await plots.getByLabel('New name for Águeda').press('Enter');
  await expect(plots.locator('thead')).toContainText('Casa do rio');
  await page.reload();
  await expect(page.locator('#p-plots thead')).toContainText('Casa do rio');
  await page.getByRole('button', { name: 'Rename plot Casa do rio' }).click();
  await page.getByLabel('New name for Casa do rio').fill('Ignored');
  await page.getByLabel('New name for Casa do rio').press('Escape');
  await expect(page.locator('#p-plots thead')).toContainText('Casa do rio');
  await page.getByRole('button', { name: 'Remove plot Casa do rio' }).click();
  await expect(page.locator('#p-plots thead')).toHaveCount(0);
});

test('The Great Simplification lists Campfire Stories films beside its episodes', async ({ page }, info) => {
  await open(page);
  await page.locator('.channels .channel').nth(1).click();
  await expect(heroTitle(page)).toHaveText('The Great Simplification');
  const tab = stories(page).locator('.seg button', { hasText: 'The Great Simplification' });
  await tab.click();
  const film = stories(page).locator('li.story', { hasText: 'Campfire Stories' });
  await expect(film).toHaveCount(3); // the films' own rows, however many episodes outrank them
  await expect(film.first().locator('a')).toHaveAttribute('href', /^https:\/\/www\.campfire-stories\.org\//);
  await expect(film.first()).not.toContainText('new'); // undated: no "new", no date
  await film.scrollIntoViewIfNeeded();
  if (process.env.SHOT) await stories(page).screenshot({ path: `${process.env.SHOT}/${info.project.name}.png` });
});
