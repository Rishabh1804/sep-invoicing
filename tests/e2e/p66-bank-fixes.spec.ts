import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P66: what the bug search over the finance modules found (26 Sep 2026), each pinned so it cannot come back.
// Every date is built from today; names and figures are made up.

const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
let seq = 0;
const row = (date: string, narration: string, dr: number, cr: number, set?: any) =>
  Object.assign({ id: 'BK-F' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance: 100000, dayIdx: seq }, set ? { set } : {});
function inv(n: number, date: string, total: number) {
  return { id: 'INV-' + n, invoiceNumber: String(n), displayNumber: 'T/' + n, date, status: 'active', invoiceState: 'dispatched', clientId: 1, clientName: 'ALPHA FORGINGS',
    gstType: 'intra', items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: 1, rate: total, amount: total }], taxableValue: total / 1.18,
    cgstAmt: total * 0.09 / 1.18, sgstAmt: total * 0.09 / 1.18, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
function state(rows: any[], extra: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] },
    { id: 2, name: 'BETA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] }];
  s.staff = [{ id: 7, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true }];
  s.bank = { rows, imports: [], parties: {}, opening: {}, gstNotes: {} };
  return Object.assign(s, extra);
}

test('a cheque deposit is never a payee: no rule is offered, and none written applies', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([row(day(-5), 'BY INST 525428', 0, 9000), row(day(-3), 'BY INST 525429', 0, 7000)]));
  // A rule keyed on the shared "Cheque deposited" (as an older build could write) must not place every cheque.
  await ev(page, `bankData().parties[bankKey('Cheque deposited')] = { cat: 'receipt', clientId: 1 }`);
  expect(await ev(page, `bankClassify().map(function(v) { return v.clientId; })`)).toEqual([null, null]);
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="bank"]').click();
  await page.locator('[data-bank-row] [data-action="invBankEdit"]').first().click();
  await expect(page.locator('#bankEditAll')).toHaveCount(0);
});

test('the edit form’s client picker waits for Save; Nobody on the roster clears a guessed hand', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([row(day(-4), 'NEFT-UTR1-GAMMA WORKS', 0, 5000), row(day(-2), 'NEFT-UTR2-RAMU KUMAR', 12000, 0, { cat: 'wages', staffId: null })],
    { }));
  await ev(page, `bankData().parties[bankKey('RAMU KUMAR')] = { cat: 'wages', staffId: 7 }`);
  expect(await ev(page, `bankClassify()[1].staffId`)).toBeNull();

  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="bank"]').click();
  await page.locator('[data-bank-row] [data-action="invBankEdit"]', { hasText: 'GAMMA WORKS' }).click();
  await page.locator('#bankEditClient').selectOption('2');
  // Nothing is written until Save; Cancel leaves the payee unruled.
  expect(await ev(page, `JSON.stringify(bankData().parties)`)).not.toContain('"clientId":2');
  await page.locator('[data-action="invBankEditCancel"]').click();
  expect(await ev(page, `bankClassify()[0].clientId`)).toBeNull();
});

test('a receipt rule speaks for money in only; a refund to the same party stays a payment', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([row(day(-6), 'NEFT-UTR3-BETA AUTO', 0, 20000), row(day(-2), 'NEFT-UTR4-BETA AUTO', 20000, 0)]));
  await ev(page, `bankData().parties[bankKey('BETA AUTO')] = { cat: 'receipt', clientId: 2 }`);
  expect(await ev(page, `bankClassify().map(function(v) { return v.cat; })`)).toEqual(['receipt', 'other']);
});

test('a receipt is matched exactly only to what was invoiced by the day it came in', async ({ page }) => {
  seq = 0;
  // 5,000 on day −30, the receipt of 7,000 on day −20, then 7,000 invoiced on day −10: the receipt is not Exact against the later one.
  await loadAppWithState(page, state([row(day(-40), 'SMS CHARGES', 1, 0), row(day(-20), 'NEFT-UTR5-ALPHA FORGINGS', 0, 7000, { cat: 'receipt', clientId: 1 })],
    { invoices: [inv(1, day(-30), 5000), inv(2, day(-10), 7000)] }));
  const a = await ev(page, `(function() { var r = bankReceivables().find(function(x) { return x.client.id === 1; }); return { how: r.allocs[0].how, first: r.allocs[0].parts[0].label }; })()`);
  expect(a).toEqual({ how: 'oldest', first: 'T/1' });
});

test('an invoice dated ahead of today is not over 90 days; GST a statement never reached reads No statement', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([row(day(-10), 'SMS CHARGES', 1, 0), row(day(-1), 'SMS CHARGES', 1, 0)], { invoices: [inv(1, day(1), 5900)] }));
  const bands = await ev(page, `finAgeing(bankReceivables()).map(function(b) { return b.amount; })`) as number[];
  expect(bands[3]).toBe(0);
  expect(bands[0]).toBe(5900);
  const st = await ev(page, `(function() { var m = insMonthsBack(3)[0]; var r = finGstByMonth([m], bankClassify())[0]; return finGstStatus(Object.assign(r, { due: 100 })).text; })()`);
  expect(st).toBe('No statement');
});

/* ---------- Returned cheques ---------- */
test('a returned cheque that names the deposit links itself, and the client owes it again', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([row(day(-40), 'SMS CHARGES', 1, 0),
    row(day(-20), 'BY INST 525428', 0, 50000, { cat: 'receipt', clientId: 1 }),
    row(day(-15), 'REJECT:525428:30:Funds insufficient', 50000, 0)], { invoices: [inv(1, day(-30), 50000)] }));
  const r = await ev(page, `(function() { var x = bankReceivables().find(function(y) { return y.client.id === 1; }); return { owed: x.owed, received: x.received }; })()`);
  expect(r).toEqual({ owed: 50000, received: 0 });
  // The cheque still belongs to the client's series.
  expect(await ev(page, `bankChequeSeries()['1']`)).toEqual(['525428']);
  expect(await ev(page, `todoAppAll(['bankBounce']).length`)).toBe(0);
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="receipts"]').click();
  await expect(page.locator('#bankBounces')).toContainText('by cheque number');
  // Not a bounce: the deposit counts as paid again.
  await page.locator('#bankBounces [data-action="invBankBounce"]').click();
  expect(await ev(page, `bankReceivables().find(function(y) { return y.client.id === 1; }).owed`)).toBe(0);
});

test('a return naming no deposit is only offered one of the same amount, and a task asks for it', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([row(day(-40), 'SMS CHARGES', 1, 0),
    row(day(-10), 'BY INST 111111', 0, 7000, { cat: 'receipt', clientId: 2 }),
    row(day(-6), 'INWARD RTN CHQ', 7000, 0, { cat: 'reversal' })]));
  // Offered, never applied: Beta still reads as having paid.
  expect(await ev(page, `bankReceivables().find(function(y) { return y.client.id === 2; }).received`)).toBe(7000);
  expect(await ev(page, `todoAppAll(['bankBounce'])[0].title`)).toContain('Match the cheque returned');
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="receipts"]').click();
  await page.locator('#bankBounces [data-bounce-offer] [data-action="invBankBounce"]').click();
  // Linked, the deposit is no receipt at all: Beta has nothing left on Receivables.
  expect(await ev(page, `bankReceivables().some(function(y) { return y.client.id === 2; })`)).toBe(false);
  expect(await ev(page, `todoAppAll(['bankBounce']).length`)).toBe(0);
  expect(await ev(page, `JSON.stringify(bankData().bounces)`)).toContain('BK-F2');
});

test('a posting and its own reversal on one day cancel, and nobody is asked about them', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state([row(day(-9), 'REJECT:001290:70:Advice not received', 0, 88018), row(day(-9), 'REJECT:001290:70:Advice not received', 88018, 0)]));
  expect(await ev(page, `bankReturnedCheques().length`)).toBe(0);
  expect(await ev(page, `todoAppAll(['bankBounce']).length`)).toBe(0);
});
