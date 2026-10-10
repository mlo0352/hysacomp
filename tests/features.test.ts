import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readCatalog, readScenario, toXml, toYaml } from '../lib/files';
import { CatalogSchema } from '../lib/schema';
import { featureFor, featureReport, evidenceSnapshot } from '../lib/features';
import {
  VerificationFileSchema,
  VerificationSchema,
  readVerifications,
  verificationState,
} from '../lib/verification';
import { compare } from '../lib/engine';

const catalog = readCatalog(readFileSync('data/banks-2026-10-09-v3.2-r2.yaml', 'utf8'));
const bank = (id: string) => catalog.banks.find((b) => b.id === id)!;
test('feature evidence distinguishes product availability from linked checking and secondary assertions', () => {
  const wire = featureFor(bank('ally'), 'internationalWireOut');
  assert.equal(wire.availability, 'unavailable');
  assert.equal(wire.claims[0].assessment, 'contradicted');
  const roundUps = featureFor(bank('ally'), 'roundUps');
  assert.equal(roundUps.availability, 'conditional');
  assert.equal(roundUps.scope, 'linked-product');
  assert.equal(featureFor(bank('openbank'), 'outgoingWireSupported').availability, 'unavailable');
  assert.equal(featureFor(bank('axos_one'), 'debitCard').scope, 'linked-product');
  assert.equal(featureFor(bank('ally'), 'wiseIntegration').availability, 'unknown');
  assert.equal(featureFor(bank('axos_one'), 'liveChat').availability, 'unknown');
});
test('schema rejects secondary-only verification, orphan sources and conditions without explanations', () => {
  for (const mutate of [
    (c: typeof catalog) => {
      c.banks.find((b) => b.id === 'ally')!.profile!.features[0].sourceIds = [
        'feature-banktruth-ally',
      ];
    },
    (c: typeof catalog) => {
      c.banks.find((b) => b.id === 'ally')!.profile!.features[0].claims[0].sourceIds = [
        'missing-source',
      ];
    },
    (c: typeof catalog) => {
      const f = c.banks.find((b) => b.id === 'ally')!.profile!.features[0];
      f.availability = 'conditional';
      f.conditions = '';
    },
  ]) {
    const c = structuredClone(catalog);
    mutate(c);
    assert.throws(() => CatalogSchema.parse(c));
  }
});
test('every bank has the complete checklist with explicit unknowns and an actionable research queue', () => {
  const report = featureReport(catalog);
  assert.equal(Object.keys(report.categories).length, 9);
  assert.equal(report.banks.length, 25);
  for (const b of report.banks) {
    assert.equal(b.features.length, report.banks[0].features.length);
    assert.ok(b.coverage.unknown > 0);
    assert.ok(b.researchQueue.length > 0);
  }
  assert.ok(
    report.banks.find((b) => b.id === 'ally')!.researchQueue.some((q) => q.priority === 'conflict'),
  );
});
test('old schema imports preserve numerical comparisons and explicit feature evidence survives XML/YAML', () => {
  const old = readCatalog(readFileSync('data/banks-2026-10-09-v3-r2.yaml', 'utf8'));
  assert.equal(old.schemaVersion, '3.2');
  assert.match(old.policy, /3.0-to-3.2/);
  const oldXml = readCatalog(
    readFileSync('data/banks_verified_2026-10-09_tool-v3.0.0-r2.xml', 'utf8'),
  );
  assert.deepEqual(old, oldXml);
  assert.deepEqual(readCatalog(toXml(catalog)), catalog);
  assert.deepEqual(readCatalog(toYaml(catalog)), catalog);
  const s = readScenario(readFileSync('examples/working-person-v3.yaml', 'utf8'));
  const before = compare(s, old, { asOf: '2026-10-09' }),
    after = compare(s, catalog, { asOf: '2026-10-09' });
  assert.deepEqual(before.ranked, after.ranked);
  assert.deepEqual(before.winnerIds, after.winnerIds);
});
test('personal checks round-trip, bind to sources and claims, and never modify official evidence', () => {
  const ally = bank('ally'),
    original = structuredClone(catalog);
  const entry = VerificationSchema.parse({
    id: 'personal-test',
    bankId: ally.id,
    target: 'feature:internationalWireOut',
    evidenceSnapshot: evidenceSnapshot(ally, 'feature:internationalWireOut'),
    checkedOn: '2026-10-09',
    outcome: 'confirmed',
    sourceUrl: 'https://www.ally.com/help/bank/transfers/',
    sourceTitle: 'Transfer FAQ',
    section: 'International wires',
    productScope: ally.name,
    notes: 'Checked sending direction and the product.',
  });
  const file = VerificationFileSchema.parse({
    schemaVersion: '1.0',
    kind: 'butter-personal-verifications',
    entries: [entry],
  });
  assert.deepEqual(readVerifications(JSON.stringify(file)), file);
  assert.equal(verificationState(entry, catalog), 'current-evidence');
  const changed = structuredClone(catalog);
  changed.banks.find((b) => b.id === 'ally')!.profile!.features[0].conditions += ' New limitation.';
  assert.equal(verificationState(entry, changed), 'changed-evidence');
  const sourceChanged = structuredClone(catalog);
  sourceChanged.banks
    .find((b) => b.id === 'ally')!
    .profile!.sources.find((s) => s.id === 'feature-ally-transfers')!.section = 'Revised terms';
  assert.equal(verificationState(entry, sourceChanged), 'changed-evidence');
  assert.equal(verificationState({ ...entry, bankId: 'absent' }, catalog), 'missing-bank');
  assert.equal(verificationState({ ...entry, checkedOn: '2099-01-01' }, catalog), 'future-date');
  assert.equal(verificationState({ ...entry, target: 'fact:invented' }, catalog), 'missing-target');
  assert.throws(() => VerificationSchema.parse({ ...entry, sourceUrl: 'javascript:alert(1)' }));
  assert.deepEqual(catalog, original);
});
