import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, switchTab, todayIso, waitForBoot, type SepState } from './fixtures';

// P125: the QA audit of Stock (30 Sep 2026). Each test pins one finding (G6-1 … G6-12) so it cannot come back. The
// supervisor's messages are the real ones' shapes and figures (chemical names and quantities are not private), every
// date is built from today, and suppliers are made up.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function iso(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// dd/mm/yy/ as the supervisor writes a date; `years` moves it (a header a year off).
function dmy(n: number, years = 0): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + n);
  d.setFullYear(d.getFullYear() + years);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2) + '/';
}

const line = (id: string, name: string, key: string, unit: string, basis = 'draw') => ({ id, name, key, unit, basis, aliases: [], active: true, createdAt: 1 });
function withStock(items: any[], entries: any[], extra: any = {}): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.stock = { items, entries, pastes: [] };
  return Object.assign(s, extra);
}

/* The supervisor's message of 23–24 Sep, and the next one, 25–28 Sep, as sent: the second is the one the audit found
   misread. Here they end four days ago and today. */
const MSG_2324 = () => `Camical use camical stock ${dmy(-5)} ${dmy(-4).slice(0, 8)}

1) ZINK add ${dmy(-4)} 495 kg use
berral & vat a1. 51 kg
available 444 kg

2) Q558 add ${dmy(-4)} 60 kg use 2 kg available 58 kg

3) 16 SOLLT 30 KG

4) 106 SOLLT add 50 kg +20 kg=70 kg available

5) CYNEDE 10 kg

6) MONICOL 2 KG

7) BRIGHTNER add 120 LTR + 50=170 LTR use 12 LTR 158 LTR
available

8) 65 M add 60+3=63-9 =54 LTR available

9) 65 R 15 LTR available

10) A SOLLT 48-12=36 LTR

11) BORIC ACID 18-6=12 KG

12) B SOLLT 80 KG

13) SPRAY add 24-6=18 nos

14) 70-10=60 LTR

15) HCL 360-200=160 LTR
.`;

const MSG_2528 = () => `Chemical used chemical stock ${dmy(-3)} ${dmy(-2)}${dmy(-1)}${dmy(0)}

1) ZINK 444 KG  use VAT A 2 / ${dmy(-3)} 150 kg VAT 1 / ${dmy(0)} 175 kg berral use 75 kg available 44 kg

2) Q558 58KG - DAY & NIGHT use 4 day 16 kg
available 42 kg

3) 16 SOLLT use ${dmy(-3)} 30-20 available 10 kg

4) 106 SOLLT 70 kg ${dmy(-3).slice(0, 8)} use V A 1 20 KG available 50 kg

5) cyanide 10 kg use V A1 00 KG

6) MONICOL  2 KG

7) BRIGHTER 158 LTR - 20 LTR available 138 LTR

8) 65 M 54 LTR use 3+3+9=15 available 39 LTR

9) 65 R 15 LTR use 6
available 9 LTR

10) A SOLLT 36 LTR use 12 available 24 LTR

11) BORIC ACID 12 KG
use 12 KG 00 KG

12) B SOLLT 80 KG use
${dmy(0)} 80 KG 00

13) SPRAY 18 -2= 16 NOS

14) NITRIC ACID 60-16
available 44 LTR

15) HCL 160-100=60 LTR`;

// Every line read as [O, A, U, C] (opening, received, used, left), by its number.
const readAll = (page: Page, text: string) => g(page, `(function(){ var p = parseStockMessage(${JSON.stringify(text)}), o = {};
  p.lines.forEach(function(l){ o[l.n] = { key: l.key, f: [l.O, l.A, l.U, l.C], useFrom: l.useFrom || null, useDate: l.useDate, note: l.note, unread: l.unread,
    red: l.issues.filter(function(i){ return i.level === 'red'; }).map(function(i){ return i.text; }) }; });
  return o; })()`) as Promise<any>;
const readLine = (page: Page, body: string) => g(page, `(function(){ var l = parseStockLine(${JSON.stringify(body)});
  return { f: [l.O, l.A, l.U, l.C], unread: l.unread, red: l.issues.filter(function(i){ return i.level === 'red'; }).map(function(i){ return i.text; }), note: l.note }; })()`) as Promise<any>;

// The 24 Sep closing, as the 23–24 Sep message left every line: the next message's openings agree with it.
const LINES_2528 = [
  ['Z', 'Zinc', 'ZINC', 'kg', 444, 'charge'], ['Q', 'Q558', 'Q558', 'kg', 58], ['S16', '16 Salt', '16 SALT', 'kg', 30], ['S106', '106 Salt', '106 SALT', 'kg', 70],
  ['CY', 'Cyanide', 'CYANIDE', 'kg', 10], ['MO', 'Monicol', 'MONICOL', 'kg', 2], ['BR', 'Brightener', 'BRIGHTENER', 'L', 158], ['M65', '65 M', '65 M', 'L', 54],
  ['R65', '65 R', '65 R', 'L', 15], ['AS', 'A Salt', 'A SALT', 'L', 36], ['BA', 'Boric Acid', 'BORIC ACID', 'kg', 12], ['BS', 'B Salt', 'B SALT', 'kg', 80],
  ['SP', 'Spray', 'SPRAY', 'nos', 18], ['NA', 'Nitric Acid', 'NITRIC ACID', 'L', 60], ['HC', 'HCL', 'HCL', 'L', 160],
] as const;
function closing2324(): SepState {
  return withStock(LINES_2528.map(l => line(l[0], l[1], l[2], l[3], (l[5] as string) || 'draw')),
    LINES_2528.map((l, i) => ({ id: 'c' + i, itemId: l[0], kind: 'count', qty: l[4], date: iso(-4), at: 1, seq: 3, source: 'paste' })));
}

async function openLines(page: Page) {
  await switchTab(page, 'pageStock');
}
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockPaste"]').first().click();
  await page.locator('#stockPasteText').fill(text);
  await page.locator('#stockBy').fill('Owner');
  await page.locator('[data-action="invStockRead"]').click();
}

/* ---------- G6-1: the stock record starts with the first use, and a period with nothing drawn is filled ---------- */
test('G6-1: a delivery dated before any use does not start the stock record; the days before the first use are filled', async ({ page }) => {
  // One past purchase entered by hand as a delivery, eighty days back (the real book's 6 Jul), and use recorded only from
  // five days ago. The delivery says nothing about what was used.
  await loadAppWithState(page, withStock([line('Q', 'Q558', 'Q558', 'kg'), line('ST', 'Steelex K-20', 'STEELEX K 20', 'kg'), line('Z', 'Zinc', 'ZINC', 'kg', 'charge')], [
    { id: 'r0', itemId: 'ST', kind: 'received', qty: 30, price: 111, supplier: 'Alpha Chem', billNo: 'A/1', billDate: iso(-80), date: iso(-80), at: 1, seq: 1, source: 'manual' },
    { id: 'b0', itemId: 'Q', kind: 'bill', qty: 50, price: 300, amount: 15000, supplier: 'Alpha Chem', billNo: 'A/2', billDate: iso(-70), date: iso(-70), at: 2, seq: 0 },
    { id: 'u1', itemId: 'Q', kind: 'used', qty: 10, days: 3, from: iso(-5), date: iso(-2), at: 3, seq: 2 },
    { id: 'z1', itemId: 'Z', kind: 'charged', qty: 50, days: 3, from: iso(-5), date: iso(-2), at: 3, seq: 2 },
  ], { zinc: { ratePerKg: 400, premiumPerKg: 20, upliftPct: 10.5, basis: 'manual', updatedAt: Date.now(), source: '' } }));
  const r: any = await g(page, `(function(){ var c = liveCost('${iso(-60)}', '${todayIso()}', 10000), o = { model: stockCfg().chemModel, first: stockShortDate('${iso(-5)}') };
    c.rows.forEach(function(x){ o[x.key] = { amount: x.amount, measured: x.measured, note: x.note, fills: x.detail.filter(function(d){ return d.fill; }).map(function(d){ return d.label; }) }; });
    return o; })()`);
  // 61 days in the period; the record covers the six from the first use's window on. The rest, at the model.
  const fill = `Not recorded: 55 of 61 days before the stock record starts (${r.first})`;
  expect(r.chem.fills).toEqual([fill]);
  expect(r.zinc.fills).toEqual([fill]);
  expect(r.chem.measured).toBe(3000);
  expect(r.chem.amount).toBeCloseTo(3000 + r.model * 10000 * 55 / 61, 1);
  expect(r.chem.note).toContain('55 days at the model');
});

test('G6-1: a period with no chemical drawn in it is filled whole at the model, never read as ₹0', async ({ page }) => {
  await loadAppWithState(page, withStock([line('Q', 'Q558', 'Q558', 'kg'), line('B', 'Brightener', 'BRIGHTENER', 'L')], [
    { id: 'b0', itemId: 'Q', kind: 'bill', qty: 50, price: 300, amount: 15000, supplier: 'Alpha Chem', billNo: 'A/2', billDate: iso(-50), date: iso(-50), at: 1, seq: 0 },
    // The record began forty days back; nothing since has been drawn but a "used 0" typed for today.
    { id: 'u0', itemId: 'Q', kind: 'used', qty: 5, days: 1, from: iso(-40), date: iso(-40), at: 2, seq: 2 },
    { id: 'u1', itemId: 'Q', kind: 'used', qty: 0, days: 1, from: todayIso(), date: todayIso(), at: 3, seq: 2, source: 'manual' },
  ]));
  const c: any = await g(page, `(function(){ var r = liveCost('${iso(-3)}', '${todayIso()}', 1000).rows.find(function(x){ return x.key === 'chem'; });
    return { amount: r.amount, source: r.source, note: r.note, fills: r.detail.filter(function(d){ return d.fill; }).map(function(d){ return d.label; }), model: stockCfg().chemModel }; })()`);
  expect(c.amount).toBe(Math.round(c.model * 1000 * 100) / 100);
  expect(c.source).toBe('model');
  expect(c.note).toBe('no chemical used in this period · filled at the model');
  expect(c.fills).toEqual(['Not recorded: no chemical used in this period']);

  // Used, but on no line with a price: nothing measured either, so the same.
  await g(page, `stockData().entries.push({ id: 'u2', itemId: 'B', kind: 'used', qty: 4, days: 1, from: '${iso(-1)}', date: '${iso(-1)}', at: 4, seq: 2 })`);
  const d: any = await g(page, `(function(){ var r = liveCost('${iso(-3)}', '${todayIso()}', 1000).rows.find(function(x){ return x.key === 'chem'; });
    return { amount: r.amount, source: r.source, labels: r.detail.map(function(x){ return x.label; }) }; })()`);
  expect(d.amount).toBe(c.amount);
  expect(d.source).toBe('model');
  expect(d.labels).toContain('Brightener');
});

/* ---------- G6-2: the supervisor's shapes read as written ---------- */
test('G6-2: the 25–28 Sep message is read as written, and the 23–24 Sep one exactly as before', async ({ page }) => {
  await loadAppWithState(page, withStock([], []));
  const a = await readAll(page, MSG_2528());
  const f = (n: number) => a[n].f;
  // Zinc: every part of the use clause, 150 + 175 + 75, not the 2 of "VAT A 2"; its dates are not quantities.
  expect(f(1)).toEqual([444, null, 400, 44]);
  expect([a[1].useFrom, a[1].useDate]).toEqual([iso(-3), iso(0)]);
  expect(a[1].note).toBe('VAT A2 VAT A1 berral');
  expect(f(4)).toEqual([70, null, 20, 50]);                 // "V A 1 20 KG": 20 used, not 1
  expect(f(8)).toEqual([54, null, 15, 39]);                 // "54 LTR use 3+3+9=15": 54 the opening, 15 the use
  expect(f(2)).toEqual([58, null, 16, 42]);
  expect(f(3)).toEqual([30, null, 20, 10]);
  expect(a[3].useDate).toBe(iso(-3));
  expect(f(5)).toEqual([null, null, 0, 10]);
  expect(f(6)).toEqual([null, null, null, 2]);
  expect(f(7)).toEqual([158, null, 20, 138]);
  expect(f(9)).toEqual([15, null, 6, 9]);
  expect(f(10)).toEqual([36, null, 12, 24]);
  expect(f(11)).toEqual([12, null, 12, 0]);                 // "use 12 KG 00 KG": 12 used, nothing left
  expect(f(12)).toEqual([80, null, 80, 0]);
  expect(a[12].useDate).toBe(iso(0));
  expect(f(13)).toEqual([18, null, 2, 16]);
  expect(f(14)).toEqual([60, null, 16, 44]);
  expect(f(15)).toEqual([160, null, 100, 60]);
  for (const n of Object.keys(a)) { expect(a[n].unread, 'line ' + n).toEqual([]); expect(a[n].red, 'line ' + n).toEqual([]); }

  // The message the parser was built on reads exactly as it did.
  const b = await readAll(page, MSG_2324());
  expect(Object.keys(b).map(n => [+n, b[n].key, ...b[n].f])).toEqual([
    [1, 'ZINC', null, 495, 51, 444], [2, 'Q558', null, 60, 2, 58], [3, '16 SALT', null, null, null, 30], [4, '106 SALT', 20, 50, null, 70],
    [5, 'CYANIDE', null, null, null, 10], [6, 'MONICOL', null, null, null, 2], [7, 'BRIGHTENER', 50, 120, 12, 158], [8, '65 M', 3, 60, 9, 54],
    [9, '65 R', null, null, null, 15], [10, 'A SALT', 48, null, 12, 36], [11, 'BORIC ACID', 18, null, 6, 12], [12, 'B SALT', null, null, null, 80],
    [13, 'SPRAY', null, 24, 6, 18], [14, '', 70, null, 10, 60], [15, 'HCL', 360, null, 200, 160]]);
  expect(b[1].note).toBe('berral vat a1');
});

test('G6-2: the older real shapes: an area\'s number is not a quantity, and a use can carry the balance after it', async ({ page }) => {
  await loadAppWithState(page, withStock([], []));
  const cases: [string, (number | null)[]][] = [
    // Barrel 75 then 175 left, VAT A2 25 then 150 left; the last clause names an area and nothing used yet.
    [`ZINK 250 KG use berral ${dmy(-5)} 75 kg=175 use VAT 2 ${dmy(-3)} -25kg =150 kg ${dmy(0)} use V A1`, [250, null, 100, 150]],
    ['16 SOLLT  add 50+40= 90 kg use V A 2-40=50 KG', [40, 50, 40, 50]],
    ['CYNEDE 55-25=30 KG use V A 1 15KG V A 2 10 KG', [55, null, 25, 30]],
    ['106 SOLLT 20-20 KG use V A 1=00', [20, null, 20, 0]],
    ['ZINK add 150 KG use V A 1 150 KG 00', [null, 150, 150, 0]],
    ['ZINK 149-149=00 KG VAT A 2 USE', [149, null, 149, 0]],
    ['16 SOLLT 50-10=40 use V A 2', [50, null, 10, 40]],
    // A figure with its unit after it stays a figure: 2 kg used in VAT.
    ['65 R 15 LTR use VAT 2 kg available 13 LTR', [15, null, 2, 13]],
  ];
  for (const [body, want] of cases) {
    const r = await readLine(page, body);
    expect(r.f, body).toEqual(want);
    expect(r.unread, body).toEqual([]);
    expect(r.red, body).toEqual([]);
  }
});

test('G6-2: pasted after the 23–24 Sep closing, the 25–28 Sep message balances on every line and saves 400 kg of zinc, bath by bath', async ({ page }) => {
  await loadAppWithState(page, closing2324());
  await paste(page, MSG_2528());
  await expect(page.locator('#stockReview [data-line]')).toHaveCount(15);
  await expect(page.locator('#stockReview [data-tone="red"]')).toHaveCount(0);
  await expect(page.locator('#stockReview [data-line="1"]')).toContainText('opening 444 · −400 used');
  await expect(page.locator('#stockReview [data-line="8"]')).toContainText('opening 54 · −15 used');
  await page.locator('[data-action="invStockSavePaste"]').click();
  const lv = await g(page, `(function(){ var o = {}; stockData().items.forEach(function(i){ o[i.id] = stockReplay(i.id).level; }); return o; })()`) as any;
  expect([lv.Z, lv.M65, lv.S106, lv.BA, lv.BS, lv.CY]).toEqual([44, 39, 50, 0, 0, 10]);
  const z = (await readStoredState(page)).stock.entries.filter((e: any) => e.itemId === 'Z' && e.kind === 'charged');
  const days = await g(page, `stockWorkingDays('${iso(-3)}', '${iso(0)}')`);
  // Each bath's charge on the day the message gives it; the barrel's, undated, over the message's window (PP3). The note is
  // each part's bath as written, as it always was the line's.
  expect(z.map((e: any) => [e.qty, e.from, e.date, e.days, e.lines, e.note])).toEqual([
    [150, iso(-3), iso(-3), 1, ['vat-a2'], 'VAT A2'],
    [175, iso(0), iso(0), 1, ['vat-a1'], 'VAT A1'],
    [75, iso(-3), iso(0), days, ['barrel'], 'BARREL']]);
});

/* ---------- G6-3: a correction replays where the entry stood ---------- */
test('G6-3: a corrected use replays where it stood, before the day\'s closing count', async ({ page }) => {
  const t = Date.now() - 3600000;
  await loadAppWithState(page, withStock([line('N', 'Nitric Acid', 'NITRIC ACID', 'L')], [
    { id: 'O1', itemId: 'N', kind: 'count', qty: 100, date: iso(-1), at: t, seq: 3, source: 'manual' },
    { id: 'U1', itemId: 'N', kind: 'used', qty: 30, days: 1, from: iso(-1), date: iso(-1), at: t + 1000, seq: 2, source: 'manual' },
    { id: 'C1', itemId: 'N', kind: 'count', qty: 70, date: iso(-1), at: t + 2000, seq: 3, source: 'manual' },
  ]));
  await openLines(page);
  await page.locator('#stockLines [data-action="invStockOpen"]').filter({ hasText: 'Nitric Acid' }).first().click();
  await page.locator('#stockEntries [data-action="invStockCorrect"][data-id="U1"]').click();
  await answerAsk(page, 'ok', '25');
  // The closing count still closes the day: 70, with its gap now 75 expected against 70 counted.
  expect(await g(page, `stockReplay('N').level`)).toBe(70);
  await expect(page.locator('#stockLevel')).toContainText('70');
  await expect(page.locator('#stockEntries [data-entry="C1"]')).toContainText('The app expected 75');
});

/* ---------- G6-4: an unknown level stays unknown ---------- */
test('G6-4: a line never counted is not Out, and a use leaves an unknown level unknown', async ({ page }) => {
  await loadAppWithState(page, withStock([line('G', 'Hand Gloves', 'HAND GLOVES', 'nos'), line('K', 'Q558', 'Q558', 'kg'), line('M', 'Monicol', 'MONICOL', 'kg')], [
    // Bills and a "used 0" typed by hand, never counted: the real book's gloves, 2203 C and Zincbrite.
    { id: 'gb', itemId: 'G', kind: 'bill', qty: 100, price: 50, amount: 5000, supplier: 'Beta Safety', billNo: 'B/9', billDate: iso(-20), date: iso(-20), at: 1, seq: 0 },
    { id: 'gu', itemId: 'G', kind: 'used', qty: 0, days: 1, from: todayIso(), date: todayIso(), at: 2, seq: 2, source: 'manual' },
    // Use on record, no count yet.
    { id: 'ku', itemId: 'K', kind: 'used', qty: 12, days: 4, from: iso(-4), date: iso(-1), at: 3, seq: 2 },
    { id: 'mc', itemId: 'M', kind: 'count', qty: 50, date: iso(-2), at: 4, seq: 3 },
    { id: 'mu', itemId: 'M', kind: 'used', qty: 2, days: 1, from: iso(-1), date: iso(-1), at: 5, seq: 2 },
  ]));
  const r: any = await g(page, `(function(){ var o = {};
    ['G', 'K', 'M'].forEach(function(id){ var s = stockStatus(stockItem(id)); o[id] = { level: s.level, group: s.group, tone: s.tone, word: stockStatusWord(s) }; });
    o.out = stockOutCount();
    o.tasks = todoAppAll(['stock']).map(function(t){ return t.key; });
    o.reorder = stockReorderList().groups.reduce(function(a, gr){ return a.concat(gr.rows.map(function(x){ return x.item.id; })); }, []);
    return o; })()`);
  expect(r.G).toMatchObject({ level: null, group: 'none', tone: 'none' });
  expect(r.K).toMatchObject({ level: null, group: 'none', word: 'Not counted' });
  expect(r.M.level).toBe(48);
  expect(r.out).toBe(0);
  expect(r.tasks).toEqual([]);
  expect(r.reorder).not.toContain('G');
  await openLines(page);
  await expect(page.locator('#stockTiles [data-v="out"] .inv-tile-value')).toHaveText('0');
  // A count gives the line its level, and the uses after it take from that.
  await g(page, `stockData().entries.push({ id: 'kc', itemId: 'K', kind: 'count', qty: 40, date: '${todayIso()}', at: 9, seq: 3 })`);
  expect(await g(page, `stockReplay('K').level`)).toBe(40);
});

/* ---------- G6-5: Add its bill on the hand form ---------- */
test('G6-5: Add its bill on a delivery in the hand form\'s day list opens the bill under it, and the form stays', async ({ page }) => {
  await loadAppWithState(page, withStock([line('Q', 'Q558', 'Q558', 'kg')], [{ id: 'q0', itemId: 'Q', kind: 'count', qty: 10, date: iso(-3), at: 1, seq: 3 }]));
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
  await page.locator('[data-stock-qty="Q"]').fill('60');
  await page.locator('#stockManSupplier').fill('Alpha Chem');
  await page.locator('#stockManBill').fill('A/77');
  await page.locator('[data-action="invStockSaveManual"]').click();
  const day = page.locator('#stockDayEntries');
  await day.locator('[data-action="invStockBillOpen"]').click();
  // The bill opens under its delivery, on the form: the company and invoice come from the delivery.
  const form = day.locator('#stockBillForm');
  await expect(form).toBeVisible();
  await expect(form.locator('#stockBillSupplier')).toHaveValue('Alpha Chem');
  await expect(form.locator('#stockBillQty')).toHaveValue('60');
  // One primary on the screen: the form's Save.
  await expect(page.locator('#pageStock .inv-btn-primary:visible')).toHaveCount(1);
  await form.locator('#stockBillPrice').fill('250');
  await form.locator('[data-action="invStockBillSave"]').click();
  await expect(page.locator('#stockBillForm')).toHaveCount(0);
  await expect(page.locator('#stockManualList')).toBeVisible();
  await expect(day).toContainText('₹250.00/kg');
  const e = (await readStoredState(page)).stock.entries.find((x: any) => x.kind === 'received');
  expect(e).toMatchObject({ qty: 60, price: 250, amount: 15000, supplier: 'Alpha Chem', billNo: 'A/77' });
  // Nothing typed is waiting on the hand form, so it is left without being asked.
  await page.locator('[data-action="invStockBack"]').first().click();
  await expect(page.locator('#stockManualList')).toHaveCount(0);
  await expect(page.locator('[data-ui-ask]')).toHaveCount(0);
});

/* ---------- G6-6: a price of 0 is no price ---------- */
test('G6-6: a delivery typed at ₹0 a unit is saved without a price, never as a price of 0', async ({ page }) => {
  await loadAppWithState(page, withStock([line('Q', 'Q558', 'Q558', 'kg')], []));
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
  await page.locator('[data-stock-qty="Q"]').fill('60');
  await page.locator('[data-stock-price="Q"]').fill('0');
  await page.locator('#stockManSupplier').fill('Alpha Chem');
  await page.locator('#stockManBill').fill('A/78');
  await page.locator('[data-action="invStockSaveManual"]').click();
  await expect(page.locator('.inv-toast').last()).toContainText('1 without a price');
  const e = (await readStoredState(page)).stock.entries.find((x: any) => x.kind === 'received');
  expect(e.price).toBeUndefined();
  expect(e.amount).toBeUndefined();
  expect(await g(page, `stockPriceAt('Q', '9999-12-31')`)).toBeNull();
});

/* ---------- G6-8: a by-hand delivery keeps its amount ---------- */
test('G6-8: a by-hand delivery keeps its amount, a correction keeps price and amount in step, and Payments counts it', async ({ page }) => {
  await loadAppWithState(page, withStock([line('Q', 'Q558', 'Q558', 'kg'), line('B', 'Brightener', 'BRIGHTENER', 'L')], [
    // A bill entered by its amount: ₹1,000 for 3 L, so ₹333.3333 a litre worked out from it.
    { id: 'bb', itemId: 'B', kind: 'bill', qty: 3, price: 333.3333, amount: 1000, supplier: 'Alpha Chem', billNo: 'A/5', billDate: iso(-9), date: iso(-9), at: 1, seq: 0, source: 'manual' },
  ]));
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
  await page.locator('[data-stock-qty="Q"]').fill('60');
  await page.locator('[data-stock-price="Q"]').fill('250');
  await page.locator('#stockManSupplier').fill('Alpha Chem');
  await page.locator('#stockManBill').fill('A/79');
  await page.locator('[data-action="invStockSaveManual"]').click();
  let st = (await readStoredState(page)).stock.entries;
  const rec = st.find((x: any) => x.kind === 'received');
  expect(rec).toMatchObject({ qty: 60, price: 250, amount: 15000 });
  // Corrected to 50: the price per unit typed stays, the amount follows.
  await page.locator(`#stockDayEntries [data-action="invStockCorrect"][data-id="${rec.id}"]`).click();
  await answerAsk(page, 'ok', '50');
  // The bill entered by its amount: the amount on the paper stays, the price per unit follows.
  await g(page, `void stockCorrect('bb')`);
  await answerAsk(page, 'ok', '4');
  st = (await readStoredState(page)).stock.entries;
  expect(st.find((x: any) => x.corrects && x.corrects.id === rec.id)).toMatchObject({ qty: 50, price: 250, amount: 12500 });
  expect(st.find((x: any) => x.corrects && x.corrects.id === 'bb')).toMatchObject({ qty: 4, price: 250, amount: 1000 });
});

test('G6-8: a delivery entered by hand before its amount was kept still counts in Finance → Payments → Suppliers', async ({ page }) => {
  await loadAppWithState(page, withStock([line('N', 'Nitric acid', 'NITRIC ACID', 'L')], [
    { id: 'SE1', itemId: 'N', kind: 'received', date: iso(-25), billDate: iso(-25), qty: 100, price: 150, supplier: 'Acme Chemicals', billNo: 'AC/1', at: 1, seq: 1, source: 'manual' }],
  { bank: { rows: [
    { id: 'BK-1', date: iso(-60), valueDate: iso(-60), narration: 'SMS CHARGES', chq: '', dr: 10, cr: 0, balance: 100000, dayIdx: 1, importId: 'BI-1' },
    { id: 'BK-2', date: iso(-20), valueDate: iso(-20), narration: 'NEFT-UTR5-SHREE ACME CHEMICALS', chq: '', dr: 15000, cr: 0, balance: 85000, dayIdx: 2, importId: 'BI-1', set: { cat: 'supplier' } },
    { id: 'BK-3', date: iso(-1), valueDate: iso(-1), narration: 'SMS CHARGES', chq: '', dr: 10, cr: 0, balance: 84990, dayIdx: 3, importId: 'BI-1' }],
    imports: [{ id: 'BI-1', at: 1, file: 't.xls', account: '', from: iso(-60), to: iso(-1), rows: 3, added: 3, closing: 84990 }], parties: {}, opening: {}, gstNotes: {} } }));
  await switchTab(page, 'pageFinance');
  await page.locator('[data-action="invFinTab"][data-tab="payments"]').click();
  // The suppliers' card (suppliers.js): the delivery is a bill of price × quantity, set against the supplier's payment.
  await expect(page.locator('#bankSuppliers [data-supplier]')).toContainText('Acme Chemicals');
  expect(await g(page, `(function() { var sp = suppOfName('Acme Chemicals'); return [sp.bills[0].base, sp.bank.length]; })()`)).toEqual([15000, 1]);
});

/* ---------- G6-7: an address that opens a stock sub-view ---------- */
test('G6-7: a reload keeps Enter by hand and the reorder list open, and their address', async ({ page }) => {
  await loadAppWithState(page, withStock([line('Q', 'Q558', 'Q558', 'kg')], [{ id: 'q0', itemId: 'Q', kind: 'count', qty: 10, date: iso(-3), at: 1, seq: 3 }]));
  await page.goto('/?tab=pageStock&v=manual');
  await waitForBoot(page);
  await expect(page.locator('#stockManualList')).toBeVisible();
  expect(page.url()).toContain('v=manual');
  await page.goto('/?tab=pageStock&v=reorder');
  await waitForBoot(page);
  await expect(page.locator('#stockContent .inv-pagehead-title')).toHaveText('Reorder list');
  expect(page.url()).toContain('v=reorder');
});

/* ---------- G6-9: a stock file's line fields ---------- */
test('G6-9: an imported line\'s position and spellings are checked before they reach the sheets and the matcher', async ({ page }) => {
  await loadAppWithState(page, withStock([], []));
  const added = await g(page, `JSON.stringify(stockMergeImport({ format: 'sep-stock', items: [
      { id: 'X', name: 'Boric Acid', unit: 'kg', lastPos: '<img src=x id=pwn1>', aliases: 'BORIC' },
      { id: 'Y', name: 'Nitric Acid', unit: 'L', lastPos: 14, aliases: ['NITRIC', 5, null, '<b>x</b>'] }],
    entries: [], pastes: [] }))`);
  expect(JSON.parse(added)).toMatchObject({ items: 2 });
  const it = await g(page, `stockData().items.map(function(i){ return [i.id, i.lastPos === undefined ? null : i.lastPos, i.aliases]; })`);
  expect(it).toEqual([['X', null, []], ['Y', 14, ['NITRIC', '<b>x</b>']]]);
  // A string of spellings matched any fragment of itself.
  expect(await g(page, `stockFindByKey('BOR')`)).toBeNull();
  expect(await g(page, `stockFindByKey('NITRIC').id`)).toBe('Y');

  // A position already on the device from before is printed as text, never markup, and a line's page draws.
  await g(page, `stockData().items.push({ id: 'W', name: 'Monicol', key: 'MONICOL', unit: 'kg', aliases: 'MONI', lastPos: '<img src=x id=pwn2>', active: true })`);
  await openLines(page);
  await page.locator('#stockLines [data-action="invStockOpen"]').filter({ hasText: 'Monicol' }).first().click();
  await expect(page.locator('#stockEdit')).toBeVisible();
  await g(page, `stockSheetOpen()`);
  await page.locator('[data-action="invStockSheetPreview"]').click();
  await expect(page.locator('#invPrintBody [data-sheet="stock-sup"]')).toBeVisible();
  await expect(page.locator('#invPrintBody img')).toHaveCount(0);
});

/* ---------- G6-10: Count on another day ---------- */
test('G6-10: Count on another day says the level at the end of that day, the figure its Save compares with', async ({ page }) => {
  await loadAppWithState(page, withStock([line('Q', 'Q558', 'Q558', 'kg')], [
    { id: 'q0', itemId: 'Q', kind: 'count', qty: 40, date: iso(-5), at: 1, seq: 3 },
    { id: 'q1', itemId: 'Q', kind: 'used', qty: 10, days: 1, from: iso(-2), date: iso(-2), at: 2, seq: 2 }]));
  await switchTab(page, 'pageStock');
  await page.locator('[data-action="invStockManual"]').first().click();
  const row = page.locator('#stockManualList .inv-row').filter({ hasText: 'Q558' });
  await expect(row).toContainText('app has 30 kg');
  await page.locator('#stockManDate').fill(iso(-3));
  await page.locator('#stockManDate').dispatchEvent('change');
  await expect(row).toContainText('app had 40 kg on');
  await page.locator('[data-stock-qty="Q"]').fill('40');
  await page.locator('[data-action="invStockSaveManual"]').click();
  await expect(page.locator('.inv-toast')).toHaveText('1 entry saved');
});

/* ---------- G6-11: red never above amber ---------- */
test('G6-11: Settings keeps the amber line at or above the red one', async ({ page }) => {
  await loadAppWithState(page, withStock([line('Q', 'Q558', 'Q558', 'kg')], [
    { id: 'q0', itemId: 'Q', kind: 'count', qty: 32, date: iso(-2), at: 1, seq: 3 },
    { id: 'q1', itemId: 'Q', kind: 'used', qty: 12, days: 3, from: iso(-5), date: iso(-3), at: 2, seq: 2 }]));
  await openSettingsAt(page, 'stockAlerts');
  await page.locator('#setStkRed').fill('10');
  await page.locator('#setStkAmber').fill('7');
  await page.locator('[data-action="invSaveSettingsSec"][data-sec="stockAlerts"]').click();
  await expect(page.locator('.inv-toast').last()).toContainText('Red');
  await expect(page.locator('details[data-sec="stockAlerts"]')).toHaveAttribute('data-dirty', '');
  expect((await readStoredState(page)).stockCheck || {}).not.toMatchObject({ redDays: 10 });
  // A device that saved red above amber before: an 8-day line is under its red line and in the low group, never
  // red under OK.
  await g(page, `S.stockCheck = { redDays: 10, amberDays: 7 }`);
  const s: any = await g(page, `(function(){ var s = stockStatus(stockItem('Q')); return { days: Math.round(s.daysLeft), group: s.group, tone: s.tone, amber: stockCfg().amberDays }; })()`);
  expect(s).toEqual({ days: 8, group: 'low', tone: 'red', amber: 10 });
});

/* ---------- G6-12: a message a year off ---------- */
test('G6-12: a message whose dates are a year off says so, with the year', async ({ page }) => {
  await loadAppWithState(page, closing2324());
  await paste(page, `${dmy(0).slice(0, 8)}, 2:05 pm - Supervisor One: Chemical used chemical stock ${dmy(-3, -1)} ${dmy(0, -1)}\n\n1) ZINK 444 KG use 150 kg available 294 kg`);
  const lastYear = String(Number(todayIso().slice(0, 4)) - 1);
  await expect(page.locator('#stockContent .inv-kv')).toContainText(lastYear);
  const note = page.locator('#stockWindowNote');
  await expect(note).toBeVisible();
  await expect(note).toContainText('before it was sent');
  // This year's message says nothing of the kind (Edit text goes back to the paste box).
  await page.locator('[data-action="invStockBack"]').first().click();
  await page.locator('#stockPasteText').fill(MSG_2528());
  await page.locator('[data-action="invStockRead"]').click();
  await expect(page.locator('#stockWindowNote')).toHaveCount(0);
  await expect(page.locator('#stockContent .inv-kv')).not.toContainText(todayIso().slice(0, 4));
});
