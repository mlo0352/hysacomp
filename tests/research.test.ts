import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ProfileSchema, type Profile, type Fact } from '../lib/profile';
import { ScenarioSchema } from '../lib/schema';
import { readCatalog, readScenario, toXml } from '../lib/files';
import {
  exitAnalysis,
  insuranceAnalysis,
  historyAnalysis,
  freshness,
  frictionAnalysis,
} from '../lib/analysis';
import { compare } from '../lib/engine';
import { auditCatalog } from '../lib/audit';

const catalog = readCatalog(readFileSync('data/banks-2026-10-09-v3-r2.yaml', 'utf8'));
const example = readScenario(readFileSync('examples/working-person-v3.yaml', 'utf8'));
const profile = (values: Record<string, Fact['value']> = {}): Profile =>
  ProfileSchema.parse({
    researchedAt: '2026-10-09',
    sources: [
      {
        id: 'fixture',
        type: 'official',
        publisher: 'Synthetic fixture',
        title: 'Synthetic terms',
        url: 'https://example.com/terms',
        section: 'Test fixture only',
        accessedAt: '2026-10-09',
      },
    ],
    facts: Object.fromEntries(
      Object.entries(values).map(([k, value]) => [
        k,
        { value, status: 'verified', confidence: 'high', sourceIds: ['fixture'] },
      ]),
    ),
  });

test('modern XML round trips every bank fact, source, review, conflict and scenario input', () => {
  assert.deepEqual(readCatalog(toXml(catalog)), catalog);
  assert.deepEqual(
    readCatalog(readFileSync('data/banks_verified_2026-10-09_tool-v3.0.0-r2.xml', 'utf8')),
    catalog,
  );
  const s = structuredClone(example);
  s.name = 'A & B <cash> "plan"';
  s.notes.push("Apostrophe: ' and > characters");
  assert.deepEqual(readScenario(toXml(s)), s);
});

test('XML rejects incompatible versions, duplicate fields, hostile markup and metadata mismatch', () => {
  const xml = toXml(example);
  for (const bad of [
    xml.replace('toolVersion="3.0.0"', 'toolVersion="9.0.0"'),
    xml.replace('schemaVersion="3.0"', 'schemaVersion="4.0"'),
    xml.replace(
      '<scenario type="object">',
      '<scenario type="object"><id type="string">duplicate</id>',
    ),
    xml.replace(
      '<startingCash type="number">25000</startingCash>',
      '<startingCash type="number">25000<oops type="number">1</oops></startingCash>',
    ),
    xml.replace('<hysaScenario', '<!DOCTYPE x [<!ENTITY x "oops">]><hysaScenario'),
    xml.replace('dataAsOf="2026-10-09"', 'dataAsOf="2026-10-08"'),
  ])
    assert.throws(() => readScenario(bad));
  assert.throws(
    () =>
      readCatalog(
        toXml(catalog).replace('calculatorModel="flat"', 'calculatorModel="unsupported"'),
      ),
    /metadata/,
  );
});

test('objective facts cannot be verified by review sources, missing references or invented unknown values', () => {
  const p = profile({ outgoingAchDaily: 25000 });
  p.sources[0].type = 'review';
  assert.throws(() => ProfileSchema.parse(p), /first-party/);
  p.sources[0].type = 'official';
  p.facts.outgoingAchDaily.sourceIds = ['missing'];
  assert.throws(() => ProfileSchema.parse(p), /Missing source/);
  p.facts.outgoingAchDaily.status = 'unknown';
  assert.throws(() => ProfileSchema.parse(p), /null value/);
});

test('a sourced calculation contradicting its engine value is rejected on import', () => {
  const bad = structuredClone(catalog);
  const b = bad.banks.find((b) => b.profile?.facts['calculation.apy'])!;
  b.apy = (b.apy ?? 0) + 1;
  assert.throws(() => readCatalog(JSON.stringify(bad)), /sourced calculation claim/);
});

test('calendar monthly ACH caps require waiting across months, separately from processing', () => {
  const p = profile({
    outgoingAchSupported: true,
    outgoingAchDaily: 25000,
    outgoingAchMonthly: 100000,
    achLimitWindow: 'calendar',
    achProcessingMin: 1,
    achProcessingMax: 3,
  });
  const result = exitAnalysis(p, 278000, '2026-10-09');
  assert.equal(result.ach.completionDate, '2026-12-04');
  assert.equal(result.ach.calendarDays, 57);
  assert.ok(result.ach.minimumInitiationDays! > 12);
  assert.equal(result.ach.theoreticalArrivalWindow!.max, result.ach.minimumInitiationDays! + 2);
  assert.equal(result.estimatedRealWorldWindow, null);
});

test('unknown windows and amount limits never become unlimited or guessed schedules', () => {
  const unknown = exitAnalysis(profile(), 278000, '2026-10-09');
  assert.equal(unknown.ach.minimumInitiationDays, null);
  assert.equal(unknown.wire.fullBalanceSupported, false);
  assert.equal(unknown.estimatedRealWorldWindow, null);
  const p = profile({
    outgoingAchDaily: 10000,
    outgoingAchMonthly: 30000,
    outgoingAchWeekly: 10000,
  });
  const r = exitAnalysis(p, 50000, '2026-10-09');
  assert.equal(r.ach.minimumInitiationDays, 5);
  assert.ok(r.ach.reasons.some((s) => s.includes('Monthly cap reset')));
  assert.ok(r.ach.reasons.some((s) => s.includes('Weekly cap reset')));
});

test('transaction count caps and rolling windows constrain initiation', () => {
  const p = profile({
    outgoingAchDaily: 100000,
    outgoingAchPerTransaction: 25000,
    outgoingAchTransactionsDaily: 1,
    outgoingAchWeekly: 50000,
    achWeeklyWindow: 'rolling-7',
  });
  const r = exitAnalysis(p, 75000, '2026-10-09');
  assert.equal(r.minimumTransactions, 3);
  assert.equal(r.ach.completionDate, '2026-10-16');
  const monthly = profile({
    outgoingAchDaily: 100000,
    outgoingAchPerTransaction: 25000,
    outgoingAchTransactionsMonthly: 1,
    achLimitWindow: 'calendar',
  });
  assert.equal(exitAnalysis(monthly, 50000, '2026-10-09').ach.completionDate, '2026-11-02');
});

test('wire capacity, new-account restriction and documented timing remain distinct', () => {
  const p = profile({
    outgoingWireSupported: true,
    wireNoPublishedCap: true,
    wireProcessingMin: 0,
    wireProcessingMax: 1,
    wireRestrictedDays: 90,
    newAccountWireLimit: 25000,
  });
  assert.equal(
    exitAnalysis(p, 278000, '2026-10-09', '2026-10-01').wire.fullBalanceSupported,
    false,
  );
  const r = exitAnalysis(p, 278000, '2027-02-01', '2026-10-01');
  assert.equal(r.wire.fullBalanceSupported, true);
  assert.deepEqual(r.wire.theoreticalArrivalWindow, { min: 0, max: 1 });
  const noDaily = profile({ outgoingWireSupported: true, outgoingWirePerTransaction: 500000 });
  assert.equal(exitAnalysis(noDaily, 278000, '2026-10-09').wire.fullBalanceSupported, false);
});

test('insurance aggregates brands, accrual and eligible ownership, without treating sweep ceiling as coverage', () => {
  const p = profile({
    accountStructure: 'direct-bank-deposit',
    fdicInsured: true,
    fdicAggregationGroup: 'same-bank',
  });
  const a = {
    ownership: 'single' as const,
    jointOwners: 2,
    otherDeposits: [{ aggregationGroup: 'same-bank', amount: 50000, label: 'Other brand' }],
  };
  assert.equal(insuranceAnalysis(p, 280000, a).insured, 200000);
  assert.equal(insuranceAnalysis(p, 280000, a).potentiallyUninsured, 80000);
  assert.equal(insuranceAnalysis(p, 280000, { ...a, ownership: 'joint' }).potentiallyUninsured, 0);
  assert.equal(insuranceAnalysis(p, 280000, { ...a, ownership: 'other' }).insured, null);
  assert.equal(
    insuranceAnalysis(
      profile({ accountStructure: 'brokerage-sweep', advertisedInsuranceMaximum: 8000000 }),
      280000,
      a,
    ).insured,
    null,
  );
});

test('sparse history never fills gaps; documented intervals support time averages without mixing series', () => {
  const p = profile();
  p.rateHistory = [
    {
      date: '2025-10-09',
      apy: 4,
      product: 'Test',
      tier: 'All',
      series: 'regular',
      sourceIds: ['fixture'],
      confidence: 'high',
    },
  ];
  assert.equal(historyAnalysis(p, '2026-10-09').twelveMonth.average, null);
  p.rateHistory[0].validThrough = '2026-10-09';
  assert.equal(historyAnalysis(p, '2026-10-09').twelveMonth.average, 4);
  p.rateHistory.push({
    date: '2026-10-09',
    apy: 8,
    product: 'Test',
    tier: 'Promo',
    series: 'intro',
    sourceIds: ['fixture'],
    confidence: 'high',
  });
  assert.equal(historyAnalysis(p, '2026-10-09').observed.maximum, 4);
  assert.equal(historyAnalysis(p, '2026-10-09', 'intro').observed.maximum, 8);
  p.rateHistory.push({ ...p.rateHistory[0], date: '2026-10-09', apy: 3 });
  assert.equal(historyAnalysis(p, '2026-10-09').twelveMonth.average, null);
});

test('freshness boundaries use evaluation date and unknown friction is never a zero score', () => {
  for (const [day, label] of [
    ['2026-10-16', 'Fresh'],
    ['2026-10-17', 'Recent'],
    ['2026-11-09', 'Aging'],
    ['2027-01-08', 'Stale'],
    ['2026-10-08', 'Future-dated'],
  ])
    assert.equal(freshness('2026-10-09', day).label, label);
  assert.equal(frictionAnalysis(profile()).score, null);
});

test('large cash regression: Jan 1 deposit, varying withdrawals, peak FDIC and low outbound cap', () => {
  const s = ScenarioSchema.parse({
    ...example,
    id: 'synthetic-large-cash',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    focusYear: 2027,
    startingCash: 145000,
    taxRate: 0,
    bankIds: ['everbank', 'openbank', 'wealthfront'],
    eligiblePromotionIds: [],
    transfer: { businessDays: 0, fee: 0, holdDays: 0 },
    events: [
      { date: '2027-01-01', amount: 132900, label: 'Synthetic one-off', qualification: 'none' },
    ],
    flows: [
      {
        id: 'jan',
        label: 'January spending',
        amount: 4000,
        direction: 'out',
        cadence: 'monthly',
        dayOfMonth: 15,
        startDate: '2027-01-01',
        endDate: '2027-01-31',
      },
      {
        id: 'feb',
        label: 'February spending',
        amount: 5000,
        direction: 'out',
        cadence: 'monthly',
        dayOfMonth: 15,
        startDate: '2027-02-01',
        endDate: '2027-02-28',
      },
      {
        id: 'later',
        label: 'Later spending',
        amount: 1000,
        direction: 'out',
        cadence: 'monthly',
        dayOfMonth: 15,
        startDate: '2027-03-01',
        endDate: '2027-12-31',
      },
    ],
  });
  const c = compare(s, catalog, { asOf: '2027-02-01' }),
    r = c.ranked.find((r) => r.bankId === 'everbank')!;
  assert.ok(Math.abs(r.endingBalance - (145000 + 132900 - 19000 + r.interest)) < 0.02);
  assert.equal(r.focusYearInterest, r.interest);
  assert.ok(c.decisions.everbank.peakInsurance.potentiallyUninsured! > 27900);
  assert.ok(c.decisions.everbank.exit.ach.minimumInitiationDays! > 20);
  assert.equal(c.decisions.everbank.freshness.label, 'Stale');
  assert.equal(c.decisions.wealthfront.insurance.insured, null);
  assert.ok(c.decisions.wealthfront.warnings.some((w) => w.includes('Headline APY')));
});

test('Axos facts and discoveries distinguish checking, qualified savings, fallback and intro cap', () => {
  const b = catalog.banks.find((b) => b.id === 'axos_one')!;
  assert.equal(b.model, 'unsupported');
  assert.equal(b.profile!.facts.checkingApy.value, 0.51);
  assert.equal(b.profile!.facts.baseApy.value, 1);
  assert.equal(b.profile!.facts.qualifiedApy.value, 4.21);
  assert.equal(b.profile!.facts.headlineBalanceCap.value, 49999.99);
  assert.ok(catalog.banks.every((b) => b.profile!.discoveries.length > 0));
  assert.equal(catalog.banks.find(b=>b.id==='everbank')!.profile!.facts.outgoingAchTransactionsDaily.unit,'transactions');
  assert.ok(
    auditCatalog(catalog, '2026-10-09').banks.every((b) => b.calculationMismatches.length === 0),
  );
});

test('linked qualification references preserve cash once and invalid references are rejected', () => {
  const s = structuredClone(example);
  s.bankIds = ['axos_one'];
  s.eligiblePromotionIds = [];
  s.linkedAccounts = [
    {
      bankId: 'axos_one',
      accountType: 'checking',
      reservedBalance: 1500,
      averageDailyBalance: 1500,
      qualifyingFlowIds: [s.flows[0].id],
      newCustomer: 'unknown',
      referralEligible: 'unknown',
      notes: 'Fixture only',
    },
  ];
  assert.deepEqual(readScenario(toXml(s)), s);
  assert.equal(compare(s, catalog).ranked.length, 0);
  s.linkedAccounts[0].qualifyingFlowIds = ['missing'];
  assert.throws(() => ScenarioSchema.parse(s), /existing cash flows/);
});
