// Data-only revision: preserve the first published v3 snapshot and correct count units.
import { readFile, writeFile } from 'node:fs/promises';
import { readCatalog, toYaml, toXml } from '../lib/files';
const catalog = readCatalog(await readFile('data/banks-2026-10-09-v3.yaml', 'utf8'));
catalog.id = 'atomic-research-2026-10-09-v3-r2';
catalog.policy +=
  ' Revision 2 corrects transaction-count units; bank terms and source dates are unchanged.';
for (const bank of catalog.banks)
  for (const key of ['outgoingAchTransactionsDaily', 'outgoingAchTransactionsMonthly']) {
    const f = bank.profile?.facts[key];
    if (f?.status === 'verified' && typeof f.value === 'number') f.unit = 'transactions';
  }
await writeFile('data/banks-2026-10-09-v3-r2.yaml', toYaml(catalog), { flag: 'wx' });
await writeFile('data/banks_verified_2026-10-09_tool-v3.0.0-r2.xml', toXml(catalog), {
  flag: 'wx',
});
