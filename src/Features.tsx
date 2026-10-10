import { useState } from 'react';
import type { Bank, Catalog } from '../lib/schema';
import { FEATURE_GROUPS, type Feature } from '../lib/feature-model';
import { featureFor, featureRows, featureReport } from '../lib/features';
import { Sources } from './Research';
import { VerificationButton, VerificationNotebook } from './Verification';
import styles from './App.module.css';

const availabilityLabel = {
  available: 'Available',
  conditional: 'Conditions apply',
  unavailable: 'Unavailable',
  unknown: 'Unknown',
  'not-applicable': 'Not applicable',
};
function FeatureBadge({ feature: f }: { feature: Feature }) {
  return (
    <span
      className={`${styles.featureBadge} ${f.evidenceStatus !== 'verified' ? styles.featureUnknown : f.availability === 'available' ? styles.featureYes : f.availability === 'conditional' ? styles.featureConditional : styles.featureNo}`}
    >
      {f.evidenceStatus === 'verified'
        ? availabilityLabel[f.availability]
        : f.evidenceStatus === 'reported'
          ? 'Reported · unverified'
          : f.evidenceStatus === 'conflicting'
            ? 'Conflicting evidence'
            : 'Unknown'}
    </span>
  );
}
export function FeatureDetail({
  bank,
  label,
  feature: f,
}: {
  bank: Bank;
  label: string;
  feature: Feature;
}) {
  return (
    <details className={styles.featureDetail}>
      <summary>
        <span>{label}</span>
        <FeatureBadge feature={f} />
      </summary>
      <div className={styles.factEvidence}>
        <small>
          {f.evidenceStatus.toUpperCase()} · {f.scope} · {f.product}
        </small>
        <p>{f.conditions}</p>
        {bank.profile && <Sources profile={bank.profile} ids={f.sourceIds} />}
        {f.claims.map((c) => (
          <div className={styles.secondaryClaim} key={c.id}>
            <strong>Secondary claim · {c.assessment}</strong>
            <p>{c.statement}</p>
            <p>{c.notes}</p>
            {bank.profile && <Sources profile={bank.profile} ids={c.sourceIds} />}
            <VerificationButton
              bank={bank}
              target={`claim:${f.key}:${c.id}`}
              label={`${label} secondary claim`}
            />
          </div>
        ))}
        <VerificationButton bank={bank} target={`feature:${f.key}`} label={label} />
      </div>
    </details>
  );
}
export function BankFeatures({ bank }: { bank: Bank }) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const rows = featureRows(bank),
    known = rows.filter((f) => f.evidenceStatus === 'verified').length;
  return (
    <section className={styles.bankFeatures} aria-label="Account feature evidence">
      <h3>Account features</h3>
      <p>
        {known} of {rows.length} features verified. Open a feature for conditions and sources.
      </p>
      <div className={styles.researchControls}>
        <label>
          Find a feature
          <input
            aria-label="Search account features"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Round-ups, wires, support…"
          />
        </label>
        <label>
          Evidence filter
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All features</option>
            <option value="unknown">Needs research</option>
            <option value="claims">Secondary claims</option>
            <option value="verified">First-party evidence</option>
          </select>
        </label>
      </div>
      {Object.keys(FEATURE_GROUPS).map((category) => {
        const shown = rows.filter(
          (f) =>
            f.category === category &&
            `${f.label} ${category}`.toLowerCase().includes(search.toLowerCase()) &&
            (filter === 'all' ||
              (filter === 'claims'
                ? f.claims.length
                : filter === 'verified'
                  ? f.evidenceStatus === 'verified'
                  : f.evidenceStatus !== 'verified')),
        );
        return shown.length ? (
          <details
            className={styles.researchSection}
            key={category}
            open={!!search || filter !== 'all' ? true : undefined}
          >
            <summary>
              {category}
              <span>{shown.length} features</span>
            </summary>
            {shown.map((f) => (
              <FeatureDetail bank={bank} label={f.label} feature={f} key={f.key} />
            ))}
          </details>
        ) : null;
      })}
    </section>
  );
}
export function FeatureComparison({
  catalog,
  inspect,
}: {
  catalog: Catalog;
  inspect: (id: string) => void;
}) {
  const [ids, setIds] = useState(['ally', 'openbank', 'axos_one']),
    [category, setCategory] = useState<string>('Moving money');
  const selected = ids
    .map((id) => catalog.banks.find((b) => b.id === id))
    .filter((b): b is Bank => !!b);
  const fields = Object.entries(FEATURE_GROUPS[category as keyof typeof FEATURE_GROUPS]);
  return (
    <section className={styles.featureComparison} aria-label="Bank feature comparison">
      <div className={styles.sectionHeading}>
        <div>
          <h2>Compare features</h2>
        </div>
      </div>
      <div className={styles.researchControls}>
        <label>
          Feature category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.keys(FEATURE_GROUPS).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {ids.map((id, i) => (
          <label key={i}>
            Account {i + 1}
            <select
              value={catalog.banks.some((b) => b.id === id) ? id : ''}
              onChange={(e) => setIds(ids.map((v, n) => (n === i ? e.target.value : v)))}
            >
              <option value="">Choose an account</option>
              {catalog.banks.map((b) => (
                <option key={b.id} value={b.id} disabled={ids.includes(b.id) && b.id !== id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.featureTable}>
          <thead>
            <tr>
              <th>Feature</th>
              {selected.map((b) => (
                <th key={b.id}>
                  <button onClick={() => inspect(b.id)}>{b.name} ↗</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(([key, label]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                {selected.map((b) => (
                  <td key={b.id}>
                    <FeatureDetail
                      bank={b}
                      label={`${b.name}: ${label}`}
                      feature={featureFor(b, key)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.actions}>
        <button
          onClick={() => {
            const report = featureReport(catalog),
              url = URL.createObjectURL(
                new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
              );
            const a = document.createElement('a');
            a.href = url;
            a.download = 'butter-feature-research.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export features & research queue
        </button>
      </div>
      <VerificationNotebook />
    </section>
  );
}
