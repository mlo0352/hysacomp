import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { zipSync, type Zippable } from 'fflate';
import { VERSION, BUILD_DATE } from '../lib/schema';

const name = `hysa_comparator_v${VERSION}_${BUILD_DATE}`;
let markup = await readFile('outputs/offline/index.html', 'utf8');
const offlineRoot = resolve('outputs/offline');
async function inlineAsset(path: string) {
  const target = resolve(offlineRoot, path);
  if (!target.startsWith(offlineRoot + sep))
    throw new Error('Offline asset escaped its build directory.');
  return readFile(target, 'utf8');
}
for (const match of markup.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)) {
  const js = await inlineAsset(match[1]);
  markup = markup.replace(
    match[0],
    () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`,
  );
}
for (const match of markup.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)) {
  const css = await inlineAsset(match[1]);
  markup = markup.replace(
    match[0],
    () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`,
  );
}
if (/<script\b[^>]*\bsrc=|<link\b[^>]*\brel="(?:stylesheet|modulepreload)"/i.test(markup))
  throw new Error('Offline build still references external assets.');
const html = new TextEncoder().encode(markup);
await mkdir('dist/downloads', { recursive: true });
await writeFile(`dist/downloads/${name}.html`, html);
// Public files only; never glob local scenarios or the workspace into a release.
const paths = [
  'README.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'llms.txt',
  'tool-manifest.json',
  'docs/AGENT_GUIDE.md',
  'docs/METHODOLOGY.md',
  'docs/DATA_SOURCES.md',
  `docs/XML_GUIDE_v${VERSION}_${BUILD_DATE}.md`,
  `docs/LLM_PROMPTS_v${VERSION}_${BUILD_DATE}.md`,
  `docs/BANK_DISCOVERIES_v${VERSION}_${BUILD_DATE}.md`,
  'schemas/scenario.schema.json',
  'schemas/banks.schema.json',
  'schemas/fact-inventory.json',
  'schemas/verifications.schema.json',
  'docs/FEATURE_RESEARCH.md',
  'docs/REVIEW_RESEARCH.md',
  'data/reddit-timestamps-2026-10-10.json',
  `data/banks_verified_2026-10-09_tool-v${VERSION}.xml`,
  'data/banks-2026-10-09-v3.2-r2.yaml',
  `examples/scenario_example_2026-10-09_tool-v${VERSION}.xml`,
  'examples/working-person-v3.2.1.yaml',
];
const files: Zippable = { [`${name}.html`]: html };
const hashes: Record<string, string> = {};
for (const path of paths) files[path] = await readFile(path);
for (const [path, bytes] of Object.entries(files))
  hashes[path] = createHash('sha256')
    .update(bytes as Uint8Array)
    .digest('hex');
files['SHA256SUMS.json'] = new TextEncoder().encode(JSON.stringify(hashes, null, 2) + '\n');
const zip = zipSync(files, { level: 9, mtime: new Date(`${BUILD_DATE}T12:00:00Z`) });
await writeFile(`dist/downloads/butter-v${VERSION}-offline.zip`, zip);
console.log(
  `Offline HTML: ${html.length.toLocaleString()} bytes; bundle: ${zip.length.toLocaleString()} bytes; ${paths.length + 2} public files.`,
);
