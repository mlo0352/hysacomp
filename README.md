# Butter — cash, with clarity

Find the best home for savings using real paydays, expenses and dated bank rules. The winner
leaves you with the most **after-tax earnings**, with the gain over doing nothing beside it.
Your baseline can win too.

[Browser app](https://mlo0352.github.io/hysacomp/) · [Agent guide](docs/AGENT_GUIDE.md) ·
[Methodology](docs/METHODOLOGY.md) · [Bank review](docs/BANK_REVIEW_2026-10-09.md)

The browser URL becomes available after the first successful GitHub Pages deployment.

## A simple way to start

Butter opens empty. Choose **Try the working-person example**, **Start from scratch**, or
import a file. The fictional example has $25,000 saved, $2,500 take-home pay every two weeks,
$3,500 in monthly expenses and seven real accounts. All assumptions are editable.

- Winner summary, dollar advantage over baseline, earnings chart and comparison table.
- **25 accounts reviewed on October 9, 2026; 17 supported models.** Unresolved rates and
  complex unmodeled products remain visible, with reasons for exclusion.
- Official sources, check dates, provider effective dates and model limits on every account.
- Dated cash flows, tiers, fees, taxes, opening transfer delays and selected opt-in offers.
- Scenario/bank import and export; raw comparison JSON, spreadsheet CSV and SVG graph images.
- No login, analytics, bank connections or remote scenario storage. The scenario lives in
  memory: **save a file before refreshing or clearing**. A fresh page load is always empty.

The original dated XML is retained locally for migration. The old personal scenario and the
HTML that embeds it are ignored by Git and excluded from the public build.

## Best used locally with an AI agent

Ask your preferred coding agent to prepare your scenario, review bank terms, compare
alternatives and explain the result. The agent handles context; Butter handles the arithmetic.

```sh
git clone https://github.com/mlo0352/hysacomp.git
cd hysacomp
npm ci
npm run dev
```

Requires Node.js 22.12+. On Windows, `./Start-Comparator.ps1` installs missing dependencies,
chooses a local port and opens the browser. Network access is needed for the first install;
calculation and the local app work offline afterward.

```sh
npx tsx cli.ts compare --scenario examples/working-person.yaml --banks data/banks-2026-10-09.yaml --output outputs/comparison.json --graph outputs/comparison.svg
```

```sh
# Clean JSON stdout for an agent or another process.
npx tsx cli.ts compare --scenario my-plan.local.yaml --banks data/banks-2026-10-09.yaml

# Spreadsheet and portable graph image.
npx tsx cli.ts compare --scenario my-plan.local.yaml --banks data/banks-2026-10-09.yaml --format csv --output outputs/comparison.csv --graph outputs/comparison.svg

# Validate inputs and inspect the catalog.
npx tsx cli.ts validate --scenario my-plan.local.yaml --banks data/banks-2026-10-09.yaml
npx tsx cli.ts banks --banks data/banks-2026-10-09.yaml
npx tsx cli.ts --help
```

JSON includes the normalized scenario, ranked accounts, exclusions, daily balances and
earnings, warnings, tasks, sources and SHA-256 hashes of the exact input files. Browser and
CLI use one engine. SVG opens directly in a browser or image editor.

Agent entry points: [AGENTS.md](AGENTS.md), [llms.txt](llms.txt),
[tool-manifest.json](tool-manifest.json) and [JSON schemas](schemas/).

## GitHub Pages

This folder is a standalone repository root for **mlo0352/hysacomp**. When working inside
the larger Butter repo, do not push the parent repo or its database into hysacomp.

1. Publish the comparator source at the root of `mlo0352/hysacomp` on `main`.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. The [workflow](.github/workflows/pages.yml) runs engine/CLI tests, browser tests and the
   build, then deploys `dist`.

Relative assets support the `/hysacomp/` project path. The public build copies only allowed
documentation, schemas and public samples. Keep personal files in ignored `*.local.yaml`,
`*.local.json` or `outputs/`. See GitHub's [Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Development

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm run preview
```

`lib/`: schemas, parser, calculation, exports. `src/`: React UI. `data/`: dated snapshots.
`examples/`: fictional plans. `tests/`: engine, CLI and browser checks.

This focused comparator is part of Butter. It does not simulate simultaneous multi-bank
strategies, travel constraints or every bonus. Read the [model scope](docs/METHODOLOGY.md).
