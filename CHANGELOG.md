# Changelog

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
