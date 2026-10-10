// Manually transcribed research, not a scraper. Prior dated snapshots are retained.
// Replay the reviewed observations into ignored outputs; never overwrite published snapshots.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readCatalog, readScenario, toXml, toYaml } from '../lib/files';
import { CatalogSchema, VERSION, type Bank } from '../lib/schema';
import { FACT_LABELS, unknownFact, type Fact, type Profile, type Source } from '../lib/profile';

const DATE = '2026-10-09';
async function writeDraft(path: string, content: string) {
  const target = `outputs/research-replay-${DATE}/${path}`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
const catalog = readCatalog(await readFile('data/banks-2026-10-09.yaml', 'utf8'));
catalog.id = 'atomic-research-2026-10-09-v3';
catalog.policy =
  'Manually reviewed product-specific evidence. Each fact has independent source references; unknowns and conflicts are retained. Model verification covers only the calculation scope. Research is not exhaustive and unknown facts are not assurances.';
function source(
  b: Bank,
  id: string,
  url: string,
  title: string,
  section: string,
  type: Source['type'] = 'official',
  publisher = b.institution,
) {
  b.profile!.sources.push({
    id,
    url,
    title,
    section,
    type,
    publisher,
    accessedAt: DATE,
    effectiveDate: null,
  });
  return id;
}
function facts(
  b: Bank,
  src: string,
  values: Record<string, string | number | boolean>,
  notes = '',
) {
  for (const [key, value] of Object.entries(values)) {
    b.profile!.facts[key] = {
      value,
      status: 'verified',
      confidence: 'high',
      sourceIds: [src],
      notes,
      unit: /Apy$/.test(key)
        ? '% APY'
        : /Fee$|Minimum$|Cap$|Daily$|Monthly$|PerTransaction$|Limit$|Deposit$/.test(key) &&
            typeof value === 'number'
          ? 'USD'
          : '',
    };
  }
}
function discovery(
  b: Bank,
  category: string,
  title: string,
  finding: string,
  implication: string,
  action: string,
  sourceIds: string[],
  status: 'verified' | 'unresolved' | 'reported' = 'verified',
) {
  b.profile!.discoveries.push({
    id: `${b.id}-${b.profile!.discoveries.length + 1}`,
    date: DATE,
    category,
    title,
    finding,
    implication,
    action,
    sourceIds,
    relatedFacts: [],
    status,
  });
  b.profile!.discoveries.at(-1)!.status = status;
}
function identity(
  b: Bank,
  src: string,
  legal: string,
  group: string,
  structure = 'direct-bank-deposit',
) {
  facts(b, src, {
    legalInstitutionName: legal,
    fdicAggregationGroup: group,
    accountStructure: structure,
    fdicInsured: true,
  });
}
const get = (id: string) => catalog.banks.find((b) => b.id === id)!;
for (const b of catalog.banks) {
  b.profile = {
    researchedAt: DATE,
    facts: Object.fromEntries(Object.keys(FACT_LABELS).map((k) => [k, unknownFact()])),
    sources: [],
    features: [],
    customerReviews: [],
    conflicts: [],
    discoveries: [],
    researchLog: [],
    rateHistory: [],
    reviews: [],
    themes: [],
  };
  source(
    b,
    'product',
    b.sourceUrl,
    `${b.name}: product / rate disclosure`,
    'Published APY, minimums, fees, qualification and product footnotes',
  );
  b.additionalSources.forEach((url, i) =>
    source(
      b,
      `additional-${i}`,
      url,
      'Additional official disclosure',
      'Product-specific disclosure',
    ),
  );
  if (b.apy !== null) {
    facts(b, 'product', {
      baseApy: b.apy,
      currentApy: Math.max(b.apy, ...b.tiers.map((t) => t.apy), b.qualifiedApy ?? 0),
      variableRate: true,
    });
    const series = b.tiers.length || b.qualifiedApy ? 'headline-regular' : 'regular';
    b.profile.rateHistory.push({
      date: b.rateAsOf ?? DATE,
      apy: Math.max(b.apy, ...b.tiers.map((t) => t.apy), b.qualifiedApy ?? 0),
      product: b.name,
      tier: b.tiers.length ? 'Highest regular tier' : 'Regular savings',
      series,
      sourceIds: ['product'],
      confidence: 'high',
    });
  }
  // Each calculation claim is independently mapped. Zero paper fees are NOT promoted to a verified fact.
  if (b.verification === 'verified') {
    facts(b, 'product', { openingMinimum: b.openingMinimum, monthlyFee: b.monthlyFee });
    facts(b, 'product', {
      'calculation.apy': b.apy ?? 'Unknown',
      'calculation.openingMinimum': b.openingMinimum,
      'calculation.monthlyFee': b.monthlyFee,
    });
    if (b.paperStatementFee) facts(b, 'product', { paperStatementFee: b.paperStatementFee });
    b.tiers.forEach((t, i) =>
      facts(b, 'product', {
        [`calculation.tiers.${i}.from`]: t.from,
        [`calculation.tiers.${i}.apy`]: t.apy,
      }),
    );
    if (b.tiers.length)
      facts(b, 'product', {
        tierMethod: b.model,
        rateTiers: b.tiers.map((t) => `From $${t.from}: ${t.apy}% APY`).join('; '),
      });
    for (const [i, p] of b.promotions.entries())
      for (const [k, v] of Object.entries(p))
        facts(b, 'product', { [`calculation.promotions.${i}.${k}`]: v });
    for (const [i, p] of b.bonuses.entries())
      for (const [k, v] of Object.entries(p)) {
        if (k === 'tiers')
          p.tiers.forEach((t, j) =>
            facts(b, 'product', {
              [`calculation.bonuses.${i}.tiers.${j}.minimum`]: t.minimum,
              [`calculation.bonuses.${i}.tiers.${j}.bonus`]: t.bonus,
            }),
          );
        else facts(b, 'product', { [`calculation.bonuses.${i}.${k}`]: v as string | number });
      }
  }
  b.profile.researchLog.push({
    date: DATE,
    area: 'Rates / product',
    outcome: b.apy === null ? 'blocked' : 'reviewed',
    notes: b.evidence,
    sourceIds: ['product'],
  });
}

{
  const b = get('axos_one');
  b.name = 'Axos ONE · linked savings + checking';
  b.qualifiedApy = 4.21;
  b.rateAsOf = DATE;
  b.evidence =
    'Qualified savings: 4.21% on the first $249,999.99, 3.50% on additional funds; fallback savings: 1.00%. Checking earns 0.51% only when qualified. Exact checking ADB and statement-cycle rules require a linked-account model; excluded from earnings rankings.';
  facts(b, 'product', {
    currentApy: 4.21,
    qualifiedApy: 4.21,
    baseApy: 1,
    checkingApy: 0.51,
    checkingBaseApy: 0,
    promotionalApy: 5,
    tierMethod: 'marginal',
    rateTiers: 'Qualified savings: 4.21% on first $249,999.99; 3.50% on additional balance.',
    headlineBalanceCap: 49999.99,
    boostedBalanceCap: 49999.99,
    promoStart: '2026-10-01',
    promoDeadline: '2026-10-31',
    promoDuration: 'First six statement cycles, including opening cycle',
    linkedAccountRequired: true,
    linkedAccountRules:
      'Both Axos ONE checking and savings must remain open and active at qualification and interest payment.',
    directDepositRequired: false,
    directDepositRules:
      'Option 1: $1,500 qualifying payroll/government ACH into checking plus $1,500 checking ADB.',
    qualifyingDepositRules:
      'Option 2: $5,000 external eligible deposits into checking plus $5,000 checking ADB; internal transfers do not qualify.',
    checkingAdb: '$1,500 (payroll option) or $5,000 (deposit option)',
    savingsAdb: 'Intro boost requires savings ADB <= $249,999.99.',
    statementCycleRules:
      'First business day through 25th, extended over following non-business days for ADB; late deposits count next cycle. New openings on/after 25th first qualify next month.',
    newCustomerEligibility:
      'Intro boost excludes anyone who previously held any Axos or UFB account, including loans and investments.',
    disqualifiers:
      'Only one boost per primary holder per 12 months; both accounts must remain open.',
    accessClass: 'Savings + linked checking',
    checkingRequiredForCard: true,
    linkedCheckingAvailable: true,
    atmNetworkCount: 95000,
    support247: true,
    biometricLogin: true,
    fraudMonitoring: true,
    fdicCertificateNumber: 35546,
  });
  identity(b, 'product', 'Axos Bank', 'axos-bank');
  const guide = source(
    b,
    'guide',
    'https://www.axosbank.com/personal/support/new-account-guide',
    'New account guide',
    'Transfer limits, ONE minimums, biometrics and one-time verification codes',
  );
  facts(b, guide, {
    limitsAge: true,
    outgoingAchSupported: true,
    incomingWireSupported: true,
    secureMessaging: true,
    smsOtp: true,
    usPhoneRequired: true,
  });
  b.profile!.facts.outgoingAchDaily = unknownFact(
    'Daily and monthly caps exist and increase with account age; the guide does not publish a dollar schedule. Check authenticated limits.',
  );
  discovery(
    b,
    'Qualification',
    'Two accounts, four different rates',
    'The savings headline depends on checking deposits and checking ADB. The 0.51% checking APY and 1.00% fallback savings APY are distinct.',
    'Cash retained in checking has opportunity cost. The intro 5.00% rate is limited to the first $49,999.99.',
    'Read the qualification footnotes; verify cycles, eligibility and balances in both accounts.',
    ['product'],
  );
  discovery(
    b,
    'Access',
    'Authentication can depend on a U.S. mobile number',
    'The new-account guide says verification codes cannot go to international numbers or landlines.',
    'Travel or loss of the trusted phone may complicate access.',
    'Confirm recovery methods and transfer limits before moving a large balance.',
    ['guide'],
  );
}
{
  const b = get('openbank');
  identity(b, 'product', 'Santander Bank, N.A.', 'santander-bank-na');
  facts(b, 'product', {
    promotionalApy: 4.15,
    promoDeadline: '2026-11-03',
    promoDuration: '6 months',
    linkedAccountRequired: false,
    directDepositRequired: false,
    debitCard: false,
    atmCard: false,
    accessClass: 'Savings-only vault',
    usPhoneRequired: true,
    trustedDevices: true,
    biometricLogin: true,
    mobileApp: true,
  });
  const src = source(
    b,
    'digital',
    'https://www.openbank.us/assets/SB_US/en-US/documents/v1/US.OB.ONBOARDING.DIGITAL_BANKING_AGREEMENT.pdf',
    'Digital Banking Agreement',
    'External transfers; distinguish internal transfers; Santander Digital Wires',
  );
  facts(b, src, {
    outgoingAchSupported: true,
    outgoingWireSupported: true,
    personalizedLimits: true,
    achProcessingMin: 1,
    achProcessingMax: 2,
  });
  discovery(
    b,
    'Liquidity',
    'Internal limits are not external ACH limits',
    'The agreement separates internal transfers from external ACH and shows customer limits in the application.',
    'The internal $999,999.99 limit is not an external withdrawal allowance.',
    'Check the external daily/rolling-month caps and wire eligibility shown for your account.',
    ['digital'],
  );
}
{
  const b = get('wealthfront');
  const src = source(
    b,
    'limits',
    'https://support.wealthfront.com/hc/en-us/articles/360048501391-Limits-on-transfers-and-spending',
    'Limits on transfers and spending',
    'Standard transfers, account/routing numbers, cards, checks and wires',
  );
  facts(b, src, {
    outgoingAchSupported: true,
    outgoingAchDaily: 250000,
    outgoingWireSupported: true,
    wireNoPublishedCap: true,
    incomingWireSupported: true,
    incomingWireLimit: 'No amount limit',
    outgoingWireFee: 0,
    incomingWireFee: 0,
    externalPullSupported: true,
    externalPullLimit: 'At least $50,000/day; personalized account/routing-number limits',
    debitCard: true,
    atmCard: true,
    atmDailyLimit: 1000,
    debitPurchaseDaily: 10000,
    mobileCheckSupported: true,
    mobileCheckMonthly: 10000,
    achProcessingMin: 1,
    achProcessingMax: 1,
  });
  const wire = source(
    b,
    'wires',
    'https://support.wealthfront.com/hc/en-us/articles/15967641307924-Send-or-receive-money-with-wires',
    'Send or receive money with wires',
    'Eligible owners, destinations and delivery',
  );
  facts(b, wire, {
    wireProcessingMin: 0,
    wireProcessingMax: 1,
    wireCutoff:
      'Submitted and approved before 6 p.m. ET typically same day; after cutoff usually next business day. Security review can delay either.',
  });
  facts(b, 'product', {
    accountStructure: 'brokerage-sweep',
    legalInstitutionName: 'Wealthfront Brokerage LLC; deposits swept to program banks',
    advertisedInsuranceMaximum: 8000000,
    programBankCount: 32,
    sweepProgram:
      'Up to 32 program banks; coverage begins when funds reach banks. Other deposits at those banks aggregate.',
    accessClass: 'Brokerage cash account',
    linkedAccountRequired: false,
    directDepositRequired: false,
    promotionalApy: 4.2,
    headlineBalanceCap: 150000,
    boostedBalanceCap: 150000,
    atmRefundMonthlyCap: 15,
    instantTransfers: 'RTP / FedNow to eligible receiving accounts; limit shown in app.',
  });
  discovery(
    b,
    'Liquidity',
    'App transfers and external pulls have different limits',
    'Wealthfront-initiated ACH uses a $250,000/day cap; account/routing-number withdrawals use a separate personalized limit. Wires have no published amount cap.',
    'Do not apply the ACH push cap to an external pull.',
    'Verify available funds, recipient eligibility and the wire delivery estimate.',
    ['limits', 'wires'],
  );
  discovery(
    b,
    'Insurance',
    'Sweep ceiling is not personal coverage',
    'The advertised $8 million eligibility uses program-bank allocation.',
    'Existing deposits at the same program banks can reduce coverage.',
    'Review the current allocation and your other deposits; do not treat the headline ceiling as guaranteed insurance.',
    ['product'],
  );
}
{
  const b = get('everbank');
  const src = source(
    b,
    'transfers',
    'https://www.everbank.com/support/personal/manage-money/online-transfers',
    'Online transfers',
    'Daily and monthly external transfer limits',
  );
  facts(b, src, {
    outgoingAchSupported: true,
    outgoingAchDaily: 10000,
    outgoingAchMonthly: 30000,
    phoneLimitIncrease: true,
    personalizedLimits: true,
    supportPhone: '1-888-882-3837',
  });
  const agreement = source(
    b,
    'agreement',
    'https://www.everbank.com/media_library/tiaabank/_shared/pdf/terms-personal.pdf',
    'Personal account terms',
    '3.5.5.2 External transfers',
  );
  facts(b, agreement, {
    incomingAchDaily: 250000,
    outgoingAchTransactionsDaily: 10,
    outgoingAchTransactionsMonthly: 50,
  });
  b.profile!.facts.achLimitWindow = unknownFact(
    'FAQ says monthly; verify calendar versus rolling reset and shared usage. A monthly cap is NOT ignored in warnings.',
  );
  const fees = source(
    b,
    'fees',
    'https://www.everbank.com/api/public/services/download?filePath=%2Fblt12844f397ad182a6%2Fblt520c554c1c67887b%2F68a31e9467858bc35a55d5dd%2Fterms-performance-savings.pdf',
    'Performance Savings summary of terms',
    'Opening, common fees and wire fees',
  );
  facts(b, fees, {
    monthlyFee: 0,
    openingMinimum: 0,
    closureFee: 0,
    achFee: 0,
    checkFee: 0,
    outgoingWireSupported: true,
    incomingWireSupported: true,
    outgoingWireFee: 25,
    incomingWireFee: 0,
    returnedDepositFee: 0,
    variableRate: true,
  });
  const fdic = source(
    b,
    'fdic',
    'https://banks.data.fdic.gov/bankfind-suite/bankfind?cert=34775',
    'BankFind: EverBank',
    'Insured bank and primary regulator',
    'regulator',
    'FDIC',
  );
  identity(b, fdic, 'EverBank, National Association', 'everbank-na');
  facts(b, fdic, { fdicCertificateNumber: 34775, regulator: 'Comptroller of the Currency' });
  discovery(
    b,
    'Liquidity',
    'A high APY with a low default ACH exit allowance',
    'Default outgoing ACH is $10,000/day and $30,000/month, shared across EverBank accounts. Higher limits require approval.',
    'A large balance may take many months to exit using default bank-initiated ACH. Wires are a separate route.',
    'Ask about your actual monthly reset, a limit increase and full-balance wire capability.',
    ['transfers', 'fees'],
  );
}
{
  const b = get('sofi');
  facts(b, 'product', {
    qualifiedApy: 3.3,
    checkingBaseApy: 0.5,
    linkedAccountRequired: true,
    directDepositRequired: true,
    directDepositRules:
      'Only the standard non-Plus eligible-payroll path is modeled; alternative deposits and Plus benefits require separate qualification.',
    statementCycleRules: '31-day eligible-payroll window',
    accessClass: 'Savings + linked checking',
    'calculation.qualifiedApy': 3.3,
    'calculation.qualificationDays': 31,
  });
  // Checking APY is not used by this model; require a separate rate-sheet audit before displaying it.
  b.profile!.facts.checkingBaseApy = unknownFact(
    'This snapshot models savings only; confirm the checking row of the current rate sheet.',
  );
  identity(b, 'product', 'SoFi Bank, N.A.', 'sofi-bank-na');
  const wire = source(
    b,
    'wires',
    'https://support.sofi.com/hc/en-us/articles/how-to-send-and-receive-wire-transfers-with-sofi',
    'Sending and receiving wires',
    'SoFi Checking and Savings; not legacy SoFi Money or Invest',
  );
  facts(b, wire, { incomingWireSupported: true, outgoingWireSupported: true });
  discovery(
    b,
    'Product scope',
    'Legacy Money and Invest limits do not describe Savings',
    'Search results surface SoFi Money and SoFi Invest transfer limits beside current bank help.',
    'Those caps cannot safely be copied into the bank savings profile.',
    'Confirm current Checking and Savings limits in-app and review the non-Plus rate-sheet row.',
    ['product', 'wires'],
  );
}
{
  const b = get('etrade');
  const src = source(
    b,
    'sweep',
    'https://us.etrade.com/l/f/agreement-library/premium-savings-bank-deposit-program',
    'Premium Savings deposit program',
    'Program deposits, aggregation and FDIC terms',
  );
  facts(b, src, {
    legalInstitutionName:
      'Morgan Stanley Private Bank, National Association; participating program banks',
    accountStructure: 'fintech-pass-through',
    sweepProgram:
      'Premium Savings bank deposit program can place balances at additional banks; verify allocation and overlapping deposits.',
    fdicInsured: true,
  });
  facts(b, 'product', {
    promotionalApy: 4.25,
    promoDuration: '6 months',
    promoDeadline: '2027-01-10',
    bonusAmount: 'SAVE800: $400 at $20,000; $800 at $100,000',
    promoCode: 'SAVE800',
    linkedAccountRequired: false,
    directDepositRequired: false,
  });
  const fees = source(
    b,
    'fees',
    'https://us.etrade.com/l/f/agreement-library/bank-rate-fee-schedule',
    'Bank rate and fee schedule',
    'Premium Savings and wires',
  );
  facts(b, fees, { outgoingWireSupported: true });
  discovery(
    b,
    'Bonus',
    'The advertised bonus is a balance contract',
    'SAVE800 has separate funding, average-balance maintenance and payout periods. The rate offer has its own terms.',
    'A withdrawal can reduce the eligible bonus; the headline amount is not immediate profit.',
    'Verify new-money origin, promo enrollment and all measurement dates.',
    ['product'],
  );
  discovery(
    b,
    'Insurance',
    'Bank account includes a deposit program',
    'The Premium Savings agreement permits placement at additional depository banks.',
    'A simple single-bank cap or an advertised expanded ceiling can both misstate personal coverage.',
    'Inspect actual program-bank deposits before relying on expanded coverage.',
    ['sweep'],
  );
}
{
  const b = get('marcus');
  identity(b, 'product', 'Goldman Sachs Bank USA', 'goldman-sachs-bank-usa');
  const src = source(
    b,
    'access',
    'https://www.marcus.com/us/en/banking-with-us/accessing-your-money',
    'Accessing your money',
    'ACH, online wires and telephone wires',
  );
  facts(b, src, {
    outgoingAchSupported: true,
    outgoingAchPerTransaction: 125000,
    achFee: 0,
    outgoingWireSupported: true,
    outgoingWireFee: 0,
    incomingWireFee: 0,
    wireNoPublishedCap: true,
    wireProcessingMin: 1,
    wireProcessingMax: 3,
    achProcessingMin: 1,
    achProcessingMax: 3,
    transferCutoff: '6 p.m. ET',
    wireCutoff: '4 p.m. ET',
    phoneLimitIncrease: true,
  });
  b.profile!.facts.wireNoPublishedCap.notes =
    'Telephone wires only; online wires, if offered, have a $50,000 statement-period cap. Review and agreement restrictions still apply.';
  const sec = source(
    b,
    'security',
    'https://www.marcus.com/us/en/banking-with-us/security-center',
    'Security center',
    'How Marcus protects you; MFA',
  );
  facts(b, sec, { mfa: true });
  const faq = source(
    b,
    'faq',
    'https://www.marcus.com/us/en/resources/saving/5-things-to-know-about-your-online-savings-account',
    'Five things about Online Savings',
    'Fees, withdrawal methods and 24/7 contact center',
  );
  facts(b, faq, {
    support247: true,
    liveChat: true,
    supportPhone: '1-855-730-7283',
    mailedCheckSupported: true,
    accessClass: 'Savings-only vault',
    linkedAccountRequired: false,
    directDepositRequired: false,
  });
  const agreement = source(
    b,
    'agreement',
    'https://www.marcus.com/content/dam/marcus/us/en/pdfs/Marcus_Deposit_Account_Agreement.pdf',
    'Deposit account agreement',
    'Linked external accounts and discretionary transfer restrictions',
  );
  facts(b, agreement, { linkedExternalAccounts: 4, personalizedLimits: true });
  discovery(
    b,
    'Liquidity',
    'Telephone wires differ from online wires',
    'Online ACH is capped per transaction; telephone wires have a separately published no-amount-limit route. Online wires can have a statement-period cap.',
    'A phone call may be required for a large exit; verification can delay it.',
    'Confirm the telephone wire route, ownership match and arrival estimate.',
    ['access', 'agreement'],
  );
}
{
  const b = get('ally');
  identity(b, 'product', 'Ally Bank', 'ally-bank');
  const src = source(
    b,
    'transfers',
    'https://www.ally.com/help/bank/transfers/',
    'Transfers FAQ',
    'Wire limits for new customers, fees and ACH',
  );
  facts(b, src, {
    outgoingWireSupported: true,
    incomingWireSupported: true,
    outgoingWireFee: 20,
    incomingWireFee: 0,
    achFee: 0,
    newAccountWireLimit: 25000,
    wireRestrictedDays: 90,
    phoneLimitIncrease: true,
    outgoingAchSupported: true,
  });
  const savings = source(
    b,
    'faq',
    'https://www.ally.com/help/bank/savings-money-market',
    'Savings / money market FAQ',
    'Savings withdrawals versus Money Market debit access',
  );
  facts(b, savings, {
    withdrawalCountLimit: 10,
    excessWithdrawalFee: 0,
    debitCard: false,
    atmCard: false,
    accessClass: 'Savings-only vault',
    cashierCheck: true,
  });
  const sec = source(
    b,
    'security',
    'https://www.ally.com/security/',
    'Security center',
    'MFA approach; 24/7 Bank support',
  );
  facts(b, sec, { mfa: true, support247: true, supportPhone: '1-877-247-2559' });
  facts(b, 'product', { linkedAccountRequired: false, directDepositRequired: false });
  discovery(
    b,
    'Liquidity',
    'New-account wire restriction',
    'Ally publishes a $25,000 wire cap during the first 90 days of the first bank account, with exceptions by request.',
    'Wire availability alone does not establish a one-day exit for $278,000.',
    'Request an exception before relying on a large new-account wire.',
    ['transfers'],
  );
  discovery(
    b,
    'Access',
    'Savings is not the debit-card Money Market product',
    'The Savings withdrawal allowance is 10 limited transactions per statement cycle; repeated excess can close the account.',
    'Do not assign Money Market debit/ATM features to Savings.',
    'Count your planned withdrawals and verify the exact product.',
    ['faq'],
  );
}
{
  const b = get('brio');
  b.paperStatementFee = 5;
  b.institution = 'Santander Bank, N.A.';
  b.limitations = b.limitations.map((s) =>
    s.replace(
      'Deposits share Webster Bank insurance limits.',
      'Current new deposits share Santander Bank, N.A. insurance limits, including Openbank. Check pre-merger grace-period eligibility separately.',
    ),
  );
  identity(b, 'product', 'Santander Bank, N.A.', 'santander-bank-na');
  facts(b, 'product', {
    brand: 'BrioDirect / Webster Bank division',
    interestMinimum: 25,
    linkedAccountRequired: false,
    directDepositRequired: false,
  });
  const faq = source(
    b,
    'faq',
    'https://www.briodirectbanking.com/faqs/',
    'BrioDirect FAQ',
    'External transfer limits and paper statements',
  );
  facts(b, faq, {
    paperStatementFee: 5,
    outgoingAchSupported: true,
    outgoingAchPerTransaction: 25000,
    achOutstandingLimit: 25000,
    outgoingAchMonthly: 100000,
    achProcessingMin: 3,
    achProcessingMax: 3,
    linkedExternalAccounts: 5,
    phoneLimitIncrease: true,
    transferCutoff: '1 a.m. ET / 10 p.m. PT',
    supportPhone: '1-877-369-2746',
  });
  const merger = source(
    b,
    'merger',
    'https://www.santanderbank.com/pages/personal/webster-bank-faqs',
    'Santander / Webster merger FAQ',
    'August 20, 2026 merger and six-month FDIC transition',
  );
  facts(b, merger, {
    acquisitionHistory: 'Webster merged into Santander August 20, 2026.',
    ownershipNotes:
      'Certain deposits held on the merger date have six months of separate coverage; CDs have special maturity rules. New funding cannot assume this exception.',
  });
  b.profile!.conflicts.push({
    key: 'legalInstitutionName',
    claims: [
      {
        value: 'Webster Bank',
        unit: '',
        status: 'reported',
        confidence: 'medium',
        sourceIds: ['product'],
        notes: 'Older FAQ answer still uses the Webster name.',
      },
      {
        value: 'Santander Bank, N.A.',
        unit: '',
        status: 'verified',
        confidence: 'high',
        sourceIds: ['product', 'merger'],
        notes: 'Current legal footer and dated merger FAQ.',
      },
    ],
    resolved: true,
    resolution:
      'Use Santander for current new deposits. Preserve the old wording and verify transitional coverage for pre-merger deposits.',
  });
  discovery(
    b,
    'Insurance',
    'Brio and Openbank can share the same insurance pool',
    'Current disclosures identify Santander as depository bank; older page text still says Webster.',
    'Different brand names do not automatically provide separate FDIC coverage.',
    'Check pre-merger holdings, grace-period eligibility and all Santander-family deposits.',
    ['product', 'merger'],
  );
  discovery(
    b,
    'Liquidity',
    'Outstanding transfers can slow the exit',
    'The FAQ combines a $25,000 standard outbound allowance, settlement waiting and a $100,000 monthly cap.',
    'Dividing the balance by a daily number would miss the outstanding-transfer restriction.',
    'Ask for a larger approved route and confirm exact settlement/reset rules.',
    ['faq'],
  );
}
{
  const b = get('ivy');
  const faq = source(
    b,
    'faq',
    'https://www.ivybank.com/faq',
    'Ivy FAQ',
    'Legal institution, external limits, geography and withdrawals',
  );
  identity(b, faq, 'Cambridge Savings Bank', 'cambridge-savings-bank');
  facts(b, faq, {
    fdicCertificateNumber: 17870,
    regulator: 'Massachusetts state-chartered bank',
    institutionHistory: 'Cambridge Savings Bank founded in 1834',
    outgoingAchSupported: true,
    outgoingWireSupported: true,
    incomingWireSupported: true,
    outgoingWireFee: 25,
    incomingWireFee: 0,
    mobileCheckSupported: true,
    mailedCheckSupported: true,
    withdrawalCountLimit: 6,
    maximumInitialDeposit: 1000000,
    secureMessaging: true,
    liveChat: true,
    closurePayout:
      'Contact support by phone or secure email; withdrawal methods include transfer, domestic wire or Treasurer’s Check.',
    disqualifiers: 'Applicants resident in California or U.S. territories (except DC) excluded.',
    personalizedLimits: true,
  });
  facts(b, 'product', {
    headlineBalanceCap: 1000000,
    interestMinimum: 10,
    linkedAccountRequired: false,
    directDepositRequired: false,
  });
  discovery(
    b,
    'Liquidity',
    'Internal transfer freedom does not apply to external transfers',
    'The FAQ shows available-balance internal transfers but directs external-limit questions to authenticated Limits & Delivery Times.',
    'External capacity cannot be inferred from the internal table.',
    'Inspect your external limits and the six-withdrawal calendar-month allowance.',
    ['faq'],
  );
  discovery(
    b,
    'Eligibility',
    'Geography and legal-bank overlap',
    'Ivy excludes California applicants and shares coverage with Cambridge Savings Bank.',
    'The same advertised rate is not available to every applicant.',
    'Check residence eligibility and other Cambridge Savings Bank deposits.',
    ['faq'],
  );
}
{
  const b = get('vio');
  identity(b, 'product', 'MidFirst Bank', 'midfirst-bank');
  const src = source(
    b,
    'transfers',
    'https://www.viobank.com/resources/frequently-asked-questions/transfers',
    'Transfer FAQ',
    'Withdrawal limits and first outgoing wire authorization',
  );
  facts(b, src, {
    outgoingAchSupported: true,
    outgoingAchDaily: 25000,
    outgoingAchMonthly: 100000,
    externalPullSupported: true,
    externalPullLimit: 'Vio stated limits do not apply; initiating bank limits still apply.',
    outgoingWireSupported: true,
    wireNoPublishedCap: true,
    cashierCheck: true,
  });
  b.profile!.facts.wireNoPublishedCap.notes =
    'Subject to approval, notarized first-wire authorization and a verification call. Processing time remains unknown.';
  const faq = source(
    b,
    'faq',
    'https://www.viobank.com/resources/frequently-asked-questions',
    'Vio FAQ',
    'Mobile deposits, mailed checks, wires and account availability',
  );
  facts(b, faq, {
    mobileCheckSupported: true,
    mobileCheckDaily: 100000,
    mobileCheckMonthly: 250000,
    mailedCheckSupported: true,
    incomingWireSupported: true,
    incomingWireLimit: 'No pre-established amount limit',
  });
  facts(b, 'product', {
    paperStatementFee: 5,
    achPullHoldDays: 5,
    linkedAccountRequired: false,
    directDepositRequired: false,
    accessClass: 'Savings-only vault',
  });
  discovery(
    b,
    'Liquidity',
    'First wire requires notarized paperwork',
    'Vio requires a notarized authorization for the first outgoing wire, a request form for each wire and a verification call.',
    'An unrestricted amount is not an immediate exit promise.',
    'Complete authorization ahead of time; ask about processing time, fees and available funds.',
    ['transfers'],
  );
}
{
  const b = get('peak');
  const faq = source(
    b,
    'faq',
    'https://www.peak.bank/peak-bank/faq',
    'Peak FAQ',
    'Wire support, funding activation, legal bank and contact',
  );
  identity(b, faq, 'Idaho First Bank', 'idaho-first-bank');
  facts(b, faq, {
    incomingWireSupported: true,
    outgoingWireSupported: false,
    outgoingAchSupported: true,
    newAccountHoldDays: 5,
    maximumInitialDeposit: 5000,
    mobileCheckSupported: true,
    supportPhone: '1-866-484-5705',
    supportEmail: 'customerservice@peak.bank',
    secureMessaging: true,
    mobileApp: 'Idaho First Bank app',
    institutionHistory: 'Division of Idaho First Bank; bank established in 2005',
  });
  b.profile!.facts.maximumInitialDeposit.notes =
    'FAQ limit for application ACH funding; do not apply this to all later deposits or other methods.';
  facts(b, 'product', {
    headlineBalanceCap: 499999.99,
    linkedAccountRequired: false,
    directDepositRequired: false,
  });
  discovery(
    b,
    'Liquidity',
    'Incoming-only wires',
    'Peak says it does not support outgoing wires. External transfer access starts after a five-business-day activation period.',
    'A high savings APY does not establish rapid full-balance access.',
    'Verify outbound ACH limits and closure payout before funding; limits are not published in the reviewed FAQ.',
    ['faq'],
  );
}
{
  const b = get('westernalliance');
  identity(b, 'product', 'Western Alliance Bank', 'western-alliance-bank');
  facts(b, 'product', {
    openingMinimum: 500,
    interestMinimum: 0.01,
    outgoingAchSupported: true,
    outgoingAchPerTransaction: 250000,
    incomingAchPerTransaction: 250000,
    linkedExternalAccounts: 1,
    outgoingWireSupported: false,
    incomingWireSupported: false,
    mobileCheckSupported: false,
    achPullHoldDays: 5,
    achProcessingMax: 5,
    supportPhone: '1-866-347-1476',
    supportHours: 'Monday–Friday 6 a.m.–6 p.m. PT',
    weekendSupport: false,
    support247: false,
    accessClass: 'Savings-only vault',
    directDepositRequired: false,
    linkedAccountRequired: false,
  });
  discovery(
    b,
    'Product scope',
    'Premier online HYSA has its own rails',
    'The online High-Yield Savings Premier product has one linked external account and a $250,000 single-transfer cap.',
    'Branch savings, general bank disclosures and Raisin products must not be treated as this account.',
    'Verify the Premier account disclosure, hold timing and alternate closure route.',
    ['product'],
  );
}
{
  const b = get('pibank');
  identity(b, 'product', 'Intercredit Bank, N.A.', 'intercredit-bank-na');
  const agreement = source(
    b,
    'agreement',
    'https://www.pibank.com/wp-content/uploads/2025/10/Online-Services-and-Mobile-Banking-Agreement.pdf',
    'Online services and mobile banking agreement',
    'External transfers are domestic wires',
  );
  facts(b, agreement, { outgoingWireSupported: true, outgoingAchSupported: false });
  const fees = source(
    b,
    'fees',
    'https://www.pibank.com/schedule-of-fees/',
    'Schedule of fees',
    'Savings transfer fees',
  );
  facts(b, fees, { outgoingWireFee: 0, incomingWireFee: 0 });
  facts(b, 'product', {
    directDepositRequired: false,
    linkedAccountRequired: false,
    accessClass: 'Savings-only vault',
  });
  discovery(
    b,
    'Liquidity',
    'External exits are wires',
    'The online agreement describes external transfers as domestic wires.',
    'A receiving bank may charge fees even when Pibank does not. ACH assumptions may not match this route.',
    'Confirm the recipient’s incoming-wire fee, supported linking and full-balance limit.',
    ['agreement', 'fees'],
  );
  b.profile!.conflicts.push({
    key: 'currentApy',
    claims: [
      {
        value: 4.1,
        status: 'reported',
        confidence: 'medium',
        unit: '% APY',
        sourceIds: ['additional-0'],
        notes:
          'Earlier product-page observation dated July 2, retained from the prior research pass. The live page can change.',
      },
      {
        value: 4.25,
        status: 'verified',
        confidence: 'high',
        unit: '% APY',
        sourceIds: ['product'],
        notes: 'Homepage explicitly dates this APY September 29, 2026.',
      },
    ],
    resolved: true,
    resolution:
      'Use the later explicitly dated homepage observation; preserve the older differing product-page claim for audit.',
  });
  discovery(
    b,
    'Conflicting rates',
    'Homepage and product page carried different dated rates',
    'The earlier research recorded 4.10% on a July-dated product page and 4.25% on the September-dated homepage.',
    'A search snippet or stale subpage can select the wrong rate.',
    'Check both dated disclosures; the newer explicitly dated 4.25% rate controls this snapshot.',
    ['product', 'additional-0'],
  );
}
{
  const b = get('bask');
  identity(b, 'product', 'Texas Capital Bank', 'texas-capital-bank');
  const faq = source(
    b,
    'faq',
    'https://baskbank.com/faq',
    'Bask FAQ',
    'Funds Management: relationship-dependent caps and wires',
  );
  facts(b, faq, {
    outgoingAchSupported: true,
    personalizedLimits: true,
    limitsAge: true,
    outgoingWireSupported: true,
    wireCutoff: '5:15 p.m. CT on business days',
    supportPhone: '1-833-260-4320',
    supportHours: 'Mon–Fri 7 a.m.–7 p.m.; Sat 9 a.m.–4 p.m. CT',
    weekendSupport: true,
    support247: false,
  });
  b.profile!.facts.outgoingAchDaily = unknownFact(
    'Published range $100,000–$250,000/day depends on relationship and activity. Your exact tier has not been verified.',
  );
  b.profile!.facts.outgoingAchMonthly = unknownFact(
    'Published range $150,000–$300,000/calendar month, 6–12 transfers. Your exact tier is unknown.',
  );
  const sec = source(
    b,
    'security',
    'https://baskbank.com/security-center',
    'Security center',
    'Account monitoring',
  );
  facts(b, sec, { fraudMonitoring: true });
  facts(b, 'product', { directDepositRequired: false, linkedAccountRequired: false });
  discovery(
    b,
    'Liquidity',
    'Transfer tier is individualized',
    'Bask publishes ranges for per-transfer, daily and monthly caps; wire availability also depends on relationship.',
    'Using the largest published tier for every saver overstates liquidity.',
    'Check your assigned limits and available wire features.',
    ['faq'],
  );
}
{
  const b = get('cit');
  const product = source(
    b,
    'current-product',
    'https://www.cit.com/cit-bank/platinum-savings',
    'Platinum Savings',
    'Whole-balance tiers and First Citizens aggregation',
  );
  identity(b, product, 'First-Citizens Bank & Trust Company', 'first-citizens-bank-trust');
  facts(b, product, {
    directDepositRequired: false,
    linkedAccountRequired: false,
    interestMinimum: 0,
  });
  const agreement = source(
    b,
    'agreement',
    'https://www.cit.com/resources/CIT-Bank-Agreement-for-Personal-Accounts.pdf',
    'Agreement for Personal Accounts',
    'Wire transfer procedures',
  );
  facts(b, agreement, { outgoingWireSupported: true, incomingWireSupported: true, smsOtp: true });
  const promo = source(
    b,
    'boost',
    'https://www.cit.com/cit-bank/platinum-savings/boost',
    'Platinum Savings APY boost',
    'CITBOOST enrollment and tier rules',
  );
  facts(b, promo, {
    promotionalApy: 4.1,
    promoCode: 'CITBOOST',
    promoStart: '2026-02-13',
    promoDeadline: '2026-10-31',
    boostedBalanceCap: 9999999,
    promoDuration: '6 months',
    newCustomerEligibility:
      'New CIT user/account plus valid promotion code; existing-customer offer has separate conditions.',
  });
  discovery(
    b,
    'Rates',
    'Whole-balance threshold, separate boost',
    'Platinum Savings uses the entire daily balance tier; the CITBOOST promotion applies a different APY boost to each tier.',
    'The base tier model excludes this promotion until its cap, enrollment and existing-customer alternatives are implemented.',
    'Read CITBOOST and verify your exact eligibility.',
    ['current-product', 'boost'],
  );
}
{
  const b = get('liveoak');
  identity(b, 'product', 'Live Oak Banking Company', 'live-oak-banking-company');
  facts(b, 'product', {
    outgoingAchSupported: true,
    outgoingAchDaily: 250000,
    achProcessingMin: 1,
    achProcessingMax: 2,
    transferCutoff: '5 p.m. ET',
    achPullHoldDays: 5,
    externalPushSupported: true,
    mobileCheckSupported: true,
    mailedCheckSupported: true,
    incomingWireSupported: true,
    debitCard: false,
    atmCard: false,
    interestMinimum: 0.01,
    accessClass: 'Savings-only vault',
    directDepositRequired: false,
    linkedAccountRequired: false,
    bonusAmount: 300,
    promoDeadline: '2026-10-16',
  });
  discovery(
    b,
    'Bonus',
    'New money is measured against other Live Oak holdings',
    'The $300 promotion includes external-new-funds and eligibility conditions beyond parking $20,000 for 90 days.',
    'The model excludes the bonus rather than assuming the full account-history conditions.',
    'Check the current offer against your existing Live Oak balances; confirm payout and opening cutoffs.',
    ['product'],
  );
  discovery(
    b,
    'Holds',
    'Push and pull availability differ',
    'Bank-initiated pulls have a five-business-day hold after posting; external pushes are available on receipt.',
    'A generic transfer-delay setting cannot establish the bank-specific available balance.',
    'Select an appropriate funding route and enter its hold assumption.',
    ['product'],
  );
}
{
  const b = get('happen');
  b.name = 'Happen LevelUp Savings';
  const terms = source(
    b,
    'levelup',
    'https://www.happen.com/legal/deposits/levelup-savings-t-and-cs',
    'LevelUp Savings terms',
    'Evaluation periods and relationship transfer tiers',
  );
  identity(b, terms, 'Happen Bank, N.A.', 'happen-bank-na');
  facts(b, terms, {
    qualifiedApy: 4.2,
    baseApy: 3,
    currentApy: 4.2,
    qualifyingDepositRules:
      '$250 deposits in prior evaluation statement cycle; interest/bonuses/credits/refunds excluded.',
    statementCycleRules:
      'First evaluation is third statement cycle; rate change follows at end of first business day next month.',
    outgoingAchSupported: true,
    personalizedLimits: true,
    limitsAge: true,
    incomingAchDaily: 250000,
    atmCard: true,
    accessClass: 'Savings with direct ATM access',
  });
  b.profile!.facts.outgoingAchDaily = unknownFact(
    'Relationship tiers publish $10,000 / $50,000 / $250,000. Eligibility depends on combined balances and consecutive days; no tier assumed.',
  );
  discovery(
    b,
    'Product identity',
    'LevelUp is not the legacy High-Yield Savings product',
    'Legacy HYS terms say new applications ended in 2024. Current LevelUp has different deposit qualification and evaluation cycles.',
    'Mixing the two products creates incorrect APY and transfer rules.',
    'Match your account title to the correct disclosure; verify relationship tier and first evaluation month.',
    ['levelup'],
  );
}
{
  const b = get('forbright');
  const agreement = source(
    b,
    'agreement',
    'https://www.forbrightbank.com/wp-content/uploads/2025/01/Deposit-Account-Agreement-and-Terms-Conditions-Growth-Savings.pdf',
    'Growth Savings deposit agreement',
    'Transfer limitations and account closure',
  );
  identity(b, agreement, 'Forbright Bank', 'forbright-bank');
  facts(b, agreement, {
    outgoingAchSupported: true,
    supportPhone: '1-800-550-0159',
    supportEmail: 'customersupport@forbrightbank.com',
  });
  discovery(
    b,
    'Liquidity',
    'Unlimited transfer count is not unlimited dollars',
    'The Growth Savings agreement removes a transfer-count ceiling. It does not establish an unlimited dollar amount.',
    'Exit capacity stays unknown without the applicable online transfer amount limits.',
    'Get the Growth Savings-specific daily/monthly limits; do not use business-banking limits.',
    ['agreement'],
  );
}
{
  const b = get('newtek');
  const rates = source(
    b,
    'rates',
    'https://www.newtekbank.com/rates-disclosure/',
    'Deposit rate disclosure',
    'Consumer High Yield Savings as of October 2, 2026',
  );
  identity(b, rates, 'Newtek Bank, N.A.', 'newtek-bank-na');
  facts(b, rates, {
    currentApy: 4.2,
    baseApy: 4.2,
    openingMinimum: 100,
    interestMinimum: 0.01,
    monthlyFee: 0,
    withdrawalCountLimit: 6,
    parentCompany: 'NewtekOne, Inc.',
  });
  const faq = source(
    b,
    'faq',
    'https://www.newtekbank.com/faq/',
    'Newtek FAQ',
    'Personal savings transfer frequency',
  );
  facts(b, faq, { withdrawalCountLimit: 6 });
  b.openingMinimum = 100;
  b.rateAsOf = '2026-10-02';
  discovery(
    b,
    'Availability',
    'Good quoted rate, applications paused',
    'The product page advertises 4.20% but says new personal HYS applications are paused.',
    'A quoted APY is not proof that a new account can be opened.',
    'Confirm applications have resumed before planning a transfer.',
    ['product'],
  );
}
{
  const b = get('capitalone');
  const src = source(
    b,
    'performance',
    'https://www.capitalone.com/bank/disclosures/savings-accounts/online-performance-savings-account/',
    '360 Performance Savings disclosure',
    'Exact product terms',
  );
  facts(b, src, {
    legalInstitutionName: 'Capital One, N.A.',
    openingMinimum: 0,
    interestMinimum: 0,
    variableRate: true,
    outgoingAchSupported: true,
    personalizedLimits: true,
    outgoingWireSupported: true,
    outgoingWireFee: 30,
    checkFee: 10,
    usPhoneRequired: true,
    cashDeposits: true,
    incomingWireSupported: true,
    branchCheckSupported: true,
    mobileApp: true,
  });
  b.profile!.facts.outgoingWireSupported.notes =
    'Only if the bank agrees to process the wire. This does not establish a full-balance limit.';
  b.profile!.facts.checkFee.notes = 'Cashier check purchased at a Capital One location.';
  b.profile!.sources.find((s) => s.id === src)!.effectiveDate = '2026-07-15';
  discovery(
    b,
    'Rates',
    'Dynamic rate was not verified',
    'The current APY was not reliably available in the reviewed source output. The older 360 Savings product has different disclosures.',
    'No rate is guessed; this account stays out of the earnings ranking.',
    'Read the current Performance Savings APY and exact transfer terms for your account.',
    ['product', 'performance'],
    'unresolved',
  );
}
{
  const b = get('bread');
  discovery(
    b,
    'Source access',
    'Live rate and operational terms need manual access',
    'The public product page did not expose a usable rate or full agreement in this research session.',
    'The existing unverified entry remains excluded.',
    'Open the Bread Savings account disclosure and fee schedule manually; verify amount limits and the legal bank.',
    ['product'],
    'unresolved',
  );
}
{
  const b = get('barclays');
  const faq = source(
    b,
    'faq',
    'https://banking.barclaysus.com/faq.html',
    'Barclays US savings FAQ',
    'Savings deposits and ACH processing',
  );
  discovery(
    b,
    'Product identity',
    'Tiered Savings and Online Savings are separate products',
    'The selected Tiered Savings APY was not verified in the accessible product page. The FAQ also describes Online Savings.',
    'Do not assign another product’s APY or transfer policy without checking scope.',
    'Confirm Tiered Savings tiers, the bank agreement and transfer limits manually.',
    ['product', 'faq'],
    'unresolved',
  );
}
{
  const b = get('amex');
  const src = source(
    b,
    'agreement',
    'https://www.americanexpress.com/content/dam/amex/en-us/banking/personal-savings/deposit_account_agreement.pdf',
    'Personal savings deposit account agreement',
    'Outgoing wires and one-time-password security',
  );
  facts(b, src, { outgoingWireSupported: true });
  const limits = source(
    b,
    'schedule',
    'https://www.americanexpress.com/content/dam/amex/en-us/banking/personal-savings/Savings-Schedule.pdf',
    'Savings schedule',
    'Transactions and transfer limitations',
  );
  discovery(
    b,
    'Product scope',
    'Savings and Rewards Checking have different schedules',
    'The savings agreement supports wires, but amount limits belong to the savings schedule, not a copied checking limit.',
    'Wire support alone does not verify a full-balance exit; the current APY is also unresolved.',
    'Review Savings Schedule and confirm the live savings APY.',
    ['agreement', 'schedule'],
    'unresolved',
  );
}
{
  const b = get('synchrony');
  const faq = source(
    b,
    'faq',
    'https://www.synchrony.com/banking/resources/faq',
    'Synchrony banking FAQ',
    'Savings ATM access and transfers',
  );
  facts(b, faq, { atmCard: true, accessClass: 'Savings with direct ATM access' });
  const product = source(
    b,
    'current-product',
    'https://www.synchrony.com/banking/products/high-yield-savings',
    'High Yield Savings',
    'Optional ATM card and Plus / Accel access',
  );
  facts(b, product, { atmCard: true, atmNetwork: 'Plus / Accel', internationalAtm: true });
  const agreement = source(
    b,
    'agreement',
    'https://www.synchrony.com/document/account-agreement.pdf',
    'Consumer deposit account agreement',
    'Savings transaction limitations',
  );
  facts(b, agreement, { withdrawalCountLimit: 6 });
  discovery(
    b,
    'Access',
    'ATM access is an actual savings feature',
    'Synchrony describes an optional ATM card for its High Yield Savings account. The current savings APY remains unverified in this review.',
    'Useful cash access does not establish unlimited online transfers.',
    'Confirm current APY, ATM daily limits, fees and how current transaction restrictions are enforced.',
    ['current-product', 'agreement'],
  );
}

type ReviewInput = [string, string, 'app' | 'overall', number | null, number | null, string];
const reviewInputs: ReviewInput[] = [
  [
    'axos_one',
    'https://www.trustpilot.com/review/axosbank.com',
    'overall',
    null,
    null,
    'Mixed product scope; numerical rating/count not captured.',
  ],
  [
    'openbank',
    'https://www.trustpilot.com/review/openbank.us',
    'overall',
    1.4,
    139,
    'Unprompted, self-selected reviews; not a representative customer sample.',
  ],
  [
    'openbank',
    'https://apps.apple.com/us/app/openbank-u-s/id6504042600?see-all=reviews',
    'app',
    4.7,
    15000,
    'Count displayed as 15K, approximate. App-specific; differs from bank-wide sentiment.',
  ],
  [
    'wealthfront',
    'https://www.trustpilot.com/review/www.wealthfront.com',
    'overall',
    null,
    null,
    'Covers brokerage/investing as well as cash; no numeric score copied without count.',
  ],
  [
    'wealthfront',
    'https://apps.apple.com/us/app/wealthfront-save-and-invest/id816020992',
    'app',
    null,
    null,
    'Combined investing and cash app; inspect current rating and count.',
  ],
  [
    'everbank',
    'https://www.trustpilot.com/review/everbank.com',
    'overall',
    null,
    null,
    'Bank-wide product scope; exact score/count not captured.',
  ],
  [
    'everbank',
    'https://apps.apple.com/us/app/everbank-mobile-banking/id6463273426?see-all=reviews',
    'app',
    null,
    null,
    'Mobile app reviews; current numeric pair not captured.',
  ],
  [
    'sofi',
    'https://apps.apple.com/us/app/sofi-bank-invest-crypto/id1191985736?see-all=reviews',
    'app',
    4.7,
    385000,
    '385K displayed, approximate; includes investing and other products.',
  ],
  [
    'sofi',
    'https://www.trustpilot.com/review/sofi.com',
    'overall',
    null,
    null,
    'Company-wide reviews include loans; not a Savings service rating.',
  ],
  [
    'etrade',
    'https://apps.apple.com/us/app/e-trade-invest-trade-save/id313259740',
    'app',
    4.7,
    381000,
    '381K displayed, approximate; heavily includes brokerage.',
  ],
  [
    'etrade',
    'https://www.trustpilot.com/review/www.etrade.com',
    'overall',
    null,
    null,
    'Brokerage and bank experiences mixed.',
  ],
  [
    'capitalone',
    'https://apps.apple.com/us/app/capital-one-mobile/id407558537?see-all=reviews',
    'app',
    4.8,
    11000000,
    '11M displayed, approximate; includes credit cards.',
  ],
  [
    'happen',
    'https://www.trustpilot.com/review/happen.com',
    'overall',
    4.7,
    14951,
    'Merged profiles and invited reviews; loans and deposits mixed.',
  ],
  [
    'cit',
    'https://www.trustpilot.com/review/bankoncit.com',
    'overall',
    null,
    null,
    'CIT, not Citibank; historical domain and product scope need review.',
  ],
  [
    'marcus',
    'https://www.trustpilot.com/review/marcus.com',
    'overall',
    1.4,
    240,
    'Self-selected company-wide reviews; not an institution safety measure.',
  ],
  [
    'marcus',
    'https://apps.apple.com/us/app/marcus-by-goldman-sachs/id1489511701?platform=ipad&see-all=reviews',
    'app',
    null,
    null,
    'App review source located; no numeric pair captured.',
  ],
  [
    'forbright',
    'https://www.trustpilot.com/review/www.forbrightbank.com',
    'overall',
    2.9,
    24,
    'Small sample; includes application experiences.',
  ],
  [
    'forbright',
    'https://apps.apple.com/us/app/forbright-bank/id6479452874?see-all=reviews',
    'app',
    4.8,
    2600,
    '2.6K displayed, approximate; Growth app, not Forbright Bank Branch app.',
  ],
  [
    'westernalliance',
    'https://www.trustpilot.com/review/www.westernalliancebancorporation.com',
    'overall',
    null,
    7,
    'Very small bank-wide sample; Premier-specific sentiment cannot be inferred.',
  ],
  [
    'peak',
    'https://www.trustpilot.com/review/peak.bank',
    'overall',
    null,
    null,
    'Reports include old versus new account rates. Individual claims are not current terms.',
  ],
  [
    'peak',
    'https://apps.apple.com/us/app/idaho-first-bank-app/id1625331821?platform=iphone&see-all=reviews',
    'app',
    null,
    null,
    'Underlying Idaho First app includes customers outside Peak.',
  ],
  [
    'bask',
    'https://www.trustpilot.com/review/www.baskbank.com',
    'overall',
    1.6,
    62,
    'Unclaimed profile; mixed product scope and self-selection.',
  ],
  [
    'bask',
    'https://apps.apple.com/us/app/bask-bank-mobile/id1472610579?platform=ipad&see-all=reviews',
    'app',
    null,
    null,
    'No current rating/count pair captured.',
  ],
  [
    'bread',
    'https://apps.apple.com/us/app/bread-savings/id1418641581?platform=iphone&see-all=reviews',
    'app',
    4.7,
    6400,
    '6.4K displayed, approximate; distinguish from Bread credit card apps.',
  ],
  [
    'bread',
    'https://www.trustpilot.com/review/breadfinancial.com',
    'overall',
    null,
    null,
    'Company-wide reviews include credit cards; not savings-specific.',
  ],
  [
    'liveoak',
    'https://www.trustpilot.com/review/www.liveoak.bank',
    'overall',
    4.6,
    2026,
    'Invited reviews, paid profile, mixed business and personal products.',
  ],
  [
    'liveoak',
    'https://apps.apple.com/us/app/live-oak-bank/id1521341307?platform=ipad&see-all=reviews',
    'app',
    null,
    null,
    'App reviews include business features.',
  ],
  [
    'barclays',
    'https://uk.trustpilot.com/review/www.banking.barclaysus.com',
    'overall',
    null,
    null,
    'Profile mixes US credit cards and savings; not a clean Tiered Savings service score.',
  ],
  [
    'ally',
    'https://apps.apple.com/us/app/ally-bank-auto-invest/id514374715?see-all=reviews',
    'app',
    4.7,
    114000,
    '114K displayed, approximate; Bank, Auto and Invest combined.',
  ],
  [
    'ally',
    'https://www.trustpilot.com/review/www.ally.com',
    'overall',
    null,
    null,
    'Auto finance and deposits mixed; do not assign auto-loan complaints to Savings.',
  ],
  [
    'brio',
    'https://www.trustpilot.com/review/briodirectbanking.com',
    'overall',
    2.3,
    6,
    'Profile named Sterling National Bank; zero reviews in last 12 months. Historical/mixed ownership, very small sample.',
  ],
  [
    'ivy',
    'https://www.trustpilot.com/review/ivybank.com',
    'overall',
    2.9,
    4,
    'Only four reviews, none in last 12 months; not a current service verdict.',
  ],
  [
    'ivy',
    'https://apps.apple.com/us/app/ivy-bank/id1507196651?platform=iphone&see-all=reviews',
    'app',
    4.6,
    418,
    'App-specific rating.',
  ],
  [
    'vio',
    'https://www.trustpilot.com/review/viobank.com',
    'overall',
    null,
    null,
    'Profile titled MidFirst Bank; scope needs manual interpretation.',
  ],
  [
    'vio',
    'https://apps.apple.com/us/app/vio-bank-mobile/id1437006028?platform=iphone&see-all=reviews',
    'app',
    null,
    null,
    'No current numeric rating/count pair captured.',
  ],
  [
    'pibank',
    'https://www.trustpilot.com/review/www.pibank.com',
    'overall',
    2.1,
    10,
    'US domain; very small self-selected sample.',
  ],
  [
    'pibank',
    'https://apps.apple.com/us/app/pibank-usa/id6503067375?platform=watch&see-all=reviews',
    'app',
    2.1,
    209,
    'Pibank USA, not similarly named overseas banking apps.',
  ],
  [
    'newtek',
    'https://www.trustpilot.com/review/newtekbank.com',
    'overall',
    4.5,
    465,
    'Invited reviews and paid profile; bank-wide, not only personal HYSA.',
  ],
  [
    'synchrony',
    'https://www.trustpilot.com/review/synchronybank.com',
    'overall',
    1,
    2079,
    'Substantial credit-card complaint content; not a savings safety or service rating.',
  ],
  [
    'synchrony',
    'https://apps.apple.com/us/app/synchrony-bank/id1357695194?platform=iphone&see-all=reviews',
    'app',
    null,
    null,
    'Savings app identified; no rating/count pair captured.',
  ],
];
for (const [id, url, category, rating, reviewCount, notes] of reviewInputs) {
  const b = get(id),
    sid = `review-${b.profile!.reviews.length + 1}`,
    publisher = url.includes('apple.com') ? 'Apple App Store' : 'Trustpilot';
  source(
    b,
    sid,
    url,
    `${b.name} reviews`,
    'Rating, review count and individual reports',
    publisher === 'Trustpilot' ? 'review' : 'app-store',
    publisher,
  );
  b.profile!.reviews.push({
    id: sid,
    category,
    scope: category === 'app' ? 'Application' : 'Company / mixed products',
    rating,
    reviewCount,
    ratingDate: DATE,
    accessedAt: DATE,
    sourceIds: [sid],
    notes,
  });
}
// Independently observed recurring reports are labelled sentiment, never operational policy.
get('openbank').profile!.themes.push({
  category: 'app',
  description: 'Some reviewers report trusted-device / push-notification access difficulties.',
  reportCount: 3,
  sourceIds: ['review-1', 'review-2'],
  notes:
    'Several independent user reports on two platforms; other reviewers describe easy access. This does not establish incident frequency or institution safety.',
});
get('forbright').profile!.themes.push({
  category: 'transfer',
  description: 'Some users report trouble linking external banks.',
  reportCount: 2,
  sourceIds: ['review-1', 'review-2'],
  notes:
    'Independent reports from Trustpilot and App Store; other users report smooth transfers. Not a verified bank limit or representative survey.',
});
{
  const b = get('wealthfront');
  const src = source(
    b,
    'history-jan',
    'https://www.wealthfront.com/blog/cash-account-apy/',
    'Cash Account APY announcement',
    'Explicit January 30, 2026 effective date',
  );
  b.profile!.rateHistory.push({
    date: '2026-01-30',
    apy: 3.3,
    product: 'Wealthfront Cash Account',
    tier: 'Regular savings',
    series: 'regular',
    sourceIds: [src],
    confidence: 'medium',
  });
  discovery(
    b,
    'History',
    'A blog date can be misleading',
    'Wealthfront notes it updates APY information in some older posts without changing the publication date.',
    'A current number on an old article is not evidence of the rate on its publication date.',
    'Only use explicitly dated rate statements or archived copies; do not fill missing months.',
    ['history-jan'],
  );
}
{
  const b = get('brio');
  const merger = b.profile!.sources.find((s) => s.id === 'merger')!;
  const open = get('openbank');
  open.profile!.sources.push({ ...merger });
  facts(open, 'merger', {
    ownershipNotes:
      'Santander/Openbank and Webster/Brio share current bank coverage. Certain pre-August-20-2026 deposits have transitional separate coverage; verify eligibility.',
    acquisitionHistory: 'Webster merged into Santander on August 20, 2026.',
  });
  discovery(
    open,
    'Insurance',
    'Check Brio / Webster overlap',
    'Santander’s merger FAQ explicitly includes Openbank, BrioDirect and HSA Bank in the post-merger institution.',
    'Brand selection is not insurance diversification by itself.',
    'Check all related deposits and any transitional coverage.',
    ['merger'],
  );
}

for (const b of catalog.banks) {
  const p = b.profile!;
  p.facts.agreementTransparency = p.sources.some((s) => /agreement/i.test(s.title))
    ? {
        value: 'Public product-specific agreement located; see linked document.',
        unit: '',
        status: 'verified',
        confidence: 'high',
        notes: 'Accessibility of a document is not an assessment of legal fairness.',
        sourceIds: p.sources.filter((s) => /agreement/i.test(s.title)).map((s) => s.id),
      }
    : unknownFact(
        'A complete current product-specific deposit agreement was not verified in this pass.',
      );
  p.researchLog.push({
    date: DATE,
    area: 'Operations / legal identity / fees',
    outcome: 'partial',
    notes:
      'Reviewed the linked product-specific documents. Unknown fields are unresolved; no absent cap is treated as unlimited.',
    sourceIds: p.sources
      .filter((s) => s.type === 'official' && s.id !== 'product')
      .map((s) => s.id),
  });
  p.researchLog.push({
    date: DATE,
    area: 'Support / security',
    outcome: 'partial',
    notes:
      'Only explicitly documented capabilities entered. Generic security marketing does not verify passkeys, hardware keys or account-freeze controls.',
    sourceIds: p.sources.filter((s) => /security|guide|faq/i.test(s.id)).map((s) => s.id),
  });
  p.researchLog.push({
    date: DATE,
    area: 'Independent customer sentiment',
    outcome: p.reviews.length ? 'partial' : 'not-found',
    notes: p.reviews.length
      ? 'Reviewed linked independent listings. Ratings retain product scope, dates and counts. Missing numerical pairs remain unknown.'
      : 'Search did not establish a clean account-specific current rating/count pair. No service verdict assigned.',
    sourceIds: p.reviews.flatMap((r) => r.sourceIds),
  });
  p.researchLog.push({
    date: DATE,
    area: 'Regulatory actions / financial condition',
    outcome: 'partial',
    notes:
      'Legal identity is sourced where verified. This is not an exhaustive enforcement, acquisition or bank-condition audit. No absence-of-enforcement or safety-strength claim is made.',
    sourceIds: p.sources.filter((s) => s.type === 'regulator').map((s) => s.id),
  });
  p.researchLog.push({
    date: DATE,
    area: 'Historical rates',
    outcome: 'partial',
    notes:
      'Sparse dated points only. No continuous 3/6/12-month coverage established; missing periods remain unknown.',
    sourceIds: [...new Set(p.rateHistory.flatMap((h) => h.sourceIds))],
  });
  if (p.facts.outgoingAchMonthly.status === 'verified')
    b.limitations.push(
      `Published outgoing ACH monthly cap: $${Number(p.facts.outgoingAchMonthly.value).toLocaleString('en-US')}; verify reset window and account-specific usage.`,
    );
  if (p.facts.paperStatementFee.status === 'verified')
    b.paperStatementFee = Number(p.facts.paperStatementFee.value);
  if (b.verification === 'verified') {
    if (p.facts.paperStatementFee.status === 'verified')
      p.facts['calculation.paperStatementFee'] = { ...p.facts.paperStatementFee };
    for (const key of ['apy', 'openingMinimum', 'monthlyFee'] as const)
      if (p.facts[`calculation.${key}`]) p.facts[`calculation.${key}`].value = b[key];
  }
  if (b.id === 'axos_one')
    p.rateHistory = [
      {
        date: DATE,
        apy: 4.21,
        product: b.name,
        tier: 'Qualified savings first $249,999.99',
        series: 'qualified-savings',
        sourceIds: ['product'],
        confidence: 'high',
      },
    ];
  if (b.apy === null) {
    p.facts.baseApy = unknownFact(
      'Current savings APY not confirmed from accessible first-party material; earnings excluded.',
    );
    p.facts.currentApy = unknownFact('No current APY verified.');
  }
}
const validated = CatalogSchema.parse(catalog);
await writeDraft('data/banks-2026-10-09-v3.yaml', toYaml(validated));
await writeDraft(`data/banks_verified_${DATE}_tool-v${VERSION}.xml`, toXml(validated));
const example = readScenario(await readFile('examples/working-person.yaml', 'utf8'));
example.dataAsOf = DATE;
example.focusYear = 2027;
example.notes = example.notes.filter((n) => !n.startsWith('Explicit v2'));
await writeDraft('examples/working-person-v3.yaml', toYaml(example));
await writeDraft(`examples/scenario_example_${DATE}_tool-v${VERSION}.xml`, toXml(example));
const log = [
  '# Bank discovery log — 2026-10-09 / Butter 3.0.0',
  '',
  'This is a manual research record, not a certification that every field is known. Unknowns and next steps are intentional. Customer sentiment is separate from official rules and insurance. No account data or customer credentials were used.',
  '',
];
for (const b of validated.banks) {
  log.push(
    `## ${b.name}`,
    ``,
    `Research date: ${b.profile!.researchedAt}. Rate effective date: ${b.rateAsOf ?? 'not stated'}. Calculation: ${b.model}.`,
    '',
  );
  for (const d of b.profile!.discoveries)
    log.push(
      `### ${d.title} (${d.status})`,
      '',
      d.finding,
      '',
      `**Why it matters:** ${d.implication}`,
      '',
      `**Check manually:** ${d.action}`,
      '',
      d.sourceIds
        .map((id) => {
          const s = b.profile!.sources.find((s) => s.id === id)!;
          return `[${s.title} — ${s.section}; accessed ${s.accessedAt}](${s.url})`;
        })
        .join(' · '),
      '',
    );
  log.push(
    '### Research coverage',
    '',
    ...b.profile!.researchLog.map((r) => `- **${r.area} (${r.outcome}):** ${r.notes}`),
    '',
    `Unresolved fact keys: ${Object.entries(b.profile!.facts)
      .filter(([, f]) => f.status === 'unknown')
      .map(([k]) => k)
      .join(', ')}.`,
    '',
  );
}
await writeDraft('docs/BANK_DISCOVERIES_v3.0.0_2026-10-09.md', log.join('\n'));
console.log(
  `Wrote ${validated.banks.length} profiles, ${validated.banks.reduce((sum, b) => sum + b.profile!.discoveries.length, 0)} discoveries.`,
);
