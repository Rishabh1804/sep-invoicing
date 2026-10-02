import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState, openPulse } from './fixtures';

// P126: the finance QA findings of 30 Sep 2026 (G2-2 … G2-11). The forecast says when it counts outflows only and when the
// account is already overdrawn; an exact receipt settles its invoices to the paisa; notes and receipts are read in the order
// they happened; electricity paid is asked for only inside the book; a month dropped for unsorted payees says so; a typed
// financial year is the series it names; a payment already made this month is not forecast again; whole rupees round half away
// from zero; an import can be taken out, with a reason. Names and figures are made up; dates are built from today, or from a
// day the page's clock is fixed on where the day of the month decides the case.

const JUL = path.join(__dirname, '..', 'fixtures', 'bank-jul.xls');          // 1–31 Jul 2026, 312 rows
const JUL_AUG = path.join(__dirname, '..', 'fixtures', 'bank-jul-aug.xls');  // 15 Jul – 31 Aug, overlaps it: 4 rows of its own

const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dayFrom = (base: string, n: number) => { const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const ymFrom = (base: string, k: number) => { const d = new Date(base.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + k); return isoOf(d).slice(0, 7); };
const monthEnd = (ym: string) => { const d = new Date(ym + '-01T00:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return isoOf(d); };
const day = (n: number) => dayFrom(todayIso(), n);
const ym = (k: number) => ymFrom(todayIso(), k);
/* A day of this month with the page's clock fixed on it: a case that turns on the day of the month (a salary's usual day
   still to come, the power rule asking from the 10th) means the same whenever the spec runs. */
async function fixToday(page: Page, dayOfMonth: number): Promise<string> {
  const n = new Date(), d = new Date(n.getFullYear(), n.getMonth(), dayOfMonth, 12, 0, 0);
  await page.clock.setFixedTime(d);
  return isoOf(d);
}

let seq = 0;
function row(date: string, narration: string, dr: number, cr: number, set?: any, balance = 100000) {
  const r: any = { id: 'BK-Q' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance, dayIdx: seq, importId: 'BI-Q' };
  // The fake remitter names nobody the matcher knows; a receipt from it is placed on client 1, as a payee rule would.
  if (set) r.set = set; else if (cr > 0 && /ALPHA/.test(narration)) r.set = { cat: 'receipt', clientId: 1 };
  return r;
}
function bank(rows: any[]) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.dayIdx - b.dayIdx);
  return { rows, imports: [{ id: 'BI-Q', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
    parties: {}, opening: {}, gstNotes: {} };
}
function inv(n: number, date: string, total: number, clientId = 1) {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'dispatched',
    clientId, clientName: 'ALPHA FORGINGS', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: taxable, amount: taxable }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
function note(n: number, date: string, against: string, total: number, kind = 'adjustment') {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'CN-' + n, cnNumber: String(n).padStart(3, '0'), displayNumber: 'CN/' + String(n).padStart(3, '0') + '/26-27', kind, date, clientId: 1, clientName: 'ALPHA FORGINGS',
    againstInvoice: against, invoiceNumbers: [against], taxableValue: taxable, cgstAmt: tax, sgstAmt: tax, igstAmt: 0, grandTotal: total, status: 'active', createdAt: recentTs() };
}
function state(extra: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [{ id: 1, name: 'ALPHA FORGINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [],
    add1: 'PLOT 1, ADITYAPUR', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' }];
  s.staff = [{ id: 7, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true }];
  return Object.assign(s, extra);
}
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const tasks = (page: Page, rule: string) => ev(page, `todoAppAll().filter(function(t) { return t.rule === '${rule}'; }).map(function(t) { return { key: t.key, tone: t.tone, title: t.title, sub: t.sub }; })`) as Promise<any[]>;
const push = (page: Page, js: string) => ev(page, `(function() { ${js}; })()`);
const finTab = (page: Page, t: string) => page.locator(`[data-action="invFinTab"][data-tab="${t}"]`).click();

/* ---------- G2-2: a forecast with nothing to learn when clients pay is outflows only, and says so ---------- */
test('G2-2: with no receipt placed on an invoice the forecast counts outflows only: runway is amber and every place says so', async ({ page }) => {
  seq = 0;
  // ₹50,000 in the bank; every closed month pays ₹90,000 of other costs. Three invoices are open, and three cheques came in
  // that nobody has placed, so no receipt was ever set against an invoice.
  const rows = [row(ym(-4) + '-01', 'SMS CHARGES', 1, 0)];
  [-3, -2, -1].forEach(k => rows.push(row(ym(k) + '-05', 'NEFT-HARDWARE MART', 90000, 0, { cat: 'other' })));
  rows.push(row(day(-30), 'BY INST 100001', 0, 23600), row(day(-20), 'BY INST 100002', 0, 23600), row(day(-12), 'BY INST 100003', 0, 23600));
  rows.push(row(day(-1), 'SMS CHARGES', 10, 0, undefined, 50000));
  await loadAppWithState(page, state({ bank: bank(rows), invoices: [inv(1, day(-35), 23600), inv(2, day(-25), 23600), inv(3, day(-15), 23600)] }));
  await openPulse(page);
  const fc = await ev(page, `(function() { var f = finForecast(45); return { cross: f.cross, noInflow: f.noInflow, rests: f.rests.join(' ') }; })()`) as any;
  expect(fc.cross).not.toBeNull();
  expect(fc.noInflow).toBeTruthy();
  expect(fc.noInflow.why).toContain('3 open invoices');
  expect(fc.rests).toMatch(/outflows only/i);
  // Never red on outflows alone: amber, saying why.
  const t = await tasks(page, 'runway');
  expect(t).toHaveLength(1);
  expect(t[0].tone).toBe('amber');
  expect(t[0].title).toMatch(/outflows only/i);
  // Home's Runway tile: a warning, with the words beside the figure.
  const tile = page.locator('#homeFin [data-home-fin="Runway"]');
  await expect(tile).toContainText('outflows only');
  await expect(tile).toHaveClass(/inv-tile-warning/);
  await expect(tile).not.toHaveClass(/inv-tile-danger/);
  // The Overview's forecast says it too, and nothing in it reads danger.
  await switchTab(page, 'pageFinance');
  await finTab(page, 'overview');
  await expect(page.locator('#finForecast .inv-callout-warning')).toContainText(/outflows only/i);
  await expect(page.locator('#finForecast .inv-callout-danger')).toHaveCount(0);
  await expect(page.locator('#finForecast .inv-tile-danger')).toHaveCount(0);
  // A cheque placed on the client pays an invoice: the forecast now knows when clients pay, and counts money in.
  await push(page, `bankData().rows.find(function(x) { return x.narration === 'BY INST 100001'; }).set = { cat: 'receipt', clientId: 1 }`);
  expect(await ev(page, `finForecast(45).noInflow`)).toBeNull();
});

/* ---------- G2-3: overdrawn already is said as overdrawn ---------- */
test('G2-3: an account overdrawn on the statement\'s last day is said to be overdrawn, not to go below zero tomorrow', async ({ page }) => {
  seq = 0;
  const rows = [row(ym(-4) + '-01', 'SMS CHARGES', 1, 0)];
  [-3, -2, -1].forEach(k => rows.push(row(ym(k) + '-05', 'NEFT-HARDWARE MART', 3000, 0, { cat: 'other' })));
  rows.push(row(day(-1), 'SMS CHARGES', 10, 0, undefined, -20000));
  await loadAppWithState(page, state({ bank: bank(rows) }));
  await openPulse(page);
  const fc = await ev(page, `(function() { var f = finForecast(45); return { cross: f.cross, overdrawn: f.overdrawn, start: f.start }; })()`);
  // Never a move from credit into overdraft: it starts there.
  expect(fc).toEqual({ cross: null, overdrawn: true, start: -20000 });
  const t = await tasks(page, 'runway');
  expect(t).toHaveLength(1);
  expect(t[0].tone).toBe('red');
  expect(t[0].title).toContain('overdrawn');
  expect(t[0].title).not.toContain('below zero on');
  const tile = page.locator('#homeFin [data-home-fin="Runway"]');
  await expect(tile).toContainText('overdrawn');
  await expect(tile).not.toContainText('below zero on');
  await switchTab(page, 'pageFinance');
  await finTab(page, 'overview');
  const callout = page.locator('#finForecast .inv-callout-danger');
  await expect(callout).toContainText('overdrawn');
  await expect(callout).not.toContainText('goes below zero');
});

/* ---------- G2-4: an exact receipt settles its invoices, the paise are rounding ---------- */
test('G2-4: a receipt matched exactly within the rupee settles its invoices, the paise go to rounding, and owed agrees with the open list', async ({ page }) => {
  seq = 0;
  // ₹1,180 paid with ₹1,179.40 (short 60 paise), ₹2,360 paid with ₹2,360.50 (over 50 paise): both exact.
  const rows = [row(day(-60), 'SMS CHARGES', 1, 0), row(day(-30), 'NEFT-ALPHA FORGINGS', 0, 1179.4), row(day(-10), 'NEFT-ALPHA FORGINGS', 0, 2360.5)];
  await loadAppWithState(page, state({ bank: bank(rows), invoices: [inv(1, day(-40), 1180), inv(2, day(-20), 2360)] }));
  const r = await ev(page, `(function() { var r = bankReceivables()[0], d = bankDaysToPay(1);
    return { owed: r.owed, rounding: r.rounding, open: r.open.length, onAccount: r.onAccount, how: r.allocs.map(function(a) { return a.how; }), median: d.median, exact: d.exactShare, n: d.n }; })()`);
  // Days to pay and the exact share are what they were: only what is owed moves, to nothing.
  expect(r).toEqual({ owed: 0, rounding: 0.1, open: 0, onAccount: 0, how: ['exact', 'exact'], median: 10, exact: 1, n: 2 });
  const bands = await ev(page, `finAgeing(bankReceivables()).reduce(function(s, b) { return s + b.amount; }, 0)`);
  expect(bands).toBe(0);
  await switchTab(page, 'pageFinance');
  await finTab(page, 'receipts');
  await expect(page.locator('[data-recv="1"] .inv-row-end')).toContainText('₹0.00');
});

/* ---------- G2-5: electricity paid, asked for only inside the book, once ---------- */
test('G2-5: electricity paid with no bill is asked for only in the book\'s months, and not for the month the power rule asks for', async ({ page }) => {
  const today = await fixToday(page, 20);
  const M = (k: number) => ymFrom(today, k);
  seq = 0;
  const lastMonth = row(M(-1) + '-15', 'BIJLI BIL JBVNL', 5300, 0);
  lastMonth.billMonth = M(-1);
  const rows = [row(M(-7) + '-01', 'SMS CHARGES', 1, 0),
    row(M(-5) + '-10', 'BIJLI BIL JBVNL', 5000, 0),    // pays M(-6): before the book starts
    row(M(-4) + '-10', 'BIJLI BIL JBVNL', 5100, 0),    // pays M(-5): before the book starts
    row(M(-2) + '-10', 'BIJLI BIL JBVNL', 5200, 0),    // pays M(-3): the book's first month
    lastMonth,                                          // pays last month, which the power rule asks for from the 10th
    row(dayFrom(today, -1), 'SMS CHARGES', 10, 0)];
  await loadAppWithState(page, state({ bank: bank(rows), invoices: [inv(1, M(-3) + '-10', 11800), inv(2, M(-1) + '-12', 5900)] }));
  expect((await tasks(page, 'power')).map(t => t.key)).toEqual(['power:' + M(-1)]);
  const t = await tasks(page, 'powerPaidNoBill');
  expect(t).toHaveLength(1);
  expect(t[0].title).toBe('Add the electricity bill the bank paid for ' + await ev(page, `billsMonthLabel('${M(-3)}')`));
  // With the power rule switched off, last month is this rule's to ask for.
  await push(page, `S.todoCheck = Object.assign({}, S.todoCheck || {}, { power: false })`);
  expect(await tasks(page, 'power')).toEqual([]);
  const t2 = await tasks(page, 'powerPaidNoBill');
  expect(t2).toHaveLength(1);
  expect(t2[0].title).toBe('Add 2 electricity bills the bank paid for');
});

/* ---------- G2-6: a month dropped for unsorted payees says so ---------- */
test('G2-6: months the statement cannot speak for because payees are unsorted say so, in Recorded against paid and in Derive', async ({ page }) => {
  seq = 0;
  const rows = [row(ym(-7) + '-01', 'NEFT-UTR0-ALPHA FORGINGS', 0, 50000)];
  const invoices: any[] = [];
  for (let k = -6; k <= -1; k++) {
    rows.push(row(ym(k) + '-12', 'NEFT-UTRX-OMEGA SUPPLY', 250000, 0));   // nothing recognises the payee: unsorted
    invoices.push(inv(20 + k, ym(k) + '-15', 5900));
  }
  rows.push(row(day(-1), 'SMS CHARGES', 10, 0));
  await loadAppWithState(page, state({ bank: bank(rows), invoices }));
  const chk = await ev(page, `liveCostPaidCheck('${ym(-3)}-01', '${monthEnd(ym(-1))}').map(function(r) { return [r.key, r.note]; })`) as any[];
  const other = chk.find(r => r[0] === 'other')[1], sup = chk.find(r => r[0] === 'supplies')[1];
  expect(other).toContain('payees not yet sorted');
  expect(other).toContain('Finance → Payments → Not yet sorted');
  expect(other).not.toContain('nothing paid on the statement');
  expect(sup).toContain('payees not yet sorted');
  expect(sup).not.toContain('no supplier payment');
  const html = await ev(page, `_costDerivedHtml(costDeriveCompute(['other']))`) as string;
  expect(html).not.toContain('No month the statement covers has tonnage beside it');
  expect(html).toContain('Nothing to offer: payees not yet sorted (Finance → Payments → Not yet sorted)');
});

/* ---------- G2-7: notes and receipts in the order they happened ---------- */
test('G2-7: a credit note dated after the receipt that paid its invoice is credit to the client, and the receipt stays exact', async ({ page }) => {
  const read = () => ev(page, `(function() { var r = bankReceivables()[0]; return { owed: r.owed, onAccount: r.onAccount, noteCredit: r.noteCredit, open: r.open.length,
    how: r.allocs.map(function(a) { return a.how; }), unapplied: r.allocs.map(function(a) { return a.unapplied; }) }; })()`);
  // T/00001 paid to the rupee; a ₹118 note against it ten days later; T/00002 raised after that, paid net of the note.
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-60), 'SMS CHARGES', 1, 0), row(day(-30), 'NEFT-ALPHA FORGINGS', 0, 1180), row(day(-5), 'NEFT-ALPHA FORGINGS', 0, 2242)]),
    invoices: [inv(1, day(-40), 1180), inv(2, day(-15), 2360)], creditNotes: [note(1, day(-20), 'T/00001', 118)] }));
  expect(await read()).toEqual({ owed: 0, onAccount: 0, noteCredit: 0, open: 0, how: ['exact', 'exact'], unapplied: [0, 0] });
  expect(await ev(page, `bankDaysToPay(1).exactShare`)).toBe(1);

  // With nothing raised after it, the note's credit is on account: the client is paid ahead by it, and the screen says why.
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-60), 'SMS CHARGES', 1, 0), row(day(-30), 'NEFT-ALPHA FORGINGS', 0, 1180)]),
    invoices: [inv(1, day(-40), 1180)], creditNotes: [note(1, day(-20), 'T/00001', 118)] }));
  expect(await read()).toEqual({ owed: -118, onAccount: 118, noteCredit: 118, open: 0, how: ['exact'], unapplied: [0] });
  await switchTab(page, 'pageFinance');
  await finTab(page, 'receipts');
  await page.locator('[data-recv="1"] [data-action="invBankClient"]').click();
  await expect(page.locator('[data-alloc]').first()).toContainText('Exact');
  await expect(page.locator('[data-alloc]').first()).not.toContainText('more than was open');
  await expect(page.locator('[data-note-credit]')).toContainText('₹118.00 of credit notes');

  // A batch rebate raised before its net payment keeps the payment exact, as before.
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-60), 'SMS CHARGES', 1, 0), row(day(-10), 'NEFT-ALPHA FORGINGS', 0, 3469.2)]),
    invoices: [inv(1, day(-40), 1180), inv(2, day(-30), 2360)], creditNotes: [note(2, day(-20), 'T/00002', 70.8, 'rebate')] }));
  expect(await read()).toEqual({ owed: 0, onAccount: 0, noteCredit: 0, open: 0, how: ['exact'], unapplied: [0] });
});

/* ---------- G2-8: a financial year typed any way is the series it names ---------- */
test('G2-8: a recorded note\'s year typed as 2026-2027 or 26/27 is the 26-27 series, and a note stored as 2026-27 counts in it', async ({ page }) => {
  const s = state({ invPrefix: 'SEP/2026-27/' });
  // A note recorded before this, its year kept as it was typed.
  s.creditNotes = [{ ...note(12, day(-5), 'X-1', 118), displayNumber: 'CN/012/2026-27', recorded: true }];
  await loadAppWithState(page, s);
  expect(await ev(page, 'cnSeriesHighest()')).toBe(12);
  await switchTab(page, 'pageFinance');
  await finTab(page, 'bills');
  const record = async (num: string, fy: string) => {
    if (!(await page.locator('#cnfNum').count())) await page.locator('[data-action="invCnFormOpen"][data-mode="record"]').click();
    await page.locator('#cnfNum').fill(num);
    await page.locator('#cnfFy').fill(fy);
    await page.locator('#cnfClient').selectOption('1');
    await page.locator('#cnfInv').selectOption('__typed');
    await page.locator('#cnfInvNo').fill('000100');
    await page.locator('#cnfTaxable').fill('100');
    await page.locator('[data-action="invCnFormSave"]').click();
  };
  await record('12', '26/27');
  await expect(page.locator('.inv-toast').last()).toContainText('CN/012/26-27 is already in the series');
  await record('13', '2026-2027');
  await expect(page.locator('.inv-toast').last()).toContainText('CN/013/26-27 recorded');
  const st = await readStoredState(page);
  expect(st.creditNotes.map((n: any) => n.displayNumber)).toEqual(['CN/012/2026-27', 'CN/013/26-27']);
  expect(st.cnNextNum).toBe(14);
  expect(await ev(page, `['2026-27', '2026-2027', '26-27', '26/27', '2026/27', ' 26 - 27 '].map(billsCnFy)`)).toEqual(['26-27', '26-27', '26-27', '26-27', '26-27', '26-27']);
});

/* ---------- G2-9: a payment already made this month is not forecast again ---------- */
test('G2-9: a salary run or an electricity bill already paid this month is not forecast again on its usual day', async ({ page }) => {
  // The 10th: the usual days (the 12th for electricity, the 14th for salaries) are still to come this month.
  const today = await fixToday(page, 10);
  const M = (k: number) => ymFrom(today, k), cur = today.slice(0, 7);
  seq = 0;
  const rows = [row(M(-4) + '-01', 'SMS CHARGES', 1, 0)];
  [-3, -2, -1].forEach(k => rows.push(row(M(k) + '-12', 'BIJLI BIL JBVNL', 6000, 0), row(M(k) + '-14', 'NEFT-RAMU KUMAR', 12000, 0, { cat: 'wages', staffId: 7 })));
  // This month's, both paid early: on the 8th and the 9th.
  rows.push(row(cur + '-08', 'NEFT-RAMU KUMAR', 12000, 0, { cat: 'wages', staffId: 7 }), row(cur + '-09', 'BIJLI BIL JBVNL', 6000, 0, undefined, 500000));
  await loadAppWithState(page, state({ bank: bank(rows) }));
  const out = await ev(page, `(function() { var f = finForecast(60), at = function(d) { var x = f.days.find(function(e) { return e.date === d; }); return x ? x.out : null; };
    return { power: at('${cur}-12'), wages: at('${cur}-14'), nextPower: at('${M(1)}-12'), nextWages: at('${M(1)}-14') }; })()`);
  expect(out).toEqual({ power: 0, wages: 0, nextPower: 6000, nextWages: 12000 });
});

/* ---------- G2-10: whole rupees and a bill's price, rounded on the figure as written ---------- */
test('G2-10: whole rupees round half away from zero, and a bill\'s price is rounded on the figure as typed', async ({ page }) => {
  await loadAppWithState(page, state({ stock: { items: [{ id: 'SI1', name: 'Nitric Acid', key: 'NITRICACID', aliases: [], unit: 'kg', basis: 'draw' }], entries: [], pastes: [] } }));
  expect(await ev(page, `[finRs(1234.5), finRs(-1234.5), finRs(-0.5), finRs(-0.4), finRs(-1234.49), finRs(99999.5)]`))
    .toEqual(['₹1,235', '-₹1,235', '-₹1', '₹0', '-₹1,234', '₹1,00,000']);
  // 12.00035 × 10000 is 120003.49999… on the binary copy, which Math.round took down to 12.0003; the figure as typed is 12.0004.
  await push(page, `_stockBill = { itemId: 'SI1', entryId: '', date: '${todayIso()}', supplier: 'Acme Chemicals', billNo: 'B-1', qty: '10', price: '12.00035', amount: '' }; stockBillSave()`);
  expect(await ev(page, `(function() { var e = stockData().entries.find(function(x) { return x.kind === 'bill'; }); return [e.price, e.amount]; })()`)).toEqual([12.0004, 120]);
});

/* ---------- G2-11: an import can be taken out; another account's statement asks as a danger ---------- */
async function importXls(page: Page, file: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invBankImport"]').click()]);
  const before = await page.evaluate(() => ((window as any).bankData().imports || []).length);
  await chooser.setFiles(file);
  await page.waitForFunction(n => (window as any).bankData().imports.length > n, before);
}

test('G2-11: a statement for another account asks as a danger, naming the act, and Cancel leaves the record alone', async ({ page }) => {
  await loadAppWithState(page, state({ bank: { rows: [], imports: [], parties: {}, opening: {}, gstNotes: {}, account: '002XXXXXXXX111' } }));
  await switchTab(page, 'pageFinance');
  await finTab(page, 'bank');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="invBankImport"]').click()]);
  await chooser.setFiles(JUL);
  const ask = page.locator('[data-ui-ask]').last();
  await expect(ask).toContainText('001XXXXXXXX999');
  await expect(ask.locator('[data-ans="ok"]')).toHaveClass(/inv-btn-danger/);
  await expect(ask.locator('[data-ans="ok"]')).toHaveText('Import into the same record');
  // Focus starts on Cancel before a destructive act.
  await expect(ask.locator('[data-ans="cancel"]')).toBeFocused();
  await answerAsk(page, 'cancel');
  expect(await ev(page, 'bankData().rows.length')).toBe(0);
});

test('G2-11: an import is taken out with a reason: only the rows it added go, its record stays, and the export carries it', async ({ page }) => {
  await loadAppWithState(page, state());
  await switchTab(page, 'pageFinance');
  await finTab(page, 'bank');
  await importXls(page, JUL);
  await importXls(page, JUL_AUG);
  expect(await ev(page, 'bankData().rows.length')).toBe(316);
  const aug = await ev(page, 'bankData().imports[1].id') as string;
  // A returned cheque's link that names one of its rows goes with it.
  await push(page, `var id = bankData().rows.find(function(r) { return r.importId === '${aug}'; }).id; bankData().bounces['BK-REV'] = id; saveState(); renderFinance()`);
  const imp = page.locator(`#bankImports [data-bank-import="${aug}"]`);
  await expect(imp).toContainText('bank-jul-aug.xls');
  await expect(imp).toContainText('4 added');
  // Cancel leaves everything as it was.
  await imp.locator('[data-action="invBankImportRemove"]').click();
  await answerAsk(page, 'cancel');
  expect(await ev(page, 'bankData().rows.length')).toBe(316);
  await imp.locator('[data-action="invBankImportRemove"]').click();
  const ask = page.locator('[data-ui-ask]').last();
  await expect(ask.locator('[data-ans="ok"]')).toHaveClass(/inv-btn-danger/);
  expect(await answerAsk(page, 'ok')).toContain('4 rows');
  await answerAsk(page, 'ok', 'Wrong statement');
  // The rows it re-read from the July statement stay: only its own four go.
  await expect(page.locator('#bankHead')).toContainText('312 rows');
  const b = (await readStoredState(page)).bank;
  expect(b.rows).toHaveLength(312);
  expect(b.rows.some((r: any) => r.importId === aug)).toBe(false);
  expect(b.imports).toHaveLength(2);
  expect(b.imports[1]).toMatchObject({ id: aug, removeReason: 'Wrong statement', rowsRemoved: 4 });
  expect(b.imports[1].removedAt).toBeGreaterThan(0);
  expect(b.imports[1].removedIds).toHaveLength(4);
  expect(b.bounces['BK-REV']).toBeUndefined();
  await expect(imp).toContainText('Removed');
  await expect(imp).toContainText('Wrong statement');
  await expect(imp.locator('[data-action="invBankImportRemove"]')).toHaveCount(0);
  // The record for soma-internal's compile carries the removal, so it drops the same rows.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="invBankExportJson"]').click()]);
  const json = JSON.parse(fs.readFileSync(await dl.path() as string, 'utf8'));
  expect(json.rows).toHaveLength(312);
  expect(json.imports[1]).toMatchObject({ id: aug, removeReason: 'Wrong statement', rowsRemoved: 4 });
  expect(json.imports[1].removedIds).toEqual(b.imports[1].removedIds);
});
