import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { ScenarioSchema, CatalogSchema } from '../lib/schema';
import { FACT_GROUPS } from '../lib/profile';
await mkdir('schemas', { recursive: true });
await writeFile(
  'schemas/fact-inventory.json',
  JSON.stringify({ toolVersion: '3.0.0', schemaVersion: '3.0', groups: FACT_GROUPS }, null, 2) +
    '\n',
);
for (const [name, schema] of [
  ['scenario', ScenarioSchema],
  ['banks', CatalogSchema],
] as const) {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' });
  await writeFile(
    `schemas/${name}.schema.json`,
    JSON.stringify(
      {
        ...json,
        $id: `https://mlo0352.github.io/hysacomp/schemas/${name}.schema.json`,
        title: `Butter ${name} schema 3.0`,
        description:
          'Also run CLI validate for semantic date, uniqueness, eligibility and cross-file checks.',
      },
      null,
      2,
    ) + '\n',
  );
}
