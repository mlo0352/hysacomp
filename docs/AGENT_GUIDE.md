# Butter agent interface — 3.0.0

Read the [XML guide](XML_GUIDE_v3.0.0_2026-10-09.md),
[five task prompts](LLM_PROMPTS_v3.0.0_2026-10-09.md), [methodology](METHODOLOGY.md)
and [tool manifest](../tool-manifest.json). Browser and CLI call the same deterministic engine.

## Run locally

```sh
npm ci
npx tsx cli.ts validate --scenario examples/working-person-v3.yaml --banks data/banks-2026-10-09-v3.yaml
npx tsx cli.ts compare --scenario examples/working-person-v3.yaml --banks data/banks-2026-10-09-v3.yaml --as-of 2026-10-09 --output outputs/result.json --graph outputs/result.svg
npx tsx cli.ts audit --banks data/banks-2026-10-09-v3.yaml --output outputs/audit.json
npx tsx cli.ts discoveries --banks data/banks-2026-10-09-v3.yaml
npx tsx cli.ts banks --banks data/banks-2026-10-09-v3.yaml --format xml --output outputs/banks.xml
npx tsx cli.ts scenario --scenario examples/working-person-v3.yaml --format xml --output outputs/scenario.xml
```

`audit` and `discoveries` return the same evidence audit including missing fields,
conflicting claims, expired enrollment dates, calculation/source mismatches, discovery
notes, coverage logs and source records. **They inspect local data, not live URLs.**
Live research requires an agent with browsing and the research prompt.

Use `node --import tsx cli.ts ...` or `npm run --silent cli -- ...` for a process-tool wrapper.
Pass arguments as an array, not an interpolated shell string. No API server, model SDK or
credentials are necessary. Node 22.12+ is required.

## Output contract

- JSON includes `toolVersion`, `schemaVersion`, `evaluatedOn`, the full scenario/bank
  snapshot, `baseline`, `ranked`, `excluded`, `winnerIds`, daily series, tasks and warnings.
- `decisions[bankId]` contains ending-balance exit analysis, peak/ending insurance,
  four standard exit stress tests, freshness, history and friction completeness.
- All supporting facts and sources are in `bankSnapshot.banks[].profile`.
- `provenance` contains SHA-256 hashes of both exact CLI input files. No path/secret is added.
- CSV includes return metrics and ending-balance operational indicators. Empty cells
  mean unknown/not applicable, not zero. SVG compares earnings only; read JSON for risks.
- Exit 0: completed; exit 2: invalid input or I/O; exit 3: all candidates excluded, report emitted.

Never convert a missing metric to zero, assume an excluded bank lost, or describe the
earnings winner as the safest account. Explain the baseline, current-balance access,
potential uninsured funds and unresolved facts along with earnings.

## Privacy and reproducibility

Files and simulations remain local. Never publish personal scenarios, generated results,
credentials or the legacy personal HTML. Use ignored `*.local.*`/`outputs/` paths. Public
releases use an allowlist. An initial page has no loaded personal/example scenario.

Always record the exact snapshot, tool version and `--as-of` date. New research gets a
new dated filename; preserve old snapshots. A new `checkedOn` date requires actual review,
not merely running `audit`. Each source's access date stays attached to its own claim.

Version 2 YAML/JSON migration adds explicit migration notes and unknown research fields.
Legacy XML imports are limited to dated cash events and supported simple account rules;
undated monthly qualification metrics are rejected. Use schema 3.0 for all new output.
