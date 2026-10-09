import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P190 (owner, 9 Oct 2026). The day's plating read "7,630 NOS + 150 kg · 0.68 t known, 14% of the pieces weighed": "not uniform
// enough to draw a full picture of what happened. We have data to analyse and represent it in a better way." Then: "where it
// says 1386 pieces not weighed, we should have a list of those pieces … so we can do a follow up", and "where it says VAT A1
// did a particular amount of production, calculate its efficiency as well … that is how the colour code of the gradient for
// cards in this tab will be decided. Barrel is also a special case as 50% of it is down."
// - every run is weighed by the surest route the book holds, and says which (prodWeigh);
// - the day is one card in one unit, the least it can be while pieces are unweighed, the estimates said;
// - each line's efficiency: what it plated against what its working units could plate in the time it ran, colouring its card;
// - the pieces nothing weighs are listed with the moves that weigh them, and followed up on the To-do;
// - the plant register is read as found before the day it was set up.
// Made-up clients and parts; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
// The day: the last working day before today (a Sunday is no plating day).
const D = (() => { for (let n = -1; ; n--) { const d = dayOff(n); if (new Date(d + 'T00:00:00').getDay() !== 0) return d; } })();
const before = (n: number) => { const d = new Date(D + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const g = (p: Page, js: string) => p.evaluate(src => (0, eval)(src), js);

function book(withPlant = false): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  const client = (id: number, name: string, mode: string, perKg: number, extra: any = {}) =>
    ({ id, name, billingMode: mode, gstType: 'intra', isActive: true, rates: [{ ratePerKg: perKg, effectiveFrom: '2020-04-01' }], itemRates: [], ...extra });
  s.clients = [
    client(21, 'KESTREL FORGE', 'weight', 12),
    client(22, 'ORION CLAMPS', 'piece', 5),
    client(23, 'ATLAS PRESS', 'weight', 10, { pieceWeights: [{ partNumber: 'PLATE 9', gauge: '', kgPerPiece: 0.5, effectiveFrom: '2020-04-01' }] }),
  ];
  const line = (id: string, partNumber: string, desc: string, unit: string, qty: number, extra: any = {}) => ({ id, partNumber, desc, unit, qty, ...extra });
  s.incomingMaterial.push(
    // KESTREL sends brackets by the kilo with their pieces counted: three of them, 0.13, 0.14 and 0.15 kg a piece.
    { id: 'C1', clientId: 21, challanNo: '501', challanDate: before(-10), items: [line('C1a', 'BRACKET Z 4411', 'BRACKET Z 4411', 'KG', 26, { nosQty: 200 }), line('C1b', 'BRACKET L 4412', 'BRACKET L 4412', 'KG', 30, { nosQty: 200 }), line('C1c', 'T BRACKET 4413', 'T BRACKET 4413', 'KG', 28, { nosQty: 200 })] },
    // ORION, billed by the piece at ₹5 a kg: a 40X6 clamp at ₹4.50 a piece (0.9 kg) and a 25X6 one at ₹1.50 (0.3 kg).
    { id: 'C2', clientId: 22, challanNo: '77', challanDate: before(-10), items: [line('C2a', 'CLAMP 120X80(40X6)', 'CLAMP', 'NOS', 500, { amount: 2250 }), line('C2b', 'CLAMP 90X60(25X6)', 'CLAMP', 'NOS', 1000, { amount: 1500 })] },
    // ATLAS's GADGET 7, which the floor calls WIDGET.
    { id: 'C3', clientId: 23, challanNo: '9', challanDate: before(-10), items: [line('C3a', 'GADGET 7', 'GADGET 7', 'NOS', 500)] },
  );
  const run = (id: string, ln: string, time: string, to: string, clientId: number, part: string, qty: number, unit = 'NOS', extra: any = {}) =>
    ({ id, kind: 'plated', date: D, line: ln, lineSrc: 'written', slot: 'general', time, to, clientId, part, qty, unit, basis: 'register', src: 'photo', at: 1, ...extra });
  s.production = { pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} }, entries: [
    run('A', 'vat-a1', '09:00', '11:00', 21, 'Z(BKT)', 1000, 'NOS', { rounds: [{ time: '9:00 AM', qty: 500 }, { time: '10:00 AM', qty: 500 }] }),
    run('B', 'vat-a1', '11:30', '12:30', 21, 'BRACKET Z 4411', 75, 'KG'),
    run('C', 'vat-a1', '13:00', '14:00', 23, 'PLATE 9', 100),
    run('W', 'vat-a1', '14:30', '15:30', 23, 'WIDGET', 200),
    run('E', 'vat-a2', '09:00', '12:30', 22, 'CLAMP', 600, 'NOS', { gauge: '40X6' }),
    run('F', 'vat-a2', '13:00', '16:30', 22, 'CLAMP', 300),
  ] };
  s.staff = [{ id: 1, name: 'Alfa', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true }];
  s.attendance = { [D]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, ot: 0 }, 2: { st: 'P', area: 'vat-a2', hours: 8, ot: 0 } }, extra: [], note: '' } };
  if (withPlant) {
    // The register set up on the day: VAT A1's three tanks running as found, the fourth down for a year; VAT A2's two.
    const at = new Date(D + 'T10:00:00').getTime();
    const u = (id: string, name: string, station: string, kgRound: number, status: string, since: string) => ({ id, name, station, kind: 'tank', kgRound, status, since, addedOn: since, line: station, at, condition: 'fair' });
    const yearAgo = dayOff(-365);
    s.plant = { units: [u('U1', 'A1 tank 1', 'vat-a1', 100, 'run', D), u('U2', 'A1 tank 2', 'vat-a1', 100, 'run', D), u('U3', 'A1 tank 3', 'vat-a1', 100, 'run', D), u('U4', 'A1 tank 4', 'vat-a1', 100, 'down', yearAgo),
      u('U5', 'A2 tank 1', 'vat-a2', 50, 'run', D), u('U6', 'A2 tank 2', 'vat-a2', 50, 'down', yearAgo)],
    log: ['U1', 'U2', 'U3', 'U5'].map(id => ({ id: 'L' + id, unitId: id, date: D, from: null, to: 'run', at })).concat(['U4', 'U6'].map(id => ({ id: 'L' + id, unitId: id, date: yearAgo, from: null, to: 'down', at }))) };
    // The line's pace, the planner's own setting: a round every 30 minutes on both.
    s.planner = { cfg: { lines: { 'vat-a1': { every: 30 }, 'vat-a2': { every: 30 } } } };
  }
  return s as SepState;
}

test.describe('P190: a day’s plating, whole', () => {
  test('every run is weighed by the surest route the book holds, and says which', async ({ page }) => {
    await loadAppWithState(page, book());
    const w = await g(page, `['A','B','C','W','E','F'].map(function(id) { var e = prodIndex().byId[id], r = prodWeigh(e);
      return [id, r.how, r.kg == null ? null : Math.round(r.kg * 100) / 100, r.low == null ? null : Math.round(r.low), r.high == null ? null : Math.round(r.high)]; })`) as any[];
    expect(w).toEqual([
      ['A', 'kind', 140, 130, 150],       // Z(BKT): KESTREL's brackets (BKT is a bracket), their median 0.14 kg a piece, the middle 80% 0.13–0.15
      ['B', 'written', 75, null, null],   // kilos on the run
      ['C', 'record', 50, null, null],    // the client's card: 0.5 kg a piece
      ['W', null, null, null, null],      // WIDGET: no weight anywhere, never a guess
      ['E', 'challans', 540, null, null], // the 40X6 clamp's challan it was set against: ₹4.50 over ₹5 a kg, 0.9 kg a piece
      ['F', 'kind', 90, 90, 270],         // a clamp with no gauge: ORION's clamps by pieces, the median 0.3, the range 0.3–0.9
    ]);
  });

  test('the day is one card in one unit: the least it can be, the estimates said, the lines on the clock, the clients, the worth', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageProduction');
    const card = page.locator('[data-prod-day]');
    await expect(card).toHaveAttribute('data-prod-day', D);
    // 75 written + 50 on record + 540 from the challans + 230 by kind; WIDGET's 200 pieces left out, so at least.
    await expect(card.locator('.inv-hero-fig')).toHaveText('≥ 895 kg');
    await expect(card.locator('.inv-hero-sub')).toHaveText('2,200 pieces and 75 kg recorded · 86% of the weight estimated · 200 pieces not weighed');
    await expect(card.locator('[data-prod-day-line="vat-a1"] [data-prod-day-kg]')).toHaveText('≥ 265 kg');
    await expect(card.locator('[data-prod-day-line="vat-a2"] [data-prod-day-kg]')).toHaveText('≈ 630 kg');
    // Each line on the clock, 6 AM to 6 AM.
    await expect(card.locator('[data-prod-day-line="vat-a1"] .inv-daystrip svg rect.inv-meter-ok')).toHaveCount(4);
    await expect(card.locator('[data-prod-day-line="vat-a1"] .inv-daystrip-axis')).toHaveText(/6 AM.*noon.*6 PM.*midnight.*6 AM/);
    // How it was weighed, by route.
    await expect(card.locator('[data-prod-weigh="sure"] .inv-row-end')).toHaveText('125 kg');
    await expect(card.locator('[data-prod-weigh="challans"] .inv-row-end')).toHaveText('≈ 540 kg');
    await expect(card.locator('[data-prod-weigh="kind"] .inv-row-end')).toHaveText('≈ 230 kg');
    await expect(card.locator('[data-prod-weigh="kind"]')).toContainText('the day 885 kg');
    await expect(card.locator('[data-prod-weigh="none"]')).toContainText('WIDGET');
    // The clients, by weight.
    await expect(card.locator('[data-prod-day-client]').first()).toContainText('ORION CLAMPS');
    // What the work is worth at the rates on record (₹12 and ₹10 a kg, ORION's ₹5 a kg over the clamps' weight), and the labour.
    await expect(card.locator('[data-prod-day-worth]')).toContainText('Work plated, worth ≈ ₹6,230.00');
    await expect(card.locator('[data-prod-day-worth]')).toContainText('200 pieces with no rate or weight');
    await expect(card.locator('[data-prod-day-labour]')).toContainText('Labour on the day’s record ₹800.00');
    await expect(card.locator('[data-prod-day-labour]')).toContainText('13% of what the work is worth');
    // A role that does not see money or wages sees neither.
    await g(page, `window.grdSeesMoney = function() { return false; }; window.grdSeesWages = function() { return false; }; renderProduction();`);
    await expect(card.locator('[data-prod-day-worth]')).toHaveCount(0);
    await expect(card.locator('[data-prod-day-labour]')).toHaveCount(0);
  });

  test('Floor, Lines and the week read the same weight', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    await page.locator('#flrDate').fill(D);
    await page.locator('#flrDate').dispatchEvent('change');
    await expect(page.locator('#flrTiles [data-flr-tile="plated"] .inv-tile-value')).toHaveText('≥ 895 kg');
    await expect(page.locator('#flrLines [data-line="vat-a1"] [data-flr-plated]')).toHaveText('≥ 265 kg');
    await expect(page.locator('#flrLines [data-line="vat-a1"] [data-flr-kg]')).toHaveText('1,300 NOS, 200 not weighed');
    await page.locator('#flrLines [data-line="vat-a2"] [data-action="invFlrLine"]').first().click();
    await expect(page.locator('#productionContent [data-prod-line-tile="kg"] .inv-tile-value')).toHaveText('≈ 630 kg');
    await expect(page.locator('#productionContent [data-prod-line-tile="pieces"] .inv-tile-value')).toHaveText('900 NOS');
    await expect(page.locator('#prodRuns [data-prod-entry="E"] [data-prod-run-kg]')).toHaveText('≈ 540 kg from challans');
    await expect(page.locator('#prodRuns [data-prod-entry="F"] [data-prod-run-kg]')).toHaveText('≈ 90 kg by kind');
  });

  test('the pieces nothing weighs are listed with the moves that weigh them, and followed up on the To-do', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageFloor');
    await page.locator('#flrDate').fill(D);
    await page.locator('#flrDate').dispatchEvent('change');
    const un = page.locator('#flrUnweighed');
    await expect(un.locator('[data-prod-weigh="none"]')).toHaveCount(1);
    await expect(un.locator('[data-prod-weigh="none"]')).toContainText('WIDGET');
    await expect(un.locator('[data-prod-weigh="none"]')).toContainText('ATLAS PRESS · VAT A1');
    await expect(un.locator('[data-prod-weigh="none"]')).toContainText('200 pcs');
    // The To-do follows it up, one task a client, and opens the runs on Entries.
    const tasks = await g(page, `todoApp().filter(function(t) { return t.rule === 'prodUnweighed'; }).map(function(t) { return [t.title, t.tone, t.go.flag]; })`);
    expect(tasks).toEqual([['ATLAS PRESS: 200 pieces plated with no weight', 'amber', 'unweighed']]);
    await un.locator('[data-action="invProdUnweighedAll"]').click();
    await expect(page.locator('[data-action="invProdFilter"][data-flag="unweighed"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#prodEntries [data-prod-entry]')).toHaveCount(1);
    await expect(page.locator('#prodEntries [data-prod-entry="W"]')).toBeVisible();
    // Which part? reads the floor's name as the client's part: WIDGET is GADGET 7.
    await page.locator('#prodEntries [data-prod-entry="W"] [data-action="invProdAlias"]').click();
    await page.locator('#prodAliasPick').selectOption('GADGET 7');
    await page.locator('[data-action="invProdAliasSave"]').click();
    // GADGET 7 has no weight yet either: Set its weight puts one on the client's card, from the day it was plated.
    await expect(page.locator('#prodEntries [data-prod-entry="W"]')).toBeVisible();
    await page.locator('#prodEntries [data-prod-entry="W"] [data-action="invProdWeighSet"]').click();
    await expect(page.locator('#prodWeighPart')).toHaveValue('GADGET 7');
    await page.locator('#prodWeighKg').fill('0.25');
    await page.locator('[data-action="invProdWeighSave"]').click();
    await expect(page.locator('#prodEntries [data-prod-entry]')).toHaveCount(0);
    const st = await readStoredState(page);
    expect(st.clients.find((c: any) => c.id === 23).pieceWeights).toEqual(expect.arrayContaining([expect.objectContaining({ partNumber: 'GADGET 7', kgPerPiece: 0.25, effectiveFrom: D, source: 'production' })]));
    expect(await g(page, `(function(){ var r = prodWeigh(prodIndex().byId.W); return [r.how, r.kg]; })()`)).toEqual(['record', 50]);
    expect(await g(page, `todoApp().filter(function(t) { return t.rule === 'prodUnweighed'; }).length`)).toBe(0);
  });

  test('each line’s efficiency colours its card: what it plated of what its working units could plate in the time it ran', async ({ page }) => {
    await loadAppWithState(page, book(true));
    // VAT A1: three tanks of 100 kg working (the fourth down a year), a round every 30 minutes, the general shift 8:30 to 5 (510
    // minutes): 17 rounds of 300 kg, 5,100 kg. It plated 265 kg weighed (WIDGET not): 5%. The register counted 2 rounds of the
    // brackets, 140 kg: the load is read over those alone (23% of 300 kg); 125 kg came from runs written without rounds, as
    // rounds' worth 4 of 17 (22%), but that is 47% of the kilos, so the time is not told apart on the card. Two rounds are not
    // enough to measure a tank: the typed 300 stands.
    const a1 = await g(page, `(function(){ var o = prodLineEfficiency('${D}', 'vat-a1'); return [o.nAvail, o.n, o.kgAvail, o.minutes, Math.round(o.possible), Math.round(o.eff * 100), o.tone, o.rounds, Math.round(o.pace * 100), Math.round(o.load * 100), Math.round(o.kgNoRounds), o.roundsOnly, o.kgSrc]; })()`);
    expect(a1).toEqual([3, 4, 300, 510, 5100, 5, 'danger', 2, 22, 23, 125, false, 'typed']);
    // VAT A2: one tank of 50 kg working of two (half down: the owner's "special case"), 510 minutes: 17 rounds, 850 kg.
    const a2 = await g(page, `(function(){ var o = prodLineEfficiency('${D}', 'vat-a2'); return [o.nAvail, o.n, Math.round(o.possible), Math.round(o.eff * 100), o.tone, !!o.halfDown]; })()`);
    expect(a2).toEqual([1, 2, 850, 74, 'danger', true]);
    await switchTab(page, 'pageFloor');
    await page.locator('#flrDate').fill(D);
    await page.locator('#flrDate').dispatchEvent('change');
    const c1 = page.locator('#flrLines > [data-line="vat-a1"]'), c2 = page.locator('#flrLines > [data-line="vat-a2"]');
    await expect(c1).toHaveClass(/inv-hero-danger/);
    await expect(c1.locator('.inv-hero-fig')).toHaveText('5%');
    await expect(c1.locator('.inv-hero-title')).toHaveText('≥ 265 kg of the 5.10 t its working tanks could plate');
    await expect(c1.locator('.inv-hero-sub')).toContainText('3 of 4 tanks working · 8.5 h run · 200 pieces not weighed: reads low · 300 kg a round, every 30 min (set)');
    await expect(c1.locator('[data-flr-effparts] .inv-row-title')).toHaveText('Lighter parts than the line’s round');
    await expect(c1.locator('[data-flr-effparts]')).toContainText('time: not told apart, 125 kg (47% of the kilos) written without rounds beside the 2 the register counted');
    await expect(c1.locator('[data-flr-effparts]')).toContainText('racks: 100% full, each round against its part’s fullest');
    await expect(c1.locator('[data-flr-effparts]')).toContainText('parts: a full round of the day’s parts is 70 kg, 23% of the 300 kg typed on its tanks');
    await expect(c1.locator('[data-flr-effparts]')).toContainText('typed on its tanks; the register measures 70 kg a round (23 kg a tank), not firm: 2 of the 30 rounds it needs');
    // Half its tanks down leads the card, whatever its efficiency.
    await expect(c2).toHaveClass(/inv-hero-danger/);
    await expect(c2.locator('.inv-hero-title')).toHaveText('1 of 2 tanks down');
    await expect(c2.locator('.inv-hero-fig')).toHaveText('74%');
    // The day card says each line's efficiency beside its weight.
    await switchTab(page, 'pageProduction');
    await expect(page.locator('[data-prod-day-line="vat-a1"] [data-prod-day-eff]')).toHaveText('5% efficient');
    await expect(page.locator('[data-prod-day-line="vat-a2"] [data-prod-day-eff]')).toHaveText('74% efficient');
  });

  test('the plant register is the plant as found before the day it was set up; a unit added later counts from its day', async ({ page }) => {
    await loadAppWithState(page, book(true));
    const r = await g(page, `(function(){
      var later = new Date('${dayOff(0)}T09:00:00').getTime();
      S.plant.units.push({ id: 'U7', name: 'A1 tank 5', station: 'vat-a1', kind: 'tank', kgRound: 100, status: 'run', since: '${dayOff(0)}', addedOn: '${dayOff(0)}', line: 'vat-a1', at: later });
      S.plant.log.push({ id: 'LU7', unitId: 'U7', date: '${dayOff(0)}', from: null, to: 'run', at: later });
      var c = function(d) { var x = pltCapacity('vat-a1', d); return x.nAvail + ' of ' + x.n; };
      return [c('${before(-5)}'), c('${D}'), c('${dayOff(0)}')]; })()`);
    // Five days before the register was set up: the three tanks as found, the fourth down since a year; the fifth, added
    // later, counts only from its own day.
    expect(r).toEqual(['3 of 4', '3 of 4', '4 of 5']);
  });
});
