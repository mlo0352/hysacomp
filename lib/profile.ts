import { z } from 'zod';
import { FeatureSchema } from './feature-model';
import { CustomerReviewSchema, reviewIdentity } from './review-model';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T00:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid date');
const value = z.union([z.string().max(4000), z.number().finite(), z.boolean()]);
export const SourceSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum([
      'official',
      'regulator',
      'app-store',
      'secondary',
      'review',
      'community',
      'archive',
    ]),
    publisher: z.string().min(1),
    title: z.string().min(1),
    url: z
      .string()
      .url()
      .refine((s) => /^https?:\/\//i.test(s)),
    section: z.string().min(1),
    accessedAt: day,
    effectiveDate: day.nullable().default(null),
    publishedAt: day.optional(),
  })
  .strict();
export const FactSchema = z
  .object({
    value: value.nullable(),
    unit: z.string().default(''),
    status: z.enum(['verified', 'unknown', 'conflicting', 'reported', 'not-applicable']),
    confidence: z.enum(['high', 'medium', 'low', 'unknown']),
    sourceIds: z.array(z.string()).default([]),
    notes: z.string().max(4000).default(''),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (
      ['verified', 'reported', 'conflicting'].includes(f.status) &&
      (!f.sourceIds.length || f.value === null)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Known claims need a value and their own source reference.',
      });
    if (f.status === 'unknown' && f.value !== null)
      ctx.addIssue({ code: 'custom', message: 'Unknown facts must have a null value.' });
  });
export const ProfileSchema = z
  .object({
    researchedAt: day,
    facts: z.record(z.string(), FactSchema),
    sources: z.array(SourceSchema),
    features: z.array(FeatureSchema).default([]),
    customerReviews: z.array(CustomerReviewSchema).default([]),
    conflicts: z
      .array(
        z
          .object({
            key: z.string(),
            claims: z.array(FactSchema).min(2),
            resolution: z.string(),
            resolved: z.boolean(),
          })
          .strict(),
      )
      .default([]),
    discoveries: z
      .array(
        z
          .object({
            id: z.string(),
            date: day,
            category: z.string(),
            title: z.string(),
            finding: z.string(),
            implication: z.string(),
            action: z.string(),
            status: z.enum(['verified', 'unresolved', 'reported']),
            sourceIds: z.array(z.string()),
            relatedFacts: z.array(z.string()).default([]),
          })
          .strict(),
      )
      .default([]),
    researchLog: z
      .array(
        z
          .object({
            date: day,
            area: z.string(),
            outcome: z.enum(['reviewed', 'partial', 'not-found', 'blocked']),
            notes: z.string(),
            sourceIds: z.array(z.string()).default([]),
          })
          .strict(),
      )
      .default([]),
    rateHistory: z
      .array(
        z
          .object({
            date: day,
            apy: z.number().min(0).max(100),
            product: z.string(),
            tier: z.string(),
            series: z.string(),
            sourceIds: z.array(z.string()).min(1),
            confidence: z.enum(['high', 'medium', 'low']),
            // Only a source explicitly establishing a valid interval can cover days between observations.
            validThrough: day.optional(),
          })
          .strict()
          .refine((p) => !p.validThrough || p.validThrough >= p.date),
      )
      .default([]),
    reviews: z
      .array(
        z
          .object({
            id: z.string(),
            category: z.enum(['app', 'service', 'transfer', 'overall']),
            scope: z.string(),
            rating: z.number().min(0).max(5).nullable(),
            reviewCount: z.number().int().min(0).nullable(),
            ratingDate: day,
            accessedAt: day,
            sourceIds: z.array(z.string()).min(1),
            notes: z.string(),
          })
          .strict(),
      )
      .default([]),
    themes: z
      .array(
        z
          .object({
            category: z.enum(['app', 'service', 'transfer']),
            description: z.string(),
            reportCount: z.number().int().min(2),
            sourceIds: z.array(z.string()).min(1),
            notes: z.string(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .superRefine((p, ctx) => {
    const ids = new Set(p.sources.map((s) => s.id));
    if (ids.size !== p.sources.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate source IDs.' });
    const records = [
      ...Object.values(p.facts),
      ...p.conflicts.flatMap((c) => c.claims),
      ...p.discoveries,
      ...p.researchLog,
      ...p.rateHistory,
      ...p.reviews,
      ...p.customerReviews,
      ...p.customerReviews.map((r) => r.officialContext),
      ...p.themes,
      ...p.features,
      ...p.features.flatMap((f) => f.claims),
    ];
    for (const r of records)
      for (const id of r.sourceIds)
        if (!ids.has(id)) ctx.addIssue({ code: 'custom', message: `Missing source ${id}` });
    if (
      new Set(p.customerReviews.map((r) => r.id)).size !== p.customerReviews.length ||
      new Set(p.customerReviews.map((r) => reviewIdentity(r.permalink))).size !==
        p.customerReviews.length
    )
      ctx.addIssue({ code: 'custom', message: 'Duplicate customer review ID or permalink.' });
    for (const r of p.customerReviews) {
      if (r.accessedAt > p.researchedAt)
        ctx.addIssue({ code: 'custom', message: 'Review access date exceeds researchedAt.' });
      if (
        !r.sourceIds.some((id) =>
          p.sources.some(
            (s) =>
              s.id === id &&
              ['review', 'community', 'app-store'].includes(s.type) &&
              s.accessedAt === r.accessedAt,
          ),
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Customer reviews need a dated review/community source.',
        });
      if (
        r.officialContext.assessment !== 'not-checked' &&
        !r.officialContext.sourceIds.some((id) =>
          p.sources.some((s) => s.id === id && ['official', 'regulator'].includes(s.type)),
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Review policy context requires first-party evidence.',
        });
    }
    for (const [key, f] of Object.entries(p.facts)) {
      if (
        f.status === 'verified' &&
        !f.sourceIds.some((id) =>
          p.sources.some((s) => s.id === id && ['official', 'regulator'].includes(s.type)),
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: `${key}: objective verification needs a first-party or regulatory source.`,
        });
    }
    if (new Set(p.features.map((f) => f.key)).size !== p.features.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate feature keys.' });
    for (const f of p.features) {
      if (
        f.evidenceStatus === 'verified' &&
        !f.sourceIds.some((id) =>
          p.sources.some((s) => s.id === id && ['official', 'regulator'].includes(s.type)),
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: `${f.key}: verified features need first-party evidence.`,
        });
      if (f.claims.some((c) => c.assessment !== 'unverified') && f.evidenceStatus !== 'verified')
        ctx.addIssue({
          code: 'custom',
          message: `${f.key}: resolving a secondary claim needs first-party feature evidence.`,
        });
    }
    if (p.sources.some((s) => s.accessedAt > p.researchedAt))
      ctx.addIssue({ code: 'custom', message: 'Source access date exceeds researchedAt.' });
  });
export type Profile = z.infer<typeof ProfileSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type Source = z.infer<typeof SourceSchema>;
export const unknownFact = (
  notes = 'No current official source found. Verify with the institution.',
): Fact => ({
  value: null,
  status: 'unknown',
  confidence: 'unknown',
  sourceIds: [],
  unit: '',
  notes,
});

// Explicit audit inventory. Missing keys are rendered as Unknown, never false, zero, or unlimited.
export const FACT_GROUPS: Record<string, Record<string, string>> = {
  'Identity & insurance': {
    legalInstitutionName: 'Legal depository institution',
    parentCompany: 'Parent company',
    brand: 'Brand / division',
    fdicCertificateNumber: 'FDIC certificate',
    fdicInsured: 'FDIC deposit eligibility',
    regulator: 'Regulator',
    fdicAggregationGroup: 'Insurance aggregation group',
    accountStructure: 'Account structure',
    ownershipNotes: 'Ownership / aggregation notes',
    sweepProgram: 'Sweep program',
    programBankCount: 'Program bank count',
    advertisedInsuranceMaximum: 'Advertised insurance ceiling (conditional)',
    institutionHistory: 'Institution history',
    acquisitionHistory: 'Acquisition history',
    regulatoryActions: 'Regulatory actions / review scope',
    agreementTransparency: 'Deposit agreement access',
    resolutionConcerns: 'Resolution / failure concerns',
  },
  'Rates & qualification': {
    currentApy: 'Current regular savings APY',
    baseApy: 'Fallback savings APY',
    qualifiedApy: 'Qualified savings APY',
    promotionalApy: 'Introductory savings APY',
    checkingApy: 'Qualified checking APY',
    checkingBaseApy: 'Fallback checking APY',
    variableRate: 'Variable rate',
    guaranteedRate: 'Guaranteed rate',
    tierMethod: 'Tier method',
    headlineBalanceCap: 'Headline APY balance cap',
    rateTiers: 'Rate tiers',
    lowerRateThreshold: 'Lower rate threshold',
    promoStart: 'Promotion starts',
    promoDeadline: 'Enrollment deadline',
    promoDuration: 'Promotion duration',
    bonusAmount: 'Cash bonus',
    boostedBalanceCap: 'Boost balance cap',
    newCustomerEligibility: 'New-customer eligibility',
    promoCode: 'Promotion code',
    directDepositRequired: 'Direct deposit required for regular rate',
    directDepositRules: 'Direct deposit rules',
    qualifyingDepositRules: 'Other qualifying deposits',
    referralRules: 'Referral rules',
    linkedAccountRequired: 'Linked product required for regular rate',
    linkedAccountRules: 'Linked account rules',
    statementCycleRules: 'Qualification cycle',
    checkingAdb: 'Checking average daily balance',
    savingsAdb: 'Savings average daily balance',
    disqualifiers: 'Disqualifying conditions',
  },
  'Minimums & fees': {
    openingMinimum: 'Opening minimum',
    interestMinimum: 'Minimum to earn interest',
    feeWaiverMinimum: 'Fee waiver minimum',
    monthlyFee: 'Monthly maintenance fee',
    inactivityFee: 'Inactivity fee',
    closureFee: 'Closure fee',
    achFee: 'ACH transfer fee',
    outgoingWireFee: 'Outgoing domestic wire fee',
    incomingWireFee: 'Incoming wire fee',
    paperStatementFee: 'Paper statement fee',
    checkFee: 'Bank / cashier check fee',
    debitCardFee: 'Debit card fee',
    replacementCardFee: 'Replacement card fee',
    atmFee: 'Out-of-network ATM fee',
    foreignAtmFee: 'Foreign ATM fee',
    foreignTransactionFee: 'Foreign transaction fee',
    excessWithdrawalFee: 'Excess withdrawal fee',
    returnedDepositFee: 'Returned deposit / NSF fee',
  },
  'Deposits & holds': {
    maximumInitialDeposit: 'Maximum opening deposit',
    initialFundingMethods: 'Initial funding methods',
    incomingAchPerTransaction: 'Bank-initiated ACH pull / transaction',
    incomingAchDaily: 'Bank-initiated ACH pull / day',
    incomingAchWeekly: 'Bank-initiated ACH pull / week',
    incomingAchMonthly: 'Bank-initiated ACH pull / month',
    externalPushSupported: 'Externally initiated ACH credits',
    mobileCheckSupported: 'Mobile check deposit',
    mobileCheckDaily: 'Mobile check / day',
    mobileCheckMonthly: 'Mobile check / month',
    mailedCheckSupported: 'Mailed check deposits',
    branchCheckSupported: 'Branch check deposits',
    incomingWireSupported: 'Incoming domestic wires',
    incomingWireLimit: 'Incoming wire limit',
    cashDeposits: 'Cash deposits',
    atmDeposits: 'ATM deposits',
    linkedExternalAccounts: 'Maximum linked external accounts',
    achPullHoldDays: 'ACH pull hold (business days)',
    newAccountHoldDays: 'New-account funding hold (business days)',
    checkHold: 'Check hold',
    wireAvailability: 'Wire availability',
    extendedHold: 'Extended / review holds',
  },
  'Withdrawals & exit': {
    outgoingAchSupported: 'Bank-initiated outgoing ACH',
    outgoingAchPerTransaction: 'Outgoing ACH / transaction',
    outgoingAchDaily: 'Outgoing ACH / day',
    outgoingAchWeekly: 'Outgoing ACH / week',
    outgoingAchMonthly: 'Outgoing ACH / month',
    achWeeklyWindow: 'Weekly limit reset window',
    achLimitWindow: 'Monthly ACH limit window',
    outgoingAchTransactionsDaily: 'Outgoing ACH transaction count / day',
    outgoingAchTransactionsMonthly: 'Outgoing ACH transaction count / month',
    achOutstandingLimit: 'Outstanding ACH amount cap',
    externalPullSupported: 'Externally initiated ACH debits',
    externalPullLimit: 'External pull limit',
    internalTransferLimit: 'Internal transfers (not external ACH)',
    outgoingWireSupported: 'Outgoing domestic wires',
    outgoingWirePerTransaction: 'Wire / transaction',
    outgoingWireDaily: 'Wire / day',
    wireNoPublishedCap: 'Explicit no wire amount limit',
    newAccountWireLimit: 'New-account wire amount limit',
    wireRestrictedDays: 'New-account wire restriction days',
    sameDayAch: 'Same-day ACH',
    transferCutoff: 'ACH initiation cutoff',
    wireCutoff: 'Wire cutoff',
    phoneLimitIncrease: 'Phone limit increase',
    limitsAge: 'Limits change with age',
    personalizedLimits: 'Personalized limits',
    closurePayout: 'Closure payout method',
    fullBalanceClosure: 'Full-balance closure behavior',
    cashierCheck: 'Cashier / bank check available',
    achProcessingMin: 'Outbound ACH processing minimum (business days)',
    achProcessingMax: 'Outbound ACH processing maximum (business days)',
    wireProcessingMin: 'Wire processing minimum (business days)',
    wireProcessingMax: 'Wire processing maximum (business days)',
    fraudReviewDelay: 'Fraud / review delay',
    businessDayPolicy: 'Weekends / holidays',
    instantTransfers: 'RTP / FedNow / instant transfers',
    withdrawalCountLimit: 'Withdrawal count per cycle',
  },
  'Access & convenience': {
    accessClass: 'Access classification',
    debitCard: 'Direct debit card',
    atmCard: 'Direct ATM card',
    checkingRequiredForCard: 'Checking required for card',
    linkedCheckingAvailable: 'Linked checking available',
    atmNetwork: 'ATM network',
    atmNetworkCount: 'Surcharge-free ATM count',
    atmRefund: 'ATM reimbursement',
    atmRefundMonthlyCap: 'ATM reimbursement / month',
    atmDailyLimit: 'ATM withdrawal / day',
    internationalAtm: 'International ATM access',
    debitPurchaseDaily: 'Debit purchase / day',
    mobileWallet: 'Mobile wallet',
    cashWithdrawal: 'Cash withdrawal route',
    mobileApp: 'Mobile app',
  },
  'Customer support': {
    supportPhone: 'Customer support phone',
    supportHours: 'Support hours',
    support247: '24/7 live support',
    weekendSupport: 'Weekend support',
    liveChat: 'Live chat',
    secureMessaging: 'Secure messaging',
    supportEmail: 'Support email',
    callbackSupport: 'Callback support',
    branches: 'Branch access for this product',
    internationalSupport: 'International support number',
    fraudHotline: 'Fraud hotline',
    lostCardNumber: 'Lost / stolen card phone',
    usPhoneRequired: 'U.S. phone required',
  },
  'Security controls': {
    mfa: 'Multifactor authentication',
    smsOtp: 'SMS one-time codes',
    authenticatorApp: 'Authenticator app',
    passkeys: 'Passkeys',
    hardwareKey: 'Hardware security key',
    biometricLogin: 'Biometric login',
    trustedDevices: 'Trusted device management',
    removeTrustedDevice: 'Remove trusted devices',
    loginAlerts: 'Login alerts',
    transferAlerts: 'Transfer alerts',
    transactionAlerts: 'Transaction alerts',
    largeWithdrawalAlerts: 'Large withdrawal alerts',
    cardLock: 'Card lock',
    fraudMonitoring: 'Fraud monitoring',
    suspiciousLoginBlocking: 'Suspicious login blocking',
    accountLock: 'User account freeze / lock',
  },
};
export const FACT_LABELS = Object.assign({}, ...Object.values(FACT_GROUPS)) as Record<
  string,
  string
>;
export const fact = (p: Profile | undefined, key: string): Fact => p?.facts[key] ?? unknownFact();
export function verifiedValue(p: Profile | undefined, key: string) {
  const f = fact(p, key);
  return f.status === 'verified' ? f.value : null;
}
