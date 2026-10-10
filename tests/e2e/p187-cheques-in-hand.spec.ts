import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P187: cheques received, not yet in the bank (docs/TAB_MAP.md TM3b; owner, 9 Oct 2026). A cheque from a client counts as paid the
// day it comes: recorded then, it is a receipt dated that day until its deposit is found on the statement by its number, which
// takes over without counting twice and lands on the client. A credit of the same amount with no number is only offered; a deposit
// that comes back reads Returned; a void puts what is owed back. It raises chequeHeld while it waits, the forecast expects it, the
// statement of account and the invoice say where it is, and the sep-bank export carries it. Names and figures are made up; dates
// are built from today.

const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };

let seq = 0;
/* A statement row; the rows a test adds name their own id (`id`), so they can be named back. */
function row(date: string, narration: string, dr: number, cr: number, set?: any, id?: string) {
  const r: any = { id: id || 'BK-C' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance: 500000, dayIdx: 100 + (++seq), importId: 'BI-C' };
  if (set) r.set = set;
  return r;
}
function bank(rows: any[], extra: any = {}) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.dayIdx - b.dayIdx);
  return Object.assign({ rows, imports: [{ id: 'BI-C', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
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
/* Two open invoices for ALPHA (₹23,600 and ₹11,800) and a statement running to yesterday. */
function book(cheques: any[] = [], moreRows: any[] = [], bankExtra: any = {}) {
  seq = 0;
  const rows = [row(day(-40), 'SMS CHARGES', 1, 0), row(day(-1), 'SMS CHARGES', 1, 0)].concat(moreRows);
  return state({ invoices: [inv(1, day(-20), 23600), inv(2, day(-10), 11800)], bank: bank(rows, Object.assign({ cheques }, bankExtra)) });
}
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const owed = (page: Page, clientId = 1) => ev(page, `(function() { var r = bankReceivables().find(function(x) { return x.client.id === ${clientId}; }); return r ? r.owed : null; })()`) as Promise<number>;
const links = (page: Page) => ev(page, `bankChequeLinks().map(function(o) { return { id: o.ch.id, status: o.status, how: o.how, dep: o.dep ? o.dep.row.id : null, diff: o.diff, offers: o.offers }; })`) as Promise<any[]>;
const finTab = (page: Page, t: string) => page.locator(`[data-action="invFinTab"][data-tab="${t}"]`).click();
async function openReceivables(page: Page) {
  await switchTab(page, 'pageFinance');
  await finTab(page, 'receipts');
  await expect(page.locator('#bankRecvVerdict')).toBeVisible();
}
async function fillCheque(page: Page, f: { client?: string; amount?: string; number?: string; received?: string }) {
  const form = page.locator('[data-cheque-form]');
  await expect(form).toBeVisible();
  if (f.client != null) await form.locator('#chqClient').selectOption(f.client);
  if (f.amount != null) await form.locator('#chqAmount').fill(f.amount);
  if (f.number != null) await form.locator('#chqNumber').fill(f.number);
  if (f.received != null) await form.locator('#chqReceived').fill(f.received);
  await form.locator('[data-action="invChequeSave"]').click();
}

test('a cheque recorded on Receivables counts as paid the day it came: owed falls at once, and the panel, the verdict and the client say so', async ({ page }) => {
  await loadAppWithState(page, book());
  await openReceivables(page);
  expect(await owed(page)).toBe(35400);
  await expect(page.locator('#bankRecvVerdict .inv-hero-title')).toContainText('₹35,400 owed');

  // Receivables' toolbar: Cheque received, secondary (the screen's primary stays what it is).
  const door = page.locator('[data-bank-toolbar="receipts"] [data-action="invChequeNew"]');
  await expect(door).toHaveText('Cheque received');
  await expect(door).not.toHaveClass(/inv-btn-primary/);
  await door.click();
  await fillCheque(page, { client: '1', amount: '23600', number: '525428' });
  await expect(page.locator('[data-cheque-form]')).toHaveCount(0);

  expect(await owed(page)).toBe(11800);
  await expect(page.locator('#bankRecvVerdict .inv-hero-title')).toContainText('₹11,800 owed');
  await expect(page.locator('#bankRecvVerdict')).toContainText('1 cheque in hand, ₹23,600');
  const panel = page.locator('#bankCheques');
  await expect(panel.locator('[data-cheques-held="1"]')).toHaveText('1 cheque in hand · ₹23,600 · received today');
  await expect(panel.locator('[data-cheque]')).toHaveCount(1);
  await expect(panel.locator('[data-cheque] .inv-dot')).toHaveText('In hand · today');
  // What needs the owner leads: the cheques come before what each client owes.
  const order = await page.locator('#pageFinance').evaluate(p => Array.from(p.querySelectorAll('#bankCheques, #bankReceipts')).map(e => e.id));
  expect(order).toEqual(['bankCheques', 'bankReceipts']);

  // The client's receipts show it, exact against the invoice it equals, and the invoices it settled are no longer open.
  await page.locator('[data-action="invBankClient"][data-id="1"]').first().click();
  const pend = page.locator('[data-alloc-pending]');
  await expect(pend).toHaveCount(1);
  await expect(pend).toContainText('Cheque 525428 · in hand since');
  await expect(pend).toContainText('Exact');
  await expect(page.locator('[data-recv-fact="received"]')).toContainText('1 cheque in hand among it');

  const s = await readStoredState(page) as any;
  expect(s.bank.cheques).toHaveLength(1);
  expect(s.bank.cheques[0]).toMatchObject({ clientId: 1, amount: 23600, number: '525428', receivedOn: todayIso() });
  // The change log keeps it, by the client and the number.
  expect((s.changeLog || []).filter((e: any) => e.coll === 'bank.cheques').map((e: any) => [e.op, e.label])).toEqual([['add', 'ALPHA FORGINGS · cheque 525428 · ₹23,600.00']]);
});

test('its deposit, found by its number, takes over without counting twice and lands on the client; a different amount is said', async ({ page }) => {
  await loadAppWithState(page, book([chq('CHQ-A', '525428', 23600, day(-5))], [row(day(-3), 'BY INST 525428 - MICR CLG', 0, 23600, undefined, 'BK-DEP')]));
  expect(await links(page)).toEqual([{ id: 'CHQ-A', status: 'deposited', how: 'number', dep: 'BK-DEP', diff: 0, offers: [] }]);
  // Paid once: by the deposit, placed on the cheque's client.
  expect(await owed(page)).toBe(11800);
  expect(await ev(page, `(function() { var v = bankClassify().find(function(x) { return x.row.id === 'BK-DEP'; }); return [v.cat, v.clientId, v.cheque]; })()`)).toEqual(['receipt', 1, 'CHQ-A']);
  await openReceivables(page);
  await expect(page.locator('[data-cheque="CHQ-A"] .inv-dot')).toHaveText(/^In the bank /);
  await expect(page.locator('[data-cheques-held="0"]')).toHaveText('None in hand');

  // The amount typed was a slip: the deposit counts, as the bank has it, and the row says what came in.
  await loadAppWithState(page, book([chq('CHQ-A', '525428', 23600, day(-5))], [row(day(-3), 'BY INST 525428 - MICR CLG', 0, 23500)]));
  expect((await links(page))[0]).toMatchObject({ status: 'deposited', diff: -100 });
  expect(await owed(page)).toBe(11900);
  await openReceivables(page);
  await expect(page.locator('[data-cheque="CHQ-A"] .inv-dot')).toHaveText('In the bank: ₹23,500.00');
  await expect(page.locator('[data-cheque="CHQ-A"] .inv-dot')).toHaveClass(/inv-dot-warning/);
});

test('a row placed by hand keeps its client; "not this" stops the number; a credit with no number is offered and links on a tap', async ({ page }) => {
  await loadAppWithState(page, book([
    chq('CHQ-H', '777001', 5000, day(-6)),
    chq('CHQ-N', '888001', 7000, day(-6), { deposit: null }),
    chq('CHQ-O', '999001', 4200, day(-5))
  ], [
    row(day(-4), 'BY INST 777001', 0, 5000, { cat: 'receipt', clientId: 2 }, 'BK-H'),
    row(day(-4), 'BY INST 888001', 0, 7000, undefined, 'BK-N'),
    row(day(-3), 'CASH DEPOSIT BRANCH', 0, 4200, undefined, 'BK-O')
  ]));
  const L = await links(page);
  const by = (id: string) => L.find(x => x.id === id);
  expect(by('CHQ-H')).toMatchObject({ status: 'deposited', how: 'number' });
  // The row's own placement wins.
  expect(await ev(page, `bankClassify().find(function(x) { return x.row.id === 'BK-H'; }).clientId`)).toBe(2);
  expect(by('CHQ-N')).toMatchObject({ status: 'held', dep: null, offers: [] });
  expect(by('CHQ-O')).toMatchObject({ status: 'held', offers: ['BK-O'] });

  await openReceivables(page);
  const offer = page.locator('[data-cheque="CHQ-O"] + .inv-row-children [data-cheque-offer="BK-O"]');
  await expect(offer).toContainText('₹4,200.00 came in');
  // The same deposit, among the receipts nobody placed, offers the cheque first.
  await expect(page.locator('[data-offer="BK-O"][data-why="cheque"]')).toContainText('cheque 999001 in hand, the same amount');
  await offer.locator('[data-action="invChequeLink"]').click();
  expect((await links(page)).find(x => x.id === 'CHQ-O')).toMatchObject({ status: 'deposited', how: 'set', dep: 'BK-O' });
  expect(await ev(page, `bankClassify().find(function(x) { return x.row.id === 'BK-O'; }).clientId`)).toBe(1);
  expect(((await readStoredState(page)) as any).bank.cheques.find((c: any) => c.id === 'CHQ-O').deposit).toBe('BK-O');

  // Unlink puts it back to its number (none here): in hand again.
  await page.locator('[data-action="invChequeOpen"][data-id="CHQ-O"]').first().click();
  await page.locator('[data-cheque-dialog] [data-action="invChequeUnlink"]').click();
  expect((await links(page)).find(x => x.id === 'CHQ-O')).toMatchObject({ status: 'held' });
});

test('a deposit that comes back reads Returned and the client owes again', async ({ page }) => {
  await loadAppWithState(page, book([chq('CHQ-R', '525428', 23600, day(-10))], [
    row(day(-8), 'BY INST 525428 - MICR CLG', 0, 23600),
    row(day(-6), 'CHQ RTN 525428 FUNDS INSUFFICIENT', 23600, 0, { cat: 'reversal' })
  ]));
  expect((await links(page))[0]).toMatchObject({ status: 'returned', how: 'number' });
  expect(await owed(page)).toBe(35400);
  await openReceivables(page);
  await expect(page.locator('[data-cheque="CHQ-R"] .inv-dot')).toHaveText('Returned');
});

test('a void puts what is owed back and keeps the cheque with its reason; the same number twice and a day after today are refused', async ({ page }) => {
  await loadAppWithState(page, book());
  await openReceivables(page);
  await page.locator('[data-action="invChequeNew"]').click();
  await fillCheque(page, { client: '1', amount: '23600', number: '525428' });
  expect(await owed(page)).toBe(11800);

  // The same client and number again is refused, and the form stays as typed.
  await page.locator('[data-action="invChequeNew"]').click();
  await fillCheque(page, { client: '1', amount: '100', number: '0525428' });
  await expect(page.locator('.inv-toast').last()).toContainText('Cheque 0525428 is already recorded for this client');
  await expect(page.locator('[data-cheque-form] #chqAmount')).toHaveValue('100');
  // A day after today is refused.
  await fillCheque(page, { number: '600001', received: day(1) });
  await expect(page.locator('.inv-toast').last()).toContainText('cannot be after today');
  await page.locator('[data-cheque-form] .inv-dialog-foot [data-action="invCloseOverlay"]').click();

  const id = ((await readStoredState(page)) as any).bank.cheques[0].id;
  await page.locator(`[data-action="invChequeOpen"][data-id="${id}"]`).first().click();
  await expect(page.locator('[data-cheque-dialog]')).toContainText('counts as paid until it reaches the bank');
  await page.locator('[data-cheque-dialog] [data-action="invChequeVoid"]').click();
  await answerAsk(page, 'ok', 'Client asked to hold it; a new one is coming');
  expect(await owed(page)).toBe(35400);
  const c = ((await readStoredState(page)) as any).bank.cheques[0];
  expect(c.voidReason).toBe('Client asked to hold it; a new one is coming');
  expect(c.voidedAt).toBeGreaterThan(0);
  await expect(page.locator('#bankCheques')).toHaveCount(0);
});

test('a cheque in hand raises chequeHeld, amber at 3 days and red at 7, saying whether the statement reaches past it; its move opens it', async ({ page }) => {
  await loadAppWithState(page, book([chq('CHQ-1', '400001', 5000, day(-4)), chq('CHQ-2', '400002', 6000, day(-8)), chq('CHQ-3', '400003', 7000, day(-1))]));
  const t = await ev(page, `todoAppAll().filter(function(t) { return t.rule === 'chequeHeld'; }).map(function(t) { return { key: t.key, tone: t.tone, title: t.title, sub: t.sub }; })`) as any[];
  expect(t.map(x => [x.key, x.tone])).toEqual(expect.arrayContaining([['chequeHeld:CHQ-1', 'amber'], ['chequeHeld:CHQ-2', 'red']]));
  expect(t).toHaveLength(2);
  expect(t.find(x => x.key === 'chequeHeld:CHQ-1').title).toBe('Deposit cheque 400001');
  expect(t.find(x => x.key === 'chequeHeld:CHQ-1').sub).toMatch(/^ALPHA FORGINGS · ₹5,000\.00, received .+: not in the bank by /);

  // A statement ending before the cheque came cannot say: it asks for the statement.
  seq = 0;
  const s2 = state({ invoices: [inv(1, day(-20), 23600)], bank: bank([row(day(-40), 'SMS CHARGES', 1, 0), row(day(-9), 'SMS CHARGES', 1, 0)], { cheques: [chq('CHQ-1', '400001', 5000, day(-4))] }) });
  await loadAppWithState(page, s2);
  const t2 = await ev(page, `todoAppAll().filter(function(t) { return t.rule === 'chequeHeld'; }).map(function(t) { return t.sub; })`) as string[];
  expect(t2).toHaveLength(1);
  expect(t2[0]).toContain('import the statement to check');
  // Its move opens Receivables and the cheque itself.
  await ev(page, `todoGo(todoAppAll().find(function(t) { return t.rule === 'chequeHeld'; }).go)`);
  await expect(page.locator('#bankRecvVerdict')).toBeVisible();
  await expect(page.locator('[data-cheque-dialog="CHQ-1"]')).toBeVisible();
});

test('the forecast expects it on the next working day; the statement of account, the invoice and Money’s cash card say where it is', async ({ page }) => {
  await loadAppWithState(page, book([chq('CHQ-A', '525428', 23600, day(-1))]));
  const rests = await ev(page, `finForecast(60).rests.join(' ')`) as string;
  expect(rests).toContain('1 cheque in hand, ₹23,600.00, expected in the bank on');
  const soa = await ev(page, `soaCompute(1).rows.map(function(r) { return r.label; })`) as string[];
  expect(soa).toContain('Cheque 525428 received, not yet in the bank');
  const pay = await ev(page, `finInvoicePayment(S.invoices.find(function(i) { return i.id === 'INV-1'; }))`) as any;
  expect(pay.paid).toEqual([expect.objectContaining({ pending: true, amount: 23600, chq: '525428' })]);
  expect(await ev(page, `finInvoicePaymentHtml(S.invoices.find(function(i) { return i.id === 'INV-1'; }))`)).toContain('Cheque in hand');
  await switchTab(page, 'pageFinance');
  await finTab(page, 'overview');
  await expect(page.locator('[data-fin-tile="balance"]')).toContainText('+ ₹23,600 in cheques in hand');
});

test('Add → By hand → Cheque opens the form; the sep-bank export carries cheques and Add → File merges them by id', async ({ page }) => {
  await loadAppWithState(page, book([chq('CHQ-A', '525428', 23600, day(-2))]));
  await ev(page, `addOpen()`);
  await page.locator('[data-action="invAddHand"][data-go="cheque"]').click();
  await expect(page.locator('[data-cheque-form]')).toBeVisible();
  await page.locator('[data-cheque-form] .inv-dialog-foot [data-action="invCloseOverlay"]').click();

  await switchTab(page, 'pageFinance');
  await finTab(page, 'bank');
  const [dl] = await Promise.all([page.waitForEvent('download'), ev(page, `bankExportJson()`)]);
  const out = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  expect(out.format).toBe('sep-bank');
  expect(out.cheques).toEqual([expect.objectContaining({ id: 'CHQ-A', number: '525428', amount: 23600 })]);

  // A file holding the one already here and one new: the new one is added, the one held kept as it is.
  out.cheques.push(chq('CHQ-B', '525431', 11800, day(-1)));
  out.cheques[0].amount = 1;
  await ev(page, `addOpen()`);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-add-sec="file"]').click()]);
  await chooser.setFiles({ name: 'sep-bank.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(out)) });
  const said = await answerAsk(page, 'ok');
  expect(said).toContain('1 cheque received added');
  expect(said).toContain('1 already held and kept as they are');
  const s = await readStoredState(page) as any;
  expect(s.bank.cheques.map((c: any) => [c.id, c.amount])).toEqual([['CHQ-A', 23600], ['CHQ-B', 11800]]);
  await expect(page.locator('#bankRecvVerdict')).toBeVisible();
});
