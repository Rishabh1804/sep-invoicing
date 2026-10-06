import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, type SepState } from './fixtures';

// P163: the planner's QA chain (6 Oct 2026). The engine reproduces a large book, a faster line never plates less, a refusal and a
// hire start when they can, weights carry a move's prerequisites, the cache follows the book; the screens keep a tap, a typed
// card, the registers and a scrolled ledger.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
function lastMonths(): string[] {
  const out: string[] = [];
  const d = new Date(); d.setDate(1);
  for (let i = 1; i <= 3; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 10); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-10`); }
  return out;
}
/* Two clients: ALPHA by the kilo, BETA by the piece (with a line of no weight). `scale` multiplies the kilos. */
function book(scale = 1): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [
    { id: 1, name: 'ALPHA PRESS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [] },
    { id: 2, name: 'BETA AUTO', billingMode: 'piece', gstType: 'intra', gstin: '', address: '', rates: [] }
  ];
  s.partWeights = { CLIP: 0.2 };
  let n = 0;
  s.invoices = [];
  lastMonths().forEach(date => {
    const items: any[] = [[1, [{ partNumber: 'BRACKET', desc: 'BRACKET', unit: 'KG', qty: 1000 * scale, rate: 13, amount: 13000 * scale }]],
      [2, [{ partNumber: 'CLIP', desc: 'CLIP', unit: 'NOS', qty: 5000 * scale, rate: 2, amount: 10000 * scale }, { partNumber: 'SET-UP', desc: 'SET-UP', unit: 'LOT', qty: 1, rate: 600, amount: 600 }]]];
    items.forEach(([cid, its]) => {
      n++;
      const tax = its.reduce((t: number, i: any) => t + i.amount, 0);
      s.invoices.push({ id: 'INV' + n, invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date, status: 'active', invoiceState: 'filed', clientId: cid, clientName: cid === 1 ? 'ALPHA PRESS' : 'BETA AUTO',
        items: its, taxableValue: tax, grandTotal: tax * 1.18, createdAt: Date.now() });
    });
  });
  return s;
}

test.describe('P163 the planner, its QA chain', () => {
  test('a large book with no register: the assumed line is fitted, and as it runs reproduces the book', async ({ page }) => {
    await loadAppWithState(page, book(30));   // 30 t + 30,000 pieces a month: well past the assumed VAT A2
    const r: any = await g(page, `(function () { var P = plnPlanned(), B = P.B; return { rev: Math.round(P.base[0].rev), book: Math.round(B.revenue), lost: Math.round(P.base[0].lostRev), fitted: !!B.lines['vat-a2'].fitted }; })()`);
    expect(r.fitted).toBe(true);
    expect(r.lost).toBe(0);
    expect(r.rev).toBe(r.book);
  });

  test('a faster line never plates less: pickling runs as long as the lines need it', async ({ page }) => {
    await loadAppWithState(page, book(30));
    const r: any = await g(page, `(function () { var B = plnBase(), mv = [{ key: 'a2Rect', fx: { line: 'vat-a2', every: -6 }, needs: [], months: 0, at: 0 }];
      var a = plnMonth(0, [], {}, {}), b = plnMonth(0, mv, { a2Rect: 0 }, {}); return { a: a.plated, b: b.plated }; })()`);
    expect(r.b).toBeGreaterThanOrEqual(r.a - 0.5);
  });

  test('a refusal sends less only from the month after the ask, its revenue without kilos too', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () { plnBase(); var c = plnBase().clients.find(function (x) { return x.id == 2; });
      var mv = [{ key: 'ask:2', ask: { client: '2', pct: 5, parts: {} }, refuse: { p: 1, cut: 0.15 }, at: 12, needs: [], months: 1 }];
      var m0 = plnMonth(0, mv, {}, { refused: { 2: true } }), m13 = plnMonth(13, mv, {}, { refused: { 2: true } }), base = plnMonth(0, [], {}, {});
      return { m0: Math.round(m0.rev), base: Math.round(base.rev), m13: Math.round(m13.byClient[2]), b2: Math.round(base.byClient[2]), uw: Math.round(c.revUnweighed) }; })()`);
    expect(r.m0).toBe(r.base);
    expect(r.uw).toBe(600);
    expect(r.m13).toBe(Math.round(r.b2 * 0.85));
  });

  test('weighted by each chance, a move counts its prerequisites’ chances; a hire that cannot start is not paid', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () { plnBase();
      var L = [{ key: 'promote', p: 0.6, needs: [], at: 0, months: 2 }, { key: 'cqi', needs: ['specialist'], at: 0, months: 1 }, { key: 'held:x', p: 1, needs: ['cqi'], at: 0, months: 1 }];
      var w = plnWeights(L);
      var night = [{ key: 'nightCrew', run: 95000, needs: ['inverter|genset'], fx: { night: true }, at: 0, months: 1 }];
      var m = plnMonth(3, night, plnReady(night, null), {});
      return { held: w['held:x'], hires: m.hires, cost: m.cost.hires }; })()`);
    expect(r.held).toBeCloseTo(0.6, 5);
    expect(r.cost).toBe(0);
  });

  test('a failed promotion does not come through in the trials', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await g(page, `plnEdit(function (sc) { sc.plan.promote = 0; })`);
    const r: any = await g(page, `(function () { var R = plnTrials(), n = 0; R.all.forEach(function (t) { t.events.forEach(function (e) { if (/^Promote.*came through/.test(e[1])) n++; }); }); return n; })()`);
    expect(r).toBeGreaterThan(250);
    expect(r).toBeLessThan(470);   // about 6 in 10 of 600, never all of them
  });

  test('the baseline follows the book: a rate edited in place reaches it', async ({ page }) => {
    await loadAppWithState(page, book());
    const before = await g(page, `Math.round(plnBase().revenue)`);
    const after = await g(page, `(function () { var i = S.invoices[0]; i.items[0].amount = 99999; i.taxableValue = 99999; saveState(); return Math.round(plnBase().revenue); })()`);
    expect(after).toBeGreaterThan(before as number);
  });

  test('a figure typed and then a tap: both land', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner [data-action="invPlnView"][data-v="clients"]').click();
    await page.locator('[data-pl-client="1"] [data-action="invPlnClient"]').click();
    await page.locator('#plnAsk input[data-pl-ask="to"]').fill('17');
    await page.locator('#plnAsk [data-action="invPlnPlan"]').click();
    await expect.poll(() => g(page, `(function () { var sc = plnScenario(); return sc && sc.plan['ask:1'] != null && sc.asks[1].to === 17; })()`)).toBe(true);
  });

  test('changing what a card changes keeps what was typed', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#plnHand [data-action="invPlnCard"]').click();
    await page.fill('#plnCTitle', 'Rack jig');
    await page.fill('#plnCCost', '5000');
    await page.fill('#plnCP', '3');
    await page.fill('#plnCWhy', 'fewer rejects');
    await page.selectOption('#plnCKind', 'save');
    await expect(page.locator('#plnCCost')).toHaveValue('5000');
    await expect(page.locator('#plnCP')).toHaveValue('3');
    await expect(page.locator('#plnCWhy')).toHaveValue('fewer rejects');
    await expect(page.locator('#plnCTitle')).toHaveValue('Rack jig');
  });

  test('with no baseline, every register is there; switching a plan is not a change to the book', async ({ page }) => {
    const s: any = emptyState(); s.incomingMaterial = noSeedIM();
    await loadAppWithState(page, s);
    await switchTab(page, 'pagePlanner');
    for (const id of ['#plnMachines', '#plnChecklist', '#plnLenders', '#plnHeard', '#plnHeld']) await expect(page.locator(id)).toHaveCount(1);
    const r: any = await g(page, `(function () { var p = plnData(); p.scenarios.push({ id: 'SCa', name: 'A', plan: {} }, { id: 'SCb', name: 'B', plan: {} }); p.active = 'SCa'; saveState();
      return S.changeLog ? S.changeLog.length : 0; })()`);
    await expect.poll(() => g(page, `S.changeLog ? S.changeLog.length : 0`)).toBeGreaterThanOrEqual(r);
    const n0 = await g(page, `S.changeLog.length`);
    await g(page, `(function () { plnData().active = 'SCb'; saveState(); })()`);
    await page.waitForTimeout(300);
    const active = await g(page, `S.changeLog.slice(${n0}).filter(function (e) { return JSON.stringify(e).indexOf('active') >= 0; }).length`);
    expect(active).toBe(0);
  });

  test('drawing every view writes nothing; a copied plan’s name does not grow', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner [data-action="invPlnCopy"]').click();
    const w0 = await g(page, `_bookWrites`);
    for (const v of ['play', 'ledger', 'day', 'plant', 'tech', 'staff', 'clients', 'finance']) await g(page, `(function () { plnSetView('${v}'); renderPlanner(); })()`);
    expect(await g(page, `_bookWrites`)).toBe(w0);
    for (let i = 0; i < 3; i++) await page.locator('#pagePlanner [data-action="invPlnCopy"]').click();
    const names: any = await g(page, `plnScenarios().map(function (s) { return s.name; })`);
    expect(names).toEqual(['My plan', 'My plan (copy)', 'My plan (copy 2)', 'My plan (copy 3)']);
  });

  test('a month tapped on the ledger keeps the table where it was scrolled', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner .inv-viewtab[data-v="ledger"]').click();
    const sx = page.locator('#plnLedger .inv-scroll-x');
    await sx.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    const left = await sx.evaluate(el => el.scrollLeft);
    expect(left).toBeGreaterThan(0);
    await page.locator('#plnLedger [data-action="invPlnLedgerMonth"][data-m="23"]').click();
    expect(await page.locator('#plnLedger .inv-scroll-x').evaluate(el => el.scrollLeft)).toBe(left);
  });
});
