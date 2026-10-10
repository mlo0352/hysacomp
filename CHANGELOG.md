# 3.2.0 — 2026-10-09

- Added a searchable Reviews page and bank-profile comments: positive, mixed and negative
  experiences with attribution, direct permalinks, dates, product scope and manual checks.
- Seeded nine selected Reddit/Trustpilot comments across Peak and Ally; documented scope,
  uncertain dates, access failures and uncovered products. Peak's reported $10k cap remains
  unverified; financial models and rankings are unchanged.
- Added reviews CLI JSON, individual-review schemas, deduplication, source/date validation,
  personal source checks and review research instructions in the offline bundle.
- Bank/scenario schema 3.2 explicitly migrates 3.0/3.1 without rewriting research dates.

# Changelog

## 3.1.0 — 2026-10-09

- Nine cash-account feature categories with a three-account comparison and evidence details.
- Selected BankTruth claims cross-checked for Ally, Openbank and Axos; preserve contradictions, linked-product conditions, exact sources and manual questions.
- Personal verification notebook with export/import and changed-evidence detection, independent of the financial model.
- Features/research-queue and verification CLI commands, visible disclaimer, 3.1 schemas and offline bundle. Explicit 3.0 imports retain prior rules and dates.

## v3.0.0 — 2026-10-09

Data revision r2 corrects two transaction-count unit labels. The first published v3
snapshot is retained unchanged; calculations and source dates are unchanged.

- Versioned bank/scenario XML returns alongside YAML/JSON, with strict metadata checks,
  explicit legacy migration and incompatible-version rejection. Both schemas are 3.0.
- Research profiles for 25 products: independently sourced facts, explicit unknowns,
  conflicts, review scope, sparse APY history and a downloadable discovery log per bank.
- Axos ONE checking/savings qualification, fallback and introductory rates are separated;
  the coupled statement-cycle model remains excluded from earnings rankings.
- Product-specific operations pass covers ACH/wire distinctions, holds, cards, support,
  security and legal-bank structure. Corrects Brio's legal-bank aggregation and paper fee.
- Exit stress tests, insurance aggregation, dated-balance comparison, filters/sorting,
  earnings-winner cautions and source inspection. Unknown limits never mean unlimited.
- Focus-year interest, effective APY, cap/qualification yield loss, snapshot freshness
  and source-constrained historical statistics in the shared engine.
- CLI audit/discovery, XML conversion and explicit evaluation dates; expanded raw exports.
- Self-contained offline HTML and ZIP with public snapshots, checksums and five current
  scenario/research/refresh/history/audit prompts. Fresh loads still have no scenario.

Breaking change: schema 3.0 adds atomic profiles and decision metadata. Published v2
snapshots remain intact and import through a labeled migration. Prior schemas do not
gain verified research automatically. Linked-account assumptions are auditable inputs;
they do not imply support for a linked-account cash strategy.

## v2.0.0 — 2026-10-09

- Empty initial state; opt-in fictional salary example with seven real accounts.
- React/TypeScript browser interface with a clear after-tax winner and mandatory baseline.
- One shared deterministic engine for browser and CLI; no personal scenario in public builds.
- Actual dated monthly and biweekly flows, explicit shortfalls, fees, taxes and opening transit.
- Tiered APY, opt-in capped promotions and complete bonus maintenance/payout windows.
- Revisited 17 accounts and added eight; 25 reviewed, 17 modeled, unresolved entries excluded.
- Source-check and provider rate-effective dates visible separately.
- YAML/JSON schema 2.0, supported legacy XML imports, raw JSON/CSV and SVG exports.
- Agent prompts, AGENTS.md, llms.txt, tool manifest, generated schemas and GitHub Pages CI.
- Financial, CLI, browser parity, import/export and mobile regression coverage.

Breaking change: v2 scenarios/catalogs use YAML/JSON schema 2.0. Legacy monthly metrics and
complex bank models require explicit migration; see docs/AGENT_GUIDE.md. Dated v1 files are
kept for local reference, not loaded automatically.

## v1.0.0 — 2026-10-09

Initial downloadable build.

- Offline, single-file HTML calculator.
- Embedded default verified bank snapshot dated 2026-10-09.
- Embedded personal scenario dated 2026-10-09.
- Scenario XML import/export.
- Bank-rules XML import.
- Version compatibility checks.
- One-time and recurring monthly/weekly cash flows.
- Month-specific direct-deposit, qualifying-deposit, and checking-ADB metrics.
- Current comparison ranking by total earnings.
- Focus-year earnings column.
- Specialized calculation models for current complex offers.
- Unsupported/unverified products are shown but excluded from rankings.
- XML guide and LLM generation/update prompts included.

Compatibility:
- Scenario schema 1.0
- Bank rules schema 2.1
