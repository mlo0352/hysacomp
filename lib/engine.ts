import {
  BankSchema,
  CatalogSchema,
  ScenarioSchema,
  VERSION,
  type Bank,
  type Catalog,
  type Scenario,
} from './schema';
import {
  exitAnalysis,
  freshness,
  frictionAnalysis,
  historyAnalysis,
  insuranceAnalysis,
} from './analysis';
import { verifiedValue } from './profile';

const DAY = 86400000;
export const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(s + 'T00:00:00Z');
export const addDays = (s: string, n: number) => iso(new Date(+utc(s) + n * DAY));
export function addMonths(s: string, n: number) {
  const d = utc(s),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  d.setUTCDate(
    Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()),
  );
  return iso(d);
}
export function businessArrival(s: string, days: number) {
  if (!days) return s;
  let d = utc(s);
  while ([0, 6].includes(d.getUTCDay())) d = new Date(+d + DAY);
  while (days > 0) {
    d = new Date(+d + DAY);
    if (![0, 6].includes(d.getUTCDay())) days--;
  }
  return iso(d);
}
export const dailyRate = (apy: number) => Math.expm1(Math.log1p(apy / 100) / 365);
export const rounded = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
type CashEvent = {
  date: string;
  amount: number;
  label: string;
  qualification: 'none' | 'payroll' | 'external-deposit';
};

export function expandCashFlows(s: Scenario): CashEvent[] {
  const events: CashEvent[] = [...s.events];
  for (const f of s.flows) {
    const end = f.endDate < s.endDate ? f.endDate : s.endDate;
    if (f.cadence === 'monthly') {
      let month = f.startDate.slice(0, 7) + '-01';
      while (month <= end) {
        const d = utc(month),
          last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
        const due = month.slice(0, 8) + String(Math.min(f.dayOfMonth, last)).padStart(2, '0');
        if (due >= f.startDate && due <= end)
          events.push({
            date: due,
            amount: f.amount * (f.direction === 'out' ? -1 : 1),
            label: f.label,
            qualification: f.qualification,
          });
        month = addMonths(month, f.interval);
      }
    } else {
      for (let due = f.startDate; due <= end; due = addDays(due, 7 * f.interval))
        events.push({
          date: due,
          amount: f.amount * (f.direction === 'out' ? -1 : 1),
          label: f.label,
          qualification: f.qualification,
        });
    }
  }
  return events
    .filter((e) => e.date >= s.startDate && e.date <= s.endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function dailyInterest(bank: Bank, balance: number, apy = bank.apy ?? 0) {
  if (bank.model === 'whole-balance') {
    const tier = [...bank.tiers].reverse().find((t) => balance >= t.from);
    return balance * dailyRate(tier?.apy ?? 0);
  }
  if (bank.model === 'marginal')
    return bank.tiers.reduce((sum, t, i) => {
      const amount = Math.max(0, Math.min(balance, bank.tiers[i + 1]?.from ?? Infinity) - t.from);
      return sum + amount * dailyRate(t.apy);
    }, 0);
  return balance * dailyRate(apy);
}

export type Daily = {
  date: string;
  balance: number;
  liquid: number;
  transit: number;
  interest: number;
  bonuses: number;
  fees: number;
  estimatedTax: number;
  netReturn: number;
  cashFlow: number;
};
export type Task = {
  bankId: string;
  date: string;
  title: string;
  kind: 'verify' | 'fund' | 'maintain' | 'bonus';
};
export type BankResult = {
  bankId: string;
  name: string;
  checkedOn: string;
  sourceUrl: string;
  rank: number | null;
  status: 'eligible' | 'excluded';
  exclusionReason: string | null;
  interest: number;
  bonuses: number;
  fees: number;
  estimatedTax: number;
  netReturn: number;
  incrementalGain: number;
  endingBalance: number;
  endingAfterTax: number;
  minimumLiquid: number;
  warnings: string[];
  tasks: Task[];
  daily: Daily[];
  focusYearInterest: number;
  effectiveApy: number | null;
  yieldLostToCaps: number;
  yieldLostToQualification: number;
};

function simulate(s: Scenario, b: Bank, cashEvents: CashEvent[], baseline = false): BankResult {
  const result: BankResult = {
    bankId: b.id,
    name: b.name,
    checkedOn: b.checkedOn,
    sourceUrl: b.sourceUrl,
    rank: null,
    status: 'eligible',
    exclusionReason: null,
    interest: 0,
    bonuses: 0,
    fees: 0,
    estimatedTax: 0,
    netReturn: 0,
    incrementalGain: 0,
    endingBalance: s.startingCash,
    endingAfterTax: s.startingCash,
    minimumLiquid: Infinity,
    warnings: [...b.limitations],
    tasks: [],
    daily: [],
    focusYearInterest: 0,
    effectiveApy: null,
    yieldLostToCaps: 0,
    yieldLostToQualification: 0,
  };
  const exclude = (reason: string) => {
    result.status = 'excluded';
    result.exclusionReason = reason;
    if (!Number.isFinite(result.minimumLiquid)) result.minimumLiquid = 0;
    return result;
  };
  if (b.verification !== 'verified' || b.model === 'unsupported' || b.apy === null)
    return exclude(b.evidence);
  if (s.startingCash < b.openingMinimum)
    return exclude(
      `Opening deposit needs $${b.openingMinimum.toLocaleString('en-US')}; starting cash is $${s.startingCash.toLocaleString('en-US')}.`,
    );
  if (b.checkedOn > s.startDate && !baseline)
    result.warnings.push(
      'Snapshot postdates the scenario start; this is a what-if comparison, not a historical backtest.',
    );
  if ((+utc(s.startDate) - +utc(b.checkedOn)) / DAY > 30 && !baseline)
    result.warnings.push(
      'Bank data is over 30 days older than the scenario start. Recheck the source.',
    );
  const fee = baseline ? 0 : s.transfer.fee;
  const arrival = businessArrival(s.startDate, baseline ? 0 : s.transfer.businessDays);
  const unlocked = addDays(arrival, baseline ? 0 : s.transfer.holdDays);
  let balance = s.startingCash - fee,
    interest = 0,
    bonuses = 0,
    fees = fee;
  if (balance < 0) return exclude('Opening transfer fee exceeds starting cash.');
  const byDate = new Map<string, CashEvent[]>();
  for (const e of cashEvents) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const promos = b.promotions.filter(
    (p) =>
      s.eligiblePromotionIds.includes(p.id) &&
      (!p.startsOn || s.startDate >= p.startsOn) &&
      (!p.enrollBy || s.startDate <= p.enrollBy),
  );
  for (const p of [...b.promotions, ...b.bonuses]) {
    if (!s.eligiblePromotionIds.includes(p.id))
      result.warnings.push(`${p.name} excluded: eligibility has not been confirmed.`);
    else if ((p.startsOn && s.startDate < p.startsOn) || (p.enrollBy && s.startDate > p.enrollBy))
      result.warnings.push(`${p.name} excluded: opening date is outside the enrollment window.`);
  }
  if (promos.length > 1)
    return exclude(
      'Multiple rate promotions selected; stacking rules must be resolved before ranking.',
    );
  const bonusStates = b.bonuses
    .filter(
      (p) =>
        s.eligiblePromotionIds.includes(p.id) &&
        s.startDate >= p.startsOn &&
        s.startDate <= p.enrollBy,
    )
    .map((p) => ({
      p,
      anchor:
        p.kind === 'balance'
          ? s.startDate
          : cashEvents.find(
              (e) => e.amount > 0 && e.qualification === 'payroll' && e.date <= p.enrollBy,
            )?.date,
      deposits: 0,
      sum: 0,
      minimum: Infinity,
      days: 0,
      award: 0,
      decided: false,
    }));
  let lastPayroll: string | undefined;
  let balanceDays = 0;
  let monthMinimum = Infinity;
  let shortfall: string | undefined;
  if (!baseline) {
    result.tasks.push({
      bankId: b.id,
      date: s.startDate,
      title: 'Verify rate, eligibility, transfer limits and eStatements with the bank.',
      kind: 'verify',
    });
    result.tasks.push({
      bankId: b.id,
      date: arrival,
      title: `Confirm initial funds arrived; assumed available ${unlocked}.`,
      kind: 'fund',
    });
    if (s.transfer.businessDays || s.transfer.holdDays)
      result.warnings.push(
        'Opening transfer uses your timing assumption; weekends count, federal holidays do not. Later flows use their entered posting dates.',
      );
    if (!s.eStatements && b.paperStatementFee > 0)
      result.warnings.push('Paper statements incur a monthly fee.');
  }
  for (let day = s.startDate; day <= s.endDate; day = addDays(day, 1)) {
    const events = byDate.get(day) ?? [];
    if (day.endsWith('-01')) monthMinimum = Infinity;
    const netCash = events.reduce((sum, e) => sum + e.amount, 0);
    const payroll = events
      .filter((e) => e.qualification === 'payroll' && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    if (payroll > 0) lastPayroll = day;
    balance += netCash;
    if (balance < -0.000001 && !shortfall)
      shortfall = `Insufficient cash on ${day}; the plan would overdraw this account.`;
    if (day < unlocked && events.some((e) => e.amount < 0) && !shortfall)
      shortfall = `Withdrawal on ${day} precedes assumed funds availability (${unlocked}).`;
    if (b.maximumModeledBalance !== undefined && balance > b.maximumModeledBalance)
      shortfall ??= `Balance exceeds the verified model limit of $${b.maximumModeledBalance.toLocaleString('en-US')}.`;
    for (const st of bonusStates) {
      if (!st.anchor) continue;
      const fundingEnd = addDays(st.anchor, st.p.fundingDays);
      const maintenanceEnd = addDays(fundingEnd, st.p.maintainDays);
      if (day < fundingEnd && day >= st.anchor) {
        if (st.p.kind === 'payroll') st.deposits += payroll;
        else st.deposits += netCash + (day === arrival ? s.startingCash - fee : 0);
      }
      if (!st.decided && day === maintenanceEnd) {
        const maintained =
          st.p.maintenance === 'average' ? st.sum / Math.max(1, st.days) : st.minimum;
        const amount = st.p.kind === 'payroll' ? st.deposits : Math.min(st.deposits, maintained);
        const completed = st.p.kind === 'payroll' || st.days === st.p.maintainDays;
        st.award = completed
          ? Math.max(0, ...st.p.tiers.filter((t) => amount >= t.minimum).map((t) => t.bonus))
          : 0;
        st.decided = true;
        if (!st.award)
          result.warnings.push(`${st.p.name}: deposit or maintenance requirements were not met.`);
      }
      if (st.award && day === addDays(maintenanceEnd, st.p.payoutDelayDays)) {
        balance += st.award;
        bonuses += st.award;
      }
    }
    let apy = b.apy;
    if (
      b.model === 'rolling-payroll' &&
      lastPayroll &&
      day < addDays(lastPayroll, b.qualificationDays!)
    )
      apy = b.qualifiedApy!;
    let earned = day < arrival ? 0 : dailyInterest(b, Math.max(0, balance), apy);
    if (day >= arrival) {
      balanceDays += Math.max(0, balance);
      if (b.model === 'rolling-payroll' && apy !== b.qualifiedApy)
        result.yieldLostToQualification +=
          Math.max(0, balance) * (dailyRate(b.qualifiedApy!) - dailyRate(apy));
      if (['whole-balance', 'marginal'].includes(b.model))
        result.yieldLostToCaps += Math.max(
          0,
          Math.max(0, balance) * dailyRate(Math.max(...b.tiers.map((t) => t.apy))) - earned,
        );
    }
    const p = promos[0];
    if (p && day >= arrival && day < addMonths(s.startDate, p.durationMonths)) {
      if (!['flat', 'rolling-payroll'].includes(b.model))
        return exclude('Rate promotion cannot be combined with this tier model.');
      const eligible = Math.min(Math.max(0, balance), p.cap ?? Infinity);
      const boosted = p.fixedApy ?? apy + (p.apyDelta ?? 0);
      earned += eligible * (dailyRate(boosted) - dailyRate(apy));
      if (p.cap !== undefined)
        result.yieldLostToCaps +=
          Math.max(0, balance - p.cap) * Math.max(0, dailyRate(boosted) - dailyRate(apy));
    }
    balance += earned;
    interest += earned;
    if (Number(day.slice(0, 4)) === (s.focusYear ?? Number(s.startDate.slice(0, 4))))
      result.focusYearInterest += earned;
    monthMinimum = Math.min(monthMinimum, balance);
    if (addDays(day, 1).slice(0, 7) !== day.slice(0, 7)) {
      const waived = b.feeWaiverMinimum !== undefined && monthMinimum >= b.feeWaiverMinimum;
      const monthly = (waived ? 0 : b.monthlyFee) + (!s.eStatements ? b.paperStatementFee : 0);
      balance -= monthly;
      fees += monthly;
      if (balance < -0.000001 && !shortfall)
        shortfall = `Monthly fees would overdraw the account on ${day}.`;
    }
    for (const st of bonusStates) {
      if (!st.anchor || st.p.kind !== 'balance') continue;
      const begin = addDays(st.anchor, st.p.fundingDays),
        end = addDays(begin, st.p.maintainDays);
      if (day >= begin && day < end) {
        st.days++;
        st.sum += balance;
        st.minimum = Math.min(st.minimum, balance);
      }
    }
    const estimatedTax = (interest + bonuses) * s.taxRate;
    const liquid = day < unlocked ? 0 : balance;
    result.minimumLiquid = Math.min(result.minimumLiquid, liquid);
    result.daily.push({
      date: day,
      balance: rounded(balance),
      liquid: rounded(liquid),
      transit: day < arrival ? rounded(balance) : 0,
      interest: rounded(interest),
      bonuses: rounded(bonuses),
      fees: rounded(fees),
      estimatedTax: rounded(estimatedTax),
      netReturn: rounded(interest + bonuses - fees - estimatedTax),
      cashFlow: rounded(netCash),
    });
  }
  for (const st of bonusStates) {
    if (!st.anchor) {
      result.warnings.push(`${st.p.name}: no qualifying payroll by the enrollment deadline.`);
      continue;
    }
    const complete = addDays(st.anchor, st.p.fundingDays + st.p.maintainDays);
    const payOn = addDays(complete, st.p.payoutDelayDays);
    result.tasks.push({
      bankId: b.id,
      date: addDays(st.anchor, st.p.fundingDays - 1),
      title: `${st.p.name}: finish qualifying deposits. ${st.p.conditions}`,
      kind: 'fund',
    });
    if (st.p.maintainDays)
      result.tasks.push({
        bankId: b.id,
        date: addDays(complete, -1),
        title: `${st.p.name}: complete ${st.p.maintainDays} days of ${st.p.maintenance} balance maintenance.`,
        kind: 'maintain',
      });
    result.tasks.push({
      bankId: b.id,
      date: payOn,
      title: `${st.p.name}: check the bonus posted; keep the account open until it does.`,
      kind: 'bonus',
    });
    if (payOn > s.endDate)
      result.warnings.push(
        `${st.p.name}: expected payout ${payOn} is outside the horizon; no bonus counted.`,
      );
  }
  if (b.model === 'rolling-payroll')
    result.warnings.push(
      'Only explicitly labeled payroll qualifies in this model. Non-payroll deposit paths and promotional boosts are excluded.',
    );
  result.interest = rounded(interest);
  result.bonuses = rounded(bonuses);
  result.fees = rounded(fees);
  result.estimatedTax = rounded((interest + bonuses) * s.taxRate);
  result.netReturn = rounded(interest + bonuses - fees - (interest + bonuses) * s.taxRate);
  result.endingBalance = rounded(balance);
  result.endingAfterTax = rounded(balance - (interest + bonuses) * s.taxRate);
  result.minimumLiquid = rounded(result.minimumLiquid);
  result.focusYearInterest = rounded(result.focusYearInterest);
  result.yieldLostToCaps = rounded(result.yieldLostToCaps);
  result.yieldLostToQualification = rounded(result.yieldLostToQualification);
  result.effectiveApy =
    balanceDays > 0 ? rounded(Math.expm1(Math.log1p(interest / balanceDays) * 365) * 100) : null;
  if (shortfall) exclude(shortfall);
  return result;
}

export function compare(
  scenarioInput: unknown,
  catalogInput: unknown,
  options: { asOf?: string } = {},
) {
  const s = ScenarioSchema.parse(scenarioInput),
    c = CatalogSchema.parse(catalogInput);
  const unknown = s.bankIds.filter((id) => !c.banks.some((b) => b.id === id));
  if (unknown.length) throw new Error(`Unknown bank IDs: ${unknown.join(', ')}`);
  const allPromos = c.banks.flatMap((b) => [...b.promotions, ...b.bonuses].map((p) => p.id));
  const invalidPromos = s.eligiblePromotionIds.filter((id) => !allPromos.includes(id));
  if (invalidPromos.length) throw new Error(`Unknown promotion IDs: ${invalidPromos.join(', ')}`);
  const baselineBank = BankSchema.parse({
    id: 'baseline',
    name: s.baseline.name,
    institution: 'User assumption',
    checkedOn: s.createdAt,
    rateAsOf: null,
    sourceUrl: 'https://github.com/mlo0352/hysacomp',
    evidence: 'User-entered baseline.',
    verification: 'verified',
    model: 'flat',
    apy: s.baseline.apy,
    openingMinimum: 0,
    monthlyFee: s.baseline.monthlyFee,
  });
  const events = expandCashFlows(s);
  const baseline = simulate(s, baselineBank, events, true);
  if (baseline.status === 'excluded')
    throw new Error(`Baseline is infeasible: ${baseline.exclusionReason}`);
  const all = s.bankIds.map((id) =>
    simulate(
      s,
      c.banks.find((b) => b.id === id)!,
      events,
    ),
  );
  const evaluatedOn = options.asOf ?? iso(new Date());
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(evaluatedOn) ||
    !Number.isFinite(+utc(evaluatedOn)) ||
    iso(utc(evaluatedOn)) !== evaluatedOn
  )
    throw new Error('Invalid evaluation date; use YYYY-MM-DD.');
  const decisions = Object.fromEntries(
    all.map((r) => {
      const b = c.banks.find((b) => b.id === r.bankId)!;
      const balance = r.daily.length ? r.endingBalance : s.startingCash;
      const exit = exitAnalysis(b.profile, balance, s.endDate, s.startDate);
      const insurance = insuranceAnalysis(b.profile, balance, s.insurance);
      const peakBalance = Math.max(s.startingCash, ...r.daily.map((d) => d.balance));
      const peakInsurance = insuranceAnalysis(b.profile, peakBalance, s.insurance);
      const fresh = freshness(b.checkedOn, evaluatedOn);
      const warnings = [...insurance.warnings];
      if ((peakInsurance.potentiallyUninsured ?? 0) > (insurance.potentiallyUninsured ?? 0))
        warnings.push(`Peak balance insurance caution: ${peakInsurance.warnings.join(' ')}`);
      warnings.push(...exit.warnings);
      if (fresh.warning) warnings.push(fresh.warning);
      if (verifiedValue(b.profile, 'variableRate') === true)
        warnings.push(
          'Variable APY: the bank can change this rate. The forecast holds the snapshot rate constant.',
        );
      const cap = verifiedValue(b.profile, 'headlineBalanceCap');
      if (typeof cap === 'number' && peakBalance > cap)
        warnings.push(
          `Headline APY is capped at $${cap.toLocaleString('en-US')}; the peak modeled balance exceeds this cap.`,
        );
      for (const p of b.promotions)
        if (p.enrollBy) {
          const remaining = Math.floor((+utc(p.enrollBy) - +utc(evaluatedOn)) / DAY);
          if (remaining < 0)
            warnings.push(
              `${p.name}: enrollment expired ${p.enrollBy}. The forecast can still describe a historical enrollment.`,
            );
          else if (remaining <= 30)
            warnings.push(`${p.name}: enrollment ends in ${remaining} days (${p.enrollBy}).`);
        }
      if (!b.profile)
        warnings.push(
          'Legacy snapshot: no atomic provenance or operational profile; research these facts before acting.',
        );
      if (s.linkedAccounts.some((a) => a.bankId === b.id))
        warnings.push(
          'Linked-account assumptions are recorded for manual review. This version does not simulate a linked-account strategy; complex products remain excluded.',
        );
      r.warnings.push(...warnings);
      return [
        r.bankId,
        {
          balanceDate: s.endDate,
          exit,
          insurance,
          peakInsurance,
          freshness: fresh,
          history: historyAnalysis(b.profile, evaluatedOn),
          friction: frictionAnalysis(b.profile),
          exitStress: [50000, 100000, 250000, 500000].map((amount) =>
            exitAnalysis(b.profile, amount, evaluatedOn, s.startDate),
          ),
          sourceProfile: b.id,
          warnings,
        },
      ];
    }),
  );
  for (const r of all) r.incrementalGain = rounded(r.netReturn - baseline.netReturn);
  const ranked = all
    .filter((r) => r.status === 'eligible')
    .sort((a, b) => b.netReturn - a.netReturn || a.bankId.localeCompare(b.bankId));
  for (const [i, r] of ranked.entries())
    r.rank = i > 0 && r.netReturn === ranked[i - 1].netReturn ? ranked[i - 1].rank : i + 1;
  const best = ranked[0];
  const winners =
    best && best.netReturn > baseline.netReturn
      ? ranked.filter((r) => r.netReturn === best.netReturn).map((r) => r.bankId)
      : ['baseline'];
  return {
    schemaVersion: '3.1' as const,
    toolVersion: VERSION,
    evaluatedOn,
    decisions,
    catalogId: c.id,
    bankDataCheckedOn: c.checkedOn,
    scenario: s,
    bankSnapshot: c,
    assumptions: [
      'Each row is an alternative use of the same cash; the banks are not combined into a portfolio.',
      'Variable APYs stay at the imported snapshot. Daily equivalent APY accrual uses a fixed 365-day denominator.',
      'Recurring flows post on their scheduled dates; salary means take-home cash, not gross salary.',
      'Taxes are estimated on interest and bonuses, reserved at horizon end; fees are not tax deductions.',
      'Opening transfer delay applies to the compared account; the baseline stays parked. Holidays are not modeled.',
      'Monthly fees charge on calendar month-end; amounts are accrued with full precision and displayed to cents.',
      'Savings cash flows are posted deposits and withdrawals; spending via a separate checking account and its recurring transfer friction are not modeled.',
    ],
    winnerIds: winners,
    winnerId: winners[0],
    baseline,
    ranked,
    excluded: all.filter((r) => r.status === 'excluded'),
    gapToRunnerUp: best
      ? rounded(best.netReturn - Math.max(ranked[1]?.netReturn ?? -Infinity, baseline.netReturn))
      : 0,
    cashEvents: events,
  };
}
export type Comparison = ReturnType<typeof compare>;
