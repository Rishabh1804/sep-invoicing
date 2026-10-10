import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { openFoldAt, answerAsk, bankImportDoor, emptyState, loadAppWithState, noSeedIM, openSettingsAt, openStatsTab, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P109: the QA sweep over Finance, the bank statement, receivables, payments, the live cost, zinc and bills. Each test
// pins one finding so it cannot come back. Every date is built from today; names and figures are made up, and the only
// statement read from disk is the fake one in the bank's layout (tests/fixtures).

const JUL = path.join(__dirname, '..', 'fixtures', 'bank-jul.xls');

const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ym = (k: number) => { const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const monthEnd = (m: string) => { const d = new Date(m + '-01T00:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return m + '-' + String(d.getDate()).padStart(2, '0'); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

let seq = 0;
function row(date: string, narration: string, dr: number, cr: number, set?: any, balance = 100000) {
  const r: any = { id: 'BK-M' + (++seq), date, valueDate: date, narration, chq: '', dr, cr, balance, dayIdx: seq, importId: 'BI-M' };
  if (set) r.set = set;
  return r;
}
function bank(rows: any[], extra: any = {}) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.dayIdx - b.dayIdx);
  return Object.assign({ rows, imports: [{ id: 'BI-M', at: 1, file: 't.xls', account: '', from: rows[0].date, to: rows[rows.length - 1].date, rows: rows.length, added: rows.length, closing: 0 }],
    parties: {}, opening: {}, gstNotes: {} }, extra);
}
function inv(n: number, date: string, total: number, clientId = 1) {
  const taxable = Math.round(total / 1.18 * 100) / 100, tax = Math.round((total - taxable) / 2 * 100) / 100;
  return { id: 'INV-' + n, invoiceNumber: String(n).padStart(5, '0'), displayNumber: 'T/' + n, date, status: 'active', invoiceState: 'dispatched',
    clientId, clientName: 'ALPHA FORGINGS', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: 'P', desc: 'P', hsn: '998873', unit: 'KG', qty: 100, rate: taxable / 100, amount: taxable }],
    taxableValue: taxable, cgstPer: 9, cgstAmt: tax, sgstPer: 9, sgstAmt: tax, igstPer: 0, igstAmt: 0, grandTotal: total, createdAt: recentTs() };
}
const client = (id: number, name: string) => ({ id, name, billingMode: 'weight', gstType: 'intra', gstin: '', address: '', isActive: true, rates: [], itemRates: [] });
function state(extra: any = {}): SepState {
  const s = emptyState() as any;
  s.incomingMaterial = noSeedIM();
  s.clients = [client(1, 'ALPHA FORGINGS'), client(2, 'BETA AUTO'), client(3, 'GAMMA WORKS')];
  s.staff = [{ id: 7, name: 'Ramu Kumar', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true }];
  return Object.assign(s, extra);
}
const finTab = (page: Page, t: string) => page.locator(`[data-action="invFinTab"][data-tab="${t}"]`).click();
async function openFinance(page: Page, t: string) { await switchTab(page, 'pageFinance'); await finTab(page, t); }

/* ---------- A statement file, written the way Excel 97–2003 writes one ---------- */
function rec(type: number, data: Buffer): Buffer {
  const h = Buffer.alloc(4); h.writeUInt16LE(type, 0); h.writeUInt16LE(data.length, 2);
  return Buffer.concat([h, data]);
}
function bof(dt: number) { const b = Buffer.alloc(16); b.writeUInt16LE(0x0600, 0); b.writeUInt16LE(dt, 2); return rec(0x0809, b); }
/* A BIFF8 workbook of one sheet: text as LABEL cells, numbers as NUMBER cells. */
function workbook(cells: (string | number | null)[][]): Buffer {
  const name = 'Statement', bsLen = 4 + 8 + name.length;
  const boundsheet = (pos: number) => { const b = Buffer.alloc(8 + name.length); b.writeUInt32LE(pos, 0); b[6] = name.length; b.write(name, 8, 'latin1'); return rec(0x0085, b); };
  const eof = rec(0x000A, Buffer.alloc(0));
  const globals = Buffer.concat([bof(0x0005), boundsheet(16 + 4 + bsLen + 4), eof]);
  const out: Buffer[] = [globals, bof(0x0010)];
  cells.forEach((r, ri) => r.forEach((v, ci) => {
    if (v == null) return;
    if (typeof v === 'number') { const b = Buffer.alloc(14); b.writeUInt16LE(ri, 0); b.writeUInt16LE(ci, 2); b.writeDoubleLE(v, 6); out.push(rec(0x0203, b)); return; }
    const b = Buffer.alloc(9 + v.length); b.writeUInt16LE(ri, 0); b.writeUInt16LE(ci, 2); b.writeUInt16LE(v.length, 6); b.write(v, 9, 'latin1'); out.push(rec(0x0204, b));
  }));
  out.push(eof);
  const wb = Buffer.concat(out);
  // A stream under 4096 bytes would live in the mini stream; this builder keeps it in ordinary sectors.
  return wb.length >= 4096 ? wb : Buffer.concat([wb, Buffer.alloc(4096 - wb.length)]);
}
/* The compound file around it: header, one FAT sector, one directory sector, then the Workbook stream.
   shift 9 is a version 3 file (512-byte sectors); shift 12 a version 4 one (4096-byte sectors, the header
   filling the first of them). */
function compound(stream: Buffer, shift: 9 | 12): Buffer {
  const ss = 1 << shift, n = Math.ceil(stream.length / ss);
  if (n + 2 > ss / 4) throw new Error('stream too long for one FAT sector');
  const head = Buffer.alloc(ss);
  Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]).copy(head, 0);
  head.writeUInt16LE(0x3E, 0x18); head.writeUInt16LE(shift === 12 ? 4 : 3, 0x1A); head.writeUInt16LE(0xFFFE, 0x1C);
  head.writeUInt16LE(shift, 0x1E); head.writeUInt16LE(6, 0x20);
  head.writeUInt32LE(shift === 12 ? 1 : 0, 0x28); head.writeUInt32LE(1, 0x2C); head.writeUInt32LE(1, 0x30);
  head.writeUInt32LE(4096, 0x38); head.writeUInt32LE(0xFFFFFFFE, 0x3C); head.writeUInt32LE(0xFFFFFFFE, 0x44);
  for (let i = 0; i < 109; i++) head.writeUInt32LE(i === 0 ? 0 : 0xFFFFFFFF, 0x4C + i * 4);
  const fat = Buffer.alloc(ss, 0xFF);
  fat.writeUInt32LE(0xFFFFFFFD, 0); fat.writeUInt32LE(0xFFFFFFFE, 4);
  for (let k = 0; k < n; k++) fat.writeUInt32LE(k === n - 1 ? 0xFFFFFFFE : 3 + k, (2 + k) * 4);
  const dir = Buffer.alloc(ss);
  const entry = (i: number, nm: string, type: number, start: number, size: number, child: number) => {
    const o = i * 128;
    for (let c = 0; c < nm.length; c++) dir.writeUInt16LE(nm.charCodeAt(c), o + c * 2);
    dir.writeUInt16LE((nm.length + 1) * 2, o + 0x40); dir[o + 0x42] = type; dir[o + 0x43] = 1;
    dir.writeUInt32LE(0xFFFFFFFF, o + 0x44); dir.writeUInt32LE(0xFFFFFFFF, o + 0x48); dir.writeUInt32LE(child, o + 0x4C);
    dir.writeUInt32LE(start, o + 0x74); dir.writeUInt32LE(size, o + 0x78);
  };
  entry(0, 'Root Entry', 5, 0xFFFFFFFE, 0, 1);
  entry(1, 'Workbook', 2, 2, stream.length, 0xFFFFFFFF);
  const body = Buffer.alloc(n * ss); stream.copy(body, 0);
  return Buffer.concat([head, fat, dir, body]);
}
const serial = (iso: string) => { const p = iso.split('-').map(Number); return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(1899, 11, 30)) / 86400000); };
const HEAD = ['TRAN DATE', 'VALUE DATE', 'NARRATION', 'CHQ.NO.', 'WITHDRAWAL(DR)', 'DEPOSIT(CR)', 'BALANCE(INR)'];
async function importBuffer(page: Page, buffer: Buffer) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), bankImportDoor(page)]);
  await chooser.setFiles({ name: 'statement.xls', mimeType: 'application/vnd.ms-excel', buffer });
}
const xlsRows = (page: Page, buf: Buffer) => page.evaluate(b64 => {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  try { return JSON.stringify((window as any).xlsRead(u.buffer).rows); } catch (e: any) { return 'error: ' + e.message; }
}, buf.toString('base64'));

/* ---------- B1: a payee rule speaks for one direction ---------- */
test('B1: a payment set to Other for every payment to a party leaves that party’s receipts alone', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-30), 'NEFT-UTR1-GAMMA WORKS', 0, 5000), row(day(-10), 'NEFT-UTR2-GAMMA WORKS', 2000, 0)]) }));
  await openFinance(page, 'bank');
  await page.locator('[data-bank-row] [data-action="invBankEdit"]', { hasText: 'GAMMA WORKS' }).first().click();
  await expect(page.locator('[data-bank-edit="BK-M2"]')).toBeVisible();
  await page.locator('#bankEditCat').selectOption('other');
  await expect(page.locator('#bankEditAll')).toBeChecked();
  await page.locator('[data-action="invBankEditSave"]').click();
  const cls = await ev(page, `bankClassify().map(function(v) { return [v.row.id, v.cat, v.clientId == null ? null : v.clientId]; })`);
  // The receipt is still Gamma's receipt: the rule was written from a payment, and speaks for payments.
  expect(cls).toEqual([['BK-M1', 'receipt', 3], ['BK-M2', 'other', null]]);
  const parties = (await readStoredState(page)).bank.parties;
  expect(parties).toEqual({ GAMMAWORKS: { cat: 'other', notCost: false, dir: 'out' } });
});

test('B1: placing a receipt from a supplier keeps the rule its payments have', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-30), 'NEFT-UTR3-DELTA TRADERS', 4000, 0), row(day(-12), 'NEFT-UTR4-DELTA TRADERS', 0, 1500)]) }));
  await openFinance(page, 'bank');
  await page.locator('[data-bank-row="BK-M1"] [data-action="invBankEdit"]').click();
  await page.locator('#bankEditCat').selectOption('supplier');
  await page.locator('[data-action="invBankEditSave"]').click();
  // The same party paid something in: placed on a client from Receivables, a rule for money in.
  await finTab(page, 'receipts');
  await page.locator('#bankLoose [data-loose="BK-M2"] select').selectOption('1');
  await expect(page.locator('#bankLoose')).toHaveCount(0);
  const cls = await ev(page, `bankClassify().map(function(v) { return [v.cat, v.clientId == null ? null : v.clientId, v.auto]; })`);
  expect(cls).toEqual([['supplier', null, false], ['receipt', 1, false]]);
  const parties = (await readStoredState(page)).bank.parties;
  expect(parties.DELTATRADERS).toMatchObject({ cat: 'supplier', dir: 'out' });
  expect(parties['DELTATRADERS|in']).toEqual({ cat: 'receipt', clientId: 1, dir: 'in' });
});

test('B1: a rule written before rules had a direction keeps the direction it was made from', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([
    row(day(-40), 'NEFT-UTR5-GAMMA WORKS', 0, 5000), row(day(-35), 'NEFT-UTR6-GAMMA WORKS', 2500, 0),   // a payee that pays out: its rule was a payment's
    row(day(-30), 'NEFT-UTR7-EPSILON LOANS', 0, 50000),                                                 // a payee that only ever paid in
    row(day(-20), 'NEFT-UTR8-ZETA MOTORS', 0, 7000), row(day(-15), 'NEFT-UTR9-ZETA MOTORS', 7000, 0),   // a receipt rule, and a refund to them
  ], { parties: { GAMMAWORKS: { cat: 'other' }, EPSILONLOANS: { cat: 'other', notCost: true }, ZETAMOTORS: { cat: 'receipt', clientId: 2 } } }) }));
  const cls = await ev(page, `bankClassify().map(function(v) { return [v.party, v.cat, v.clientId == null ? null : v.clientId]; })`);
  expect(cls).toEqual([
    ['GAMMA WORKS', 'receipt', 3], ['GAMMA WORKS', 'other', null],
    ['EPSILON LOANS', 'other', null],
    ['ZETA MOTORS', 'receipt', 2], ['ZETA MOTORS', 'other', null],
  ]);
  // Stamped once, so a payee's first payment out later cannot turn its old money-in rule round.
  await ev(page, `saveState()`);
  await expect.poll(async () => Object.keys((await readStoredState(page)).bank.parties).sort()).toEqual(['EPSILONLOANS|in', 'GAMMAWORKS', 'ZETAMOTORS|in']);
  const p = (await readStoredState(page)).bank.parties;
  expect(p.GAMMAWORKS.dir).toBe('out');
  expect(p['EPSILONLOANS|in']).toEqual({ cat: 'other', notCost: true, dir: 'in' });
  await ev(page, `bankData().rows.push({ id: 'BK-LATE', date: '${day(-1)}', valueDate: '${day(-1)}', narration: 'NEFT-UTR10-EPSILON LOANS', chq: '', dr: 900, cr: 0, balance: 1, dayIdx: 0 })`);
  expect(await ev(page, `bankClassify().filter(function(v) { return v.party === 'EPSILON LOANS'; }).map(function(v) { return v.cat + (v.auto ? ' (guessed)' : ''); })`))
    .toEqual(['other', 'other (guessed)']);
});

/* ---------- B2: a deposit linked to a returned cheque ---------- */
test('B2: editing a deposit linked to a returned cheque keeps it a receipt, its client and its link', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ invoices: [inv(1, day(-30), 50000)], bank: bank([row(day(-40), 'SMS CHARGES', 1, 0),
    row(day(-20), 'BY INST 525428', 0, 50000, { cat: 'receipt', clientId: 1 }), row(day(-15), 'REJECT:525428:30:Funds insufficient', 50000, 0)]) }));
  await openFinance(page, 'bank');
  await page.locator('[data-bank-row="BK-M2"] [data-action="invBankEdit"]').click();
  // The form edits what the deposit is itself, and says what the link does to it.
  await expect(page.locator('#bankEditCat')).toHaveValue('receipt');
  await expect(page.locator('#bankEditClient')).toHaveValue('1');
  await expect(page.locator('[data-bank-edit-bounced]')).toContainText('Linked to the cheque returned on');
  await page.locator('[data-action="invBankEditSave"]').click();
  const stored = (await readStoredState(page)).bank.rows.find((r: any) => r.id === 'BK-M2');
  expect(stored.set).toMatchObject({ cat: 'receipt', clientId: 1 });
  const r = await ev(page, `(function() { var c = bankClassify(), rev = c.find(function(v) { return v.row.id === 'BK-M3'; });
    return { link: rev.bounceOf && rev.bounceOf.id, series: bankChequeSeries(c)['1'], owed: bankReceivables(c).find(function(x) { return x.client.id === 1; }).owed }; })()`);
  expect(r).toEqual({ link: 'BK-M2', series: ['525428'], owed: 50000 });
});

/* ---------- B3: an electricity payment and the bill made from it ---------- */
test('B3: moving the month of a payment made a bill moves the bill, and the payment is counted once', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(ym(-4) + '-01', 'SMS CHARGES', 1, 0), row(ym(-1) + '-10', 'BIJLI BIL JBVNL', 6000, 0), row(day(-1), 'SMS CHARGES', 1, 0)]) }));
  await openFinance(page, 'payments');
  // What was paid is folded under what needs the owner (the tab map, TM3c).
  await openFoldAt(page, 'pay-power');
  const pay = page.locator('#bankPower [data-power="BK-M2"]');
  await expect(pay.locator('select')).toHaveValue(ym(-2));
  await pay.locator('[data-action="invBankAddBill"]').click();
  await expect(pay).toContainText('Bill on record');
  await page.locator('#bankPower [data-power="BK-M2"] select').selectOption(ym(-3));
  await expect(page.locator('#bankPower [data-power="BK-M2"] select')).toHaveValue(ym(-3));
  // Still the one bill, now for the month the payment is for; no second "Add as bill".
  await expect(page.locator('#bankPower [data-power="BK-M2"]')).toContainText('Bill on record');
  await expect(page.locator('#bankPower [data-action="invBankAddBill"]')).toHaveCount(0);
  const bills = (await readStoredState(page)).costBills;
  expect(bills).toHaveLength(1);
  expect(bills[0]).toMatchObject({ kind: 'power', month: ym(-3), amount: 6000, bankId: 'BK-M2' });
  const c = await ev(page, `(function() { var bm = bankCostByMonth().months, l = liveCost('${ym(-3)}-01', '${monthEnd(ym(-2))}', 10000).rows.find(function(r) { return r.key === 'power'; });
    return { moved: bm['${ym(-3)}'].power.amount, left: bm['${ym(-2)}'] ? bm['${ym(-2)}'].power.amount : 0,
      bank: l.detail.filter(function(d) { return d.bank; }).length, billed: l.detail.filter(function(d) { return !d.fill && !d.bank && !d.ref; }).reduce(function(s, d) { return s + d.amount; }, 0) }; })()`);
  expect(c).toEqual({ moved: 6000, left: 0, bank: 0, billed: 6000 });
});

/* ---------- B4: zinc never reads ₹0 under a false label ---------- */
function zincState(entries: any[], zinc: any) {
  return state({
    zinc,
    stock: { items: [{ id: 'Q', name: 'Q558', key: 'Q558', unit: 'kg', basis: 'draw', aliases: [] }, { id: 'Z', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', aliases: [] }],
      // A use forty days back: the stock record (which starts with the first use, P125) covers every day of the period below.
      entries: [{ id: 'c1', itemId: 'Q', kind: 'used', qty: 4, days: 1, from: day(-40), date: day(-40), at: 1, seq: 2 }].concat(entries), pastes: [] },
  });
}
const zincRow = (page: Page) => ev(page, `(function() { var r = liveCost('${day(-3)}', '${todayIso()}', 1000).rows.find(function(x) { return x.key === 'zinc'; });
  return { source: r.source, amount: r.amount, note: r.note, lines: r.detail.map(function(d) { return d.label; }) }; })()`) as Promise<any>;

test('B4: a period with no zinc charged is not recorded, and is filled at the model, never ₹0', async ({ page }) => {
  await loadAppWithState(page, zincState([], { ratePerKg: 400, premiumPerKg: 20, upliftPct: 10.5, basis: 'manual', updatedAt: Date.now(), source: '' }));
  const z = await zincRow(page);
  // 425 kg a month over the period's 4 days, at the landed ₹420.
  expect(z.source).toBe('model');
  expect(z.amount).toBe(Math.round(425 * 4 / 30 * 420 * 100) / 100);
  expect(z.note).toBe('no zinc charged in this period · filled at the model');
  expect(z.lines).toEqual(['Not recorded: no zinc charged in this period']);
});

test('B4: zinc charged with no bill and no market rate is filled at the model, not read as a ₹0 market rate', async ({ page }) => {
  await loadAppWithState(page, zincState([{ id: 'z1', itemId: 'Z', kind: 'charged', qty: 10, date: todayIso(), at: 5, seq: 2 }], null));
  const z = await zincRow(page);
  expect(z.source).toBe('model');
  expect(z.amount).toBe(2210);   // the model's ₹2.21 a kilo plated × 1,000 kg
  expect(z.note).toBe('10 kg charged, no price · filled at the model');
  expect(z.lines).toEqual(['Charged, no price', 'Not recorded: 10 kg charged with no price']);
  await openStatsTab(page, 'cost');
  await expect(page.locator('#liveCost [data-cost="zinc"] [data-src]')).toHaveText('model');
});

/* ---------- B5: an unknown month says why ---------- */
test('B5: a month the statement covers but whose payees are not sorted says so in Derive, not "not on the statement"', async ({ page }) => {
  seq = 0;
  const rows = [row(ym(-7) + '-01', 'NEFT-UTR0-ALPHA FORGINGS', 0, 50000, { cat: 'receipt', clientId: 1 })];
  for (let k = -6; k <= -1; k++) rows.push(row(ym(k) + '-10', 'NEFT-UTRH-HARDWARE MART', 1000, 0, { cat: 'other' }));
  rows.push(row(ym(-3) + '-12', 'NEFT-UTRX-OMEGA SUPPLY', 2500, 0));   // nothing recognises the payee: unsorted
  rows.push(row(todayIso(), 'NEFT-UTRZ-ALPHA FORGINGS', 0, 1, { cat: 'receipt', clientId: 1 }));
  await loadAppWithState(page, state({ bank: bank(rows) }));
  const skips = await ev(page, `costDeriveCompute(['other']).other.rows.filter(function(r) { return r.skip && r.skip !== 'no tonnage invoiced'; }).map(function(r) { return [r.month, r.skip]; })`);
  expect(skips).toEqual([[ym(-3), 'payees not yet sorted (Finance → Payments → Not yet sorted)']]);
  await openSettingsAt(page, 'fallbacks');
  await page.locator('[data-action="invCostDeriveBank"][data-which="fallbacks"]').click();
  await expect(page.locator('#costDeriveOut [data-derive="other"]')).toContainText('payees not yet sorted');
  await expect(page.locator('#costDeriveOut [data-derive="other"]')).not.toContainText('not on the statement');
});

/* ---------- B6: the forecast leaves reversals out ---------- */
test('B6: the forecast counts neither a returned cheque nor a posting and its reversal as a payment that recurs', async ({ page }) => {
  seq = 0;
  const rows = [row(ym(-4) + '-01', 'NEFT-UTR0-ALPHA FORGINGS', 0, 300000, { cat: 'receipt', clientId: 1 })];
  [-3, -2, -1].forEach(k => rows.push(row(ym(k) + '-05', 'NEFT-UTRH-HARDWARE MART', 10000, 0, { cat: 'other' })));
  rows.push(row(ym(-2) + '-08', 'REJECT:001290:70:Advice not received', 0, 88018), row(ym(-2) + '-08', 'REJECT:001290:70:Advice not received', 88018, 0));
  rows.push(row(ym(-1) + '-12', 'BY INST 525428', 0, 20000, { cat: 'receipt', clientId: 1 }), row(ym(-1) + '-15', 'REJECT:525428:30:Funds insufficient', 20000, 0));
  rows.push(row(day(-1), 'SMS CHARGES', 10, 0, undefined, 50000));
  await loadAppWithState(page, state({ bank: bank(rows) }));
  const rests = (await ev(page, `finForecast(60).rests.join(' ')`)) as string;
  // 10,000 each month: the 88,018 pair and the 20,000 bounce are money that came in and went back out.
  expect(rests).toContain('Suppliers and every other payment, ₹10,000.00 a month');
});

/* ---------- B7: one supplier matcher ---------- */
function supplierState(set?: any) {
  seq = 0;
  return state({
    stock: { items: [{ id: 'SI1', name: 'Nitric acid', key: 'NITRIC', unit: 'L', active: true }],
      entries: [{ id: 'SE1', itemId: 'SI1', kind: 'bill', date: day(-25), billDate: day(-25), qty: 100, price: 150, amount: 15000, supplier: 'Acme Chemicals', at: 1 }], pastes: [] },
    bank: bank([row(day(-60), 'SMS CHARGES', 10, 0), row(day(-20), 'NEFT-UTR5-SHREE ACME CHEMICALS', 15000, 0, set), row(day(-1), 'SMS CHARGES', 10, 0)]),
  });
}
test('B7: a payee carrying a word before the supplier’s name is that supplier’s payment, on every screen', async ({ page }) => {
  await loadAppWithState(page, supplierState());
  expect(await ev(page, `(function() { var v = bankClassify()[1]; return [v.cat, v.supplier]; })()`)).toEqual(['supplier', 'Acme Chemicals']);
  await openFinance(page, 'payments');
  // The suppliers' card (suppliers.js) sets it against the supplier's own bills.
  await expect(page.locator('#bankSuppliers [data-supplier]')).toContainText('Acme Chemicals');
  expect(await ev(page, `(function() { var sp = suppOfName('Acme Chemicals'); return [sp.bills[0].base, sp.bank.length]; })()`)).toEqual([15000, 1]);
});

test('B7: supplierNoBill and the stock line read a payment the same way', async ({ page }) => {
  await loadAppWithState(page, supplierState({ cat: 'supplier' }));
  // The stock line finds the payment; so the To-do finds its bill, and asks for nothing.
  expect(await ev(page, `finSupplierPaid('Acme Chemicals').n`)).toBe(1);
  expect(await ev(page, `todoAppAll(['supplierNoBill']).length`)).toBe(0);
  // With no bill from them, both agree there is none.
  await ev(page, `stockData().entries.length = 0`);
  expect(await ev(page, `todoAppAll(['supplierNoBill']).map(function(t) { return t.title.indexOf('SHREE ACME CHEMICALS') >= 0; })`)).toEqual([true]);
});

/* ---------- B8: a partial LME lookup ---------- */
function lmeState() {
  const lmeHistory: Record<string, number> = { [day(-10)]: 300, [day(-9)]: 302 };
  return state({
    zinc: { ratePerKg: 300, premiumPerKg: 15, upliftPct: 10, basis: 'lme', updatedAt: Date.now(), source: 'metals.dev · metals.zinc', lmeHistory },
    stock: { items: [{ id: 'Z', name: 'Zinc', key: 'ZINC', unit: 'kg', basis: 'charge', aliases: [] }], pastes: [],
      entries: [{ id: 'g1', itemId: 'Z', kind: 'bill', qty: 200, price: 340, date: day(-60), supplier: 'Gamma', billNo: 'G/1', at: 1 },
        { id: 'g2', itemId: 'Z', kind: 'bill', qty: 300, price: 345, date: day(-40), supplier: 'Gamma', billNo: 'G/2', at: 2 }] },
  });
}
const toz = (inrKg: number) => inrKg * 0.0125 / 32.1507466;
const dayRate = (end: string, zinc: number | null) => ({ json: { status: 'success', currency: 'USD', unit: 'toz', rates: {
  [end]: { date: end, currencies: { INR: 0.0125, USD: 1 }, metals: zinc == null ? {} : { zinc: toz(zinc) } } } } });

test('B8: a lookup that fails partway keeps and saves what came back, and counts only that', async ({ page }) => {
  await loadAppWithState(page, lmeState());
  await page.evaluate(() => localStorage.setItem('sep_inv_metals_key', 'test-key'));
  await page.route('https://api.metals.dev/v1/timeseries**', route => {
    const end = new URL(route.request().url()).searchParams.get('end_date')!;
    return end === day(-60) ? route.fulfill(dayRate(end, 290)) : route.abort('internetdisconnected');
  });
  const r = await ev(page, `zincLookupBillLme(null)`) as any;
  expect(r.n).toBe(1);
  expect(r.note).toContain('LME was found for 1 of the 2 bill dates before it stopped, and kept.');
  await expect(page.locator('.inv-toast').last()).toContainText('LME was found for 1 of the 2 bill dates');
  await expect.poll(async () => (await readStoredState(page)).zinc.lmeHistory[day(-60)]).toBe(290);
});

test('B8: a date metals.dev answers with no zinc is not counted as looked up', async ({ page }) => {
  await loadAppWithState(page, lmeState());
  await page.evaluate(() => localStorage.setItem('sep_inv_metals_key', 'test-key'));
  await page.route('https://api.metals.dev/v1/timeseries**', route => {
    const end = new URL(route.request().url()).searchParams.get('end_date')!;
    return route.fulfill(dayRate(end, end === day(-60) ? 290 : null));
  });
  const r = await ev(page, `zincLookupBillLme(null)`) as any;
  expect(r).toEqual({ n: 1, note: 'metals.dev had no zinc rate for 1 of the 2 bill dates.' });
});

/* ---------- B9: the zinc rate's age ---------- */
test('B9: a zinc rate set late yesterday reads a day old this morning', async ({ page }) => {
  await loadAppWithState(page, state({ zinc: { ratePerKg: 400, premiumPerKg: 20, upliftPct: 10.5, basis: 'manual', updatedAt: Date.now(), source: '' } }));
  // A minute before midnight, on the page's own clock: under 24 hours ago, but yesterday.
  await ev(page, `S.zinc.updatedAt = new Date(new Date().setHours(0, 0, 0, 0)).getTime() - 60000; renderZincCard()`);
  expect(await ev(page, `zincAgeDays()`)).toBe(1);
  await expect(page.locator('#homeZincCard [data-zinc-age]')).toContainText('updated 1 day ago');
});

/* ---------- B10: a version 4 compound file ---------- */
test('B10: a version 4 compound file (4096-byte sectors) reads cell for cell as the version 3 file it holds', async ({ page }) => {
  await loadAppWithState(page, state());
  const v3 = fs.readFileSync(JUL);
  const wb = Buffer.from(await page.evaluate(b64 => {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return Array.from((window as any)._xlsCfbStream(u.buffer, ['Workbook', 'Book']) as Uint8Array);
  }, v3.toString('base64')));
  expect(wb.length).toBeGreaterThan(4096);
  const want = await xlsRows(page, v3);
  expect(want.startsWith('[')).toBe(true);
  expect(await xlsRows(page, compound(wb, 12))).toBe(want);
  // The builder is sound: the same stream in a version 3 container reads the same.
  expect(await xlsRows(page, compound(wb, 9))).toBe(want);
});

/* ---------- B11: dates written as Excel day numbers ---------- */
test('B11: a statement whose dates are Excel day numbers imports, and one with no date to read says so', async ({ page }) => {
  await loadAppWithState(page, state());
  await openFinance(page, 'bank');
  const file = compound(workbook([['Account No :', '001XXXXXXXX777'], HEAD,
    [serial(day(-3)), serial(day(-3)), 'NEFT-UTR2-ALPHA FORGINGS', '', '', '5,000.00', '1,05,000.00Cr'],
    [serial(day(-5)), serial(day(-5)), 'SMS CHARGES', '', '100.00', '', '1,00,000.00Cr']]), 9);
  await importBuffer(page, file);
  await expect(page.locator('.inv-toast').last()).toContainText('2 rows added');
  const rows = (await readStoredState(page)).bank.rows.map((r: any) => [r.date, r.narration]);
  expect(rows).toEqual([[day(-5), 'SMS CHARGES'], [day(-3), 'NEFT-UTR2-ALPHA FORGINGS']]);

  const none = compound(workbook([HEAD, ['N/A', 'N/A', 'SMS CHARGES', '', '100.00', '', '1,00,000.00Cr']]), 9);
  await importBuffer(page, none);
  await expect(page.locator('.inv-toast').last()).toContainText('No transaction could be read: the first TRAN DATE reads "N/A", which is not a date');
  expect((await readStoredState(page)).bank.imports).toHaveLength(1);
});

/* ---------- BB1: a chart tap that moves the Overview reads its figure out ---------- */
function overviewRows() {
  seq = 0;
  return [row(ym(-2) + '-02', 'NEFT-UTR1-ALPHA FORGINGS', 0, 90000, { cat: 'receipt', clientId: 1 }, 190000),
    row(ym(-2) + '-12', 'BIJLI BIL JBVNL', 6000, 0, undefined, 184000), row(ym(-2) + '-20', 'SELF', 4000, 0, undefined, 180000),
    row(ym(-1) + '-12', 'BIJLI BIL JBVNL', 7000, 0, undefined, 173000), row(ym(-1) + '-19', 'SELF', 5000, 0, undefined, 168000),
    row(ym(-1) + '-25', 'NEFT-UTR2-ALPHA FORGINGS', 0, 20000, { cat: 'receipt', clientId: 1 }, 188000)];
}
test('BB1: a tap on a month or a slice that redraws the Overview writes its exact figure into the chart’s readout', async ({ page }) => {
  await loadAppWithState(page, state({ bank: bank(overviewRows()) }));
  await openFinance(page, 'overview');
  await page.locator('[data-action="invFinRange"][data-range="ALL"]').click();
  // The charts are folds under the heroes, shut on the phone (the tab map, TM3c): opened, they stay open across the redraws.
  for (const k of ['fin-cash', 'fin-went']) await openFoldAt(page, k);
  const pt = page.locator(`#finCash .inv-chart-pt[data-key="${ym(-2)}"]`).first();
  const ptRead = await pt.getAttribute('data-read');
  await pt.click();
  await expect(page.locator('#finMonthPick')).toHaveValue(ym(-2));
  await expect(page.locator('#finCash .inv-chart-readout')).toHaveText(ptRead!);
  // The stack's bar and the pie's slice read out the same way.
  const bar = page.locator(`#finWent rect.inv-chart-seg[data-key="${ym(-1)}"]`).first();
  const barRead = await bar.getAttribute('data-read');
  await bar.click();
  await expect(page.locator('#finMonthPick')).toHaveValue(ym(-1));
  await expect(page.locator('#finWent .inv-chart-box').first().locator('.inv-chart-readout')).toHaveText(barRead!);
  await page.locator('#finWent .inv-chart-legend-row[data-key="power"]').click();
  await expect(page.locator('#finWent .inv-chart-legend-row[data-key="power"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#finWent .inv-chart-box').nth(1).locator('.inv-chart-readout')).toHaveText('Electricity: ₹7,000.00');
});

/* ---------- BB2: nothing owed at the start is an answer ---------- */
test('BB2: a zero typed as what a client owed at the start is kept, and the figure offered stops asking', async ({ page }) => {
  seq = 0;
  await loadAppWithState(page, state({ invoices: [inv(1, day(-73), 1000), inv(2, day(-60), 5900)],
    bank: bank([row(day(-70), 'NEFT-UTR7-ALPHA FORGINGS', 0, 20000, { cat: 'receipt', clientId: 1 }), row(day(-40), 'NEFT-UTR8-ALPHA FORGINGS', 0, 3000, { cat: 'receipt', clientId: 1 })]) }));
  await openFinance(page, 'receipts');
  await page.locator('[data-recv="1"] [data-action="invBankClient"]').click();
  await expect(page.locator('[data-opening-suggest="1"]')).toBeVisible();
  await page.locator('#bankOpening').fill('0');
  await page.locator('#bankOpening').dispatchEvent('change');
  await expect(page.locator('[data-opening-suggest]')).toHaveCount(0);
  await expect(page.locator('#bankOpening')).toHaveValue('0');
  await expect(page.locator('[data-recv="1"]')).not.toContainText('owed at start not set');
  expect((await readStoredState(page)).bank.opening['1']).toMatchObject({ amount: 0, date: day(-70) });
  // Cleared, it is not set again, and the figure is offered once more.
  await page.locator('#bankOpening').fill('');
  await page.locator('#bankOpening').dispatchEvent('change');
  await expect(page.locator('[data-opening-suggest="1"]')).toBeVisible();
  expect((await readStoredState(page)).bank.opening['1']).toBeUndefined();
});

/* ---------- BB3: on account is what is left on account ---------- */
test('BB3: money on account that has since settled later invoices is not shown as on account', async ({ page }) => {
  seq = 0;
  const receipt = [row(day(-27), 'NEFT-UTR6-ALPHA FORGINGS', 0, 8000, { cat: 'receipt', clientId: 1 })];
  await loadAppWithState(page, state({ bank: bank(receipt.slice()), invoices: [inv(1, day(-27), 1000), inv(2, day(-20), 5000), inv(3, day(-10), 2000)] }));
  // 7,000 came with nothing open to pay; T/2 and T/3 took all of it.
  expect(await ev(page, `(function() { var r = bankReceivables()[0]; return [r.carried, r.onAccount, r.owed]; })()`)).toEqual([7000, 0, 0]);
  await openFinance(page, 'receipts');
  await expect(page.locator('[data-recv="1"]')).not.toContainText('on account');
  await page.locator('[data-recv="1"] [data-action="invBankClient"]').click();
  await expect(page.locator('[data-on-account]')).toContainText('₹7,000.00 came in with more than was open to pay');
  await expect(page.locator('[data-on-account]')).toContainText('None of it is on account now');

  seq = 0;
  await loadAppWithState(page, state({ bank: bank([row(day(-27), 'NEFT-UTR6-ALPHA FORGINGS', 0, 8000, { cat: 'receipt', clientId: 1 })]),
    invoices: [inv(1, day(-27), 1000), inv(2, day(-20), 5000), inv(3, day(-10), 1000)] }));
  expect(await ev(page, `(function() { var r = bankReceivables()[0]; return [r.carried, r.onAccount, r.owed]; })()`)).toEqual([7000, 1000, -1000]);
  await openFinance(page, 'receipts');
  // What is on account is one of the facts in the client's fold (its line keeps two facts, the tab map, TM3c).
  await page.locator('[data-recv="1"] [data-action="invBankClient"]').click();
  await expect(page.locator('[data-recv-fact="account"]')).toContainText('₹1,000.00');
  await expect(page.locator('[data-recv-fact="account"]')).not.toContainText('₹7,000.00');
});

/* ---------- BB4: a ninth category of money out ---------- */
test('BB4: past the eighth, money-out categories fold into one named series in the stack, and none is dropped', async ({ page }) => {
  seq = 0;
  const m = ym(-1);
  const rows = [row(ym(-2) + '-28', 'NEFT-UTR0-ALPHA FORGINGS', 0, 100000, { cat: 'receipt', clientId: 1 }),
    row(m + '-02', 'NEFT-UTR1-RAMU KUMAR', 9000, 0, { cat: 'wages', staffId: 7 }), row(m + '-03', 'SELF', 8000, 0),
    row(m + '-04', 'BIJLI BIL JBVNL', 7000, 0), row(m + '-05', 'NEFT-UTR2-ACME CHEMICALS', 6000, 0, { cat: 'supplier' }),
    row(m + '-06', 'EBANK:ABC123 GST', 5000, 0), row(m + '-07', 'CBDT TAX PAYMENT', 4000, 0),
    row(m + '-08', 'NEFT-UTR3-HARDWARE MART', 3000, 0, { cat: 'other' }), row(m + '-09', 'SMS CHARGES', 2000, 0),
    row(m + '-10', 'REJECT:000777:30:Funds insufficient', 1000, 0)];
  await loadAppWithState(page, state({ bank: bank(rows) }));
  await openFinance(page, 'overview');
  await page.locator('[data-action="invFinRange"][data-range="ALL"]').click();
  const stack = page.locator('#finWent .inv-chart-box').first();
  await expect(stack.locator('.inv-chart-key')).toHaveCount(8);
  await expect(stack.locator('.inv-chart-key').last()).toContainText('2 others: Bank charges, Returned');
  // Every rupee paid out that month is in the stack: 45,000 in all.
  const segs = await stack.locator(`rect.inv-chart-seg[data-key="${m}"]`).evaluateAll(els => els.map(e => (e as HTMLElement).dataset.read || ''));
  const total = segs.reduce((s, t) => s + Number(t.replace(/^.*₹/, '').replace(/,/g, '')), 0);
  expect(total).toBe(45000);
  await expect(stack.locator(`rect.inv-chart-cx[data-key="${m}"]`)).toHaveCount(1);
});

/* ---------- BB5: a recorded note for a client with no invoice here ---------- */
test('BB5: Record an issued note offers a client with no invoice in the book, and records it; New note does not', async ({ page }) => {
  const s = state({ invoices: [inv(1, day(-10), 5900)] }) as any;
  s.clients.push(Object.assign(client(5, 'OMEGA WORKS'), { add1: 'PLOT 9', state: 'JHARKHAND', stateCode: '20' }));
  await loadAppWithState(page, s);
  // The forms are the Credit notes dialog's, in Office → Invoices (the tab map, TM3a).
  await switchTab(page, 'pageRegister');
  await page.locator('#pageRegister [data-action="invCnList"]').click();
  await page.locator('[data-action="invCnFormOpen"][data-mode="new"]').click();
  await expect(page.locator('#cnfClient option[value="5"]')).toHaveCount(0);
  await page.locator('[data-action="invCnFormCancel"]').click();
  await page.locator('[data-action="invCnFormOpen"][data-mode="record"]').click();
  await page.locator('#cnfNum').fill('12');
  await page.locator('#cnfFy').fill('25-26');
  await page.locator('#cnfClient').selectOption('5');
  await page.locator('#cnfInv').selectOption('__typed');
  await page.locator('#cnfInvNo').fill('000321');
  await page.locator('#cnfTaxable').fill('100');
  await page.locator('[data-action="invCnFormSave"]').click();
  // A 25-26 note dated today is outside its series' year: the save asks first (P123, seriesFyAsk).
  expect(await answerAsk(page, 'ok')).toContain('25-26');
  const notes = (await readStoredState(page)).creditNotes;
  expect(notes).toHaveLength(1);
  expect(notes[0]).toMatchObject({ clientId: 5, clientName: 'OMEGA WORKS', displayNumber: 'CN/012/25-26', againstInvoice: '000321', recorded: true });
});
