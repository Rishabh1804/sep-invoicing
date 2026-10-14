import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, phoneFilter, readStoredState, switchTab, todayIso, toolbarMore, toolbarMoreLabels,
  workingDaysBack, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P214: the QA chain before PR 146 merges, Production, Power and the plant register (audit A5). Each test fails on the build before
// its fix. Made-up clients, parts and workers; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const back = (n: number) => shift(todayIso(), -n);
// The last working day before today (no plating on a Sunday), and the Sunday its pay week opens on.
const D = (() => { for (let n = -1; ; n--) { const d = shift(todayIso(), n); if (new Date(d + 'T00:00:00').getDay() !== 0) return d; } })();
const WS = shift(D, -new Date(D + 'T00:00:00').getDay());
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const ORBIT = { id: 31, name: 'ORBIT FORGE', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 12, effectiveFrom: '2020-04-01' }], itemRates: [] };
const GHOST = { id: 33, name: 'GHOST WORKS', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [], itemRates: [] };
// A piece client with no rupee a kilo: its plates weigh only by its default kg a piece, an estimate.
const LUMEN = { id: 34, name: 'LUMEN PRESS', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [], itemRates: [], defaultKgPc: 0.2,
  pieceRates: [{ partNumber: 'PLATE 7', gauge: '', rate: 2.5, effectiveFrom: '2020-04-01' }] };
const NOVA = { id: 11, name: 'NOVA GEARS', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [], itemRates: [] };

const run = (id: string, date: string, o: any = {}) => ({ id, kind: 'plated', date, time: '09:00', to: '09:00', line: 'vat-a1', lineSrc: 'written', slot: 'general',
  clientId: 31, client: 'ORBIT FORGE', part: 'BRKT 9', qty: 300, unit: 'KG', basis: 'hand', src: 'hand', at: 1, ...o });
const load = (id: string, date: string, o: any = {}) => ({ id, kind: 'pickled', date, time: '16:00', clientId: 11, client: 'NOVA GEARS', part: 'CLAMP 165X83', gauge: '40X6',
  qty: 200, unit: 'NOS', basis: 'pickling', src: 'paste', at: 1, ...o });
function book(entries: any[], extra: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM(), defaultCostPerKg: 8, clients: [ORBIT, GHOST, LUMEN, NOVA], ...extra };
  s.production = { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  return s;
}
/* Floor → Overview on a day, then a line card's run: Production → Lines on that line and day (P198's way in). */
async function openLinesOn(page: Page, day: string, line = 'vat-a1') {
  await switchTab(page, 'pageFloor');
  await page.locator('#flrDate').fill(day);
  await page.locator('#flrDate').dispatchEvent('change');
  await page.locator(`#flrLines [data-line="${line}"] [data-action="invFlrLine"]`).first().click();
  await expect(page.locator('#prodLinesVerdict')).toBeVisible();
}
async function openCard(page: Page, sel: string) {
  const v = page.locator(sel);
  if (!(await v.evaluate(el => (el as HTMLDetailsElement).open))) await v.locator(':scope > summary').click();
}
const fold = (page: Page, id: string) => page.locator(`#pageProduction details[data-prod-entry="${id}"]`).first();
async function openFold(page: Page, id: string) {
  const d = fold(page, id);
  if (!(await d.evaluate(el => (el as HTMLDetailsElement).open))) await d.locator(':scope > summary').click({ position: { x: 12, y: 12 } });
}
/* The shell's Add, as P136 opens it: the door on screen, else a button carrying its action. */
async function openAdd(page: Page) {
  const door = page.locator('[data-action="invAddOpen"]:visible').first();
  if (await door.count()) await door.click();
  else await page.evaluate(() => { const b = document.createElement('button'); b.setAttribute('data-action', 'invAddOpen'); b.className = 'inv-hidden'; document.body.appendChild(b); b.click(); b.remove(); });
  await expect(page.locator('[data-add-sheet]')).toBeVisible();
}
const listIds = (page: Page) => page.locator('#prodEntries [data-prod-entry]').evaluateAll(els => els.map(e => e.getAttribute('data-prod-entry')).sort());

test.describe('P214: Production, Power and the plant register, the QA chain', () => {
  test('A5-1: Power’s Enter a cut and Add’s by hand open on today, not on the day and line Lines was left on', async ({ page }) => {
    await loadAppWithState(page, book([load('L1', D), run('R1', D)]));
    await switchTab(page, 'pageProduction');
    // Lines on Pickling, stepped back a day: Lines' own Enter by hand starts there (P198); the other doors do not.
    await page.locator('[data-prod-line-switch] [data-line="pickling"]').click();
    await page.locator('#productionContent [data-action="invProdDay"][data-step="-1"]').click();
    expect(await ev(page, 'prodLinesDay()')).toBe(shift(D, -1));
    await switchTab(page, 'pagePower');
    await page.locator('#powerContent [data-action="invPowerAddCut"]').click();
    await expect(page.locator('#productionContent .inv-pagehead-title')).toHaveText('Enter power cuts');
    await expect(page.locator('#prodHandDate')).toHaveValue(todayIso());
    await page.locator('#productionContent [data-action="invProdHandDone"]').first().click();
    await expect(page.locator('#pagePower.inv-page-active')).toBeVisible();
    await openAdd(page);
    await page.locator('[data-action="invAddHand"][data-go="production"]').click();
    await expect(page.locator('#productionContent .inv-pagehead-title')).toHaveText('Enter by hand');
    await expect(page.locator('#prodHandDate')).toHaveValue(todayIso());
    await expect(page.locator('[data-action="invProdHandKind"][data-kind="plated"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('A5-2: a line’s labour per kg is its variable part, not coloured against the modelled labour, which is every tier’s', async ({ page }) => {
    const days = workingDaysBack(6), att: any = {};
    days.forEach(d => { att[d] = { marks: { 7: { st: 'P', hours: 8, ot: 0, area: 'vat-a1' } }, extra: [], note: '' }; });
    const staff = [{ id: 7, name: 'Ravi Test', comp: 'hourly', area: 'vat-a1', hourRate: 50, dayRate: 0, active: true, onFloor: true }];
    await loadAppWithState(page, book(days.map((d, i) => run('R' + i, d, { qty: 100 })), { staff, attendance: att }));
    await switchTab(page, 'pageProduction');
    const row = page.locator('#prodLabour .inv-row');
    await expect(row.locator('.inv-num')).toHaveText('₹4.00/kg');
    await expect(row.locator('.inv-row-meta')).toHaveText('6 days recorded · the variable part only');
    await expect(row.locator('[class*="inv-fig-"]')).toHaveCount(0);
  });

  test('A5-4: a cut’s cost is on Power’s cards for every role that opens Power, as its rows show it', async ({ page }) => {
    const s: any = book([{ id: 'C1', kind: 'downtime', date: todayIso(), time: '11:00', to: '11:40', downtime: { cause: 'power', setAt: 1, reason: 'R1', where: 'vat-a2' },
      basis: 'hand', src: 'hand', at: 1 }]);
    // A hand on the floor today, so the cut falls in a working window whatever the day.
    s.staff = [{ id: 7, name: 'Ravi Test', comp: 'hourly', area: 'vat-a2', hourRate: 50, dayRate: 0, active: true, onFloor: true }];
    s.attendance = { [todayIso()]: { marks: { 7: { st: 'P', hours: 8, area: 'vat-a2' } }, extra: [], note: '' } };
    s.power = { causes: [{ id: 'R1', kind: 'reason', name: 'Panel MCB trip', aliases: [], scope: 'plant', at: 1, by: 'Owner' }],
      load: { sanctioned: 25, approved: 50, approvedOn: back(40), ref: '' } };
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    expect(await ev(page, 'grdSeesMoney()')).toBe(false);
    await switchTab(page, 'pagePower');
    // The month head and the cut's row say what it cost to this role ...
    await expect(page.locator('#powerContent details[data-power-cut] .inv-row-end .inv-num').first()).toContainText('₹');
    // ... and so does the card above them.
    await openCard(page, '#powerVerdict');
    await expect(page.locator('#powerVerdict .inv-hero-title')).toContainText('1 cut this month, ₹');
    await expect(page.locator('#powerVerdict [data-power-tile="cost"] .inv-tile-value')).toContainText('₹');
    await expect(page.locator('#powerVerdict [data-power-tile="year"]')).toHaveCount(1);
    await page.locator('#powerContent .inv-viewtab[data-tab="causes"]').click();
    await expect(page.locator('#pcsVerdict [data-power-tile="top"]')).toHaveCount(1);
    await page.locator('#powerContent .inv-viewtab[data-tab="load"]').click();
    await expect(page.locator('#powerLoad [data-power-tile="penalty"]')).toHaveCount(1);
    await expect(page.locator('#powerLoad .inv-hero-sub')).toContainText('penalty since approval');
  });

  test('A5-5: Equipment’s card does not say every unit works while a supporting unit is down', async ({ page }) => {
    const s: any = book([]);
    s.plant = { units: [
      { id: 'T1', name: 'Tank 1', station: 'vat-a1', kind: 'tank', kgRound: 25, status: 'run', since: back(30), reason: '', condition: 'fair' },
      { id: 'E1', name: 'ETP pump', station: 'etp', kind: 'other', kgRound: null, status: 'down', since: back(2), reason: 'motor burnt', condition: 'fair' }], log: [] };
    await loadAppWithState(page, s);
    await switchTab(page, 'pageProduction');
    await page.locator('#productionContent .inv-viewtab[data-tab="equipment"]').click();
    await expect(page.locator('#pltVerdict .inv-hero-title')).toHaveText('1 of 1 unit down on Effluent');
    await expect(page.locator('#pltVerdict')).toHaveClass(/inv-hero-danger/);
    // The lines are still the card's factors, each its own.
    await expect(page.locator('#pltVerdict [data-plt-factor="vat-a1"]')).toContainText('100% available');
    await expect(page.locator('[data-plt-station="support"] [data-plt-unit="E1"] .inv-dot-danger')).toHaveText('Down');
  });

  test('A5-8: Lines’ Earned says what no rate prices in its own unit: kilos, not “0 pcs”', async ({ page }) => {
    const entries = [run('D1', D), run('D2', D, { clientId: 33, client: 'GHOST WORKS', part: 'RING 4', qty: 200, time: '11:00', to: '11:00' })];
    for (let k = 1; k <= 6; k++) entries.push(run('U' + k, shift(D, -7 * k), { qty: 400 }));
    await loadAppWithState(page, book(entries));
    await openLinesOn(page, D);
    await openCard(page, '#prodLinesVerdict');
    const earned = page.locator('#prodLinesVerdict [data-prod-line-tile="earned"]');
    await expect(earned.locator('.inv-tile-value')).toHaveText('₹3,600');
    await expect(earned.locator('[data-tile-delta]')).toHaveText('200 kg not priced');
  });

  test('A5-9: with nothing recorded, Production’s More has the Import its card names, and it imports', async ({ page }) => {
    await loadAppWithState(page, book([]));
    await switchTab(page, 'pageProduction');
    await expect(page.locator('#prodEmpty')).toBeVisible();
    expect(await toolbarMoreLabels(page)).toContain('Import');
    const file = { format: 'sep-production', version: 1, entries: [run('IMP1', D)] };
    const chooser = page.waitForEvent('filechooser');
    await toolbarMore(page, 'Import');
    await (await chooser).setFiles({ name: 'sep-production.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
    await expect(page.locator('.inv-toast')).toContainText('1 entry added');
    await expect.poll(async () => (await readStoredState(page)).production.entries.map((e: any) => e.id)).toEqual(['IMP1']);
  });

  test('A5-11: a run voided, or its date corrected, from Lines on its default day leaves Lines on that day', async ({ page }) => {
    const DAY = back(3);
    await loadAppWithState(page, book([run('R1', DAY), run('T1', back(9))]));
    await switchTab(page, 'pageProduction');
    expect(await ev(page, '[prodLinesDay(), _prodDay]')).toEqual([DAY, null]);
    await openFold(page, 'R1');
    await fold(page, 'R1').locator('[data-action="invProdVoid"]').click();
    await answerAsk(page, 'ok', 'Counted twice');
    await expect.poll(() => ev(page, `S.production.entries.find(function (e) { return e.id === 'R1'; }).voidReason`)).toBe('Counted twice');
    expect(await ev(page, 'prodLinesDay()')).toBe(DAY);
    await expect(page.locator('#prodLinesVerdict .inv-hero-eyebrow')).toContainText(await ev(page, `stockShortDate('${DAY}')`) as string);
    // A date corrected forward: Lines stays on the day the run was checked on.
    await loadAppWithState(page, book([run('R1', DAY), run('T1', back(9))]));
    await switchTab(page, 'pageProduction');
    await openFold(page, 'R1');
    await fold(page, 'R1').locator('[data-action="invProdCorrect"]').click();
    await page.locator('#prodHandDate').fill(back(1));
    await page.locator('#prodHandDate').dispatchEvent('change');
    await page.locator('[data-action="invProdSaveHand"]').click();
    await expect(page.locator('#prodRuns')).toBeVisible();
    expect(await ev(page, `S.production.entries.find(function (e) { return e.replaces === 'R1'; }).date`)).toBe(back(1));
    expect(await ev(page, 'prodLinesDay()')).toBe(DAY);
  });

  test('A5-12: Lines never steps past today; a past day with no record says so; a day not come is not entered', async ({ page }) => {
    const s: any = book([run('R1', todayIso()), run('R2', back(5))]);
    s.staff = [{ id: 7, name: 'Ravi Test', comp: 'hourly', area: 'vat-a1', hourRate: 50, dayRate: 0, active: true, onFloor: true }];
    // Two days back the hand stood on VAT A1 and nothing was recorded; three back, in the office.
    s.attendance = { [back(2)]: { marks: { 7: { st: 'P', hours: 8, area: 'vat-a1' } }, extra: [], note: '' }, [back(3)]: { marks: { 7: { st: 'P', hours: 8, area: 'office' } }, extra: [], note: '' } };
    await loadAppWithState(page, s);
    await switchTab(page, 'pageProduction');
    expect(await ev(page, 'prodLinesDay()')).toBe(todayIso());
    const next = page.locator('#productionContent [data-action="invProdDay"][data-step="1"]'), prev = page.locator('#productionContent [data-action="invProdDay"][data-step="-1"]');
    await expect(next).toBeDisabled();
    const title = page.locator('#prodLinesVerdict .inv-hero-title');
    // Yesterday: no attendance, no run: a gap in the record, as the runs say.
    await prev.click();
    await expect(title).toHaveText('No record this day');
    await expect(page.locator('#prodRuns .inv-empty')).toContainText('a gap, not a zero');
    await expect(next).toBeEnabled();
    // Heads on the line and no record: said so, never "Did not run".
    await prev.click();
    await expect(title).toHaveText('Heads on the general shift, no record');
    // Nobody marked on the line: it did not run.
    await prev.click();
    await expect(title).toHaveText('Did not run');
    // Stepping forward stops at today.
    for (let k = 0; k < 3; k++) await next.click();
    expect(await ev(page, 'prodLinesDay()')).toBe(todayIso());
    await expect(next).toBeDisabled();
    // A day not come is refused by the hand form.
    await toolbarMore(page, 'Enter by hand');
    await expect(page.locator('#prodHandDate')).toHaveAttribute('max', todayIso());
    await page.locator('#prodHandDate').fill(shift(todayIso(), 1));
    await page.locator('#prodHandDate').dispatchEvent('change');
    await page.locator('#prodHandClient').selectOption('31');
    await page.locator('#prodHandPart').fill('BRKT 9');
    await page.locator('#prodHandQty').fill('100');
    await page.locator('[data-action="invProdSaveHand"]').click();
    await expect(page.locator('.inv-toast')).toHaveText('That day has not come yet: pick a day up to today');
    expect(await ev(page, 'S.production.entries.length')).toBe(2);
  });

  test('A5-13: Entries names the client a To-do jump filtered by; a day keeps it named; its token clears it; a kind keeps the day', async ({ page }) => {
    const DAY = back(2);
    await loadAppWithState(page, book([load('L1', DAY), load('L2', DAY, { clientId: 31, client: 'ORBIT FORGE', part: 'BRKT 9', gauge: '' }), run('R1', DAY)]));
    await switchTab(page, 'pageProduction');
    await ev(page, `todoGo(prodGo('entries', { client: 11, flag: 'nochallan' }))`);
    const token = (key: string) => page.locator('#productionContent .inv-token').filter({ hasText: key });
    await expect(token('Client')).toContainText('NOVA GEARS');
    // The day picked in Filter (its change shuts the dialog).
    await phoneFilter(page);
    await page.locator('[data-tb-filter-dialog] #prodEntriesDay').fill(DAY);
    await expect(page.locator('[data-tb-filter-dialog]')).toHaveCount(0);
    await expect(token('Client')).toContainText('NOVA GEARS');
    await expect(token('Day')).toHaveCount(1);
    expect(await listIds(page)).toEqual(['L1']);
    await token('Client').click();
    await expect(token('Client')).toHaveCount(0);
    expect(await listIds(page)).toEqual(['L1', 'L2', 'R1']);
    // A kind narrows the day's entries; the day stays.
    await phoneFilter(page);
    await page.locator('[data-tb-filter-dialog] [data-action="invProdFilter"][data-kind="pickled"]').click();
    await expect(page.locator('[data-tb-filter-dialog]')).toHaveCount(0);
    await expect(token('Day')).toHaveCount(1);
    expect(await listIds(page)).toEqual(['L1', 'L2']);
  });

  test('A5-14: Lines → Pickling: a load with its line unknown offers its usual line once, at its row’s end, not again in its fold', async ({ page }) => {
    const DAY = back(2), entries: any[] = [];
    for (let k = 10; k <= 14; k++) entries.push(run('U' + k, back(k), { clientId: 11, client: 'NOVA GEARS', part: 'CLAMP 165X83', gauge: '40X6', qty: 400, unit: 'NOS', line: 'vat-a2' }));
    entries.push(load('L1', DAY));
    await loadAppWithState(page, book(entries));
    expect(await ev(page, 'prodLoadLine(prodIndex().byId.L1)')).toMatchObject({ how: 'unknown', hint: { line: 'vat-a2' } });
    await switchTab(page, 'pageProduction');
    await page.locator('[data-prod-line-switch] [data-line="pickling"]').click();
    const row = fold(page, 'L1');
    await expect(row.locator('[data-action="invProdUseLine"]')).toHaveCount(1);
    await openFold(page, 'L1');
    await expect(row.locator('.inv-row-children [data-action="invProdCorrect"]')).toBeVisible();
    await expect(row.locator('.inv-row-children [data-action="invProdVoid"]')).toBeVisible();
    await row.locator('summary [data-action="invProdUseLine"]').click();
    expect(await ev(page, `S.production.entries.find(function (e) { return e.id === 'L1'; }).line`)).toBe('vat-a2');
  });

  test('A5-15: what a kilo costs is kept a day at a time until the book changes, so Lines’ week is not worked out on every draw', async ({ page }) => {
    const inv = { id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: shift(D, -10), status: 'active', invoiceState: 'created', clientId: 31,
      clientName: 'ORBIT FORGE', clientGSTIN: '', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
      items: [{ partNumber: 'BRKT 9', desc: 'Bracket', hsn: '998873', unit: 'KG', qty: 100, rate: 12, amount: 1200 }], taxableValue: 1200, cgstPer: 9, cgstAmt: 108,
      sgstPer: 9, sgstAmt: 108, igstPer: 0, igstAmt: 0, grandTotal: 1416, amountInWords: '', challanNo: '', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
      transport: '', remarks: '', linkedIMIds: [], createdAt: 1 };
    await loadAppWithState(page, book([run('W0', WS, { time: '10:00', to: '10:00' }), run('D1', D)], { invoices: [inv], invNextNum: 2 }));
    const counted = (js: string) => ev(page, `(function () { var real = liveCost, n = 0; liveCost = function () { n++; return real.apply(this, arguments); };
      try { ${js} } finally { liveCost = real; } return n; })()`);
    // Two days asked for in turn: each worked out once.
    expect(await counted(`_prodCostRef = null; prodCostRef('${D}'); prodCostRef('${WS}'); prodCostRef('${D}'); prodCostRef('${WS}');`)).toBe(2);
    // A save is a new book: worked out again.
    expect(await counted(`saveState(); prodCostRef('${D}'); prodCostRef('${D}');`)).toBe(1);
    // Lines drawn again on the same book works none out.
    await openLinesOn(page, D);
    expect(await counted('renderProduction();')).toBe(0);
  });

  test('A5-16: Lines’ week against the weeks before says how many weeks it was set against', async ({ page }) => {
    await loadAppWithState(page, book([run('D1', D, { qty: 500 }), run('U1', shift(D, -7), { qty: 400 }), run('U2', shift(D, -14), { qty: 400 })]));
    expect(await ev(page, `prodLineWeek('vat-a1', '${D}').kgWeeks`)).toBe(2);
    await openLinesOn(page, D);
    await expect(page.locator('#prodLinesVerdict .inv-hero-sub')).toContainText('this week 500 kg a day, +25% on the 2 before');
  });

  test('A5-17: a piece rate’s earnings on an estimated weight: the amount exact, the rupee a kilo, the cost and what is left “≈”', async ({ page }) => {
    await loadAppWithState(page, book([run('P1', D, { clientId: 34, client: 'LUMEN PRESS', part: 'PLATE 7', qty: 1000, unit: 'NOS' })]));
    expect(await ev(page, `prodDayWorth('${D}', 'vat-a1')`)).toMatchObject({ amount: 2500, est: false, kg: 200, amountKg: 2500, kgEst: true });
    await switchTab(page, 'pageFloor');
    await page.locator('#flrDate').fill(D);
    await page.locator('#flrDate').dispatchEvent('change');
    // Floor's line card and its Production card.
    await expect(page.locator('#flrLines [data-line="vat-a1"] [data-flr-earned] .inv-row-end')).toHaveText('₹2,500');
    await expect(page.locator('#flrLines [data-line="vat-a1"] [data-flr-earned] .inv-row-meta')).toHaveText('≈ ₹12.50 a kg, cost ₹8.00');
    const card = page.locator('#flrHeroes [data-card="flr-prod"]');
    await card.locator(':scope > summary').click();
    await expect(card.locator('[data-prod-day-worth] .inv-row-end')).toHaveText('₹2,500.00');
    await expect(card.locator('[data-prod-day-cost] .inv-row-meta')).toHaveText('₹8.00 a kg × ≈ 200 kg, the full cost typed');
    await expect(card.locator('[data-prod-day-cost] .inv-row-end')).toHaveText('≈ ₹1,600.00');
    await expect(card.locator('[data-prod-day-left] .inv-row-meta')).toHaveText('≈ ₹12.50 a kg earned');
    await expect(card.locator('[data-prod-day-left] .inv-row-end')).toHaveText('≈ ₹900.00');
    // Lines' Earned tile.
    await page.locator('#flrLines [data-line="vat-a1"] [data-action="invFlrLine"]').first().click();
    await openCard(page, '#prodLinesVerdict');
    const earned = page.locator('#prodLinesVerdict [data-prod-line-tile="earned"]');
    await expect(earned.locator('.inv-tile-value')).toHaveText('₹2,500');
    await expect(earned.locator('.inv-tile-sub').first()).toHaveText('≈ ₹12.50 a kg, cost ₹8.00');
  });
});
