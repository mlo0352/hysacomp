// Six manually inspected Reddit comment metadata responses; no runtime network access.
// Keep the original collection date and financial terms' checkedOn date unchanged.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readCatalog, readScenario, toYaml, toXml } from '../lib/files';
import { CatalogSchema, VERSION } from '../lib/schema';

const checkedAt = '2026-10-10';
const observations = [
  ['peak', 'ob4yk20', 'MissionHairy2041', 1773849018],
  ['peak', 'ot7srvk', 'franfromfrance', 1782167338],
  ['peak', 'mybwov9', 'pocketpriorities', 1750192868],
  ['peak', 'nst7nrg', 'Far_Health_3214', 1765135869],
  ['ally', 'nctatp8', 'Logistix1', 1757200100],
  ['ally', 'nctfg5w', 'scottwsx96', 1757201735],
] as const;
const catalog = readCatalog(await readFile('data/banks-2026-10-09-v3.2.yaml', 'utf8'));
catalog.id = 'review-dates-2026-10-10-v32';
const evidence = observations.map(([bankId, commentId, author, createdUtc]) => {
  const bank = catalog.banks.find((b) => b.id === bankId)!;
  const profile = bank.profile!;
  const review = profile.customerReviews.find((r) => r.id === `reddit-${commentId}`)!;
  if (review.author !== author) throw new Error('Comment attribution mismatch');
  const timestamp = new Date(createdUtc * 1000).toISOString();
  const sourceId = `timestamp-${commentId}`;
  const url = `${review.permalink}.json`;
  review.publishedOn = timestamp.slice(0, 10);
  review.dateText = timestamp;
  review.sourceIds.push(sourceId);
  profile.researchedAt = checkedAt;
  profile.sources.push({
    id: sourceId,
    type: 'community',
    publisher: 'Reddit',
    title: `Publication timestamp for ${author}`,
    url,
    section: `Comment id=${commentId}; author=${author}; created_utc=${createdUtc} = ${timestamp}. Exact comment metadata; not the parent post or edit date. Checked ${checkedAt}. Original text collected ${review.accessedAt}.`,
    accessedAt: checkedAt,
    effectiveDate: null,
    publishedAt: review.publishedOn,
  });
  return {
    bankId,
    commentId,
    author,
    createdUtc,
    publishedAt: timestamp,
    checkedAt,
    sourceUrl: url,
    field: 'comment.data.created_utc',
  };
});
for (const bankId of ['peak', 'ally']) {
  const p = catalog.banks.find((b) => b.id === bankId)!.profile!;
  p.researchLog.push({
    date: checkedAt,
    area: 'Customer reviews',
    outcome: 'reviewed',
    notes:
      'Corrected every saved Reddit posting date using the exact comment ID, author and created_utc field from Reddit public JSON metadata. Earlier relative-age-only collection was incomplete. Original text collection and bank financial-terms dates remain unchanged. Full timestamps and metadata URLs are retained in source records.',
    sourceIds: evidence.filter((e) => e.bankId === bankId).map((e) => `timestamp-${e.commentId}`),
  });
}
const valid = CatalogSchema.parse(catalog);
const scenario = readScenario(await readFile('examples/working-person-v3.2.yaml', 'utf8'));
const root = 'outputs/review-date-correction-2026-10-10';
await mkdir(root, { recursive: true });
for (const [name, content] of Object.entries({
  'reddit-timestamps-2026-10-10.json': JSON.stringify(evidence, null, 2) + '\n',
  'banks-2026-10-09-v3.2-r2.yaml': toYaml(valid),
  [`banks_verified_2026-10-09_tool-v${VERSION}.xml`]: toXml(valid),
  'working-person-v3.2.1.yaml': toYaml(scenario),
  [`scenario_example_2026-10-09_tool-v${VERSION}.xml`]: toXml(scenario),
}))
  await writeFile(`${root}/${name}`, content);
console.log(JSON.stringify(evidence.map(({ author, publishedAt }) => ({ author, publishedAt }))));
