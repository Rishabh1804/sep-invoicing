import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P191 (owner, 9 Oct 2026), on what a round of the register holds and what a piece weighs:
//   "Each register line on A1 includes 3 tanks out of the 4 available, 150 kg/3 = 50 kg an hour per tank inside VAT A1 area.
//    If confidence on rack capacity becomes high it should override defaults. Each register line on A2 includes 2 tanks."
//   "Default Mehta to 0.560 kg per unit, adjustable."
//   "Mehta's clamp have real weight values calculated in our data, maybe it is not linking to the production data due to
//    part being unassigned."
// - a name that writes one size is the client's part of that size and gauge, at that part's weight; two parts of one size
//   are never guessed between;
// - the client's default kg a piece: set once on the client whose name reads Mehta, changed and cleared on the client form;
//   it weighs a run nothing links to a part, before a kind whose parts weigh wide apart, after one whose parts agree;
// - what a tank takes a round, measured on the register's rounds over the tanks working that day: firm at 30 rounds on 5
//   days with 80% of them from parts' own weights, it is the line's round in place of the kg typed, and says so.
// Made-up clients and parts; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
// The day: the last working day before today (a Sunday is no plating day).
const D = (() => { for (let n = -1; ; n--) { const d = dayOff(n); if (new Date(d + 'T00:00:00').getDay() !== 0) return d; } })();
const before = (n: number) => { const d = new Date(D + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
// How a line's efficiency was worked out (Floor's card, §6.27): one fact a row, [label with its badge, the words under it, the figure].
const workingFacts = (card: any) => card.locator('[data-flr-effworking] .inv-row-children > .inv-row').evaluateAll((els: Element[]) => els.map(r => [r.querySelector('.inv-row-title')!.textContent!.trim(),
  (r.querySelector('.inv-row-meta') || { textContent: '' }).textContent!.trim(), r.querySelector('.inv-row-end')!.textContent!.trim()]));
const g = (p: Page, js: string) => p.evaluate(src => (0, eval)(src), js);

const client = (id: number, name: string, mode: string, perKg: number, extra: any = {}) =>
  ({ id, name, billingMode: mode, gstType: 'intra', isActive: true, rates: [{ ratePerKg: perKg, effectiveFrom: '2020-04-01' }], itemRates: [], ...extra });
// A challan line billed whole on INV-1 (twenty days before the day), so nothing plated after it is set against it.
const shut = (id: string, partNumber: string, desc: string, qty: number, amount: number, extra: any = {}) =>
  ({ id, partNumber, desc, hsn: '998873', unit: 'NOS', qty, rate: amount / qty, amount, nosQty: qty, invoiced: true, invoiceId: 'INV-1', invoiceIds: ['INV-1'], ...extra });
const run = (id: string, clientId: number, part: string, qty: number, extra: any = {}) =>
  ({ id, kind: 'plated', date: D, line: 'vat-a1', lineSrc: 'written', slot: 'general', time: '09:00', to: '10:00', clientId, part, qty, unit: 'NOS', basis: 'relay', src: 'paste', at: 1, ...extra });

function weighBook(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.clients = [client(31, 'MEHTA TEST INDUSTRIES', 'piece', 5), client(32, 'ORION WORKS', 'weight', 10)];
  s.invoices = [{ id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/TEST-00001', date: before(-20), status: 'active', invoiceState: 'dispatched', clientId: 31,
    clientName: 'MEHTA TEST INDUSTRIES', items: [{ partNumber: 'CLAMP 165X83 (NT)', desc: '40X6', unit: 'NOS', qty: 100, rate: 4.4, amount: 440 }],
    taxableValue: 440, cgstAmt: 39.6, sgstAmt: 39.6, igstAmt: 0, grandTotal: 519.2, gstType: 'intra', createdAt: 1 }];
  // MEHTA bills by the piece at ₹5 a kg, so a part's kg a piece is its amount over its count over 5: the clamps 0.88, 0.76
  // and 0.33 (three gauges, wide apart), two pads at 0.30 and 0.31 (alike), two liners at 0.20 and 0.50 (apart).
  s.incomingMaterial.push({ id: 'C1', clientId: 31, challanNo: '11', challanDate: before(-30), items: [
    shut('C1a', 'CLAMP 165X83 (NT)', '40X6', 100, 440), shut('C1b', 'CLAMP 133X83 (NT)', '40X6', 100, 380), shut('C1c', 'CLAMP 66X81 (NT)', '25X6', 100, 165),
    shut('C1d', 'PAD 7', 'PAD 7', 100, 150), shut('C1e', 'PAD 8', 'PAD 8', 100, 155), shut('C1f', 'LINER 2', 'LINER 2', 100, 100), shut('C1g', 'LINER 5', 'LINER 5', 100, 250)] });
  // ORION sends two brackets of one size, a light and a heavy one, by the kilo with their pieces counted.
  s.incomingMaterial.push({ id: 'C2', clientId: 32, challanNo: '12', challanDate: before(-30), items: [
    { ...shut('C2a', 'BRACKET 50X40', 'BRACKET 50X40', 20, 200), unit: 'KG', nosQty: 100 }, { ...shut('C2b', 'BRACKET 50X40 HD', 'BRACKET 50X40 HD', 40, 400), unit: 'KG', nosQty: 100 }] });
  s.production = { pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} }, entries: [
    run('R1', 31, 'clamp 165x83(40x6)', 400),                                                          // a size: CLAMP 165X83 (NT)
    run('R2', 31, 'CLAMP', 94, { gaugeUnknown: 94 }),                                                    // a round no rule names: the clamps, wide
    run('R3', 31, 'PAD', 100),                                                                          // the pads agree
    run('R4', 31, 'LINER', 100),                                                                        // the liners do not
    run('R5', 32, 'bracket 50x40', 100),                                                                // two brackets of that size
    run('R6', 31, 'Clamp 133x83 (40x6)', 50),                                                           // a size, spelt another way
  ] };
  return s as SepState;
}
const weigh = (page: Page, id: string) => g(page, `(function(){ var r = prodWeigh(prodIndex().byId['${id}']); return [r.how, r.kg == null ? null : Math.round(r.kg * 100) / 100, r.src || '']; })()`);

test.describe('P191: what a piece weighs, and what a tank takes a round', () => {
  test('a name that writes a size is that part; the default comes after the links and a kind whose parts agree', async ({ page }) => {
    await loadAppWithState(page, weighBook());
    // Set once on the client whose name reads Mehta, and only there.
    const st: any = await g(page, `({ m: S.clients.find(function(c){ return c.id === 31; }).defaultKgPc, o: S.clients.find(function(c){ return c.id === 32; }).defaultKgPc, flag: S._clientKgPcDefault1 })`);
    expect(st).toEqual({ m: 0.56, flag: true });
    expect(await weigh(page, 'R1')).toEqual(['record', 352, 'its size: CLAMP 165X83 (NT)']);
    expect(await weigh(page, 'R6')).toEqual(['record', 38, 'its size: CLAMP 133X83 (NT)']);
    // Nothing links the clamp of no gauge to a part, and the client's clamps weigh 0.33 to 0.88: the client's default.
    expect(await weigh(page, 'R2')).toEqual(['default', 52.64, 'the client’s default']);
    // The pads agree (0.30, 0.31): their own weight wins over the default. The liners do not (0.20, 0.50): the default.
    expect((await weigh(page, 'R3'))[0]).toBe('kind');
    expect(await weigh(page, 'R4')).toEqual(['default', 56, 'the client’s default']);
    // Two brackets of one size weigh apart: neither is guessed; ORION has no default, so its usual by kind.
    expect((await weigh(page, 'R5'))[0]).toBe('kind');
    // The day's weighing names the default, with the door that changes it.
    await switchTab(page, 'pageProduction');
    const row = page.locator('[data-prod-weigh="default"]').first();
    await expect(row).toContainText('At MEHTA TEST INDUSTRIES’s default');
    await expect(row.locator('.inv-row-meta')).toHaveText('0.560 kg a piece · 194 pcs');
  });

  test('the default is adjustable on the client: changed, the runs follow; cleared, the kind is used again', async ({ page }) => {
    await loadAppWithState(page, weighBook());
    await switchTab(page, 'pageProduction');
    // The routes are folded under "How it was weighed" (§6.27): opened, the default's Change is there.
    await page.locator('[data-prod-day-weighing] > summary').click();
    await page.locator('[data-prod-weigh="default"] [data-action="invEditClient"]').first().click();
    const f = page.locator('#ceditDefaultKgPc');
    await expect(f).toHaveValue('0.56');
    await f.fill('0.6');
    await page.locator('[data-action="invSaveClient"]').click();
    expect((await readStoredState(page)).clients.find((c: any) => c.id === 31).defaultKgPc).toBe(0.6);
    expect(await weigh(page, 'R2')).toEqual(['default', 56.4, 'the client’s default']);
    await expect(page.locator('[data-prod-weigh="default"]').first()).toContainText('0.600 kg a piece');
    // A weight that is no weight is refused, and nothing is saved.
    await page.locator('[data-prod-weigh="default"] [data-action="invEditClient"]').first().click();
    await page.locator('#ceditDefaultKgPc').fill('-1');
    await page.locator('[data-action="invSaveClient"]').click();
    await expect(page.locator('#ceditDefaultKgPc')).toBeVisible();
    expect((await readStoredState(page)).clients.find((c: any) => c.id === 31).defaultKgPc).toBe(0.6);
    // Cleared: off the record, and the clamp of no gauge goes back to the client's usual by kind.
    await page.locator('#ceditDefaultKgPc').fill('');
    await page.locator('[data-action="invSaveClient"]').click();
    expect('defaultKgPc' in (await readStoredState(page)).clients.find((c: any) => c.id === 31)).toBe(false);
    expect((await weigh(page, 'R2'))[0]).toBe('kind');
    // The flag travels with the book: a cleared default is not set again at the next start.
    await page.reload();
    await page.waitForSelector('body.inv-booted');
    expect((await weigh(page, 'R2'))[0]).toBe('kind');
  });

  // NOVA GEARS' GEAR 5 weighs 0.5 kg on the client's card: a round of 100 is 50 kg. VAT A2 has two tanks of 45 kg typed, a
  // round every 30 minutes. The register counts 6 rounds a day.
  function tankBook(days: number, cogDays = 0): SepState {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.clients = [client(41, 'NOVA GEARS', 'weight', 10, { pieceWeights: [{ partNumber: 'GEAR 5', gauge: '', kgPerPiece: 0.5, effectiveFrom: '2020-04-01' }], defaultKgPc: 0.5 })];
    const at = new Date(dayOff(-100) + 'T10:00:00').getTime();
    const u = (id: string, name: string) => ({ id, name, station: 'vat-a2', kind: 'tank', kgRound: 45, status: 'run', since: dayOff(-100), addedOn: dayOff(-100), line: 'vat-a2', at, condition: 'fair' });
    s.plant = { units: [u('U1', 'A2 tank 1'), u('U2', 'A2 tank 2')], log: ['U1', 'U2'].map(id => ({ id: 'L' + id, unitId: id, date: dayOff(-100), from: null, to: 'run', at })) };
    s.planner = { cfg: { lines: { 'vat-a2': { every: 30 } } } };
    const entries: any[] = [];
    for (let i = 0; i < days; i++) {
      // A cog nobody has weighed is weighed at the client's default: a round that rests on no part's own weight.
      const cog = i >= days - cogDays;
      entries.push({ id: 'T' + i, kind: 'plated', date: before(-i), line: 'vat-a2', lineSrc: 'written', slot: 'general', time: '09:00', to: '11:30', clientId: 41,
        part: cog ? 'COG' : 'GEAR 5', qty: 600, unit: 'NOS', basis: 'register', src: 'photo', at: 1,
        rounds: ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'].map(t => ({ time: t, qty: 100 })) });
    }
    s.production = { pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} }, entries };
    return s as SepState;
  }

  test('what a tank takes a round, firm: the line’s round in place of the kg typed, said on the card and the plant strip', async ({ page }) => {
    await loadAppWithState(page, tankBook(6));
    const t: any = await g(page, `(function(){ var t = prodTankLoad('vat-a2', '${D}'); return [t.rounds, t.days, t.share, t.perRound, t.perTank, t.firm]; })()`);
    expect(t).toEqual([36, 6, 1, 50, 25, true]);
    // A round is both tanks: 25 kg a tank × 2 = 50 kg, where the typed 2 × 45 = 90 stood. 17 rounds in the general shift: 850 kg
    // possible, 300 plated (35%). Every round was full: the load 100%, the pace 6 of 17.
    const o: any = await g(page, `(function(){ var o = prodLineEfficiency('${D}', 'vat-a2'); return [o.kgSrc, o.kgAvail, o.kgTyped, Math.round(o.possible), Math.round(o.eff * 100), Math.round(o.load * 100), Math.round(o.pace * 100), o.tone]; })()`);
    expect(o).toEqual(['measured', 50, 90, 850, 35, 100, 35, 'danger']);
    // One basis for every day: the first day is judged by the same measure, though on its own day the register held one day.
    expect(await g(page, `(function(){ var o = prodLineEfficiency('${before(-5)}', 'vat-a2'); return [o.kgSrc, o.kgAvail]; })()`)).toEqual(['measured', 50]);
    await switchTab(page, 'pageFloor');
    await page.locator('#flrDate').fill(D);
    await page.locator('#flrDate').dispatchEvent('change');
    const card = page.locator('#flrLines > [data-line="vat-a2"]');
    await expect(card.locator('.inv-hero-sub')).toHaveText('2 of 2 tanks working · 8.5 h run');
    const f = await workingFacts(card);
    expect(f.filter((x: string[]) => /^Rounds|^A full round (measured|typed)/.test(x[0]))).toEqual([['Rounds the hours allowed', '', '17'], ['Rounds run', 'counted on the register', '6'],
      ['A full round measured', '25 kg a tank × 2 · 36 rounds · typed 90', '50 kg']]);
    // The plant strip says what the line plates a round, and that it is the line's round now.
    await switchTab(page, 'pageProduction');
    await page.locator('#productionContent .inv-viewtab[data-tab="equipment"]').click();
    await expect(page.locator('[data-plt-station="vat-a2"] [data-plt-cap]')).toContainText('plating 50 kg a round measured');
    await expect(page.locator('[data-plt-station="vat-a2"] [data-plt-used="measured"]')).toHaveClass(/inv-badge-ok/);
    await expect(page.locator('[data-plt-station="vat-a2"] [data-plt-cap]')).not.toContainText('running at');
  });

  test('not firm: too few days, or too few rounds from parts’ own weights; the typed round stands and the measure is said', async ({ page }) => {
    await loadAppWithState(page, tankBook(4));
    let o: any = await g(page, `(function(){ var o = prodLineEfficiency('${D}', 'vat-a2'); return [o.kgSrc, o.kgAvail, o.tank.firm, o.tank.why]; })()`);
    expect(o).toEqual(['typed', 90, false, '24 of the 30 rounds it needs, 4 of the 5 days it needs']);
    await switchTab(page, 'pageFloor');
    await page.locator('#flrDate').fill(D);
    await page.locator('#flrDate').dispatchEvent('change');
    expect((await workingFacts(page.locator('#flrLines > [data-line="vat-a2"]'))).find((x: string[]) => /^A full round /.test(x[0])))
      .toEqual(['A full round typed', 'register 50 kg, not firm: 24 of the 30 rounds it needs', '90 kg']);
    // Six days, two of them of a cog weighed at the client's default: 24 of 36 rounds from a part's own weight (67%).
    await loadAppWithState(page, tankBook(6, 2));
    o = await g(page, `(function(){ var o = prodLineEfficiency('${D}', 'vat-a2'); return [o.kgSrc, o.kgAvail, o.tank.linked, o.tank.why]; })()`);
    expect(o).toEqual(['typed', 90, 24, '67% of the rounds from a part’s own weight, firm at 80%']);
    // The plant strip reads the register's figure against the typed round while it is not firm.
    const used: any = await g(page, `(function(){ var c = pltCapacity('vat-a2'); return [Math.round(c.used.kgRound), Math.round(c.used.pct * 100)]; })()`);
    expect(used).toEqual([50, 56]);
  });

  // The owner's answers of 9 Oct: "1. Yes" (the register's pace, once firm, in place of the one set) and "2. We'll do both, so
  // solutions for efficiency can be worked out" (the load as how full the racks were and what the parts weigh).
  // VAT A2's two tanks typed at 45 kg, a round set every 30 minutes. Before the day, `days` days of GEAR 5 (0.5 kg) at 100 a
  // round, every 20 minutes from 9:00 to 11:40; on the day GEAR 9 (1 kg) the same way, its last round 40.
  function paceBook(days: number, opts: { shared?: boolean, unweighed?: boolean } = {}): SepState {
    const s: any = tankBook(0);
    s.clients[0].pieceWeights.push({ partNumber: 'GEAR 9', gauge: '', kgPerPiece: 1, effectiveFrom: '2020-04-01' });
    s.clients.push(client(42, 'ATLAS PRESS', 'weight', 10, { pieceWeights: [{ partNumber: 'SPACER 3', gauge: '', kgPerPiece: 0.5, effectiveFrom: '2020-04-01' }] }), client(43, 'ZENITH TOOLS', 'weight', 10));
    const times = ['9:00 AM', '9:20 AM', '9:40 AM', '10:00 AM', '10:20 AM', '10:40 AM', '11:00 AM', '11:20 AM', '11:40 AM'];
    const e = (id: string, date: string, clientId: number, part: string, rounds: any[], time = '09:00', to = '11:40') => ({ id, kind: 'plated', date, line: 'vat-a2', lineSrc: 'written',
      slot: 'general', time, to, clientId, part, qty: rounds.reduce((t, x) => t + x.qty, 0), unit: 'NOS', basis: 'register', src: 'photo', at: 1, rounds });
    for (let i = 1; i <= days; i++) s.production.entries.push(e('P' + i, before(-i), 41, 'GEAR 5', times.map(t => ({ time: t, qty: 100 }))));
    s.production.entries.push(e('G', D, 41, 'GEAR 9', times.map((t, k) => ({ time: t, qty: k === 8 ? 40 : 100 }))));
    // A round two clients shared: the last round held GEAR 9's 40 and ATLAS's 60 spacers.
    if (opts.shared) s.production.entries.push(e('S', D, 42, 'SPACER 3', [{ time: '11:40 AM', qty: 60 }], '11:40', '11:40'));
    // Two rounds of a part nothing weighs.
    if (opts.unweighed) s.production.entries.push(e('U', D, 43, 'MYSTERY', [{ time: '12:00 PM', qty: 100 }, { time: '12:20 PM', qty: 100 }], '12:00', '12:20'));
    return s as SepState;
  }
  const eff = (page: Page) => g(page, `(function(){ var o = prodLineEfficiency('${D}', 'vat-a2'); var r = function(x) { return x == null ? null : Math.round(x * 100); };
    return [o.every, o.everySrc, o.everySet, o.cycle.shifts, o.kgSrc, o.kgAvail, o.rounds, Math.round(o.roundsPossible * 10) / 10, r(o.eff), r(o.pace), r(o.racks), r(o.parts), r(o.weighed),
      Math.round(o.pace * o.racks * o.parts * o.weighed * 1000) === Math.round(o.eff * 1000)]; })()`);
  const openDay = async (page: Page) => {
    await switchTab(page, 'pageFloor');
    await page.locator('#flrDate').fill(D);
    await page.locator('#flrDate').dispatchEvent('change');
    return page.locator('#flrLines > [data-line="vat-a2"]');
  };

  test('the register’s pace, firm, replaces the one set; the load splits into racks and parts, and the four multiply to the figure', async ({ page }) => {
    await loadAppWithState(page, paceBook(6));
    // Seven shifts of 9 rounds over 160 minutes: a round every 20, in place of the 30 set. The tanks' round is measured too:
    // 25 kg a tank (GEAR 5's 100 at 0.5 kg over two tanks), so the line's round is 50. The general shift's 510 minutes allow
    // 25.5 rounds; 9 ran (35%). GEAR 9's racks: 840 pieces of the 900 nine full rounds hold (93%). A full round of GEAR 9 is
    // 100 kg, twice the line's usual 50 (200%). 35% × 93% × 200% is the 66% the line plated of what it could.
    expect(await eff(page)).toEqual([20, 'measured', 30, 7, 'measured', 50, 9, 25.5, 66, 35, 93, 200, 100, true]);
    const card = await openDay(page);
    await expect(card.locator('.inv-hero-sub')).toHaveText('2 of 2 tanks working · 8.5 h run');
    await expect(card.locator('[data-flr-effverdict]')).toHaveText('The time lost most');
    // The factors at a glance, a tile each: what it lost, in its tone; the parts only said.
    const tiles = await card.locator('[data-flr-effsplit] .inv-tile').evaluateAll(els => els.map(t => [(t as HTMLElement).dataset.flrFactor,
      t.querySelector('.inv-tile-value')!.textContent, t.querySelector('.inv-tile-sub')!.textContent, t.className.replace('inv-tile', '').trim()]));
    expect(tiles).toEqual([['time', '35%', '9 of 25.5 rounds', 'inv-tile-danger'], ['racks', '93%', '1 part not full', 'inv-tile-warning'], ['parts', '200%', '100 of 50 kg a round', 'inv-tile-info']]);
    // How it was worked out, in the order the figure is built: the time, then the round; a part run part-full is a row of its own.
    expect(await workingFacts(card)).toEqual([
      ['Hours run', '', '8.5 h'],
      ['A round every measured', 'on the register, 7 shifts · set 30', '20 min'],
      ['Rounds the hours allowed', '', '25.5'],
      ['Rounds run', 'counted on the register', '9'],
      ['A full round measured', '25 kg a tank × 2 · 63 rounds · typed 90', '50 kg'],
      ['Racks full', 'against each part’s fullest round', '93%'],
      ['GEAR 9', 'NOVA GEARS · 9 rounds of 100', '93%'],
      ['A full round of the day’s parts', '200% of the line’s round', '100 kg']]);
  });

  test('a round two clients share is one round, full as it was; rounds with no weight are said; a pace not yet firm is only said', async ({ page }) => {
    // The last round held 40 gears and 60 spacers: one round (9, not 10), and nobody's racks part-full by it.
    await loadAppWithState(page, paceBook(6, { shared: true }));
    expect(await eff(page)).toEqual([20, 'measured', 30, 7, 'measured', 50, 9, 25.5, 68, 35, 100, 193, 100, true]);
    let f = await workingFacts(await openDay(page));
    expect(f.filter((x: string[]) => /^Rounds run|^Racks/.test(x[0]))).toEqual([['Rounds run', 'counted on the register', '9'], ['Racks full', 'against each part’s fullest round', '100%']]);
    await expect(page.locator('#flrLines > [data-line="vat-a2"] [data-flr-partfull]')).toHaveCount(0);
    // Two rounds of a part nothing weighs: the time counts them (11 of 25.5), and what they held is said as left out.
    await loadAppWithState(page, paceBook(6, { unweighed: true }));
    expect(await eff(page)).toEqual([20, 'measured', 30, 7, 'measured', 50, 11, 25.5, 66, 43, 93, 200, 82, true]);
    f = await workingFacts(await openDay(page));
    expect(f.filter((x: string[]) => /^Rounds run|^Rounds with no weight/.test(x[0]))).toEqual([['Rounds run', 'counted on the register', '11'],
      ['Rounds with no weight', 'about 18% of the work: reads low', '2 of 11']]);
    await expect(page.locator('#flrLines > [data-line="vat-a2"] [data-flr-factor="weighed"]')).toHaveText(/Weighed\s*82%\s*2 of 11 rounds unweighed/);
    await expect(page.locator('#flrLines > [data-line="vat-a2"] [data-flr-factor="weighed"]')).toHaveClass(/inv-tile-warning/);
    // Four shifts: the pace is not firm, so the 30 set stands and the register's 20 is said beside it.
    await loadAppWithState(page, paceBook(3));
    const o: any = await g(page, `(function(){ var o = prodLineEfficiency('${D}', 'vat-a2'); return [o.every, o.everySrc, o.cycle.every, o.cycle.firm, o.cycle.why]; })()`);
    expect(o).toEqual([30, 'set', 20, false, '4 of the 5 shifts it needs']);
    const card = await openDay(page);
    expect((await workingFacts(card)).find((x: string[]) => /^A round every/.test(x[0]))).toEqual(['A round every set', 'register 20 min, not firm: 4 of the 5 shifts it needs', '30 min']);
  });

  // The owner's answers of 9 Oct: a round of 108 of Mehta's clamps on VAT A1 is "above 32x6"; "126 - 150xxxxxx series, 90/87 -
  // everything else" (the floor writes their L.C. Pads and liners as LINER).
  test('Mehta’s round of 108 reads above 32x6, the runs saved at 108 included; a liner round of 126 is the 150 series, 90 the rest', async ({ page }) => {
    const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
    s.clients = [client(31, 'MEHTA TEST INDUSTRIES', 'piece', 5)];
    const open = (id: string, partNumber: string, desc: string, qty: number, amount: number) => ({ id, partNumber, desc, hsn: '998873', unit: 'NOS', qty, rate: amount / qty, amount, nosQty: qty, invoiced: false, invoiceId: null });
    // The pads of the 150 series at 0.309 kg a piece (₹1.545 at ₹5 a kg), a liner outside it at 0.411.
    s.incomingMaterial.push({ id: 'C9', clientId: 31, challanNo: '91', challanDate: before(-3), items: [open('C9a', '150X88X3', 'L.C.Pad', 1000, 1545), open('C9b', '220X80X3', 'LINER', 500, 1027.5)] });
    const reg = (id: string, part: string, size: number, n: number, extra: any = {}) => ({ id, kind: 'plated', date: D, line: 'vat-a1', lineSrc: 'written', slot: 'general', time: '09:00', to: '11:00',
      clientId: 31, client: 'MEHTA', part, qty: size * n, unit: 'NOS', basis: 'register', src: 'photo', at: 1, rounds: Array.from({ length: n }, (_, i) => ({ time: (9 + i) + ':00 AM', qty: size })), ...extra });
    s.production = { pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} }, entries: [
      reg('G108', 'CLAMP', 108, 2, { gaugeUnknown: 108 }), reg('G94', 'CLAMP', 94, 1, { gaugeUnknown: 94 }),
      reg('L126', 'LINER', 126, 2), reg('L90', 'LINER', 90, 2), reg('L39', 'LINER', 39, 1)] };
    await loadAppWithState(page, s as SepState);
    const rules: any = await g(page, `({ gauge: prodData().gaugeRules.map(function(r){ return r.racks.join('/') + ':' + r.gauges.join('/'); }),
      series: prodData().seriesRules.map(function(r){ return r.racks.join('/') + ':' + (r.except ? 'not ' : '') + r.prefix; }) })`);
    expect(rules).toEqual({ gauge: ['150/100:25X6/30X6', '120/72/108:35X6/35X8/40X6'], series: ['126:150', '90/87:not 150'] });
    // The run saved at 108 is read by the rule now; a round of 94 is in none and stays flagged.
    const st = await readStoredState(page);
    const e108 = st.production.entries.find((e: any) => e.id === 'G108'), e94 = st.production.entries.find((e: any) => e.id === 'G94');
    expect([e108.gaugeOptions, e108.gaugeSrc, e108.gaugeRuled.rack, 'gaugeUnknown' in e108]).toEqual([['35X6', '35X8', '40X6'], 'rack', 108, false]);
    expect(e94.gaugeUnknown).toBe(94);
    // The liners: a round of 126 is set against the 150 series' challan, 90 against the others, 39 against none.
    expect(await weigh(page, 'L126')).toEqual(['challans', 77.87, 'challans']);
    expect(await weigh(page, 'L90')).toEqual(['challans', 73.98, 'challans']);
    expect(await weigh(page, 'L39')).toEqual(['default', 21.84, 'the client’s default']);
  });
});
