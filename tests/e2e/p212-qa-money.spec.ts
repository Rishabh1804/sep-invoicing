import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openPulse, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';
import { PINS, withUsers, unlock, windowGone } from './p140-guard.fixture';

// P212: the QA chain's money findings (before PR 146 merges). Cheques in hand: "not this deposit" keeps that row apart and the
// number goes on, a stored null is taken back, a cheque typed in late finds its deposit, a post-dated cheque waits for its date,
// one cheque recorded twice counts once, a one-row statement places its deposit, a cheque from before receivables start is not
// read. What is owed: one tone wherever it is drawn (the invoice's own line, the age bar, nothing past 60 days). The finance
// rules: owed90 asks nothing with no statement. Bills: a bill typed by hand is a Finance edit, and its door is drawn only for a role
// that opens Money. Suppliers and stock: zinc at an empty shelf is not "out", a balance set again on its day keeps its marks, a
// payee sorted as Supplier joins the supplier it is, "&" and BROS fold both ways, a stock file keeps the prices quoted and finds a
// supplier by its name, two records of one supplier fold into one, the reorder's cash with each supplier's own GST. Names and
// figures are made up; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

let seq = 0;
/* A statement row; one a test names back carries its own id. */
function row(date: string, narration: string, dr: number, cr: number, set?: any, id?: string, chq = '') {
  const r: any = { id: id || 'BK-Q' + (++seq), date, valueDate: date, narration, chq, dr, cr, balance: 500000, dayIdx: 100 + (++seq), importId: 'BI-Q' };
  if (set) r.set = set;
  return r;
}
function bank(rows: any[], extra: any = {}) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.dayIdx - b.dayIdx);
  return Object.assign({ rows, imports: rows.length ? [{ id: 'BI-Q', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }] : [],
    parties: {}, opening: {}, gstNotes: {}, bounces: {}, cheques: [] }, extra);
}
function inv(n: number, date: string, total: number, clientId = 1) {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + String(n).padStart(5, '0'), date, status: 'active', invoiceState: 'dispatched',
    clientId, clientName: clientId === 1 ? 'ALPHA FORGINGS' : 'BETA PRESSINGS', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 1, rate: taxable, amount: taxable }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
const chq = (id: string, number: string, amount: number, receivedOn: string, extra: any = {}) =>
  Object.assign({ id, clientId: 1, amount, number, chequeDate: null, drawnOn: null, receivedOn, note: null, at: 1, by: null }, extra);
function state(extra: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [1, 2].map(id => ({ id, name: id === 1 ? 'ALPHA FORGINGS' : 'BETA PRESSINGS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true,
    rates: [], itemRates: [], add1: 'PLOT ' + id + ', ADITYAPUR', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20', mobile: '' }));
  return Object.assign(s, extra);
}
const owed = (page: Page, clientId = 1) => ev(page, `(function() { var r = bankReceivables().find(function(x) { return x.client.id === ${clientId}; }); return r ? r.owed : null; })()`) as Promise<number>;
const links = (page: Page) => ev(page, `bankChequeLinks().map(function(o) { return { id: o.ch.id, status: o.status, how: o.how, dep: o.dep ? o.dep.row.id : null, days: o.days, ahead: o.ahead }; })`) as Promise<any[]>;
async function openReceivables(page: Page) {
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="receipts"]').click();
  await expect(page.locator('#bankRecvVerdict')).toBeVisible();
}
async function openCheque(page: Page, id: string) {
  await openReceivables(page);
  await page.locator(`[data-action="invChequeOpen"][data-id="${id}"]`).first().click();
  await expect(page.locator(`[data-cheque-dialog="${id}"]`)).toBeVisible();
}

test.describe('P212: cheques received', () => {
  test('A3-1: Not this deposit keeps that row apart and the number goes on to the next credit naming it; a deposit placed by hand is never counted beside the cheque', async ({ page }) => {
    seq = 0;
    // BK-X names the cheque's number but is another firm's cheque; BK-R is its own deposit, placed on the client by hand.
    const rows = [row(day(-40), 'SMS CHARGES', 1, 0), row(day(-9), 'BY INST 525428 - MICR CLG', 0, 7000, undefined, 'BK-X'),
      row(day(-5), 'BY INST 525428 - MICR CLG', 0, 7000, { cat: 'receipt', clientId: 1 }, 'BK-R'), row(day(-1), 'SMS CHARGES', 1, 0)];
    await loadAppWithState(page, state({ invoices: [inv(1, day(-20), 7000)], bank: bank(rows, { cheques: [chq('CHQ-1', '525428', 7000, day(-10))] }) }));
    expect(await links(page)).toEqual([expect.objectContaining({ id: 'CHQ-1', status: 'deposited', how: 'number', dep: 'BK-X' })]);
    await openCheque(page, 'CHQ-1');
    await page.locator('[data-cheque-dialog] [data-action="invChequeNotThis"]').click();
    // The number finds the next credit naming it: in the bank once, and the client owes nothing (it read −₹7,000: both counted).
    expect((await links(page))[0]).toMatchObject({ status: 'deposited', how: 'number', dep: 'BK-R' });
    expect(await owed(page)).toBe(0);
    const c = (await readStoredState(page)).bank.cheques[0];
    expect(c.notDeposits).toEqual(['BK-X']);
    expect('deposit' in c).toBe(false);
  });

  test('A3-1: a "not this" an older build stored as null is taken back with Match by number again', async ({ page }) => {
    seq = 0;
    const rows = [row(day(-40), 'SMS CHARGES', 1, 0), row(day(-4), 'BY INST 888001', 0, 7000, undefined, 'BK-N'), row(day(-1), 'SMS CHARGES', 1, 0)];
    await loadAppWithState(page, state({ invoices: [inv(1, day(-20), 7000)], bank: bank(rows, { cheques: [chq('CHQ-N', '888001', 7000, day(-6), { deposit: null })] }) }));
    expect((await links(page))[0]).toMatchObject({ status: 'held', dep: null });
    await openCheque(page, 'CHQ-N');
    const again = page.locator('[data-cheque-dialog] [data-action="invChequeRematch"]');
    await expect(again).toHaveText('Match by number again');
    await again.click();
    expect((await links(page))[0]).toMatchObject({ status: 'deposited', how: 'number', dep: 'BK-N' });
    expect('deposit' in (await readStoredState(page)).bank.cheques[0]).toBe(false);
  });

  test('A3-1: a cheque typed in days after it went in finds the deposit before the day typed', async ({ page }) => {
    seq = 0;
    const rows = [row(day(-40), 'SMS CHARGES', 1, 0), row(day(-8), 'BY INST 777002 - MICR CLG', 0, 9000, undefined, 'BK-L'), row(day(-1), 'SMS CHARGES', 1, 0)];
    await loadAppWithState(page, state({ invoices: [inv(1, day(-20), 9000)], bank: bank(rows, { cheques: [chq('CHQ-L', '777002', 9000, day(-2))] }) }));
    expect((await links(page))[0]).toMatchObject({ status: 'deposited', how: 'number', dep: 'BK-L' });
    // Paid once, by the deposit placed on the cheque's client.
    expect(await owed(page)).toBe(0);
    expect(await ev(page, `bankLooseReceipts(bankClassify()).length`)).toBe(0);
  });

  test('A3-3: a post-dated cheque waits for its date: no days in hand, no task, its window from its date', async ({ page }) => {
    seq = 0;
    const rows = [row(day(-80), 'SMS CHARGES', 1, 0), row(day(-3), 'BY INST 300002 - MICR CLG', 0, 4000, undefined, 'BK-PD'), row(day(-1), 'SMS CHARGES', 1, 0)];
    await loadAppWithState(page, state({ invoices: [inv(1, day(-20), 9000)], bank: bank(rows, { cheques: [
      chq('CHQ-P', '300001', 5000, day(-9), { chequeDate: day(20) }),
      // Received seventy days back, dated for five days back: deposited on the third day after its date.
      chq('CHQ-Q', '300002', 4000, day(-70), { chequeDate: day(-5) })] }) }));
    const L = await links(page);
    expect(L.find(x => x.id === 'CHQ-P')).toMatchObject({ status: 'held', days: 0, ahead: true });
    expect(L.find(x => x.id === 'CHQ-Q')).toMatchObject({ status: 'deposited', how: 'number', dep: 'BK-PD' });
    // Nothing asks to deposit a cheque that cannot go in yet (it was red: "In hand · 9 days").
    expect(await ev(page, `TODO_RULE_FNS.chequeHeld().map(function(t) { return t.key; })`)).toEqual([]);
    await openReceivables(page);
    const dot = page.locator('[data-cheque="CHQ-P"] .inv-dot');
    await expect(dot).toHaveText('Dated ' + await ev(page, `stockShortDate('${day(20)}')`));
    await expect(dot).toHaveClass(/inv-dot-info/);
    await expect(page.locator('[data-cheques-held="1"]')).toContainText('post-dated');
  });

  test('A3-5: the same client’s cheque recorded twice counts once and says so; a file’s copy under another id is kept out', async ({ page }) => {
    seq = 0;
    const rows = [row(day(-40), 'SMS CHARGES', 1, 0), row(day(-3), 'BY INST 525428 - MICR CLG', 0, 7000, undefined, 'BK-D'), row(day(-1), 'SMS CHARGES', 1, 0)];
    await loadAppWithState(page, state({ invoices: [inv(1, day(-20), 7000)], bank: bank(rows, { cheques: [
      chq('CHQ-A', '525428', 7000, day(-6)), chq('CHQ-B', '0525428', 7000, day(-5))] }) }));
    const L = await links(page);
    expect(L.find(x => x.id === 'CHQ-A')).toMatchObject({ status: 'deposited', dep: 'BK-D' });
    expect(L.find(x => x.id === 'CHQ-B')).toMatchObject({ status: 'twin', dep: null });
    // Paid once (the second record read as a cheque still in hand: −₹7,000).
    expect(await owed(page)).toBe(0);
    expect(await ev(page, `bankChequesHeld().n`)).toBe(0);
    await openReceivables(page);
    await expect(page.locator('[data-cheque="CHQ-B"] .inv-dot')).toHaveText('Recorded twice');
    await page.locator('[data-action="invChequeOpen"][data-id="CHQ-B"]').first().click();
    await expect(page.locator('[data-cheque-dialog="CHQ-B"]')).toContainText('Recorded twice');
    // Voided, the second record leaves what is owed as it was, and says so.
    await page.locator('[data-cheque-dialog="CHQ-B"] [data-action="invChequeVoid"]').click();
    expect(await answerAsk(page, 'ok', 'Typed on the office computer too')).toContain('the one recorded first still counts');
    await expect(page.locator('.inv-toast').last()).toContainText('the one recorded first still counts');
    expect(await owed(page)).toBe(0);
    // A sep-bank file carrying the same cheque under its own id: kept out, as one already held.
    await ev(page, `bankChequesImport({ format: 'sep-bank', cheques: [${JSON.stringify(chq('CHQ-C', '525428', 7000, day(-2)))}] }, 'sep-bank.json')`);
    expect(await answerAsk(page, 'ok')).toContain('1 already held');
    expect((await readStoredState(page)).bank.cheques.map((c: any) => c.id)).toEqual(['CHQ-A', 'CHQ-B']);
  });

  test('A3-12: a statement of one row places its cheque’s deposit on the client', async ({ page }) => {
    seq = 0;
    await loadAppWithState(page, state({ invoices: [inv(1, day(-20), 7000)],
      bank: bank([row(day(-3), 'BY INST 525428 - MICR CLG', 0, 7000, undefined, 'BK-1')], { cheques: [chq('CHQ-1', '525428', 7000, day(-5))] }) }));
    expect(await ev(page, `(function() { var v = bankClassify()[0]; return [v.cat, v.clientId, v.cheque]; })()`)).toEqual(['receipt', 1, 'CHQ-1']);
    expect(await ev(page, `bankLooseReceipts(bankClassify()).length`)).toBe(0);
  });

  test('A3-13: a cheque in hand from before receivables start is not read, as no receipt from before it is', async ({ page }) => {
    seq = 0;
    // Receivables start on the first invoice, fifteen days back; the cheque came thirty days back, for work before the book.
    await loadAppWithState(page, state({ invoices: [inv(1, day(-15), 7000)],
      bank: bank([row(day(-20), 'SMS CHARGES', 1, 0), row(day(-1), 'SMS CHARGES', 1, 0)], { cheques: [chq('CHQ-OLD', '400001', 7000, day(-30))] }) }));
    expect(await ev(page, `bankRecvFrom()`)).toBe(day(-15));
    expect(await owed(page)).toBe(7000);
    // Still a cheque in hand: the panel and the task say so.
    expect(await ev(page, `bankChequesHeld().n`)).toBe(1);
  });
});

/* Two invoices 100 and 95 days old, nothing paid; `loose` adds a receipt nobody placed. */
function owedBook(loose: boolean, ages = [100, 95]): SepState {
  seq = 0;
  const rows = [row(day(-120), 'SMS CHARGES', 1, 0), row(day(-1), 'SMS CHARGES', 1, 0)];
  if (loose) rows.push(row(day(-5), 'NEFT-UTR7-UNKNOWN PARTY', 0, 5000));
  return state({ clients: [state().clients[0]], invoices: [inv(1, day(-ages[0]), 23600), inv(2, day(-ages[1]), 11800)], bank: bank(rows) });
}

test.describe('P212: what is owed, one tone wherever it is drawn', () => {
  test('A3-10: an invoice’s own "Open, N days" is never red while a receipt is unplaced', async ({ page }) => {
    await loadAppWithState(page, owedBook(true));
    const html = await ev(page, `finInvoicePaymentHtml(S.invoices.find(function(i) { return i.id === 'INV-1'; }))`) as string;
    expect(html).toContain('inv-dot-warning">Open, 100 days');
    expect(html).not.toContain('inv-dot-danger');
    await loadAppWithState(page, owedBook(false));
    expect(await ev(page, `finInvoicePaymentHtml(S.invoices.find(function(i) { return i.id === 'INV-1'; }))`)).toContain('inv-dot-danger">Open, 100 days');
  });

  test('A3-10: the age bar’s over-90 band is a warning while a receipt is unplaced, on Money and on Pulse', async ({ page }) => {
    await loadAppWithState(page, owedBook(true));
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="overview"]').click();
    const bar = page.locator('#finOwed svg.inv-meter');
    await expect(bar.locator('rect.inv-meter-warning')).toHaveCount(1);
    await expect(bar.locator('rect.inv-meter-danger')).toHaveCount(0);
    await openPulse(page);
    await expect(page.locator('#homeFin svg.inv-meter rect.inv-meter-warning')).toHaveCount(1);
    await expect(page.locator('#homeFin svg.inv-meter rect.inv-meter-danger')).toHaveCount(0);
    // The cash question draws the same bar.
    const cash = await ev(page, `statsStoryCards(statsPulseArgs('month')).cash.vital.viz`) as string;
    expect(cash).toContain('inv-meter-warning');
    expect(cash).not.toContain('inv-meter-danger');
    // With nothing unplaced it is danger, as the figure is.
    await loadAppWithState(page, owedBook(false));
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="overview"]').click();
    await expect(page.locator('#finOwed svg.inv-meter rect.inv-meter-danger')).toHaveCount(1);
  });

  test('A7-16: owed with nothing past 60 days is ok on Money, Pulse and Pipeline alike', async ({ page }) => {
    await loadAppWithState(page, owedBook(false, [20, 10]));
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="overview"]').click();
    await expect(page.locator('#finOwed')).toHaveClass(/inv-hero-ok/);
    await openPulse(page);
    await expect(page.locator('#homeFin [data-home-fin="Owed to us"]')).toHaveClass(/inv-tile-ok/);
    await switchTab(page, 'pagePipeline');
    await expect(page.locator('[data-pipe-stage="owed"]')).toHaveClass(/inv-tile-ok/);
  });

  test('A3-14: with no statement nothing says what was paid, and owed90 asks nothing', async ({ page }) => {
    await loadAppWithState(page, state({ invoices: [inv(1, day(-100), 23600), inv(2, day(-80), 11800, 2)] }));
    expect(await ev(page, `bankRows().length`)).toBe(0);
    expect(await ev(page, `TODO_RULE_FNS.owed90()`)).toEqual([]);
  });
});

test.describe('P212: bills, and their doors', () => {
  test('A3-11: a bill typed on Payments is a Finance edit: past the window the PIN is asked before it is saved', async ({ page }) => {
    await loadAppWithState(page, state());
    await withUsers(page);
    await unlock(page, 'U-own', PINS.owner);
    await windowGone(page);
    await switchTab(page, 'pageFinance');
    await page.locator('[data-action="invFinTab"][data-tab="payments"]').click();
    await page.locator('[data-bank-toolbar="payments"] [data-action="invCostBillOpen"]').click();
    await page.locator('#pageFinance #costBillAmount').fill('4321');
    await page.locator('#pageFinance [data-action="invCostBillSave"]').click();
    const ask = page.locator('[data-grd-ask]');
    await expect(ask).toBeVisible();
    expect((await readStoredState(page)).costBills || []).toEqual([]);
    await ask.locator('#grdAskPin').fill(PINS.owner);
    await ask.locator('[data-action="invGuardAskOk"]').click();
    await expect.poll(async () => ((await readStoredState(page)).costBills || []).map((b: any) => b.amount)).toEqual([4321]);
  });

  test('A5-19: Add a bill is drawn on Power and Live cost only for a role that opens Money', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pagePower');
    await page.locator('#pagePower .inv-viewtab[data-tab="load"]').click();
    await expect(page.locator('#powerBills [data-action="invPowerBillsGo"]')).toHaveCount(1);
    expect(await ev(page, `_costBillHtml()`)).toContain('invCostBillGo');
    // The supervisor opens Power and not Money: the door would only refuse.
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await switchTab(page, 'pagePower');
    await page.locator('#pagePower .inv-viewtab[data-tab="load"]').click();
    await expect(page.locator('#powerBills')).toBeVisible();
    await expect(page.locator('#powerBills [data-action="invPowerBillsGo"]')).toHaveCount(0);
    const live = await ev(page, `_costBillHtml()`) as string;
    expect(live).not.toContain('invCostBillGo');
    expect(live).toContain('Bills are entered in Money');
  });
});

const bill = (id: string, itemId: string, date: string, qty: number, price: number, supplier: string, billNo: string, kind = 'bill') =>
  ({ id, itemId, kind, qty, price, amount: Math.round(qty * price * 100) / 100, date, billDate: date, supplier, billNo, at: 1 });
function stockBook(extra: any = {}): SepState {
  seq = 0;
  const s: any = state();
  s.stock = { items: [{ id: 'B', name: 'Brightener K', key: 'BRIGHTENER K', unit: 'L', basis: 'draw', aliases: [] }],
    entries: [{ id: 'c1', itemId: 'B', kind: 'count', qty: 120, date: day(-10), at: 1, seq: 3 },
      { id: 'u1', itemId: 'B', kind: 'used', qty: 50, days: 10, from: day(-10), date: day(-1), at: 2, seq: 2 }], pastes: [] };
  return Object.assign(s, extra);
}
async function openSupplier(page: Page, name: string) {
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="payments"]').click();
  const d = page.locator('.inv-page-active details[data-fold="pay-suppliers"]').first();
  await d.waitFor({ state: 'attached' });
  if (!(await d.evaluate(el => (el as HTMLDetailsElement).open))) await d.locator(':scope > summary').click();
  await page.locator('#bankSuppliers [data-supplier]').filter({ hasText: name }).locator('[data-action="invSuppOpen"]').click();
  await expect(page.locator('[data-supp-dialog]')).toBeVisible();
}

test.describe('P212: suppliers and stock', () => {
  test('A3-4: zinc at an empty shelf is not "out": no order-now, no danger, its bath said', async ({ page }) => {
    const s: any = stockBook();
    s.stock.items.push({ id: 'Z', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', aliases: [] });
    s.stock.entries.push(bill('z1', 'Z', day(-6), 100, 300, 'Sigma Metals', 'S/1', 'received'),
      { id: 'z2', itemId: 'Z', kind: 'charged', qty: 100, date: day(-2), at: 3, seq: 4 });
    s.suppliers = [{ id: 'SUP-s', name: 'Sigma Metals', names: [], leadMin: 2, leadMax: 2, at: 1 }];
    await loadAppWithState(page, s);
    expect(await ev(page, `[stockStatus(stockItem('Z')).group, stockStatus(stockItem('Z')).level]`)).toEqual(['bath', 0]);
    // The line's "Order from" (it read "order now: it is out"): the delivery goes into the bath as it comes.
    const line = await ev(page, `suppPickLine(suppReorderPick(stockItem('Z'), suppDaysLeft(stockItem('Z'))))`) as string;
    expect(line).toContain('Sigma Metals');
    expect(line).not.toContain('order now');
    expect(await ev(page, `suppDaysLeft(stockItem('Z'))`)).toBeNull();
    expect(await ev(page, `suppCompare(stockItem('Z')).cands.map(function(c) { return c.tone; })`)).not.toContain('danger');
    await ev(page, `suppCompareOpen('Z', '')`);
    await expect(page.locator('[data-supp-compare="Z"] [data-supp-cmp-ctx]')).toContainText('it goes into the bath as it comes');
  });

  test('A3-6: a balance set again on its own day keeps the payments marked as in their balance; a new day drops them', async ({ page }) => {
    const s: any = stockBook();
    s.stock.entries.push(bill('k1', 'B', day(-40), 30, 200, 'Kappa & Brothers', 'K/1'));
    const rows = [row(day(-45), 'SMS CHARGES', 1, 0), row(day(-33), 'KAPPA AND BROTHERS-MICR INWARD CLG (CTS)', 2000, 0, undefined, 'BK-K', '000700'), row(day(-1), 'SMS CHARGES', 1, 0)];
    s.bank = bank(rows);
    s.suppliers = [{ id: 'SUP-k', name: 'Kappa & Brothers', names: [], opening: { amount: 10000, date: day(-35) }, inOpening: ['BK-K'], at: 1 }];
    await loadAppWithState(page, s);
    await openSupplier(page, 'Kappa & Brothers');
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="balance"]').click();
    await page.locator('#suppBalAmount').fill('12000');
    await page.locator('[data-action="invSuppSaveBalance"]').click();
    await expect(page.locator('[data-supp-dialog] [data-supp-owed]')).toHaveAttribute('data-supp-owed', '12000');
    let r = (await readStoredState(page)).suppliers[0];
    expect([r.opening.amount, r.opening.date, r.inOpening]).toEqual([12000, day(-35), ['BK-K']]);
    // Another day: the mark was for the day it was set against.
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="balance"]').click();
    await page.locator('#suppBalDate').fill(day(-36));
    await page.locator('[data-action="invSuppSaveBalance"]').click();
    await expect.poll(async () => (await readStoredState(page)).suppliers[0].opening.date).toBe(day(-36));
    r = (await readStoredState(page)).suppliers[0];
    expect(r.inOpening).toBeUndefined();
  });

  test('A3-2: a payee sorted as Supplier by hand joins the supplier it is, through Also written', async ({ page }) => {
    const s: any = stockBook();
    s.stock.entries.push(bill('n1', 'B', day(-20), 30, 200, 'Nova Chemicals', 'N/1'));
    s.bank = bank([row(day(-40), 'SMS CHARGES', 1, 0), row(day(-10), 'NEFT-UTR9-NCPL TRADING CO-STATE BANK OF I', 5000, 0, undefined, 'BK-P'), row(day(-1), 'SMS CHARGES', 1, 0)],
      { parties: { NCPLTRADINGCO: { cat: 'supplier', dir: 'out' } } });
    await loadAppWithState(page, s);
    // Sorted by hand, the payee was a supplier of its own.
    expect(await ev(page, `suppIndex().list.map(function(sp) { return [sp.name, sp.bank.length]; })`)).toEqual([['Nova Chemicals', 0], ['NCPL TRADING CO', 1]]);
    await openSupplier(page, 'Nova Chemicals');
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="set"]').click();
    await page.locator('#suppSetNames').fill('NCPL TRADING CO');
    await page.locator('[data-action="invSuppSaveSet"]').click();
    await expect(page.locator('[data-supp-dialog] [data-supp-facts]')).toContainText('NCPL TRADING CO');
    expect(await ev(page, `[suppOfName('Nova Chemicals').bank.length, suppIndex().list.length]`)).toEqual([1, 1]);
    // A spelling a supplier the owner set something on holds is still refused.
    await ev(page, `(function() { S.suppliers.push({ id: 'SUP-z', name: 'Zeta Salts', names: [], leadMin: 1, leadMax: 1, at: 1 }); saveState(); })()`);
    await page.locator('[data-supp-dialog] [data-action="invSuppForm"][data-form="set"]').click();
    await page.locator('#suppSetNames').fill('NCPL TRADING CO\nZeta Salts');
    await page.locator('[data-action="invSuppSaveSet"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('“Zeta Salts” is Zeta Salts’s already');
  });

  test('A3-9: "&" and BROS fold both ways when the bank’s guess reads a payee', async ({ page }) => {
    const s: any = stockBook();
    s.stock.entries.push(bill('a1', 'B', day(-20), 10, 200, 'Nova Chem AND Brothers', 'A/1'), bill('o1', 'B', day(-15), 10, 210, 'Orbit Brothers', 'O/1'));
    s.bank = bank([row(day(-40), 'SMS CHARGES', 1, 0), row(day(-9), 'NEFT-UTR1-NOVA CHEM & BROTHERS', 2360, 0, undefined, 'BK-A'),
      row(day(-8), 'NEFT-UTR2-ORBIT BROS-STATE BANK OF I', 2478, 0, undefined, 'BK-O'), row(day(-1), 'SMS CHARGES', 1, 0)]);
    await loadAppWithState(page, s);
    expect(await ev(page, `bankClassify().filter(function(v) { return v.row.id === 'BK-A' || v.row.id === 'BK-O'; }).map(function(v) { return [v.row.id, v.cat, v.supplier]; })`))
      .toEqual([['BK-A', 'supplier', 'Nova Chem AND Brothers'], ['BK-O', 'supplier', 'Orbit Brothers']]);
    expect(await ev(page, `[suppOfName('Orbit Brothers').bank.length, suppOfName('Nova Chem AND Brothers').bank.length]`)).toEqual([1, 1]);
  });

  test('A3-7: a stock file keeps the prices quoted, on the line as this book holds it, and finds a supplier held here by its name', async ({ page }) => {
    const s: any = stockBook();
    s.suppliers = [{ id: 'SUP-here', name: 'Kappa & Brothers', names: [], at: 1 }];
    await loadAppWithState(page, s);
    const added = await ev(page, `stockMergeImport({ format: 'sep-stock', version: 1, entries: [],
      items: [{ id: 'B-file', name: 'Brightener K', key: 'BRIGHTENER K', unit: 'L', basis: 'draw' }],
      suppliers: [{ id: 'SUP-there', name: 'KAPPA AND BROTHERS', names: [], quotes: [{ id: 'SQ-1', itemId: 'B-file', price: 190, date: '${day(-3)}', note: 'on the phone', at: 5 }] },
        { id: 'SUP-new', name: 'Pi Chemicals', names: [], setAt: 7, setBy: 'U-x', quotes: [{ id: 'SQ-2', itemId: 'B-file', price: 180, date: '${day(-2)}', note: '' }] }],
      supplierPays: [{ id: 'SPY-1', supplierId: 'SUP-there', date: '${day(-1)}', amount: 500, how: 'cash' }] })`) as any;
    expect([added.suppliers, added.supplierPays]).toEqual([1, 1]);
    await ev(page, `saveState()`);
    const st = await readStoredState(page);
    expect(st.suppliers.map((r: any) => r.id)).toEqual(['SUP-here', 'SUP-new']);
    expect(st.suppliers[0].quotes).toEqual([expect.objectContaining({ id: 'SQ-1', itemId: 'B', price: 190, note: 'on the phone' })]);
    expect(st.suppliers[1]).toMatchObject({ setAt: 7, setBy: 'U-x', quotes: [expect.objectContaining({ id: 'SQ-2', itemId: 'B', price: 180 })] });
    expect(st.supplierPays.map((p: any) => [p.id, p.supplierId])).toEqual([['SPY-1', 'SUP-here']]);
    // The quotes are weighed beside the bills: both suppliers are candidates for the line.
    expect(await ev(page, `suppCandidates(stockItem('B')).map(function(c) { return [c.name, c.price, c.basis]; })`))
      .toEqual([['Kappa & Brothers', 190, 'quote'], ['Pi Chemicals', 180, 'quote']]);
  });

  test('A3-8: two records of one supplier, from two devices, fold into one at load: one row, one ledger', async ({ page }) => {
    const s: any = stockBook();
    s.stock.items[0].orderFrom = { supplierId: 'SUP-b', name: 'KAPPA AND BROTHERS', at: 1 };
    s.suppliers = [{ id: 'SUP-a', name: 'Kappa & Brothers', names: [], opening: { amount: 5000, date: day(-30) }, at: 1 },
      { id: 'SUP-b', name: 'KAPPA AND BROTHERS', names: ['KAPPA BROS'], leadMin: 2, leadMax: 3, at: 2,
        quotes: [{ id: 'SQ-b', itemId: 'B', price: 190, date: day(-4), note: '', at: 2 }] }];
    s.supplierPays = [{ id: 'SPY-b', supplierId: 'SUP-b', date: day(-5), amount: 1000, how: 'cash', chq: null, note: null, at: 3 }];
    await loadAppWithState(page, s);
    const st = await readStoredState(page);
    expect(st.suppliers.map((r: any) => r.id)).toEqual(['SUP-a']);
    expect(st.suppliers[0]).toMatchObject({ leadMin: 2, leadMax: 3, opening: { amount: 5000 }, names: ['KAPPA AND BROTHERS', 'KAPPA BROS'] });
    expect(st.suppliers[0].quotes.map((q: any) => q.id)).toEqual(['SQ-b']);
    expect(st.supplierPays[0].supplierId).toBe('SUP-a');
    expect(st.stock.items[0].orderFrom.supplierId).toBe('SUP-a');
    // One ledger: the balance set, less the payment the second record held.
    expect(await ev(page, `suppLedger(suppById('SUP-a')).balance`)).toBe(4000);
    await openSupplier(page, 'Kappa & Brothers');
    await expect(page.locator('#bankSuppliers [data-supplier]')).toHaveCount(1);
  });

  test('A5-18: the reorder list’s cash with GST is each supplier’s own rate', async ({ page }) => {
    const s: any = stockBook();
    // 5 L a day, 70 on the shelf: from Rho, 2 working days, 5 L × (2 + 30) − 70 = 90 L at ₹100 = ₹9,000, at Rho's 5% GST.
    s.stock.entries.push(bill('r1', 'B', day(-20), 30, 100, 'Rho Salts', 'R/1'));
    s.suppliers = [{ id: 'SUP-r', name: 'Rho Salts', names: [], leadMin: 2, leadMax: 2, gstPct: 5, at: 1 }];
    await loadAppWithState(page, s);
    // Floor's Stock card: the order with Rho's own GST (it read ₹10,620.00, at 18%).
    await switchTab(page, 'pageFloor');
    expect(await page.locator('[data-flr-reorder]').first().evaluate(el => el.textContent)).toContain('₹9,450.00');
    expect(await ev(page, `(function() { var L = stockReorderList(); return [L.total, L.withGst]; })()`)).toEqual([9000, 9450]);
  });

  test('A3-15: the supplier dialog’s dead close is gone', async ({ page }) => {
    await loadAppWithState(page, state());
    expect(await ev(page, 'typeof suppDialogClose')).toBe('undefined');
  });
});
