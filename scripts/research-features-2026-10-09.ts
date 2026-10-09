// Manual research transcription. This script does not fetch or scrape websites.
// Replays to ignored outputs; public dated snapshots are never overwritten.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readCatalog, readScenario, toYaml, toXml } from '../lib/files';
import { CatalogSchema, VERSION } from '../lib/schema';
import { featureFor } from '../lib/features';
import type { Feature } from '../lib/feature-model';
import type { Bank } from '../lib/schema';

const checked = '2026-10-09';
const catalog = readCatalog(await readFile('data/banks-2026-10-09-v3-r2.yaml', 'utf8'));
catalog.id = 'us-cash-2026-10-09-v3_1';
catalog.policy +=
  ' Feature review adds nine cash-account categories. BankTruth is a secondary research lead, never a source for verified rates or simulation inputs. Detailed new cross-checks cover Ally, Openbank and Axos; remaining products retain earlier evidence and explicit unknown features.';
function bank(id: string) {
  return catalog.banks.find((b) => b.id === id)!;
}
function source(
  b: Bank,
  id: string,
  title: string,
  url: string,
  section: string,
  type: 'official' | 'secondary' = 'official',
  effectiveDate: string | null = null,
) {
  b.profile!.sources.push({
    id,
    title,
    url,
    section,
    type,
    publisher: type === 'secondary' ? 'BankTruth' : b.institution,
    accessedAt: checked,
    effectiveDate: type === 'secondary' ? null : effectiveDate,
    ...(type === 'secondary' && effectiveDate ? { publishedAt: effectiveDate } : {}),
  });
  return id;
}
function feature(
  b: Bank,
  key: string,
  availability: Feature['availability'],
  conditions: string,
  sourceIds: string[],
  scope: Feature['scope'] = 'product',
  product = b.name,
) {
  const f: Feature = {
    key,
    availability,
    conditions,
    sourceIds,
    scope,
    product,
    evidenceStatus: availability === 'unknown' ? 'unknown' : 'verified',
    claims: [],
  };
  b.profile!.features.push(f);
  return f;
}
function claim(
  b: Bank,
  key: string,
  sourceId: string,
  statement: string,
  assessment: Feature['claims'][number]['assessment'],
  notes: string,
) {
  let f = b.profile!.features.find((f) => f.key === key);
  if (!f) {
    f = { ...featureFor(b, key), claims: [] };
    b.profile!.features.push(f);
  }
  f.claims.push({ id: `banktruth-${key}`, statement, assessment, notes, sourceIds: [sourceId] });
}
function discovery(
  b: Bank,
  id: string,
  title: string,
  finding: string,
  implication: string,
  action: string,
  sourceIds: string[],
  status: 'verified' | 'unresolved' = 'verified',
) {
  b.profile!.discoveries.push({
    id,
    date: checked,
    category: 'Feature scope & secondary-source review',
    title,
    finding,
    implication,
    action,
    sourceIds,
    status,
    relatedFacts: [],
  });
}

const ally = bank('ally');
const ab = source(
  ally,
  'feature-banktruth-ally',
  'Ally feature review',
  'https://banktruth.com/bank-reviews/ally-bank',
  'Feature categories; selected claims only. Bank-wide review, not a Savings product disclosure. Advertiser compensation disclosed.',
  'secondary',
  '2026-04-08',
);
const as = source(
  ally,
  'feature-ally-savings',
  'Savings account features and FAQs',
  'https://www.ally.com/bank/online-savings-account/',
  'Buckets, boosters, support, fees, funding and Spending cash-deposit instructions. Comparison subsection dated September 21; individual feature effective dates are not stated.',
);
const at = source(
  ally,
  'feature-ally-transfers',
  'Bank transfer help',
  'https://www.ally.com/help/bank/transfers/',
  'International wires; external account linking; recurring transfers; wire limits',
);
feature(
  ally,
  'internationalWireOut',
  'unavailable',
  'The transfer FAQ says Ally does not send international wires. Incoming international wires are a different service.',
  [at],
);
feature(
  ally,
  'internationalWireIn',
  'conditional',
  'Incoming foreign wires use an intermediary. Confirm routing and intermediary charges before sending.',
  [at],
);
feature(
  ally,
  'externalAccountLinking',
  'available',
  'External accounts require ownership verification.',
  [at],
);
feature(ally, 'scheduledSavings', 'available', 'Recurring transfers can be scheduled.', [at]);
feature(
  ally,
  'savingsBuckets',
  'available',
  'Up to 30 named buckets organize one Savings account. They do not create separate legal accounts or insurance limits.',
  [as],
);
feature(
  ally,
  'separateSubaccounts',
  'unavailable',
  'Savings buckets are divisions of one account, not separately titled deposit accounts. Additional standalone accounts are a different question.',
  [as],
);
feature(
  ally,
  'roundUps',
  'conditional',
  'Requires Ally Spending purchases and an enabled Savings booster; accumulated round-ups transfer to savings.',
  [as],
  'linked-product',
  'Ally Spending + Savings',
);
feature(
  ally,
  'cashDeposits',
  'conditional',
  'Walmart cash loading funds an Ally Spending account. Savings access requires that linked product and a subsequent transfer.',
  [as],
  'linked-product',
  'Ally Spending → Savings',
);
feature(
  ally,
  'debitCard',
  'unavailable',
  'Savings itself has no debit card. Other Ally account types offer cards.',
  [as],
);
feature(
  ally,
  'support247',
  'available',
  'Savings page advertises phone assistance around the clock.',
  [as],
  'institution',
);
feature(
  ally,
  'liveChat',
  'available',
  'Savings page advertises chat assistance around the clock.',
  [as],
  'institution',
);
feature(
  ally,
  'supportEmail',
  'conditional',
  'Email assistance is advertised; confirm the authenticated contact channel. Never send account credentials by email.',
  [as],
  'institution',
);
feature(
  ally,
  'directDepositSupported',
  'available',
  'Payroll deposits are listed as a funding method. This does not promise early availability.',
  [as],
);
feature(
  ally,
  'mobileCheckSupported',
  'available',
  'eCheck Deposit is listed as a Savings funding method; eligibility and holds still apply.',
  [as],
);
claim(
  ally,
  'internationalWireOut',
  ab,
  'Review lists sending international wires.',
  'contradicted',
  'The current official transfer FAQ explicitly excludes outbound international wires. Keep the disagreement visible.',
);
claim(
  ally,
  'cashDeposits',
  ab,
  'Review says cash cannot be deposited.',
  'scope-mismatch',
  'Current Savings FAQ describes a Walmart route through Spending. Direct savings cash deposit and linked checking access are different.',
);
claim(
  ally,
  'roundUps',
  ab,
  'Review lists purchase round-ups.',
  'scope-mismatch',
  'The official feature depends on linked Ally Spending purchases; it is not an independent savings-card feature.',
);
claim(
  ally,
  'separateSubaccounts',
  ab,
  'Review lists no subaccounts.',
  'corroborated',
  'Literal separate accounts are distinct from savings buckets. Butter tracks both concepts so goals do not disappear from the checklist.',
);
claim(
  ally,
  'wiseIntegration',
  ab,
  'Review lists a Wise connection.',
  'unverified',
  'No first-party native integration evidence established in this pass. Funding a third-party service by ACH does not establish a native integration.',
);
claim(
  ally,
  'quickbooksIntegration',
  ab,
  'Review lists QuickBooks connectivity.',
  'unverified',
  'Confirm supported product, connection provider and permissions with Ally and Intuit.',
);
claim(
  ally,
  'support247',
  ab,
  'Review lists continuous phone support.',
  'corroborated',
  'The official Savings page supports this bank-service claim.',
);
claim(
  ally,
  'earlyDirectDeposit',
  ab,
  'Review lists paychecks arriving early.',
  'unverified',
  'Verify the eligible receiving product and payer timing; do not infer Savings early access from checking marketing.',
);
discovery(
  ally,
  'ally-review-international-wires',
  'Incoming and outgoing international wires are different',
  'BankTruth lists outbound international wires; Ally explicitly excludes them.',
  'A broad feature checkmark could produce an unusable exit route.',
  'Confirm direction, currency, intermediary and beneficiary route with Ally before moving funds.',
  [ab, at],
);
discovery(
  ally,
  'ally-review-linked-features',
  'Cash loading and round-ups depend on Spending',
  'The official Savings page describes Walmart cash loading into Spending and round-ups from Spending purchases.',
  'These features require a separate account. Buckets still represent a single legal Savings account.',
  'Check Spending eligibility, cash-loading limits and fees, and transfers to Savings; do not assign separate FDIC coverage to buckets.',
  [ab, as],
);

const open = bank('openbank');
const ob = source(
  open,
  'feature-banktruth-openbank',
  'Openbank feature review',
  'https://banktruth.com/bank-reviews/openbank',
  'Selected feature claims and identity/contact section. Page lists an LA address while linking Santander Openbank; product identity requires care.',
  'secondary',
  '2026-03-19',
);
const ot = source(
  open,
  'feature-openbank-transfers',
  'High Yield Savings transfer options',
  'https://www.openbank.us/help-and-contact/how-can-i-transfer-money-in-or-out-of-my-high-yield-savings-account/',
  'Incoming-only wires; external and scheduled transfers; receive-only RTP',
);
const op = source(
  open,
  'feature-openbank-product',
  'High Yield Savings product FAQ',
  'https://www.openbank.us/banking/high-yield-savings-account/',
  'Savings accounts do not include checks or debit-card functionality',
);
const oa = source(
  open,
  'feature-openbank-atm',
  'Santander ATM access FAQ',
  'https://www.openbank.us/help-and-contact/can-i-make-deposits-to-or-withdrawals-from-my-openbank-account-at-a-santander-bank-atm',
  'Openbank accounts cannot be linked to Santander debit cards',
);
feature(
  open,
  'outgoingWireSupported',
  'unavailable',
  'Current product help offers incoming wires only. Planned future support is not current availability.',
  [ot],
);
feature(
  open,
  'internationalWireOut',
  'unavailable',
  'No outgoing wire service is currently offered for this product.',
  [ot],
);
feature(
  open,
  'incomingWireSupported',
  'available',
  'Incoming wires are supported; cutoffs and routing instructions apply.',
  [ot],
);
feature(
  open,
  'scheduledSavings',
  'available',
  'Scheduled and recurring external transfers are supported.',
  [ot],
);
feature(
  open,
  'externalAccountLinking',
  'available',
  'An external recipient account can be linked for transfers.',
  [ot],
);
feature(
  open,
  'instantTransfers',
  'conditional',
  'Receive RTP payments only. Sending RTP is not currently offered.',
  [ot],
);
feature(
  open,
  'debitCard',
  'unavailable',
  'The US High Yield Savings product excludes debit-card functionality.',
  [op],
);
feature(
  open,
  'atmCard',
  'unavailable',
  'Openbank accounts cannot use Santander debit cards or Santander ATMs.',
  [oa],
);
feature(
  open,
  'applePay',
  'not-applicable',
  'No debit card is provided for this HYSA; an Apple Pay card from another product is outside its scope.',
  [op],
);
feature(
  open,
  'googlePay',
  'not-applicable',
  'No debit card is provided for this HYSA; a wallet card from another product is outside its scope.',
  [op],
);
claim(
  open,
  'outgoingWireSupported',
  ob,
  'Review lists domestic wire sending.',
  'contradicted',
  'Official product FAQ currently supports incoming wires only.',
);
claim(
  open,
  'internationalWireOut',
  ob,
  'Review lists international wire sending.',
  'contradicted',
  'Official product FAQ currently supports incoming wires only.',
);
claim(
  open,
  'applePay',
  ob,
  'Review lists Apple Pay.',
  'scope-mismatch',
  'This specific US HYSA has no debit card. Do not import institution-wide or similarly named bank features.',
);
claim(
  open,
  'googlePay',
  ob,
  'Review lists Google Pay.',
  'scope-mismatch',
  'This specific US HYSA has no debit card.',
);
claim(
  open,
  'zelle',
  ob,
  'Review lists Zelle transfers.',
  'unverified',
  'Confirm specifically with Santander Openbank. Open Bank at myopenbank.com is a different institution.',
);
claim(
  open,
  'wiseIntegration',
  ob,
  'Review lists a Wise connection.',
  'unverified',
  'No product-specific first-party native integration evidence established.',
);
claim(
  open,
  'earlyDirectDeposit',
  ob,
  'Review lists early payroll access.',
  'unverified',
  'Same-day availability is not a two-day early-pay guarantee. Verify the receiving product and timing.',
);
discovery(
  open,
  'openbank-review-feature-scope',
  'Review checkmarks conflict with the US HYSA disclosure',
  'Secondary wire-sending and wallet claims are not supported for this specific US savings product. Official FAQs exclude outgoing wires and debit cards.',
  'Brand-wide checkmarks can overstate how easily savings can be spent or moved.',
  'Use Santander Openbank product disclosures. Check exact legal bank and account name, not just a similar brand name.',
  [ob, ot, op, oa],
);
discovery(
  open,
  'openbank-review-identity',
  'Similar bank names need an identity check',
  'The review links openbank.us but lists a Los Angeles address. Treat institution identity as unresolved for its broad feature claims.',
  'A feature of Open Bank or a non-US Openbank offering may not apply to Santander US savings.',
  'Verify legal institution and jurisdiction independently before adopting Zelle, wallet or international-transfer claims.',
  [ob, op],
  'unresolved',
);

const axos = bank('axos_one');
const xb = source(
  axos,
  'feature-banktruth-axos',
  'Axos feature review',
  'https://banktruth.com/bank-reviews/axos-bank',
  'Selected institution-wide support, ATM and app claims; not an Axos ONE Savings disclosure.',
  'secondary',
  '2026-04-08',
);
const xp = source(
  axos,
  'feature-axos-one',
  'Axos ONE product FAQ',
  'https://www.axosbank.com/personal/bank/axos-one',
  'Debit card belongs to Checking; early pay conditions; biometric sign-in; fraud monitoring; checking and savings qualification',
);
const xf = source(
  axos,
  'feature-axos-support',
  'Personal banking FAQs',
  'https://www.axosbank.com/personal/support/faqs',
  'Contact channels; holiday exclusions; account-dependent ATM rebates; cash reload route and retailer fees',
);
feature(
  axos,
  'debitCard',
  'conditional',
  'Request a card for Axos ONE Checking. The card is not an independent Savings feature.',
  [xp],
  'linked-product',
  'Axos ONE Checking',
);
feature(
  axos,
  'earlyDirectDeposit',
  'conditional',
  'Early access depends on payer funding and participation. Verify the receiving checking account; never move a modeled payday automatically.',
  [xp],
  'linked-product',
  'Axos ONE Checking',
);
feature(
  axos,
  'biometricLogin',
  'available',
  'Product page advertises biometric app sign-in.',
  [xp],
  'institution',
);
feature(
  axos,
  'fraudMonitoring',
  'available',
  'Product page advertises real-time monitoring; this is not a guarantee against losses.',
  [xp],
  'institution',
);
feature(
  axos,
  'support247',
  'conditional',
  'Direct Banker phone support excludes Thanksgiving and Christmas according to the support FAQ.',
  [xf],
  'institution',
);
feature(
  axos,
  'liveChat',
  'unknown',
  'The FAQ explicitly identifies Evo as a virtual assistant. Human chat availability and hours still need verification.',
  [xf],
  'institution',
);
feature(
  axos,
  'secureMessaging',
  'available',
  'Authenticated online and app messaging is supported.',
  [xf],
  'institution',
);
feature(
  axos,
  'cashDeposits',
  'conditional',
  'Retail reloads require the associated debit card; merchant fees and deposit limits apply. Confirm the receiving account and transfer to savings.',
  [xf],
  'linked-product',
  'Eligible Axos debit-card account',
);
feature(
  axos,
  'atmReimbursement',
  'unknown',
  'The FAQ lists unlimited rebates for certain checking products; this does not establish the same rebate for Axos ONE Savings or Checking.',
  [xf],
  'institution',
);
claim(
  axos,
  'atmReimbursement',
  xb,
  'Review suggests unrestricted ATM fee relief.',
  'unverified',
  'The bank says reimbursement depends on account type. Confirm the Axos ONE cap, eligible ATM geography and linked card.',
);
claim(
  axos,
  'support247',
  xb,
  'Review lists continuous phone support.',
  'scope-mismatch',
  'The official support FAQ has two holiday exclusions.',
);
claim(
  axos,
  'liveChat',
  xb,
  'Review lists live chat.',
  'unverified',
  'Distinguish human assistance from the documented Evo chatbot.',
);
claim(
  axos,
  'mobileCheckSupported',
  xb,
  'Review lists mobile check deposit.',
  'unverified',
  'Bank-wide availability is not enough to establish current limits or eligibility for an individual Axos ONE account.',
);
discovery(
  axos,
  'axos-review-checking-features',
  'Savings yield and checking conveniences need separate evidence',
  'Axos ONE assigns the debit card to Checking. Early pay depends on payer timing. Support FAQ excludes two holidays and makes ATM rebates product-dependent.',
  'A bank-wide feature list hides conditions and does not solve the dual-account yield model.',
  'Verify Checking card/rebate terms separately from Savings qualification, and confirm support availability for planned transfer dates.',
  [xb, xp, xf],
);

for (const b of [ally, open, axos])
  b.profile!.researchLog.push({
    date: checked,
    area: 'Feature categories and secondary review cross-check',
    outcome: 'partial',
    notes:
      'Selected BankTruth claims were compared with official product/support pages. Unresolved integrations and unresearched features remain unknown. No full 52-feature certification, fresh app-rating audit or change to earnings rules is implied.',
    sourceIds: b.profile!.sources.filter((s) => s.id.startsWith('feature-')).map((s) => s.id),
  });
const valid = CatalogSchema.parse(catalog);
const output = 'outputs/research-features-2026-10-09';
await mkdir(output, { recursive: true });
await writeFile(`${output}/banks-2026-10-09-v3.1.yaml`, toYaml(valid));
await writeFile(`${output}/banks_verified_2026-10-09_tool-v${VERSION}.xml`, toXml(valid));
const scenario = readScenario(await readFile('examples/working-person-v3.1.yaml', 'utf8'));
await writeFile(`${output}/scenario_example_2026-10-09_tool-v${VERSION}.xml`, toXml(scenario));
const discoveries = [
  `# Bank discovery log — ${checked} / Butter ${VERSION}`,
  '',
  'Research can be incomplete, outdated or incorrect. Verify current terms directly with each bank. This pass adds selected feature cross-checks for Ally, Openbank and Axos; other products retain their prior research. Unknowns remain explicit.',
  '',
];
for (const b of valid.banks) {
  discoveries.push(
    `## ${b.name}`,
    '',
    `Research date: ${b.profile?.researchedAt ?? 'unknown'}. Rate effective date: ${b.rateAsOf ?? 'not stated'}. Calculation: ${b.model}.`,
    '',
  );
  for (const d of b.profile?.discoveries ?? []) {
    discoveries.push(
      `### ${d.title} (${d.status})`,
      '',
      d.finding,
      '',
      `**Why it matters:** ${d.implication}`,
      '',
      `**Check manually:** ${d.action}`,
      '',
    );
    for (const id of d.sourceIds) {
      const s = b.profile!.sources.find((s) => s.id === id)!;
      discoveries.push(
        `[${s.publisher}: ${s.title} — ${s.section}; accessed ${s.accessedAt}${s.publishedAt ? `; source updated ${s.publishedAt}` : ''}](${s.url})`,
        '',
      );
    }
  }
}
await writeFile(`${output}/BANK_DISCOVERIES_v${VERSION}_${checked}.md`, discoveries.join('\n'));
console.log(
  `Prepared ${valid.banks.length} profiles; ${valid.banks.reduce((n, b) => n + (b.profile?.features.length ?? 0), 0)} explicit feature assessments. Outputs: ${output}`,
);
