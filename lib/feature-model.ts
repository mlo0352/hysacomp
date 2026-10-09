import { z } from 'zod';

// Our cash-account checklist. A category is not a quality score or an endorsement.
export const FEATURE_GROUPS = {
  'Everyday costs': {
    noMonthlyFee: 'No monthly maintenance fee',
    noOpeningMinimum: 'No opening minimum',
    freeAch: 'Free standard ACH',
    freeIncomingWire: 'Free incoming wires',
    atmReimbursement: 'ATM fee reimbursement',
    noForeignTransactionFee: 'No foreign purchase fee',
    overdraftProtection: 'Overdraft protection options',
  },
  'Security & control': {
    mfa: 'Two-factor authentication',
    biometricLogin: 'Biometric sign-in',
    passkeys: 'Passkeys',
    fraudMonitoring: 'Fraud monitoring',
    cardLock: 'Card freeze controls',
    loginAlerts: 'Login alerts',
    identityProtection: 'Identity protection service',
  },
  'App & alerts': {
    iosApp: 'iPhone app',
    androidApp: 'Android app',
    mobileCheckSupported: 'Mobile check deposit',
    atmLocator: 'ATM finder',
    transactionAlerts: 'Transaction alerts',
    pushNotifications: 'Push notifications',
  },
  'Moving money': {
    directDepositSupported: 'Receive payroll deposits',
    earlyDirectDeposit: 'Early paycheck access',
    outgoingWireSupported: 'Send domestic wires',
    incomingWireSupported: 'Receive domestic wires',
    internationalWireOut: 'Send international wires',
    internationalWireIn: 'Receive international wires',
    externalAccountLinking: 'Link external accounts',
    outgoingAchSupported: 'Send ACH transfers',
    instantTransfers: 'Instant payment transfers',
  },
  'Saving & planning': {
    savingsBuckets: 'Savings goals / buckets',
    separateSubaccounts: 'Separate subaccounts',
    roundUps: 'Purchase round-ups',
    scheduledSavings: 'Scheduled saving transfers',
    spendingInsights: 'Spending insights',
    billPay: 'Bill payment service',
  },
  'Payments & connections': {
    zelle: 'Zelle',
    applePay: 'Apple Pay',
    googlePay: 'Google Wallet',
    wiseIntegration: 'Native Wise connection',
    quickbooksIntegration: 'QuickBooks connection',
  },
  'Getting help': {
    support247: 'Round-the-clock phone support',
    liveChat: 'Human live chat',
    secureMessaging: 'Secure messages',
    supportEmail: 'Email assistance',
    internationalSupport: 'Support while abroad',
  },
  'Cash & in-person access': {
    branches: 'Branch service for this account',
    cashDeposits: 'Deposit physical cash',
    debitCard: 'Debit card access',
    atmCard: 'ATM withdrawals',
    cashierCheck: 'Cashier checks',
    notary: 'Notary service',
    safeDepositBox: 'Safe deposit boxes',
    currencyExchange: 'Cash currency exchange',
  },
  'Other cash-account tools': {
    creditMonitoring: 'Credit monitoring',
    debitCashback: 'Debit purchase rewards',
    foreignCurrencyAccount: 'Foreign-currency cash account',
    travelNotifications: 'Card travel notices',
  },
} as const;
export const FEATURE_LABELS: Record<string, string> = Object.assign(
  {},
  ...Object.values(FEATURE_GROUPS),
);
export const FeatureSchema = z
  .object({
    key: z.string().refine((k) => k in FEATURE_LABELS, 'Unknown feature key'),
    availability: z.enum(['available', 'conditional', 'unavailable', 'unknown', 'not-applicable']),
    evidenceStatus: z.enum(['verified', 'reported', 'conflicting', 'unknown']),
    scope: z.enum(['product', 'linked-product', 'institution', 'unspecified']),
    product: z.string().min(1),
    conditions: z.string().max(4000),
    sourceIds: z.array(z.string()),
    claims: z
      .array(
        z
          .object({
            id: z.string().min(1),
            statement: z.string().min(1).max(1000),
            sourceIds: z.array(z.string()).min(1),
            assessment: z.enum(['corroborated', 'contradicted', 'scope-mismatch', 'unverified']),
            notes: z.string().max(4000),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (
      f.evidenceStatus === 'verified' &&
      (f.availability === 'unknown' || f.scope === 'unspecified' || !f.sourceIds.length)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Verified features require availability, scope and evidence.',
      });
    if (f.availability === 'conditional' && !f.conditions.trim())
      ctx.addIssue({ code: 'custom', message: 'Conditional features need explicit conditions.' });
    if (f.evidenceStatus === 'unknown' && f.availability !== 'unknown')
      ctx.addIssue({
        code: 'custom',
        message: 'Unknown evidence cannot establish feature availability.',
      });
    if (new Set(f.claims.map((c) => c.id)).size !== f.claims.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate feature claim IDs.' });
  });
export type Feature = z.infer<typeof FeatureSchema>;

export const RESEARCH_DISCLAIMER =
  'Butter is a research aid, not a guarantee or personal financial advice. Information may be incomplete, outdated or incorrect. Verify current terms, eligibility, fees, access and deposit coverage directly with the bank before opening an account or moving money.';
