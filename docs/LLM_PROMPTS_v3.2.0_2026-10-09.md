# Copy/paste agent prompts — Butter 3.2.0 / 2026-10-09

Give the agent this file, [XML_GUIDE](XML_GUIDE_v3.2.0_2026-10-09.md), the generated
schemas/fact inventory, and the current example bank/scenario files. Repository:
https://github.com/mlo0352/hysacomp. Exact output target: tool **3.2.0**, bank/scenario
schemas **3.2**. Prefer creating validated YAML/JSON and using the CLI XML serializers.
The tool's facts, not an agent's memory, control the calculation.
All five workflows must preserve source dates and uncertainty. When interpreting customer
experiences, read REVIEW_RESEARCH.md: comments are anecdotal, never verified bank terms. Personal verification notes
are user assertions, never automatic evidence upgrades. Explain that information can be
incomplete, outdated or incorrect and current terms must be checked with the bank.

## 1. Create my personal scenario XML from plain English

```text
Use Butter 3.2.0, schema 3.2. Read AGENTS.md, the versioned XML guide, ScenarioSchema
and the fictional example. My plain-English situation is: [describe it here].

Identify starting available cash, exact start/end dates, focus year, baseline APY/fees
and estimated interest tax rate. Ask for material missing values; never copy example
finances into my plan. Inventory all one-time deposits, purchases, tax payments,
regular take-home salary (monthly/weekly/biweekly), freelance income, bonuses,
quarterly payments, living expenses, rent, travel overrides and irregular withdrawals.
Distinguish gross salary from take-home cash. Avoid counting rent or taxes twice if
already included in spending. Preserve date anchors and partial months.

Identify real payroll versus other qualifying deposits. ACH is not automatically DD.
Identify linked checking/investment reserves and ADB, eligible flow IDs, new-customer
and referral eligibility. Represent income once; linked qualification references
existing flow IDs. Record linked assumptions but do not pretend v3 models coupled
statement-cycle products. Keep unsupported banks excluded. Starting candidate cash
must exclude separately reserved money; explain this assumption.

Ask ownership category and same-legal-bank deposits for insurance estimates. Use
single/joint/other; do not infer sweep allocations or trust insurance. Ask which
products and promotions to include. Promotion eligibility requires explicit evidence
or user confirmation; no blanket opt-in.

Create my-plan.local.yaml and outputs/scenario.xml with schemaVersion 3.2,
toolVersion 3.2.0, today's actual createdAt/dataAsOf, stable IDs, dated flows/events,
and plain-English notes for every assumption. Keep personal files local/ignored.
Use weekly interval 2 for biweekly, monthly interval 3 for quarterly. Export using:
  npx tsx cli.ts scenario --scenario my-plan.local.yaml --format xml --output outputs/scenario.xml
Validate against the supplied banks file, then compare with an explicit --as-of date.
Save raw JSON and SVG. Explain gain over baseline, excluded products, liquidity/FDIC
warnings and remaining questions. Do not describe the earnings winner as safest.
```

## 2. Research banks and generate a current bank snapshot XML

```text
Research these exact cash products: [list bank AND product]. Target Butter 3.2.0,
bank schema 3.2. Read the versioned XML guide, BankSchema/ProfileSchema, generated
fact inventory and current snapshot. Browse current sources; do not trust model memory.
No bank login, account connection or automated scraping. Record actual access dates.

Read FEATURE_RESEARCH.md and run features --banks PATH for the research queue. Review
all nine categories, starting with contradictions and product-scope mismatches. Secondary
reviews such as BankTruth are leads, not verified bank rules. Preserve each selected claim,
its own source/date and assessment. Find official product disclosures to corroborate or
contradict it. Distinguish linked checking, Savings, institution-wide service, inbound vs
outbound wires, human chat vs bots and native integrations vs ordinary external transfers.
Record unavailable and unknown separately; never bulk-copy review checkmarks or prose.
Write discoveries and questions that a person can verify manually.

Work product by product. Prioritize official product/rate pages, deposit agreements,
fee schedules, funds-availability policies, ACH/external-transfer agreements, wire
terms, debit/ATM terms, FAQs, security pages, FDIC BankFind, then the appropriate OCC,
Federal Reserve, state regulator and CFPB. Record inaccessible documents and scope.
Do not copy rules from a similarly named account, old product, business product or
linked checking account into this savings account.

Research every key in schemas/fact-inventory.json, covering:
1) Exact marketed product, legal bank/parent/division, FDIC certificate/regulator,
   related-brand aggregation, direct deposit versus sweep/pass-through structure,
   ownership rules, conditional program-bank count/ceiling, acquisition history,
   dated enforcement/penalties and financial-condition review scope.
2) Current/base/qualified/intro/guaranteed APYs, variable status, marginal vs whole
   tiers, every threshold/cap, promo start/deadline/duration/code/bonus, new/referral
   eligibility, payroll versus qualifying deposits, linked products, statement cycles,
   checking AND savings ADB and disqualifiers. Keep all account rates distinct.
3) Opening/interest/fee-waiver minimums; monthly, inactivity, closure, ACH, wire in/out,
   paper statement/check, card/replacement, ATM/foreign/transaction, excessive
   withdrawal and returned-deposit fees; waiver conditions for each.
4) Initial funding methods/caps; bank-initiated incoming pulls per transaction/day/
   week/month; external pushes; mobile/mailed/branch checks and caps; incoming wires,
   cash/ATM deposits, linked-account counts, pull/new-account/check holds, wire
   availability and exceptional holds.
5) Outgoing ACH transaction/day/week/month AND count limits and reset windows;
   external pull versus bank-initiated push versus internal transfers; wires,
   transaction/day caps, fees, cutoff, processing, same-day ACH; phone increases,
   account aging/personalization, closure/full-balance payout, cashier/bank/mailed
   check alternatives, verification/fraud review, weekends/holidays and RTP/FedNow.
6) Debit/ATM access, checking dependency, network/count, fees/refunds/caps,
   ATM and purchase limits, international access, wallets, card locks and cash access.
7) Support phone/hours/24-7/weekend/chat/secure messages/email/callback/branches,
   international contacts, fraud/lost-card lines and U.S. number dependencies.
8) Each specific security control: MFA, SMS, authenticator, passkeys, hardware keys,
   biometrics, trusted-device/removal, login/transfer/transaction/large-withdrawal
   alerts, card/account locks, fraud monitoring and suspicious-login blocking.
   Generic 'advanced security' does not establish any of these controls.
9) Independent app/service/transfer/company sentiment from multiple sources when
   available: Apple/Google stores, BBB, Trustpilot, account-specific communities,
   banking publications. Store scores, counts, dates, URL, scope, approximate-count
   notes and sampling caveats. Do not use company-wide or credit-card ratings as a
   savings service rating. Themes need multiple independent reports/corroboration.
   Collect selected individual comments in profile.customerReviews, with direct permalinks,
   public attribution, short exact excerpts, your own summaries, product scope, sentiment,
   topics, full context and actual retrieval dates. Search favorable and unfavorable reports;
   preserve mixed experiences. Use publishedOn null when only a relative age is visible.
   Deduplicate comments and distinguish public handles from independent confirmations.
   Keep status reported; separate officialContext and manualCheck questions. Record access
   failures and research gaps. Never silently promote a complaint into a calculator limit.
   Run reviews --banks PATH to inspect the machine-readable collection.
10) Historical APY observations by date/product/tier/series, with source type/access
    date/confidence. Preserve sparse history. Never fill missing months or attach
    today's mutable rate to an old publication date.

EVERY atomic fact needs its own supporting sourceIds, status, confidence, unit and
notes. Every source record needs exact URL, publisher, title, relevant section,
source type, actual accessedAt and effectiveDate only when stated. Reuse a document
only when it supports the exact claim. Official/regulatory sources control objective
facts; community reports remain reported, not verified. Unknown = null/status unknown.
No published cap does NOT mean unlimited. Never infer external limits from internal
limits or equate incoming/outgoing push/pull. Explicit no-limit wire claims must name
the route and caveats. Preserve conflicting sourced claims and explain resolution.

For EACH bank write dated discoveries: unique finding, why it matters, exact manual
verification action, confidence/status and source IDs. Include researchLog outcomes
reviewed/partial/not-found/blocked for every area. A failed search is not 'no issue'.
Separate objective institutional facts from customer sentiment and insurance.

Use only supported calculator models for complete modeled paths. Keep Axos-style
coupled ADB/statement-cycle products unsupported until an exact model exists. Map
every numeric engine claim to calculation.* facts; verify no mismatch. Do not turn
unknown fees into verified zeroes. Keep unresolved rates excluded.

Create a NEW dated YAML snapshot, then serialize to
banks_verified_DATE_tool-v3.2.0.xml with root metadata and matching account attributes.
Never overwrite a published snapshot or personal file. Run CLI audit, schema/runtime
validation, XML round trip and comparisons for 50k/100k/250k/500k plus user balance.
Deliver XML, the discovery log, source coverage, unresolved questions and change summary.
```

## 3. Refresh an existing bank snapshot

```text
Refresh [file] for Butter 3.2.0/schema 3.2 using the full research checklist in prompt 2
and schemas/fact-inventory.json. Keep the original immutable. Reopen current official
sources for every numeric operational/rate claim; do not copy yesterday's number and
only change the date. Check exact product identity, promotions/caps/cycles, fees,
funding/exit limits, wires, holds, cards, legal-bank aggregation, security/support,
regulator records and separately dated review scores/counts.

Preserve historical observations, previous conflicts and discoveries. Add new dated
changes and their impact/manual check. Maintain the old access date for claims not
rechecked, downgrade unresolved current claims appropriately, and state review scope.
Preserve incompatible product changes as a separate product/model, not a rate edit.

Write new bank/date filenames with actual checkedOn/researchedAt/source dates and
correct v3 XML metadata. Verify numeric calculation fields against sourced facts.
Run audit and round-trip validation; compare identical scenarios before/after with
the same evaluation date. Report changes in dollars, insurance, exit assumptions,
eligibility and exclusions. Do not invent rate-history intervals between snapshots.
Deliver replacement XML, Markdown change/discovery log and remaining manual questions.
```

## 4. Build historical APY data

```text
Build APY history for [exact products/tiers/date range] in a new copy of the Butter
3.2.0/schema 3.2 bank snapshot. Prefer explicitly dated official rate disclosures,
press releases and archived official pages; use reputable rate-history trackers or
archived dated reviews when necessary. Retain exact URL/type/access date and confidence.

Each point needs date, APY, exact product name, balance/qualification tier, stable
series ID and source IDs. Separate fallback, regular qualified, introductory and
checking rates. Do not join a replacement product to the old product's series.
Record an explicitly evidenced validThrough only if the source establishes that
interval. An observation alone covers only that date. Do not fabricate missing
months or assume a rate held until the next observation. Mutable blog post dates
cannot establish the date of today's displayed rate.

Keep conflicting same-date observations and source uncertainty. Run historyAnalysis
for 3/6/12-month averages, observed min/max/standard deviation/change count/cuts/
increases and current-vs-history statistics. Unknown averages are expected when
coverage is incomplete. Describe observed statistics as sparse observations, not
a complete volatility record. Export valid XML, round-trip it, preserve old files,
and deliver a source/coverage log plus unresolved periods.
```

## 5. Audit and correct bank XML

```text
Audit [bank XML] against Butter 3.2.0/schema 3.2 and this XML guide. First run the local
CLI audit; then REOPEN every current official source and perform the research checklist
from prompt 2. Local schema validity alone is not factual verification.

Find stale/current APY mismatches, expired promotions, wrong product/account rates,
incorrect tier method/caps/ADB cycles, unsupported calculation models, guessed
incoming/outgoing/internal limits, ACH push/pull confusion, unknown wire/closure
capability, missing holds/fees, missing legal bank/FDIC aggregation, absent security/
support evidence, stale/mixed-product review scores and fabricated historical coverage.
Check every source reference and access/effective date. Flag objective claims sourced
only to reviews/community and conflicts with official material. Review regulatory
claims separately; lack of a located action is not assurance of safety.

For each finding record bank, fact key, old claim, supporting/conflicting sources,
severity, corrected value or explicit unknown, and a manual verification action.
Do not hide conflicting claims or stamp unreviewed facts with today's date.
Create a new corrected snapshot, updating checkedOn/researchedAt and source dates to
their actual review dates. Keep historical files and personal scenarios unchanged.

Export exact v3 XML and run runtime validation, atomic-source checks, version rejection,
round trip, low-outbound-cap stress, >250k insurance/brand aggregation, promo cap,
unknown-limit and stale-date tests. Compare the same scenario before and after.
Deliver corrected XML, a dated discovery/audit Markdown log, material output changes,
excluded products and remaining unknowns. Never claim all facts verified if any remain.
```
