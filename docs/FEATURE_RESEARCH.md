# Features, evidence and personal verification

Butter tracks cash-account convenience as well as earnings. The checklist covers everyday
costs, security, apps, moving money, saving tools, payment connections, support, physical
access and other cash-account tools. It draws on common banking review categories, including
[BankTruth's Ally review](https://banktruth.com/bank-reviews/ally-bank), with our own product
scope, evidence states, comparison interface and manual verification workflow.

The feature count describes coverage, never bank quality. A bank with more known features
does not automatically win. The earnings engine remains separate, using supported financial
rules and an explicit baseline. Investment allocation and crypto are outside Butter's scope.

## Evidence rules

- A feature has a stable `key`, `availability`, `evidenceStatus`, `scope`, `product`,
  `conditions`, its own `sourceIds`, and optional `claims` from secondary sources.
- Availability: `available`, `conditional`, `unavailable`, `unknown`, `not-applicable`.
  Evidence: `verified`, `reported`, `conflicting`, `unknown`. A secondary claim alone
  cannot establish verified availability. Unknown does not mean unavailable.
- Scope: `product`, `linked-product`, `institution`, `unspecified`. A checking debit card
  must not become a savings-card feature. Conditional availability must explain requirements.
- Sources retain URL, publisher, section, actual access date and the provider's effective
  date when stated. The date of a review is not the date a bank feature took effect.
- Secondary claims retain their own sources and a `corroborated`, `contradicted`,
  `scope-mismatch` or `unverified` assessment. Resolving one requires first-party evidence.
  Keep disagreements and dated discoveries, including what a human should check next.
- Missing features are rendered as unknown. Existing verified boolean facts and numeric
  fees can supply the corresponding checklist items; prose needs explicit interpretation.
  Never convert a general institution review into verified product data in bulk.

The October 9 feature pass deeply cross-checks selected claims for Ally, Santander Openbank
and Axos ONE. All 25 products use the checklist and retain their earlier research. This is
not an exhaustive new review of every feature at every bank. Many integrations, app details
and physical services remain unknown and appear in the exported research queue.

## Check it yourself

Open Bank library, compare up to three products, choose a category, and open a feature cell.
The account profile also has a feature checklist and individual fact, review, historical
observation, conflict and discovery evidence rows. Follow the links and use **Record your
check** to record a date, verdict, source URL/title/section, exact product and notes.

Personal verdicts are `confirmed`, `disputed` or `needs-check`. They do not upgrade the
published research, change calculation inputs or certify a bank. Export the notebook before
closing the tab; it is held in memory only. Import merges notes without silently replacing
conflicting IDs. Keep it in an ignored `*.local.json` file; do not include account numbers,
credentials or other sensitive information.

Every entry contains an `evidenceSnapshot` of the precise claim and its source metadata.
If the underlying evidence changes, Butter marks the note `changed-evidence`; the old
confirmation is not carried forward. Old checks with unchanged evidence retain their own
visible date and still need periodic review. Unknown products/targets and future dates are
flagged. This notebook is a personal log, not an authenticated certificate or tamper-proof audit.

## Local agent interface

```sh
npx tsx cli.ts features --banks data/banks-2026-10-09-v3.2-r2.yaml --output outputs/features.json
npx tsx cli.ts audit --banks data/banks-2026-10-09-v3.2-r2.yaml --output outputs/audit.json
npx tsx cli.ts verifications --banks data/banks-2026-10-09-v3.2-r2.yaml --checks butter-verifications.local.json
```

`features` provides the full checklist, coverage counts, exact sources, secondary claims
and a per-bank prioritized research queue. `audit` includes this report alongside financial
and operational evidence gaps. These commands only inspect local files; they do not browse.
Use an agent with web access and the research prompt to investigate the queue. Record source
dates accurately, disclose inaccessible pages, preserve existing snapshots, and validate the
new catalog before comparing it. `schemas/verifications.schema.json` describes notebook
files; its independent schema version is 1.0.

Butter is a research aid, not a guarantee or personal financial advice. Information may be
incomplete, outdated or incorrect. Verify current terms, eligibility, fees, access and deposit
coverage directly with the bank before opening an account or moving money.
