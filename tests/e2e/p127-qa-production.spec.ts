import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P127: the QA audit of Production and Power (G4-1 … G4-16), one test each. Made-up clients, parts and workers in the
// shop's shapes (P83–P90, P115, P122); Gemini is mocked as in P85.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const T = todayIso();
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const iso = (k: number) => { const d = new Date(T + 'T00:00:00'); d.setDate(d.getDate() + k); return isoOf(d); };
const dmy = (k: number) => { const s = iso(k); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}`; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PNG2 = Buffer.concat([PNG, Buffer.from([0, 1, 2])]);
const reply = (obj: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] });
const GEMINI = 'https://generativelanguage.googleapis.com/**';

const CLIENTS = [
  { id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 13, name: 'DEV MEHTA TEST WORKS', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  { id: 14, name: 'GAMMA TEST FORGE', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  { id: 15, name: 'KAPIL PRESS WORKS', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
];
const prod = (entries: any[]) => ({ production: { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } });
async function load(page: Page, extra: any = {}) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, attendance: {}, incomingMaterial: noSeedIM(), ...extra } as SepState);
}
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageProduction');
  await page.locator('#pageProduction [data-action="invProdPaste"]').click();
  await page.locator('#prodPasteText').fill(text);
  await page.locator('[data-action="invProdRead"]').click();
}
async function openEntries(page: Page) {
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
}
/* Every item of a paste, flattened, with its issue codes. */
const read = (page: Page, text: string) => page.evaluate((t) => {
  const ev = (0, eval);
  return ev('parseProdPaste')(t, ev('prodCtx()')).map((m: any) => ({
    kind: m.kind, notes: m.read.notes.map((n: any) => n.text),
    items: m.read.items.map((it: any) => ({ kind: it.kind, date: it.date, time: it.time, to: it.to, clientId: it.clientId, part: it.part, qty: it.qty,
      codes: it.issues.map((x: any) => x.tone + ':' + x.code) })) }));
}, text);
/* A register photo read with the key set and Gemini answering `answer(n)` on its n-th request. */
async function photoBoot(page: Page, state: SepState, answer: (n: number) => unknown) {
  await loadAppWithState(page, state);
  await page.evaluate(() => { try { localStorage.setItem('sep_inv_gemini_key', 'TEST-KEY'); localStorage.removeItem('sep_inv_prod_photo_draft'); } catch (e) { /* none */ } });
  let n = 0;
  await page.route(GEMINI, async route => { n++; await route.fulfill({ contentType: 'application/json', body: JSON.stringify(reply(answer(n))) }); });
  await switchTab(page, 'pageProduction');
  return () => n;
}
const pick = (page: Page, buffer: Buffer, name = 'register.png') => page.setInputFiles('#prodPhotoInput', { name, mimeType: 'image/png', buffer });

/* SSS Mehta's gauge rules and Samarth's part rules are set by the owner's migrations on clients named so (P122). */
function ruledBook(): SepState {
  const s: any = { ...emptyState() };
  s.clients = [
    { id: 2, name: 'MEHTA TEST INDUSTRIES', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 5.4, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 1, name: 'DELTA AUTO', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 13, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 3, name: 'SAMARTH TEST CO.', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 14.5, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ];
  const line = (id: string, pn: string, desc: string | null, qty: number) => ({ id, partNumber: pn, desc, hsn: '998873', unit: 'NOS', qty, rate: 1, amount: qty, nosQty: null });
  s.incomingMaterial = [
    { id: 'IM-2', challanNo: '21', challanDate: T, clientId: 2, clientName: 'MEHTA TEST INDUSTRIES', vehicleNo: '', receivedDate: T, createdAt: recentTs(), items: [line('IM-2-0', 'CLAMP 149X83', 'CLAMP (30X6)', 3000)] },
    { id: 'IM-3', challanNo: '31', challanDate: T, clientId: 3, clientName: 'SAMARTH TEST CO.', vehicleNo: '', receivedDate: T, createdAt: recentTs(),
      items: [line('IM-3-0', '5174 5460 3302', null, 300), line('IM-3-1', '5166 5460 3303', null, 600), line('IM-3-2', '5167 5461 3302', null, 200)] },
  ];
  return s as SepState;
}

test.describe('P127: Production and Power, the QA audit', () => {
  test('G4-1: a client picked on a load carried from the one above is that load’s own, and the name is never learnt from it', async ({ page }) => {
    await load(page);
    await paste(page, `${dmy(-1)}, 10:40 am - Pickler: MEHTA
CLAMP(40×6)-300 nos
CLAMP(35×6)-400 nos
PICKLING TIME 9:00
188 CD-500 nos
PICKLING TIME 10:20`);
    const carried = page.locator('[data-prod-row="0:2"]');
    await expect(carried).toContainText('from the load above');
    await carried.locator('[data-prod-client="0:2"]').selectOption('14');
    // The loads written under MEHTA keep the name's reading; only the carried one is Gamma's.
    await expect(page.locator('[data-prod-row="0:0"] .inv-verdict-text')).toContainText('DEV MEHTA TEST WORKS');
    await expect(page.locator('[data-prod-row="0:1"] .inv-verdict-text')).toContainText('DEV MEHTA TEST WORKS');
    await expect(page.locator('[data-prod-row="0:2"] .inv-verdict-text')).toContainText('GAMMA TEST FORGE');
    await page.locator('[data-action="invProdSaveReview"]').click();
    const s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => [e.part, e.clientId])).toEqual([['CLAMP(40X6)', 13], ['CLAMP(35X6)', 13], ['188 CD', 14]]);
    // The read-as name is learnt from the loads written under it, never from the load carried to the pick.
    expect(s.production.learn.clients).toEqual({ MEHTA: 13 });
  });

  test('G4-2: a message saved, voided and saved again is still refused the third time', async ({ page }) => {
    await load(page);
    const one = `${dmy(-1)}, 10:45 am - Pickler: NOVA CLAMPS\nLiner--200 nos\nPickling time 10:40am`;
    await paste(page, one);
    await page.locator('[data-action="invProdSaveReview"]').click();
    await g(page, `S.production.entries.forEach(function(e){ e.voidedAt = 1; e.voidReason = 'read wrong'; }); prodTouch(); saveState();`);
    await paste(page, one);
    await expect(page.locator('#prodDupNote')).toHaveCount(0);
    await page.locator('[data-action="invProdSaveReview"]').click();
    await paste(page, one);
    await expect(page.locator('#prodDupNote')).toContainText('saved before');
    expect(await g(page, `S.production.entries.filter(function(e){ return !e.voidedAt; }).length`)).toBe(1);
  });

  test('G4-2: a photo saved, voided and saved again is refused the third time', async ({ page }) => {
    await photoBoot(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as SepState,
      () => ({ page: 'production', date: dmy(0), line: 'VAT A1', rows: [{ time: '9:20', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qtyText: '108' }] }));
    await pick(page, PNG);
    await page.locator('[data-action="invProdSavePhoto"]').click();
    await g(page, `S.production.entries.forEach(function(e){ e.voidedAt = 1; e.voidReason = 'read wrong'; }); prodTouch(); saveState();`);
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    await expect(page.locator('#prodPhotoDup')).toHaveCount(0);
    await page.locator('[data-action="invProdSavePhoto"]').click();
    await pick(page, PNG);
    await expect(page.locator('#prodPhotoDup')).toContainText('This photo was saved before');
    await expect(page.locator('[data-action="invProdSavePhoto"]')).toBeDisabled();
  });

  test('G4-3: Correct keeps what the hand form does not show, and the entry it corrects is no longer flagged', async ({ page }) => {
    const rounds1 = [{ time: '9:00 AM', qty: 94 }, { time: '10:00 AM', qty: 94 }, { time: '11:30 AM', qty: 112 }];
    await load(page, prod([
      { id: 'R1', kind: 'plated', date: T, time: '09:00', to: '11:30', line: 'vat-a1', lineSrc: 'written', slot: 'general', clientId: 13, client: 'MEHTA', part: 'CLAMP',
        qty: 300, unit: 'NOS', basis: 'register', src: 'photo', photoId: 'PF1', gaugeUnknown: 94, rounds: rounds1, at: 1 },
      { id: 'R2', kind: 'plated', date: T, time: '12:00', to: '13:10', line: 'vat-a2', lineSrc: 'written', slot: 'general', clientId: 11, client: 'NOVA', part: 'TINA',
        qty: 168, unit: 'NOS', basis: 'register', src: 'photo', photoId: 'PF1', partNumber: '5174 5460 3302', partSrc: 'rack', partRack: 56,
        gaugeOptions: ['25X6', '30X6'], gaugeSrc: 'rack', rounds: [{ time: '1:10 PM', qty: 168, batch: true, rack: 56, n: 3 }], at: 1 },
      { id: 'L1', kind: 'pickled', date: T, time: '08:40', clientId: 12, client: 'DURGA AUTO', part: 'BRKT 9', qty: 100, unit: 'NOS', qty2: 12.5, unit2: 'KG',
        line: 'vat-a2', lineSrc: 'set', setAt: 1, setBy: 'X', basis: 'pickling', src: 'paste', at: 1 }]));
    expect(await g(page, `todoAppAll(['prodGaugeUnknown']).map(function(t){ return t.facts[0][1]; })`)).toEqual(['1']);
    await openEntries(page);
    for (const [id, qty] of [['R1', '290'], ['R2', '160'], ['L1', '96']]) {
      await page.locator(`[data-prod-entry="${id}"] [data-action="invProdCorrect"]`).click();
      await page.locator('#prodHandQty').fill(qty);
      await page.locator('[data-action="invProdSaveHand"]').click();
      await expect(page.locator(`[data-prod-entry="${id}"]`)).toContainText('corrected');
    }
    const st = await readStoredState(page);
    const fix = (id: string) => st.production.entries.find((e: any) => e.replaces === id);
    expect(fix('R1')).toMatchObject({ qty: 290, to: '11:30', gaugeUnknown: 94, rounds: rounds1, basis: 'register' });
    expect(fix('R2')).toMatchObject({ qty: 160, to: '13:10', partNumber: '5174 5460 3302', partSrc: 'rack', partRack: 56, gaugeOptions: ['25X6', '30X6'], gaugeSrc: 'rack' });
    expect(fix('L1')).toMatchObject({ qty: 96, line: 'vat-a2', lineSrc: 'set', qty2: 12.5, unit2: 'KG' });
    // The entry corrected is no longer asked about; its correction is, once.
    expect(await g(page, `todoAppAll(['prodGaugeUnknown']).map(function(t){ return t.facts[0][1]; })`)).toEqual(['1']);
    expect(await g(page, `prodGaugeFlagged(prodIndex().byId.R1)`)).toBe(false);
    await page.locator('[data-action="invProdFilter"][data-flag="gauge"]').click();
    await expect(page.locator('#prodEntries [data-prod-entry]')).toHaveCount(1);
    await expect(page.locator('#prodEntries [data-prod-entry="R1"]')).toHaveCount(0);
  });

  test('G4-4: the line picked on the photo check is the page’s line for the part rules, and is saved as set', async ({ page }) => {
    const A2 = { page: 'production', date: dmy(0), line: null, rows: [
      { time: '10:20 AM', mark: 'START', customer: 'SAMARTH', part: 'TINA' }, { time: '11:30 AM', mark: 'END', qtyText: '3×56' }] };
    await photoBoot(page, ruledBook(), () => A2);
    const r = JSON.parse(await g(page, `JSON.stringify([{}, { line: 'vat-a2' }].map(function(ch) { var rd = prodFromRegisterRead(${JSON.stringify(A2)}, prodCtx(), null, ch);
      return [rd.line, rd.issues.map(function(x){ return x.code; }), rd.runs.map(function(e){ return [e.line, e.lineSrc, e.partNumber || null]; })]; }))`) as string);
    expect(r).toEqual([
      [null, ['line'], [[null, null, null]]],
      ['vat-a2', [], [['vat-a2', 'set', '5174 5460 3302']]]]);
    await pick(page, PNG);
    await page.locator('#prodPhotoLine').selectOption('vat-a2');
    await expect(page.locator('[data-prod-run="0"]')).toContainText('5174 5460 3302');
    await page.locator('[data-action="invProdSavePhoto"]').click();
    const e = (await readStoredState(page)).production.entries.find((x: any) => x.kind === 'plated');
    expect(e).toMatchObject({ line: 'vat-a2', lineSrc: 'set', partNumber: '5174 5460 3302', partSrc: 'rack' });
  });

  test('G4-5: a floor code written bare is the client’s part ending in it, on a load pasted now or held from before', async ({ page }) => {
    const item = (id: string, pn: string, qty: number) => ({ id, partNumber: pn, desc: 'BRACKET', hsn: '998873', unit: 'NOS', qty, rate: 1, amount: qty, nosQty: qty });
    await load(page, {
      incomingMaterial: [{ id: 'IM-1', challanNo: '41', challanDate: iso(-3), clientId: 12, clientName: 'DURGA AUTO', vehicleNo: '', receivedDate: iso(-3), createdAt: recentTs(),
        items: [item('IM-1-0', '5164 5460 4206', 1000), item('IM-1-1', '5206 4920 0160', 500)] }],
      // A load pasted before this build: its part is the code alone, with no part number.
      ...prod([{ id: 'OLD1', kind: 'pickled', date: iso(-2), time: '09:00', clientId: 12, client: 'DURGA AUTO', part: '0160', qty: 30, unit: 'NOS', basis: 'pickling', src: 'paste', pasteId: 'PP0', at: 1 }]),
    });
    expect(await g(page, `[prodAliasCode('4206'), prodAliasCode('0160'), prodAliasCode(' 0106 '), prodAliasCode('TINA(0160)'), prodAliasCode('CLAMP 165X83')]`))
      .toEqual(['4206', '0160', '0106', '0160', null]);
    // The load already held is matched once, at the start.
    expect(await g(page, `S.production.entries[0].partNumber`)).toBe('5206 4920 0160');
    await paste(page, `${dmy(-1)}, 9:40 am - Pickler: DURGA AUTO\n4206-500 nos\nPickling time 9:00am`);
    await page.locator('[data-action="invProdSaveReview"]').click();
    const e = (await readStoredState(page)).production.entries.find((x: any) => x.part === '4206');
    expect(e.partNumber).toBe('5164 5460 4206');
    // Both are set against their challans: nothing is on the floor with no challan.
    expect(await g(page, `prodInPlant().noChallan.map(function(x){ return x.part; })`)).toEqual([]);
  });

  test('G4-6: a load written in figures alone is read, a figure under its part is its quantity, and a date is a date', async ({ page }) => {
    await load(page);
    const d = dmy(-1), dd = iso(-2), dotted = `${dd.slice(8, 10)}.${dd.slice(5, 7)}.${dd.slice(2, 4)}`;
    const msgs = await read(page, `${d}, 11:40 am - Pickler: KAPIL PRESS WORKS
8201/8202
Pickling time 11:30 am
${d}, 12:40 pm - Pickler: DURGA AUTO
4206-1000
0160--30
8201/8202-600
Pickling time 12:30 pm
${d}, 1:40 pm - Pickler: NOVA CLAMPS
LINER
1000 NOS
BRACKET
3302--420 NOS
Pickling time 1:30 pm
${d}, 2:40 pm - Pickler: ${dotted}
NOVA CLAMPS
Liner--50 nos
16/9
Pickling time 2:30 pm`);
    expect(msgs.map(m => m.items.map((x: any) => [x.clientId, x.part, x.qty]))).toEqual([
      [[15, '8201/8202', null]],
      [[12, '4206', 1000], [12, '0160', 30], [12, '8201/8202', 600]],
      [[11, 'LINER', 1000], [11, 'BRACKET 3302', 420]],
      [[11, 'Liner', 50]]]);
    // The dotted date is the loads' day; a date with no year is listed, not taken for a load.
    expect(msgs[3].items[0].date).toBe(dd);
    expect(msgs[3].notes).toEqual([expect.stringContaining('A date with no year')]);
  });

  test('G4-7: a START carried under another client’s ditto takes the next round’s size', async ({ page }) => {
    await loadAppWithState(page, ruledBook());
    const carried = { page: 'production', date: dmy(0), line: 'VAT-A1', rows: [
      { time: '3:05 PM', customer: 'SAMARTH', part: 'TINA', qtyText: '50' },
      { time: '3:20 PM', mark: 'START', customer: null, part: 'CLAMP' },
      { time: '3:35 PM', qtyText: '150', ditto: true }, { time: '3:50 PM', qtyText: '150', ditto: true }] };
    const runs = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(carried)}, prodCtx(), null, {}).runs.map(function(e){ return [e.clientId, e.part, e.qty]; }))`) as string);
    expect(runs).toEqual([[3, 'TINA', 50], [2, 'CLAMP', 450]]);
  });

  test('G4-7: a run read exactly can have its client changed on the photo check, and the name read exactly is not re-pointed', async ({ page }) => {
    await photoBoot(page, ruledBook(), () => ({ page: 'production', date: dmy(0), line: 'VAT-A1', rows: [{ time: '9:20 AM', customer: 'DELTA', part: '188 CD', qtyText: '150' }] }));
    await pick(page, PNG);
    const run = page.locator('[data-prod-run="0"]');
    await expect(run).toContainText('DELTA AUTO');
    await run.locator('[data-action="invProdRunClient"]').click();
    await page.locator('#prodRunClient0').selectOption('2');
    await expect(page.locator('[data-prod-run="0"] .inv-row-title')).toContainText('MEHTA TEST INDUSTRIES');
    await page.locator('[data-action="invProdSavePhoto"]').click();
    const s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => [e.clientId, e.part])).toEqual([[2, '188 CD']]);
    expect(s.production.learn.clients).toEqual({});
  });

  test('G4-8: a power back that pairs with a cut saved before closes the cut where it is stored', async ({ page }) => {
    await load(page);
    const cut = `${dmy(-1)}, 11:02 am - Supervisor: Power cut 10:55am`;
    await paste(page, cut);
    await page.locator('[data-action="invProdSaveReview"]').click();
    let s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => [e.kind, e.time, e.to || null])).toEqual([['downtime', '10:55', null]]);
    await paste(page, `${cut}\n${dmy(-1)}, 11:20 am - Pickler: Power in 11:15 am`);
    await expect(page.locator('#prodDupNote')).toContainText('saved before');
    const save = page.locator('[data-action="invProdSaveReview"]');
    await expect(save).toBeEnabled();
    await save.click();
    s = await readStoredState(page);
    expect(s.production.entries.map((e: any) => [e.kind, e.time, e.to || null, e.downtime.open])).toEqual([['downtime', '10:55', '11:15', false]]);
  });

  test('G4-9: a run flagged gauge unknown is listed however old it is, as the To-do counts it', async ({ page }) => {
    await load(page, prod([{ id: 'GU-OLD', kind: 'plated', date: iso(-70), line: 'vat-a1', clientId: 13, client: 'MEHTA', part: 'CLAMP', qty: 94, unit: 'NOS', slot: 'general',
      basis: 'register', src: 'import', time: '09:00', gaugeUnknown: 94, at: 1 }]));
    expect(await g(page, `todoAppAll(['prodGaugeUnknown']).length`)).toBe(1);
    await openEntries(page);
    await page.locator('[data-action="invProdFilter"][data-flag="gauge"]').click();
    await expect(page.locator('#prodEntries [data-prod-entry="GU-OLD"]')).toBeVisible();
  });

  test('G4-10: a challan handed to the scanner leaves the photos picked with it waiting, and they are read on', async ({ page }) => {
    const calls = await photoBoot(page, { ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM() } as SepState, n =>
      n === 1 ? { page: 'challan', date: '18-9-26', rows: [] }
        : n === 2 ? { challanNo: '133', challanDate: T, clientName: 'Nova clamps', vehicleNo: '', items: [{ partNumber: 'DRAIN PLUG', desc: 'DRAIN PLUG', unit: 'NOS', qty: 500, nosQty: 500, rate: 0, amount: 0 }] }
          : { page: 'production', date: dmy(0), line: 'VAT A1', rows: [{ time: '9:20', customer: 'Nova clamps', part: 'CLAMP 165x83', dim: '40x6', qtyText: '108' }] });
    await page.setInputFiles('#prodPhotoInput', [{ name: 'challan.png', mimeType: 'image/png', buffer: PNG }, { name: 'page.png', mimeType: 'image/png', buffer: PNG2 }]);
    await expect(page.locator('#productionContent')).toContainText('a customer’s challan');
    await page.locator('[data-action="invProdToScanner"]').click();
    await expect.poll(() => g(page, '_challanForm && _challanForm.challanNo')).toBe('133');
    await g(page, `switchTab('pageProduction')`);
    await expect(page.locator('#prodPhotoWaiting')).toContainText('1 register photo');
    await page.locator('#prodPhotoWaiting [data-action="invProdPhotoNext"]').click();
    await expect(page.locator('#prodPhotoRuns')).toBeVisible();
    expect(calls()).toBe(3);
  });

  test('G4-11: a power cut with no time read is kept and asked about, and a guessed meridiem is said', async ({ page }) => {
    await load(page);
    const noTime = `${dmy(-1)}, 11:20 am - Pickler: Power cut\nPower in 11:15am`;
    const m = await read(page, `${noTime}\n${dmy(-1)}, 11:40 am - Pickler: Power cut 10:55\nPower in 11:30`);
    expect(m[0].items[0]).toMatchObject({ kind: 'downtime', time: null, to: '11:15' });
    expect(m[0].items[0].codes).toContain('amber:time');
    expect(m[1].items[0]).toMatchObject({ kind: 'downtime', time: '10:55', to: '11:30' });
    expect(m[1].items[0].codes).toContain('info:meridiem');
    await paste(page, noTime);
    await expect(page.locator('[data-prod-row="0:0"]')).toHaveAttribute('data-tone', 'amber');
  });

  test('G4-12: a cut entered by hand whose power came back earlier on the clock asks whether it ran overnight', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await switchTab(page, 'pagePower');
    await page.locator('[data-action="invPowerAddCut"]').first().click();
    await page.locator('#prodHandTime').fill('17:45');
    await page.locator('#prodHandTo').fill('07:30');
    await page.locator('[data-action="invProdSaveHand"]').click();
    expect(await answerAsk(page, 'cancel')).toContain('overnight');
    expect(await g(page, `prodData().entries.length`)).toBe(0);
    await page.locator('[data-action="invProdSaveHand"]').click();
    await answerAsk(page, 'ok');
    expect((await readStoredState(page)).production.entries.map((e: any) => [e.kind, e.time, e.to])).toEqual([['downtime', '17:45', '07:30']]);
  });

  test('G4-13: a month’s rate and the year read only the cuts on recorded days', async ({ page }) => {
    // The month before this one: six working days recorded, one cut on one of them and five on days with no record.
    const now = new Date(T + 'T00:00:00'), first = new Date(now.getFullYear(), now.getMonth() - 1, 1), days: string[] = [];
    for (const d = new Date(first); d.getMonth() === first.getMonth(); d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) days.push(isoOf(d));
    const rec = days.slice(0, 6), bare = days.slice(8, 13);
    const att: any = {};
    rec.forEach(d => { att[d] = { marks: { 1: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' }; });
    const cut = (id: string, date: string) => ({ id, kind: 'downtime', date, time: '12:30', to: '12:50', downtime: { cause: 'power', open: false }, basis: 'relay', src: 'paste', at: 1 });
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), attendance: att,
      staff: [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 60, active: true, onFloor: true }],
      ...prod([cut('C0', rec[0]), ...bare.map((d, i) => cut('B' + i, d))]) } as SepState);
    const a = await g(page, `(function(){ var a = powerAnalysis(), m = a.months.find(function(x){ return x.month === '${rec[0].slice(0, 7)}'; });
      return { cuts: m.cuts, recorded: m.recorded, perDay: m.perDay, costPerDay: m.costPerDay, cost1: a.cuts.find(function(c){ return c.date === '${rec[0]}'; }).cost.total, year: a.year && a.year.cuts }; })()`);
    expect(a.cuts).toBe(6);                       // every cut is listed
    expect(a.recorded).toBe(6);
    expect(a.perDay).toBeCloseTo(1 / 6, 6);       // the rate reads only the one on a recorded day
    expect(a.costPerDay).toBeCloseTo(a.cost1 / 6, 6);
    expect(a.year).toBe(1);
  });

  test('G4-14: a learnt spelling or part from a file is kept only for an id the file shows under that client’s name here', async ({ page }) => {
    await load(page);
    const learn = await g(page, `(function(){ prodMergeImport({ format: 'sep-production', entries: [
        { id: 'X1', kind: 'plated', date: '${T}', line: 'vat-a1', clientId: 12, client: 'NOVA CLAMPS', part: '0140', qty: 10, unit: 'NOS', at: 2 },
        { id: 'X2', kind: 'plated', date: '${T}', line: 'vat-a1', clientId: 11, client: 'Nova clamps', part: '0141', qty: 10, unit: 'NOS', at: 2 }],
      learn: { clients: { KUMAR: 12, NOVAK: 11 }, parts: { '12|0140|': { partNumber: 'P 0140', gauge: '', how: 'set', at: 1 }, '11|0141|': { partNumber: 'P 0141', gauge: '', how: 'set', at: 1 } } } });
      return prodData().learn; })()`);
    // The file's 12 is Nova, this book's is Durga: its lessons point at nobody here. The file's 11 is Nova here too.
    expect(learn.clients).toEqual({ NOVAK: 11 });
    expect(Object.keys(learn.parts)).toEqual(['11|0141|']);
  });

  test('G4-15: a register run past 5 PM is two runs, one on each side of the shift, and the relay’s evening figure is also reported', async ({ page }) => {
    await load(page);
    const pg = { page: 'production', date: dmy(0), line: 'VAT-A1', rows: [
      { time: '4:30 PM', customer: 'NOVA CLAMPS', part: 'CLAMP 165x83', dim: '40x6', qtyText: '72' },
      { time: '4:45 PM', ditto: true, qtyText: '72' }, { time: '5:15 PM', ditto: true, qtyText: '72' }, { time: '5:30 PM', ditto: true, qtyText: '72' }] };
    const runs = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(pg)}, prodCtx(), null, {}).runs.map(function(e){ return [e.qty, e.time, e.to, e.slot, e.rounds.length]; }))`) as string);
    expect(runs).toEqual([[144, '16:30', '16:45', 'general', 2], [144, '17:15', '17:30', 'ot', 2]]);
    const idx = await g(page, `(function(){ var rd = prodFromRegisterRead(${JSON.stringify(pg)}, prodCtx(), null, {}), p = prodData();
      rd.runs.forEach(function(e, i) { var r = Object.assign({}, e, { id: 'RG' + i }); delete r.rows; delete r.issues; delete r.clientName; p.entries.push(prodSparse(r)); });
      p.entries.push(prodSparse({ id: 'RL1', kind: 'plated', date: '${T}', line: 'vat-a1', slot: 'ot', time: '17:00', to: '20:00', clientId: 11, client: 'NOVA', part: 'CLAMP 165X83 (40X6)', gauge: '40X6', qty: 150, unit: 'NOS', basis: 'relay', src: 'paste', at: 1 }));
      prodTouch(); var i = prodIndex(); return { counted: i.counted.map(function(e){ return e.id; }).sort(), also: i.also.map(function(e){ return e.id; }) }; })()`);
    expect(idx).toEqual({ counted: ['RG0', 'RG1'], also: ['RL1'] });
  });

  test('G4-16: a power history file reads past a bill that is not an object, keeps money to the paisa, and refuses a penalty larger than the bill', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), costBills: [{ id: 'B1', kind: 'power', month: '2026-05', amount: 60000, at: 1 }] } as SepState);
    const r = await g(page, `(function(){ var r = powerImportData({ power: { bills: { '2026-04': null, '2026-05': { fixed: 3574.456, energy: 41000.333, penalty: 99999 }, '2026-06': { amount: 50000.004, duty: 1200.125 } } } }, 'hist.json');
      return { refused: r.refused, bills: S.costBills.map(function(b){ return [b.month, b.amount, b.fixed || null, b.energy || null, b.penalty || null, b.duty || null]; }) }; })()`);
    expect(r.bills).toEqual([['2026-05', 60000, 3574.46, 41000.33, null, null], ['2026-06', 50000, null, null, null, 1200.13]]);
    expect(r.refused).toBe(2);   // the bill that is not one, and the penalty larger than its bill
  });
});
