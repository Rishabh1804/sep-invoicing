import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P82: receivables start on the later of the statement's first day and the book's first invoice (owner,
// 28 Sep 2026: "we are checking against clients from January while we only have invoice data from April").
// A receipt from before the book paid an invoice the app never held; read against the book it paid the
// first invoices early and the client read paid ahead. Every date is built from today; names and figures are made up.

const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
let seq = 0;
const row = (date: string, narration: string, cr: number, set?: any) =>
  Object.assign({ id: 'BK-R' + (++seq), date, valueDate: date, narration, chq: '', dr: 0, cr, balance: 100000, dayIdx: seq }, set ? { set } : {});
function inv(n: number, date: string, total: number) {
  return { id: 'INV-' + n, invoiceNumber: String(n), displayNumber: 'T/' + n, date, status: 'active', invoiceState: 'dispatched', clientId: 1, clientName: 'ALPHA FORGINGS',
    gstType: 'intra', items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: 1, rate: total, amount: total }], taxableValue: total / 1.18,
    cgstAmt: total * 0.09 / 1.18, sgstAmt: total * 0.09 / 1.18, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
function state(rows: any[], invoices: any[], opening: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] }];
  s.invoices = invoices;
  s.bank = { rows, imports: [], parties: {}, opening, gstNotes: {} };
  return s;
}
const ALPHA = { cat: 'receipt', clientId: 1 };

test('a statement that reaches back before the book: early receipts are left out, and the client is not paid ahead', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([
    row(day(-60), 'BY INST 700101', 3000),                     // before the book, nobody placed it
    row(day(-50), 'NEFT-UTR1-ALPHA FORGINGS', 10000, ALPHA),   // before the book: paid an invoice the app never held
    row(day(-10), 'NEFT-UTR2-ALPHA FORGINGS', 5900, ALPHA),    // pays T/1 to the rupee
    row(day(-8), 'BY INST 700140', 4000),                      // in the window, unplaced
  ], [inv(1, day(-30), 5900), inv(2, day(-20), 11800)]));

  expect(await ev(page, `bankRecvFrom()`)).toBe(day(-30));
  const r = await ev(page, `(function() { var r = bankReceivables()[0]; return { received: r.received, owed: r.owed, how: r.allocs.map(function(a) { return a.how; }), open: r.open.map(function(o) { return o.label; }) }; })()`);
  // Only the receipt in the window counts: it pays T/1 exactly, and T/2 is still owed. The ₹10,000 from
  // before the book used to pay both and read the client ₹4,100 paid ahead.
  expect(r).toEqual({ received: 5900, owed: 11800, how: ['exact'], open: ['T/2'] });
  expect(await ev(page, `bankLooseReceipts(bankClassify()).length`)).toBe(1);

  await switchTab(page, 'pageFinance');
  await expect(page.locator('[data-fin-tile="owed"]')).toContainText('1 receipt not placed');
  const tab = page.locator('[data-action="invFinTab"][data-tab="receipts"]');
  await expect(tab.locator('.inv-badge')).toHaveText('1');
  await tab.click();
  const panel = page.locator('#bankReceipts');
  await expect(panel).toContainText('the first invoice in the book');
  await expect(page.locator('[data-loose]')).toHaveCount(1);
  await expect(page.locator('[data-loose-early="1"]')).toContainText('from before');
});

test('an opening set against the statement’s first day is not counted once receivables start later; a new one is', async ({ page }) => {
  seq = 0;
  // Written by an older build: an amount, no day. It meant what was owed on the statement's first day.
  await loadAppWithState(page, state([row(day(-60), 'NEFT-UTR3-ALPHA FORGINGS', 2000, ALPHA), row(day(-5), 'NEFT-UTR4-ALPHA FORGINGS', 1000, ALPHA)],
    [inv(1, day(-30), 5900)], { 1: { amount: 2000, at: 1 } }));
  expect(await ev(page, `bankReceivables()[0].owed`)).toBe(4900);

  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="receipts"]').click();
  await page.locator('[data-recv="1"] [data-action="invBankClient"]').click();
  await expect(page.locator('[data-opening-stale]')).toContainText('not counted');
  await page.locator('#bankOpening').fill('3000');
  await page.locator('#bankOpening').dispatchEvent('change');
  await expect(page.locator('[data-opening-stale]')).toHaveCount(0);
  expect(await ev(page, `bankData().opening[1].date`)).toBe(day(-30));
  expect(await ev(page, `bankReceivables()[0].owed`)).toBe(7900);
});

test('a book that reaches back before the statement starts on the statement, and an opening from before keeps counting', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([row(day(-20), 'NEFT-UTR5-ALPHA FORGINGS', 5900, ALPHA)],
    [inv(1, day(-40), 3000), inv(2, day(-15), 5900)], { 1: { amount: 1500, at: 1 } }));
  expect(await ev(page, `bankRecvFrom()`)).toBe(day(-20));
  // T/1 is before the statement and not read; the opening stands for it, and the receipt pays it first.
  expect(await ev(page, `bankReceivables()[0].owed`)).toBe(1500);
  expect(await ev(page, `bankReceivables()[0].openingStale`)).toBeNull();
});

test('a receipt never pays an invoice raised after it: what it cannot place stays on account', async ({ page }) => {
  seq = 0;
  // March money for SSS-shaped work: it lands three days after the book's first invoice, far more than was open then.
  await loadAppWithState(page, state([row(day(-27), 'NEFT-UTR6-ALPHA FORGINGS', 20000, ALPHA)],
    [inv(1, day(-27), 1000), inv(2, day(-20), 5900), inv(3, day(-10), 11800)]));
  const r = await ev(page, `(function() { var r = bankReceivables()[0]; return { owed: r.owed, onAccount: r.onAccount, open: r.open.map(function(o) { return o.label; }),
    parts: r.allocs[0].parts.map(function(p) { return p.label; }), credits: r.credits.map(function(p) { return p.label; }) }; })()`);
  // The receipt pays T/1 (raised by its day) and names nothing else: T/2 and T/3 were not issued yet. What it could
  // not place is on account, and settles them afterwards, so the open list still adds up to what is owed.
  expect(r).toEqual({ owed: -1300, onAccount: 19000, open: [], parts: ['T/1'], credits: ['T/2', 'T/3'] });
  // Days to pay reads only what the receipt paid (T/1, the same day), never an invoice raised after it.
  expect(await ev(page, `bankPayHistory(bankReceivables())[1].map(function(x) { return [x.days, x.amount]; })`)).toEqual([[0, 1000]]);
  // The invoice detail says T/3 was settled from money on account, not paid by a receipt dated before it.
  expect(await ev(page, `finInvoicePayment(S.invoices[2]).paid.map(function(p) { return p.how; })`)).toEqual(['account']);
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="receipts"]').click();
  await expect(page.locator('[data-recv="1"]')).toContainText('on account');
  await page.locator('[data-recv="1"] [data-action="invBankClient"]').click();
  await expect(page.locator('[data-on-account]')).toContainText('more than was open to pay');
  await expect(page.locator('[data-alloc]')).toContainText('more than was open by then');
});
