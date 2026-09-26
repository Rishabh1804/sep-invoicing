import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P62: finance intelligence (docs/FINANCE_INTELLIGENCE_SPEC.md, Phase 5). Each rule raises on its trigger and
// clears on its fix; days to pay is weighted by amount; the cash forecast crosses zero on a constructed case and
// raises `runway`. Every date is built from today; names and figures are made up.

const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ym = (k: number) => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

let seq = 0;
function row(date: string, narration: string, dr: number, cr: number, set?: any, balance = 100000) {
  const r: any = { id: 'BK-P' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance, dayIdx: seq, importId: 'BI-P' };
  // The fake remitter names nobody the matcher knows; a receipt from it is placed on client 1, as a payee rule would.
  if (set) r.set = set; else if (cr > 0 && /ALPHA/.test(narration)) r.set = { cat: 'receipt', clientId: 1 };
  return r;
}
function bank(rows: any[]) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.dayIdx - b.dayIdx);
  return { rows, imports: [{ id: 'BI-P', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
    parties: {}, opening: {}, gstNotes: {} };
}
function inv(n: number, date: string, total: number, clientId = 1) {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'dispatched',
    clientId, clientName: 'ALPHA FORGINGS', gstType: 'intra', items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: taxable, amount: taxable }],
    taxableValue: taxable, cgstAmt: tax, sgstAmt: tax, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
function state(extra: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] }];
  s.staff = [{ id: 7, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true }];
  return Object.assign(s, extra);
}
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const tasks = (page: Page, rule: string) => ev(page, `todoAppAll().filter(function(t) { return t.rule === '${rule}'; }).map(function(t) { return { key: t.key, tone: t.tone, title: t.title, sub: t.sub }; })`) as Promise<any[]>;
const push = (page: Page, js: string) => ev(page, `(function() { ${js}; })()`);

test('bankStale and bankLoose raise on an old statement and an unplaced receipt, and clear on their fix', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-40), 'NEFT-ALPHA FORGINGS', 0, 5000), row(day(-20), 'BY INST 123456', 0, 8000)]) }));
  expect(await tasks(page, 'bankStale')).toMatchObject([{ tone: 'amber', title: 'Import the bank statement' }]);
  expect(await tasks(page, 'bankLoose')).toMatchObject([{ tone: 'amber', title: 'Place 1 receipt on a client' }]);
  // A newer statement row clears the first; placing the cheque clears the second.
  await push(page, `bankData().rows.push({ id: 'BK-NEW', date: '${day(-1)}', valueDate: '${day(-1)}', narration: 'SMS CHARGES', chq: '', dr: 10, cr: 0, balance: 1, dayIdx: 0 })`);
  expect(await tasks(page, 'bankStale')).toEqual([]);
  await push(page, `var r = bankData().rows.find(function(x) { return x.narration === 'BY INST 123456'; }); r.set = { cat: 'receipt', clientId: 1 }`);
  expect(await tasks(page, 'bankLoose')).toEqual([]);
});

test('days to pay is weighted by amount, and a client paying slower is raised', async ({ page }) => {
  seq = 0;
  // 1,000 invoiced 60 days back and 9,000 fifty back, paid together 40 back: (20×1,000 + 10×9,000) ÷ 10,000 = 11 days.
  const rows = [row(day(-200), 'SMS CHARGES', 1, 0), row(day(-40), 'NEFT-ALPHA FORGINGS', 0, 10000)];
  await loadAppWithState(page, state({ bank: bank(rows), invoices: [inv(1, day(-60), 1000), inv(2, day(-50), 9000)] }));
  const d = await ev(page, `(function() { var x = bankDaysToPay(1); return { median: x.median, n: x.n, exact: x.exactShare }; })()`) as any;
  expect(d).toEqual({ median: 11, n: 1, exact: 1 });

  // Six receipts: three at 10 days, then three at 20. Its usual is 10; the last three run at 20.
  seq = 0;
  const r2 = [row(day(-200), 'SMS CHARGES', 1, 0)], invs: any[] = [];
  [-180, -150, -120].forEach((o, i) => { invs.push(inv(10 + i, day(o), 5000)); r2.push(row(day(o + 10), 'NEFT-ALPHA FORGINGS', 0, 5000)); });
  [-90, -60, -30].forEach((o, i) => { invs.push(inv(20 + i, day(o), 5000)); r2.push(row(day(o + 20), 'NEFT-ALPHA FORGINGS', 0, 5000)); });
  await loadAppWithState(page, state({ bank: bank(r2), invoices: invs }));
  expect(await tasks(page, 'payingSlower')).toMatchObject([{ tone: 'amber', title: 'ALPHA FORGINGS is paying slower' }]);
  const s = await ev(page, `(function() { var x = bankDaysToPay(1); return [Math.round(x.median), Math.round(x.last3), x.n]; })()`);
  expect(s).toEqual([10, 20, 6]);
  // Receivables and the Overview show it.
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="receipts"]').click();
  await expect(page.locator('[data-recv="1"]')).toContainText('pays in 10 d');
});

test('owed90 raises per client, red at a tenth of the book, and amber while receipts are unplaced', async ({ page }) => {
  seq = 0;
  const rows = [row(day(-150), 'SMS CHARGES', 1, 0)];
  await loadAppWithState(page, state({ bank: bank(rows), invoices: [inv(1, day(-100), 50000), inv(2, day(-10), 50000)] }));
  expect(await tasks(page, 'owed90')).toMatchObject([{ key: 'owed90:1', tone: 'red', title: 'ALPHA FORGINGS owes ₹50,000.00 over 90 days' }]);
  await push(page, `bankData().rows.push({ id: 'BK-L', date: '${day(-5)}', valueDate: '${day(-5)}', narration: 'BY INST 777001', chq: '', dr: 0, cr: 50000, balance: 1, dayIdx: 0 })`);
  const t = await tasks(page, 'owed90');
  expect(t[0].tone).toBe('amber');
  expect(t[0].sub).toContain('1 receipt not placed yet may have paid some');
  // Placed on the client, it pays the oldest invoice first, and the rule clears.
  await push(page, `bankData().rows.find(function(x) { return x.id === 'BK-L'; }).set = { cat: 'receipt', clientId: 1 }`);
  expect(await tasks(page, 'owed90')).toEqual([]);
});

test('GST not on the statement, electricity paid with no bill, and a supplier paid with no stock bill', async ({ page }) => {
  seq = 0;
  const m = ym(-3);
  const rows = [row(ym(-4) + '-01', 'SMS CHARGES', 1, 0), row(ym(-1) + '-10', 'BIJLI BIL JBVNL', 6000, 0),
    row(day(-20), 'NEFT-ACME CHEMICALS', 15000, 0, { cat: 'supplier' }), row(day(-1), 'SMS CHARGES', 10, 0)];
  await loadAppWithState(page, state({ bank: bank(rows), invoices: [inv(1, m + '-10', 11800)] }));
  expect(await tasks(page, 'gstNotInBank')).toMatchObject([{ key: 'gstNotInBank:' + m, tone: 'amber' }]);
  expect(await tasks(page, 'powerPaidNoBill')).toMatchObject([{ tone: 'info', title: 'Add the electricity bill the bank paid for ' + await ev(page, `billsMonthLabel('${ym(-2)}')`) }]);
  expect((await tasks(page, 'supplierNoBill'))[0].title).toContain('Enter the stock bill for');
  // A note on the month, the bill, and a stock bill from the supplier clear all three.
  await push(page, `bankData().gstNotes['${m}'] = { note: 'Paid through the CA', at: 1 }`);
  await push(page, `costBills().push({ id: 'CB1', kind: 'power', month: '${ym(-2)}', amount: 6000, at: 1 })`);
  await push(page, `stockData().entries.push({ id: 'SE1', itemId: 'X', kind: 'bill', date: '${day(-25)}', billDate: '${day(-25)}', qty: 1, price: 15000, amount: 15000, supplier: 'Acme Chemicals', at: 1 })`);
  expect(await tasks(page, 'gstNotInBank')).toEqual([]);
  expect(await tasks(page, 'powerPaidNoBill')).toEqual([]);
  expect(await tasks(page, 'supplierNoBill')).toEqual([]);
});

test('a salary leg that differs from the payroll as paid is raised; agreeing clears it', async ({ page }) => {
  seq = 0;
  const rows = [row(ym(-2) + '-01', 'SMS CHARGES', 1, 0), row(ym(-1) + '-14', 'NEFT-RAMU KUMAR', 12500, 0, { cat: 'wages', staffId: 7 }), row(day(-1), 'SMS CHARGES', 10, 0)];
  const slip = { id: 'PP1', month: ym(-2), status: 'paid', at: 1, rows: [{ name: 'RAMU KUMAR', paid: 12000, dayPay: 12000, ot: 0 }] };
  await loadAppWithState(page, state({ bank: bank(rows), payrollPaid: [slip] }));
  const t = await tasks(page, 'wageVsSlip');
  expect(t).toHaveLength(1);
  expect(t[0].sub).toContain('Ramu Kumar over ₹500.00');
  await push(page, `S.payrollPaid[0].rows[0].paid = 12500`);
  expect(await tasks(page, 'wageVsSlip')).toEqual([]);
});

test('the forecast crosses zero on a constructed case, raises runway, and says what it rests on', async ({ page }) => {
  seq = 0;
  // ₹50,000 in the bank; every closed month pays ₹90,000 of other costs and nothing is billed.
  const rows = [row(ym(-4) + '-01', 'NEFT-ALPHA FORGINGS', 0, 300000)];
  [-3, -2, -1].forEach(k => rows.push(row(ym(k) + '-05', 'NEFT-HARDWARE MART', 90000, 0, { cat: 'other' })));
  rows.push(row(day(-1), 'SMS CHARGES', 10, 0, undefined, 50000));
  await loadAppWithState(page, state({ bank: bank(rows) }));
  const fc = await ev(page, `(function() { var f = finForecast(60); return { cross: f.cross, start: f.start, n: f.days.length, rests: f.rests }; })()`) as any;
  expect(fc.start).toBe(50000);
  expect(fc.n).toBe(60);
  expect(fc.cross).not.toBeNull();
  expect(fc.rests.join(' ')).toContain('Suppliers and every other payment, ₹90,000.00 a month');
  expect(await tasks(page, 'runway')).toMatchObject([{ tone: 'red' }]);
  await switchTab(page, 'pageFinance');
  await expect(page.locator('#finForecast')).toContainText('What it rests on');
  await expect(page.locator('#finForecast .inv-callout-danger')).toContainText('goes below zero');
  // The task opens the forecast.
  await switchTab(page, 'pageHome');
  await ev(page, `todoGo(todoAppAll().find(function(t) { return t.rule === 'runway'; }).go)`);
  await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
});

test('each finance rule can be switched off in Settings', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-40), 'NEFT-ALPHA FORGINGS', 0, 5000)]), todoCheck: { bankStale: false } }));
  expect(await tasks(page, 'bankStale')).toEqual([]);
  expect(await ev(page, `TODO_RULES.filter(function(r) { return FIN_RULES.some(function(f) { return f[0] === r[0]; }); }).length`)).toBe(11);
});
