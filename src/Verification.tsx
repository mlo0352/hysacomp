import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { Bank, Catalog } from '../lib/schema';
import { evidenceSnapshot } from '../lib/features';
import {
  VerificationSchema,
  readVerifications,
  verificationState,
  type Verification,
} from '../lib/verification';
import styles from './App.module.css';

const Context = createContext<{
  catalog: Catalog;
  entries: Verification[];
  add: (e: Verification) => void;
} | null>(null);
export function VerificationProvider({
  catalog,
  children,
}: {
  catalog: Catalog;
  children: ReactNode;
}) {
  const [entries, setEntries] = useState<Verification[]>([]);
  return (
    <Context.Provider
      value={{
        catalog,
        entries,
        add: (e) => setEntries((old) => [...old.filter((x) => x.id !== e.id), e]),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function VerificationButton({
  bank,
  target,
  label,
}: {
  bank: Bank;
  target: string;
  label: string;
}) {
  const context = useContext(Context);
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  if (!context) return null;
  const latest = context.entries.filter((e) => e.bankId === bank.id && e.target === target).at(-1);
  const state = latest ? verificationState(latest, context.catalog) : null;
  return (
    <div className={styles.verification}>
      {latest && (
        <small className={styles.personalCheck}>
          Your check: {latest.outcome} · {latest.checkedOn} ·{' '}
          {state === 'current-evidence' ? 'same evidence' : `${state} — recheck`}
        </small>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Record your check: ${label}`}
      >
        Record your check<span className={styles.srOnly}>: {label}</span>
      </button>
      {open && (
        <form
          className={styles.checkForm}
          onSubmit={(e) => {
            e.preventDefault();
            const fields = Object.fromEntries(new FormData(e.currentTarget));
            try {
              if (String(fields.checkedOn) > new Date().toISOString().slice(0, 10))
                throw new Error('A verification date cannot be in the future.');
              const entry = VerificationSchema.parse({
                ...fields,
                id: crypto.randomUUID(),
                bankId: bank.id,
                target,
                evidenceSnapshot: evidenceSnapshot(bank, target),
              });
              context.add(entry);
              setError('');
              setOpen(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <strong>Check {label}</strong>
          <p>
            A personal note, separate from the published research. Saving does not change rates,
            rankings or official verification. Export your notebook to keep it after closing this
            page.
          </p>
          <div className={styles.checkGrid}>
            <label>
              Verdict
              <select name="outcome">
                <option value="needs-check">Still needs checking</option>
                <option value="confirmed">I confirmed this</option>
                <option value="disputed">I found a disagreement</option>
              </select>
            </label>
            <label>
              Checked on
              <input
                type="date"
                name="checkedOn"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Evidence URL
              <input
                type="url"
                name="sourceUrl"
                required
                placeholder="https://bank.example/terms"
              />
            </label>
            <label>
              Source title
              <input
                name="sourceTitle"
                required
                placeholder="Account agreement or support reference"
              />
            </label>
            <label>
              Section / reference
              <input
                name="section"
                required
                placeholder="Section, page or support case reference"
              />
            </label>
            <label>
              Product checked
              <input name="productScope" required defaultValue={bank.name} />
            </label>
          </div>
          <label>
            What did you find?
            <textarea
              name="notes"
              required
              rows={3}
              placeholder="Record the exact condition and what still needs checking. Avoid account numbers or other sensitive information."
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>
              Save personal check
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
export function VerificationNotebook() {
  const ctx = useContext(Context),
    file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  if (!ctx) return null;
  const exportNotes = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { schemaVersion: '1.0', kind: 'butter-personal-verifications', entries: ctx.entries },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'butter-verifications.local.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details className={styles.notebook}>
      <summary>
        Your verification notebook <span>{ctx.entries.length} checks</span>
      </summary>
      <p>
        Open any evidence row and choose “Record your check.” Notes stay in this tab until you
        export them. Imported notes are personal claims, never official verification. A changed
        source or claim is marked for rechecking.
      </p>
      <div className={styles.actions}>
        <button onClick={exportNotes} disabled={!ctx.entries.length}>
          Export personal checks
        </button>
        <button onClick={() => file.current?.click()}>Import personal checks</button>
      </div>
      <input
        ref={file}
        hidden
        type="file"
        accept=".json"
        aria-label="Import verification notebook"
        onChange={async (e) => {
          const input = e.currentTarget,
            f = input.files?.[0];
          if (!f) return;
          try {
            if (f.size > 12_000_000) throw new Error('Verification file exceeds 12 MB');
            const data = readVerifications(await f.text());
            // An existing ID with different contents must not silently replace a personal note.
            if (
              data.entries.some((v) =>
                ctx.entries.some(
                  (old) => old.id === v.id && JSON.stringify(old) !== JSON.stringify(v),
                ),
              )
            )
              throw new Error('Conflicting check ID; rename the incoming ID before merging.');
            data.entries.forEach(ctx.add);
            setError('');
            setNotice(`Imported ${data.entries.length} personal checks.`);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
          input.value = '';
        }}
      />
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {ctx.entries.map((e) => (
        <article key={e.id} className={styles.discovery}>
          <strong>
            {ctx.catalog.banks.find((b) => b.id === e.bankId)?.name ?? e.bankId} · {e.target}
          </strong>
          <p>
            {e.outcome} · {e.checkedOn} · {verificationState(e, ctx.catalog)} · {e.productScope}
          </p>
          <p>{e.notes}</p>
          <a href={e.sourceUrl} target="_blank" rel="noreferrer">
            {e.sourceTitle} · {e.section}
          </a>
        </article>
      ))}
    </details>
  );
}
