import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addDays,
  addMonths,
  businessArrival,
  compare,
  dailyInterest,
  dailyRate,
  expandCashFlows,
} from '../lib/engine';
import { BankSchema, CatalogSchema, ScenarioSchema, type Bank, type Scenario } from '../lib/schema';
import { readCatalog, readScenario, toYaml } from '../lib/files';
import { toCsv, toSvg } from '../lib/export';

const bank = (changes: Partial<Bank> = {}) =>
  BankSchema.parse({
    id: 'test',
    name: 'Test HYSA',
    institution: 'Test',
    checkedOn: '2026-01-01',
    rateAsOf: '2026-01-01',
    verification: 'verified',
    sourceUrl: 'https://example.com',
    evidence: 'Synthetic test fixture.',
    model: 'flat',
    apy: 5,
    openingMinimum: 0,
    monthlyFee: 0,
    ...changes,
  });
const scenario = (changes: Partial<Scenario> = {}) =>
  ScenarioSchema.parse({
    schemaVersion: '2.0',
    id: 'test-plan',
    name: 'Test plan',
    createdAt: '2026-01-01',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    startingCash: 10000,
    taxRate: 0,
    baseline: { name: 'Baseline', apy: 3 },
    bankIds: ['test'],
    eligiblePromotionIds: [],
    transfer: { businessDays: 0, fee: 0, holdDays: 0 },
    flows: [],
    ...changes,
  });
const catalog = (...banks: Bank[]) =>
  CatalogSchema.parse({
    schemaVersion: '2.0',
    id: 'fixture',
    checkedOn: '2026-01-01',
    currency: 'USD',
    policy: 'Test fixture.',
    banks: banks.length ? banks : [bank()],
  });

test('365 daily APY accruals yield exactly the annual percentage yield', () => {
  const r = compare(scenario(), catalog()).ranked[0];
  assert.equal(r.interest, 500);
  assert.equal(r.endingBalance, 10500);
  assert.equal(r.incrementalGain, 200);
});
test('whole-balance tiers and marginal tiers have different economics', () => {
  const tiers = [
    { from: 0, apy: 5 },
    { from: 5000, apy: 1 },
  ];
  assert.equal(dailyInterest(bank({ model: 'whole-balance', tiers }), 10000), 10000 * dailyRate(1));
  assert.equal(
    dailyInterest(bank({ model: 'marginal', tiers }), 10000),
    5000 * dailyRate(5) + 5000 * dailyRate(1),
  );
});
test('monthly deposits use actual day and preserve a partial starting month', () => {
  const s = scenario({
    startDate: '2026-01-10',
    endDate: '2026-02-20',
    flows: [
      {
        id: 'pay',
        label: 'Pay',
        cadence: 'monthly',
        interval: 1,
        dayOfMonth: 15,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        amount: 1000,
        direction: 'in',
        qualification: 'payroll',
      },
    ],
  });
  assert.deepEqual(
    expandCashFlows(s).map((e) => e.date),
    ['2026-01-15', '2026-02-15'],
  );
  const r = compare(s, catalog()).ranked[0];
  assert.equal(r.daily.find((d) => d.date === '2026-01-14')?.cashFlow, 0);
  assert.equal(r.daily.find((d) => d.date === '2026-01-15')?.cashFlow, 1000);
});
test('biweekly salary stays anchored when it crosses months and years', () => {
  const s = scenario({
    startDate: '2026-12-20',
    endDate: '2027-02-01',
    flows: [
      {
        id: 'pay',
        label: 'Salary',
        cadence: 'weekly',
        interval: 2,
        dayOfMonth: 1,
        startDate: '2026-12-25',
        endDate: '2027-02-01',
        amount: 2500,
        direction: 'in',
        qualification: 'payroll',
      },
    ],
  });
  assert.deepEqual(
    expandCashFlows(s).map((e) => e.date),
    ['2026-12-25', '2027-01-08', '2027-01-22'],
  );
});
test('month-end clamping works for leap years and promotional anniversaries', () => {
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  const s = scenario({
    startDate: '2028-02-01',
    endDate: '2028-02-29',
    flows: [
      {
        id: 'pay',
        label: 'Pay',
        cadence: 'monthly',
        interval: 1,
        dayOfMonth: 31,
        startDate: '2028-01-31',
        endDate: '2028-03-31',
        amount: 1,
        direction: 'in',
        qualification: 'none',
      },
    ],
  });
  assert.equal(expandCashFlows(s)[0].date, '2028-02-29');
});
test('weekends postpone ACH initiation; transit earns no interest and holds do', () => {
  assert.equal(businessArrival('2026-10-10', 2), '2026-10-14');
  assert.equal(businessArrival('2026-10-09', 2), '2026-10-13');
  const r = compare(
    scenario({
      startDate: '2026-10-09',
      endDate: '2026-10-16',
      transfer: { businessDays: 2, fee: 5, holdDays: 2 },
    }),
    catalog(),
  ).ranked[0];
  assert.equal(r.daily[3].interest, 0);
  assert.equal(r.daily[3].transit, 9995);
  assert.ok(r.daily[4].interest > 0);
  assert.equal(r.daily[4].liquid, 0);
  assert.ok(r.daily[6].liquid > 0);
});
test('negative balances are never silently reset to zero', () => {
  const s = scenario({
    events: [{ date: '2026-01-02', amount: -20000, label: 'Car', qualification: 'none' }],
  });
  assert.throws(() => compare(s, catalog()), /Baseline is infeasible/);
});
test('candidate withdrawal before funds availability is excluded but baseline remains valid', () => {
  const r = compare(
    scenario({
      transfer: { businessDays: 2, fee: 0, holdDays: 0 },
      events: [{ date: '2026-01-02', amount: -10, label: 'Bill', qualification: 'none' }],
    }),
    catalog(),
  );
  assert.equal(r.ranked.length, 0);
  assert.match(r.excluded[0].exclusionReason!, /precedes/);
});
test('opening minimum is enforced', () => {
  assert.equal(compare(scenario(), catalog(bank({ openingMinimum: 20000 }))).excluded.length, 1);
});
test('monthly and paper fees reduce earnings and do not reduce taxable interest', () => {
  const r = compare(
    scenario({ taxRate: 0.25, eStatements: false }),
    catalog(bank({ apy: 0, monthlyFee: 10, paperStatementFee: 5 })),
  ).ranked[0];
  assert.equal(r.fees, 180);
  assert.equal(r.netReturn, -180);
  assert.equal(r.estimatedTax, 0);
});
test('minimum daily balance fee waiver requires the full modeled month', () => {
  const b = bank({ apy: 0, monthlyFee: 10, feeWaiverMinimum: 10000 });
  assert.equal(compare(scenario(), catalog(b)).ranked[0].fees, 0);
  const s = scenario({
    events: [
      { date: '2026-02-01', amount: -1, label: 'withdraw', qualification: 'none' },
      { date: '2026-02-02', amount: 1, label: 'deposit', qualification: 'none' },
    ],
  });
  assert.equal(compare(s, catalog(b)).ranked[0].fees, 110); // February fee reduces the subsequent balances below the waiver.
});
test('estimated taxes and baseline use identical after-tax conventions', () => {
  const r = compare(scenario({ taxRate: 0.22 }), catalog());
  assert.equal(r.ranked[0].estimatedTax, 110);
  assert.equal(r.ranked[0].netReturn, 390);
  assert.equal(r.ranked[0].incrementalGain, 156);
});
test('rate promotions require explicit eligibility and correct enrollment dates', () => {
  const p = {
    id: 'promo',
    name: 'Promo',
    startsOn: '2026-01-02',
    enrollBy: '2026-02-01',
    durationMonths: 3,
    apyDelta: 1,
    conditions: 'New customer',
  };
  const c = catalog(bank({ promotions: [p] }));
  assert.equal(compare(scenario({ eligiblePromotionIds: ['promo'] }), c).ranked[0].interest, 500);
  assert.equal(
    compare(scenario({ startDate: '2026-01-02', endDate: '2027-01-01' }), c).ranked[0].interest,
    500,
  );
  assert.ok(
    compare(
      scenario({ startDate: '2026-01-02', endDate: '2027-01-01', eligiblePromotionIds: ['promo'] }),
      c,
    ).ranked[0].interest > 500,
  );
});
test('promotion balance caps split the interest without boosting excess cash', () => {
  const c = catalog(
    bank({
      apy: 0,
      promotions: [
        {
          id: 'cap',
          name: 'Cap',
          durationMonths: 3,
          apyDelta: 5,
          cap: 5000,
          conditions: 'Eligible',
        },
      ],
    }),
  );
  const r = compare(scenario({ endDate: '2026-01-01', eligiblePromotionIds: ['cap'] }), c)
    .ranked[0];
  assert.equal(r.interest, Math.round(5000 * dailyRate(5) * 100) / 100);
});
const bonusBank = () =>
  bank({
    apy: 0,
    bonuses: [
      {
        id: 'bonus',
        name: 'Fixture bonus',
        startsOn: '2026-01-01',
        enrollBy: '2026-12-31',
        kind: 'balance',
        fundingDays: 30,
        maintainDays: 45,
        maintenance: 'average',
        payoutDelayDays: 30,
        tiers: [{ minimum: 10000, bonus: 400 }],
        conditions: 'New funds, keep open',
      },
    ],
  });
test('bonus requires complete funding and maintenance and pays on the scheduled date', () => {
  const c = catalog(bonusBank());
  for (const days of [31, 74, 104])
    assert.equal(
      compare(
        scenario({ endDate: addDays('2026-01-01', days), eligiblePromotionIds: ['bonus'] }),
        c,
      ).ranked[0].bonuses,
      0,
    );
  const r = compare(scenario({ endDate: '2026-04-16', eligiblePromotionIds: ['bonus'] }), c)
    .ranked[0];
  assert.equal(r.bonuses, 400);
  assert.equal(r.daily.find((d) => d.date === '2026-04-16')?.bonuses, 400);
});
test('average-balance bonus allows temporary dips; minimum-balance bonus does not', () => {
  const events = [
    { date: '2026-01-31', amount: -1000, label: 'Dip', qualification: 'none' as const },
    { date: '2026-02-01', amount: 2000, label: 'Restore', qualification: 'none' as const },
  ];
  const s = scenario({ events, eligiblePromotionIds: ['bonus'] });
  assert.equal(compare(s, catalog(bonusBank())).ranked[0].bonuses, 400);
  const b = bonusBank();
  b.bonuses[0].maintenance = 'minimum';
  assert.equal(compare(s, catalog(b)).ranked[0].bonuses, 0);
});
test('net withdrawals during funding reduce the bonus funding tier', () => {
  const s = scenario({
    events: [
      { date: '2026-01-20', amount: -1, label: 'Withdraw', qualification: 'none' },
      { date: '2026-02-02', amount: 1000, label: 'Too late', qualification: 'none' },
    ],
    eligiblePromotionIds: ['bonus'],
  });
  assert.equal(compare(s, catalog(bonusBank())).ranked[0].bonuses, 0);
});
test('actual payroll qualifies prospectively; ordinary ACH does not', () => {
  const b = bank({ model: 'rolling-payroll', apy: 0, qualifiedApy: 5, qualificationDays: 31 });
  const event = {
    date: '2026-01-15',
    amount: 1000,
    label: 'Deposit',
    qualification: 'external-deposit' as const,
  };
  assert.equal(compare(scenario({ events: [event] }), catalog(b)).ranked[0].interest, 0);
  const r = compare(scenario({ events: [{ ...event, qualification: 'payroll' }] }), catalog(b))
    .ranked[0];
  assert.equal(r.daily[13].interest, 0);
  assert.ok(r.daily[14].interest > 0);
  assert.equal(r.daily[45].interest, r.daily[44].interest);
});
test('payroll bonus windows start at the first payroll, not the calendar month', () => {
  const b = bonusBank();
  b.bonuses[0] = {
    ...b.bonuses[0],
    kind: 'payroll',
    fundingDays: 25,
    maintainDays: 0,
    payoutDelayDays: 14,
    tiers: [{ minimum: 5000, bonus: 400 }],
  };
  const s = scenario({
    eligiblePromotionIds: ['bonus'],
    events: [
      { date: '2026-01-30', amount: 2500, label: 'Pay', qualification: 'payroll' },
      { date: '2026-02-13', amount: 2500, label: 'Pay', qualification: 'payroll' },
    ],
  });
  const r = compare(s, catalog(b)).ranked[0];
  assert.equal(r.bonuses, 400);
  assert.equal(r.daily.find((d) => d.date === '2026-03-10')?.bonuses, 400);
});
test('unverified or unsupported accounts never win; ties share a rank', () => {
  const r = compare(
    scenario({ bankIds: ['test', 'tie', 'unknown'] }),
    catalog(bank(), bank({ id: 'tie' }), bank({ id: 'unknown', apy: 99, verification: 'review' })),
  );
  assert.equal(r.excluded.length, 1);
  assert.equal(r.winnerIds.length, 2);
  assert.equal(r.ranked[1].rank, 1);
});
test('baseline can win even if a candidate has a higher advertised APY', () => {
  const r = compare(scenario(), catalog(bank({ monthlyFee: 100 })));
  assert.equal(r.winnerId, 'baseline');
});
test('schemas reject invalid dates, nonfinite amounts, unknown rules and duplicate IDs', () => {
  assert.throws(() => scenario({ startDate: '2026-02-30' }));
  assert.throws(() => scenario({ startingCash: Infinity }));
  assert.throws(() => readScenario(toYaml({ ...scenario(), inventedRule: true })));
  assert.throws(() => catalog(bank(), bank()));
  assert.throws(() => compare(scenario({ bankIds: ['missing'] }), catalog()), /Unknown bank/);
  assert.throws(
    () => compare(scenario({ eligiblePromotionIds: ['fictional'] }), catalog()),
    /Unknown promotion/,
  );
});
test('YAML and JSON round trips preserve every flow and comparison', () => {
  const s = readScenario(readFileSync('examples/working-person.yaml', 'utf8'));
  const c = readCatalog(readFileSync('data/banks-2026-10-09.yaml', 'utf8'));
  assert.deepEqual(readScenario(toYaml(s)), s);
  assert.deepEqual(readScenario(JSON.stringify(s)), s);
  assert.deepEqual(compare(readScenario(toYaml(s)), c), compare(s, c));
  assert.equal(c.banks.length, 25);
  assert.equal(compare(s, c).ranked.length, 7);
});
test('legacy XML salary keeps its weekday and metrics that cannot be dated are rejected', () => {
  const base =
    '<hysaScenario schemaVersion="1.0" toolVersion="1.0.0" id="legacy" createdAt="2026-01-01"><simulation startDate="2026-01-01" endDate="2026-02-28" startingCash="10000"/>';
  const s = readScenario(
    base +
      '<recurringFlows><flow id="pay" amount="1000" direction="in" cadence="weekly" interval="2" dayOfWeek="5" startDate="2026-01-01" endDate="2026-02-28" qualificationType="directDeposit"/></recurringFlows></hysaScenario>',
  );
  assert.equal(s.flows[0].startDate, '2026-01-02');
  assert.throws(
    () =>
      readScenario(
        base +
          '<monthlyMetrics><month value="2026-01" directDeposit="1000"/></monthlyMetrics></hysaScenario>',
      ),
    /cannot be safely dated/,
  );
  assert.throws(() => readScenario('<!DOCTYPE x><hysaScenario/>'), /document types/);
});
test('SVG escapes imported text and CSV protects spreadsheet formulas', () => {
  const c = catalog(bank({ name: '<script>alert(1)</script>' }));
  const svg = toSvg(compare(scenario(), c));
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
  const csv = toCsv(compare(scenario(), catalog(bank({ name: '=HYPERLINK("bad")' }))));
  assert.ok(csv.includes("'=HYPERLINK"));
});
