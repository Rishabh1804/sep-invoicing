import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P122 (owner, 30 Sep 2026): a register page's clamps take their gauge from the round's size (the owner's rule for Mehta),
// a floor name with its code in brackets is matched to the client's part and learnt, a new part under the customer's
// ditto is the same customer's, and every run names the crew who stood on its line that day. Made-up names and parts.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const T = todayIso();
function book(): SepState {
  const s: any = emptyState();
  s.clients = [
    { id: 2, name: 'MEHTA TEST INDUSTRIES', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 5.4, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 1, name: 'DELTA AUTO', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 13, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ];
  const line = (id: string, pn: string, desc: string, qty: number, unit = 'NOS') => ({ id, partNumber: pn, desc, hsn: '998873', unit, qty, rate: 1, amount: qty, nosQty: null });
  s.incomingMaterial = [
    { id: 'IM-1', challanNo: '11', challanDate: T, clientId: 1, clientName: 'DELTA AUTO', vehicleNo: '', receivedDate: T, createdAt: recentTs(),
      items: [line('IM-1-0', '5164 5460 0160', 'BRACKET', 200, 'KG'), line('IM-1-1', '5206 4920 0106', 'BRACKET', 50, 'KG'), line('IM-1-2', '5567 5450 0106', 'BRACKET', 50, 'KG')] },
    { id: 'IM-2', challanNo: '21', challanDate: T, clientId: 2, clientName: 'MEHTA TEST INDUSTRIES', vehicleNo: '', receivedDate: T, createdAt: recentTs(),
      items: [line('IM-2-0', 'CLAMP 149X83', 'CLAMP (30X6)', 3000), line('IM-2-1', 'CLAMP 165X83', 'CLAMP (40X6)', 3000)] },
  ];
  s.staff = [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
    { id: 3, name: 'Charlie', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true }];
  s.attendance = { [T]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8 }, 2: { st: 'P', area: 'vat-a1', hours: 8 }, 3: { st: 'P', area: 'vat-a2', hours: 8 } },
    extra: [{ kind: 'block', area: 'vat-a1', areas: ['vat-a1'], from: '17:00', to: '20:00', crew: [2], hours: 0 }], note: '' } };
  return s as SepState;
}
const dmy = T.slice(8, 10) + '/' + T.slice(5, 7) + '/' + T.slice(2, 4);
const A1 = { page: 'production', date: dmy, line: 'VAT-A1', rows: [
  { time: '10:00 AM', mark: 'START', customer: 'MEHTA', part: 'CLAMP' },
  { time: '10:15 AM', qtyText: '100', ditto: true }, { time: '10:30 AM', qtyText: '100', ditto: true },
  { time: '10:45 AM', qtyText: '108', ditto: true }, { time: '11:00 AM', qtyText: '108', ditto: true },
  { time: '11:40 AM', customer: null, part: 'LINER', qtyText: '90' },
  { time: '1:05 PM', customer: null, part: 'CLAMP', qtyText: '72' }, { time: '1:20 PM', qtyText: '72', ditto: true },
  { time: '5:30 PM', qtyText: '72', ditto: true }] };

test('a Mehta clamp takes its gauges from the round, a round no rule names stays apart, and a new part under a ditto keeps the customer', async ({ page }) => {
  await loadAppWithState(page, book());
  expect(await g(page, `prodData().gaugeRules.length`)).toBe(2);
  const runs = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(A1)}, prodCtx(), null, {}).runs.map(e => [e.client, e.part, (e.gaugeOptions || []).join('/'), e.qty]))`) as string);
  expect(runs).toEqual([
    ['MEHTA', 'CLAMP', '25X6/30X6', 300],   // START counts as a round of the next figure (the owner's rule of 26 Jun)
    ['MEHTA', 'CLAMP', '', 216],
    ['MEHTA', 'LINER', '', 90],
    ['MEHTA', 'CLAMP', '35X6/35X8/40X6', 216]]);
});

test('a code in brackets is the client’s part ending in it, learnt for the name; two parts ending in it are asked', async ({ page }) => {
  await loadAppWithState(page, book());
  const e1: any = { id: 'E1', kind: 'plated', date: T, line: 'vat-a2', clientId: 1, client: 'DELTA', part: 'TINA(0160)', qty: 25, unit: 'NOS', slot: 'general', basis: 'register', src: 'import', time: '10:00' };
  const e2: any = { id: 'E2', kind: 'plated', date: T, line: 'vat-a2', clientId: 1, client: 'DELTA', part: 'KUDAL(0106)', qty: 30, unit: 'NOS', slot: 'general', basis: 'register', src: 'import', time: '11:00' };
  const e3: any = { id: 'E3', kind: 'plated', date: T, line: 'vat-a2', clientId: 1, client: 'DELTA', part: 'TINA', qty: 40, unit: 'NOS', slot: 'general', basis: 'register', src: 'import', time: '12:00' };
  const r = await g(page, `prodMergeImport({ format: 'sep-production', entries: ${JSON.stringify([e1, e2, e3])} }, 'x.json')`) as any;
  expect(r.ok !== false).toBe(true);
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
  // TINA(0160) is the one part ending 0160, and TINA alone reads as it from then on.
  await expect(page.locator('[data-prod-entry="E1"]')).toContainText('= 5164 5460 0160');
  await expect(page.locator('[data-prod-entry="E3"]')).toContainText('= 5164 5460 0160');
  // KUDAL(0106) ends two parts: asked.
  await page.locator('[data-prod-entry="E2"] [data-action="invProdAlias"]').click();
  await expect(page.locator('#prodAliasPick optgroup').first()).toHaveAttribute('label', 'Ending in 0106');
  await page.locator('#prodAliasPick').selectOption('5206 4920 0106');
  await page.locator('[data-action="invProdAliasSave"]').click();
  await expect(page.locator('[data-prod-entry="E2"]')).toContainText('= 5206 4920 0106');
  const learnt = (await readStoredState(page)).production.learn.parts;
  expect(Object.values(learnt).map((x: any) => x.partNumber)).toEqual(expect.arrayContaining(['5164 5460 0160', '5206 4920 0106']));
});

test('every run names its crew from the day’s attendance, the OT block’s after 5, and the part’s trail shows who plated it', async ({ page }) => {
  await loadAppWithState(page, book());
  await g(page, `(function(){ var rd = prodFromRegisterRead(${JSON.stringify(A1)}, prodCtx(), null, {}); var p = prodData();
    rd.runs.forEach(function(e, i) { var r = Object.assign({}, e, { id: 'R' + i, date: rd.date, line: rd.line, src: 'import' }); delete r.rows; delete r.issues; delete r.clientName; p.entries.push(prodSparse(r)); });
    p.entries.push(prodSparse({ id: 'OT1', kind: 'plated', date: '${T}', line: 'vat-a1', slot: 'ot', time: '17:30', to: '17:30', clientId: 2, client: 'MEHTA', part: 'CLAMP', qty: 72, unit: 'NOS', basis: 'register', src: 'import' }));
    prodTouch(); saveState(); })()`);
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
  await expect(page.locator('[data-prod-entry="R0"] [data-prod-crew]')).toHaveText('Crew: Alfa, Bravo');
  await expect(page.locator('[data-prod-entry="OT1"] [data-prod-crew]')).toHaveText('OT crew: Bravo');
  // Clients → Performance → Materials worked: the part's trail carries each plating and its crew.
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
  await page.locator('#cpClientSelect').selectOption('2');
  const card = page.locator('[data-card="worked"]');
  await card.locator('[data-action="invCpPeriod"][data-p="mtd"]').click();
  const plated = page.locator('[data-card="worked"] [data-cp-plated]');
  await expect(plated.first()).toContainText('Crew: Alfa, Bravo');
});
