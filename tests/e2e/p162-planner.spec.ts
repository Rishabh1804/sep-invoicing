import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, waitForBoot, type SepState } from './fixtures';

// P162: the planner (docs/PLANNER.md). A month is built from the book's parts up; a move changes an input, never a total;
// the ledger's rows add up to the plan; a scenario never writes the book; the registers are records.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
/* The 10th of each of the last three full months. */
function lastMonths(): string[] {
  const out: string[] = [];
  const d = new Date(); d.setDate(1);
  for (let i = 1; i <= 3; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 10); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-10`); }
  return out;
}
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.clients = [
    { id: 1, name: 'ALPHA PRESS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [] },
    { id: 2, name: 'BETA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [] }
  ];
  let n = 0;
  s.invoices = [];
  lastMonths().forEach(date => {
    [[1, 'BRACKET', 1000, 13], [2, 'FLANGE NUT', 2000, 10]].forEach(([cid, part, kg, rate]: any) => {
      n++;
      s.invoices.push({ id: 'INV' + n, invoiceNumber: n, displayNumber: 'SEP/TEST-' + n, date, status: 'active', invoiceState: 'filed', clientId: cid, clientName: cid === 1 ? 'ALPHA PRESS' : 'BETA AUTO',
        items: [{ partNumber: part, desc: part, unit: 'KG', qty: kg, rate, amount: kg * rate }], taxableValue: kg * rate, grandTotal: kg * rate * 1.18, createdAt: Date.now() });
    });
  });
  return s;
}

test.describe('P162 the planner', () => {
  test('as it runs, the planner reproduces the book’s average month', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () { var P = plnPlanned(); return { rev: Math.round(P.base[0].rev), kg: Math.round(P.base[0].plated), clients: P.B.clients.length, lines: P.B.lines['vat-a2'].src }; })()`);
    expect(r.rev).toBe(13000 + 20000);
    expect(r.kg).toBe(3000);
    expect(r.clients).toBe(2);
    expect(r.lines).toBe('assumed');   // no register read: said so
  });

  test('a move changes an input, the ledger adds up, and the book is not touched', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner [data-action="invPlnView"][data-v="clients"]').click();
    await page.locator('[data-pl-client="2"] [data-action="invPlnClient"]').click();
    await page.locator('#plnAsk input[data-pl-ask="to"]').fill('15');
    await page.locator('#plnAsk input[data-pl-ask="to"]').dispatchEvent('change');
    await page.locator('#plnAsk [data-action="invPlnPlan"]').click();
    const r: any = await g(page, `(function () { var P = plnPlanned('all'), at = plnAttribution(5, 'all');
      return { m0: Math.round(P.months[0].rev), m5: Math.round(P.months[5].rev), ready: P.ready['ask:2'], sum: Math.round(at.base + at.rows.reduce(function (s, r) { return s + r.margin; }, 0)), plan: Math.round(at.plan) }; })()`);
    expect(r.ready).toBe(2);                        // asked next month, in effect the month after
    expect(r.m0).toBe(33000);
    expect(r.m5).toBe(13000 + 2000 * 15);           // BETA's kilos at the rate asked
    expect(r.sum).toBe(r.plan);                     // today's margin + each move = the plan
    const stored = await readStoredState(page);
    expect(stored.invoices.length).toBe(6);
    expect(stored.invoices.every((i: any) => i.items[0].rate === 13 || i.items[0].rate === 10)).toBe(true);
    expect(stored.planner.scenarios.length).toBe(1);
    expect(stored.planner.scenarios[0].plan['ask:2']).toBe(1);
  });

  test('the loan is amortised: the principal repaid is the amount borrowed', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () { var s = plnLoanSchedule({ amt: 120000, rate: 12, months: 12, mor: 0, at: 0 });
      return { inAt0: s[0].in, emi: Math.round(s[1].emi * 100) / 100, principal: Math.round(s.reduce(function (t, e) { return t + e.principal; }, 0)), owed: Math.round(s[12].bal) }; })()`);
    expect(r.inAt0).toBe(120000);
    expect(r.emi).toBeCloseTo(10661.85, 1);
    expect(r.principal).toBe(120000);
    expect(r.owed).toBe(0);
  });

  test('a machine needing work is a record: it raises a task, and is retired with a reason', async ({ page }) => {
    // The machines are the plant register's units (plant.js, P166): added and edited in its editor, from the planner too.
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner [data-action="invPlnView"][data-v="plant"]').click();
    await page.locator('#plnMachines [data-action="invPltEdit"]').click();
    await page.fill('#pltName', 'Rectifier 2');
    await page.selectOption('#pltStation', 'vat-a2');
    await page.selectOption('#pltCond', 'needs');
    await page.fill('#pltNeeds', 'new diodes');
    await page.locator('[data-action="invPltSave"]').click();
    await expect(page.locator('[data-pl-machine]')).toHaveCount(1);
    expect(await g(page, `todoApp().filter(function (t) { return t.rule === 'plnMachine'; }).length`)).toBe(1);
    await page.locator('[data-pl-machine] [data-action="invPltEdit"]').click();
    await page.locator('[data-action="invPltRetire"]').click();
    await answerAsk(page, 'ok', 'sold');
    await expect(page.locator('[data-pl-machine]')).toHaveCount(0);
    const stored = await readStoredState(page);
    expect(stored.plant.units[0].retiredAt).toBeTruthy();
    expect(stored.plant.units[0].retireReason).toBe('sold');
  });

  test('a plan is played: the CQI-11 path, the trials, the board and the report', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner [data-action="invPlnCopy"]').click();
    await page.locator('#pagePlanner [data-action="invPlnStart"]').click();
    expect(await g(page, `plnPlanned().ready.cqi`)).toBeGreaterThan(0);
    await expect(page.locator('#plnBoard .inv-pl-pin')).toHaveCount(10);
    await page.locator('#pagePlanner [data-action="invPlnRoll"]').click();
    await expect(page.locator('[data-pl-hud="score"] .inv-tile-value')).toHaveText(/%$/);
    await expect(page.locator('#plnOutcome [data-pl-ach]').first()).toBeVisible();
    // A move on the board shifts a month from its dialog.
    const before = await g(page, `plnScenario().plan.cqi`);
    await page.locator('#plnBoard .inv-pl-pin[data-key="cqi"]').click();
    await page.locator('[data-pl-pin-dialog] [data-action="invPlnShift"][data-step="1"]').click();
    expect(await g(page, `plnScenario().plan.cqi`)).toBe(before + 1);
    await page.locator('[data-pl-pin-dialog] .inv-dialog-foot [data-action="invCloseOverlay"]').click();
    await page.locator('#pagePlanner [data-action="invPlnReport"]').click();
    await expect(page.locator('#invPrintBody [data-pl-report]')).toBeVisible();
    await expect(page.locator('#invPrintBody [data-pl-report]')).toContainText('CQI-11 self-assessed');
  });

  test('a card of your own adds new work on a line, at its rate', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pagePlanner');
    await page.locator('#plnHand [data-action="invPlnCard"]').click();
    await page.fill('#plnCTitle', 'New customer');
    await page.fill('#plnCTonnes', '1');
    await page.fill('#plnCRate', '20');
    await page.fill('#plnCP', '10');
    await page.fill('#plnCLag', '0');
    await page.locator('[data-action="invPlnCardSave"]').click();
    await page.locator('#plnHand [data-action="invPlnPlan"]').click();
    const r: any = await g(page, `(function () { var P = plnPlanned('all'); return { m3: Math.round(P.months[3].byClient.card || 0), kg: Math.round(P.months[3].plated) }; })()`);
    expect(r.m3).toBe(20000);
    expect(r.kg).toBe(4000);
  });

  test('an address opens the view; the guide is in the knowledge base', async ({ page }) => {
    await loadAppWithState(page, book());
    await page.goto('/sep-invoicing.html?tab=pagePlanner&v=ledger');
    await waitForBoot(page);
    await expect(page.locator('#plnLedger')).toBeVisible();
    expect(await g(page, `KB_APP_GUIDES.filter(function (a) { return a.id === 'app-planner' && a.links.some(function (l) { return l.id === 'pagePlanner'; }); }).length`)).toBe(1);
  });

  test('with no weighed invoices, the planner says what it needs and keeps the registers', async ({ page }) => {
    const s: any = emptyState(); s.incomingMaterial = noSeedIM();
    await loadAppWithState(page, s);
    await switchTab(page, 'pagePlanner');
    await expect(page.locator('#plannerContent .inv-empty').first()).toContainText('needs invoices with weights');
    await expect(page.locator('#plnMachines')).toBeVisible();
  });
});
