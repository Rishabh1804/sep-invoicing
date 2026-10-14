import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P173 (owner, 7 Oct 2026: "Start with 1 and 2"): a client's statement of account and a payment reminder, from Receivables'
// own figures. The closing balance is what Receivables says is owed, to the paisa; the reminder names what is open and is
// recorded when sent. Names, numbers and figures are made up; dates are built from today.

const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

let seq = 0;
function row(date: string, narration: string, dr: number, cr: number, set?: any) {
  const r: any = { id: 'BK-S' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance: 100000, dayIdx: seq, importId: 'BI-S' };
  if (set) r.set = set; else if (cr > 0 && /ALPHA/.test(narration)) r.set = { cat: 'receipt', clientId: 1 };
  return r;
}
function bank(rows: any[], extra: any = {}) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.dayIdx - b.dayIdx);
  return Object.assign({ rows, imports: [{ id: 'BI-S', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
    parties: {}, opening: {}, gstNotes: {} }, extra);
}
function inv(n: number, date: string, total: number) {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'dispatched',
    clientId: 1, clientName: 'ALPHA FORGINGS', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: taxable, amount: taxable }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
function note(n: number, date: string, against: string, total: number) {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'CN-' + n, cnNumber: String(n).padStart(3, '0'), displayNumber: 'CN/' + String(n).padStart(3, '0') + '/26-27', kind: 'adjustment', date, clientId: 1, clientName: 'ALPHA FORGINGS',
    againstInvoice: against, invoiceNumbers: [against], taxableValue: taxable, cgstAmt: tax, sgstAmt: tax, igstAmt: 0, grandTotal: total, status: 'active', createdAt: recentTs() };
}
function state(extra: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.company = Object.assign({}, s.company, { name: 'TEST WORKS', phone: '9000000001' });
  s.bankDetails = 'TEST BANK · A/c 000111222 · IFSC TEST0000001';
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '20AAAAA0000A1Z5', address: '', isActive: true, rates: [], itemRates: [],
    add1: 'PLOT 1, ADITYAPUR', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20', mobile: '98765 43210' }];
  return Object.assign(s, extra);
}
/* The book: four invoices from 100 days ago, a credit note, a receipt that pays the first two exactly (59 paise over the
   rupee), and one that pays part of the third, oldest first. */
function book(): SepState {
  seq = 0;
  const rows = [row(day(-110), 'SMS CHARGES', 1, 0),
    row(day(-60), 'NEFT-ALPHA FORGINGS', 0, 23600 + 11800 - 0.59),
    row(day(-20), 'NEFT-ALPHA FORGINGS', 0, 5000),
    row(day(-1), 'SMS CHARGES', 1, 0)];
  return state({ bank: bank(rows), invoices: [inv(1, day(-100), 23600), inv(2, day(-80), 11800), inv(3, day(-50), 17700), inv(4, day(-10), 5900)],
    creditNotes: [note(1, day(-40), 'T/00003', 1180)] });
}

test('the statement is Receivables in dated lines: its closing balance is what is owed, to the paisa, from any first day', async ({ page }) => {
  await loadAppWithState(page, book());
  const r: any = await ev(page, `(function() {
    var s = soaCompute(1), owed = bankReceivables().find(function(x) { return x.client.id === 1; }).owed;
    var later = soaCompute(1, '${day(-45)}');
    return { closing: s.closing, owed: owed, kinds: s.rows.map(function(x) { return x.kind; }), dr: s.dr, cr: s.cr, bf: s.bf,
      later: { closing: later.closing, bf: later.bf, n: later.rows.length, first: later.rows[0].kind }, open: s.open.map(function(o) { return [o.label, o.due, o.days]; }), age: s.age };
  })()`);
  // 23,600 + 11,800 + 17,700 + 5,900 − 1,180 − 35,399.41 − 5,000 − 0.59 settled = 17,420.
  expect(r.owed).toBe(17420);
  expect(r.closing).toBe(r.owed);
  expect(r.kinds).toEqual(['invoice', 'invoice', 'receipt', 'rounding', 'invoice', 'note', 'receipt', 'invoice']);
  expect([r.dr, r.cr]).toEqual([59000, 41580]);
  // From a later day: what came before is one line, and the closing does not move.
  expect(r.later.closing).toBe(17420);
  expect(r.later.bf).toBe(gst(23600 + 11800 + 17700 - 35400));
  expect(r.later.first).toBe('note');
  // What is open is Receivables' open list, aged from each invoice's date.
  expect(r.open).toEqual([['T/00003', 11520, 50], ['T/00004', 5900, 10]]);
  expect(r.age).toEqual({ a: 5900, b: 11520, c: 0, d: 0 });
});
function gst(n: number) { return Math.round(n * 100) / 100; }

test('from Receivables: the dialog, the printed statement, and a reminder sent on WhatsApp and recorded', async ({ page }) => {
  await loadAppWithState(page, book());
  await page.evaluate(() => { (window as any).__opened = []; window.open = ((u: string) => { (window as any).__opened.push(u); return null; }) as any; });
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="receipts"]').click();
  await page.locator('[data-action="invBankClient"][data-id="1"]').click();
  await expect(page.locator('[data-soa-row-btn="1"]')).toContainText('No reminder sent yet');
  await page.locator('[data-action="invSoaOpen"][data-client="1"]').click();
  const dlg = page.locator('[data-soa-dialog="1"]');
  await expect(dlg.locator('[data-soa-owed]')).toContainText('17,420.00');
  const text = await dlg.locator('#soaText').inputValue();
  expect(text).toContain('17,420.00 is outstanding from ALPHA FORGINGS');
  expect(text).toContain('• T/00003 dated');
  expect(text).toContain('11,520.00 (of ₹17,700.00), 50 days');
  expect(text).toContain('TEST WORKS, 9000000001');
  await dlg.locator('[data-action="invSoaWa"]').click();
  const opened: string[] = await page.evaluate(() => (window as any).__opened);
  expect(opened.length).toBe(1);
  expect(opened[0].startsWith('https://wa.me/919876543210?text=')).toBe(true);
  expect(decodeURIComponent(opened[0].split('text=')[1])).toBe(text.trim());
  await expect(dlg.locator('[data-soa-last]')).toContainText('last sent');
  const st: any = await readStoredState(page);
  expect(st.bank.reminders.length).toBe(1);
  expect([st.bank.reminders[0].clientId, st.bank.reminders[0].amount, st.bank.reminders[0].how]).toEqual([1, 17420, 'whatsapp']);
  // The printed statement: the lines, the open invoices aged, where to pay, and the closing balance.
  await dlg.locator('[data-action="invSoaPrint"]').click();
  const doc = page.locator('#invPrintBody [data-soa-doc="1"]');
  await expect(doc).toContainText('STATEMENT OF ACCOUNT');
  await expect(doc.locator('[data-soa-closing]')).toHaveText('₹17,420.00 Dr');
  await expect(doc.locator('tr[data-soa-row]')).toHaveCount(8);
  await expect(doc.locator('tr[data-soa-open]')).toHaveCount(2);
  await expect(doc.locator('tr[data-soa-age]')).toContainText('11,520.00');
  await expect(doc).toContainText('TEST BANK');
  await expect(doc).toContainText('20AAAAA0000A1Z5');
  // Receivables says when the client was last asked, in the client's fold beside the button (the tab map, TM3c).
  await page.evaluate(() => (window as any).closePrintPreview());
  await expect(page.locator('[data-soa-row-btn="1"]')).toContainText(/reminded/i);
});

test('a statement that ends days ago, or receipts with no client, are said before anything goes out', async ({ page }) => {
  seq = 0;
  const rows = [row(day(-110), 'SMS CHARGES', 1, 0), row(day(-40), 'BY INST 445566', 0, 3000), row(day(-9), 'SMS CHARGES', 1, 0)];
  await loadAppWithState(page, state({ bank: bank(rows), invoices: [inv(1, day(-100), 23600)] }));
  await ev(page, `soaOpen(1)`);
  const warn = page.locator('[data-soa-dialog] [data-soa-warn]');
  await expect(warn).toHaveCount(2);
  await expect(warn.nth(0)).toContainText('The bank statement ends');
  await expect(warn.nth(1)).toContainText('1 receipt since');
});

test('the To-do chase over 90 days carries a reminder move that opens the dialog, and says when it was last sent', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-110), 'SMS CHARGES', 1, 0), row(day(-1), 'SMS CHARGES', 1, 0)]), invoices: [inv(1, day(-100), 23600), inv(2, day(-20), 5900)] }));
  const before: any = await ev(page, `advTaskMoves(todoAppAll().find(function(t) { return t.rule === 'owed90'; })).map(function(m) { return [m.key, m.basis]; })`);
  expect(before.map((m: any) => m[0])).toEqual(['owed:1', 'remind:1']);
  expect(before[1][1]).toBe('no reminder sent yet');
  await ev(page, `todoGo({ kind: 'soa', client: 1 })`);
  await expect(page.locator('#pageFinance.inv-page-active')).toHaveCount(1);
  await expect(page.locator('[data-soa-dialog="1"]')).toHaveCount(1);
  await ev(page, `soaSent('copy')`);
  const after: any = await ev(page, `advTaskMoves(todoAppAll().find(function(t) { return t.rule === 'owed90'; })).map(function(m) { return m.basis; })`);
  expect(after[0]).toContain('reminded');
  expect(after[1]).toContain('last reminded');
});
