import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readCatalog } from '../../lib/files';
import { readVerifications } from '../../lib/verification';

test('feature comparison exposes sources, conditions and secondary conflicts without a scenario', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const disclaimer = page.getByRole('dialog', { name: 'Research disclaimer' });
  await expect(disclaimer).not.toBeVisible();
  await page.getByRole('button', { name: 'Disclaimer', exact: true }).click();
  await expect(disclaimer).toContainText('incomplete, outdated or incorrect');
  await page.keyboard.press('Escape');
  await expect(disclaimer).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Disclaimer', exact: true })).toBeFocused();
  const snapshot = page.getByText('Bank data checked', { exact: false }).first();
  await expect(snapshot).not.toContainText(/modeled|reviewed|days old|Fresh/);
  await page.getByRole('button', { name: /Bank library/ }).click();
  const comparison = page.getByRole('region', { name: 'Bank feature comparison' });
  const row = comparison.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: 'Send international wires', exact: true }),
  });
  await expect(row).toContainText('Unavailable');
  const layout = await row
    .locator('td')
    .first()
    .locator('summary')
    .evaluate((el) => {
      const summary = el.getBoundingClientRect();
      const badge = el.querySelector('span:last-of-type')!.getBoundingClientRect();
      return {
        offset: Math.abs((badge.left + badge.right) / 2 - (summary.left + summary.right) / 2),
        after: getComputedStyle(el, '::after').content,
        align: getComputedStyle(el, '::after').justifySelf,
        before: getComputedStyle(el, '::before').content,
      };
    });
  expect(layout.offset).toBeLessThan(2);
  expect(layout.after).toBe('"+"');
  expect(layout.align).toBe('end');
  expect(layout.before).toBe('none');
  await row.locator('td').first().locator('summary').click();
  await expect(row).toContainText('Secondary claim · contradicted');
  await expect(row.getByRole('link', { name: /Ally.*Bank transfer help/ })).toHaveAttribute(
    'href',
    'https://www.ally.com/help/bank/transfers/',
  );
  await comparison.getByLabel('Feature category').selectOption('Saving & planning');
  const rounds = comparison
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Purchase round-ups' }) });
  await rounds.locator('td').first().locator('summary').click();
  await expect(rounds).toContainText('Conditions apply');
  await expect(rounds).toContainText('linked-product');
  const pending = page.waitForEvent('download');
  await comparison.getByRole('button', { name: 'Export features & research queue' }).click();
  const report = JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
  expect(report.banks).toHaveLength(25);
  expect(report.banks.find((b: any) => b.id === 'ally').researchQueue.length).toBeGreaterThan(0);
  await page.screenshot({ path: 'outputs/screenshots/features-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('personal verification can be saved, exported, imported, and flagged when its evidence changes', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Bank library/ }).click();
  const row = page.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: 'Send international wires', exact: true }),
  });
  const cell = row.locator('td').first();
  await cell.locator('summary').click();
  await cell
    .getByRole('button', {
      name: /Record your check: Ally.*Send international wires$/,
      exact: false,
    })
    .click();
  const form = cell.locator('form');
  await form.getByLabel('Verdict').selectOption('confirmed');
  await form.getByLabel('Evidence URL').fill('https://www.ally.com/help/bank/transfers/');
  await form.getByLabel('Source title').fill('Ally transfer FAQ');
  await form.getByLabel('Section / reference').fill('International wires');
  await form
    .getByLabel('What did you find?')
    .fill('Confirmed no outgoing international wire service.');
  await form.getByRole('button', { name: 'Save personal check' }).click();
  await expect(cell).toContainText('Your check: confirmed');
  const notebook = page
    .locator('details')
    .filter({ has: page.locator('summary').filter({ hasText: 'Your verification notebook' }) });
  await notebook.locator('summary').click();
  const pending = page.waitForEvent('download');
  await notebook.getByRole('button', { name: 'Export personal checks' }).click();
  const downloaded = readFileSync((await (await pending).path())!, 'utf8');
  const checks = readVerifications(downloaded);
  expect(checks.entries).toHaveLength(1);
  expect(checks.entries[0].outcome).toBe('confirmed');
  await page.reload();
  await page.getByRole('button', { name: /Bank library/ }).click();
  await expect(notebook.locator('summary')).toContainText('0 checks');
  await notebook.locator('summary').click();
  await page.getByLabel('Import verification notebook').setInputFiles({
    name: 'checks.local.json',
    mimeType: 'application/json',
    buffer: Buffer.from(downloaded),
  });
  await expect(notebook).toContainText('current-evidence');
  const catalog = readCatalog(readFileSync('data/banks-2026-10-09-v3.2-r2.yaml', 'utf8'));
  catalog.banks.find((b) => b.id === 'ally')!.profile!.features[0].conditions +=
    ' Updated condition.';
  // An imported profile may have feature evidence without every optional atomic fact.
  delete catalog.banks.find((b) => b.id === 'openbank')!.profile!.facts.promotionalApy;
  await page.getByLabel('Import bank file').setInputFiles({
    name: 'banks.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(catalog)),
  });
  await expect(notebook).toContainText('changed-evidence');
  await expect(page.getByRole('region', { name: 'Comparison winner' })).toHaveCount(0);
});
