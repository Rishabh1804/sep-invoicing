import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P87: material in the plant, two ways. The book is what the challans hold open (the same figure as Home's unbilled);
// the floor splits each open line into waiting, pickled and plated from what the floor recorded, oldest challan
// first. A line billed before a plating never absorbs it. The waiting figure is withheld while the record has gaps,
// and rework is work, never billing.

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
const day = (k: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const line = (id: string, part: string, qty: number, amount: number, o: any = {}) => ({ id, partNumber: part, desc: part, hsn: '998873', unit: 'NOS', qty, rate: amount / qty, amount, nosQty: qty, invoiced: false, invoiceId: null, ...o });
const challan = (id: string, no: string, date: string, items: any[]) => ({ id, challanNo: no, challanDate: date, clientId: 11, clientName: CLIENTS[0].name, items, receivedDate: date, createdAt: 1 });
let seq = 0;
const P = (kind: string, date: string, part: string, qty: number, o: any = {}) =>
  ({ id: 'E' + (++seq), kind, date, time: '10:00', clientId: 11, part, gauge: '40X6', qty, unit: 'NOS', basis: kind === 'pickled' ? 'pickling' : 'register', src: 'paste', at: 1,
    ...(kind === 'plated' ? { line: 'vat-a1', lineSrc: 'written', slot: 'general' } : {}), ...o });

function state(fill: boolean) {
  seq = 0;
  const s: any = { ...emptyState(), clients: CLIENTS };
  s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: day(-8), status: 'active', invoiceState: 'dispatched', clientId: 11, clientName: CLIENTS[0].name,
    items: [{ partNumber: 'CLAMP 165X83 (40X6)', desc: '', unit: 'NOS', qty: 600, rate: 1, amount: 600, imItemId: 'L1' }], taxableValue: 600, cgstAmt: 54, sgstAmt: 54, igstAmt: 0, grandTotal: 708, gstType: 'intra', createdAt: 1 }];
  s.incomingMaterial = [
    challan('C1', '301', day(-10), [line('L1', 'CLAMP 165X83 (40X6)', 600, 600, { invoiced: true, invoiceId: 'INV-1', invoiceIds: ['INV-1'] })]),
    challan('C2', '302', day(-3), [line('L2', 'CLAMP 165X83 (40X6)', 1000, 1000)]),
    challan('C3', '303', day(-1), [line('L3', 'CLAMP 133X83 (40X6)', 500, 400.5)]),
  ];
  const e = [
    P('plated', day(-9), 'CLAMP 165X83', 600),               // challan 301's, before its invoice
    P('plated', day(-2), 'CLAMP165×83', 700),                // after 301 was billed: 302's
    P('pickled', day(-2), 'CLAMP 165X83', 900),
    P('pickled', day(-1), 'CLAMP 133X83', 300),
    P('plated', day(-1), 'CLAMP 165X83', 999, { rework: true }),   // rework: work, never billing
    P('plated', day(-1), 'BRKT 9', 50, { clientId: 12, line: 'barrel' }),  // nothing open for it
  ];
  // A full record on every line for 31 days, as rework so it moves no challan.
  if (fill) for (let k = -30; k <= 0; k++) for (const l of ['vat-a1', 'vat-a2', 'barrel']) e.push(P('plated', day(k), 'FILL', 1, { clientId: 12, line: l, rework: true }));
  s.production = { entries: e, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  return s as SepState;
}
const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

test.describe('P87: material in the plant', () => {
  test('the book is Home\'s unbilled; the floor splits each open line; a billed line takes no later plating', async ({ page }) => {
    await loadAppWithState(page, state(false));
    const r = await g(page, `(function(){ var p = prodInPlant(); var home = 0;
      S.incomingMaterial.forEach(function(m){ m.items.forEach(function(it){ if (!it.invoiced) home += imLineOpen(it).amount; }); });
      return { book: p.book, home: gstRound(home), floorOk: p.floorOk,
        rows: p.rows.map(function(x){ return [x.r.it.id, x.open, x.platedNotInvoiced, x.pickledNotPlated, x.waiting]; }),
        noChallan: p.noChallan.map(function(x){ return [x.clientId, x.part, x.qty, x.field]; }) }; })()`);
    expect(r.book).toBe(1400.5);
    expect(r.book).toBe(r.home);
    expect(r.rows).toEqual([['L2', 1000, 700, 200, 100], ['L3', 500, 0, 300, 200]]);
    expect(r.noChallan).toEqual([[12, 'BRKT 9', 50, 'L']]);
    expect(r.floorOk).toBe(false);

    await switchTab(page, 'pageProduction');
    await page.locator('[data-action="invProdTab"][data-tab="plant"]').click();
    await expect(page.locator('[data-prod-tile="plantPni"] .inv-tile-value')).toHaveText('700 NOS');
    await expect(page.locator('[data-prod-tile="plantPnp"] .inv-tile-value')).toHaveText('500 NOS');
    // With gaps in the record, plating on an unrecorded day would read as waiting: withheld, and said why.
    await expect(page.locator('[data-prod-tile="plantWait"] .inv-tile-value')).toHaveText('—');
    await expect(page.locator('[data-prod-cover]')).toBeVisible();
    await expect(page.locator('[data-prod-plant="L2"] .inv-dot')).toHaveText('Plated, not invoiced');
    await expect(page.locator('[data-prod-plant="L3"] .inv-dot')).toHaveText('Pickled');
    await expect(page.locator('#prodNoChallan')).toContainText('BRKT 9');
    // Nothing the floor works out is written to the challans.
    const im = await g(page, `JSON.stringify(S.incomingMaterial)`);
    expect(im).not.toMatch(/plated|pickled/i);
  });

  test('with the record complete, what waits is shown', async ({ page }) => {
    await loadAppWithState(page, state(true));
    await switchTab(page, 'pageProduction');
    await page.locator('[data-action="invProdTab"][data-tab="plant"]').click();
    await expect(page.locator('[data-prod-cover]')).toHaveCount(0);
    await expect(page.locator('[data-prod-tile="plantWait"] .inv-tile-value')).toHaveText('300 NOS');
    // One client at a time.
    await page.locator('#prodPlantClient').selectOption('11');
    await expect(page.locator('#prodNoChallan')).toHaveCount(0);
    await expect(page.locator('[data-prod-tile="plantPni"] .inv-tile-value')).toHaveText('700 NOS');
  });
});
