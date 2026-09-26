import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, recentTs, type SepState, openStatsTab } from './fixtures';

// P46: prices, purchases and the live cost (owner, 25 Sep 2026). A delivery
// carries its bill; a past bill is recorded without moving the stock; each line
// shows its price, cadence and use; and Stats → Live cost shows every component
// with its source. Made-up suppliers and figures (the repo is public).

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function stockState(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.stock = {
    items: [
      { id: 'Q', name: 'Q558', key: 'Q558', unit: 'kg', basis: 'draw', aliases: [] },
      { id: 'Z', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', aliases: [] },
      { id: 'M', name: 'Monicol', key: 'MONICOL', unit: 'kg', basis: 'draw', aliases: [] },
    ],
    entries: [
      { id: 'c1', itemId: 'Q', kind: 'count', qty: 40, date: iso(-40), at: 1, seq: 3 },
      // A delivery that arrived by paste: no bill on it.
      { id: 'r1', itemId: 'Q', kind: 'received', qty: 60, date: iso(-10), at: 2, seq: 1, source: 'paste' },
      { id: 'u1', itemId: 'Q', kind: 'used', qty: 12, days: 4, from: iso(-4), date: iso(-1), at: 3, seq: 2 },
    ],
    pastes: [],
  };
  return s;
}

test.describe('P46: prices, purchases and the live cost', () => {
  test('a pasted delivery gets its bill; a past bill never moves the stock; the line shows its pattern', async ({ page }) => {
    await loadAppWithState(page, stockState());
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invDashStockView"][data-view="list"]').click();
    await page.locator('.inv-stk-row').filter({ hasText: 'Q558' }).click();
    await expect(page.locator('.inv-stk-hero-lv')).toContainText('88');
    await expect(page.locator('.inv-stk-hero')).toContainText('No price yet');

    // Price the delivery from its own entry.
    await page.locator('[data-action="invStockBillOpen"][data-entry="r1"]').click();
    await expect(page.locator('#stockBillQty')).toHaveValue('60');
    await expect(page.locator('#stockBillQty')).toBeDisabled();
    await page.locator('#stockBillSupplier').fill('Alpha Traders');
    await page.locator('#stockBillNo').fill('AT/12');
    await page.locator('#stockBillDate').fill(iso(-12));
    await page.locator('#stockBillAmount').fill('18000');
    await page.locator('[data-action="invStockBillSave"]').click();
    let st = (await readStoredState(page)).stock;
    expect(st.entries.find((e: any) => e.id === 'r1')).toMatchObject({ price: 300, amount: 18000, supplier: 'Alpha Traders', billNo: 'AT/12', billDate: iso(-12) });

    // A past bill, on its own: priced, and the level does not move.
    await page.locator('[data-action="invStockBillOpen"]:not([data-entry])').click();
    await page.locator('#stockBillSupplier').fill('Beta Chem');
    await page.locator('#stockBillNo').fill('B-7');
    await page.locator('#stockBillDate').fill(iso(-42));
    await page.locator('#stockBillQty').fill('50');
    await page.locator('#stockBillPrice').fill('280');
    await page.locator('[data-action="invStockBillSave"]').click();
    await expect(page.locator('.inv-stk-hero-lv')).toContainText('88');
    st = (await readStoredState(page)).stock;
    expect(st.entries.find((e: any) => e.kind === 'bill')).toMatchObject({ qty: 50, price: 280, amount: 14000, supplier: 'Beta Chem', billNo: 'B-7', date: iso(-42) });

    // The pattern: last price and its change, both suppliers, cadence, use and cost.
    const pat = page.locator('.inv-stk-pattern');
    await expect(pat).toContainText('₹300.00/kg');
    await expect(pat).toContainText('+7.1%');
    await expect(pat).toContainText('Alpha Traders');
    await expect(pat).toContainText('Beta Chem');
    await expect(pat).toContainText('every 30 days');
    await expect(pat).toContainText('3 kg/day');
    await expect(pat).toContainText('₹900.00/day');
    expect(await g(page, `stockPriceAt('Q', '${iso(-20)}').price`)).toBe(280);
  });

  test('Received by hand asks for the company, the invoice number and its date', async ({ page }) => {
    await loadAppWithState(page, stockState());
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invDashStockView"][data-view="list"]').click();
    await page.locator('[data-action="invStockManual"]').click();
    await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
    await expect(page.locator('.inv-stk-mhead')).toContainText('per unit, before GST');
    await page.locator('[data-stock-qty="M"]').fill('10');
    await page.locator('[data-action="invStockSaveManual"]').click();
    await expect(page.locator('.inv-toast')).toContainText('Enter the company');
    await page.locator('#stockManSupplier').fill('Gamma Co');
    await page.locator('#stockManBill').fill('G/1');
    await page.locator('#stockManBillDate').fill(iso(-2));
    await page.locator('[data-action="invStockSaveManual"]').click();
    await expect(page.locator('.inv-toast')).toContainText('1 without a price');
    const e = (await readStoredState(page)).stock.entries.find((x: any) => x.itemId === 'M');
    expect(e).toMatchObject({ kind: 'received', qty: 10, supplier: 'Gamma Co', billNo: 'G/1', billDate: iso(-2) });
    expect(e.price).toBeUndefined();
  });

  test('the live cost: each component with its figure and its source', async ({ page }) => {
    const s: any = stockState();
    const t = todayIso(), month = t.slice(0, 7);
    s.stock.entries.push(
      { id: 'b1', itemId: 'Q', kind: 'bill', qty: 50, price: 300, amount: 15000, date: iso(-50), billDate: iso(-50), supplier: 'Alpha', billNo: 'A1', at: 4, seq: 0 },
      { id: 'z1', itemId: 'Z', kind: 'charged', qty: 10, date: t, at: 5, seq: 2 },
      { id: 'm1', itemId: 'M', kind: 'used', qty: 2, days: 1, date: t, at: 6, seq: 2 });
    s.zinc = { ratePerKg: 400, premiumPerKg: 20, upliftPct: 10.5, basis: 'manual', updatedAt: Date.now(), source: '' };
    s.costBills = [{ id: 'CB1', kind: 'power', month, amount: 60000, units: 7000, note: 'test', at: 1 }];
    s.staff = [{ id: 1, name: 'Arun', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true }];
    s.attendance = { [t]: { marks: { 1: { st: 'P', hours: 10, ot: 0, area: 'barrel' } }, extra: [], note: '' } };
    s.invoices = [{
      id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/T-00001', date: t, status: 'active', invoiceState: 'created',
      clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
      items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: 1000, rate: 10, amount: 10000 }],
      taxableValue: 10000, cgstPer: 9, cgstAmt: 900, sgstPer: 9, sgstAmt: 900, igstPer: 0, igstAmt: 0,
      grandTotal: 11800, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs(),
    }];
    await loadAppWithState(page, s);
    const c = await g(page, `(function(){ var c = liveCost('${iso(-3)}', '${t}', 1000);
      var o = {}; c.rows.forEach(function(r){ o[r.key] = [r.amount, r.source, r.measured]; }); return o; })()`) as any;
    // Labour: 10 h × ₹50 is the measured part; the unrecorded working days are
    // filled at the model, never read as zero.
    expect(c.labour[2]).toBe(500);
    expect(c.labour[0]).toBeGreaterThan(500);
    expect(c.labour[1]).toBe('partial');
    // Q558: 12 kg used over the window × ₹300 paid; Monicol used but never priced.
    expect(c.chem.slice(0, 2)).toEqual([3600, 'partial']);
    // Zinc charged with no bill: the market rate stands in, and says so.
    expect(c.zinc.slice(0, 2)).toEqual([4200, 'rate']);
    // Power: this month's bill, by the share of its days in the window.
    expect(c.power[2]).toBeGreaterThan(0);
    expect(c.other.slice(0, 2)).toEqual([420, 'model']);

    await openStatsTab(page, 'cost');
    const card = page.locator('#liveCost');
    await expect(card).toContainText('Live cost');
    await expect(card.locator('.inv-cost-row').filter({ hasText: 'Zinc' }).locator('.inv-cost-src')).toHaveText('market rate');
    await expect(card.locator('.inv-cost-row').filter({ hasText: 'Electricity' }).locator('.inv-cost-src')).toHaveText('measured');

    // A bill for the other costs replaces the model figure.
    await card.locator('[data-action="invCostBillOpen"]').click();
    await page.locator('#costBillKind').selectOption('other');
    await page.locator('#costBillMonth').fill(month);
    await page.locator('#costBillAmount').fill('9000');
    await page.locator('[data-action="invCostBillSave"]').click();
    await expect(page.locator('#liveCost .inv-cost-row').filter({ hasText: 'Consumables' }).locator('.inv-cost-src')).toHaveText('measured');
    expect((await readStoredState(page)).costBills).toHaveLength(2);
  });

  test('purchases and bills carried over from a file merge by id', async ({ page }) => {
    await loadAppWithState(page, stockState());
    const file = { format: 'sep-stock', version: 1, items: [{ id: 'imp-q', name: 'Q558', key: 'Q558', unit: 'kg' }],
      entries: [{ id: 'imp-b1', itemId: 'imp-q', kind: 'bill', qty: 90, price: 294.8, amount: 26532, date: '2026-06-26', billDate: '2026-06-26', supplier: 'Alpha', billNo: 'A/189', source: 'import' }],
      pastes: [], costBills: [{ id: 'imp-p1', kind: 'power', month: '2026-07', amount: 64803, units: null, note: 'bill' }] };
    const first = await g(page, `JSON.stringify(stockMergeImport(${JSON.stringify(file)}))`);
    expect(JSON.parse(first)).toEqual({ items: 0, entries: 1, pastes: 0, bills: 1 });
    const again = await g(page, `JSON.stringify(stockMergeImport(${JSON.stringify(file)}))`);
    expect(JSON.parse(again)).toEqual({ items: 0, entries: 0, pastes: 0, bills: 0 });
    // The bill lands on the existing line and the level is unchanged.
    expect(await g(page, `[stockData().entries.find(function(e){ return e.id === 'imp-b1'; }).itemId, stockReplay('Q').level]`)).toEqual(['Q', 88]);

    // Two bills on one day: a 60 kg drum and a 5 kg bottle bought locally. The drum sets the price.
    await g(page, `stockMergeImport({ format: 'sep-stock', items: [{ id: 'imp-q', name: 'Q558' }], pastes: [], entries: [
      { id: 'imp-small', itemId: 'imp-q', kind: 'bill', qty: 5, price: 350, date: '2026-08-12', billDate: '2026-08-12', supplier: 'Local', billNo: 'L1', at: 0 },
      { id: 'imp-big', itemId: 'imp-q', kind: 'bill', qty: 60, price: 294.8, date: '2026-08-12', billDate: '2026-08-12', supplier: 'Alpha', billNo: 'A/299', at: 0 }] })`);
    expect(await g(page, `stockPriceAt('Q', '2026-08-31').price`)).toBe(294.8);
  });
});
