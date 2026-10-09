import { fact, verifiedValue, type Profile } from './profile';

const DAY = 86400000;
const utc = (s: string) => new Date(s + 'T00:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const next = (s: string, n = 1) => iso(new Date(+utc(s) + DAY * n));
const round = (n: number) => Math.round(n * 100) / 100;
export function freshness(dataAsOf: string, evaluatedOn: string) {
  const ageDays = Math.floor((+utc(evaluatedOn) - +utc(dataAsOf)) / DAY);
  return {
    dataAsOf,
    evaluatedOn,
    ageDays,
    label:
      ageDays < 0
        ? 'Future-dated'
        : ageDays <= 7
          ? 'Fresh'
          : ageDays <= 30
            ? 'Recent'
            : ageDays <= 90
              ? 'Aging'
              : 'Stale',
    warning:
      ageDays < 0
        ? 'Snapshot is dated after the evaluation date.'
        : ageDays > 90
          ? 'Stale bank data — refresh rates and terms.'
          : ageDays > 30
            ? 'Aging bank data — recheck rates and promotions.'
            : null,
  };
}
const numeric = (p: Profile | undefined, key: string) => {
  const v = verifiedValue(p, key);
  return typeof v === 'number' && v >= 0 ? v : null;
};

export function exitAnalysis(
  p: Profile | undefined,
  balance: number,
  onDate: string,
  openedOn = onDate,
) {
  const val = (key: string) => verifiedValue(p, key);
  const num = (key: string) => numeric(p, key);
  const daily = num('outgoingAchDaily'),
    weekly = num('outgoingAchWeekly'),
    monthly = num('outgoingAchMonthly');
  const perTransaction = num('outgoingAchPerTransaction');
  const monthlyWindow = val('achLimitWindow');
  const weeklyWindow = val('achWeeklyWindow');
  const knownMonthWindow = ['calendar', 'rolling-30'].includes(String(monthlyWindow));
  const reasons: string[] = [];
  let minimumInitiationDays: number | null = null;
  let calendarDays: number | null = null;
  let completionDate: string | null = null;
  // Only a published cap is used. Absent caps remain unknown; this schedule is a lower bound.
  if (
    val('outgoingAchSupported') !== false &&
    (daily !== null ||
      (monthly !== null && ['calendar', 'rolling-30'].includes(String(monthlyWindow))))
  ) {
    let remaining = balance,
      date = onDate,
      bankingDays = 0;
    const sent: { date: string; amount: number; count: number }[] = [];
    for (let elapsed = 0; elapsed < 3660 && remaining > 0.005; elapsed++, date = next(date)) {
      if ([0, 6].includes(utc(date).getUTCDay())) continue;
      bankingDays++;
      const monthSent = sent.filter((x) =>
        monthlyWindow === 'calendar'
          ? x.date.slice(0, 7) === date.slice(0, 7)
          : x.date > next(date, -30),
      );
      const weekSent = sent.filter((x) => x.date > next(date, -7));
      const monthlyRemaining =
        monthly === null || !['calendar', 'rolling-30'].includes(String(monthlyWindow))
          ? Infinity
          : monthly - monthSent.reduce((sum, x) => sum + x.amount, 0);
      const weeklyRemaining =
        weekly === null || weeklyWindow !== 'rolling-7'
          ? Infinity
          : weekly - weekSent.reduce((sum, x) => sum + x.amount, 0);
      const count = Math.min(
        num('outgoingAchTransactionsDaily') ?? Infinity,
        knownMonthWindow
          ? (num('outgoingAchTransactionsMonthly') ?? Infinity) -
              monthSent.reduce((sum, x) => sum + x.count, 0)
          : Infinity,
      );
      const amount = Math.max(
        0,
        Math.min(
          remaining,
          daily ?? Infinity,
          weeklyRemaining,
          monthlyRemaining,
          count <= 0 ? 0 : perTransaction === null ? Infinity : perTransaction * count,
        ),
      );
      if (amount > 0) {
        sent.push({ date, amount, count: perTransaction ? Math.ceil(amount / perTransaction) : 1 });
        remaining -= amount;
      }
      if (remaining <= 0.005) {
        minimumInitiationDays = bankingDays;
        calendarDays = elapsed + 1;
        completionDate = date;
      }
    }
  }
  if (daily === null) reasons.push('No current official outgoing ACH daily amount cap verified.');
  if (monthly === null) reasons.push('Monthly ACH cap unknown; absence is not unlimited.');
  if (monthly !== null && !['calendar', 'rolling-30'].includes(String(monthlyWindow)))
    reasons.push('Monthly cap reset window is unknown; it is not used in the day estimate.');
  if (weekly !== null && weeklyWindow !== 'rolling-7')
    reasons.push(
      'Weekly cap reset window is unknown or unsupported; it is not used in the lower bound.',
    );
  if (num('outgoingAchTransactionsMonthly') !== null && !knownMonthWindow)
    reasons.push(
      'Monthly transaction-count reset is unknown; confirm both incoming and outgoing usage.',
    );
  if (num('achOutstandingLimit') !== null)
    reasons.push(
      'Outstanding-transfer restrictions need manual scheduling; the lower bound can understate exit time.',
    );
  const processMin = num('achProcessingMin'),
    processMax = num('achProcessingMax');
  const achWindow =
    minimumInitiationDays !== null && processMin !== null && processMax !== null
      ? { min: minimumInitiationDays - 1 + processMin, max: minimumInitiationDays - 1 + processMax }
      : null;
  const ageDays = Math.floor((+utc(onDate) - +utc(openedOn)) / DAY);
  const newRestriction = num('wireRestrictedDays');
  const restricted = newRestriction !== null && ageDays < newRestriction;
  const wireLimit = restricted ? num('newAccountWireLimit') : num('outgoingWirePerTransaction');
  const wireDaily = num('outgoingWireDaily');
  const fullWire =
    val('outgoingWireSupported') === true &&
    (restricted
      ? wireLimit !== null && wireLimit >= balance
      : val('wireNoPublishedCap') === true ||
        (wireLimit !== null && wireLimit >= balance && wireDaily !== null && wireDaily >= balance));
  const wireMin = num('wireProcessingMin'),
    wireMax = num('wireProcessingMax');
  const wireWindow =
    fullWire && wireMin !== null && wireMax !== null ? { min: wireMin, max: wireMax } : null;
  const warnings: string[] = [];
  if (perTransaction !== null && balance > perTransaction)
    warnings.push(
      `Balance exceeds the $${perTransaction.toLocaleString('en-US')} ACH per-transaction cap.`,
    );
  if (monthly !== null && monthly > 0 && balance > monthly)
    warnings.push(
      `Balance exceeds the published $${monthly.toLocaleString('en-US')} monthly ACH allowance; at least ${Math.ceil(balance / monthly)} allowance periods are needed. Confirm the reset window and shared usage.`,
    );
  if (minimumInitiationDays !== null && minimumInitiationDays > 1)
    warnings.push(
      `Published ACH caps imply at least ${minimumInitiationDays} banking days to initiate the full exit (${calendarDays} calendar days from ${onDate}).`,
    );
  if (minimumInitiationDays === null)
    warnings.push('Exit time unknown: no complete official ACH capacity schedule verified.');
  if (val('outgoingWireSupported') === false)
    warnings.push('Outgoing wires are unavailable for this product.');
  if (val('outgoingWireSupported') === true && !fullWire)
    warnings.push(
      'Wire support is documented; ability to wire this entire balance is not established.',
    );
  const hold = Math.max(num('achPullHoldDays') ?? 0, num('newAccountHoldDays') ?? 0);
  if (hold > 0)
    warnings.push(
      `A documented deposit hold can delay access by ${hold} business days. Holds are not included in the settled-cash exit estimate.`,
    );
  if (
    String(val('closurePayout') ?? '')
      .toLowerCase()
      .includes('mail')
  )
    warnings.push('Closure may involve a mailed check; confirm payout timing.');
  return {
    balance: round(balance),
    onDate,
    openedOn,
    minimumTransactions: perTransaction && balance > 0 ? Math.ceil(balance / perTransaction) : null,
    ach: {
      minimumInitiationDays,
      calendarDays,
      completionDate,
      documentedProcessing:
        processMin !== null && processMax !== null ? { min: processMin, max: processMax } : null,
      theoreticalArrivalWindow: achWindow,
      dailyCap: daily,
      monthlyCap: monthly,
      constraintsIncomplete: reasons.length > 0,
      reasons,
    },
    wire: {
      supported: val('outgoingWireSupported'),
      fullBalanceSupported: fullWire,
      amountLimit: wireLimit,
      fee: num('outgoingWireFee'),
      documentedProcessing:
        wireMin !== null && wireMax !== null ? { min: wireMin, max: wireMax } : null,
      theoreticalArrivalWindow: wireWindow,
      newAccountRestriction: restricted,
    },
    estimatedRealWorldWindow: null,
    explanation:
      'Theoretical estimates use available settled cash, unused limits, business-day initiation and known published caps. Unknown limits, cutoff times, account review, recipient holds and holidays may delay the actual exit. No real-world guarantee is inferred.',
    warnings,
  };
}

export type InsuranceAssumptions = {
  ownership: 'single' | 'joint' | 'other';
  jointOwners: number;
  otherDeposits: { aggregationGroup: string; amount: number; label: string }[];
};
export const FDIC_SOURCE = {
  url: 'https://www.fdic.gov/resources/deposit-insurance/understanding-deposit-insurance',
  publisher: 'FDIC',
  title: 'Understanding Deposit Insurance',
  accessedAt: '2026-10-09',
  section: 'Per depositor, per insured bank, per ownership category',
};
export function insuranceAnalysis(
  p: Profile | undefined,
  balance: number,
  assumptions: InsuranceAssumptions,
) {
  const group = verifiedValue(p, 'fdicAggregationGroup');
  const structure = verifiedValue(p, 'accountStructure');
  const eligible = verifiedValue(p, 'fdicInsured');
  const knownDirect =
    eligible === true &&
    structure === 'direct-bank-deposit' &&
    typeof group === 'string' &&
    assumptions.ownership !== 'other';
  const limit = assumptions.ownership === 'joint' ? 250000 * assumptions.jointOwners : 250000;
  const related =
    typeof group === 'string'
      ? assumptions.otherDeposits
          .filter((d) => d.aggregationGroup === group)
          .reduce((sum, d) => sum + d.amount, 0)
      : 0;
  const insured = knownDirect ? Math.min(balance, Math.max(0, limit - related)) : null;
  const uninsured = insured === null ? null : Math.max(0, balance - insured);
  const warnings: string[] = [];
  if (uninsured !== null && uninsured > 0)
    warnings.push(
      `Potentially uninsured: $${round(uninsured).toLocaleString('en-US')} of $${round(balance).toLocaleString('en-US')} under the entered ownership and related-deposit assumptions.`,
    );
  if (related > 0)
    warnings.push(
      `$${related.toLocaleString('en-US')} in other same-category deposits shares this legal bank's coverage.`,
    );
  if (!knownDirect)
    warnings.push(
      structure === 'brokerage-sweep' || structure === 'fintech-pass-through'
        ? 'Actual insured amount unknown: verify allocation at each program bank, ownership, and overlapping deposits. An advertised sweep ceiling is not personal coverage.'
        : 'Insurance amount unknown: legal bank, FDIC eligibility, aggregation group or ownership category is unverified.',
    );
  return {
    balance: round(balance),
    aggregationGroup: group,
    structure,
    standardLimit: knownDirect ? limit : null,
    otherDeposits: related,
    insured: insured === null ? null : round(insured),
    potentiallyUninsured: uninsured === null ? null : round(uninsured),
    ownership: assumptions.ownership,
    source: FDIC_SOURCE,
    warnings,
    assumption:
      'Estimate assumes all entered deposits share the selected eligible ownership category and no unentered same-bank deposits. Joint eligibility must be verified; trusts and other categories require manual analysis.',
  };
}

export function historyAnalysis(
  p: Profile | undefined,
  onDate: string,
  series = p?.rateHistory.some((h) => h.series === 'regular')
    ? 'regular'
    : (p?.rateHistory[0]?.series ?? 'regular'),
) {
  const points = (p?.rateHistory ?? [])
    .filter((h) => h.series === series && h.date <= onDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  function window(months: number) {
    const start = utc(onDate),
      day = start.getUTCDate();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - months);
    const last = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    ).getUTCDate();
    start.setUTCDate(Math.min(day, last));
    const startDate = iso(start),
      end = next(onDate);
    const days = Math.round((+utc(end) - +utc(startDate)) / DAY);
    const rates: number[] = [];
    for (let d = startDate; d <= onDate; d = next(d)) {
      const covering = points.filter((h) => h.date <= d && (h.validThrough ?? h.date) >= d);
      if (covering.length && covering.every((h) => h.apy === covering[0].apy))
        rates.push(covering[0].apy);
    }
    return {
      average: rates.length === days ? round(rates.reduce((a, b) => a + b, 0) / days) : null,
      coveredDays: rates.length,
      totalDays: days,
    };
  }
  const year = next(onDate, -365),
    observations = points.filter((p) => p.date >= year),
    rates = observations.map((p) => p.apy);
  const full = window(12),
    mean = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const changes = rates
      .slice(1)
      .map((r, i) => r - rates[i])
      .filter((n) => n !== 0),
    cuts = changes.filter((n) => n < 0),
    increases = changes.filter((n) => n > 0);
  return {
    series,
    points,
    incomplete: full.coveredDays < full.totalDays,
    threeMonth: window(3),
    sixMonth: window(6),
    twelveMonth: full,
    observed: {
      count: rates.length,
      minimum: rates.length ? Math.min(...rates) : null,
      maximum: rates.length ? Math.max(...rates) : null,
      standardDeviation:
        rates.length > 1
          ? round(Math.sqrt(rates.reduce((sum, r) => sum + (r - mean!) ** 2, 0) / rates.length))
          : null,
      changes: rates.length > 1 ? changes.length : null,
      averageCut: cuts.length ? round(cuts.reduce((a, b) => a + b, 0) / cuts.length) : null,
      averageIncrease: increases.length
        ? round(increases.reduce((a, b) => a + b, 0) / increases.length)
        : null,
    },
    currentVsTwelveMonthAverage:
      full.average === null || !points.length ? null : round(points.at(-1)!.apy - full.average),
    currentRangePercentile:
      full.average === null || rates.length < 2 || Math.max(...rates) === Math.min(...rates)
        ? null
        : round(
            ((rates.at(-1)! - Math.min(...rates)) / (Math.max(...rates) - Math.min(...rates))) *
              100,
          ),
    explanation:
      'Observed statistics describe only sourced observations in the same rate series. Time averages require documented coverage of every day. Missing months are never filled forward.',
  };
}

export function frictionAnalysis(p: Profile | undefined) {
  const checks = [
    ['monthlyFee', (v: unknown) => typeof v === 'number' && v > 0],
    ['linkedAccountRequired', (v: unknown) => v === true],
    ['directDepositRequired', (v: unknown) => v === true],
    ['outgoingWireSupported', (v: unknown) => v === false],
    ['outgoingAchDaily', (v: unknown) => typeof v === 'number' && v < 100000],
    ['newAccountHoldDays', (v: unknown) => typeof v === 'number' && v > 0],
    ['support247', (v: unknown) => v === false],
  ] as const;
  const unknown = checks.filter(([key]) => fact(p, key).status !== 'verified').map(([key]) => key);
  const obstacles = checks
    .filter(([key, test]) => fact(p, key).status === 'verified' && test(verifiedValue(p, key)))
    .map(([key]) => key);
  return {
    obstacles: obstacles.length,
    evaluated: checks.length - unknown.length,
    total: checks.length,
    unknown: unknown.length,
    obstacleKeys: obstacles,
    unknownKeys: unknown,
    score: unknown.length ? null : obstacles.length,
    explanation:
      'Count of documented operational obstacles across seven checks. Unknowns are separate and prevent a complete friction score. This is not a safety or trust score.',
  };
}
