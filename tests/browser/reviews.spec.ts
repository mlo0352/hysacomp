import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('reviews expose both sentiments, exact source links, dates, context and matching JSON without a scenario', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Reviews', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Read the experiences.' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(9);
  await expect(page.getByRole('region', { name: 'About customer reviews' })).toContainText(
    'not a representative survey',
  );
  await page.getByLabel('Review bank').selectOption('peak');
  await expect(page.getByRole('article')).toHaveCount(7);
  const complaint = page.getByRole('article', { name: /MissionHairy2041/ });
  await expect(complaint).toContainText('Posting date uncertain');
  await expect(complaint.getByRole('link', { name: 'Read original comment' })).toHaveAttribute(
    'href',
    /\/comment\/ob4yk20\//,
  );
  await complaint.locator('summary').click();
  await expect(complaint).toContainText('unverified report, not a modeled limit');
  await expect(complaint.getByRole('button', { name: /Record your check/ })).toBeVisible();
  await complaint.getByRole('button', { name: /Record your check/ }).click();
  const form = complaint.locator('form');
  await form.getByLabel('Verdict').selectOption('needs-check');
  await form.getByLabel('Evidence URL').fill('https://www.peak.bank/peak-bank/faq');
  await form.getByLabel('Source title').fill('Peak FAQ');
  await form.getByLabel('Section / reference').fill('Outgoing transfers');
  await form
    .getByLabel('What did you find?')
    .fill('Reported daily cap still needs account-specific confirmation.');
  await form.getByRole('button', { name: 'Save personal check' }).click();
  await expect(complaint).toContainText('Your check: needs-check');
  await page.getByLabel('Review sentiment').selectOption('positive');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Works consistently and fast.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export matching reviews' }).click();
  const report = JSON.parse(readFileSync((await (await download).path())!, 'utf8'));
  expect(report.matchingComments).toBe(1);
  expect(report.coverage.total).toBe(1);
  expect(report.collectionCoverage.total).toBe(9);
  expect(report.banks[0].reviews).toHaveLength(1);
  expect(report.banks[0].reviews[0].author).toBe('May');
  await page.getByLabel('Review sentiment').selectOption('mixed');
  await expect(page.getByRole('article')).toContainText('same-day replies');
  await page.getByLabel('Review bank').selectOption('axos_one');
  await expect(
    page.getByText('No individual comments saved for this selection yet.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear review filters' }).click();
  await page.getByLabel('Review platform').selectOption('reddit');
  await page.getByLabel('Review topic').selectOption('access');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByLabel('Search reviews').fill('franfromfrance');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('callback they missed');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'outputs/screenshots/reviews-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Search reviews').fill('');
  await page.screenshot({ path: 'outputs/screenshots/reviews-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
