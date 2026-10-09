import type { Comparison } from './engine';

export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
export const escapeXml = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
export function toCsv(c: Comparison) {
  const fields = ['rank', 'bankId', 'name', 'status', 'interest', 'bonuses', 'fees', 'estimatedTax', 'netReturn', 'incrementalGain', 'endingBalance', 'minimumLiquid', 'checkedOn', 'sourceUrl', 'exclusionReason', 'warnings'] as const;
  const quote = (v: unknown) => {
    let text = Array.isArray(v) ? v.join(' | ') : String(v ?? '');
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [fields.join(','), ...[c.baseline, ...c.ranked, ...c.excluded].map(r => fields.map(f => quote(r[f])).join(','))].join('\r\n') + '\r\n';
}
export function toSvg(c: Comparison) {
  const rows = [...c.ranked, c.baseline], width = 1100, height = 190 + rows.length * 54;
  const min = Math.min(0, ...rows.map(r => r.netReturn)), max = Math.max(1, ...rows.map(r => r.netReturn));
  const x = (v: number) => 330 + (v - min) / (max - min) * 530;
  const bar = rows.map((r, i) => {
    const y = 142 + i * 54, winner = c.winnerIds.includes(r.bankId), base = r.bankId === 'baseline';
    return `<text x="32" y="${y + 20}" font-size="15" font-weight="${winner ? 700 : 400}">${escapeXml(r.name.slice(0, 36))}${winner ? ' ★' : ''}</text><rect x="${Math.min(x(0), x(r.netReturn))}" y="${y}" width="${Math.max(1, Math.abs(x(r.netReturn) - x(0)))}" height="30" rx="5" fill="${winner ? '#326345' : base ? '#9ca794' : '#c7dca0'}"/><text x="1065" y="${y + 20}" text-anchor="end" font-size="16" font-weight="700">${money(r.netReturn)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">Butter — after-tax return comparison</title><desc id="description">${escapeXml(c.scenario.name)}. Bank data checked ${c.bankDataCheckedOn}. After interest, bonuses, fees and estimated tax. Excludes ${c.excluded.length} unresolved or infeasible accounts.</desc><rect width="100%" height="100%" rx="20" fill="#f7f8f2"/><g font-family="Arial, sans-serif" fill="#263725"><text x="32" y="45" font-size="27" font-weight="700">butter / Make your cash work.</text><text x="32" y="78" font-size="17">${escapeXml(c.scenario.name)} · ${c.scenario.startDate} to ${c.scenario.endDate}</text><text x="32" y="105" font-size="13">After-tax return · bank data checked ${c.bankDataCheckedOn} · ${c.excluded.length} excluded · variable rates held constant</text><line x1="${x(0)}" x2="${x(0)}" y1="132" y2="${height - 40}" stroke="#bdc8b5"/>${bar}<text x="32" y="${height - 15}" font-size="12">Reproduce with Butter v${c.toolVersion} · github.com/mlo0352/hysacomp · rates are forecasts, not guarantees</text></g></svg>`;
}
