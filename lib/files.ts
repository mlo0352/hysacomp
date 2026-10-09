import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { CatalogSchema, ScenarioSchema, type Catalog, type Scenario } from './schema';

const list = (value: any): any[] => value == null ? [] : Array.isArray(value) ? value : [value];
function number(value: unknown, field: string, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === undefined || value === '' || !Number.isFinite(Number(value))) throw new Error(`Invalid or missing XML ${field}`);
  return Number(value);
}
function xml(text: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML document types and entities are not supported.');
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw new Error(`Invalid XML: ${valid.err.msg}`);
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false, processEntities: false }).parse(text);
}
function legacyScenario(root: any): Scenario {
  if (root.schemaVersion !== '1.0' || !String(root.toolVersion).startsWith('1.')) throw new Error('Unsupported legacy scenario version. Use schema 2.0 YAML or JSON.');
  if (list(root.monthlyMetrics?.month).length) throw new Error('Legacy monthly metrics cannot be safely dated. Convert them to explicit cash events before importing.');
  const sim = root.simulation;
  if (!sim) throw new Error('Missing XML simulation');
  return ScenarioSchema.parse({
    schemaVersion: '2.0', id: root.id || 'imported-scenario', name: root.name || 'Imported scenario',
    createdAt: root.createdAt, startDate: sim.startDate, endDate: sim.endDate,
    startingCash: number(sim.startingCash, 'startingCash'), taxRate: 0,
    baseline: { name: 'Unconfigured baseline — edit this APY', apy: 0, monthlyFee: 0 },
    bankIds: ['everbank', 'openbank', 'marcus', 'ally', 'brio'], eligiblePromotionIds: [],
    transfer: { businessDays: 0, fee: 0, holdDays: 0 }, eStatements: true,
    events: list(root.cashEvents?.cashEvent).map(e => ({ date: e.date, amount: number(e.amount, 'event.amount'), label: e.label || 'Cash event', qualification: 'none' })),
    flows: list(root.recurringFlows?.flow).filter(f => f.enabled !== 'false').map((f, i) => {
      if (!['none', 'directDeposit', 'qualifyingDeposit', undefined].includes(f.qualificationType)) throw new Error(`Unknown XML qualificationType: ${f.qualificationType}`);
      let start = f.startDate;
      if (f.cadence === 'weekly' && f.dayOfWeek !== undefined) {
        const d = new Date(start + 'T00:00:00Z'), target = number(f.dayOfWeek, 'dayOfWeek');
        if (target < 0 || target > 6) throw new Error('Invalid XML dayOfWeek');
        d.setUTCDate(d.getUTCDate() + (target - d.getUTCDay() + 7) % 7); start = d.toISOString().slice(0, 10);
      }
      return { id: f.id || `flow-${i}`, label: f.label || 'Imported flow', amount: number(f.amount, 'flow.amount'), direction: f.direction,
        cadence: f.cadence, interval: number(f.interval, 'flow.interval', 1), dayOfMonth: number(f.dayOfMonth, 'flow.dayOfMonth', 1),
        startDate: start, endDate: f.endDate, qualification: f.qualificationType === 'directDeposit' ? 'payroll' : f.qualificationType === 'qualifyingDeposit' ? 'external-deposit' : 'none' };
    }),
    notes: ['Imported from v1 XML. Set baseline APY, tax rate, bank selection and transfer assumptions. Legacy customer/referral flags were not accepted as confirmed promotion eligibility.'],
  });
}
function legacyCatalog(root: any): Catalog {
  if (root.schemaVersion !== '2.1' || !String(root.toolVersion).startsWith('1.')) throw new Error('Unsupported legacy bank XML version.');
  return CatalogSchema.parse({
    schemaVersion: '2.0', id: 'legacy-xml-snapshot', checkedOn: root.dataAsOf, currency: root.currency,
    policy: 'Imported legacy snapshot; dates and verification claims originate in the file, not a fresh online check.',
    banks: list(root.account).map(b => ({
      id: b.id, name: b.name, institution: b.name, checkedOn: b.dataAsOf || root.dataAsOf, rateAsOf: null,
      verification: b.verified === 'true' ? 'verified' : 'review', sourceUrl: b.officialSourceUrl,
      evidence: 'Imported v1 XML claim. Recheck the linked provider before making a decision.',
      model: b.calculatorModel === 'genericV1' && b.baseRate ? 'flat' : 'unsupported',
      apy: b.baseRate ? number(b.baseRate.apy, 'baseRate.apy') : null,
      openingMinimum: number(b.openingMinimum, 'openingMinimum', 0), monthlyFee: number(b.monthlyFee, 'monthlyFee', 0),
      limitations: [String(b.notes || 'Legacy data.'), 'Only generic flat-rate legacy accounts are ranked. Legacy promotions and complex rules require migration. Monthly fee defaults to zero if absent from the original file.'],
    })),
  });
}
export function parseFile(text: string): unknown {
  if (text.length > 2_000_000) throw new Error('File exceeds the 2 MB limit.');
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed.startsWith('<')) {
    const doc = xml(trimmed);
    if (doc.hysaScenario) return legacyScenario(doc.hysaScenario);
    if (doc.hysaRules) return legacyCatalog(doc.hysaRules);
    throw new Error('Expected hysaScenario or hysaRules XML root.');
  }
  return parseYaml(trimmed, { uniqueKeys: true, maxAliasCount: 0 });
}
export const readScenario = (text: string) => ScenarioSchema.parse(parseFile(text));
export const readCatalog = (text: string) => CatalogSchema.parse(parseFile(text));
export const toYaml = (value: unknown) => stringifyYaml(value, { lineWidth: 100 });
export function readableError(error: unknown) {
  if (error && typeof error === 'object' && 'issues' in error) return (error as any).issues.map((i: any) => `${i.path.join('.') || 'File'}: ${i.message}`).join('\n');
  return error instanceof Error ? error.message : String(error);
}
