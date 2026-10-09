# Butter — cash, with clarity

Compare what your cash earns, how it can leave, and which conditions need checking.
**[Open Butter](https://mlo0352.github.io/hysacomp/)** ·
**[Download the offline bundle](https://mlo0352.github.io/hysacomp/downloads/butter-v3.0.0-offline.zip)** ·
[GitHub](https://github.com/mlo0352/hysacomp)

Butter starts with **no scenario**. Try the optional fictional working-person example,
enter your own cash flows, or import a YAML, JSON or XML file. Your scenario stays in
browser memory until you save it. Reloading clears it. No bank login, analytics, API key
or cloud account is needed.

Version **3.0.0**, build **2026-10-09**, scenario/bank schemas **3.0**.
The bundled bank research was checked **2026-10-09**. Retrieval dates, provider effective
dates, source dates and freshness are visible separately; variable rates can change.

## What you can do

- Compare after-tax interest, bonuses, fees and gain over a mandatory baseline.
- Model dated salary, expenses, one-time payments and withdrawals using daily balances.
- Inspect legal-bank identity, related-brand insurance, transfer limits, wires, holds,
  cards, support, security, reviews and historical rate observations.
- Stress-test a $50k, $100k, $250k, $500k or custom exit. Unknown limits stay unknown.
- Read a source and dated discovery log for each bank. Official terms and customer
  sentiment remain separate.
- Export raw JSON, CSV, an SVG chart, scenario XML and bank XML.

The library contains **25 products: 17 earnings models and 8 excluded entries**.
Excluded entries include unsupported linked-account rules, unavailable products and
unverified rates. The highlighted winner means highest modeled earnings among selected
accounts, **not a safety rating**. Liquidity and insurance warnings remain visible.

## Best with a local AI agent

Clone this repo and give your agent [AGENTS.md](AGENTS.md) plus the
[current copy/paste prompts](docs/LLM_PROMPTS_v3.0.0_2026-10-09.md). The agent can turn
plain English into a validated scenario, compare local files and return numbers and a chart.
Use the browser for the simple route; use the CLI for reproducible research and experiments.

```sh
git clone https://github.com/mlo0352/hysacomp.git
cd hysacomp
npm ci
npx tsx cli.ts compare --scenario examples/working-person-v3.yaml --banks data/banks-2026-10-09-v3.yaml --as-of 2026-10-09 --output outputs/comparison.json --graph outputs/comparison.svg
npx tsx cli.ts audit --banks data/banks-2026-10-09-v3.yaml
npx tsx cli.ts scenario --scenario examples/working-person-v3.yaml --format xml --output outputs/scenario.xml
```

Requires Node **22.12+**. `npx tsx cli.ts --help` documents all commands. JSON stdout is
machine-readable; errors are JSON on stderr. Exit 0 = success, 2 = invalid input/I/O,
3 = no eligible banks (report still emitted). `--as-of` freezes freshness checks; the
input snapshot freezes bank rules. Exact input SHA-256 hashes accompany CLI results.

Save personal plans as `*.local.yaml`, `*.local.json`, `*.local.xml` or under `outputs/`.
These paths are ignored by Git. Simulations never contact a bank or an AI provider.

## Browser and offline use

On Windows, run `Start-Comparator.ps1`, or run `npm run dev` and open the printed address.
The launcher installs missing dependencies and selects a free localhost port.

For a server-free copy, extract the offline ZIP and double-click
`hysa_comparator_v3.0.0_2026-10-09.html`. All application code, styles, the bank snapshot
and the opt-in example are embedded. The ZIP also contains editable bank/scenario XML,
YAML, schemas, documentation, prompts, discovery notes and SHA-256 checksums. Source
links need internet when you choose to open them; calculations do not.

## Evidence and limits

See the [bank discovery log](docs/BANK_DISCOVERIES_v3.0.0_2026-10-09.md) for product-specific
findings and manual checks. Research coverage is recorded per bank; **unknown does not
mean absent, unlimited, safe or unsafe**. Rates and policies are manually reviewed snapshots,
not continuous monitoring or an exhaustive regulatory audit.

Axos ONE is documented as a linked checking/savings product: qualified savings, fallback
savings, checking APY and the capped introductory boost are separate facts. Its average-
balance and statement-cycle behavior remains unranked until that model is implemented.

Exit estimates are lower bounds from known limits, with documented processing shown
separately. They do not enforce routing capacity on the posted cash-flow forecast.
Personalized limits, holidays, review delays, already-used limits and actual holds need
manual confirmation. Insurance estimates use entered ownership and related deposits;
sweep allocations and complex ownership stay unknown. Sparse historical points are never
filled forward into invented averages. See [methodology](docs/METHODOLOGY.md).

## Files and maintenance

- [XML guide and compatibility](docs/XML_GUIDE_v3.0.0_2026-10-09.md)
- [Five research/scenario/audit prompts](docs/LLM_PROMPTS_v3.0.0_2026-10-09.md)
- [Agent integration guide](docs/AGENT_GUIDE.md), [tool manifest](tool-manifest.json), [llms.txt](llms.txt)
- [Source policy](docs/DATA_SOURCES.md), [changelog](CHANGELOG.md)

New dated snapshots must use a new filename; published snapshots stay intact. Version 2
YAML/JSON has an explicit migration path; supported v1 XML has a limited migration path.
Unsupported majors, ambiguous monthly metrics and unsupported product rules are rejected
or excluded rather than guessed.

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm run test:offline
```

The Pages workflow runs those checks and deploys the explicit public build from `main`.
Enable **Settings → Pages → GitHub Actions** for a fork. `npm run build` creates both
`dist/` and the self-contained downloads. No backend is required; this focused comparator
is separate from Butter's broader cash-flow strategy/SQLite application.
