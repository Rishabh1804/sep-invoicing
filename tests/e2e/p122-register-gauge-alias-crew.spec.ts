import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, readStoredState, switchTab, todayIso, recentTs, type SepState } from './fixtures';

// P122 (owner, 30 Sep 2026): a register page's clamps take their gauge from the round's size (the owner's rule for Mehta),
// a floor name with its code in brackets is matched to the client's part and learnt, a new part under the customer's
// ditto is the same customer's, and every run names the crew who stood on its line that day. Made-up names and parts.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const T = todayIso();
function book(): SepState {
  const s: any = emptyState();
  s.clients = [
    { id: 2, name: 'MEHTA TEST INDUSTRIES', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 5.4, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 1, name: 'DELTA AUTO', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 13, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ];
  const line = (id: string, pn: string, desc: string, qty: number, unit = 'NOS') => ({ id, partNumber: pn, desc, hsn: '998873', unit, qty, rate: 1, amount: qty, nosQty: null });
  s.incomingMaterial = [
    { id: 'IM-1', challanNo: '11', challanDate: T, clientId: 1, clientName: 'DELTA AUTO', vehicleNo: '', receivedDate: T, createdAt: recentTs(),
      items: [line('IM-1-0', '5164 5460 0160', 'BRACKET', 200, 'KG'), line('IM-1-1', '5206 4920 0106', 'BRACKET', 50, 'KG'), line('IM-1-2', '5567 5450 0106', 'BRACKET', 50, 'KG')] },
    { id: 'IM-2', challanNo: '21', challanDate: T, clientId: 2, clientName: 'MEHTA TEST INDUSTRIES', vehicleNo: '', receivedDate: T, createdAt: recentTs(),
      items: [line('IM-2-0', 'CLAMP 149X83', 'CLAMP (30X6)', 3000), line('IM-2-1', 'CLAMP 165X83', 'CLAMP (40X6)', 3000)] },
  ];
  s.staff = [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
    { id: 3, name: 'Charlie', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true }];
  s.attendance = { [T]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8 }, 2: { st: 'P', area: 'vat-a1', hours: 8 }, 3: { st: 'P', area: 'vat-a2', hours: 8 } },
    extra: [{ kind: 'block', area: 'vat-a1', areas: ['vat-a1'], from: '17:00', to: '20:00', crew: [2], hours: 0 }], note: '' } };
  return s as SepState;
}
const dmy = T.slice(8, 10) + '/' + T.slice(5, 7) + '/' + T.slice(2, 4);
const A1 = { page: 'production', date: dmy, line: 'VAT-A1', rows: [
  { time: '10:00 AM', mark: 'START', customer: 'MEHTA', part: 'CLAMP' },
  { time: '10:15 AM', qtyText: '100', ditto: true }, { time: '10:30 AM', qtyText: '100', ditto: true },
  { time: '10:45 AM', qtyText: '108', ditto: true }, { time: '11:00 AM', qtyText: '108', ditto: true },
  { time: '11:40 AM', customer: null, part: 'LINER', qtyText: '90' },
  { time: '1:05 PM', customer: null, part: 'CLAMP', qtyText: '72' }, { time: '1:20 PM', qtyText: '72', ditto: true },
  { time: '5:30 PM', qtyText: '72', ditto: true }] };

test('a Mehta clamp takes its gauges from the round, a round no rule names stays apart, and a new part under a ditto keeps the customer', async ({ page }) => {
  await loadAppWithState(page, book());
  expect(await g(page, `prodData().gaugeRules.length`)).toBe(2);
  const runs = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(A1)}, prodCtx(), null, {}).runs.map(e => [e.client, e.part, (e.gaugeOptions || []).join('/'), e.qty]))`) as string);
  expect(runs).toEqual([
    ['MEHTA', 'CLAMP', '25X6/30X6', 300],   // START counts as a round of the next figure (the owner's rule of 26 Jun)
    ['MEHTA', 'CLAMP', '', 216],
    ['MEHTA', 'LINER', '', 90],
    ['MEHTA', 'CLAMP', '35X6/35X8/40X6', 216]]);
});

test('a code in brackets is the client’s part ending in it, learnt for the name; two parts ending in it are asked', async ({ page }) => {
  await loadAppWithState(page, book());
  const e1: any = { id: 'E1', kind: 'plated', date: T, line: 'vat-a2', clientId: 1, client: 'DELTA', part: 'TINA(0160)', qty: 25, unit: 'NOS', slot: 'general', basis: 'register', src: 'import', time: '10:00' };
  const e2: any = { id: 'E2', kind: 'plated', date: T, line: 'vat-a2', clientId: 1, client: 'DELTA', part: 'KUDAL(0106)', qty: 30, unit: 'NOS', slot: 'general', basis: 'register', src: 'import', time: '11:00' };
  const e3: any = { id: 'E3', kind: 'plated', date: T, line: 'vat-a2', clientId: 1, client: 'DELTA', part: 'TINA', qty: 40, unit: 'NOS', slot: 'general', basis: 'register', src: 'import', time: '12:00' };
  const r = await g(page, `prodMergeImport({ format: 'sep-production', entries: ${JSON.stringify([e1, e2, e3])} }, 'x.json')`) as any;
  expect(r.ok !== false).toBe(true);
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
  // TINA(0160) is the one part ending 0160, and TINA alone reads as it from then on.
  await expect(page.locator('[data-prod-entry="E1"]')).toContainText('= 5164 5460 0160');
  await expect(page.locator('[data-prod-entry="E3"]')).toContainText('= 5164 5460 0160');
  // KUDAL(0106) ends two parts: asked.
  await page.locator('[data-prod-entry="E2"] [data-action="invProdAlias"]').click();
  await expect(page.locator('#prodAliasPick optgroup').first()).toHaveAttribute('label', 'Ending in 0106');
  await page.locator('#prodAliasPick').selectOption('5206 4920 0106');
  await page.locator('[data-action="invProdAliasSave"]').click();
  await expect(page.locator('[data-prod-entry="E2"]')).toContainText('= 5206 4920 0106');
  const learnt = (await readStoredState(page)).production.learn.parts;
  expect(Object.values(learnt).map((x: any) => x.partNumber)).toEqual(expect.arrayContaining(['5164 5460 0160', '5206 4920 0106']));
});

test('every run names its crew from the day’s attendance, the OT block’s after 5, and the part’s trail shows who plated it', async ({ page }) => {
  await loadAppWithState(page, book());
  await g(page, `(function(){ var rd = prodFromRegisterRead(${JSON.stringify(A1)}, prodCtx(), null, {}); var p = prodData();
    rd.runs.forEach(function(e, i) { var r = Object.assign({}, e, { id: 'R' + i, date: rd.date, line: rd.line, src: 'import' }); delete r.rows; delete r.issues; delete r.clientName; p.entries.push(prodSparse(r)); });
    p.entries.push(prodSparse({ id: 'OT1', kind: 'plated', date: '${T}', line: 'vat-a1', slot: 'ot', time: '17:30', to: '17:30', clientId: 2, client: 'MEHTA', part: 'CLAMP', qty: 72, unit: 'NOS', basis: 'register', src: 'import' }));
    prodTouch(); saveState(); })()`);
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
  await expect(page.locator('[data-prod-entry="R0"] [data-prod-crew]')).toHaveText('Crew: Alfa, Bravo');
  await expect(page.locator('[data-prod-entry="OT1"] [data-prod-crew]')).toHaveText('OT crew: Bravo');
  // Clients → Performance → Materials worked: the part's trail carries each plating and its crew.
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
  await page.locator('#cpClientSelect').selectOption('2');
  const card = page.locator('[data-card="worked"]');
  await card.locator('[data-action="invCpPeriod"][data-p="mtd"]').click();
  const plated = page.locator('[data-card="worked"] [data-cp-plated]');
  await expect(plated.first()).toContainText('Crew: Alfa, Bravo');
});

// Owner, 30 Sep 2026: at Samarth a round of 56 on VAT A2 is the 3302 cover plate, 156 on A2 the 3303 cover plate, and 50 on
// VAT A1 the other 3302, the assy bracket connector. The register writes all three as TINA. Made-up client name.
function samarthBook(): SepState {
  const s: any = book();
  s.clients.push({ id: 3, name: 'SAMARTH TEST CO.', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 14.5, effectiveFrom: '2020-04-01' }], itemRates: [],
    partTimes: [{ id: 'PT-seed1', base: '517454603302', gauge: '', name: '5174 5460 3302', line: 'vat-a2', pieces: 24, plateMin: 30, at: 1, note: 'owner' },
      { id: 'PT-seed2', base: '516654603303', gauge: '', name: '5166 5460 3303', line: 'vat-a2', pieces: 80, plateMin: 30, at: 1, note: 'owner' }] });
  s._partTimes1 = true;
  const line = (id: string, pn: string, qty: number) => ({ id, partNumber: pn, desc: null, hsn: '998873', unit: 'NOS', qty, rate: 1, amount: qty, nosQty: null });
  s.incomingMaterial.push({ id: 'IM-3', challanNo: '31', challanDate: T, clientId: 3, clientName: 'SAMARTH TEST CO.', vehicleNo: '', receivedDate: T, createdAt: recentTs(),
    items: [line('IM-3-0', '5174 5460 3302', 300), line('IM-3-1', '5166 5460 3303', 600), line('IM-3-2', '5167 5461 3302', 200)] });
  s.items = [{ id: 91, partNumber: '5174 5460 3302', desc: 'BRACKET', unit: 'NOS', rate: 9 }, { id: 92, partNumber: '5167 5461 3302', desc: 'BRACKET ASSY.CONNECTOR MTG', unit: 'NOS', rate: 7.05, stdWeightKg: 0.5 }];
  s.production = { entries: [{ id: 'H1', kind: 'plated', date: T, line: 'vat-a1', clientId: 3, client: 'SAMARTH TEST CO.', part: 'Assy Bracket 3302', qty: 50, unit: 'NOS', slot: 'general', basis: 'hand', src: 'hand', time: '09:10' }],
    pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  return s as SepState;
}

test('a Samarth round names its part by its size and line, a code the rule disagrees with is said, and set times take the register’s round', async ({ page }) => {
  await loadAppWithState(page, samarthBook());
  const A2 = { page: 'production', date: dmy, line: 'VAT-A2', rows: [
    { time: '10:20 AM', mark: 'START', customer: 'SAMARTH', part: 'TINA(3303)' }, { time: '11:30 AM', mark: 'END', qtyText: '3×56' },
    { time: '3:30 PM', mark: 'START', customer: 'SAMARTH', part: 'TINA' }, { time: '4:45 PM', mark: 'END', qtyText: '3×156' }] };
  const read = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(A2)}, prodCtx(), null, {}).runs.map(e => [e.part, e.partNumber, e.qty, e.issues.filter(i => i.code === 'part').map(i => i.tone).join()]))`) as string);
  expect(read).toEqual([['TINA(3303)', '5174 5460 3302', 168, 'amber'], ['TINA', '5166 5460 3303', 468, 'info']]);
  const A1s = { page: 'production', date: dmy, line: 'VAT-A1', rows: [
    { time: '9:10 AM', mark: 'START', customer: 'SAMARTH', part: 'TINA' }, { time: '9:40 AM', qtyText: '50', ditto: true }, { time: '10:10 AM', qtyText: '50', ditto: true }] };
  const a1 = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(A1s)}, prodCtx(), null, {}).runs.map(e => [e.partNumber, e.qty]))`) as string);
  expect(a1).toEqual([['5167 5461 3302', 150]]);
  // The hand entry already in the book finds the connector by its description; the set times take the register's rounds,
  // the earlier figures kept; the connector's round is added.
  const st = await readStoredState(page);
  expect(st.production.entries.find((e: any) => e.id === 'H1').partNumber).toBe('5167 5461 3302');
  const pt = st.clients.find((c: any) => c.id === 3).partTimes;
  expect(pt.map((t: any) => [t.name, t.pieces, t.line])).toEqual([['5174 5460 3302', 56, 'vat-a2'], ['5166 5460 3303', 156, 'vat-a2'], ['5167 5461 3302', 50, 'vat-a1']]);
  expect(pt[0].history[0].pieces).toBe(24);
  // A CLAMP carried under Samarth's ditto: Samarth has never sent a clamp, and a round of 150 is Mehta's by the gauge rule.
  const carried = { page: 'production', date: dmy, line: 'VAT-A1', rows: [
    { time: '3:20 PM', customer: 'SAMARTH', part: 'TINA', qtyText: '50' }, { time: '3:35 PM', customer: null, part: 'CLAMP', qtyText: '150' },
    { time: '3:50 PM', qtyText: '150', ditto: true }] };
  const cr = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(carried)}, prodCtx(), null, {}).runs.map(e => [e.clientId, e.part, e.qty]))`) as string);
  expect(cr).toEqual([[3, 'TINA', 50], [2, 'CLAMP', 300]]);
  // A round of 50 under Mehta's clamp: none of Mehta's gauge rules names 50, and 50 on A1 is Samarth's connector. Asked.
  const whose = { page: 'production', date: dmy, line: 'VAT-A1', rows: [
    { time: '2:45 PM', customer: 'MEHTA', part: 'CLAMP', qtyText: '71' }, { time: '3:00 PM', qtyText: '50', ditto: true }] };
  const wi = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(whose)}, prodCtx(), null, {}).rows.map(r => r.issues.filter(i => i.code === 'whose').length))`) as string);
  expect(wi).toEqual([0, 1]);
  // TINA is two parts at Samarth: learning "TINA" from TINA(3303) and TINA(3302) leaves the name alone ambiguous.
  await g(page, `(function(){ prodLearnAlias(3, 'TINA(3303)', '', '5166 5460 3303', 'code'); prodLearnAlias(3, 'TINA(3302)', '', '5174 5460 3302', 'code'); })()`);
  expect(await g(page, `!!prodData().learn.parts[prodKey(3, 'TINA', '')].ambiguous`)).toBe(true);
});

// Owner, 30 Sep 2026: "sometimes two clients are done simultaneously". A round written MEHTA+GENERAL / LINER+188CD / 39+50 is
// a round of each, at the same time, in each client's own run; a ditto under one side carries that side.
test('a round shared by two clients splits into each client’s run, and a ditto under one side carries that side', async ({ page }) => {
  await loadAppWithState(page, book());
  const D = '〃';
  const shared = { page: 'production', date: dmy, line: 'VAT-A1', rows: [
    { time: '9:00 AM', mark: 'START', customer: 'MEHTA+DELTA', part: 'LINER+188CD' },
    { time: '9:20 AM', customer: D, part: D + ' + ' + D, qtyText: '39+50', ditto: true },
    { time: '9:40 AM', customer: D + ' + DELTA', part: D + ' +(0160)', qtyText: '39+15' },
    { time: '10:00 AM', customer: 'DELTA', part: '188 CD', qtyText: '150' },
    { time: '10:20 AM', customer: 'MEHTA', part: 'CLAMP', qtyText: '150' },
    { time: '10:40 AM', qtyText: '39+50' }] };
  const runs = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify(shared)}, prodCtx(), null, {}).runs.map(e => [e.clientId, e.part, e.qty, e.rounds.length]))`) as string);
  expect(runs.slice(0, 3)).toEqual([
    [2, 'LINER', 117, 3],      // START takes its own client's next figure (39), then 39 and 39
    [1, '188CD', 250, 3],      // 50 (START), 50, then 150 after the shared rounds, continuing Delta's run
    [1, '(0160)', 15, 1]]);
  // After them, one client's rounds read as before: "39+50" with one client is a round of 89.
  expect(runs.slice(3).map((r: any) => [r[0], r[2]])).toEqual([[2, 150], [2, 89]]);
  // A figure that does not split into as many shares as there are clients is asked about.
  const bad = JSON.parse(await g(page, `JSON.stringify(prodFromRegisterRead(${JSON.stringify({ ...shared, rows: [shared.rows[0], { time: '9:20 AM', customer: 'MEHTA+DELTA', part: 'LINER+188CD', qtyText: '89' }] })}, prodCtx(), null, {}).rows.map(r => r.issues.map(i => i.code)))`) as string);
  expect(bad.flat()).toContain('shared');
});

// Owner, 30 Sep 2026: a round outside the gauge rules raises a flag that is resolved by picking the gauge; a code two parts
// end in is matched with the recent challans; a figure for two parts is shared between them by the challans.
test('a round no rule names is flagged until its gauge is picked, and a code two parts end in is matched with the latest challan', async ({ page }) => {
  const s: any = book();
  const day = (n: number) => { const d = new Date(T + 'T00:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const line = (id: string, pn: string, nos: number) => ({ id, partNumber: pn, desc: 'BRACKET', hsn: '998873', unit: 'KG', qty: nos, nosQty: nos, rate: 1, amount: nos });
  s.incomingMaterial.push(
    { id: 'IM-7', challanNo: '71', challanDate: day(12), clientId: 1, clientName: 'DELTA AUTO', vehicleNo: '', receivedDate: day(12), createdAt: recentTs(), items: [line('IM-7-0', '5567 5450 0106', 20)] },
    { id: 'IM-8', challanNo: '88', challanDate: day(1), clientId: 1, clientName: 'DELTA AUTO', vehicleNo: '', receivedDate: day(1), createdAt: recentTs(), items: [line('IM-8-0', '5206 4920 0106', 20), line('IM-8-1', '5206 4920 3313', 30)] });
  await loadAppWithState(page, s);
  // IM-1 holds both 0106 parts open; it is taken out so the match falls to the latest challan.
  const pg = { page: 'production', date: dmy, line: 'VAT-A1', rows: [
    { time: '9:00 AM', customer: 'MEHTA', part: 'CLAMP', qtyText: '94' },
    { time: '9:40 AM', customer: 'DELTA', part: '(0106)', qtyText: '15' },
    { time: '10:00 AM', customer: 'DELTA', part: '(0106+3313)', qtyText: '25' }] };
  const runs = JSON.parse(await g(page, `(function(){ S.incomingMaterial = S.incomingMaterial.filter(function(m) { return m.id !== 'IM-1'; }); return JSON.stringify(prodFromRegisterRead(${JSON.stringify(pg)}, prodCtx(), null, {}).runs.map(e => [e.part, e.partNumber || null, e.qty, e.gaugeUnknown || null])); })()`) as string);
  expect(runs).toEqual([
    ['CLAMP', null, 94, 94],
    ['(0106)', '5206 4920 0106', 15, null],             // on the latest challan (88), where the other 0106 was 12 days before
    ['(0106+3313)', '5206 4920 0106', 10, null],        // 25 shared 20 : 30 by the latest challan's pieces
    ['(0106+3313)', '5206 4920 3313', 15, null]]);
  // The flagged run: in Entries under Gauge unknown, raised on the To-do, and cleared by picking its gauge.
  await g(page, `(function(){ var p = prodData(); p.entries.push(prodSparse({ id: 'GU1', kind: 'plated', date: '${T}', line: 'vat-a1', clientId: 2, client: 'MEHTA', part: 'CLAMP', qty: 94, unit: 'NOS', slot: 'general', basis: 'register', src: 'import', time: '09:00', gaugeUnknown: 94, rounds: [{ time: '9:00 AM', qty: 94 }] })); prodTouch(); saveState(); })()`);
  expect(await g(page, `todoAppAll(['prodGaugeUnknown']).length`)).toBe(1);
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
  await page.locator('[data-action="invProdFilter"][data-flag="gauge"]').click();
  await expect(page.locator('[data-prod-entry="GU1"]')).toContainText('gauge unknown: a round of 94');
  await page.locator('[data-prod-entry="GU1"] [data-action="invProdGauge"]').click();
  await page.locator('#prodGaugePick').selectOption('35X6');
  await page.locator('[data-action="invProdGaugeSave"]').click();
  await expect(page.locator('[data-prod-entry="GU1"]')).toHaveCount(0);
  const st = await readStoredState(page);
  expect(st.production.entries.find((e: any) => e.id === 'GU1')).toMatchObject({ gauge: '35X6', gaugeSrc: 'set', gaugeUnknown: 94 });
  expect(await g(page, `todoAppAll(['prodGaugeUnknown']).length`)).toBe(0);
});
