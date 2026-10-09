import { cp, mkdir } from 'node:fs/promises';
// Explicit public allowlist; never copy arbitrary scenarios, outputs or legacy personal HTML.
for (const path of ['AGENTS.md', 'llms.txt', 'tool-manifest.json', 'docs', 'schemas', 'examples/working-person.yaml', 'data/banks-2026-10-09.yaml']) {
  const dest = `dist/${path}`;
  await mkdir(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
  await cp(path, dest, { recursive: true });
}
