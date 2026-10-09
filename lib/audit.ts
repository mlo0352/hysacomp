import type { Catalog, Bank } from './schema';
import { date, VERSION } from './schema';
import { FACT_LABELS, fact } from './profile';
import { freshness } from './analysis';

export function auditCatalog(
  catalog: Catalog,
  evaluatedOn = new Date().toISOString().slice(0, 10),
) {
  date.parse(evaluatedOn);
  return {
    toolVersion: VERSION,
    schemaVersion: '3.0',
    catalogId: catalog.id,
    evaluatedOn,
    scope: 'Local evidence audit only. This command does not reopen URLs or certify bank terms.',
    freshness: freshness(catalog.checkedOn, evaluatedOn),
    banks: catalog.banks.map((b: Bank) => {
      const p = b.profile;
      const inputs: Record<string, unknown> = {
        apy: b.apy,
        openingMinimum: b.openingMinimum,
        monthlyFee: b.monthlyFee,
      };
      b.tiers.forEach((t, i) => {
        inputs[`tiers.${i}.from`] = t.from;
        inputs[`tiers.${i}.apy`] = t.apy;
      });
      const mismatches = Object.entries(inputs)
        .filter(([key, value]) => {
          const f = fact(p, `calculation.${key}`);
          return f.status === 'verified' && f.value !== value;
        })
        .map(([key]) => key);
      return {
        id: b.id,
        name: b.name,
        calculation: b.model,
        verification: b.verification,
        researchedAt: p?.researchedAt ?? null,
        freshness: freshness(b.checkedOn, evaluatedOn),
        unknownFields: Object.keys(FACT_LABELS).filter((key) => fact(p, key).status === 'unknown'),
        reportedOrConflictingFields: Object.entries(p?.facts ?? {})
          .filter(([, f]) => ['reported', 'conflicting'].includes(f.status))
          .map(([key]) => key),
        unsourcedCalculationFields: Object.keys(inputs).filter(
          (key) => fact(p, `calculation.${key}`).status !== 'verified',
        ),
        calculationMismatches: mismatches,
        unresolvedConflicts: p?.conflicts.filter((c) => !c.resolved) ?? [],
        expiredEnrollments: b.promotions
          .filter((p) => p.enrollBy && p.enrollBy < evaluatedOn)
          .map((p) => ({ id: p.id, enrollBy: p.enrollBy })),
        discoveries: p?.discoveries ?? [],
        researchLog: p?.researchLog ?? [],
        sources: p?.sources ?? [],
      };
    }),
  };
}
