import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openStatsTab, readStoredState, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P48: insights (as To-do rules), predictions, the invoice prefill, and the
// stock reorder list. Made-up clients and figures (the repo is public).

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthStart(back: number): string {
  const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00');
  d.setMonth(d.getMonth() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`;
}
let seq = 0;
function inv(clientId: number, name: string, date: string, qty: number, rate: number, extra: any = {}) {
  seq++;
  return { id: 'I' + seq, invoiceNumber: String(seq).padStart(5, '0'), displayNumber: 'SEP/T-' + seq, date, status: 'active', invoiceState: 'created',
    clientId, clientName: name, gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty, rate, amount: qty * rate }],
    taxableValue: qty * rate, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0,
    grandTotal: qty * rate, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs(), ...extra };
}
function challan(id: string, clientId: number, date: string) {
  return { id, clientId, clientName: '', challanNo: id, challanDate: date, items: [{ partNumber: 'P', qty: 10, unit: 'KG', amount: 0, invoiced: true }], createdAt: 1 };
}
function state(): SepState {
  const s: any = emptyState();
  s.clients = [...s.clients,
    { id: 81, name: 'QUIET WORKS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
    { id: 82, name: 'FALLING PARTS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
    { id: 83, name: 'SEQ AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  s.invoices = [
    // Falling three months running: 60k → 45k → 30k.
    inv(82, 'FALLING PARTS', monthStart(3), 4000, 15), inv(82, 'FALLING PARTS', monthStart(2), 3000, 15), inv(82, 'FALLING PARTS', monthStart(1), 2000, 15),
    // Quiet Works: ₹60k in the last three months, then nothing.
    inv(81, 'QUIET WORKS', monthStart(2), 3000, 20),
    // Seq Auto: POs in sequence, one vehicle every time.
    ...[1, 2, 3, 4, 5].map(n => inv(83, 'SEQ AUTO', iso(-20 + n), 100, 12, { poNumber: 'SA/00' + (40 + n), transport: 'JH 05AB 1234' })),
  ];
  s.invNextNum = seq + 1;
  // Quiet Works sent a challan every 2 days, then stopped 40 days ago.
  s.incomingMaterial = [...noSeedIM(), ...[0, 1, 2, 3, 4, 5].map(i => challan('Q' + i, 81, iso(-50 + i * 2))), challan('S1', 83, iso(-4)), challan('S2', 83, iso(-2))];
  s.stock = {
    items: [
      { id: 'B', name: 'Brightener', key: 'BRIGHTENER', unit: 'L', basis: 'draw', aliases: [] },
      { id: 'H', name: 'HCL', key: 'HCL', unit: 'L', basis: 'draw', aliases: [] },
    ],
    entries: [
      { id: 'c1', itemId: 'B', kind: 'count', qty: 40, date: iso(-10), at: 1, seq: 3 },
      { id: 'u1', itemId: 'B', kind: 'used', qty: 50, days: 10, from: iso(-10), date: iso(-1), at: 2, seq: 2 },
      { id: 'b1', itemId: 'B', kind: 'bill', qty: 30, price: 170, date: iso(-60), billDate: iso(-60), supplier: 'Alpha', billNo: 'A1', at: 0, seq: 0 },
      { id: 'b2', itemId: 'B', kind: 'bill', qty: 90, price: 166, date: iso(-30), billDate: iso(-30), supplier: 'Alpha', billNo: 'A2', at: 0, seq: 0 },
      { id: 'c2', itemId: 'H', kind: 'count', qty: 500, date: iso(-5), at: 1, seq: 3 },
      { id: 'u2', itemId: 'H', kind: 'used', qty: 20, days: 5, from: iso(-5), date: iso(-1), at: 2, seq: 2 },
    ],
    pastes: [],
  };
  return s;
}

test.describe('P48: insights, predictions and the reorder list', () => {
  test('insights are raised from the book with their figures, and live on the To-do list and Stats', async ({ page }) => {
    await loadAppWithState(page, state());
    const ins = await g(page, `todoAppAll().filter(function(t){ return t.rule.indexOf('ins') === 0; }).map(function(t){ return t.rule + '|' + t.title; })`) as string[];
    expect(ins).toContain('insQuiet|QUIET WORKS: no challan for 40 days');
    expect(ins).toContain('insClientDown|FALLING PARTS: billing down three months running');
    await openStatsTab(page, 'overview');
    await expect(page.locator('#statsInsights')).toContainText('QUIET WORKS: no challan for 40 days');
    await page.locator('#statsInsights [data-action="invTodoOpenApp"]').filter({ hasText: 'QUIET WORKS' }).click();
    await expect(page.locator('.inv-td-facts')).toContainText('Usual gap');
    // Switched off in Settings, it is gone.
    await g(page, `(function(){ S.todoCheck = Object.assign({}, S.todoCheck, { insQuiet: false }); })()`);
    expect(await g(page, `todoAppAll().some(function(t){ return t.rule === 'insQuiet'; })`)).toBe(false);
  });

  test('predictions: the month at its pace, and each client’s next challan', async ({ page }) => {
    await loadAppWithState(page, state());
    const c = await g(page, `predCadence().map(function(x){ return [x.name, x.median, x.quiet]; })`) as any[];
    expect(c).toContainEqual(['QUIET WORKS', 2, true]);
    await openStatsTab(page, 'clients');
    await expect(page.locator('#statsNextChallan')).toContainText('QUIET WORKS');
    await expect(page.locator('#statsNextChallan')).toContainText('quiet');
    const p = await g(page, `predMonthPace()`) as any;
    if (p) expect(p.projRev).toBeGreaterThanOrEqual(p.rev);
  });

  test('a new invoice takes the next PO in sequence and the usual vehicle', async ({ page }) => {
    await loadAppWithState(page, state());
    expect(await g(page, `predPO(83).value`)).toBe('SA/0046');
    await switchTab(page, 'pageCreate');
    await g(page, `selectClient(83)`);
    await expect(page.locator('#invPONumber')).toHaveValue('SA/0046');
    await expect(page.locator('#invTransport')).toHaveValue('JH 05AB 1234');
    await expect(page.locator('[data-pred]').first()).toContainText('next in sequence after SA/0045');
    // Rising but skipping: only the prefix is offered.
    expect(await g(page, `(function(){ S.invoices.filter(function(i){ return i.clientId === 83; }).forEach(function(i, n){ i.poNumber = 'SA/0' + (100 + n * 9); }); return predPO(83); })()`)).toMatchObject({ value: 'SA/', prefixOnly: true });
  });

  test('the reorder list: use over lead + cover, less the shelf, in packs, by supplier, copied as a message', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockReorder"]').click();
    await page.locator('#stockLeadDays').fill('10');
    await page.locator('#stockLeadDays').dispatchEvent('change');
    await page.locator('#stockCoverDays').fill('20');
    await page.locator('#stockCoverDays').dispatchEvent('change');
    // Brightener: 5 L/day × 30 days = 150; the shelf is empty (40 counted, 50 used); packs of 30 → 150 at ₹166.
    const br = page.locator('[data-stock-reorder="B"]');
    await expect(br).toHaveValue('150');
    await expect(page.locator('.inv-stk-sec').filter({ hasText: 'ALPHA' })).toContainText('₹24,900.00');
    // HCl: 4 L/day × 30 = 120 against 480 on hand: enough.
    await expect(page.locator('[data-stock-reorder="H"]')).toHaveCount(0);
    await br.fill('60');
    await expect(page.locator('#stockReorderTotal')).toContainText('₹9,960.00');
    expect((await readStoredState(page)).stockCheck).toMatchObject({ leadDays: 10, coverDays: 20 });
    const text = await g(page, `stockReorderText(stockReorderList())`);
    expect(text).toContain('Alpha:');
    expect(text).toContain('1) Brightener 60 L');
  });
});
