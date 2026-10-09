#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { compare } from './lib/engine';
import { readScenario, readCatalog, readableError, toXml } from './lib/files';
import { auditCatalog } from './lib/audit';
import { toCsv, toSvg } from './lib/export';
import { VERSION } from './lib/schema';

const help = `Butter ${VERSION} — deterministic cash comparisons for people and agents

Usage:
  npm run cli -- compare --scenario examples/working-person-v3.yaml --banks data/banks-2026-10-09-v3.yaml
  npm run cli -- compare --scenario plan.yaml --banks banks.yaml --format csv --output outputs/comparison.csv --graph outputs/comparison.svg
  npm run cli -- validate --scenario plan.yaml --banks banks.yaml
  npm run cli -- audit --banks data/banks-2026-10-09-v3.yaml --as-of 2026-10-09
  npm run cli -- banks --banks data/banks-2026-10-09-v3.yaml --format xml --output outputs/banks.xml
  npm run cli -- scenario --scenario plan.yaml --format xml --output outputs/scenario.xml

Commands: compare (default), validate, audit, discoveries, banks, scenario
Options:
  --scenario PATH   Required for compare/validate/scenario. YAML, JSON or versioned XML.
  --banks PATH      Required except for scenario. YAML, JSON or versioned XML.
  --format FORMAT   json (default); csv for compare; xml for banks/scenario.
  --as-of DATE      YYYY-MM-DD freshness evaluation date (default: today's UTC date).
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
      'as-of': { type: 'string' },
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
  if (
    positionals.length > 1 ||
    !['compare', 'validate', 'banks', 'scenario', 'audit', 'discoveries'].includes(command)
  )
    throw new Error('Unknown command. Use --help.');
  const formats = ['banks', 'scenario'].includes(command)
    ? ['json', 'xml']
    : command === 'compare'
      ? ['json', 'csv']
      : ['json'];
  if (!formats.includes(v.format!))
    throw new Error(`--format for ${command} must be ${formats.join(' or ')}`);
  if (command !== 'scenario' && !v.banks) throw new Error('--banks is required');
  if (v.graph && !['compare', 'validate'].includes(command))
    throw new Error('--graph requires compare or validate');
  const pathKey = (p: string) =>
    process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p);
  const targets = [v.output, v.graph].filter((p): p is string => !!p).map(pathKey);
  const inputs = [v.scenario, v.banks].filter((p): p is string => !!p).map(pathKey);
  if (new Set(targets).size !== targets.length || targets.some((p) => inputs.includes(p)))
    throw new Error('Output paths must be distinct and cannot overwrite input files.');
  if (v.graph && !v.graph.toLowerCase().endsWith('.svg'))
    throw new Error('--graph must end in .svg');
  if (command === 'scenario') {
    if (!v.scenario) throw new Error('--scenario is required');
    const scenario = readScenario(await readFile(v.scenario, 'utf8'));
    const result = v.format === 'xml' ? toXml(scenario) : JSON.stringify(scenario, null, 2);
    if (v.output) await save(v.output, result + '\n');
    else process.stdout.write(result + '\n');
    return;
  }
  const bankText = await readFile(v.banks!, 'utf8'),
    catalog = readCatalog(bankText);
  let output: string,
    exitCode = 0;
  if (command === 'banks')
    output = v.format === 'xml' ? toXml(catalog) : JSON.stringify(catalog, null, 2);
  else if (command === 'audit' || command === 'discoveries')
    output = JSON.stringify(auditCatalog(catalog, v['as-of']), null, 2);
  else {
    if (!v.scenario) throw new Error('--scenario is required');
    const scenarioText = await readFile(v.scenario, 'utf8'),
      scenario = readScenario(scenarioText);
    const result = compare(scenario, catalog, { asOf: v['as-of'] });
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
