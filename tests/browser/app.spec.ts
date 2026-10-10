import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { compare } from '../../lib/engine';
import { readScenario, readCatalog } from '../../lib/files';

test('fresh state is empty; demo shows the same winner and dollars as the CLI engine', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your money. A clearer plan.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toHaveCount(0);
  await expect(page.getByText('Oct 9, 2026', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try the working-person example' }).click();
  const expected = compare(
    readScenario(readFileSync('examples/working-person-v3.2.yaml', 'utf8')),
    readCatalog(readFileSync('data/banks-2026-10-09-v3.2.yaml', 'utf8')),
  );
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toContainText(
    expected.ranked[0].name,
  );
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toContainText('$1,213.92');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Raw JSON' }).click();
  const download = await downloadPromise;
  const actual = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(actual).toEqual(expected);
  await page.getByRole('button', { name: 'Clear scenario' }).click();
  await expect(page.getByRole('heading', { name: 'Your money. A clearer plan.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('editing cash flows recalculates and scenario export round trips', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await page.getByRole('spinbutton', { name: 'Starting savings', exact: true }).fill('35000');
  await page.getByRole('spinbutton', { name: 'Take-home paycheck amount' }).fill('2750');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save scenario' }).click();
  const file = await pending;
  const saved = readScenario(readFileSync((await file.path())!, 'utf8'));
  expect(saved.startingCash).toBe(35000);
  expect(saved.flows[0].amount).toBe(2750);
  await page.getByRole('button', { name: 'Clear scenario' }).click();
  await page.getByLabel('Import scenario file').setInputFiles((await file.path())!);
  await expect(page.getByRole('spinbutton', { name: 'Starting savings', exact: true })).toHaveValue(
    '35000',
  );
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toBeVisible();
});
test('bank selection, unresolved sources, baseline winner and graph export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await page.getByRole('button', { name: /Bank library/ }).click();
  await page.getByRole('button', { name: 'Select all modeled' }).click();
  await page.getByLabel('Search banks').fill('Capital One');
  await page.getByRole('checkbox', { name: /Compare Capital/ }).check();
  await page.getByRole('button', { name: /Compare \d+ accounts/ }).click();
  await expect(page.getByText('1 accounts excluded from ranking')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Your baseline APY', exact: true }).fill('10');
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toContainText(
    'YOUR BASELINE WINS',
  );
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Graph SVG' }).click();
  const file = await pending;
  expect(readFileSync((await file.path())!, 'utf8')).toContain('<svg');
});
test('malformed import is visible and preserves the current scenario', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await page.getByLabel('Import scenario file').setInputFiles({
    name: 'bad.yaml',
    mimeType: 'application/yaml',
    buffer: Buffer.from('schemaVersion: "999"\nstartingCash: nope'),
  });
  await expect(page.getByRole('alert')).toContainText('schemaVersion');
  await expect(page.getByRole('spinbutton', { name: 'Starting savings', exact: true })).toHaveValue(
    '25000',
  );
});
test('scratch plan works and mobile pages do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'outputs/screenshots/mobile-empty.png', fullPage: true });
  await page.getByRole('button', { name: 'Start from scratch' }).click();
  await page.getByRole('spinbutton', { name: 'Starting savings', exact: true }).fill('20000');
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'For AI agents' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your AI brings the context. Butter does the math.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('desktop screenshots and account detail keyboard access', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/');
  await page.screenshot({ path: 'outputs/screenshots/desktop-empty.png', fullPage: true });
  await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toBeVisible();
  await page.screenshot({ path: 'outputs/screenshots/desktop-comparison.png', fullPage: true });
  await page.getByRole('button', { name: 'See the calculation' }).click();
  await expect(page.getByRole('dialog')).toContainText('Rate effective');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Axos research separates account rates and exposes dated discoveries with exact sources', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Bank library/ }).click();
  await page.getByLabel('Search banks').fill('Axos');
  await page
    .getByRole('button', { name: 'Axos ONE · linked savings + checking', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Two accounts, four different rates' }),
  ).toBeVisible();
  await expect(dialog).toContainText('0.51% checking APY and 1.00% fallback savings APY');
  await expect(dialog).toContainText('first $49,999.99');
  await expect(
    dialog.getByRole('link', { name: /Axos ONE Savings: product/ }).first(),
  ).toHaveAttribute('href', 'https://www.axosbank.com/personal/bank/axos-one');
  await dialog.getByLabel('Search bank facts').fill('checking APY');
  await expect(
    dialog.locator('summary').filter({ hasText: 'Qualified checking APY' }),
  ).toContainText('0.51');
  await page.screenshot({ path: 'outputs/screenshots/axos-research.png', fullPage: true });
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download discovery log' }).click();
  const log = JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
  expect(log.researchDate).toBe('2026-10-09');
  expect(log.sources.length).toBeGreaterThan(1);
});

test('large-balance warning, related deposits and dated liquidity comparison update together', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await page.getByRole('spinbutton', { name: 'Starting savings', exact: true }).fill('278000');
  await expect(page.getByText(/Potentially uninsured:/).first()).toBeVisible();
  const decision = page.getByRole('region', { name: 'Liquidity and safety comparison' });
  await decision.getByLabel('Modeled balance date').fill('2027-01-01');
  await decision.getByLabel('Filter decision comparison').selectOption('atm');
  await expect(decision.getByRole('button', { name: /Wealthfront Cash/ })).toBeVisible();
  await expect(decision.getByRole('button', { name: /EverBank Performance/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'See the calculation' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '$500k', exact: true }).click();
  await expect(dialog.getByLabel('Cash for exit stress test')).toHaveValue('500000');
  await expect(dialog).toContainText('Estimated real-world window: Unknown');
});
