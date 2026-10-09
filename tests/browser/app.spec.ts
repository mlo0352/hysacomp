import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { compare } from '../../lib/engine';
import { readScenario, readCatalog } from '../../lib/files';

test('fresh state is empty; demo shows the same winner and dollars as the CLI engine', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your money. A clearer plan.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toHaveCount(0);
  await expect(page.getByText('Oct 9, 2026', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try the working-person example' }).click();
  const expected = compare(readScenario(readFileSync('examples/working-person.yaml', 'utf8')), readCatalog(readFileSync('data/banks-2026-10-09.yaml', 'utf8')));
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toContainText(expected.ranked[0].name);
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toContainText('$1,213.92');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Raw JSON' }).click();
  const download = await downloadPromise; const actual = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(actual).toEqual(expected);
  await page.getByRole('button', { name: 'Clear scenario' }).click();
  await expect(page.getByRole('heading', { name: 'Your money. A clearer plan.' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('region', { name: 'Comparison winner' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('editing cash flows recalculates and scenario export round trips', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await page.getByRole('spinbutton', { name: 'Starting savings', exact: true }).fill('35000');
  await page.getByRole('spinbutton', { name: 'Take-home paycheck amount' }).fill('2750');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save scenario' }).click();
  const file = await pending;
  const saved = readScenario(readFileSync((await file.path())!, 'utf8'));
  expect(saved.startingCash).toBe(35000); expect(saved.flows[0].amount).toBe(2750);
  await page.getByRole('button', { name: 'Clear scenario' }).click();
  await page.getByLabel('Import scenario file').setInputFiles((await file.path())!);
  await expect(page.getByRole('spinbutton', { name: 'Starting savings', exact: true })).toHaveValue('35000');
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toBeVisible();
});
test('bank selection, unresolved sources, baseline winner and graph export', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await page.getByRole('button', { name: /Bank library/ }).click();
  await page.getByRole('button', { name: 'Select all modeled' }).click();
  await page.getByLabel('Search banks').fill('Capital One');
  await page.getByRole('checkbox', { name: /Compare Capital/ }).check();
  await page.getByRole('button', { name: /Compare \d+ accounts/ }).click();
  await expect(page.getByText('1 accounts excluded from ranking')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Your baseline APY', exact: true }).fill('10');
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toContainText('YOUR BASELINE WINS');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Graph SVG' }).click();
  const file = await pending; expect(readFileSync((await file.path())!, 'utf8')).toContain('<svg');
});
test('malformed import is visible and preserves the current scenario', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await page.getByLabel('Import scenario file').setInputFiles({ name: 'bad.yaml', mimeType: 'application/yaml', buffer: Buffer.from('schemaVersion: "999"\nstartingCash: nope') });
  await expect(page.getByRole('alert')).toContainText('schemaVersion');
  await expect(page.getByRole('spinbutton', { name: 'Starting savings', exact: true })).toHaveValue('25000');
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
  await expect(page.getByRole('heading', { name: 'Your AI brings the context. Butter does the math.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('desktop screenshots and account detail keyboard access', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/'); await page.screenshot({ path: 'outputs/screenshots/desktop-empty.png', fullPage: true });
  await page.getByRole('button', { name: 'Try the working-person example' }).click();
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toBeVisible();
  await page.screenshot({ path: 'outputs/screenshots/desktop-comparison.png', fullPage: true });
  await page.getByRole('button', { name: 'See the calculation' }).click();
  await expect(page.getByRole('dialog')).toContainText('Rate effective');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});
