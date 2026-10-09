# Source policy — Butter 3.0.0 / 2026-10-09

The current dataset is [the v3 snapshot](../data/banks-2026-10-09-v3-r2.yaml).
The [discovery log](BANK_DISCOVERIES_v3.0.0_2026-10-09.md) records product-specific findings,
their consequences, source links, coverage and manual follow-up for all 25 entries.
The earlier v2 snapshot and its review are retained as historical artifacts.

Every operational fact has its own `sourceIds`, status, confidence, unit and notes.
Source IDs reference full records **within that bank**: publisher, URL, title, section,
access date, effective date when stated, and source type. Reusing a document is allowed
only when that document actually supports each claim. A product homepage does not
verify unrelated transfer, security or support claims.

Review product/rate page, deposit agreement, fee schedule, funds-availability terms,
ACH/wire/card agreements, help/security pages and regulators. Use the exact product,
not a similarly named checking account, legacy product or general business agreement.
Unknown fields stay null with an explanation. Reported community limits never become
official policy. Conflicting observations retain both claims and the resolution.

Research is manual. The app does not scrape banks, connect accounts or refresh rates.
The dated transcription script replays reviewed observations into ignored
`outputs/research-replay-2026-10-09/`; it is not a live updater and does not overwrite
published snapshots. Later research must be saved under new dated names.

## Reviews, history and institutional risk

Independent reviews retain rating/count, scope and dates. App, company-wide, service
and transfer-experience ratings are distinct. Approximate counts are labeled. Small,
invited or mixed-product samples do not establish savings service quality. A recurring
theme requires multiple independent reports; it remains customer sentiment, not policy.

Sparse rate history preserves each dated product/tier/series observation. A rate visible
on a mutable old article is not proof of its publication-date rate. Continuous intervals
require evidence; absent months produce unknown averages, not interpolation.

FDIC identity and related-brand aggregation are separate from reviews. Sweep coverage
depends on actual allocation and overlapping deposits. Regulatory facts need regulator
sources, dates and product/entity scope. An incomplete search does not establish that
there have been no actions or that a bank is safe. The current coverage logs explicitly
mark the enforcement/financial-condition review as partial.

## Dates and freshness

`checkedOn` / XML `dataAsOf` is snapshot review date. `rateAsOf` is the bank's effective
date or null. `profile.researchedAt` bounds source access dates. Source/review dates and
history observation dates must not be invented. Display ages against today's UTC date,
or the CLI's explicit `--as-of`: 0–7 days Fresh, 8–30 Recent, 31–90 Aging, >90 Stale.
Future-dated data also warns. Freshness labels are not evidence that terms cannot change.
