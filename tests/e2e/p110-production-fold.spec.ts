import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P110: the QA sweep's findings on Production and Stock, one test each. Messages are made up in the shop's shapes
// (P83–P90, P39); no Gemini request is made (the photo route is mocked as in P85).

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 13, name: 'KESTREL ENGINEERS PVT. LTD.', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
const STAFF = [{ id: 1, name: 'Arun', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true }];
const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const iso = (k: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dmy = (k: number) => { const s = iso(k); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}`; };
/* The day n working days (Sundays out) before today, the way the rules count. */
function wdBack(n: number) {
  for (let j = 1; j < 40; j++) {
    let c = 0;
    for (let k = -j + 1; k <= 0; k++) if (new Date(iso(k) + 'T00:00:00').getDay() !== 0) c++;
    if (c === n && new Date(iso(-j) + 'T00:00:00').getDay() !== 0) return iso(-j);
  }
  throw new Error('no day');
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const reply = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] });

async function load(page: Page, extra: any = {}) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, staff: STAFF, attendance: {}, incomingMaterial: noSeedIM(), ...extra } as SepState);
}
const prod = (entries: any[]) => ({ production: { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } });
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageProduction');
  await page.locator('#pageProduction [data-action="invProdPaste"]').click();
  await page.locator('#prodPasteText').fill(text);
  await page.locator('[data-action="invProdRead"]').click();
}
/* Every item of a paste, flattened. */
const read = (page: Page, text: string) => page.evaluate((t) => {
  const ev = (0, eval);
  return ev('parseProdPaste')(t, ev('prodCtx()')).map((m: any) => ({
    kind: m.kind, hash: m.hash, notes: m.read.notes.map((n: any) => n.text),
    items: m.read.items.map((it: any) => ({ kind: it.kind, date: it.date, time: it.time, to: it.to, clientId: it.clientId, client: it.client, part: it.part,
      gauge: it.gauge, qty: it.qty, open: it.downtime ? it.downtime.open : undefined, codes: it.issues.map((x: any) => x.tone + ':' + x.code) })) }));
}, text);
let seq = 0;
const E = (o: any) => ({ id: 'E' + (++seq), at: 1, time: '10:00', unit: 'NOS', basis: 'register', src: 'photo', kind: 'plated', line: 'vat-a1', lineSrc: 'written', slot: 'general', gauge: '40X6', clientId: 11, ...o });
const line = (id: string, part: string, qty: number, o: any = {}) => ({ id, partNumber: part, desc: part, hsn: '998873', unit: 'NOS', qty, rate: 1, amount: qty, nosQty: qty, invoiced: false, invoiceId: null, ...o });
const challan = (id: string, date: string, clientId: number, items: any[]) => ({ id, challanNo: id, challanDate: date, clientId, clientName: 'X', receivedDate: date, createdAt: 1, items });

test.describe('P110: Production', () => {
  test('P1: the same pickling text on another day is its own message; a repost the same day is read once; a paste saved before still counts', async ({ page }) => {
    await load(page);
    const msg = (k: number, at = '9:40 am') => `${dmy(k)}, ${at} - Pickler: NOVA CLAMPS\nCLAMP(40×6)\nPickling Time 9:00AM`;
    await paste(page, msg(-2));
    await page.locator('[data-action="invProdSaveReview"]').click();
    // The next day, the same words: a new load, not "saved before".
    await paste(page, msg(-1));
    await expect(page.locator('#prodDupNote')).toHaveCount(0);
    await page.locator('[data-action="invProdSaveReview"]').click();
    let s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => e.date)).toEqual([iso(-2), iso(-1)]);
    expect(s.production.pastes[1].day).toBe(iso(-1));
    // The same day again, posted later (a repost): saved before.
    await paste(page, msg(-1, '11:02 am'));
    await expect(page.locator('#prodDupNote')).toContainText('saved before');
    // A paste saved before the key carried its day (keyed on the text alone) is still recognised on its own day only.
    await page.evaluate(({ day, text }) => { const ev = (0, eval);
      ev('S.production.entries = [{ id: "L1", kind: "pickled", date: "' + day + '", clientId: 11, part: "CLAMP(40X6)", pasteId: "OLD", at: 1 }]');
      (ev('S.production.pastes') as any[]).splice(0, 9, { id: 'OLD', hash: ev('relayHash')(text), text, sentOn: day, at: 1 }); ev('prodTouch()'); }, { day: iso(-3), text: 'NOVA CLAMPS\nCLAMP(40×6)\nPickling Time 9:00AM' });
    const seen = await page.evaluate(({ a, b }) => { const ev = (0, eval);
      return [a, b].map(t => !!ev('prodPasteSeen')(ev('parseProdPaste')(t, ev('prodCtx()'))[0])); }, { a: msg(-3), b: msg(-4) });
    expect(seen).toEqual([true, false]);
  });

  test('P2: a floor line that writes its gauge into the part finds the part\'s weight; a kilo challan of it is counted in pieces', async ({ page }) => {
    await load(page, {
      clients: [{ ...CLIENTS[0], pieceWeights: [{ partNumber: 'CLAMP 133X83', gauge: '35X6', kgPerPiece: 0.2, effectiveFrom: '2026-01-01' }] }, CLIENTS[1], CLIENTS[2]],
      partWeights: { 'BRKT 9': 0.5 },
      items: [{ partNumber: 'PLATE 7', gauge: '40X6', stdWeightKg: 0.1 }, { partNumber: 'PLATE 7', gauge: '35X6', stdWeightKg: 0.3 }],
      incomingMaterial: [challan('C1', iso(-3), 11, [line('K1', 'CLAMP 133X83 (35X6)', 100, { unit: 'KG', nosQty: 0, rate: 10, amount: 1000 })])],
    });
    const r = await g(page, `[
      prodKg({ unit: 'NOS', qty: 100, clientId: 11, date: '${iso(0)}', part: 'CLAMP133X83(35X6)', gauge: '35X6' }),
      prodKg({ unit: 'NOS', qty: 100, clientId: 11, date: '${iso(0)}', part: 'CLAMP133×83(40×6)', gauge: '40X6' }),
      prodKg({ unit: 'NOS', qty: 10, clientId: 12, date: '${iso(0)}', part: 'BRKT-9', gauge: '' }),
      prodKg({ unit: 'NOS', qty: 10, clientId: 12, date: '${iso(0)}', part: 'PLATE 7 (40X6)', gauge: '40X6' }),
      prodKg({ unit: 'NOS', qty: 10, clientId: 12, date: '${iso(0)}', part: 'PLATE 7', gauge: '' }),
      prodInPlant().rows.map(function(x){ return [x.r.it.id, x.unit, x.R, x.derived]; })]`);
    expect(r[0]).toEqual({ kg: 20, src: 'client card' });
    expect(r[1]).toEqual({ kg: null, src: null });              // the card holds 35X6 only: never the other gauge's weight
    expect(r[2]).toEqual({ kg: 5, src: 'part weights' });
    expect(r[3]).toEqual({ kg: 1, src: 'items' });
    expect(r[4]).toEqual({ kg: null, src: null });              // two gauges, none written: unknown, never averaged
    expect(r[5]).toEqual([['K1', 'NOS', 500, true]]);
  });

  test('P3: plated, not invoiced is aged from the plating still open, and counts only what was captured here', async ({ page }) => {
    seq = 0;
    const state = (openDay: string) => ({
      incomingMaterial: [challan('C1', wdBack(25), 11, [line('L1', 'CLAMP 165X83 (40X6)', 1000)]), challan('C2', wdBack(25), 12, [line('L2', 'BRKT 9', 1000)])],
      invoices: [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: wdBack(10), status: 'active', invoiceState: 'dispatched', clientId: 11, clientName: 'NOVA',
        items: [{ partNumber: 'CLAMP 165X83 (40X6)', desc: '', unit: 'NOS', qty: 600, rate: 1, amount: 600, imItemId: 'L1' }], taxableValue: 600, cgstAmt: 54, sgstAmt: 54, igstAmt: 0, grandTotal: 708, gstType: 'intra', createdAt: 1 }],
      ...prod([
        E({ date: wdBack(20), part: 'CLAMP 165X83', qty: 600 }),                    // plated, then invoiced
        E({ date: openDay, part: 'CLAMP 165X83', qty: 400 }),                       // the plating still open
        E({ date: wdBack(12), clientId: 12, part: 'BRKT 9', gauge: '', qty: 500, src: 'import' }),   // imported history
        E({ date: wdBack(4), clientId: 12, part: 'BRKT 9', gauge: '', qty: 100 })]),
    });
    await load(page, state(wdBack(1)));
    const tasks = () => g(page, `todoApp(['prodPlatedUnbilled']).map(function(t){ return [t.key, t.tone, t.title]; })`);
    // Nova's open 400 were plated a working day ago: nothing yet. Durga counts its own 100, not the history's 500.
    expect(await tasks()).toEqual([['prodPlatedUnbilled:12', 'amber', 'DURGA AUTO: 100 NOS plated, not invoiced']]);
    seq = 0;
    await load(page, state(wdBack(4)));
    expect((await tasks())[0]).toEqual(['prodPlatedUnbilled:11', 'amber', 'NOVA CLAMPS PVT. LTD.: 400 NOS plated, not invoiced']);
  });

  test('P4: keeping a read-as name as written learns nothing; leaving it as read does', async ({ page }) => {
    await load(page);
    const one = (k: number) => `${dmy(k)}, 10:45 am - Pickler: Kestral Engineers\nWASHER--200 nos\nPickling time 10:40am`;
    await paste(page, one(-2));
    await expect(page.locator('[data-prod-row="0:0"]')).toHaveAttribute('data-tone', 'amber');
    await page.locator('[data-prod-client="0:0"]').selectOption('asWritten');
    await page.locator('[data-action="invProdSaveReview"]').click();
    let s = await readStoredState(page);
    expect(s.production.entries[0].clientId).toBeUndefined();
    expect(s.production.learn.clients).toEqual({});
    await paste(page, one(-1));
    await page.locator('[data-action="invProdSaveReview"]').click();
    s = await readStoredState(page);
    expect(s.production.learn.clients).toEqual({ KESTRALENGINEERS: 13 });
  });

  test('P5: a barrel list with no slash after its date is read', async ({ page }) => {
    await load(page);
    const m = await read(page, `${dmy(-1)} berral production\nDurga auto\n0101--995 NOS`);
    expect(m[0].items).toHaveLength(1);
    expect(m[0].items[0]).toMatchObject({ kind: 'plated', date: iso(-1), clientId: 12, part: '0101', qty: 995 });
  });

  test('P6: a part word in the barrel list is the part, and a first word read by its place is never learnt as a client', async ({ page }) => {
    await load(page);
    await paste(page, `${dmy(-1)}, 8:21 pm - Supervisor: ${dmy(-1)}/berral production\nLINER 1000 NOS\n${dmy(-1)}, 8:22 pm - Supervisor: ${dmy(-1)}/berral production\nKUMAR 0140--300 NOS`);
    await expect(page.locator('[data-prod-row="0:0"] .inv-verdict-text')).toContainText('no client · LINER');
    await expect(page.locator('[data-prod-row="1:0"] .inv-verdict-text')).toContainText('KUMAR (as written) · 0140');
    await page.locator('[data-prod-client="0:0"]').selectOption('11');
    await page.locator('[data-prod-client="1:0"]').selectOption('12');
    await page.locator('[data-action="invProdSaveReview"]').click();
    const s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => [e.clientId, e.part, e.qty])).toEqual([[11, 'LINER', 1000], [12, '0140', 300]]);
    expect(s.production.learn.clients).toEqual({});
  });

  test('P7: a cut and its return in two messages are one cut; a second cut never drops the first', async ({ page }) => {
    await load(page);
    const two = await read(page, `${dmy(-1)}, 11:02 am - Supervisor: Power cut 10:55am\n${dmy(-1)}, 11:20 am - Pickler: Power in 11:15 am`);
    expect(two[0].items).toEqual([expect.objectContaining({ kind: 'downtime', time: '10:55', to: '11:15', open: false })]);
    expect(two[1].notes[0]).toContain('the end of the cut at 10:55 AM');
    const one = await read(page, `${dmy(-1)}, 11:50 am - Pickler: Power cut 10:55am\nPower cut 11:30am\nPower in 11:45am`);
    expect(one[0].items.map((x: any) => [x.time, x.to, x.open])).toEqual([['10:55', null, true], ['11:30', '11:45', false]]);
    const list = await read(page, `${dmy(-1)}, 8:21 pm - Supervisor: ${dmy(-1)}/berral production\nPower cut 10:55 am\nPower cut 11:30 am\nPower in 11:45 am\nDurga auto\n0101--995 NOS`);
    expect(list[0].items.filter((x: any) => x.kind === 'downtime').map((x: any) => [x.time, x.to])).toEqual([['10:55', null], ['11:30', '11:45']]);
  });

  test('P8: two gauges of one part on the register are two runs; a ditto row stays in its run', async ({ page }) => {
    await load(page);
    const r = await g(page, `prodFromRegisterRead({ date: '${dmy(0)}', line: 'VAT A1', rows: [
      { time: '9:20', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qtyText: '108' },
      { time: '9:50', ditto: true, qtyText: '108' },
      { time: '10:10', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '35x6', qtyText: '96' }] }, prodCtx(), '${iso(0)}', {}).runs.map(function(e){ return [e.gauge, e.qty]; })`);
    expect(r).toEqual([['40X6', 216], ['35X6', 96]]);
  });

  test('P9, P19: an imported entry keeps a client id only under the name written, and a quantity written as text is refused', async ({ page }) => {
    await load(page);
    const res = await g(page, `(function(){ var r = prodMergeImport({ format: 'sep-production', entries: [
      { id: 'X1', kind: 'plated', date: '${iso(0)}', line: 'vat-a1', clientId: 11, client: 'DURGA AUTO', part: '0140', qty: 300, unit: 'NOS', at: 2 },
      { id: 'X2', kind: 'plated', date: '${iso(0)}', line: 'vat-a1', clientId: 11, client: 'Nova clamps', part: '0141', qty: 30, unit: 'NOS', at: 2 },
      { id: 'X3', kind: 'plated', date: '${iso(0)}', line: 'vat-a1', clientId: 12, part: '0142', qty: '300', unit: 'NOS', at: 2 }] });
      return { r: r, e: S.production.entries.map(function(e){ return [e.id, e.clientId]; }) }; })()`);
    expect(res.e).toEqual([['X1', 12], ['X2', 11]]);
    expect(res.r).toMatchObject({ added: 2, bad: 1 });
  });

  test('P12: the power log saves its cuts on the date set on the check', async ({ page }) => {
    await load(page);
    await page.evaluate(() => { try { localStorage.setItem('sep_inv_gemini_key', 'TEST-KEY'); localStorage.removeItem('sep_inv_prod_photo_draft'); } catch (e) {} });
    await switchTab(page, 'pageProduction');
    await page.route('https://generativelanguage.googleapis.com/**', route => route.fulfill({ contentType: 'application/json',
      body: JSON.stringify(reply({ page: 'power', rows: [{ date: dmy(-1), event: 'Power cut', time: '10:00 AM' }, { date: dmy(-1), event: 'Power in', time: '10:20 AM' }] })) }));
    await page.setInputFiles('#prodPhotoInput', { name: 'power.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('#prodPhotoPower [data-prod-cut]')).toHaveCount(1);
    await page.locator('#prodPhotoDate').fill(iso(0));
    await page.locator('#prodPhotoDate').dispatchEvent('change');
    await expect(page.locator('#prodPhotoPower [data-prod-cut="0"]')).toContainText(`${+iso(0).slice(8)} `);
    await page.locator('[data-action="invProdSavePhoto"]').click();
    const s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => [e.kind, e.date, e.time, e.to])).toEqual([['downtime', iso(0), '10:00', '10:20']]);
  });

  test('P13: one cut reported twice in one imported file is counted once; two cuts in one log stay two', async ({ page }) => {
    await load(page);
    const r = await g(page, `(function(){ prodMergeImport({ format: 'sep-production', entries: [
      { id: 'D1', kind: 'downtime', date: '${iso(0)}', time: '10:55', to: '11:15', basis: 'pickling', at: 2 },
      { id: 'D2', kind: 'downtime', date: '${iso(0)}', time: '10:56', to: '11:16', basis: 'register', at: 2 },
      { id: 'D3', kind: 'downtime', date: '${iso(0)}', time: '11:20', to: '11:30', basis: 'register', at: 2 }] });
      return prodDowntimeDay('${iso(0)}').map(function(x){ return [x.time, x.to, x.reports]; }); })()`);
    expect(r).toEqual([['10:55', '11:16', 2], ['11:20', '11:30', 1]]);
  });

  test('P14: a lone load with no client and no quantity is kept, not taken for a client', async ({ page }) => {
    await load(page);
    const m = await read(page, `${dmy(-1)}, 10:40 am - Pickler: BIG LINER\nPickling time 10:30am`);
    expect(m[0].items).toEqual([expect.objectContaining({ kind: 'pickled', part: 'BIG LINER', clientId: null, qty: null, time: '10:30' })]);
    expect(m[0].items[0].codes).toContain('red:client');
  });

  test('P15: work under a second day\'s heading in a roll is that day\'s', async ({ page }) => {
    await load(page);
    const m = await read(page, `${dmy(-2)}, 8:40 pm - Supervisor: ${dmy(-2)}/ out time\n----8:00 PM---\n---berral---\n1) ARUN\n----production----\nDurga auto 0101--400 nos\n${dmy(-1)}/ Sunday\n----6:00 PM---\n---berral---\n1) ARUN\n----production----\nDurga auto 0102--300 nos`);
    expect(m[0].items.map((x: any) => [x.part, x.date])).toEqual([['0101', iso(-2)], ['0102', iso(-1)]]);
  });

  test('P16: an incoming block keeps its time when another begins; loads with no time say so', async ({ page }) => {
    await load(page);
    const m = await read(page, `${dmy(-1)}, 10:40 am - Pickler: Incoming material time 8:45 am\nDurga auto\n0140--500 nos\nIncoming material time 10:15 am\nKestrel engineers\nNut--200 nos`);
    expect(m[0].items.map((x: any) => [x.kind, x.part, x.time])).toEqual([['arrived', '0140', '08:45'], ['arrived', 'Nut', '10:15']]);
    const p = await read(page, `${dmy(-1)}, 10:40 am - Pickler: Durga auto\n0140--500 nos\nIncoming material time 10:15 am\nKestrel engineers\nNut--200 nos`);
    expect(p[0].items[0]).toMatchObject({ kind: 'pickled', part: '0140', time: null });
    expect(p[0].items[0].codes).toContain('amber:notime');
  });

  test('P17: racks counted in two goes, less a few, are read', async ({ page }) => {
    await load(page);
    const r = await g(page, `[prodRegisterQty('3+4×156−3'), prodRegisterQty('3+4×156+2x10'), prodRegisterQty('3+4×156')]`);
    expect(r[0]).toMatchObject({ qty: 7 * 156 - 3, rounds: 7, rackSize: 156, arithmetic: 3 + 624 - 3 });
    expect(r[1]).toMatchObject({ qty: 7 * 156 + 20 });
    expect(r[2]).toMatchObject({ qty: 1092 });
  });

  test('P18: a load pickled and then plated with no challan is counted once', async ({ page }) => {
    seq = 0;
    await load(page, prod([E({ date: wdBack(2), part: 'CLAMP 90X81', qty: 300, kind: 'pickled', line: null, basis: 'pickling', src: 'paste' }), E({ date: wdBack(1), part: 'CLAMP 90X81', qty: 300 })]));
    const r = await g(page, `prodInPlant().noChallan.map(function(x){ return [x.part, x.qty, x.field, x.P, x.L]; })`);
    expect(r).toEqual([['CLAMP 90X81', 300, 'L', 300, 300]]);
  });

  test('P24: a batch of racks counts its rounds', async ({ page }) => {
    await load(page, prod([E({ id: 'R1', date: iso(0), part: 'CLAMP 165X83', qty: 1145, rounds: [
      { time: '3:00 PM', qty: 785, batch: true, written: '98×8+1', rack: 98, n: 8 }, { time: '4:00 PM', qty: 360, batch: true, written: '120x3', rack: 120, n: 3 }] })]));
    expect(await g(page, `prodDayLine('${iso(0)}', 'vat-a1').rounds`)).toBe(11);
  });

  test('P25: correcting an entry keeps its line unknown and the barrel list\'s whole day', async ({ page }) => {
    seq = 0;
    await load(page, prod([E({ id: 'U1', date: iso(0), line: null, lineSrc: null, slot: 'ot', basis: 'relay', src: 'paste', part: '0101', clientId: 12, gauge: '' }),
      E({ id: 'B1', date: iso(0), line: 'barrel', slot: 'day', basis: 'relay', src: 'paste', part: '0102', clientId: 12, gauge: '' })]));
    await switchTab(page, 'pageProduction');
    for (const id of ['U1', 'B1']) {
      await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
      await page.locator(`[data-prod-entry="${id}"] [data-action="invProdCorrect"]`).click();
      await page.locator('#prodHandQty').fill('77');
      await page.locator('[data-action="invProdSaveHand"]').click();
    }
    const s = await readStoredState(page);
    const fix = s.production.entries.filter((e: any) => e.replaces);
    expect(fix.map((e: any) => [e.replaces, e.line || null, e.lineSrc || null, e.slot, e.qty])).toEqual([['U1', null, null, 'ot', 77], ['B1', 'barrel', 'set', 'day', 77]]);
  });

  test('PB1, PB2: pickled with no open challan: a corrected load is not counted, and Open the loads lists what the rule counted', async ({ page }) => {
    seq = 0;
    await load(page, {
      incomingMaterial: [challan('C1', wdBack(20), 11, [line('L1', 'CLAMP 105X83 (40X6)', 50)])],
      ...prod([
        E({ id: 'K0', date: wdBack(2), part: 'CLAMP 70X20', qty: 100, kind: 'pickled', line: null, basis: 'pickling', src: 'paste' }),
        E({ id: 'K0B', date: wdBack(2), part: 'CLAMP 105X83', qty: 100, kind: 'pickled', line: null, basis: 'pickling', src: 'hand', replaces: 'K0' }),
        E({ id: 'K1', date: wdBack(2), part: 'CLAMP 90X81', qty: 100, kind: 'pickled', line: null, basis: 'pickling', src: 'paste' })]),
    });
    const t = await g(page, `todoApp(['prodPickledNoChallan']).map(function(t){ return [t.title, t.clears]; })`);
    expect(t[0][0]).toBe('NOVA CLAMPS PVT. LTD.: 1 load pickled with no open challan');
    expect(t[0][1]).not.toContain('map the part');
    expect(t[0][1]).toContain('Correct');
    await switchTab(page, 'pageProduction');
    await page.locator('#prodRaised [data-action="invProdTask"]').click();
    await expect(page.locator('#prodEntries [data-prod-entry]')).toHaveCount(1);
    await expect(page.locator('#prodEntries [data-prod-entry="K1"]')).toBeVisible();
  });

  test('PB3: a client read by name can be changed on the check; a changed exact name is not learnt, a changed lesson is', async ({ page }) => {
    await load(page);
    await page.evaluate(() => (0, eval)('prodData().learn.clients.KUMAR = 11'));
    await paste(page, `${dmy(-1)}, 9:40 am - Pickler: DURGA AUTO\n0140--300 nos\nPickling Time 9:00AM\n${dmy(-1)}, 9:50 am - Pickler: KUMAR\n0141--50 nos\nPickling Time 9:30AM`);
    await expect(page.locator('[data-prod-client="0:0"]')).toHaveCount(0);
    await page.locator('[data-prod-row="0:0"] [data-action="invProdRevClient"]').click();
    await page.locator('[data-prod-client="0:0"]').selectOption('13');
    await page.locator('[data-prod-row="1:0"] [data-action="invProdRevClient"]').click();
    await page.locator('[data-prod-client="1:0"]').selectOption('12');
    await page.locator('[data-action="invProdSaveReview"]').click();
    const s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => e.clientId)).toEqual([13, 12]);
    expect(s.production.learn.clients).toEqual({ KUMAR: 12 });
  });

  test('PB4, PB5: Day before steps from the day shown; the Overview\'s All N opens the loads it counts', async ({ page }) => {
    seq = 0;
    const loads = Array.from({ length: 7 }, (_, i) => E({ date: iso(-1), time: `0${i + 1}:00`, part: 'CLAMP 90X81', qty: 10, kind: 'pickled', line: null, basis: 'pickling', src: 'paste' }));
    await load(page, prod([E({ date: iso(-10), part: 'CLAMP 165X83', qty: 100 }), ...loads]));
    await switchTab(page, 'pageProduction');
    await page.locator('[data-action="invProdTab"][data-tab="lines"]').click();
    await page.locator('[data-action="invProdDay"][data-step="-1"]').click();
    const want = new Date(iso(-11) + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' });
    await expect(page.locator('.inv-stepper-sub')).toHaveText(want);
    // The Entries flag already on "Line unknown" from an earlier visit; the Overview's All N still opens it.
    await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
    await page.locator('#productionContent [data-action="invProdFilter"][data-flag="unknown"]').click();
    await page.locator('[data-action="invProdTab"][data-tab="overview"]').click();
    await page.locator('#prodUnknown [data-action="invProdFilter"][data-flag="unknown"]').click();
    await expect(page.locator('[data-action="invProdFilter"][data-flag="unknown"][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('#prodEntries .inv-panel-count')).toHaveText('7');
  });

  test('the one working-day counter and the one time parser agree with what they replace', async ({ page }) => {
    await load(page);
    const r = await g(page, `[stockWorkingDays('${iso(-13)}', '${iso(0)}') === statsWorkingDays('${iso(-13)}', '${iso(0)}'), stockWorkingDays('${iso(0)}', '${iso(-1)}'),
      prodWorkingDaysBetween('${iso(-7)}', '${iso(0)}') === statsWorkingDays('${iso(-6)}', '${iso(0)}'), typeof prodMin, relayParseHhmm('09:05')]`);
    expect(r).toEqual([true, 1, true, 'undefined', 545]);
  });
});

test.describe('P110: Stock', () => {
  test('P10, P11: a daily rate from charges too, and a day with two entries counted once', async ({ page }) => {
    await load(page);
    const r = await g(page, `(function(){ var st = stockData(), d = function(k){ return isoAddDays(localDateStr(), k); };
      st.items = [{ id: 'S1', name: 'Salt', key: 'SALT', unit: 'kg', basis: 'draw', active: true }, { id: 'S2', name: 'Nitric', key: 'NITRIC', unit: 'L', basis: 'draw', active: true }];
      var E = function(o) { return Object.assign({ at: 1, source: 'manual', days: 1 }, o); };
      st.entries = [E({ id: 'a', itemId: 'S1', kind: 'charged', qty: 10, date: d(-3) }), E({ id: 'b', itemId: 'S1', kind: 'used', qty: 20, date: d(-2) }),
        E({ id: 'c', itemId: 'S2', kind: 'used', qty: 10, date: d(-2) }), E({ id: 'd', itemId: 'S2', kind: 'used', qty: 10, date: d(-2), at: 2 })];
      return [stockRate(stockItem('S1')), stockRate(stockItem('S2'))]; })()`);
    expect(r[0]).toMatchObject({ rate: 15, days: 2 });
    expect(r[1]).toMatchObject({ rate: 20, days: 1 });
  });

  test('P21, PR: a wrapped decimal is the line above\'s; a bracketed header is month first; the hash is the one saved before', async ({ page }) => {
    await load(page);
    const r = await g(page, `(function(){
      var w = parseStockMessage('22/09/26 camical stock\\n1) HCL add 660 LTR use\\n80.5 LTR available 579.5 LTR').lines.map(function(l){ return [l.n, l.U, l.C]; });
      var b = parseStockMessage('[9/10/26, 8:15:02 PM] Supervisor: Camical stock\\n1) NITRIC 10-2=8 L');
      // The fingerprint every stock message saved before was given, worked the old way.
      var OLD = /^\\s*\\[?(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4}),?\\s+\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:[AaPp]\\.?[Mm]\\.?)?\\]?\\s*(?:-\\s*)?([^:]{1,40}):\\s*(.*)$/;
      var t = '12/9/26, 10:00 - Name:   Camical stock\\n1) NITRIC 10-2=8 L <This message was edited>', src = t.split('\\n').map(function(l){ var m = l.match(OLD); return m ? m[5] : l; }).join(' ').toUpperCase().replace(/\\s+/g, ' ').trim(), h = 5381;
      for (var i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
      return { w: w, b: [b.sentOn, b.from, b.sentBy], same: stockHash(t) === 'h' + (h >>> 0).toString(36) + src.length }; })()`);
    expect(r.w).toEqual([[1, 80.5, 579.5]]);
    expect(r.b).toEqual(['2026-09-10', '2026-09-10', 'Supervisor']);
    expect(r.same).toBe(true);
  });

  test('P20: a stock import refuses a day that is not a date, and says what it already held', async ({ page }, info) => {
    await load(page);
    await g(page, `(function(){ var st = stockData(); st.items = [{ id: 'S2', name: 'Nitric', key: 'NITRIC', unit: 'L', basis: 'draw', active: true }];
      st.entries = [{ id: 'B2', itemId: 'S2', kind: 'used', qty: 10, date: '${iso(-2)}', at: 1, source: 'manual' }]; saveState(); })()`);
    const file = info.outputPath('stock.json');
    writeFileSync(file, JSON.stringify({ format: 'sep-stock', items: [{ id: 'S2', name: 'Nitric', key: 'NITRIC' }], entries: [
      { id: 'Z1', itemId: 'S2', kind: 'used', qty: 3, date: 'yesterday' }, { id: 'Z2', itemId: 'S2', kind: 'used', qty: 4, date: iso(-1), at: 3 },
      { id: 'B2', itemId: 'S2', kind: 'used', qty: 10, date: iso(-2), at: 1, source: 'manual', voided: { at: 5 } }] }));
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invDashStockView"][data-view="list"]').click();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-action="invStockImport"]').click();
    await (await chooser).setFiles(file);
    await expect(page.locator('.inv-toast')).toContainText('1 entries · 1 already held (1 differ in the file, kept as held)');
    const ids = await g(page, `stockData().entries.map(function(e){ return e.id + (e.voided ? ':void' : ''); })`);
    expect(ids).toEqual(['B2', 'Z2']);
  });

  test('P22: the filled supervisor sheet foots for a one-day message', async ({ page }) => {
    await load(page);
    const cells = await page.evaluate((day) => { const ev = (0, eval);
      ev('stockData().items = [{ id: "T1", name: "Brightener", key: "BRIGHTENER", unit: "L", basis: "draw", active: true }]');
      ev('stockData().entries = [{ id: "T0", itemId: "T1", kind: "count", qty: 60, date: "' + ev('isoAddDays')(day, -8) + '", at: 1 }]');
      const t = day.slice(8, 10) + '/' + day.slice(5, 7) + '/' + day.slice(2, 4) + ' camical stock\n1) BRIGHTNER 70 LTR add 20 use 10 available 80 LTR';
      const p = ev('parseStockMessage')(t); p.text = t;
      ev('stockCommitPaste')(p, ev('resolveStockParse')(p, {}), { by: 'x' });
      const div = document.createElement('div'); div.innerHTML = ev('stockSheetSupHtml')(day, true);
      return Array.prototype.map.call(div.querySelectorAll('tbody tr')[0].querySelectorAll('td'), (td: any) => td.textContent);
    }, iso(-2));
    // Opening 70 + 20 − 10 = 80 available: the message's own opening, where the level before the day (60) was printed.
    expect([cells[3], cells[5], cells[6]]).toEqual(['70', '10', '80']);
    expect(cells[4]).toContain('· 20');
  });

  test('P23: changing the date of a delivery moves its invoice date', async ({ page }) => {
    await load(page);
    await g(page, `stockData().items = [{ id: 'S1', name: 'Salt', key: 'SALT', unit: 'kg', basis: 'draw', active: true }]`);
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invStockManual"]').first().click();
    await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
    await expect(page.locator('#stockManBillDate')).toHaveValue(iso(0));
    await page.locator('#stockManDate').fill(iso(-3));
    await page.locator('#stockManDate').dispatchEvent('change');
    await expect(page.locator('#stockManBillDate')).toHaveValue(iso(-3));
  });

  test('PB6: a stock message whose entries were all voided can be pasted again', async ({ page }) => {
    await load(page);
    const r = await g(page, `(function(){ var t = '23/09/26 camical stock\\n1) NITRIC 10-2=8 L', p = parseStockMessage(t); p.text = t;
      stockCommitPaste(p, resolveStockParse(p, {}), { by: 'x' });
      var before = !!resolveStockParse(p, {}).dup;
      stockData().entries.forEach(function(e) { e.voided = { at: 1, by: 'x' }; });
      return [before, !!resolveStockParse(p, {}).dup]; })()`);
    expect(r).toEqual([true, false]);
  });

  test('PR: the stock export lets its object URL go', async ({ page }) => {
    await load(page);
    await page.evaluate(() => { const w = window as any; w.__revoked = 0; const o = URL.revokeObjectURL.bind(URL); URL.revokeObjectURL = (u: string) => { w.__revoked++; o(u); }; });
    await switchTab(page, 'pageStock');
    await page.locator('[data-action="invDashStockView"][data-view="list"]').click();
    const dl = page.waitForEvent('download');
    await page.locator('[data-action="invStockExport"]').click();
    const json = JSON.parse(readFileSync(await (await dl).path(), 'utf8'));
    expect(json.format).toBe('sep-stock');
    await expect.poll(() => page.evaluate(() => (window as any).__revoked)).toBeGreaterThan(0);
  });
});
