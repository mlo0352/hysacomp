import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { ScenarioSchema, CatalogSchema } from '../lib/schema';
await mkdir('schemas', { recursive: true });
for (const [name, schema] of [['scenario', ScenarioSchema], ['banks', CatalogSchema]] as const) {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' });
  await writeFile(`schemas/${name}.schema.json`, JSON.stringify({ ...json, $id: `https://mlo0352.github.io/hysacomp/schemas/${name}.schema.json`, title: `Butter ${name} schema 2.0`, description: 'Also run CLI validate for semantic date, uniqueness, eligibility and cross-file checks.' }, null, 2) + '\n');
}
