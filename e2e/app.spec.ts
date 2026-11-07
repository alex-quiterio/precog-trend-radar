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
  await expect(heroTitle(page)).toHaveText('Energy & power');
  await page.reload();
  await expect(heroTitle(page)).toHaveText('Energy & power');
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

test('creates a channel and deletes it from the channel bar; built-in channels have no delete', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: /^Delete channel/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'New channel' }).click();
  await page.getByLabel('New channel name').fill('Bikes');
  await page.getByLabel('New channel name').press('Enter');
  await expect(heroTitle(page)).toHaveText('Bikes');
  page.once('dialog', d => void d.accept());
  await page.locator('.channels').getByRole('button', { name: 'Delete channel Bikes' }).click();
  await expect(page.locator('.channels').getByRole('button', { name: 'Bikes' })).toHaveCount(0);
  await expect(heroTitle(page)).not.toHaveText('Bikes');
  await page.reload();
  await expect(page.locator('.channels').getByRole('button', { name: 'Bikes' })).toHaveCount(0);
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

test('Portugal shows what a litre of fuel costs, from DGEG', async ({ page }) => {
  await open(page);
  await page.locator('body').press('4');
  await expect(heroTitle(page)).toHaveText('Portugal & the land');
  await expect(page.locator('#p-data')).toContainText('Diesel · Portugal');
  await expect(page.locator('#p-data')).toContainText('2,205 €/L');
});

test('Alt Amsterdam picks its topics from its scene, reads its own sites, and links to Hipsy', async ({ page }) => {
  await open(page);
  await page.locator('body').press('7');
  await expect(heroTitle(page)).toHaveText('Alternative Amsterdam');
  await expect(page.locator('#p-watch')).toContainText('Picked today from what is moving in the scene');
  await expect(page.locator('#p-watch .chip .name')).toHaveCount(6);
  await expect(page.locator('.ch-links')).toContainText('Hipsy');
  await expect(page.locator('#p-data')).toContainText('Netherlands');
});
