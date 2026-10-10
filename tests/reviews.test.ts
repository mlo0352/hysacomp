import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readCatalog, readScenario, toXml, toYaml } from '../lib/files';
import { CatalogSchema } from '../lib/schema';
import { CustomerReviewSchema, reviewIdentity } from '../lib/review-model';
import { reviewCounts, reviewReport } from '../lib/reviews';
import { evidenceSnapshot } from '../lib/features';
import { compare } from '../lib/engine';

const path = 'data/banks-2026-10-09-v3.2.yaml';
const catalog = readCatalog(readFileSync(path, 'utf8'));
const peak = catalog.banks.find((b) => b.id === 'peak')!;
const sample = peak.profile!.customerReviews[0];
test('individual reports preserve attribution, context, unknown dates and full XML/YAML evidence', () => {
  const report = reviewReport(catalog);
  assert.equal(report.coverage.total, 9);
  assert.equal(report.coverage.productsWithComments, 2);
  assert.deepEqual(report.coverage.sentiments, { positive: 2, mixed: 2, negative: 5, neutral: 0 });
  assert.equal(sample.publishedOn, null);
  assert.match(sample.dateText, /exact posting date not captured/);
  assert.equal(peak.profile!.facts.outgoingAchDaily.status, 'unknown');
  assert.equal(peak.profile!.facts.outgoingAchDaily.value, null);
  assert.equal(peak.profile!.customerReviews.find((r) => r.author === 'May')!.rating, 5);
  assert.deepEqual(readCatalog(toXml(catalog)), catalog);
  assert.deepEqual(readCatalog(toYaml(catalog)), catalog);
});
test('comments reject fabricated verification, vote ratings, thread-only Reddit links and impossible dates', () => {
  for (const change of [
    { status: 'verified' },
    { permalink: 'not-a-url' },
    { rating: 12 },
    { rating: 1 },
    { permalink: sample.threadUrl },
    { publishedOn: '2026-02-30' },
    { publishedOn: '2026-10-10' },
    { experienceOn: '2026-10-10' },
    { officialContext: { assessment: 'related-policy', notes: 'Policy', sourceIds: [] } },
  ]) {
    assert.equal(
      CustomerReviewSchema.safeParse({ ...sample, ...change }).success,
      false,
      JSON.stringify(change),
    );
  }
});
test('profiles reject duplicate permalinks, missing sources and community evidence posed as official policy', () => {
  for (const mutate of [
    (c: typeof catalog) =>
      c.banks
        .find((b) => b.id === 'peak')!
        .profile!.customerReviews.push({
          ...sample,
          id: 'copy',
          permalink: sample.permalink + '?utm_source=test',
        }),
    (c: typeof catalog) => {
      c.banks.find((b) => b.id === 'peak')!.profile!.customerReviews[0].sourceIds = ['absent'];
    },
    (c: typeof catalog) => {
      c.banks.find((b) => b.id === 'peak')!.profile!.customerReviews[0].officialContext.sourceIds =
        [sample.id];
    },
    (c: typeof catalog) => {
      c.banks.find((b) => b.id === 'peak')!.profile!.customerReviews[0].accessedAt = '2026-10-10';
    },
  ]) {
    const copy = structuredClone(catalog);
    mutate(copy);
    assert.equal(CatalogSchema.safeParse(copy).success, false);
  }
  assert.equal(
    reviewIdentity(sample.permalink),
    reviewIdentity(
      'https://old.reddit.com/r/SavingMoney/comments/1iguc0v/looking_for_a_hysa_possibly_peakbank/ob4yk20/?context=3',
    ),
  );
  assert.notEqual(
    reviewIdentity('https://www.yelp.com/biz/example?hrid=one'),
    reviewIdentity('https://www.yelp.com/biz/example?hrid=two'),
  );
});
test('multiple comments by one handle remain one public author and never imply independent customers', () => {
  const counts = reviewCounts([sample, { ...sample, id: 'followup' }]);
  assert.equal(counts.total, 2);
  assert.equal(counts.distinctPublicAuthors, 1);
  assert.equal(counts.conversations, 1);
  assert.equal(counts.topics[0].distinctPublicAuthors, 1);
  assert.equal(reviewCounts([{ ...sample, author: null }]).distinctPublicAuthors, 0);
});
test('source checks bind to individual review and official context without altering earnings', () => {
  const before = evidenceSnapshot(peak, `customer-review:${sample.id}`);
  const changed = structuredClone(peak);
  changed.profile!.sources.find((s) => s.id === 'faq')!.section += ' revised';
  assert.notEqual(evidenceSnapshot(changed, `customer-review:${sample.id}`), before);
  const without = structuredClone(catalog);
  without.banks.forEach((b) => {
    if (b.profile) b.profile.customerReviews = [];
  });
  const scenario = readScenario(readFileSync('examples/working-person-v3.2.yaml', 'utf8'));
  const summarize = (c: typeof catalog) => {
    const r = compare(scenario, c, { asOf: '2026-10-09' });
    return { winner: r.winnerIds, baseline: r.baseline, ranked: r.ranked };
  };
  assert.deepEqual(summarize(catalog), summarize(without));
  assert.deepEqual(
    summarize(catalog),
    summarize(readCatalog(readFileSync('data/banks-2026-10-09-v3.1.yaml', 'utf8'))),
  );
});
test('3.1 imports explicitly migrate, preserve financial dates and start without invented comments', () => {
  for (const file of [
    'data/banks-2026-10-09-v3.1.yaml',
    'data/banks_verified_2026-10-09_tool-v3.1.0.xml',
  ]) {
    const old = readCatalog(readFileSync(file, 'utf8'));
    assert.equal(old.schemaVersion, '3.2');
    assert.match(old.policy, /3.1-to-3.2/);
    assert.equal(old.checkedOn, '2026-10-09');
    assert.ok(old.banks.every((b) => b.profile!.customerReviews.length === 0));
  }
});
test('reviews CLI needs only bank file and emits the same raw sourced report', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'cli.ts', 'reviews', '--banks', path],
    { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), reviewReport(catalog));
});
