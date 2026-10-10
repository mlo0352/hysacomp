// Manually selected public observations, not a scraper. Replay into ignored outputs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readCatalog, readScenario, toXml, toYaml } from '../lib/files';
import { CatalogSchema, VERSION } from '../lib/schema';
import { CustomerReviewSchema, type CustomerReview } from '../lib/review-model';
const DATE = '2026-10-09';
const catalog = readCatalog(await readFile('data/banks-2026-10-09-v3.1.yaml', 'utf8'));
catalog.id = 'review-research-2026-10-09-v32';
catalog.policy =
  'Manually reviewed, product-scoped evidence with sources, unknowns and conflicts. Calculation verification covers only modeled rules. Imported the 3.1 snapshot explicitly into 3.2 without changing financial inputs or their research dates. Selected customer reports are anecdotal, not representative or independently authenticated; they never establish bank terms or change rankings. No new rate review in this pass. Verify current bank terms before acting.';
const peakThread =
  'https://www.reddit.com/r/SavingMoney/comments/1iguc0v/looking_for_a_hysa_possibly_peakbank/';
const allyThread =
  'https://www.reddit.com/r/AllyBank/comments/1nad2n9/anyone_have_a_review_of_their_hysa_experience/';
const tp = 'https://www.trustpilot.com/review/peak.bank';
const unknown = {
  assessment: 'not-checked' as const,
  notes:
    'No official source can authenticate this individual experience. Verify current product terms separately.',
  sourceIds: [],
};
const peakPolicy = (
  notes: string,
  assessment: CustomerReview['officialContext']['assessment'] = 'related-policy',
) => ({ assessment, notes, sourceIds: ['faq'] });
function add(
  bankId: string,
  input: Partial<CustomerReview> &
    Pick<
      CustomerReview,
      | 'id'
      | 'author'
      | 'permalink'
      | 'sentiment'
      | 'topics'
      | 'excerpt'
      | 'summary'
      | 'context'
      | 'manualCheck'
    >,
) {
  const b = catalog.banks.find((b) => b.id === bankId)!;
  const r = CustomerReviewSchema.parse({
    platform: 'reddit',
    threadUrl: bankId === 'peak' ? peakThread : allyThread,
    sourceIds: [input.id],
    publishedOn: null,
    dateText: '1y ago as displayed; exact posting date not captured',
    accessedAt: DATE,
    experienceOn: null,
    product: b.name,
    scope: 'product',
    evidence: 'firsthand',
    status: 'reported',
    rating: null,
    resolution: 'unknown',
    officialContext: unknown,
    ...input,
  });
  b.profile!.customerReviews.push(r);
  b.profile!.sources.push({
    id: r.id,
    type: r.platform === 'reddit' ? 'community' : 'review',
    publisher: r.platform === 'reddit' ? 'Reddit' : 'Trustpilot',
    title: `Public comment by ${r.author ?? 'unknown author'}`,
    url: r.platform === 'trustpilot' ? tp : r.permalink,
    section:
      r.platform === 'trustpilot'
        ? `Review by ${r.author}, published ${r.publishedOn}. Text read on company listing; individual permalink could not be fetched by research tool.`
        : `Individual comment; related conversation: ${r.threadUrl}`,
    accessedAt: DATE,
    effectiveDate: null,
    ...(r.publishedOn ? { publishedAt: r.publishedOn } : {}),
  });
}
add('peak', {
  id: 'reddit-ob4yk20',
  author: 'MissionHairy2041',
  permalink: peakThread.replace(/looking_for_a_hysa_possibly_peakbank\//, 'comment/ob4yk20/'),
  dateText: '7mo ago as displayed; exact posting date not captured',
  sentiment: 'negative',
  topics: ['transfers', 'access'],
  excerpt: 'They are letting it to "drip", 10K a day at most.',
  summary: 'Reports difficulty moving savings out because of a $10,000 daily withdrawal limit.',
  context:
    'Personal account of withdrawal friction. The author also replied in the thread; those repetitions are not separate reviewers. Transfer route and account-specific terms are unclear.',
  resolution: 'reported-unresolved',
  manualCheck:
    'Ask Peak for your outbound ACH daily/monthly limits, available closure payout methods and whether external-bank pulls have different restrictions. Test a small withdrawal first.',
  officialContext: peakPolicy(
    'The FAQ permits outgoing ACH and says outgoing wires are unavailable. It does not establish the reported $10,000 outbound daily cap. The amount remains an unverified report, not a modeled limit.',
    'no-published-rule',
  ),
});
add('peak', {
  id: 'reddit-ot7srvk',
  author: 'franfromfrance',
  permalink: peakThread.replace(/looking_for_a_hysa_possibly_peakbank\//, 'comment/ot7srvk/'),
  dateText: '4mo ago as displayed; exact posting date not captured',
  sentiment: 'negative',
  topics: ['onboarding', 'access', 'app', 'support'],
  excerpt: 'Net-net: I cannot access the account / money.',
  summary:
    'Reports an enrollment/login loop and difficulty reaching support to regain account access.',
  context:
    'The commenter describes voicemail, a next-day callback they missed, and several days of email exchanges. No resolution is captured; this does not establish that all support channels are unavailable.',
  resolution: 'reported-unresolved',
  manualCheck:
    'Confirm login and password recovery before funding substantially. Ask how access problems are escalated and what withdrawal options remain during a lockout.',
  officialContext: peakPolicy(
    'Peak lists phone, email and secure messaging support. Those published channels do not establish response times or resolve this reported incident.',
  ),
});
add('peak', {
  id: 'reddit-mybwov9',
  author: 'pocketpriorities',
  permalink: peakThread.replace(/looking_for_a_hysa_possibly_peakbank\//, 'comment/mybwov9/'),
  sentiment: 'mixed',
  topics: ['onboarding', 'holds', 'support', 'app'],
  excerpt: 'The Good - The process of opening an account was pretty easy.',
  summary:
    'Praises setup and interest visibility; reports slow fund availability and awkward navigation.',
  context:
    'Edited comment reports more than ten days before funds were available, but same-day replies to three support messages. The author had not tested a significant withdrawal. Positive and negative observations are one review.',
  manualCheck:
    'Ask when funding becomes withdrawable, how account activation differs from a deposit hold, and whether quoted days are business days.',
  officialContext: peakPolicy(
    'The FAQ describes a five-business-day activation delay and separate funding-processing guidance. That does not explain or independently verify the longer delay reported here.',
  ),
});
add('peak', {
  id: 'reddit-nst7nrg',
  author: 'Far_Health_3214',
  permalink: peakThread.replace(/looking_for_a_hysa_possibly_peakbank\//, 'comment/nst7nrg/'),
  dateText: '10mo ago as displayed; exact posting date not captured',
  sentiment: 'negative',
  topics: ['transfers'],
  excerpt: 'when i tried to withdrawal 25k, it shows daily limit is 10k.',
  summary: 'Reports seeing a $10,000 daily limit while attempting a $25,000 withdrawal.',
  context:
    'Another public handle in the same thread, not independent verification. The comment also mentions an old rate; that rate is not imported into current calculations.',
  manualCheck:
    'Request the current transfer agreement and your account-specific caps. Confirm whether daily means calendar day or banking day.',
  officialContext: peakPolicy(
    'No $10,000 outbound daily cap was located in the reviewed FAQ. Account age, route and current limits need direct confirmation.',
    'no-published-rule',
  ),
});
add('peak', {
  id: 'tp-joel-20260917',
  platform: 'trustpilot',
  author: 'Joel Yates',
  permalink: 'https://www.trustpilot.com/reviews/6aac0a6db600b94818d15c10',
  threadUrl: tp,
  publishedOn: '2026-09-17',
  dateText: 'September 17, 2026',
  experienceOn: '2026-08-12',
  sentiment: 'negative',
  topics: ['support', 'transfers'],
  excerpt: 'Been over a month with no response.',
  summary: 'Reports an unanswered email asking about joint ownership and ACH transfer caps.',
  context:
    'Pre-opening inquiry, not evidence of trapped deposited funds. Text read on the company listing; the direct review link was inaccessible to the research tool.',
  evidence: 'firsthand',
  scope: 'institution',
  product: 'Peak Bank deposit accounts; exact product unspecified',
  rating: 1,
  resolution: 'reported-unresolved',
  manualCheck:
    'Confirm a reachable support channel and written outbound limits before opening. Reopen the source to check for later updates.',
  officialContext: peakPolicy(
    'The current FAQ describes joint accounts and support contacts, but does not establish an email response-time guarantee.',
  ),
});
add('peak', {
  id: 'tp-may-20260206',
  platform: 'trustpilot',
  author: 'May',
  permalink: 'https://www.trustpilot.com/reviews/6985e92ab84de4e4bfbecebe',
  threadUrl: tp,
  publishedOn: '2026-02-06',
  dateText: 'February 6, 2026',
  experienceOn: '2025-12-05',
  sentiment: 'positive',
  topics: ['app'],
  excerpt: 'Works consistently and fast.',
  summary: 'Praises the mobile app’s speed and reliability after switching savings providers.',
  context:
    'The reviewer also praises yield; that opinion does not establish a current rate or market-leading return. Text was available on the listing, not the direct review page.',
  rating: 5,
  manualCheck:
    'Test the current app and login recovery on your own device. Compare recent reports and current official rates separately.',
});
add('peak', {
  id: 'tp-wiley-20260510',
  platform: 'trustpilot',
  author: 'Wiley Won',
  permalink: 'https://www.trustpilot.com/reviews/6a007ac4dd2a69312897a7fa',
  threadUrl: tp,
  publishedOn: '2026-05-10',
  dateText: 'May 10, 2026',
  experienceOn: '2026-04-21',
  sentiment: 'negative',
  topics: ['rates-fees', 'transfers'],
  excerpt: 'The next day, I pulled all my money out.',
  summary:
    'Criticizes treatment of existing-customer rates and reports successfully withdrawing funds.',
  context:
    'The withdrawal amount and route are unspecified. This report cannot prove unlimited access, but preserves a successful exit alongside complaints. Listing text was accessible; the direct page was not.',
  rating: 2,
  resolution: 'reported-resolved',
  manualCheck:
    'Ask whether the advertised rate applies to existing accounts and verify your available withdrawal routes. Do not assume a successful unspecified transfer resolves other customers’ restrictions.',
});
add('ally', {
  id: 'reddit-nctatp8',
  author: 'Logistix1',
  permalink: allyThread.replace(
    /anyone_have_a_review_of_their_hysa_experience\//,
    'comment/nctatp8/',
  ),
  sentiment: 'positive',
  topics: ['transfers', 'support', 'features'],
  excerpt:
    "I've had one for a long time. No issues whatsoever. Easy to move money around when needed.",
  summary:
    'Describes dependable long-term savings use, easy transfers and useful savings automation.',
  context:
    'Also says the rate is not the highest. No transfer amounts, timings or support incident details are supplied.',
  manualCheck:
    'Check current transfer limits, eligibility for faster delivery and whether the savings automation fits your cash flows.',
});
add('ally', {
  id: 'reddit-nctfg5w',
  author: 'scottwsx96',
  permalink: allyThread.replace(
    /anyone_have_a_review_of_their_hysa_experience\//,
    'comment/nctfg5w/',
  ),
  sentiment: 'mixed',
  topics: ['transfers', 'onboarding'],
  excerpt:
    'I think it’s pretty great! If I had to point out any negative, it’s that the ACH transfers seem very slow compared to what I’m used to.',
  summary:
    'Likes Ally after switching from Discover, with slower-than-expected ACH transfers as a drawback.',
  context:
    'Newer customer’s comparison; no exact transfer duration, amount or route is specified. This is not a published transfer-time guarantee.',
  manualCheck:
    'Compare current standard and expedited ACH eligibility, cutoff times, new-account restrictions and recipient holds.',
});
for (const b of catalog.banks) {
  b.profile!.researchLog.push({
    date: DATE,
    area: 'Customer reviews',
    outcome: 'partial',
    notes:
      b.id === 'peak'
        ? 'Selected four Reddit comments and three Trustpilot reviews, including favorable, mixed and unfavorable experiences. Repeated posts by the same author were not counted again. Relative ages preserved; exact Reddit dates unknown. Omitted an ambiguous Peakpay comment and promotional/non-firsthand replies. Yelp access was blocked and search did not identify a matching bank listing; no Yelp review was invented. Trustpilot direct links were extracted from the readable company page but could not be fetched individually.'
        : b.id === 'ally'
          ? 'Selected one positive and one mixed savings comment from one Reddit thread. This is a small convenience sample, not a sentiment survey. Auto-loan complaints and unrelated promotional material were excluded from savings research. Other threads/platforms remain to research.'
          : 'No individual customer comments collected in this pass. Existing aggregate review listings are separate. No conclusion about service quality; research is pending.',
    sourceIds: b.profile!.customerReviews.map((r) => r.id),
  });
}
const peak = catalog.banks.find((b) => b.id === 'peak')!;
peak.profile!.discoveries.push({
  id: 'customer-withdrawal-reports',
  date: DATE,
  category: 'Customer experiences',
  title: 'Reported $10,000 withdrawal cap needs account-specific confirmation',
  finding:
    'Two public handles in one Reddit conversation describe a $10,000 daily withdrawal cap. A separate Trustpilot commenter reports a successful withdrawal of an unspecified amount. None establishes current universal limits.',
  implication:
    'The official FAQ has no outgoing wires and directs withdrawals to ACH. The current account-specific ACH cap remains unknown in the simulator.',
  action:
    'Obtain the outbound transfer agreement and confirm caps, closure payout and external-pull restrictions before moving a large balance. Read the original comments and follow-ups.',
  status: 'reported',
  sourceIds: ['reddit-ob4yk20', 'reddit-nst7nrg', 'tp-wiley-20260510', 'faq'],
  relatedFacts: ['outgoingAchDaily', 'outgoingWireSupported'],
});
const checked = CatalogSchema.parse(catalog);
const scenario = readScenario(await readFile('examples/working-person-v3.1.yaml', 'utf8'));
const root = `outputs/research-reviews-${DATE}`;
await mkdir(root, { recursive: true });
for (const [name, content] of Object.entries({
  [`banks-${DATE}-v3.2.yaml`]: toYaml(checked),
  [`banks_verified_${DATE}_tool-v${VERSION}.xml`]: toXml(checked),
  'working-person-v3.2.yaml': toYaml(scenario),
  [`scenario_example_${DATE}_tool-v${VERSION}.xml`]: toXml(scenario),
}))
  await writeFile(`${root}/${name}`, content);
console.log(
  `Saved ${checked.banks.flatMap((b) => b.profile?.customerReviews ?? []).length} sourced customer comments to ${root}.`,
);
