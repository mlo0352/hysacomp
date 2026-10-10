import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { CatalogSchema, ScenarioSchema, VERSION, type Catalog, type Scenario } from './schema';

const list = (value: any): any[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
function number(value: unknown, field: string, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === undefined || value === '' || !Number.isFinite(Number(value)))
    throw new Error(`Invalid or missing XML ${field}`);
  return Number(value);
}
function xml(text: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('XML document types and entities are not supported.');
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw new Error(`Invalid XML: ${valid.err.msg}`);
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    processEntities: true,
    parseTagValue: false,
  }).parse(text);
}
function legacyScenario(root: any): Scenario {
  if (root.schemaVersion !== '1.0' || !String(root.toolVersion).startsWith('1.'))
    throw new Error('Unsupported legacy scenario version. Use schema 2.0 YAML or JSON.');
  if (list(root.monthlyMetrics?.month).length)
    throw new Error(
      'Legacy monthly metrics cannot be safely dated. Convert them to explicit cash events before importing.',
    );
  const sim = root.simulation;
  if (!sim) throw new Error('Missing XML simulation');
  return ScenarioSchema.parse({
    schemaVersion: '3.2',
    id: root.id || 'imported-scenario',
    name: root.name || 'Imported scenario',
    createdAt: root.createdAt,
    startDate: sim.startDate,
    endDate: sim.endDate,
    startingCash: number(sim.startingCash, 'startingCash'),
    taxRate: 0,
    baseline: { name: 'Unconfigured baseline — edit this APY', apy: 0, monthlyFee: 0 },
    bankIds: ['everbank', 'openbank', 'marcus', 'ally', 'brio'],
    eligiblePromotionIds: [],
    transfer: { businessDays: 0, fee: 0, holdDays: 0 },
    eStatements: true,
    events: list(root.cashEvents?.cashEvent).map((e) => ({
      date: e.date,
      amount: number(e.amount, 'event.amount'),
      label: e.label || 'Cash event',
      qualification: 'none',
    })),
    flows: list(root.recurringFlows?.flow)
      .filter((f) => f.enabled !== 'false')
      .map((f, i) => {
        if (
          !['none', 'directDeposit', 'qualifyingDeposit', undefined].includes(f.qualificationType)
        )
          throw new Error(`Unknown XML qualificationType: ${f.qualificationType}`);
        let start = f.startDate;
        if (f.cadence === 'weekly' && f.dayOfWeek !== undefined) {
          const d = new Date(start + 'T00:00:00Z'),
            target = number(f.dayOfWeek, 'dayOfWeek');
          if (target < 0 || target > 6) throw new Error('Invalid XML dayOfWeek');
          d.setUTCDate(d.getUTCDate() + ((target - d.getUTCDay() + 7) % 7));
          start = d.toISOString().slice(0, 10);
        }
        return {
          id: f.id || `flow-${i}`,
          label: f.label || 'Imported flow',
          amount: number(f.amount, 'flow.amount'),
          direction: f.direction,
          cadence: f.cadence,
          interval: number(f.interval, 'flow.interval', 1),
          dayOfMonth: number(f.dayOfMonth, 'flow.dayOfMonth', 1),
          startDate: start,
          endDate: f.endDate,
          qualification:
            f.qualificationType === 'directDeposit'
              ? 'payroll'
              : f.qualificationType === 'qualifyingDeposit'
                ? 'external-deposit'
                : 'none',
        };
      }),
    notes: [
      'Imported from v1 XML. Set baseline APY, tax rate, bank selection and transfer assumptions. Legacy customer/referral flags were not accepted as confirmed promotion eligibility.',
    ],
  });
}
function legacyCatalog(root: any): Catalog {
  if (root.schemaVersion !== '2.1' || !String(root.toolVersion).startsWith('1.'))
    throw new Error('Unsupported legacy bank XML version.');
  return CatalogSchema.parse({
    schemaVersion: '3.2',
    id: 'legacy-xml-snapshot',
    checkedOn: root.dataAsOf,
    currency: root.currency,
    policy:
      'Imported legacy snapshot; dates and verification claims originate in the file, not a fresh online check.',
    banks: list(root.account).map((b) => ({
      id: b.id,
      name: b.name,
      institution: b.name,
      checkedOn: b.dataAsOf || root.dataAsOf,
      rateAsOf: null,
      verification: b.verified === 'true' ? 'verified' : 'review',
      sourceUrl: b.officialSourceUrl,
      evidence: 'Imported v1 XML claim. Recheck the linked provider before making a decision.',
      model: b.calculatorModel === 'genericV1' && b.baseRate ? 'flat' : 'unsupported',
      apy: b.baseRate ? number(b.baseRate.apy, 'baseRate.apy') : null,
      openingMinimum: number(b.openingMinimum, 'openingMinimum', 0),
      monthlyFee: number(b.monthlyFee, 'monthlyFee', 0),
      limitations: [
        String(b.notes || 'Legacy data.'),
        'Only generic flat-rate legacy accounts are ranked. Legacy promotions and complex rules require migration. Monthly fee defaults to zero if absent from the original file.',
      ],
    })),
  });
}
export function parseFile(text: string): unknown {
  if (text.length > 12_000_000) throw new Error('File exceeds the 12 MB limit.');
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed.startsWith('<')) {
    const doc = xml(trimmed);
    const modern = () =>
      new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: false,
        parseTagValue: false,
        processEntities: true,
      }).parse(trimmed);
    if (doc.hysaScenario)
      return String(doc.hysaScenario.toolVersion).startsWith('1.')
        ? legacyScenario(doc.hysaScenario)
        : modernXml(modern().hysaScenario, 'scenario');
    if (doc.hysaRules)
      return String(doc.hysaRules.toolVersion).startsWith('1.')
        ? legacyCatalog(doc.hysaRules)
        : modernXml(modern().hysaRules, 'banks');
    throw new Error('Expected hysaScenario or hysaRules XML root.');
  }
  return parseYaml(trimmed, { uniqueKeys: true, maxAliasCount: 0 });
}
function migrateV2(raw: any, kind: 'scenario' | 'banks') {
  if (raw?.schemaVersion === '3.2' && raw.toolVersion === '3.2.0')
    return { ...raw, toolVersion: VERSION }; // Patch compatibility; no input or source-date changes.
  if (['3.0', '3.1'].includes(raw?.schemaVersion)) {
    if (raw.toolVersion && !String(raw.toolVersion).startsWith(`${raw.schemaVersion}.`))
      throw new Error(`Incompatible tool version for schema ${raw.schemaVersion}`);
    const value = { ...raw, schemaVersion: '3.2', toolVersion: VERSION };
    const note = `Explicit ${raw.schemaVersion}-to-3.2 import: feature checklist and individual customer reviews supported; existing research dates and calculation rules retained. No new online verification.`;
    if (kind === 'scenario') value.notes = [...(raw.notes ?? []), note];
    else value.policy = [raw.policy, note].filter(Boolean).join(' ');
    return value;
  }
  if (raw?.schemaVersion !== '2.0') return raw;
  const value = { ...raw, schemaVersion: '3.2', toolVersion: VERSION };
  if (kind === 'scenario') {
    value.dataAsOf = raw.createdAt;
    value.notes = [
      ...(raw.notes ?? []),
      'Explicit v2-to-v3 migration: single-owner FDIC assumptions; no linked-account activity inferred.',
    ];
  } else {
    value.policy =
      'Explicit v2 import: legacy calculation rules retained. Atomic provenance and operational facts were not collected by that schema; re-research before use.';
  }
  return value;
}
export const readScenario = (text: string) =>
  ScenarioSchema.parse(migrateV2(parseFile(text), 'scenario'));
export const readCatalog = (text: string) =>
  CatalogSchema.parse(migrateV2(parseFile(text), 'banks'));

const escapeXml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
const arrayItem: Record<string, string> = {
  banks: 'account',
  flows: 'flow',
  events: 'event',
  sources: 'source',
  discoveries: 'discovery',
  rateHistory: 'point',
  reviews: 'review',
  conflicts: 'conflict',
  promotions: 'promotion',
  bonuses: 'bonus',
};
function encode(name: string, v: any, depth = 1, extra = ''): string {
  const pad = '  '.repeat(depth);
  if (v === null) return `${pad}<${name} type="null"${extra}/>\n`;
  if (typeof v !== 'object')
    return `${pad}<${name} type="${typeof v}"${extra}>${escapeXml(String(v))}</${name}>\n`;
  const type = Array.isArray(v) ? 'array' : 'object';
  if (name === 'account')
    extra += ` id="${escapeXml(v.id)}" name="${escapeXml(v.name)}" legalInstitutionName="${escapeXml(String(v.profile?.facts.legalInstitutionName?.value ?? 'Unknown'))}" calculatorModel="${v.model}" verified="${v.verification === 'verified'}" dataAsOf="${v.checkedOn}" researchedAt="${v.profile?.researchedAt ?? v.checkedOn}"`;
  const body = Array.isArray(v)
    ? v.map((x) => encode(arrayItem[name] ?? 'item', x, depth + 1)).join('')
    : Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) =>
          name === 'facts'
            ? encode('fact', x, depth + 1, ` key="${escapeXml(k)}"`)
            : encode(k, x, depth + 1),
        )
        .join('');
  return `${pad}<${name} type="${type}"${extra}>\n${body}${pad}</${name}>\n`;
}
function decode(node: any, name: string, depth = 0): any {
  if (depth > 40) throw new Error('XML nesting limit exceeded.');
  if (!node || typeof node !== 'object')
    throw new Error(`XML ${name} needs an explicit type attribute.`);
  const type = node['@_type'],
    text = node['#text'] ?? '';
  if (
    ['null', 'string', 'number', 'boolean'].includes(type) &&
    Object.keys(node).some((k) => !['@_type', '#text'].includes(k))
  )
    throw new Error(`Unexpected XML primitive content in ${name}`);
  if (type === 'null' && text !== '') throw new Error(`XML null ${name} cannot contain a value`);
  if (type === 'null') return null;
  if (type === 'string') return String(text);
  if (type === 'number') return number(text, name);
  if (type === 'boolean') {
    if (!['true', 'false'].includes(text)) throw new Error(`Invalid XML boolean ${name}`);
    return text === 'true';
  }
  if (type === 'array') {
    const item = arrayItem[name] ?? 'item';
    if (Object.keys(node).some((k) => !['@_type', item].includes(k)))
      throw new Error(`Unexpected XML array member in ${name}`);
    return list(node[item]).map((n) => decode(n, item, depth + 1));
  }
  if (type !== 'object') throw new Error(`Invalid XML type for ${name}`);
  if (name === 'facts') {
    if (Object.keys(node).some((k) => !['@_type', 'fact'].includes(k)))
      throw new Error('Unexpected XML facts member');
    const pairs = list(node.fact).map((n) => {
      if (
        !n['@_key'] ||
        typeof n['@_key'] !== 'string' ||
        ['__proto__', 'constructor', 'prototype'].includes(n['@_key'])
      )
        throw new Error('XML fact needs a safe key.');
      return [n['@_key'], decode(n, 'fact', depth + 1)];
    });
    if (new Set(pairs.map((p) => p[0])).size !== pairs.length)
      throw new Error('Duplicate XML fact keys.');
    return Object.fromEntries(pairs);
  }
  const metadata = [
    '#text',
    '@_type',
    ...(name === 'fact' ? ['@_key'] : []),
    ...(name === 'account'
      ? [
          '@_id',
          '@_name',
          '@_legalInstitutionName',
          '@_calculatorModel',
          '@_verified',
          '@_dataAsOf',
          '@_researchedAt',
        ]
      : []),
  ];
  const result: any = {};
  for (const [key, v] of Object.entries(node)) {
    if (metadata.includes(key) && typeof v !== 'object') continue;
    if (['__proto__', 'constructor', 'prototype'].includes(key) || Array.isArray(v))
      throw new Error(`Invalid or duplicate XML field ${key}`);
    result[key] = decode(v, key, depth + 1);
  }
  if (
    name === 'account' &&
    (node['@_id'] !== result.id ||
      node['@_name'] !== result.name ||
      node['@_calculatorModel'] !== result.model ||
      node['@_dataAsOf'] !== result.checkedOn ||
      node['@_verified'] !== String(result.verification === 'verified') ||
      node['@_researchedAt'] !== (result.profile?.researchedAt ?? result.checkedOn) ||
      node['@_legalInstitutionName'] !==
        String(result.profile?.facts.legalInstitutionName?.value ?? 'Unknown'))
  )
    throw new Error(
      'XML account metadata does not match its sourced profile / calculation fields.',
    );
  return result;
}
function modernXml(root: any, kind: 'scenario' | 'banks') {
  if (
    !String(root['@_toolVersion']).startsWith('3.') ||
    !['3.0', '3.1', '3.2'].includes(root['@_schemaVersion'])
  )
    throw new Error(
      `Incompatible XML: tool ${root['@_toolVersion']}, schema ${root['@_schemaVersion']}. Butter ${VERSION} accepts tool major 3 and schemas 3.0/3.1/3.2. Explicit legacy v1 migrations are separate.`,
    );
  const payload = root[kind === 'scenario' ? 'scenario' : 'catalog'];
  if (
    Object.keys(root).some(
      (k) =>
        ![
          '@_toolVersion',
          '@_schemaVersion',
          '@_dataAsOf',
          kind === 'scenario' ? 'scenario' : 'catalog',
        ].includes(k),
    )
  )
    throw new Error('Unexpected XML envelope field.');
  const parsed = decode(payload, kind === 'scenario' ? 'scenario' : 'catalog');
  if (
    parsed.schemaVersion !== root['@_schemaVersion'] ||
    parsed.toolVersion !== root['@_toolVersion'] ||
    (parsed.dataAsOf ?? parsed.checkedOn ?? parsed.createdAt) !== root['@_dataAsOf']
  )
    throw new Error('XML envelope version/date does not match its payload.');
  return parsed;
}
export function toXml(input: Scenario | Catalog) {
  const isCatalog = 'banks' in input;
  const value = isCatalog ? CatalogSchema.parse(input) : ScenarioSchema.parse(input);
  const root = isCatalog ? 'hysaRules' : 'hysaScenario';
  const dataAsOf = 'checkedOn' in value ? value.checkedOn : (value.dataAsOf ?? value.createdAt);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root} toolVersion="${VERSION}" schemaVersion="3.2" dataAsOf="${dataAsOf}">\n${encode(isCatalog ? 'catalog' : 'scenario', value)}</${root}>\n`;
}
export const toYaml = (value: unknown) => stringifyYaml(value, { lineWidth: 100 });
export function readableError(error: unknown) {
  if (error && typeof error === 'object' && 'issues' in error)
    return (error as any).issues
      .map((i: any) => `${i.path.join('.') || 'File'}: ${i.message}`)
      .join('\n');
  return error instanceof Error ? error.message : String(error);
}
