import { useMemo, useState } from 'react';
import { ExternalLink, ShieldAlert, Search, ArrowDownToLine } from 'lucide-react';
import type { Bank, Scenario } from '../lib/schema';
import type { Comparison } from '../lib/engine';
import { FACT_GROUPS, FACT_LABELS, fact, verifiedValue, type Profile } from '../lib/profile';
import {
  exitAnalysis,
  freshness,
  historyAnalysis,
  insuranceAnalysis,
  frictionAnalysis,
} from '../lib/analysis';
import { money } from '../lib/export';
import styles from './App.module.css';
import { BankFeatures } from './Features';
import { VerificationButton, VerificationNotebook } from './Verification';
import { BankCustomerReviews } from './Reviews';

export const today = () => new Date().toISOString().slice(0, 10);
export const displayFact = (p: Profile | undefined, key: string) => {
  const f = fact(p, key);
  if (f.value === null) return f.status === 'not-applicable' ? 'Not applicable' : 'Unknown';
  if (typeof f.value === 'boolean') return f.value ? 'Yes' : 'No';
  if (typeof f.value === 'number')
    return f.unit === 'USD'
      ? money(f.value)
      : `${f.value.toLocaleString('en-US')}${f.unit ? ` ${f.unit}` : ''}`;
  return f.value;
};
function save(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Sources({ profile, ids }: { profile: Profile; ids: string[] }) {
  return (
    <div className={styles.sourceList}>
      {ids.map((id) => {
        const s = profile.sources.find((s) => s.id === id);
        return s ? (
          <a key={id} href={s.url} target="_blank" rel="noreferrer">
            <ExternalLink size={12} />
            <span>
              {s.publisher} · {s.title}
              <small>
                {s.section} · Accessed {s.accessedAt}
                {s.effectiveDate ? ` · Effective ${s.effectiveDate}` : ''} · {s.type}
                {s.publishedAt ? ` · Source updated ${s.publishedAt}` : ''}
              </small>
            </span>
          </a>
        ) : null;
      })}
    </div>
  );
}
export function FactView({
  bank,
  field,
  compact = false,
}: {
  bank: Bank;
  field: string;
  compact?: boolean;
}) {
  const f = fact(bank.profile, field);
  return (
    <details className={compact ? styles.factCompact : styles.factRow}>
      <summary>
        <span>{compact ? '' : (FACT_LABELS[field] ?? field)}</span>
        <strong className={f.status === 'unknown' ? styles.unknownValue : ''}>
          {displayFact(bank.profile, field)}
        </strong>
        <ExternalLink size={12} aria-label="Inspect evidence" />
      </summary>
      <div className={styles.factEvidence}>
        <small>
          {f.status.toUpperCase()} · Confidence: {f.confidence}
        </small>
        <p>
          {f.notes ||
            (f.status === 'unknown'
              ? 'No current official source found.'
              : 'Claim supported by the linked source; check product scope and date.')}
        </p>
        {bank.profile && <Sources profile={bank.profile} ids={f.sourceIds} />}
        <VerificationButton
          bank={bank}
          target={`fact:${field}`}
          label={FACT_LABELS[field] ?? field}
        />
      </div>
    </details>
  );
}
export function exitLabel(exit: ReturnType<typeof exitAnalysis>) {
  if (exit.wire.fullBalanceSupported)
    return exit.wire.theoreticalArrivalWindow
      ? `Wire: ${exit.wire.theoreticalArrivalWindow.min}–${exit.wire.theoreticalArrivalWindow.max} business days*`
      : 'Full wire route; timing unknown';
  if (exit.ach.minimumInitiationDays !== null)
    return `ACH: at least ${exit.ach.minimumInitiationDays} banking days*`;
  return 'Exit time unknown';
}
export function DecisionTable({
  comparison: c,
  inspect,
}: {
  comparison: Comparison;
  inspect: (id: string) => void;
}) {
  const [onDate, setDate] = useState(c.scenario.startDate),
    [sort, setSort] = useState('earnings'),
    [filter, setFilter] = useState('all');
  const date =
    onDate < c.scenario.startDate
      ? c.scenario.startDate
      : onDate > c.scenario.endDate
        ? c.scenario.endDate
        : onDate;
  const rows = useMemo(
    () =>
      [...c.ranked, ...c.excluded].map((r) => {
        const b = c.bankSnapshot.banks.find((b) => b.id === r.bankId)!,
          day = r.daily.find((d) => d.date === date);
        const balance = day?.balance ?? c.scenario.startingCash;
        return {
          b,
          r,
          balance,
          exit: exitAnalysis(b.profile, balance, date, c.scenario.startDate),
          insurance: insuranceAnalysis(b.profile, balance, c.scenario.insurance),
          friction: frictionAnalysis(b.profile),
          history: c.decisions[b.id].history,
        };
      }),
    [c, date],
  );
  const getSort = (row: (typeof rows)[number]): number | null => {
    if (sort === 'earnings') return row.r.status === 'eligible' ? -row.r.netReturn : null;
    if (sort === 'apy') {
      const v = verifiedValue(row.b.profile, 'currentApy');
      return typeof v === 'number' ? -v : null;
    }
    if (sort === 'exit') {
      const estimates = [
        row.exit.wire.theoreticalArrivalWindow?.max,
        row.exit.ach.constraintsIncomplete ? undefined : row.exit.ach.theoreticalArrivalWindow?.max,
      ].filter((n): n is number => n !== undefined);
      return estimates.length ? Math.min(...estimates) : null;
    }
    if (sort === 'fdic') return row.insurance.potentiallyUninsured;
    if (sort === 'friction') return row.friction.score;
    if (sort === 'service') {
      const review = row.b.profile?.reviews.find(
        (r) => r.category === 'service' && r.rating !== null,
      );
      return review?.rating === undefined ? null : -(review.rating ?? 0);
    }
    return row.history.incomplete ? null : row.history.observed.standardDeviation;
  };
  const shown = rows
    .filter(
      ({ b }) =>
        filter === 'all' ||
        (filter === 'free' && verifiedValue(b.profile, 'monthlyFee') === 0) ||
        (filter === 'atm' &&
          (verifiedValue(b.profile, 'atmCard') === true ||
            verifiedValue(b.profile, 'debitCard') === true)) ||
        (filter === 'no-dd' && verifiedValue(b.profile, 'directDepositRequired') === false) ||
        (filter === 'no-linked' && verifiedValue(b.profile, 'linkedAccountRequired') === false),
    )
    .sort((a, b) => {
      const av = getSort(a),
        bv = getSort(b);
      return av === null
        ? bv === null
          ? a.b.name.localeCompare(b.b.name)
          : 1
        : bv === null
          ? -1
          : av - bv || a.b.name.localeCompare(b.b.name);
    });
  return (
    <section className={styles.decisionCard} aria-label="Liquidity and safety comparison">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>IF THE RATE CHANGES TOMORROW</span>
          <h3>Can you get your money back?</h3>
          <p>
            Returns are one part of the decision. Inspect exit rules and coverage for the cash on
            this date.
          </p>
        </div>
      </div>
      <div className={styles.researchControls}>
        <label>
          Modeled balance date
          <input
            type="date"
            aria-label="Modeled balance date"
            min={c.scenario.startDate}
            max={c.scenario.endDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Sort by
          <select
            aria-label="Sort decision comparison"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="earnings">Projected earnings</option>
            <option value="apy">Current savings APY</option>
            <option value="exit">Fastest documented exit estimate</option>
            <option value="fdic">Lowest estimated uninsured cash</option>
            <option value="friction">Lowest complete friction score</option>
            <option value="service">Service-specific review rating</option>
            <option value="stability">Complete historical stability</option>
          </select>
        </label>
        <label>
          Show
          <select
            aria-label="Filter decision comparison"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All selected accounts</option>
            <option value="free">No monthly fee</option>
            <option value="atm">Direct ATM / debit access</option>
            <option value="no-dd">No required direct deposit</option>
            <option value="no-linked">No linked product required</option>
          </select>
        </label>
      </div>
      <p className={styles.smallPrint}>
        Unknown values sort last. Review scores are never insurance or safety scores. Filters
        include only verified matches.
      </p>
      <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              <th>Account / modeled cash</th>
              <th>Regular savings APY</th>
              <th>Exit from settled cash</th>
              <th>Potentially uninsured</th>
              <th>Documented obstacles</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ b, r, balance, exit, insurance, friction }) => (
              <tr key={b.id}>
                <td>
                  <button className={styles.accountName} onClick={() => inspect(b.id)}>
                    <span>
                      {b.name}
                      <small>
                        {money(balance)} ·{' '}
                        {r.status === 'excluded' ? 'No earnings model' : 'before tax reserve'}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <FactView bank={b} field="currentApy" compact />
                </td>
                <td>
                  <button className={styles.evidenceButton} onClick={() => inspect(b.id)}>
                    {exitLabel(exit)}
                    <small>
                      {exit.ach.monthlyCap !== null
                        ? `ACH / month: ${money(exit.ach.monthlyCap)}`
                        : 'Monthly ACH cap unknown'}
                    </small>
                  </button>
                </td>
                <td>
                  <button
                    className={`${styles.evidenceButton} ${insurance.potentiallyUninsured ? styles.riskValue : ''}`}
                    onClick={() => inspect(b.id)}
                  >
                    {insurance.potentiallyUninsured === null
                      ? 'Unknown'
                      : money(insurance.potentiallyUninsured)}
                    <small>{insurance.aggregationGroup ?? 'Legal-bank group unverified'}</small>
                  </button>
                </td>
                <td>
                  <button className={styles.evidenceButton} onClick={() => inspect(b.id)}>
                    {friction.obstacles} of {friction.evaluated} known checks
                    <small>{friction.unknown} unknown · inspect profile</small>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && (
        <p className={styles.smallPrint}>
          No selected accounts have verified facts matching this filter.
        </p>
      )}
      <p className={styles.smallPrint}>
        *Theoretical lower bounds and documented processing times. Unknown caps, holds, cutoffs,
        holidays and reviews can delay access. A full-balance wire route can still require approval.
        Income and expense posting dates remain scenario assumptions.
      </p>
    </section>
  );
}

export function BankResearch({
  bank: b,
  scenario,
  comparison,
}: {
  bank: Bank;
  scenario?: Scenario | null;
  comparison?: Comparison | null;
}) {
  const [search, setSearch] = useState(''),
    [onlyKnown, setOnlyKnown] = useState(false),
    [balance, setBalance] = useState<number | null>(null),
    [series, setSeries] = useState<string | undefined>();
  const p = b.profile;
  const amount =
    balance ??
    comparison?.ranked.find((r) => r.bankId === b.id)?.endingBalance ??
    scenario?.startingCash ??
    278000;
  const onDate = comparison?.scenario.endDate ?? today();
  const exit = exitAnalysis(p, amount, onDate, scenario?.startDate ?? onDate);
  const insurance = insuranceAnalysis(
    p,
    amount,
    scenario?.insurance ?? { ownership: 'single', jointOwners: 2, otherDeposits: [] },
  );
  const hist = historyAnalysis(p, comparison?.evaluatedOn ?? today(), series);
  const known = Object.values(p?.facts ?? {}).filter((f) => f.status === 'verified').length;
  const fresh = freshness(p?.researchedAt ?? b.checkedOn, today());
  return (
    <div className={styles.researchProfile}>
      <div className={styles.profileIntro}>
        <strong>Evidence, not just a headline.</strong>
        <p>
          {known} verified facts · {p?.discoveries.length ?? 0} discoveries · Research{' '}
          {p?.researchedAt ?? 'unknown'} · {fresh.ageDays} days old ({fresh.label})
        </p>
        <p>
          Rate effective date: {b.rateAsOf ?? 'not stated by provider'}. Unknown is an unresolved
          question, not a negative finding.
        </p>
      </div>
      <BankCustomerReviews bank={b} />
      <details className={styles.researchSection} open>
        <summary>
          Discoveries & manual checks <span>{p?.discoveries.length ?? 0}</span>
        </summary>
        {!p?.discoveries.length && <p>No discovery log in this imported snapshot.</p>}
        {p?.discoveries.map((d) => (
          <article key={d.id} className={styles.discovery}>
            <small>
              {d.date} · {d.category} · {d.status}
            </small>
            <h4>{d.title}</h4>
            <p>{d.finding}</p>
            <p>
              <strong>Why it matters:</strong> {d.implication}
            </p>
            <p>
              <strong>Check manually:</strong> {d.action}
            </p>
            <Sources profile={p} ids={d.sourceIds} />
            <VerificationButton bank={b} target={`discovery:${d.id}`} label={d.title} />
          </article>
        ))}
        {p && (
          <button
            onClick={() =>
              save(
                `${b.id}-discoveries-${p.researchedAt}.json`,
                JSON.stringify(
                  {
                    bankId: b.id,
                    researchDate: p.researchedAt,
                    discoveries: p.discoveries,
                    conflicts: p.conflicts,
                    researchLog: p.researchLog,
                    sources: p.sources,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            <ArrowDownToLine size={14} /> Download discovery log
          </button>
        )}
      </details>
      <details className={styles.researchSection} open>
        <summary>Liquidity & insurance stress test</summary>
        <label className={styles.field}>
          <span>Cash to assess (before tax)</span>
          <input
            aria-label="Cash for exit stress test"
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setBalance(Math.max(0, Math.min(1e12, Number(e.target.value))))}
          />
        </label>
        <div className={styles.stressButtons}>
          {[50000, 100000, 250000, 500000].map((n) => (
            <button key={n} onClick={() => setBalance(n)}>
              ${n / 1000}k
            </button>
          ))}
        </div>
        <div className={styles.stressSummary}>
          <div>
            <span>Theoretical exit</span>
            <strong>{exitLabel(exit)}</strong>
          </div>
          <div>
            <span>Estimated FDIC-insured</span>
            <strong>{insurance.insured === null ? 'Unknown' : money(insurance.insured)}</strong>
          </div>
          <div>
            <span>Potentially uninsured</span>
            <strong className={insurance.potentiallyUninsured ? styles.riskValue : ''}>
              {insurance.potentiallyUninsured === null
                ? 'Unknown'
                : money(insurance.potentiallyUninsured)}
            </strong>
          </div>
        </div>
        <p className={styles.smallPrint}>
          Date: {onDate}.{' '}
          {scenario
            ? 'Uses your ownership and related-deposit assumptions.'
            : 'Illustration: one single owner, no other same-bank deposits.'}
        </p>
        <ul className={styles.riskList}>
          {[...exit.warnings, ...insurance.warnings].map((w, i) => (
            <li key={i}>
              <ShieldAlert size={15} />
              <span>{w}</span>
            </li>
          ))}
        </ul>
        <p>
          <strong>ACH initiation:</strong>{' '}
          {exit.ach.minimumInitiationDays === null
            ? 'Unknown'
            : `at least ${exit.ach.minimumInitiationDays} banking days / ${exit.ach.calendarDays} calendar days`}
          . <strong>Documented processing:</strong>{' '}
          {exit.ach.documentedProcessing
            ? `${exit.ach.documentedProcessing.min}–${exit.ach.documentedProcessing.max} business days`
            : 'Unknown'}
          .
        </p>
        <p>
          <strong>ACH theoretical arrival window:</strong>{' '}
          {exit.ach.theoreticalArrivalWindow
            ? `${exit.ach.theoreticalArrivalWindow.min}–${exit.ach.theoreticalArrivalWindow.max} business days from first initiation (known caps only)`
            : 'Unknown'}
          .
        </p>
        <p>
          <strong>Estimated real-world window:</strong> Unknown. {exit.explanation}
        </p>
        <p className={styles.smallPrint}>{exit.ach.reasons.join(' ')}</p>
        <p className={styles.smallPrint}>
          {insurance.assumption}{' '}
          <a href={insurance.source.url} target="_blank" rel="noreferrer">
            FDIC coverage source · {insurance.source.accessedAt}
          </a>
        </p>
        <div>
          {[
            'outgoingAchDaily',
            'outgoingAchMonthly',
            'outgoingWireSupported',
            'outgoingWirePerTransaction',
            'wireNoPublishedCap',
            'outgoingWireFee',
            'legalInstitutionName',
            'fdicAggregationGroup',
            'ownershipNotes',
          ].map((field) => (
            <FactView key={field} bank={b} field={field} />
          ))}
        </div>
      </details>
      <details className={styles.researchSection}>
        <summary>
          Historical APY <span>{p?.rateHistory.length ?? 0} observations</span>
        </summary>
        <label className={styles.field}>
          <span>Rate series</span>
          <select
            aria-label="Historical rate series"
            value={hist.series}
            onChange={(e) => setSeries(e.target.value)}
          >
            {[...new Set(p?.rateHistory.map((h) => h.series) ?? ['regular'])].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <p>{hist.explanation}</p>
        <div className={styles.stressSummary}>
          {[hist.threeMonth, hist.sixMonth, hist.twelveMonth].map((w, i) => (
            <div key={i}>
              <span>{[3, 6, 12][i]}-month average</span>
              <strong>{w.average === null ? 'Unknown' : `${w.average}%`}</strong>
              <small>
                {w.coveredDays}/{w.totalDays} days documented
              </small>
            </div>
          ))}
        </div>
        <p>
          History {hist.incomplete ? 'incomplete' : 'complete'} for {hist.series}. Observed
          low/high: {hist.observed.minimum ?? 'Unknown'} / {hist.observed.maximum ?? 'Unknown'}%.
          Observed changes: {hist.observed.changes ?? 'Unknown'}. Observed standard deviation:{' '}
          {hist.observed.standardDeviation ?? 'Unknown'} percentage points.
        </p>
        <p>
          Average observed cut / increase: {hist.observed.averageCut ?? 'Unknown'} /{' '}
          {hist.observed.averageIncrease ?? 'Unknown'} percentage points. Current vs 12-month
          average: {hist.currentVsTwelveMonthAverage ?? 'Unknown'}. Current range percentile:{' '}
          {hist.currentRangePercentile ?? 'Unknown'}.
        </p>
        {p?.rateHistory.map((h, i) => (
          <div className={styles.discovery} key={i}>
            <strong>
              {h.date} · {h.apy}% APY
            </strong>
            <p>
              {h.product} · {h.tier} · Series: {h.series} · {h.confidence} confidence
            </p>
            <Sources profile={p} ids={h.sourceIds} />
            <VerificationButton
              bank={b}
              target={`history:${i}`}
              label={`Rate observation ${h.date}`}
            />
          </div>
        ))}
      </details>
      <details className={styles.researchSection}>
        <summary>
          Independent reviews & reputation <span>{p?.reviews.length ?? 0} listings</span>
        </summary>
        <p>
          Customer sentiment is separate from FDIC coverage and legal-bank identity. Ratings cover
          different products, dates and populations. Company scores are not verified savings
          customer-service scores.
        </p>
        {!p?.reviews.length && (
          <p>No reliable current account-specific rating/count pair found. Reputation: Unknown.</p>
        )}
        {p?.reviews.map((r) => (
          <div className={styles.discovery} key={r.id}>
            <strong>
              {r.category === 'app' ? 'App reputation' : 'Company sentiment'}:{' '}
              {r.rating === null ? 'Rating unknown' : `${r.rating}/5`}
            </strong>
            <p>
              {r.reviewCount === null
                ? 'Count unknown'
                : `${r.reviewCount.toLocaleString()} reviews/ratings`}{' '}
              · Observed {r.ratingDate} · Accessed {r.accessedAt} · {r.scope}
            </p>
            <p>{r.notes}</p>
            <Sources profile={p} ids={r.sourceIds} />
            <VerificationButton bank={b} target={`review:${r.id}`} label={r.scope} />
          </div>
        ))}
        <h4>Recurring reports</h4>
        {p?.themes.length ? (
          p.themes.map((t, i) => (
            <div key={i}>
              <p>
                {t.description} ({t.reportCount} independent reports)
              </p>
              <p>{t.notes}</p>
              <Sources profile={p} ids={t.sourceIds} />
              <VerificationButton bank={b} target={`theme:${i}`} label={t.description} />
            </div>
          ))
        ) : (
          <p>
            No recurring theme corroborated to the required standard. Individual anecdotes remain in
            the linked listings.
          </p>
        )}
      </details>
      {!!p?.conflicts.length && (
        <details className={styles.researchSection} open>
          <summary>
            Conflicting claims <span>{p.conflicts.length}</span>
          </summary>
          {p.conflicts.map((c, i) => (
            <div key={i} className={styles.discovery}>
              <h4>{FACT_LABELS[c.key] ?? c.key}</h4>
              {c.claims.map((claim, j) => (
                <div key={j}>
                  <p>
                    {String(claim.value)} · {claim.notes}
                  </p>
                  <Sources profile={p} ids={claim.sourceIds} />
                </div>
              ))}
              <VerificationButton bank={b} target={`conflict:${c.key}`} label={c.key} />
              <p>
                <strong>{c.resolved ? 'Resolution' : 'Unresolved'}:</strong> {c.resolution}
              </p>
            </div>
          ))}
        </details>
      )}
      <BankFeatures bank={b} />
      <VerificationNotebook />
      <h3>Fact-by-fact evidence</h3>
      <div className={styles.factSearch}>
        <Search size={16} />
        <input
          aria-label="Search bank facts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fees, wires, passkeys…"
        />
        <label>
          <input
            type="checkbox"
            checked={onlyKnown}
            onChange={(e) => setOnlyKnown(e.target.checked)}
          />{' '}
          Known only
        </label>
      </div>
      {Object.entries(FACT_GROUPS).map(([group, fields]) => {
        const keys = Object.entries(fields)
          .filter(
            ([key, label]) =>
              (`${key} ${label}`.toLowerCase().includes(search.toLowerCase()) ||
                group.toLowerCase().includes(search.toLowerCase())) &&
              (!onlyKnown || fact(p, key).status !== 'unknown'),
          )
          .map(([key]) => key);
        return keys.length ? (
          <details className={styles.researchSection} key={group} open={search ? true : undefined}>
            <summary>
              {group}
              <span>{keys.filter((k) => fact(p, k).status === 'unknown').length} unknown</span>
            </summary>
            {keys.map((field) => (
              <FactView key={field} bank={b} field={field} />
            ))}
          </details>
        ) : null;
      })}
      <details className={styles.researchSection}>
        <summary>Calculation inputs & their sources</summary>
        <p>
          Model choices and generic daily APY math are explained in the methodology. Numerical bank
          inputs below retain their own supporting evidence.
        </p>
        {Object.keys(p?.facts ?? {})
          .filter((k) => k.startsWith('calculation.'))
          .map((field) => (
            <FactView key={field} bank={b} field={field} />
          ))}
      </details>
      <details className={styles.researchSection}>
        <summary>Research coverage & remaining work</summary>
        {p?.researchLog.map((r, i) => (
          <div key={i} className={styles.discovery}>
            <strong>
              {r.area} · {r.outcome}
            </strong>
            <p>
              {r.date} · {r.notes}
            </p>
            <Sources profile={p} ids={r.sourceIds} />
            <VerificationButton bank={b} target={`log:${i}`} label={r.area} />
          </div>
        ))}
      </details>
    </div>
  );
}
