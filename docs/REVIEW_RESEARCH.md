# Customer comments and source checks — Butter 3.2

Customer experiences help identify questions that headline APY misses: withdrawal caps,
access failures, onboarding, holds, support, app reliability and successful everyday use.
They are self-reported experiences, not proof of current terms, solvency or universal behavior.
The Reviews page and each bank profile expose positive, negative, mixed and neutral comments.
The initial collection is deliberately small: nine comments for two of 25 products, gathered
2026-10-09. It is a convenience sample, not a sentiment survey. Other products need research.

## Agent workflow

Read AGENTS.md and the generated banks schema. Start with an exact institution AND product.
Search for favorable and unfavorable firsthand experiences, including follow-ups, resolution
and mixed reports. Reddit, Yelp, Trustpilot, app stores and relevant forums are supported.
Do not automatically scrape platforms or bypass access restrictions. Exclude bots, referrals,
hearsay presented as personal experience, unrelated businesses and unrelated loan/card products.

1. Save one `profile.customerReviews` record per selected comment, with a stable ID, original
   public author handle (or null), platform, individual permalink, conversation/listing URL,
   exact short excerpt, your own summary, product scope, sentiment and topic labels.
2. Preserve context that changes interpretation: a missed callback, a later successful exit,
   an untested withdrawal, an edited complaint or a bank response. Mixed reviews stay mixed.
   Use only public review attribution; do not collect account numbers or private identifiers.
3. Store actual `accessedAt`, nullable exact `publishedOn` and `experienceOn`, and `dateText`
   as displayed. A relative age is not an exact date. Never substitute collection date for
   posting date or invent dates. Inspect the exact comment's DOM `time[datetime]`, timestamp
   attributes or public JSON `created_utc` before declaring the date unknown. Match comment ID
   and author; do not use the thread's date or an edit timestamp. Save the exact UTC timestamp,
   metadata URL and verification date. Record a blocked permalink even if its text was read on a
   listing; retain both links and explain which one was actually accessible.
4. Attach dated source records using `sourceIds`. `status` is always `reported`. A review's
   `rating` is that reviewer's 0–5 star rating or null, never a Reddit vote count. Platform
   ratings/listing counts belong in the separate existing `profile.reviews` array.
5. Add actionable `manualCheck` questions. Verify operational claims against official terms
   in `officialContext` with independent source IDs, scope and caveats. A policy can support
   a rule without proving an incident. A reported cap must not silently become a verified
   calculator limit. Leave unverified facts unknown and preserve conflicts.
6. Deduplicate permalinks, including alternate Reddit URLs and tracking parameters. Multiple
   comments by one public handle are not independent customers; shared threads are correlated.
   Counts group public handles, not authenticated people. Do not infer prevalence, a safety
   score or a bank-wide average from selected comments. Do not force equal sentiment counts.
7. Record selection criteria, inaccessible sources, scope exclusions and remaining work in
   `researchLog` with area `Customer reviews`; add meaningful discoveries with manual actions.
   Preserve old dated snapshots. Never label unsearched products as thoroughly reviewed.

Use short quotations, attribute them visibly and link the original. For non-Reddit pages,
keep total quoted text from one source within 25 words. Prefer concise original summaries
and links; do not copy entire reviews or platform databases. Third-party content retains
its original rights and may be edited, removed, moderated or unavailable later.

## Files and CLI

```sh
npx tsx cli.ts reviews --banks data/banks-2026-10-09-v3.2-r2.yaml --output outputs/reviews.json
npx tsx cli.ts audit --banks data/banks-2026-10-09-v3.2-r2.yaml
npx tsx cli.ts banks --banks data/banks-2026-10-09-v3.2-r2.yaml --format xml --output outputs/banks.xml
```

The `reviews` report requires no scenario and makes no network requests. It contains raw
comments, linked sources, counts, topic-to-comment mappings, curation logs and questions.
The browser filters bank/sentiment/platform/topic/text and exports matching comments plus
source context. Full bank YAML/JSON/XML preserves every review. To add comments, edit a
local bank file following the schema, validate with `banks` or `audit`, then Import banks.
The current snapshot is a complete example of the DSL. No new review changes yield rankings.

Personal checks use `customer-review:REVIEW_ID`, bind to the exact comment and its sources,
and export through the existing local verification notebook. A confirmed source check
means the person checked the quoted evidence; it does not authenticate the reported event.
No public usernames are linked across platforms, and nobody is contacted automatically.

## Initial Peak investigation

The supplied Reddit thread contains two public handles reporting a $10,000 daily exit cap,
an enrollment/access complaint and a mixed onboarding/funding report. The FAQ permits
outgoing ACH but not outgoing wires; it does not publish the reported outbound cap.
The simulator therefore keeps the ACH cap unknown. The selected Trustpilot comments also
include praise for app reliability and a negative rate review describing a successful exit.
These different experiences stay visible together. On 2026-10-10 all six saved Reddit dates
were corrected from exact comment metadata; the original collection date remains 2026-10-09.
See `data/reddit-timestamps-2026-10-10.json`. Cards show only Collected; metadata and context
are available under Details & sources and in exports. Disclaimers open on request.
Yelp access was blocked and search did not yield a matching bank listing; no Yelp review
was added. This is an open research gap, not a conclusion about the bank.
