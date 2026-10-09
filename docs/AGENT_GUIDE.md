# Use Butter as an agent tool

Repository: https://github.com/mlo0352/hysacomp

## Prompt: compare my plan

> Read AGENTS.md and docs/METHODOLOGY.md. Ask for my starting cash, forecast dates, take-home
> pay schedule, expenses, one-time events, baseline APY, tax estimate, bank preferences and
> known offer eligibility. Use examples/working-person.yaml as a structural template, not as
> my personal data. Create my-plan.local.yaml using schema 2.0. Check the bank snapshot dates.
> Never invent rates, fee waivers or qualification. Run CLI validation and comparison with
> explicit scenario and bank files. Save raw JSON and SVG in outputs/. Explain net earnings,
> gain over baseline, runner-up gap, assumptions and exclusions. Keep personal files local.

Use take-home salary: the tax rate applies to interest and bonuses, not salary. Flows are
posted cash movements; some banks require a separate checking account or restrict deposits.

```sh
npx tsx cli.ts validate --scenario my-plan.local.yaml --banks data/banks-2026-10-09.yaml
npx tsx cli.ts compare --scenario my-plan.local.yaml --banks data/banks-2026-10-09.yaml --output outputs/result.json --graph outputs/result.svg
```

Use `node --import tsx cli.ts …` from another process or `npm run --silent cli -- …`.
Ordinary `npm run cli` adds an npm banner; do not parse that as JSON.

No MCP server is needed: a shell-capable agent calls the local process using the
[manifest](../tool-manifest.json). The [schemas](../schemas/) describe structural validation.
CLI `validate` also checks dates, uniqueness, supported behavior and cross-file references.

## Prompt: refresh the bank catalog

> Review every bank against official provider pages. Check APYs, tiers, minimums, fees,
> eligibility, promotion dates, funding windows, maintenance and payouts. Record the retrieval
> date separately from the provider's effective date. Save a new dated YAML snapshot and an
> audit; preserve the previous file. Mark unreadable/conflicting rates for review with a null
> APY. Use unsupported for unrepresentable rules. Never silently ignore a requirement or use
> an invented schema field. Validate and rerun the same scenario against both snapshots.

A URL is not evidence of verification. Include a short paraphrase of the visible terms and
state what is excluded. Do not copy long disclosures. No bank logins are part of this task.

## Output contract

| Field | Meaning |
| --- | --- |
| `winnerIds` | Highest-return candidate ties, or baseline if it matches/beats them |
| `ranked` | Supported, verified, feasible accounts, ordered by after-tax return |
| `excluded` | Unrankable accounts with specific reasons |
| `incrementalGain` | Candidate net return minus baseline net return |
| `endingBalance` | Ending cash before the estimated earnings-tax reserve |
| `endingAfterTax` | Ending cash after that reserve |
| `daily` | Dated balances, liquid/transit cash and cumulative earnings components |
| `tasks` | Verify, fund, maintain balances and check bonus payment |
| `provenance` | CLI-only SHA-256 hashes of exact scenario and bank file bytes |
| `bankSnapshot` | Complete normalized catalog, including effective dates, rates, terms and sources |

Exit 0 = success. Exit 2 = invalid input or I/O failure; inspect JSON stderr. Exit 3 = no
eligible bank candidates; the comparison is still emitted. Do not invent a winner after an
error. JSON output is deterministic for identical files. SVG is standalone; inspect it if
presentation matters, and share JSON alongside it for full assumptions and reproducibility.

## Legacy XML

Schema 1.0/tool 1.x scenario XML imports dated events and monthly/weekly flows, honoring
`dayOfWeek`. Undated monthly metrics are rejected because they cannot reconstruct posting
dates. Legacy imports have an unconfigured **0% baseline and 0% tax**; configure both before
interpreting. Old promotion flags do not confirm eligibility for new offers.

Schema 2.1/tool 1.x bank XML imports generic flat-rate accounts; complex models stay excluded
until migrated. Absent monthly fees default to zero with a warning. Imported verification is
the file's claim, not a fresh web check. New files and exports use YAML/JSON schema 2.0.
