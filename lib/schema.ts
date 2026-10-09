import { z } from 'zod';
import { ProfileSchema } from './profile';

export const VERSION = '3.1.0';
export const BUILD_DATE = '2026-10-09';
export const SCHEMA_VERSION = '3.1';
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid calendar date');
const cash = z.number().finite().min(0).max(1e12);
const apy = z.number().finite().min(0).max(100);
const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .min(1)
  .max(100);
const text = z.string().min(1).max(1000);
const url = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//i.test(s), 'Use an HTTP(S) source URL');

export const FlowSchema = z
  .object({
    id,
    label: text,
    amount: cash,
    direction: z.enum(['in', 'out']),
    cadence: z.enum(['monthly', 'weekly']),
    interval: z.number().int().min(1).max(52).default(1),
    dayOfMonth: z.number().int().min(1).max(31).default(1),
    startDate: date,
    endDate: date,
    qualification: z.enum(['none', 'payroll', 'external-deposit']).default('none'),
  })
  .strict()
  .refine((f) => f.endDate >= f.startDate, 'Flow end must follow start')
  .refine(
    (f) => f.direction !== 'out' || f.qualification === 'none',
    'Withdrawals cannot qualify as deposits',
  );

export const ScenarioSchema = z
  .object({
    schemaVersion: z.literal('3.1'),
    toolVersion: z.literal(VERSION).default(VERSION),
    id,
    name: text,
    createdAt: date,
    dataAsOf: date.optional(),
    focusYear: z.number().int().min(1900).max(2200).optional(),
    startDate: date,
    endDate: date,
    startingCash: cash,
    taxRate: z.number().finite().min(0).max(1),
    baseline: z.object({ name: text, apy, monthlyFee: cash.default(0) }).strict(),
    bankIds: z.array(id).min(1).max(200),
    eligiblePromotionIds: z.array(id).default([]),
    transfer: z
      .object({
        businessDays: z.number().int().min(0).max(30),
        fee: cash,
        holdDays: z.number().int().min(0).max(90).default(0),
      })
      .strict(),
    eStatements: z.boolean().default(true),
    insurance: z
      .object({
        ownership: z.enum(['single', 'joint', 'other']).default('single'),
        jointOwners: z.number().int().min(2).max(10).default(2),
        otherDeposits: z
          .array(z.object({ aggregationGroup: text, amount: cash, label: text }).strict())
          .max(200)
          .default([]),
      })
      .strict()
      .default({ ownership: 'single', jointOwners: 2, otherDeposits: [] }),
    linkedAccounts: z
      .array(
        z
          .object({
            bankId: id,
            accountType: z.enum(['checking', 'investment']),
            reservedBalance: cash,
            averageDailyBalance: cash,
            qualifyingFlowIds: z.array(id),
            newCustomer: z.enum(['yes', 'no', 'unknown']),
            referralEligible: z.enum(['yes', 'no', 'unknown']),
            notes: text,
          })
          .strict(),
      )
      .default([]),
    flows: z.array(FlowSchema).max(200),
    events: z
      .array(
        z
          .object({
            date,
            amount: z.number().finite().min(-1e12).max(1e12),
            label: text,
            qualification: z.enum(['none', 'payroll', 'external-deposit']).default('none'),
          })
          .strict(),
      )
      .max(1000)
      .default([]),
    notes: z.array(z.string().max(2000)).max(100).default([]),
  })
  .strict()
  .superRefine((s, ctx) => {
    const days = (+new Date(s.endDate) - +new Date(s.startDate)) / 86400000;
    if (days < 0 || days > 3652)
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Horizon must be between 1 day and 10 years',
      });
    if (new Set(s.bankIds).size !== s.bankIds.length)
      ctx.addIssue({ code: 'custom', path: ['bankIds'], message: 'Duplicate bank IDs' });
    if (new Set(s.flows.map((f) => f.id)).size !== s.flows.length)
      ctx.addIssue({ code: 'custom', path: ['flows'], message: 'Duplicate flow IDs' });
    for (const [i, e] of s.events.entries())
      if (e.amount < 0 && e.qualification !== 'none')
        ctx.addIssue({
          code: 'custom',
          path: ['events', i],
          message: 'Withdrawals cannot qualify as deposits',
        });
    for (const a of s.linkedAccounts) {
      if (
        !s.bankIds.includes(a.bankId) ||
        a.qualifyingFlowIds.some((id) => !s.flows.some((f) => f.id === id))
      )
        ctx.addIssue({
          code: 'custom',
          path: ['linkedAccounts'],
          message:
            'Linked activity must reference selected banks and existing cash flows; never duplicate income.',
        });
    }
  });

const Tier = z.object({ from: cash, apy }).strict();
const Promo = z
  .object({
    id,
    name: text,
    startsOn: date.optional(),
    enrollBy: date.optional(),
    durationMonths: z.number().int().min(1).max(60),
    apyDelta: apy.optional(),
    fixedApy: apy.optional(),
    cap: cash.optional(),
    conditions: text,
  })
  .strict()
  .refine(
    (p) => (p.apyDelta === undefined) !== (p.fixedApy === undefined),
    'Provide exactly one of apyDelta or fixedApy',
  );
const Bonus = z
  .object({
    id,
    name: text,
    startsOn: date,
    enrollBy: date,
    kind: z.enum(['balance', 'payroll']),
    fundingDays: z.number().int().min(1).max(365),
    maintainDays: z.number().int().min(0).max(730),
    maintenance: z.enum(['average', 'minimum']),
    payoutDelayDays: z.number().int().min(0).max(365),
    tiers: z.array(z.object({ minimum: cash, bonus: cash }).strict()).min(1),
    conditions: text,
  })
  .strict();

export const BankSchema = z
  .object({
    id,
    name: text,
    institution: text,
    kind: z.enum(['savings', 'cash-sweep', 'checking-bundle']).default('savings'),
    checkedOn: date,
    rateAsOf: date.nullable(),
    verification: z.enum(['verified', 'review']),
    sourceUrl: url,
    additionalSources: z.array(url).default([]),
    evidence: text,
    model: z.enum(['flat', 'whole-balance', 'marginal', 'rolling-payroll', 'unsupported']),
    apy: apy.nullable(),
    tiers: z.array(Tier).default([]),
    qualifiedApy: apy.optional(),
    qualificationDays: z.number().int().min(1).max(90).optional(),
    openingMinimum: cash,
    monthlyFee: cash,
    paperStatementFee: cash.default(0),
    feeWaiverMinimum: cash.optional(),
    maximumModeledBalance: cash.optional(),
    promotions: z.array(Promo).default([]),
    bonuses: z.array(Bonus).default([]),
    limitations: z.array(text).default([]),
    requirements: z.array(text).default([]),
    profile: ProfileSchema.optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (b.verification === 'verified' && b.model !== 'unsupported' && b.apy === null)
      fail('Verified modeled banks require an APY');
    if (
      ['whole-balance', 'marginal'].includes(b.model) &&
      (!b.tiers.length || b.tiers[0].from !== 0)
    )
      fail('Tiers must start at zero');
    if (b.tiers.some((t, i) => i > 0 && t.from <= b.tiers[i - 1].from))
      fail('Tiers must be strictly increasing');
    if (b.model === 'rolling-payroll' && (b.qualifiedApy === undefined || !b.qualificationDays))
      fail('Payroll model requires qualifiedApy and qualificationDays');
    for (const [key, f] of Object.entries(b.profile?.facts ?? {})) {
      if (!key.startsWith('calculation.') || f.status !== 'verified') continue;
      const path = key.slice('calculation.'.length).split('.');
      let input: unknown = b;
      for (const segment of path) {
        input =
          input && typeof input === 'object' && Object.hasOwn(input, segment)
            ? (input as Record<string, unknown>)[segment]
            : undefined;
      }
      if (input !== f.value)
        fail(`${key}: sourced calculation claim does not match the engine input`);
    }
    if (b.profile && b.profile.researchedAt > b.checkedOn)
      fail('Research date cannot exceed the bank snapshot date');
  });
export const CatalogSchema = z
  .object({
    schemaVersion: z.literal('3.1'),
    toolVersion: z.literal(VERSION).default(VERSION),
    id,
    checkedOn: date,
    currency: z.literal('USD'),
    policy: text,
    banks: z.array(BankSchema).min(1).max(200),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = c.banks.map((b) => b.id);
    const promoIds = c.banks.flatMap((b) => [...b.promotions, ...b.bonuses].map((p) => p.id));
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate bank IDs' });
    if (new Set(promoIds).size !== promoIds.length)
      ctx.addIssue({ code: 'custom', message: 'Promotion IDs must be unique across catalog' });
    if (c.banks.some((b) => b.checkedOn > c.checkedOn))
      ctx.addIssue({ code: 'custom', message: 'Bank checkedOn cannot be after catalog checkedOn' });
  });
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Bank = z.infer<typeof BankSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
export type Flow = z.infer<typeof FlowSchema>;
