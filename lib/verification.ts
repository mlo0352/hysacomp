import { z } from 'zod';
import { date, type Catalog } from './schema';
import { evidenceSnapshot } from './features';

export const VerificationSchema = z
  .object({
    id: z.string().min(1),
    bankId: z.string().min(1),
    target: z.string().min(1),
    evidenceSnapshot: z.string().min(1).max(150000),
    checkedOn: date,
    outcome: z.enum(['confirmed', 'disputed', 'needs-check']),
    sourceUrl: z
      .string()
      .url()
      .refine((s) => /^https?:\/\//i.test(s)),
    sourceTitle: z.string().min(1).max(500),
    section: z.string().min(1).max(1000),
    productScope: z.string().min(1).max(500),
    notes: z.string().min(1).max(4000),
  })
  .strict();
export const VerificationFileSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    kind: z.literal('butter-personal-verifications'),
    entries: z.array(VerificationSchema).max(10000),
  })
  .strict()
  .refine(
    (f) => new Set(f.entries.map((e) => e.id)).size === f.entries.length,
    'Duplicate check IDs',
  );
export type Verification = z.infer<typeof VerificationSchema>;
export function readVerifications(text: string) {
  if (text.length > 12_000_000) throw new Error('Verification file exceeds 12 MB');
  return VerificationFileSchema.parse(JSON.parse(text));
}
export function verificationState(entry: Verification, catalog: Catalog) {
  const bank = catalog.banks.find((b) => b.id === entry.bankId);
  if (!bank) return 'missing-bank';
  if (entry.checkedOn > new Date().toISOString().slice(0, 10)) return 'future-date';
  try {
    return evidenceSnapshot(bank, entry.target) === entry.evidenceSnapshot
      ? 'current-evidence'
      : 'changed-evidence';
  } catch {
    return 'missing-target';
  }
}
export function verificationReport(entries: Verification[], catalog: Catalog) {
  return entries.map((entry) => ({ ...entry, evidenceState: verificationState(entry, catalog) }));
}
