import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compare } from '../lib/engine';
import { readScenario, readCatalog } from '../lib/files';

const run = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'cli.ts', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const files = ['--scenario', 'examples/working-person.yaml', '--banks', 'data/banks-2026-10-09.yaml'];
test('CLI stdout is clean JSON and matches the shared browser engine', () => {
  const out = run('compare', ...files); assert.equal(out.status, 0, out.stderr);
  const result = JSON.parse(out.stdout);
  const expected = compare(readScenario(readFileSync(files[1], 'utf8')), readCatalog(readFileSync(files[3], 'utf8')));
  const { provenance, ...actual } = result;
  assert.deepEqual(actual, expected); assert.match(provenance.banksSha256, /^[a-f0-9]{64}$/);
});
test('CLI exports CSV and a standalone SVG with deterministic output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'butter-test-'));
  const csv = join(dir, 'nested', 'result.csv'), svg = join(dir, 'graph.svg');
  const out = run('compare', ...files, '--format', 'csv', '--output', csv, '--graph', svg);
  assert.equal(out.status, 0, out.stderr); assert.equal(out.stdout, '');
  assert.ok(readFileSync(csv, 'utf8').startsWith('rank,bankId')); assert.ok(readFileSync(svg, 'utf8').startsWith('<svg'));
});
test('invalid inputs, unknown arguments, formats, and unsafe output targets fail clearly', () => {
  for (const args of [['--unknown'], ['compare'], ['compare', ...files, '--format', 'html'], ['compare', ...files, '--graph', 'plot.png'], ['compare', ...files, '--output', files[1]]]) {
    const out = run(...args); assert.equal(out.status, 2); assert.equal(JSON.parse(out.stderr).error, 'invalid_input'); assert.equal(out.stdout, '');
  }
});
test('no eligible banks returns an inspectable report and exit 3', () => {
  const dir = mkdtempSync(join(tmpdir(), 'butter-test-'));
  const s = readScenario(readFileSync(files[1], 'utf8')); s.bankIds = ['capitalone']; s.eligiblePromotionIds = [];
  const path = join(dir, 'scenario.json'); writeFileSync(path, JSON.stringify(s));
  const out = run('compare', '--scenario', path, '--banks', files[3]);
  assert.equal(out.status, 3); assert.equal(JSON.parse(out.stdout).excluded.length, 1);
});
