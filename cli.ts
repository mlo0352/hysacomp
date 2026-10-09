#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { compare } from './lib/engine';
import { readScenario, readCatalog, readableError } from './lib/files';
import { toCsv, toSvg } from './lib/export';
import { VERSION } from './lib/schema';

const help = `Butter ${VERSION} — deterministic cash comparisons for people and agents

Usage:
  npm run cli -- compare --scenario examples/working-person.yaml --banks data/banks-2026-10-09.yaml
  npm run cli -- compare --scenario plan.yaml --banks banks.yaml --format csv --output outputs/comparison.csv --graph outputs/comparison.svg
  npm run cli -- validate --scenario plan.yaml --banks banks.yaml
  npm run cli -- banks --banks data/banks-2026-10-09.yaml

Commands: compare (default), validate, banks
Options:
  --scenario PATH   Required for compare/validate. YAML, JSON or legacy XML.
  --banks PATH      Required. YAML, JSON or legacy XML. No hidden live data.
  --format FORMAT   json (default) or csv. JSON includes the daily series and tasks.
  --output PATH     Write result here instead of stdout.
  --graph PATH      Write an accessible, standalone SVG comparison image.
  --help            Show this help.
  --version         Show the tool version.

Result stdout is machine-readable. Errors are JSON on stderr; exit 2 for invalid
input, exit 3 if no eligible banks remain, otherwise exit 0. Use the direct
command 'npx tsx cli.ts …' or 'npm run --silent cli -- …' for clean stdout.
Files are local, and comparisons never contact a bank or AI service.
`;
async function save(path: string, content: string) {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, content, 'utf8');
}
async function main() {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      scenario: { type: 'string' },
      banks: { type: 'string' },
      format: { type: 'string', default: 'json' },
      output: { type: 'string' },
      graph: { type: 'string' },
      help: { type: 'boolean' },
      version: { type: 'boolean' },
    },
  });
  if (v.help) {
    process.stdout.write(help);
    return;
  }
  if (v.version) {
    process.stdout.write(VERSION + '\n');
    return;
  }
  const command = positionals[0] ?? 'compare';
  if (positionals.length > 1 || !['compare', 'validate', 'banks'].includes(command))
    throw new Error('Unknown command. Use --help.');
  if (!['json', 'csv'].includes(v.format!)) throw new Error('--format must be json or csv');
  if (!v.banks) throw new Error('--banks is required');
  const pathKey = (p: string) =>
    process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p);
  const targets = [v.output, v.graph].filter((p): p is string => !!p).map(pathKey);
  const inputs = [v.scenario, v.banks].filter((p): p is string => !!p).map(pathKey);
  if (new Set(targets).size !== targets.length || targets.some((p) => inputs.includes(p)))
    throw new Error('Output paths must be distinct and cannot overwrite input files.');
  if (v.graph && !v.graph.toLowerCase().endsWith('.svg'))
    throw new Error('--graph must end in .svg');
  const bankText = await readFile(v.banks, 'utf8'),
    catalog = readCatalog(bankText);
  let output: string,
    exitCode = 0;
  if (command === 'banks') output = JSON.stringify(catalog, null, 2);
  else {
    if (!v.scenario) throw new Error('--scenario is required');
    const scenarioText = await readFile(v.scenario, 'utf8'),
      scenario = readScenario(scenarioText);
    const result = compare(scenario, catalog);
    const sha = (s: string) => createHash('sha256').update(s).digest('hex');
    output =
      command === 'validate'
        ? JSON.stringify(
            {
              valid: true,
              scenarioId: scenario.id,
              catalogId: catalog.id,
              eligibleBanks: result.ranked.length,
              excludedBanks: result.excluded.length,
            },
            null,
            2,
          )
        : v.format === 'csv'
          ? toCsv(result)
          : JSON.stringify(
              {
                ...result,
                provenance: { scenarioSha256: sha(scenarioText), banksSha256: sha(bankText) },
              },
              null,
              2,
            );
    if (v.graph) await save(v.graph, toSvg(result));
    if (!result.ranked.length) exitCode = 3;
  }
  if (v.output) await save(v.output, output + '\n');
  else process.stdout.write(output + '\n');
  process.exitCode = exitCode;
}
main().catch((error) => {
  process.stderr.write(
    JSON.stringify({ error: 'invalid_input', message: readableError(error) }) + '\n',
  );
  process.exitCode = 2;
});
