import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { chromium } from '@playwright/test';
import { readCatalog, readScenario } from '../../lib/files';
import { compare } from '../../lib/engine';

test('release ZIP contains self-contained public artifacts with matching checksums', () => {
  const files = unzipSync(readFileSync('dist/downloads/butter-v3.0.0-offline.zip'));
  const hashes = JSON.parse(new TextDecoder().decode(files['SHA256SUMS.json']));
  for (const [path, hash] of Object.entries(hashes))
    assert.equal(createHash('sha256').update(files[path]).digest('hex'), hash, path);
  for (const path of [
    'README.md',
    'CHANGELOG.md',
    'schemas/fact-inventory.json',
    'docs/XML_GUIDE_v3.0.0_2026-10-09.md',
    'docs/LLM_PROMPTS_v3.0.0_2026-10-09.md',
    'docs/BANK_DISCOVERIES_v3.0.0_2026-10-09.md',
    'examples/scenario_example_2026-10-09_tool-v3.0.0.xml',
    'data/banks_verified_2026-10-09_tool-v3.0.0.xml',
  ])
    assert.ok(files[path], path);
  assert.ok(
    Object.keys(files).every(
      (path) =>
        !path.includes('.local.') &&
        !path.includes('scenario_ian') &&
        !path.includes('node_modules'),
    ),
  );
  const html = new TextDecoder().decode(files['hysa_comparator_v3.0.0_2026-10-09.html']);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=|<link\b[^>]*\brel="stylesheet"/);
});

test('standalone file works with networking disabled, imports XML and matches the CLI engine', async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ offline: true, acceptDownloads: true });
    const page = await context.newPage(),
      errors: string[] = [],
      network: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (/^https?:/.test(r.url())) network.push(r.url());
    });
    await page.goto(
      pathToFileURL(resolve('dist/downloads/hysa_comparator_v3.0.0_2026-10-09.html')).href,
    );
    assert.equal(await page.getByRole('region', { name: 'Comparison winner' }).count(), 0);
    await page.getByRole('button', { name: 'Try the working-person example' }).click();
    await page.getByRole('region', { name: 'Comparison winner' }).waitFor();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Raw JSON' }).click();
    const download = await pending;
    const report = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    const s = readScenario(readFileSync('examples/working-person-v3.yaml', 'utf8'));
    const c = readCatalog(readFileSync('data/banks-2026-10-09-v3.yaml', 'utf8'));
    assert.deepEqual(report, compare(s, c));
    await page.getByRole('button', { name: 'Clear scenario' }).click();
    await page
      .getByLabel('Import scenario file')
      .setInputFiles('examples/scenario_example_2026-10-09_tool-v3.0.0.xml');
    await page.getByRole('region', { name: 'Comparison winner' }).waitFor();
    await page
      .getByLabel('Import bank file')
      .setInputFiles('data/banks_verified_2026-10-09_tool-v3.0.0.xml');
    await page.getByRole('status').filter({ hasText: 'Loaded banks_verified' }).waitFor();
    const pendingXml = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save XML', exact: true }).click();
    assert.deepEqual(readScenario(readFileSync((await (await pendingXml).path())!, 'utf8')), s);
    await page.getByRole('button', { name: 'For AI agents' }).click();
    const promptDownload = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Five agent prompts' }).click();
    assert.match(readFileSync((await (await promptDownload).path())!, 'utf8'), /EVERY atomic fact/);
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
  } finally {
    await browser.close();
  }
});
