# Butter HYSA Comparator — agent instructions

Standalone comparator: https://github.com/mlo0352/hysacomp.
This folder can also live inside the larger Butter repo; do not alter the parent app.

Read [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md), [docs/METHODOLOGY.md](docs/METHODOLOGY.md)
and [tool-manifest.json](tool-manifest.json). Requires Node 22.12+.

```sh
npm ci
npx tsx cli.ts validate --scenario examples/working-person-v3.2.1.yaml --banks data/banks-2026-10-09-v3.2-r2.yaml
npx tsx cli.ts compare --scenario examples/working-person-v3.2.1.yaml --banks data/banks-2026-10-09-v3.2-r2.yaml --as-of 2026-10-09 --output outputs/comparison.json --graph outputs/comparison.svg
npx tsx cli.ts audit --banks data/banks-2026-10-09-v3.2-r2.yaml
```

CLI stdout is JSON by default. Errors are JSON on stderr. Exit 0 = success,
2 = invalid input/I/O error, 3 = no eligible candidates (report is still emitted).

## Guarantees

- Fresh browser loads have no scenario. The opt-in salary example is fictional.
- `lib/engine.ts` is the only engine; browser and CLI use it unchanged.
- Compare identical posted cash flows and show after-tax gain over baseline.
- A baseline win or tie is valid. Never force a candidate to win for presentation.
- Never infer ACH is payroll or clamp negative balances to zero.
- Unsupported rules and unknown rates remain visible and excluded from rankings.
- No bank/network requests during simulation; dated files are explicit inputs.
- Rate updates use official providers. Record review date, provider effective date (or null),
  sources, evidence and limitations. Preserve dated snapshots; do not invent effective dates.
- Every atomic operational claim needs its own official/regulatory evidence. Preserve conflicts,
  explicit unknowns and a dated discovery/manual-check log. Reviews do not establish safety.
- Unknown limits are never unlimited. Exit analysis is a lower bound, separate from posted
  cash-flow simulations. Brand aggregation and sweep allocations must not be conflated.
- Keep XML_GUIDE, all five LLM_PROMPTS, schemas, manifest and offline bundle in sync with
  schema changes. Use the current versioned guides under docs/.
- Promotion eligibility is explicit opt-in. Timing, balances and payout windows still apply.
- Personal scenarios/results and legacy HTML embedding them must never be published.
  Use ignored `*.local.yaml`, `*.local.json` or `outputs/` for personal work.
- Public builds use an explicit documentation/sample allowlist. No analytics or bank login.

## Development

React, TypeScript, Vite, CSS modules, Zod, YAML/JSON and Recharts. The explicit GitHub Pages
hosting requirement means this focused comparator has no backend or SQLite prerequisite;
it does not replace the wider Butter FastAPI/SQLite app.

```sh
npm test
npm run test:browser # first install: npx playwright install chromium
npm run build
npm run test:offline
```

Test financial decisions that can change a winner, browser/CLI agreement and round trips.
Breaking data changes require a schema major bump, regenerated schemas and updated docs.
Legacy monthly metrics cannot be reconstructed into dated events without guessing; reject
them. Legacy imports need an explicitly configured baseline and tax rate before interpretation.


## Feature evidence (3.1)

Read docs/FEATURE_RESEARCH.md. Keep secondary claims separate from official features,
retain exact product scope and conditions, and export a research queue. Personal checks
are local assertions bound to their evidence snapshot; they never upgrade source verification
or change the earnings winner. Keep disclaimers behind explicit buttons and retain notebook export.

## Customer comments (3.2)

Read docs/REVIEW_RESEARCH.md. Keep individual comments in profile.customerReviews;
aggregate listings remain profile.reviews. Use direct permalinks, attributed short quotes,
exact or explicitly unknown posting dates, product scope, balanced context and manual checks.
Reviews are always reported, never verified bank terms. Deduplicate URLs and public handles;
do not infer prevalence or safety from the curated sample. Run reviews --banks PATH for JSON.
Inspect comment-specific timestamp metadata (DOM datetime, JSON created_utc) before marking
a posting date unknown. Preserve collection and metadata-check dates independently. Keep
the default UI concise: one source link per comment, only Collected on the card, details on demand.
