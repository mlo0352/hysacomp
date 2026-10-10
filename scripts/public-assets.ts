import { cp, mkdir } from 'node:fs/promises';
// Explicit public allowlist; never copy arbitrary scenarios, outputs or legacy personal HTML.
for (const path of [
  'AGENTS.md',
  'llms.txt',
  'tool-manifest.json',
  'README.md',
  'CHANGELOG.md',
  'docs',
  'schemas',
  'examples/working-person.yaml',
  'data/banks-2026-10-09.yaml',
  'examples/working-person-v3.2.yaml',
  'examples/scenario_example_2026-10-09_tool-v3.2.0.xml',
  'data/banks-2026-10-09-v3.2.yaml',
  'data/banks_verified_2026-10-09_tool-v3.2.0.xml',
]) {
  const dest = `dist/${path}`;
  await mkdir(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
  await cp(path, dest, { recursive: true });
}
