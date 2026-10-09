import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  FileUp,
  GitBranch,
  Landmark,
  Leaf,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { compare, type BankResult, type Comparison } from '../lib/engine';
import { readCatalog, readScenario, readableError, toYaml } from '../lib/files';
import { money, toCsv, toSvg } from '../lib/export';
import { type Bank, type Scenario } from '../lib/schema';
import catalogText from '../data/banks-2026-10-09.yaml?raw';
import exampleText from '../examples/working-person.yaml?raw';
import styles from './App.module.css';

const repo = 'https://github.com/mlo0352/hysacomp';
const initialCatalog = readCatalog(catalogText);
const example = readScenario(exampleText);
const shortMoney = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
const dateLabel = (s: string) =>
  new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
const download = (name: string, text: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const isModeled = (b: Bank) => b.verification === 'verified' && b.model !== 'unsupported';
const rate = (b: Bank) =>
  b.apy === null
    ? 'Unverified'
    : `${Math.max(b.apy, ...b.tiers.map((t) => t.apy), b.qualifiedApy ?? 0).toFixed(2)}%`;
const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function EmptyState({
  load,
  create,
  importFile,
}: {
  load: () => void;
  create: () => void;
  importFile: () => void;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIntro}>
        <span className={styles.eyebrow}>
          <span className={styles.dot} /> A LITTLE CLARITY FOR YOUR CASH
        </span>
        <h1>
          Your money.
          <br />A clearer plan.
        </h1>
        <p>
          A higher rate is only part of the story. Find the right home for your savings with your
          paydays, spending, and the fine print in the picture.
        </p>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={load}>
            Try the working-person example <ArrowRight size={17} />
          </button>
          <button onClick={create}>Start from scratch</button>
        </div>
        <button className={styles.textButton} onClick={importFile}>
          <FileUp size={16} /> Or import a scenario file
        </button>
        <div className={styles.exampleCaption}>
          EXAMPLE, NOT YOUR DATA
          <span>$25,000 saved · $2,500 biweekly take-home pay · 7 real accounts</span>
        </div>
      </div>
      <div
        className={styles.emptyVisual}
        aria-label="Salary and expenses flow through your savings into a comparison with your baseline"
      >
        <div className={styles.visualLabel}>
          <Sparkles size={16} /> FROM “WHAT IF” TO “THAT ONE.”
        </div>
        <div className={styles.flowTop}>
          <div>
            <Wallet size={20} />
            <span>Your paycheck</span>
          </div>
          <span className={styles.flowPlus}>+</span>
          <div>
            <Landmark size={20} />
            <span>Your savings</span>
          </div>
        </div>
        <div className={styles.flowConnector} />
        <div className={styles.flowCenter}>
          <span className={styles.logoMark}>b</span>
          <div>
            <strong>The full picture</strong>
            <span>Interest + bonuses − fees − tax</span>
          </div>
        </div>
        <div className={styles.flowConnector} />
        <div className={styles.flowBottom}>
          <TrendingUp size={23} />
          <div>
            <strong>See what beats doing nothing.</strong>
            <span>Every account. One honest comparison.</span>
          </div>
          <CheckCircle2 size={20} />
        </div>
        <div className={styles.visualFoot}>
          <ShieldCheck size={14} /> Your scenario stays in your browser.
        </div>
      </div>
      <div className={styles.emptyBenefits}>
        <div>
          <span>01</span>
          <strong>Bring your real life</strong>
          <p>Paydays, bills, and plans. A simple example gets you started.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Compare the actual dollars</strong>
          <p>Find the gain over your baseline after fees and estimated tax.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Take the work with you</strong>
          <p>Export your plan, results, or graph. Run it again with an AI agent.</p>
        </div>
      </div>
    </div>
  );
}

function PlanEditor({
  scenario: s,
  setScenario,
  banks,
  chooseBanks,
}: {
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  banks: Bank[];
  chooseBanks: () => void;
}) {
  const set = (key: keyof Scenario, value: unknown) => setScenario({ ...s, [key]: value });
  const [yamlDraft, setYamlDraft] = useState(''),
    [yamlError, setYamlError] = useState('');
  const updateFlow = (i: number, key: string, value: unknown) =>
    set(
      'flows',
      s.flows.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)),
    );
  return (
    <aside className={styles.plan}>
      <div className={styles.cardHeading}>
        <span>
          <SlidersHorizontal size={18} /> Your scenario
        </span>
        <span className={styles.smallTag}>LOCAL</span>
      </div>
      <Field label="Scenario name">
        <input value={s.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Starting savings" hint="Cash available at the start of your comparison.">
        <div className={styles.inputPrefix}>
          <span>$</span>
          <input
            aria-label="Starting savings"
            type="number"
            min="0"
            step="100"
            value={s.startingCash}
            onChange={(e) => set('startingCash', Number(e.target.value))}
          />
        </div>
      </Field>
      <div className={styles.twoCol}>
        <Field label="From">
          <input
            type="date"
            value={s.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
        </Field>
        <Field label="Through">
          <input type="date" value={s.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
      </div>
      <div className={styles.divider} />
      <div className={styles.sectionLabel}>
        MONEY IN & OUT{' '}
        <button
          className={styles.iconButton}
          aria-label="Add recurring cash flow"
          onClick={() =>
            set('flows', [
              ...s.flows,
              {
                id: `flow-${Date.now()}`,
                label: 'New cash flow',
                amount: 0,
                direction: 'in',
                cadence: 'monthly',
                interval: 1,
                dayOfMonth: 15,
                startDate: s.startDate,
                endDate: s.endDate,
                qualification: 'none',
              },
            ])
          }
        >
          <Plus size={17} />
        </button>
      </div>
      {!s.flows.length && (
        <p className={styles.muted}>Add your take-home pay and regular expenses.</p>
      )}
      {s.flows.map((f, i) => (
        <div className={styles.flowEditor} key={f.id}>
          <div className={styles.flowHeading}>
            <span className={f.direction === 'in' ? styles.incomeIcon : styles.expenseIcon}>
              {f.direction === 'in' ? '↙' : '↗'}
            </span>
            <strong>{f.label}</strong>
            <button
              className={styles.iconButton}
              aria-label={`Remove ${f.label}`}
              onClick={() =>
                set(
                  'flows',
                  s.flows.filter((_, idx) => idx !== i),
                )
              }
            >
              <X size={14} />
            </button>
          </div>
          <Field label={`${f.label} amount`}>
            <div className={styles.inputPrefix}>
              <span>$</span>
              <input
                type="number"
                min="0"
                value={f.amount}
                onChange={(e) => updateFlow(i, 'amount', Number(e.target.value))}
              />
              <span className={styles.inputSuffix}>
                {f.cadence === 'weekly' ? (f.interval === 2 ? '/ 2 weeks' : '/ week') : '/ month'}
              </span>
            </div>
          </Field>
          <details>
            <summary>Edit timing & type</summary>
            <div className={styles.detailsBody}>
              <Field label="Label">
                <input value={f.label} onChange={(e) => updateFlow(i, 'label', e.target.value)} />
              </Field>
              <div className={styles.twoCol}>
                <Field label="Direction">
                  <select
                    value={f.direction}
                    onChange={(e) =>
                      set(
                        'flows',
                        s.flows.map((flow, idx) =>
                          idx === i
                            ? { ...flow, direction: e.target.value, qualification: 'none' }
                            : flow,
                        ),
                      )
                    }
                  >
                    <option value="in">Money in</option>
                    <option value="out">Money out</option>
                  </select>
                </Field>
                <Field label="Repeats">
                  <select
                    value={`${f.cadence}-${f.interval}`}
                    onChange={(e) => {
                      const [cadence, interval] = e.target.value.split('-');
                      set(
                        'flows',
                        s.flows.map((flow, idx) =>
                          idx === i ? { ...flow, cadence, interval: Number(interval) } : flow,
                        ),
                      );
                    }}
                  >
                    <option value="monthly-1">Monthly</option>
                    <option value="weekly-1">Weekly</option>
                    <option value="weekly-2">Every 2 weeks</option>
                    {!['monthly-1', 'weekly-1', 'weekly-2'].includes(
                      `${f.cadence}-${f.interval}`,
                    ) && (
                      <option value={`${f.cadence}-${f.interval}`}>
                        Every {f.interval} {f.cadence === 'weekly' ? 'weeks' : 'months'}
                      </option>
                    )}
                  </select>
                </Field>
              </div>
              <Field label="First date">
                <input
                  type="date"
                  value={f.startDate}
                  onChange={(e) => updateFlow(i, 'startDate', e.target.value)}
                />
              </Field>
              <Field label="Last date">
                <input
                  type="date"
                  value={f.endDate}
                  onChange={(e) => updateFlow(i, 'endDate', e.target.value)}
                />
              </Field>
              {f.cadence === 'monthly' && (
                <Field label="Day of month">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={f.dayOfMonth}
                    onChange={(e) => updateFlow(i, 'dayOfMonth', Number(e.target.value))}
                  />
                </Field>
              )}
              {f.direction === 'in' && (
                <Field label="Deposit type">
                  <select
                    value={f.qualification}
                    onChange={(e) => updateFlow(i, 'qualification', e.target.value)}
                  >
                    <option value="none">Not qualifying / unknown</option>
                    <option value="payroll">Actual employer payroll</option>
                    <option value="external-deposit">External transfer (not payroll)</option>
                  </select>
                </Field>
              )}
            </div>
          </details>
        </div>
      ))}
      <div className={styles.divider} />
      <Field label="Your baseline APY" hint="What your cash earns if you leave it where it is.">
        <div className={styles.inputPrefix}>
          <input
            aria-label="Your baseline APY"
            type="number"
            min="0"
            max="100"
            step="0.05"
            value={s.baseline.apy}
            onChange={(e) =>
              set('baseline', {
                ...s.baseline,
                apy: Number(e.target.value),
                name: `Keep cash at ${e.target.value}% APY`,
              })
            }
          />
          <span>%</span>
        </div>
      </Field>
      <Field label="Estimated tax on earnings">
        <div className={styles.inputPrefix}>
          <input
            aria-label="Estimated tax on earnings"
            type="number"
            min="0"
            max="100"
            step="1"
            value={Number((s.taxRate * 100).toFixed(4))}
            onChange={(e) => set('taxRate', Number(e.target.value) / 100)}
          />
          <span>%</span>
        </div>
      </Field>
      <button className={styles.bankPickerButton} onClick={chooseBanks}>
        <Landmark size={17} />
        <span>{s.bankIds.length} accounts selected</span>
        <ChevronRight size={16} />
      </button>
      <details className={styles.advanced}>
        <summary>Transfers, events & offers</summary>
        <div className={styles.detailsBody}>
          <Field label="Opening transfer · business days">
            <input
              type="number"
              min="0"
              max="30"
              value={s.transfer.businessDays}
              onChange={(e) =>
                set('transfer', { ...s.transfer, businessDays: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Opening transfer fee ($)">
            <input
              type="number"
              min="0"
              value={s.transfer.fee}
              onChange={(e) => set('transfer', { ...s.transfer, fee: Number(e.target.value) })}
            />
          </Field>
          <Field label="Hold after arrival · calendar days">
            <input
              type="number"
              min="0"
              max="90"
              value={s.transfer.holdDays}
              onChange={(e) => set('transfer', { ...s.transfer, holdDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Baseline monthly fee ($)">
            <input
              type="number"
              min="0"
              value={s.baseline.monthlyFee}
              onChange={(e) =>
                set('baseline', { ...s.baseline, monthlyFee: Number(e.target.value) })
              }
            />
          </Field>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={s.eStatements}
              onChange={(e) => set('eStatements', e.target.checked)}
            />{' '}
            eStatements enabled
          </label>
          <div className={styles.sectionLabel}>
            ONE-TIME CASH EVENTS
            <button
              aria-label="Add cash event"
              className={styles.iconButton}
              onClick={() =>
                set('events', [
                  ...s.events,
                  { date: s.startDate, amount: 0, label: 'One-time event', qualification: 'none' },
                ])
              }
            >
              <Plus size={16} />
            </button>
          </div>
          {s.events.map((e, i) => (
            <div className={styles.eventEditor} key={i}>
              <Field label="Event label">
                <input
                  value={e.label}
                  onChange={(ev) =>
                    set(
                      'events',
                      s.events.map((v, idx) => (idx === i ? { ...v, label: ev.target.value } : v)),
                    )
                  }
                />
              </Field>
              <div className={styles.twoCol}>
                <Field label="Date">
                  <input
                    type="date"
                    value={e.date}
                    onChange={(ev) =>
                      set(
                        'events',
                        s.events.map((v, idx) => (idx === i ? { ...v, date: ev.target.value } : v)),
                      )
                    }
                  />
                </Field>
                <Field label="Amount (+/−)">
                  <input
                    type="number"
                    value={e.amount}
                    onChange={(ev) =>
                      set(
                        'events',
                        s.events.map((v, idx) =>
                          idx === i ? { ...v, amount: Number(ev.target.value) } : v,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              <button
                className={styles.textButton}
                onClick={() =>
                  set(
                    'events',
                    s.events.filter((_, idx) => idx !== i),
                  )
                }
              >
                Remove event
              </button>
            </div>
          ))}
          <div className={styles.sectionLabel}>CONFIRMED OFFER ELIGIBILITY</div>
          <p className={styles.muted}>
            Only enable an offer after checking that you meet its conditions. The example includes
            two fictional eligibility assumptions.
          </p>
          {banks
            .filter((b) => s.bankIds.includes(b.id))
            .flatMap((b) =>
              [...b.promotions, ...b.bonuses].map((p) => (
                <label className={styles.promoCheck} key={p.id}>
                  <input
                    type="checkbox"
                    checked={s.eligiblePromotionIds.includes(p.id)}
                    onChange={(e) =>
                      set(
                        'eligiblePromotionIds',
                        e.target.checked
                          ? [...s.eligiblePromotionIds, p.id]
                          : s.eligiblePromotionIds.filter((id) => id !== p.id),
                      )
                    }
                  />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.conditions}</small>
                  </span>
                </label>
              )),
            )}
        </div>
      </details>
      <details
        className={styles.advanced}
        onToggle={(e) => {
          if (e.currentTarget.open) setYamlDraft(toYaml(s));
        }}
      >
        <summary>Edit as YAML</summary>
        <div className={styles.detailsBody}>
          <textarea
            aria-label="Scenario YAML"
            value={yamlDraft}
            onChange={(e) => setYamlDraft(e.target.value)}
            rows={16}
            spellCheck={false}
          />
          {yamlError && (
            <p role="alert" className={styles.error}>
              {yamlError}
            </p>
          )}
          <button
            onClick={() => {
              try {
                setScenario(readScenario(yamlDraft));
                setYamlError('');
              } catch (e) {
                setYamlError(readableError(e));
              }
            }}
          >
            Apply YAML
          </button>
        </div>
      </details>
    </aside>
  );
}

function Results({ result: c, inspect }: { result: Comparison; inspect: (r: BankResult) => void }) {
  const [chartType, setChartType] = useState<'netReturn' | 'balance'>('netReturn');
  const best = c.winnerId === 'baseline' ? c.baseline : c.ranked[0];
  const series = [...c.ranked.slice(0, 4), c.baseline];
  const chartData = c.baseline.daily
    .filter(
      (_, i) =>
        i % Math.max(1, Math.floor(c.baseline.daily.length / 100)) === 0 ||
        i === c.baseline.daily.length - 1,
    )
    .map((d) => {
      const index = c.baseline.daily.findIndex((v) => v.date === d.date);
      return {
        date: d.date,
        ...Object.fromEntries(series.map((r) => [r.bankId, r.daily[index]?.[chartType]])),
      };
    });
  const colors = ['#426342', '#a07b37', '#698cab', '#9e78a0', '#a8afa1'];
  return (
    <div className={styles.results}>
      <section className={styles.winner} aria-label="Comparison winner">
        <div className={styles.winnerCopy}>
          <span className={styles.winnerBadge}>
            <TrendingUp size={14} />{' '}
            {c.winnerIds.length > 1
              ? 'JOINT LEADERS'
              : c.winnerId === 'baseline'
                ? 'YOUR BASELINE WINS'
                : 'BEST MODELED RETURN'}
          </span>
          <h2>
            {c.winnerIds.length > 1
              ? c.ranked
                  .filter((r) => c.winnerIds.includes(r.bankId))
                  .map((r) => r.name)
                  .join(' & ')
              : best.name}
          </h2>
          <p>
            {c.winnerId === 'baseline' ? (
              'Keeping your cash where it is matches or beats the selected modeled accounts.'
            ) : (
              <>
                Earn <strong>{money(best.incrementalGain)} more</strong> than your baseline over
                this plan.
              </>
            )}
          </p>
          <button className={styles.textButton} onClick={() => inspect(best)}>
            See the calculation <ArrowUpRight size={15} />
          </button>
        </div>
        <div className={styles.winnerAmount}>
          <span>AFTER-TAX EARNINGS</span>
          <strong>{money(best.netReturn)}</strong>
          <small>
            {c.winnerId !== 'baseline'
              ? `${money(Math.max(0, c.gapToRunnerUp))} ahead of the next best option`
              : `${c.ranked.length} eligible alternatives compared`}
          </small>
        </div>
      </section>
      <div className={styles.metricRow}>
        <div>
          <span>Starting savings</span>
          <strong>{shortMoney(c.scenario.startingCash)}</strong>
        </div>
        <div>
          <span>Baseline earnings</span>
          <strong>{money(c.baseline.netReturn)}</strong>
        </div>
        <div>
          <span>Winner’s ending cash</span>
          <strong>{shortMoney(best.endingAfterTax)}</strong>
          <small>after estimated tax</small>
        </div>
        <div>
          <span>Comparison period</span>
          <strong>{c.baseline.daily.length} days</strong>
          <small>
            {c.ranked.length} ranked · {c.excluded.length} excluded
          </small>
        </div>
      </div>
      <section className={styles.chartCard}>
        <div className={styles.sectionHeading}>
          <div>
            <h3>The difference adds up.</h3>
            <p>
              {chartType === 'netReturn'
                ? 'Cumulative earnings after fees and estimated tax.'
                : 'Account balances before the estimated tax reserve.'}
            </p>
          </div>
          <div className={styles.segmented}>
            <button
              aria-pressed={chartType === 'netReturn'}
              onClick={() => setChartType('netReturn')}
            >
              Earnings
            </button>
            <button aria-pressed={chartType === 'balance'} onClick={() => setChartType('balance')}>
              Balance
            </button>
          </div>
        </div>
        <div
          className={styles.chart}
          role="img"
          aria-label="Cumulative forecast for the top four accounts and baseline"
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 15, right: 15, left: 5, bottom: 5 }}>
              <CartesianGrid stroke="#e8ebe3" vertical={false} />
              <XAxis
                dataKey="date"
                minTickGap={60}
                tickFormatter={(v) =>
                  new Date(v + 'T00:00:00Z').toLocaleDateString('en-US', {
                    month: 'short',
                    year: '2-digit',
                    timeZone: 'UTC',
                  })
                }
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#7a8474' }}
              />
              <YAxis
                width={55}
                tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#7a8474' }}
              />
              <Tooltip
                formatter={(value) => money(Number(value))}
                labelFormatter={(label) => dateLabel(String(label))}
                contentStyle={{ borderRadius: 12, borderColor: '#dce3d5', fontSize: 12 }}
              />
              {series.map((r, i) => (
                <Line
                  key={r.bankId}
                  name={r.name}
                  type="monotone"
                  dataKey={r.bankId}
                  stroke={colors[i]}
                  strokeWidth={i === 0 ? 3 : 1.7}
                  strokeDasharray={r.bankId === 'baseline' ? '5 5' : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.legend}>
          {series.map((r, i) => (
            <span key={r.bankId}>
              <i style={{ background: colors[i] }} />
              {r.bankId === 'baseline' ? 'Your baseline' : r.name}
            </span>
          ))}
        </div>
      </section>
      <section className={styles.tableCard}>
        <div className={styles.sectionHeading}>
          <div>
            <h3>Your accounts, compared.</h3>
            <p>Ranked by dollars you keep. Click an account for the details.</p>
          </div>
          <span className={styles.smallTag}>AFTER TAX</span>
        </div>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Interest</th>
                <th scope="col">Bonus</th>
                <th scope="col">Fees</th>
                <th scope="col">Net earnings</th>
                <th scope="col">vs. baseline</th>
              </tr>
            </thead>
            <tbody>
              {c.ranked.map((r) => (
                <tr key={r.bankId} className={c.winnerIds.includes(r.bankId) ? styles.bestRow : ''}>
                  <td>
                    <button className={styles.accountName} onClick={() => inspect(r)}>
                      <span className={styles.rank}>{r.rank}</span>
                      <span>
                        {r.name}
                        <small>Checked {r.checkedOn}</small>
                      </span>
                    </button>
                  </td>
                  <td>{money(r.interest)}</td>
                  <td>{money(r.bonuses)}</td>
                  <td>{money(r.fees)}</td>
                  <td>
                    <strong>{money(r.netReturn)}</strong>
                  </td>
                  <td className={r.incrementalGain > 0 ? styles.positive : ''}>
                    {r.incrementalGain > 0 ? '+' : ''}
                    {money(r.incrementalGain)}
                  </td>
                </tr>
              ))}
              <tr className={styles.baselineRow}>
                <td>
                  <button className={styles.accountName} onClick={() => inspect(c.baseline)}>
                    <span className={styles.rank}>↔</span>
                    <span>
                      Your baseline
                      <small>{c.scenario.baseline.apy.toFixed(2)}% APY · stays parked</small>
                    </span>
                  </button>
                </td>
                <td>{money(c.baseline.interest)}</td>
                <td>—</td>
                <td>{money(c.baseline.fees)}</td>
                <td>
                  <strong>{money(c.baseline.netReturn)}</strong>
                </td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        {!!c.excluded.length && (
          <details className={styles.exclusions}>
            <summary>{c.excluded.length} accounts excluded from ranking</summary>
            {c.excluded.map((r) => (
              <div key={r.bankId}>
                <strong>{r.name}</strong>
                <p>{r.exclusionReason}</p>
              </div>
            ))}
          </details>
        )}
      </section>
      <details className={styles.assumptions}>
        <summary>
          <CircleHelp size={16} /> What this comparison assumes
        </summary>
        <ul>
          {c.assumptions.map((t) => (
            <li key={t}>{t}</li>
          ))}
          {c.scenario.notes.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
      <div className={styles.exportRow}>
        <span>TAKE IT WITH YOU</span>
        <button
          onClick={() =>
            download('butter-comparison.json', JSON.stringify(c, null, 2), 'application/json')
          }
        >
          <ArrowDownToLine size={14} /> Raw JSON
        </button>
        <button onClick={() => download('butter-comparison.csv', toCsv(c), 'text/csv')}>
          <ArrowDownToLine size={14} /> CSV
        </button>
        <button onClick={() => download('butter-comparison.svg', toSvg(c), 'image/svg+xml')}>
          <ArrowDownToLine size={14} /> Graph SVG
        </button>
      </div>
    </div>
  );
}

function AgentGuide() {
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState('');
  const prompt =
    'Use https://github.com/mlo0352/hysacomp. Read AGENTS.md and docs/AGENT_GUIDE.md. Ask for my starting cash, dates, take-home salary, expenses, baseline APY and tax estimate. Create a schema 2.0 scenario YAML. Verify bank sources and dates without inventing rates or eligibility. Run the local CLI with explicit scenario and bank files. Return the comparison JSON and SVG, explain the gain over baseline, and list excluded offers and assumptions. Never upload my personal scenario to GitHub.';
  return (
    <div className={styles.agentPage}>
      <span className={styles.eyebrow}>
        <Code2 size={16} /> BUILT FOR PEOPLE. READY FOR AGENTS.
      </span>
      <h1>
        Your AI brings the context.
        <br />
        Butter does the math.
      </h1>
      <p className={styles.lead}>
        Use the simple browser interface for a quick comparison. For deeper planning, use Butter
        locally with your favorite AI coding agent. Your files, a reproducible result, and no API
        key required.
      </p>
      <div className={styles.agentGrid}>
        <section className={styles.card}>
          <span className={styles.step}>01 / GET THE TOOL</span>
          <h3>Clone it. Run it. Keep it local.</h3>
          <pre>
            <code>
              git clone {repo}.git{'\n'}cd hysacomp{'\n'}npm ci{'\n'}npm run dev
            </code>
          </pre>
          <a href={repo} target="_blank" rel="noreferrer">
            Open the repository <ArrowUpRight size={14} />
          </a>
        </section>
        <section className={styles.card}>
          <span className={styles.step}>02 / GIVE YOUR AGENT A START</span>
          <h3>A prompt with the right guardrails.</h3>
          <p>{prompt}</p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setCopied(true);
                setCopyError('');
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopyError('Clipboard unavailable. Select and copy the prompt above.');
              }
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy agent prompt'}
          </button>
          {copyError && <small role="status">{copyError}</small>}
        </section>
      </div>
      <section className={styles.cliCard}>
        <div>
          <span className={styles.eyebrow}>03 / ONE ENGINE, EVERYWHERE</span>
          <h3>
            A proper tool call.
            <br />A real result.
          </h3>
          <p>
            The browser and CLI share the same deterministic calculation engine. JSON includes daily
            balances, warnings, sources and tasks. SVG is a standalone image.
          </p>
        </div>
        <pre>
          <code>
            npx tsx cli.ts compare \{'\n'} --scenario examples/working-person.yaml \{'\n'} --banks
            data/banks-2026-10-09.yaml \{'\n'} --output outputs/comparison.json \{'\n'} --graph
            outputs/comparison.svg{'\n\n'}# Also: --format csv, validate, banks, --help
          </code>
        </pre>
      </section>
      <div className={styles.docLinks}>
        <a href={`${repo}/blob/main/AGENTS.md`}>
          AGENTS.md <ArrowUpRight size={15} />
        </a>
        <a href={`${repo}/blob/main/docs/AGENT_GUIDE.md`}>
          Agent guide & prompts <ArrowUpRight size={15} />
        </a>
        <a href={`${repo}/tree/main/schemas`}>
          JSON schemas <ArrowUpRight size={15} />
        </a>
        <a href={`${repo}/blob/main/docs/METHODOLOGY.md`}>
          How the math works <ArrowUpRight size={15} />
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<'compare' | 'banks' | 'agents'>('compare');
  const [catalog, setCatalog] = useState(initialCatalog),
    [scenario, setScenario] = useState<Scenario | null>(null);
  const [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [search, setSearch] = useState('');
  const [inspected, setInspected] = useState<string | null>(null);
  const scenarioFile = useRef<HTMLInputElement>(null),
    bankFile = useRef<HTMLInputElement>(null);
  const calculation = useMemo(() => {
    if (!scenario) return { result: null, error: '' };
    try {
      return { result: compare(scenario, catalog), error: '' };
    } catch (e) {
      return { result: null, error: readableError(e) };
    }
  }, [scenario, catalog]);
  const selectedResult = calculation.result
    ? [
        calculation.result.baseline,
        ...calculation.result.ranked,
        ...calculation.result.excluded,
      ].find((r) => r.bankId === inspected)
    : undefined;
  const selectedBank = catalog.banks.find((b) => b.id === inspected);
  const loadExample = () => {
    setCatalog(initialCatalog);
    setScenario(structuredClone(example));
    setError('');
    setNotice(
      'Illustrative example loaded. All amounts, accounts, and eligibility assumptions are editable.',
    );
    setTab('compare');
  };
  const create = () => {
    setScenario({
      ...structuredClone(example),
      id: 'my-scenario',
      name: 'My savings plan',
      startingCash: 0,
      flows: [],
      eligiblePromotionIds: [],
      notes: [],
      bankIds: catalog.banks
        .filter(isModeled)
        .slice(0, 7)
        .map((b) => b.id),
    });
    setNotice('New scenario created. Enter your starting savings and cash flows.');
    setTab('compare');
  };
  const importFile = async (file: File | undefined, kind: 'scenario' | 'banks') => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('File exceeds the 2 MB limit.');
      const text = await file.text();
      if (kind === 'scenario') {
        setScenario(readScenario(text));
        setTab('compare');
      } else setCatalog(readCatalog(text));
      setError('');
      setNotice(
        `Loaded ${file.name}. ${kind === 'banks' ? 'Selection and source dates are visible in the bank library.' : 'Review your assumptions before using the result.'}`,
      );
    } catch (e) {
      setError(readableError(e));
    }
  };
  const toggleBank = (id: string) => {
    if (scenario)
      setScenario({
        ...scenario,
        bankIds: scenario.bankIds.includes(id)
          ? scenario.bankIds.filter((v) => v !== id)
          : [...scenario.bankIds, id],
      });
  };
  return (
    <div className={styles.app}>
      <a className={styles.skipLink} href="#main">
        Skip to main content
      </a>
      <header className={styles.header}>
        <a
          href="#"
          className={styles.brand}
          onClick={(e) => {
            e.preventDefault();
            setTab('compare');
          }}
        >
          <span className={styles.logoMark}>b</span>butter
          <span className={styles.brandCaption}>cash, with clarity.</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={tab === 'compare' ? styles.activeNav : ''}
            onClick={() => setTab('compare')}
          >
            Compare
          </button>
          <button
            className={tab === 'banks' ? styles.activeNav : ''}
            onClick={() => setTab('banks')}
          >
            Bank library <span>{catalog.banks.length}</span>
          </button>
          <button
            className={tab === 'agents' ? styles.activeNav : ''}
            onClick={() => setTab('agents')}
          >
            <Code2 size={15} /> For AI agents
          </button>
        </nav>
        <a href={repo} target="_blank" rel="noreferrer" className={styles.githubLink}>
          <GitBranch size={18} />
          <span>GitHub</span>
          <ArrowUpRight size={13} />
        </a>
      </header>
      <div className={styles.snapshot}>
        <span>
          <span className={styles.dot} /> Bank data checked{' '}
          <strong>{dateLabel(catalog.checkedOn)}</strong>
          <span className={styles.snapshotDivider}>/</span>
          {catalog.banks.filter(isModeled).length} modeled · {catalog.banks.length} reviewed
        </span>
        <button className={styles.textButton} onClick={() => setTab('banks')}>
          View sources <ArrowUpRight size={13} />
        </button>
      </div>
      <input
        ref={scenarioFile}
        aria-label="Import scenario file"
        type="file"
        hidden
        accept=".yaml,.yml,.json,.xml"
        onChange={(e) => {
          void importFile(e.target.files?.[0], 'scenario');
          e.target.value = '';
        }}
      />
      <input
        ref={bankFile}
        aria-label="Import bank file"
        type="file"
        hidden
        accept=".yaml,.yml,.json,.xml"
        onChange={(e) => {
          void importFile(e.target.files?.[0], 'banks');
          e.target.value = '';
        }}
      />
      <main id="main" className={styles.main}>
        {notice && (
          <div role="status" className={styles.notice}>
            <CheckCircle2 size={16} />
            <span>{notice}</span>
            <button
              aria-label="Dismiss notice"
              className={styles.iconButton}
              onClick={() => setNotice('')}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className={styles.error}>
            {error}
            <button onClick={() => setError('')}>Dismiss</button>
          </div>
        )}
        {tab === 'compare' && !scenario && (
          <EmptyState
            load={loadExample}
            create={create}
            importFile={() => scenarioFile.current?.click()}
          />
        )}
        {tab === 'compare' && scenario && (
          <>
            <div className={styles.pageHeading}>
              <div>
                <span className={styles.eyebrow}>YOUR CASH, WORKING HARDER</span>
                <h1>Let’s find its best home.</h1>
                <p>Same money. Same life. A better-informed choice.</p>
              </div>
              <div className={styles.actions}>
                <button onClick={() => scenarioFile.current?.click()}>
                  <FileUp size={15} /> Import
                </button>
                <button
                  onClick={() => download('my-scenario.yaml', toYaml(scenario), 'application/yaml')}
                >
                  <ArrowDownToLine size={15} /> Save scenario
                </button>
                <button
                  className={styles.iconButton}
                  aria-label="Clear scenario"
                  title="Clear scenario"
                  onClick={() => {
                    setScenario(null);
                    setNotice(
                      'Scenario cleared. Save a scenario file before leaving if you want to keep your plan.',
                    );
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
            <div className={styles.workspace}>
              <PlanEditor
                scenario={scenario}
                setScenario={setScenario}
                banks={catalog.banks}
                chooseBanks={() => setTab('banks')}
              />
              {calculation.result ? (
                <Results result={calculation.result} inspect={(r) => setInspected(r.bankId)} />
              ) : (
                <div className={styles.calculationError} role="alert">
                  <CircleHelp size={25} />
                  <h2>A detail needs your attention.</h2>
                  <p>{calculation.error}</p>
                  <p>
                    Adjust your plan to see a valid comparison. If the bank IDs are missing, load
                    the matching bank file or change the selection.
                  </p>
                  <button onClick={() => setTab('banks')}>Choose accounts</button>
                </div>
              )}
            </div>
          </>
        )}
        {tab === 'banks' && (
          <div className={styles.bankPage}>
            <div className={styles.pageHeading}>
              <div>
                <span className={styles.eyebrow}>REAL ACCOUNTS. VISIBLE SOURCES.</span>
                <h1>The bank library.</h1>
                <p>
                  Checked {dateLabel(catalog.checkedOn)}. Every rate has a source. Every unknown
                  stays visible.
                </p>
              </div>
              <div className={styles.actions}>
                <button onClick={() => bankFile.current?.click()}>
                  <FileUp size={15} /> Import banks
                </button>
                <button onClick={() => download('banks.yaml', toYaml(catalog), 'application/yaml')}>
                  <ArrowDownToLine size={15} /> Export banks
                </button>
              </div>
            </div>
            <div className={styles.libraryToolbar}>
              <input
                aria-label="Search banks"
                placeholder="Search a bank or institution…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className={styles.actions}>
                {scenario ? (
                  <>
                    <button
                      onClick={() =>
                        setScenario({
                          ...scenario,
                          bankIds: catalog.banks.filter(isModeled).map((b) => b.id),
                        })
                      }
                    >
                      Select all modeled
                    </button>
                    <button className={styles.primary} onClick={() => setTab('compare')}>
                      Compare {scenario.bankIds.length} accounts <ArrowRight size={15} />
                    </button>
                  </>
                ) : (
                  <button onClick={create}>Create a scenario to choose accounts</button>
                )}
              </div>
            </div>
            <p className={styles.libraryNote}>
              “Verified” covers the modeled rate and terms. Some promotions need extra modeling and
              are explicitly excluded. Click any account for evidence and limitations.
            </p>
            <div className={styles.bankGrid}>
              {catalog.banks
                .filter((b) =>
                  `${b.name} ${b.institution}`.toLowerCase().includes(search.toLowerCase()),
                )
                .map((b) => (
                  <article
                    className={`${styles.bankCard} ${scenario?.bankIds.includes(b.id) ? styles.selectedBank : ''}`}
                    key={b.id}
                  >
                    <div className={styles.bankCardTop}>
                      <span className={styles.bankAvatar}>{initials(b.institution)}</span>
                      <span className={isModeled(b) ? styles.verified : styles.review}>
                        {isModeled(b) ? (
                          <>
                            <Check size={12} /> Verified model
                          </>
                        ) : b.verification === 'verified' ? (
                          'Needs model'
                        ) : (
                          'Needs review'
                        )}
                      </span>
                      {scenario && (
                        <input
                          type="checkbox"
                          aria-label={`Compare ${b.name}`}
                          checked={scenario.bankIds.includes(b.id)}
                          onChange={() => toggleBank(b.id)}
                        />
                      )}
                    </div>
                    <button className={styles.bankTitle} onClick={() => setInspected(b.id)}>
                      {b.name}
                      <ArrowUpRight size={15} />
                    </button>
                    <div className={styles.bankRate}>
                      {rate(b)}
                      <span>
                        {b.apy === null
                          ? 'Current rate unresolved'
                          : b.model === 'whole-balance' || b.model === 'rolling-payroll'
                            ? 'top modeled APY · conditions apply'
                            : 'base APY · variable'}
                      </span>
                    </div>
                    <div className={styles.bankCardBottom}>
                      <span>Checked {b.checkedOn}</span>
                      <a href={b.sourceUrl} target="_blank" rel="noreferrer">
                        Official source <ArrowUpRight size={12} />
                      </a>
                    </div>
                  </article>
                ))}
            </div>
            {!catalog.banks.some((b) =>
              `${b.name} ${b.institution}`.toLowerCase().includes(search.toLowerCase()),
            ) && (
              <p className={styles.emptySearch}>
                No accounts match “{search}”. Try another bank name.
              </p>
            )}
          </div>
        )}
        {tab === 'agents' && <AgentGuide />}
      </main>
      <footer className={styles.footer}>
        <span>
          <Leaf size={15} /> A little more from the money you already have.
        </span>
        <span>
          Local calculations · No account connections ·{' '}
          <a href={`${repo}/blob/main/docs/METHODOLOGY.md`}>Methodology</a>
        </span>
        <span>Butter v2.0</span>
      </footer>
      {inspected && (selectedBank || selectedResult) && (
        <div className={styles.modalBackdrop} onClick={() => setInspected(null)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Account details"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setInspected(null);
              if (e.key === 'Tab') {
                const focusable = [
                  ...e.currentTarget.querySelectorAll<HTMLElement>(
                    'button, a[href], input, [tabindex="0"]',
                  ),
                ];
                const first = focusable[0],
                  last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <button
              autoFocus
              className={styles.modalClose}
              aria-label="Close account details"
              onClick={() => setInspected(null)}
            >
              <X size={20} />
            </button>
            <span className={styles.eyebrow}>THE DETAILS BEHIND THE DOLLARS</span>
            <h2>{selectedBank?.name ?? selectedResult?.name}</h2>
            {selectedBank && (
              <>
                <p className={styles.sourceDates}>
                  Checked <strong>{selectedBank.checkedOn}</strong> · Rate effective{' '}
                  <strong>{selectedBank.rateAsOf ?? 'not published'}</strong>
                </p>
                <p>{selectedBank.evidence}</p>
                <a href={selectedBank.sourceUrl} target="_blank" rel="noreferrer">
                  Read the official source <ArrowUpRight size={14} />
                </a>
                {selectedBank.additionalSources.map((url, i) => (
                  <a
                    className={styles.extraSource}
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Supporting source {i + 1} <ArrowUpRight size={12} />
                  </a>
                ))}
              </>
            )}
            {selectedResult?.status === 'eligible' && (
              <>
                <h3>The return breakdown</h3>
                <dl className={styles.breakdown}>
                  <dt>Interest</dt>
                  <dd>{money(selectedResult.interest)}</dd>
                  <dt>Bonuses</dt>
                  <dd>{money(selectedResult.bonuses)}</dd>
                  <dt>Fees</dt>
                  <dd>−{money(selectedResult.fees)}</dd>
                  <dt>Estimated tax</dt>
                  <dd>−{money(selectedResult.estimatedTax)}</dd>
                  <dt>
                    <strong>Net earnings</strong>
                  </dt>
                  <dd>
                    <strong>{money(selectedResult.netReturn)}</strong>
                  </dd>
                  <dt>Gain over baseline</dt>
                  <dd>{money(selectedResult.incrementalGain)}</dd>
                  <dt>Minimum liquid cash</dt>
                  <dd>{money(selectedResult.minimumLiquid)}</dd>
                </dl>
              </>
            )}
            {selectedResult?.status === 'excluded' && (
              <p className={styles.error}>{selectedResult.exclusionReason}</p>
            )}
            {!!(selectedResult?.warnings.length || selectedBank?.limitations.length) && (
              <>
                <h3>Assumptions & limitations</h3>
                <ul>
                  {(selectedResult?.warnings ?? selectedBank?.limitations ?? []).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </>
            )}
            {!!selectedBank?.requirements.length && (
              <>
                <h3>Requirements</h3>
                <ul>
                  {selectedBank.requirements.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            )}
            {!!selectedResult?.tasks.length && (
              <>
                <h3>Before you act</h3>
                <ul className={styles.tasks}>
                  {selectedResult.tasks.map((t, i) => (
                    <li key={i}>
                      <span>{t.date}</span>
                      {t.title}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
