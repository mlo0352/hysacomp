import type { Bank, Catalog } from './schema';
import { VERSION, SCHEMA_VERSION } from './schema';
import { fact, FACT_LABELS, type Source } from './profile';
import { FEATURE_GROUPS, FEATURE_LABELS, RESEARCH_DISCLAIMER, type Feature } from './feature-model';

const zeroFields: Record<string, string> = {
  noMonthlyFee: 'monthlyFee',
  noOpeningMinimum: 'openingMinimum',
  freeAch: 'achFee',
  freeIncomingWire: 'incomingWireFee',
  noForeignTransactionFee: 'foreignTransactionFee',
};
const aliases: Record<string, string> = { atmReimbursement: 'atmRefund' };
const bankWide = new Set([
  'mfa',
  'biometricLogin',
  'passkeys',
  'fraudMonitoring',
  'loginAlerts',
  'support247',
  'liveChat',
  'secureMessaging',
  'supportEmail',
  'internationalSupport',
]);

export function featureFor(bank: Bank, key: string): Feature {
  const explicit = bank.profile?.features.find((f) => f.key === key);
  if (explicit) return explicit;
  const f = fact(bank.profile, zeroFields[key] ?? aliases[key] ?? key);
  // Boolean presence and fee amounts can be mapped; prose must be reviewed for product scope.
  const canMap =
    f.status === 'verified' &&
    (key in zeroFields ? typeof f.value === 'number' : typeof f.value === 'boolean');
  return {
    key,
    availability: canMap
      ? (key in zeroFields ? f.value === 0 : f.value === true)
        ? 'available'
        : 'unavailable'
      : 'unknown',
    evidenceStatus: canMap ? 'verified' : 'unknown',
    scope: bankWide.has(key) ? 'institution' : 'product',
    product: bank.name,
    conditions: canMap
      ? f.notes
      : f.value !== null
        ? `Existing detail needs a feature-scope review: ${String(f.value)}. ${f.notes}`
        : 'No product-specific evidence recorded. Ask the bank; absence of evidence does not mean unavailable.',
    sourceIds: f.sourceIds,
    claims: [],
  };
}
export function featureRows(bank: Bank) {
  return Object.entries(FEATURE_GROUPS).flatMap(([category, fields]) =>
    Object.entries(fields).map(([key, label]) => ({ category, label, ...featureFor(bank, key) })),
  );
}
export function featureReport(catalog: Catalog) {
  return {
    toolVersion: VERSION,
    schemaVersion: SCHEMA_VERSION,
    catalogId: catalog.id,
    checkedOn: catalog.checkedOn,
    disclaimer: RESEARCH_DISCLAIMER,
    scope:
      'Local evidence only; no live checks. Coverage counts describe research completeness, not bank quality. Manual checks never change earnings.',
    categories: FEATURE_GROUPS,
    banks: catalog.banks.map((bank) => {
      const features = featureRows(bank);
      return {
        id: bank.id,
        name: bank.name,
        features,
        sources: bank.profile?.sources ?? [],
        coverage: {
          total: features.length,
          verified: features.filter((f) => f.evidenceStatus === 'verified').length,
          unknown: features.filter((f) => f.availability === 'unknown').length,
        },
        researchQueue: features
          .filter(
            (f) =>
              f.evidenceStatus !== 'verified' ||
              f.claims.some((c) => c.assessment !== 'corroborated'),
          )
          .map((f) => ({
            target: `feature:${f.key}`,
            priority: f.claims.some(
              (c) => c.assessment === 'contradicted' || c.assessment === 'scope-mismatch',
            )
              ? 'conflict'
              : f.claims.length
                ? 'secondary-claim'
                : 'missing-evidence',
            question: `Does ${bank.name} provide ${FEATURE_LABELS[f.key]}? Verify the exact product, conditions, current date and first-party source.`,
            claims: f.claims,
            sourceIds: f.sourceIds,
          })),
      };
    }),
  };
}

// Bind personal checks to the exact evidence being reviewed, so an updated claim needs rechecking.
export function verificationTarget(bank: Bank, target: string): unknown {
  const [kind, key, claimId] = target.split(':');
  if (kind === 'fact' && (key in FACT_LABELS || Object.hasOwn(bank.profile?.facts ?? {}, key)))
    return fact(bank.profile, key);
  if (kind === 'feature' && key in FEATURE_LABELS) return featureFor(bank, key);
  if (kind === 'claim') return featureFor(bank, key).claims.find((c) => c.id === claimId);
  if (kind === 'discovery') return bank.profile?.discoveries.find((d) => d.id === key);
  if (kind === 'review') return bank.profile?.reviews.find((r) => r.id === key);
  if (kind === 'customer-review') return bank.profile?.customerReviews.find((r) => r.id === key);
  if (kind === 'conflict') return bank.profile?.conflicts.find((c) => c.key === key);
  if (kind === 'history') return bank.profile?.rateHistory[Number(key)];
  if (kind === 'log') return bank.profile?.researchLog[Number(key)];
  if (kind === 'theme') return bank.profile?.themes[Number(key)];
  return undefined;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function evidenceSnapshot(bank: Bank, target: string): string {
  const value = verificationTarget(bank, target);
  if (value === undefined) throw new Error('Unknown verification target');
  // Include the complete source records attached anywhere in this claim, including conflicts.
  const ids = new Set<string>();
  const collect = (v: any) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v.sourceIds)) v.sourceIds.forEach((id: string) => ids.add(id));
    Object.values(v).forEach(collect);
  };
  collect(value);
  const sources: Source[] = bank.profile?.sources.filter((s) => ids.has(s.id)) ?? [];
  return JSON.stringify(
    canonical({
      bankId: bank.id,
      product: bank.name,
      institution: bank.institution,
      target,
      value,
      sources,
    }),
  );
}
