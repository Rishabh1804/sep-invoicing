import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P88: Production linked into the rest of the app. Two To-do rules (plated and not invoiced; pickled with no open
// challan) that read only what was captured here, never the imported history or rework; the Overview's tiles; the
// Stats row, on complete days only; labour ₹/kg by line over the same days as the kilograms.

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const iso = (k: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/* The day n working days (Sundays out) before today, the way the rules count. */
function wdBack(n: number) {
  for (let j = 1; j < 30; j++) {
    let c = 0;
    for (let k = -j + 1; k <= 0; k++) if (new Date(iso(k) + 'T00:00:00').getDay() !== 0) c++;
    if (c === n) return iso(-j);
  }
  throw new Error('no day');
}
const challan = (id: string, date: string, part: string, qty: number) => ({ id, challanNo: id, challanDate: date, clientId: 11, clientName: CLIENTS[0].name, receivedDate: date, createdAt: 1,
  items: [{ id: id + '-0', partNumber: part, desc: part, hsn: '998873', unit: 'NOS', qty, rate: 1, amount: qty, nosQty: qty, invoiced: false, invoiceId: null }] });
let seq = 0;
const E = (kind: string, date: string, part: string, qty: number, o: any = {}) => ({ id: 'E' + (++seq), kind, date, time: '10:00', clientId: 11, part, gauge: '40X6', qty, unit: 'NOS', at: 1,
  src: 'paste', basis: kind === 'plated' ? 'register' : 'pickling', ...(kind === 'plated' ? { line: 'vat-a1', lineSrc: 'written', slot: 'general' } : {}), ...o });

async function load(page: Page, entries: any[], extra: any = {}) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: [challan('C1', iso(-20), 'CLAMP 165X83 (40X6)', 1000)], ...extra,
    production: { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } } as SepState);
}
const tasks = (page: Page, rule: string) => g(page, `todoApp(['${rule}']).map(function(t){ return [t.key, t.tone, t.title]; })`);

test.describe('P88: Production in the rest of the app', () => {
  test('plated and not invoiced: nothing at 2 working days, amber at 3, red at 6; never from imports or rework', async ({ page }) => {
    seq = 0;
    await load(page, [E('plated', wdBack(2), 'CLAMP 165X83', 400)]);
    expect(await tasks(page, 'prodPlatedUnbilled')).toEqual([]);
    seq = 0;
    await load(page, [E('plated', wdBack(3), 'CLAMP 165X83', 400)]);
    expect(await tasks(page, 'prodPlatedUnbilled')).toEqual([['prodPlatedUnbilled:11', 'amber', 'NOVA CLAMPS PVT. LTD.: 400 NOS plated, not invoiced']]);
    seq = 0;
    await load(page, [E('plated', wdBack(6), 'CLAMP 165X83', 400)]);
    expect((await tasks(page, 'prodPlatedUnbilled'))[0][1]).toBe('red');
    seq = 0;
    await load(page, [E('plated', wdBack(6), 'CLAMP 165X83', 400, { src: 'import' }), E('plated', wdBack(6), 'CLAMP 165X83', 300, { rework: true, line: 'vat-a2' })]);
    expect(await tasks(page, 'prodPlatedUnbilled')).toEqual([]);
  });

  test('pickled with no open challan: amber after a day, red at 3; a client not in the book is its own task', async ({ page }) => {
    seq = 0;
    await load(page, [E('pickled', wdBack(1), 'CLAMP 90X81', 200), E('pickled', wdBack(1), 'CLAMP 165X83', 200)]);
    expect(await tasks(page, 'prodPickledNoChallan')).toEqual([['prodPickledNoChallan:11', 'amber', 'NOVA CLAMPS PVT. LTD.: 1 load pickled with no open challan']]);
    seq = 0;
    await load(page, [E('pickled', wdBack(3), 'CLAMP 90X81', 200), E('pickled', wdBack(1), 'Buckle hook', 50, { clientId: null, client: 'SIYA ENTERPRISES' })]);
    const t = await tasks(page, 'prodPickledNoChallan');
    expect(t.map((x: any) => [x[0], x[1]])).toEqual([['prodPickledNoChallan:11', 'red'], ['prodPickledNoChallan:outside', 'amber']]);
    expect(t[1][2]).toBe('1 load pickled for a client not in the book');
  });

  test('a raised task opens Production on its question', async ({ page }) => {
    seq = 0;
    await load(page, [E('plated', wdBack(4), 'CLAMP 165X83', 400)]);
    await switchTab(page, 'pageProduction');
    // Two questions: the run is not invoiced, and a piece client's part with no rate card and one challan has no weight
    // anywhere (P190's follow-up list).
    await expect(page.locator('#prodRaised .inv-panel-count')).toHaveText('2');
    await expect(page.locator('#prodRaised [data-action="invProdTask"][data-key="prodUnweighed:11"]')).toContainText('400 pieces plated with no weight');
    await page.locator('#prodRaised [data-action="invProdTask"][data-key="prodPlatedUnbilled:11"]').click();
    await expect(page.locator('[data-action="invProdTab"][data-tab="plant"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#prodPlantClient')).toHaveValue('11');
    // It reaches the To-do list like every other rule.
    // The tasks are Needs you's (the tab map, TM2a).
    await switchTab(page, 'pageHome');
    await expect(page.locator('#homeNeeds')).toContainText('400 NOS plated, not invoiced');
  });

  test('the Overview, the Stats row on complete days, and labour per kg by line', async ({ page }) => {
    seq = 0;
    const days: string[] = [];
    for (let n = 1; days.length < 6; n++) days.push(wdBack(n));
    const att: any = {};
    days.forEach(d => { att[d] = { marks: { 1: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' } }, extra: [], note: '' }; });
    const staff = [{ id: 1, name: 'Arun', comp: 'hourly', area: 'vat-a1', hourRate: 50, dayRate: 0, active: true, onFloor: true }];
    await load(page, days.map(d => E('plated', d, 'BRKT', 100, { unit: 'KG', clientId: 12, part: 'BRKT' })), { staff, attendance: att, incomingMaterial: noSeedIM() });
    const r = await g(page, `(function(){ var from = '${days[days.length - 1]}', to = '${days[0]}';
      var s = prodPlatedSummary(from, to), lab = prodLabourByLine(from, to);
      return { days: s && s.days, kg: s && s.kg, row: prodStatsRowHtml(from, to).indexOf('600 kg') >= 0 || prodStatsRowHtml(from, to).indexOf('0.6 t') >= 0,
        a1: lab.lines['vat-a1'], a2: lab.lines['vat-a2'], none: prodStatsRowHtml('2020-01-01', '2020-01-31') }; })()`);
    expect(r.days).toBe(6);
    expect(r.kg).toBe(600);
    expect(r.row).toBe(true);
    expect(r.none).toBe('');                         // no production in the range: nothing said, never a zero
    expect(r.a1).toMatchObject({ days: 6, kg: 600, cost: 2400, perKg: 4 });
    expect(r.a2).toMatchObject({ days: 0, perKg: null });
    await switchTab(page, 'pageProduction');
    // The last day plated is the day card (one unit: 100 kg written, nothing estimated).
    await expect(page.locator('[data-prod-day] .inv-hero-fig')).toHaveText('100 kg');
    await expect(page.locator('#prodCoverage')).toContainText('VAT A1');
    await page.locator('[data-action="invProdTab"][data-tab="lines"]').click();
    await expect(page.locator('#prodLabour .inv-num')).toHaveText('₹4.00/kg');
    await expect(page.locator('#prodWeek')).toBeVisible();
  });
});
